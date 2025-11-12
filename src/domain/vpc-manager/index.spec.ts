import { describe, expect, test, beforeEach, mock } from 'bun:test';

const mockGetStackResources = mock(() => []);
const mockDescribeVpcs = mock(() => []);
const mockDescribeSubnets = mock(() => []);
const mockDescribeRouteTables = mock(() => []);
const mockStartEvent = mock(async () => {});
const mockFinishEvent = mock(async () => {});
const mockGetStackName = mock((projectName, stage) => `${projectName}-${stage}`);

const mockCfLogicalNames = {
  vpc: mock(() => 'Vpc'),
  subnet: mock((isPublic, index) => `${isPublic ? 'Public' : 'Private'}Subnet${index}`)
};

const mockStpErrors = {
  e131: mock(() => new Error('VPC not found')),
  e133: mock(() => new Error('Insufficient public subnets')),
  e134: mock(() => new Error('VPC CIDR not private')),
  e135: mock(() => new Error('Insufficient private subnets'))
};

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    getStackResources: mockGetStackResources,
    describeVpcs: mockDescribeVpcs,
    describeSubnets: mockDescribeSubnets,
    describeRouteTables: mockDescribeRouteTables
  }
}));

mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mockStartEvent,
    finishEvent: mockFinishEvent
  }
}));

mock.module('@shared/naming/utils', () => ({
  getStackName: mockGetStackName
}));

mock.module('@shared/naming/logical-names', () => ({
  cfLogicalNames: mockCfLogicalNames
}));

mock.module('@errors', () => ({
  stpErrors: mockStpErrors
}));

mock.module('@cloudform/functions', () => ({
  Ref: mock((logicalName) => ({ Ref: logicalName }))
}));

