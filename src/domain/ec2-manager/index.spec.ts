import { describe, expect, test, beforeEach, mock } from 'bun:test';

const mockGetEc2InstanceTypesInfo = mock(() => []);
const mockGetOpenSearchInstanceTypeLimits = mock(() => ({}));
const mockStartEvent = mock(async () => {});
const mockFinishEvent = mock(async () => {});

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    getEc2InstanceTypesInfo: mockGetEc2InstanceTypesInfo,
    getOpenSearchInstanceTypeLimits: mockGetOpenSearchInstanceTypeLimits
  }
}));

mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mockStartEvent,
    finishEvent: mockFinishEvent
  }
}));

describe('EC2Manager', () => {
  let ec2Manager: any;

  beforeEach(async () => {
    mock.restore();
    mockGetEc2InstanceTypesInfo.mockClear();
    mockGetOpenSearchInstanceTypeLimits.mockClear();
    mockStartEvent.mockClear();
    mockFinishEvent.mockClear();

    const module = await import('./index');
    ec2Manager = module.ec2Manager;
    await ec2Manager.init({ instanceTypes: [], openSearchInstanceTypes: [] });
  });

  describe('initialization', () => {
    test('should initialize successfully with empty arrays', async () => {
      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({ instanceTypes: [], openSearchInstanceTypes: [] });
      expect(manager.ec2InstanceTypes).toEqual([]);
      expect(manager.openSearchInstanceTypes).toEqual({});
    });

    test('should fetch EC2 instance types when provided', async () => {
      mockGetEc2InstanceTypesInfo.mockResolvedValueOnce([
        {
          InstanceType: 't3.small',
          MemoryInfo: { SizeInMiB: 2048 },
          ProcessorInfo: { SupportedArchitectures: ['x86_64'] }
        },
        {
          InstanceType: 't3.medium',
          MemoryInfo: { SizeInMiB: 4096 },
          ProcessorInfo: { SupportedArchitectures: ['x86_64'] }
        }
      ]);

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: ['t3.small', 't3.medium'],
        openSearchInstanceTypes: []
      });

      expect(mockStartEvent).toHaveBeenCalledWith({
        eventType: 'FETCH_EC2_INFO',
        description: 'Fetching EC2 info'
      });
      expect(mockGetEc2InstanceTypesInfo).toHaveBeenCalledWith({
        instanceTypes: ['t3.small', 't3.medium']
      });
      expect(manager.ec2InstanceTypes).toHaveLength(2);
      expect(mockFinishEvent).toHaveBeenCalledWith({
        eventType: 'FETCH_EC2_INFO'
      });
    });

    test('should fetch OpenSearch instance type limits when provided', async () => {
      mockGetOpenSearchInstanceTypeLimits.mockResolvedValueOnce({
        LimitsByRole: {
          data: {
            StorageTypes: [
              { StorageTypeName: 'ebs', StorageSubTypeName: 'gp3' }
            ]
          }
        }
      });

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: [],
        openSearchInstanceTypes: [
          { version: 'OpenSearch_2.5', instanceType: 't3.small.search' }
        ]
      });

      expect(mockGetOpenSearchInstanceTypeLimits).toHaveBeenCalledWith({
        openSearchVersion: 'OpenSearch_2.5',
        instanceType: 't3.small.search'
      });
      expect(manager.openSearchInstanceTypes['OpenSearch_2.5']['t3.small.search']).toBeDefined();
    });

    test('should fetch both EC2 and OpenSearch info in parallel', async () => {
      mockGetEc2InstanceTypesInfo.mockResolvedValueOnce([
        { InstanceType: 't3.small', MemoryInfo: { SizeInMiB: 2048 } }
      ]);
      mockGetOpenSearchInstanceTypeLimits.mockResolvedValueOnce({
        LimitsByRole: { data: { StorageTypes: [] } }
      });

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: ['t3.small'],
        openSearchInstanceTypes: [
          { version: 'OpenSearch_2.5', instanceType: 't3.small.search' }
        ]
      });

      expect(mockGetEc2InstanceTypesInfo).toHaveBeenCalled();
      expect(mockGetOpenSearchInstanceTypeLimits).toHaveBeenCalled();
      expect(manager.ec2InstanceTypes).toHaveLength(1);
      expect(manager.openSearchInstanceTypes['OpenSearch_2.5']).toBeDefined();
    });

    test('should skip fetching when no instance types provided', async () => {
      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: [],
        openSearchInstanceTypes: []
      });

      expect(mockStartEvent).not.toHaveBeenCalled();
      expect(mockGetEc2InstanceTypesInfo).not.toHaveBeenCalled();
      expect(mockGetOpenSearchInstanceTypeLimits).not.toHaveBeenCalled();
    });
  });

  describe('getInstanceWithLowestMemory', () => {
    test('should return instance with lowest memory', async () => {
      mockGetEc2InstanceTypesInfo.mockResolvedValueOnce([
        { InstanceType: 't3.small', MemoryInfo: { SizeInMiB: 2048 } },
        { InstanceType: 't3.medium', MemoryInfo: { SizeInMiB: 4096 } },
        { InstanceType: 't3.micro', MemoryInfo: { SizeInMiB: 1024 } }
      ]);

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: ['t3.small', 't3.medium', 't3.micro'],
        openSearchInstanceTypes: []
      });

      const lowestMemInstance = manager.getInstanceWithLowestMemory({
        instanceTypes: ['t3.small', 't3.medium', 't3.micro']
      });

      expect(lowestMemInstance.InstanceType).toBe('t3.micro');
      expect(lowestMemInstance.MemoryInfo.SizeInMiB).toBe(1024);
    });

    test('should filter by provided instance types', async () => {
      mockGetEc2InstanceTypesInfo.mockResolvedValueOnce([
        { InstanceType: 't3.small', MemoryInfo: { SizeInMiB: 2048 } },
        { InstanceType: 't3.medium', MemoryInfo: { SizeInMiB: 4096 } },
        { InstanceType: 't3.large', MemoryInfo: { SizeInMiB: 8192 } }
      ]);

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: ['t3.small', 't3.medium', 't3.large'],
        openSearchInstanceTypes: []
      });

      const lowestMemInstance = manager.getInstanceWithLowestMemory({
        instanceTypes: ['t3.medium', 't3.large']
      });

      expect(lowestMemInstance.InstanceType).toBe('t3.medium');
    });

    test('should handle single instance type', async () => {
      mockGetEc2InstanceTypesInfo.mockResolvedValueOnce([
        { InstanceType: 't3.small', MemoryInfo: { SizeInMiB: 2048 } }
      ]);

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: ['t3.small'],
        openSearchInstanceTypes: []
      });

      const lowestMemInstance = manager.getInstanceWithLowestMemory({
        instanceTypes: ['t3.small']
      });

      expect(lowestMemInstance.InstanceType).toBe('t3.small');
    });
  });

  describe('checkOpenSearchEbsSupport', () => {
    test('should return true for gp3 and ebs support', async () => {
      mockGetOpenSearchInstanceTypeLimits.mockResolvedValueOnce({
        LimitsByRole: {
          data: {
            StorageTypes: [
              { StorageTypeName: 'ebs', StorageSubTypeName: 'gp3' }
            ]
          }
        }
      });

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: [],
        openSearchInstanceTypes: [
          { version: 'OpenSearch_2.5', instanceType: 't3.small.search' }
        ]
      });

      const support = manager.checkOpenSearchEbsSupport({
        instanceTypesUsed: ['t3.small.search'],
        version: 'OpenSearch_2.5'
      });

      expect(support.gp3Supported).toBe(true);
      expect(support.ebsSupported).toBe(true);
    });

    test('should return false for gp3 when not supported', async () => {
      mockGetOpenSearchInstanceTypeLimits.mockResolvedValueOnce({
        LimitsByRole: {
          data: {
            StorageTypes: [
              { StorageTypeName: 'ebs', StorageSubTypeName: 'gp2' }
            ]
          }
        }
      });

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: [],
        openSearchInstanceTypes: [
          { version: 'OpenSearch_2.5', instanceType: 't3.small.search' }
        ]
      });

      const support = manager.checkOpenSearchEbsSupport({
        instanceTypesUsed: ['t3.small.search'],
        version: 'OpenSearch_2.5'
      });

      expect(support.gp3Supported).toBe(false);
      expect(support.ebsSupported).toBe(true);
    });

    test('should check all instance types for support', async () => {
      mockGetOpenSearchInstanceTypeLimits
        .mockResolvedValueOnce({
          LimitsByRole: {
            data: {
              StorageTypes: [
                { StorageTypeName: 'ebs', StorageSubTypeName: 'gp3' }
              ]
            }
          }
        })
        .mockResolvedValueOnce({
          LimitsByRole: {
            data: {
              StorageTypes: [
                { StorageTypeName: 'ebs', StorageSubTypeName: 'gp3' }
              ]
            }
          }
        });

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: [],
        openSearchInstanceTypes: [
          { version: 'OpenSearch_2.5', instanceType: 't3.small.search' },
          { version: 'OpenSearch_2.5', instanceType: 't3.medium.search' }
        ]
      });

      const support = manager.checkOpenSearchEbsSupport({
        instanceTypesUsed: ['t3.small.search', 't3.medium.search'],
        version: 'OpenSearch_2.5'
      });

      expect(support.gp3Supported).toBe(true);
      expect(support.ebsSupported).toBe(true);
    });

    test('should return false for gp3 if any instance does not support it', async () => {
      mockGetOpenSearchInstanceTypeLimits
        .mockResolvedValueOnce({
          LimitsByRole: {
            data: {
              StorageTypes: [
                { StorageTypeName: 'ebs', StorageSubTypeName: 'gp3' }
              ]
            }
          }
        })
        .mockResolvedValueOnce({
          LimitsByRole: {
            data: {
              StorageTypes: [
                { StorageTypeName: 'ebs', StorageSubTypeName: 'gp2' }
              ]
            }
          }
        });

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: [],
        openSearchInstanceTypes: [
          { version: 'OpenSearch_2.5', instanceType: 't3.small.search' },
          { version: 'OpenSearch_2.5', instanceType: 't3.medium.search' }
        ]
      });

      const support = manager.checkOpenSearchEbsSupport({
        instanceTypesUsed: ['t3.small.search', 't3.medium.search'],
        version: 'OpenSearch_2.5'
      });

      expect(support.gp3Supported).toBe(false);
      expect(support.ebsSupported).toBe(true);
    });

    test('should return false for gp3 when no instance types provided', async () => {
      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: [],
        openSearchInstanceTypes: []
      });

      const support = manager.checkOpenSearchEbsSupport({
        instanceTypesUsed: [],
        version: 'OpenSearch_2.5'
      });

      expect(support.gp3Supported).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle multiple OpenSearch versions', async () => {
      mockGetOpenSearchInstanceTypeLimits
        .mockResolvedValueOnce({
          LimitsByRole: { data: { StorageTypes: [] } }
        })
        .mockResolvedValueOnce({
          LimitsByRole: { data: { StorageTypes: [] } }
        });

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();
      await manager.init({
        instanceTypes: [],
        openSearchInstanceTypes: [
          { version: 'OpenSearch_2.5', instanceType: 't3.small.search' },
          { version: 'OpenSearch_2.7', instanceType: 't3.small.search' }
        ]
      });

      expect(manager.openSearchInstanceTypes['OpenSearch_2.5']).toBeDefined();
      expect(manager.openSearchInstanceTypes['OpenSearch_2.7']).toBeDefined();
    });

    test('should handle errors in EC2 API calls', async () => {
      mockGetEc2InstanceTypesInfo.mockRejectedValueOnce(new Error('API Error'));

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();

      await expect(
        manager.init({
          instanceTypes: ['t3.small'],
          openSearchInstanceTypes: []
        })
      ).rejects.toThrow('API Error');
    });

    test('should handle errors in OpenSearch API calls', async () => {
      mockGetOpenSearchInstanceTypeLimits.mockRejectedValueOnce(new Error('OpenSearch API Error'));

      const { EC2Manager } = await import('./index');
      const manager = new EC2Manager();

      await expect(
        manager.init({
          instanceTypes: [],
          openSearchInstanceTypes: [
            { version: 'OpenSearch_2.5', instanceType: 't3.small.search' }
          ]
        })
      ).rejects.toThrow('OpenSearch API Error');
    });
  });
});