describe('VpcManager', () => {
  let vpcManager: any;

  beforeEach(async () => {
    mock.restore();
    mockGetStackResources.mockClear();
    mockDescribeVpcs.mockClear();
    mockDescribeSubnets.mockClear();
    mockDescribeRouteTables.mockClear();
    mockStartEvent.mockClear();
    mockFinishEvent.mockClear();
    mockGetStackName.mockClear();
    mockCfLogicalNames.vpc.mockClear();
    mockCfLogicalNames.subnet.mockClear();

    mockGetStackName.mockImplementation((projectName, stage) => `${projectName}-${stage}`);
    mockCfLogicalNames.vpc.mockReturnValue('Vpc');
    mockCfLogicalNames.subnet.mockImplementation((isPublic, index) =>
      `${isPublic ? 'Public' : 'Private'}Subnet${index}`
    );

    const module = await import('./index');
    vpcManager = module.vpcManager;
    await vpcManager.init();
  });

  describe('initialization', () => {
    test('should initialize successfully without reuseVpc config', async () => {
      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init();
      expect(manager).toBeDefined();
    });

    test('should skip loading VPC info when reuseVpc not configured', async () => {
      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init({});

      expect(mockStartEvent).not.toHaveBeenCalled();
      expect(mockDescribeVpcs).not.toHaveBeenCalled();
    });

    test('should load VPC info with direct VPC ID', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        {
          VpcId: 'vpc-123',
          CidrBlock: '10.0.0.0/16'
        }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-1', AvailabilityZone: 'us-east-1a' },
        { SubnetId: 'subnet-2', AvailabilityZone: 'us-east-1b' },
        { SubnetId: 'subnet-3', AvailabilityZone: 'us-east-1c' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-1',
          Routes: [
            { DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }
          ],
          Associations: [
            { SubnetId: 'subnet-1' },
            { SubnetId: 'subnet-2' },
            { SubnetId: 'subnet-3' }
          ]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init({
        reuseVpc: { vpcId: 'vpc-123' }
      });

      expect(mockStartEvent).toHaveBeenCalled();
      expect(mockDescribeVpcs).toHaveBeenCalledWith(['vpc-123']);
      expect(mockDescribeSubnets).toHaveBeenCalledWith({ vpcId: 'vpc-123' });
      expect(mockFinishEvent).toHaveBeenCalled();
    });

    test('should load VPC info from target stack', async () => {
      mockGetStackResources.mockResolvedValueOnce([
        {
          LogicalResourceId: 'Vpc',
          PhysicalResourceId: 'vpc-456'
        }
      ]);

      mockDescribeVpcs.mockResolvedValueOnce([
        {
          VpcId: 'vpc-456',
          CidrBlock: '172.16.0.0/16'
        }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-1' },
        { SubnetId: 'subnet-2' },
        { SubnetId: 'subnet-3' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-1',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }],
          Associations: [
            { Main: false, SubnetId: 'subnet-1' },
            { Main: false, SubnetId: 'subnet-2' },
            { Main: false, SubnetId: 'subnet-3' }
          ]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init({
        reuseVpc: { projectName: 'test-project', stage: 'test' }
      });

      expect(mockGetStackResources).toHaveBeenCalledWith('test-project-test');
      expect(mockDescribeVpcs).toHaveBeenCalledWith(['vpc-456']);
    });

    test('should throw error when VPC not found in stack', async () => {
      mockGetStackResources.mockResolvedValueOnce([]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();

      await expect(
        manager.init({
          reuseVpc: { projectName: 'test-project', stage: 'test' }
        })
      ).rejects.toThrow();
    });

    test('should validate VPC CIDR is private', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        {
          VpcId: 'vpc-123',
          CidrBlock: '8.8.8.0/24' // Public IP range
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();

      await expect(
        manager.init({
          reuseVpc: { vpcId: 'vpc-123' }
        })
      ).rejects.toThrow();
    });

    test('should categorize subnets as public and private', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        {
          VpcId: 'vpc-123',
          CidrBlock: '10.0.0.0/16'
        }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-public-1' },
        { SubnetId: 'subnet-public-2' },
        { SubnetId: 'subnet-public-3' },
        { SubnetId: 'subnet-private-1' },
        { SubnetId: 'subnet-private-2' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-public',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }],
          Associations: [
            { SubnetId: 'subnet-public-1' },
            { SubnetId: 'subnet-public-2' },
            { SubnetId: 'subnet-public-3' }
          ]
        },
        {
          RouteTableId: 'rtb-private',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', NatGatewayId: 'nat-123' }],
          Associations: [
            { SubnetId: 'subnet-private-1' },
            { SubnetId: 'subnet-private-2' }
          ]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init({
        reuseVpc: { vpcId: 'vpc-123' }
      });

      const publicSubnets = manager.getPublicSubnetIds();
      const privateSubnets = manager.getPrivateSubnetIds();

      expect(publicSubnets).toHaveLength(3);
      expect(privateSubnets).toHaveLength(2);
    });

    test('should throw error when insufficient public subnets', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        {
          VpcId: 'vpc-123',
          CidrBlock: '10.0.0.0/16'
        }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-1' },
        { SubnetId: 'subnet-2' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-1',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }],
          Associations: [
            { SubnetId: 'subnet-1' },
            { SubnetId: 'subnet-2' }
          ]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();

      await expect(
        manager.init({
          reuseVpc: { vpcId: 'vpc-123' }
        })
      ).rejects.toThrow();
    });

    test('should throw error when insufficient private subnets for resources requiring them', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        {
          VpcId: 'vpc-123',
          CidrBlock: '10.0.0.0/16'
        }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-public-1' },
        { SubnetId: 'subnet-public-2' },
        { SubnetId: 'subnet-public-3' },
        { SubnetId: 'subnet-private-1' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-public',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }],
          Associations: [
            { SubnetId: 'subnet-public-1' },
            { SubnetId: 'subnet-public-2' },
            { SubnetId: 'subnet-public-3' }
          ]
        },
        {
          RouteTableId: 'rtb-private',
          Routes: [],
          Associations: [{ SubnetId: 'subnet-private-1' }]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();

      await expect(
        manager.init({
          reuseVpc: { vpcId: 'vpc-123' },
          resourcesRequiringPrivateSubnet: [{ name: 'myDatabase', type: 'rds-database' }]
        })
      ).rejects.toThrow();
    });

    test('should use main route table for subnets without explicit association', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        {
          VpcId: 'vpc-123',
          CidrBlock: '10.0.0.0/16'
        }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-1' },
        { SubnetId: 'subnet-2' },
        { SubnetId: 'subnet-3' },
        { SubnetId: 'subnet-4' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-main',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }],
          Associations: [{ Main: true }]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init({
        reuseVpc: { vpcId: 'vpc-123' }
      });

      const publicSubnets = manager.getPublicSubnetIds();
      expect(publicSubnets).toHaveLength(4);
    });
  });

  describe('getVpcId', () => {
    test('should return VPC ID when VPC is loaded', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        {
          VpcId: 'vpc-123',
          CidrBlock: '10.0.0.0/16'
        }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-1' },
        { SubnetId: 'subnet-2' },
        { SubnetId: 'subnet-3' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-1',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }],
          Associations: [{ Main: true }]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init({
        reuseVpc: { vpcId: 'vpc-123' }
      });

      const vpcId = manager.getVpcId();
      expect(vpcId).toBe('vpc-123');
    });

    test('should return CloudFormation Ref when VPC not loaded', () => {
      const vpcId = vpcManager.getVpcId();
      expect(vpcId).toEqual({ Ref: 'Vpc' });
    });
  });

  describe('getVpcCidr', () => {
    test('should return VPC CIDR when VPC is loaded', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        {
          VpcId: 'vpc-123',
          CidrBlock: '10.0.0.0/16'
        }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-1' },
        { SubnetId: 'subnet-2' },
        { SubnetId: 'subnet-3' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-1',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }],
          Associations: [{ Main: true }]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init({
        reuseVpc: { vpcId: 'vpc-123' }
      });

      const cidr = manager.getVpcCidr();
      expect(cidr).toBe('10.0.0.0/16');
    });

    test('should return default CIDR when VPC not loaded', () => {
      const cidr = vpcManager.getVpcCidr();
      expect(cidr).toBe('172.16.0.0/16');
    });
  });

  describe('getPublicSubnetIds', () => {
    test('should return loaded public subnet IDs', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        {
          VpcId: 'vpc-123',
          CidrBlock: '10.0.0.0/16'
        }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-pub-1' },
        { SubnetId: 'subnet-pub-2' },
        { SubnetId: 'subnet-pub-3' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-1',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }],
          Associations: [{ Main: true }]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init({
        reuseVpc: { vpcId: 'vpc-123' }
      });

      const subnetIds = manager.getPublicSubnetIds();
      expect(subnetIds).toEqual(['subnet-pub-1', 'subnet-pub-2', 'subnet-pub-3']);
    });

    test('should return CloudFormation Refs when subnets not loaded', () => {
      const subnetIds = vpcManager.getPublicSubnetIds();
      expect(subnetIds).toHaveLength(3);
      expect(subnetIds[0]).toEqual({ Ref: 'PublicSubnet0' });
      expect(subnetIds[1]).toEqual({ Ref: 'PublicSubnet1' });
      expect(subnetIds[2]).toEqual({ Ref: 'PublicSubnet2' });
    });
  });

  describe('getPrivateSubnetIds', () => {
    test('should return loaded private subnet IDs', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        {
          VpcId: 'vpc-123',
          CidrBlock: '10.0.0.0/16'
        }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-pub-1' },
        { SubnetId: 'subnet-pub-2' },
        { SubnetId: 'subnet-pub-3' },
        { SubnetId: 'subnet-priv-1' },
        { SubnetId: 'subnet-priv-2' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-public',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }],
          Associations: [
            { SubnetId: 'subnet-pub-1' },
            { SubnetId: 'subnet-pub-2' },
            { SubnetId: 'subnet-pub-3' }
          ]
        },
        {
          RouteTableId: 'rtb-private',
          Routes: [],
          Associations: [
            { SubnetId: 'subnet-priv-1' },
            { SubnetId: 'subnet-priv-2' }
          ]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init({
        reuseVpc: { vpcId: 'vpc-123' }
      });

      const subnetIds = manager.getPrivateSubnetIds();
      expect(subnetIds).toEqual(['subnet-priv-1', 'subnet-priv-2']);
    });

    test('should return CloudFormation Refs when subnets not loaded', () => {
      const subnetIds = vpcManager.getPrivateSubnetIds();
      expect(subnetIds).toHaveLength(3);
      expect(subnetIds[0]).toEqual({ Ref: 'PrivateSubnet0' });
      expect(subnetIds[1]).toEqual({ Ref: 'PrivateSubnet1' });
      expect(subnetIds[2]).toEqual({ Ref: 'PrivateSubnet2' });
    });
  });

  describe('CIDR validation', () => {
    test('should accept 10.0.0.0/8 range', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        { VpcId: 'vpc-123', CidrBlock: '10.50.0.0/16' }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-1' },
        { SubnetId: 'subnet-2' },
        { SubnetId: 'subnet-3' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-1',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }],
          Associations: [{ Main: true }]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init({ reuseVpc: { vpcId: 'vpc-123' } });

      expect(manager.getVpcCidr()).toBe('10.50.0.0/16');
    });

    test('should accept 172.16.0.0/12 range', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        { VpcId: 'vpc-123', CidrBlock: '172.20.0.0/16' }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-1' },
        { SubnetId: 'subnet-2' },
        { SubnetId: 'subnet-3' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-1',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }],
          Associations: [{ Main: true }]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init({ reuseVpc: { vpcId: 'vpc-123' } });

      expect(manager.getVpcCidr()).toBe('172.20.0.0/16');
    });

    test('should accept 192.168.0.0/16 range', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        { VpcId: 'vpc-123', CidrBlock: '192.168.0.0/16' }
      ]);

      mockDescribeSubnets.mockResolvedValueOnce([
        { SubnetId: 'subnet-1' },
        { SubnetId: 'subnet-2' },
        { SubnetId: 'subnet-3' }
      ]);

      mockDescribeRouteTables.mockResolvedValueOnce([
        {
          RouteTableId: 'rtb-1',
          Routes: [{ DestinationCidrBlock: '0.0.0.0/0', GatewayId: 'igw-123' }],
          Associations: [{ Main: true }]
        }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();
      await manager.init({ reuseVpc: { vpcId: 'vpc-123' } });

      expect(manager.getVpcCidr()).toBe('192.168.0.0/16');
    });

    test('should reject public IP ranges', async () => {
      mockDescribeVpcs.mockResolvedValueOnce([
        { VpcId: 'vpc-123', CidrBlock: '1.2.3.0/24' }
      ]);

      const { VpcManager } = await import('./index');
      const manager = new VpcManager();

      await expect(
        manager.init({ reuseVpc: { vpcId: 'vpc-123' } })
      ).rejects.toThrow();
    });
  });
});
