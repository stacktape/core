import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock dependencies
const mockECSClientSend = mock(async () => ({}));
const mockCodeDeployClientSend = mock(async () => ({}));
const mockAutoScalingClientSend = mock(async () => ({}));

const mockECSClient = {
  send: mockECSClientSend
};

const mockCodeDeployClient = {
  send: mockCodeDeployClientSend
};

const mockAutoScalingClient = {
  send: mockAutoScalingClientSend
};

mock.module('@aws-sdk/client-ecs', () => ({
  ECSClient: class {
    constructor() {
      return mockECSClient;
    }
  },
  DescribeServicesCommand: class {
    constructor(public input: any) {}
  },
  UpdateServiceCommand: class {
    constructor(public input: any) {}
  },
  PlacementConstraintType: {
    MEMBER_OF: 'memberOf'
  }
}));

mock.module('@aws-sdk/client-codedeploy', () => ({
  CodeDeployClient: class {
    constructor() {
      return mockCodeDeployClient;
    }
  },
  ListDeploymentsCommand: class {
    constructor(public input: any) {}
  },
  CreateDeploymentCommand: class {
    constructor(public input: any) {}
  },
  DeploymentStatus: {
    BAKING: 'Baking',
    CREATED: 'Created',
    IN_PROGRESS: 'InProgress',
    QUEUED: 'Queued',
    READY: 'Ready'
  }
}));

mock.module('@aws-sdk/client-auto-scaling', () => ({
  AutoScalingClient: class {
    constructor() {
      return mockAutoScalingClient;
    }
  },
  DescribeAutoScalingGroupsCommand: class {
    constructor(public input: any) {}
  },
  SetDesiredCapacityCommand: class {
    constructor(public input: any) {}
  }
}));

const mockDayjs = mock(() => ({
  format: mock((fmt: string) => '2024-01-01')
}));

mock.module('dayjs', () => ({
  default: mockDayjs
}));

describe('ecs-maintenance', () => {
  let handler: any;

  beforeEach(async () => {
    mock.restore();

    // Clear mocks
    mockECSClientSend.mockClear();
    mockCodeDeployClientSend.mockClear();
    mockAutoScalingClientSend.mockClear();
    mockDayjs.mockClear();

    // Set up default implementations
    mockDayjs.mockReturnValue({
      format: mock((fmt: string) => '2024-01-01')
    });

    mockECSClientSend.mockImplementation(async (command) => {
      if (command.constructor.name === 'DescribeServicesCommand') {
        return {
          services: [
            {
              taskDefinition: 'arn:aws:ecs:us-east-1:123:task-definition/my-task:1',
              loadBalancers: [
                {
                  containerName: 'my-container',
                  containerPort: 8080
                }
              ],
              platformVersion: 'LATEST',
              networkConfiguration: {
                awsvpcConfiguration: {
                  subnets: ['subnet-1', 'subnet-2'],
                  securityGroups: ['sg-1']
                }
              },
              capacityProviderStrategy: []
            }
          ]
        };
      }
      return {};
    });

    mockCodeDeployClientSend.mockImplementation(async (command) => {
      if (command.constructor.name === 'ListDeploymentsCommand') {
        return { deployments: [] };
      }
      return {};
    });

    mockAutoScalingClientSend.mockImplementation(async (command) => {
      if (command.constructor.name === 'DescribeAutoScalingGroupsCommand') {
        return {
          AutoScalingGroups: [
            {
              AutoScalingGroupName: 'my-asg',
              DesiredCapacity: 2,
              MaxSize: 10
            }
          ]
        };
      }
      return {};
    });

    const module = await import('./index');
    handler = module.default;
  });

  const createEvent = (overrides: any = {}): any => ({
    ecsServiceArn: 'arn:aws:ecs:us-east-1:123:service/my-cluster/my-service',
    asgName: 'my-asg',
    ...overrides
  });

  describe('placement constraint update', () => {
    test('should update placement constraints with current date', async () => {
      const event = createEvent();

      await handler(event);

      const updateServiceCalls = mockECSClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'UpdateServiceCommand'
      );
      const initialUpdate = updateServiceCalls[0][0];

      expect(initialUpdate.input.placementConstraints).toEqual([
        {
          type: 'memberOf',
          expression: 'registeredAt >= 2024-01-01'
        }
      ]);
    });

    test('should use correct service ARN and cluster name', async () => {
      const event = createEvent({
        ecsServiceArn: 'arn:aws:ecs:us-west-2:456:service/prod-cluster/web-service'
      });

      await handler(event);

      const updateServiceCalls = mockECSClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'UpdateServiceCommand'
      );
      const initialUpdate = updateServiceCalls[0][0];

      expect(initialUpdate.input.service).toBe('arn:aws:ecs:us-west-2:456:service/prod-cluster/web-service');
      expect(initialUpdate.input.cluster).toBe('prod-cluster');
    });

    test('should format date correctly', async () => {
      const mockFormat = mock((fmt: string) => {
        expect(fmt).toBe('YYYY-MM-DD');
        return '2024-12-31';
      });
      mockDayjs.mockReturnValue({ format: mockFormat });

      const event = createEvent();

      await handler(event);

      expect(mockFormat).toHaveBeenCalledWith('YYYY-MM-DD');
    });
  });

  describe('rolling deployment (no CodeDeploy)', () => {
    test('should trigger rolling deployment when no CodeDeploy configured', async () => {
      const event = createEvent();

      await handler(event);

      const updateServiceCalls = mockECSClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'UpdateServiceCommand'
      );

      // Should have 2 UpdateService calls: initial constraint update + rolling deployment
      expect(updateServiceCalls.length).toBe(2);

      const rollingDeployment = updateServiceCalls[1][0];
      expect(rollingDeployment.input.forceNewDeployment).toBe(true);
      expect(rollingDeployment.input.service).toBe('arn:aws:ecs:us-east-1:123:service/my-cluster/my-service');
      expect(rollingDeployment.input.cluster).toBe('my-cluster');
    });

    test('should not call CodeDeploy for rolling deployment', async () => {
      const event = createEvent();

      await handler(event);

      expect(mockCodeDeployClientSend).not.toHaveBeenCalled();
    });
  });

  describe('blue-green deployment (CodeDeploy)', () => {
    test('should trigger blue-green deployment when CodeDeploy configured', async () => {
      const event = createEvent({
        codeDeployApplicationName: 'my-app',
        codeDeployDeploymentGroupName: 'my-deployment-group'
      });

      await handler(event);

      const createDeploymentCalls = mockCodeDeployClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'CreateDeploymentCommand'
      );

      expect(createDeploymentCalls.length).toBe(1);

      const deployment = createDeploymentCalls[0][0];
      expect(deployment.input.applicationName).toBe('my-app');
      expect(deployment.input.deploymentGroupName).toBe('my-deployment-group');
      expect(deployment.input.deploymentConfigName).toBe('CodeDeployDefault.ECSAllAtOnce');
    });

    test('should check for ongoing deployments before starting new one', async () => {
      const event = createEvent({
        codeDeployApplicationName: 'my-app',
        codeDeployDeploymentGroupName: 'my-deployment-group'
      });

      await handler(event);

      const listDeploymentsCalls = mockCodeDeployClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'ListDeploymentsCommand'
      );

      expect(listDeploymentsCalls.length).toBe(1);

      const listCommand = listDeploymentsCalls[0][0];
      expect(listCommand.input.applicationName).toBe('my-app');
      expect(listCommand.input.deploymentGroupName).toBe('my-deployment-group');
      expect(listCommand.input.includeOnlyStatuses).toEqual([
        'Baking',
        'Created',
        'InProgress',
        'Queued',
        'Ready'
      ]);
    });

    test('should skip deployment if ongoing deployment exists', async () => {
      mockCodeDeployClientSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'ListDeploymentsCommand') {
          return { deployments: ['d-123456'] };
        }
        return {};
      });

      const event = createEvent({
        codeDeployApplicationName: 'my-app',
        codeDeployDeploymentGroupName: 'my-deployment-group'
      });

      await handler(event);

      const createDeploymentCalls = mockCodeDeployClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'CreateDeploymentCommand'
      );

      expect(createDeploymentCalls.length).toBe(0);
    });

    test('should skip ASG scaling if ongoing deployment exists', async () => {
      mockCodeDeployClientSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'ListDeploymentsCommand') {
          return { deployments: ['d-123456'] };
        }
        return {};
      });

      const event = createEvent({
        codeDeployApplicationName: 'my-app',
        codeDeployDeploymentGroupName: 'my-deployment-group'
      });

      await handler(event);

      expect(mockAutoScalingClientSend).not.toHaveBeenCalled();
    });

    test('should enable auto-rollback', async () => {
      const event = createEvent({
        codeDeployApplicationName: 'my-app',
        codeDeployDeploymentGroupName: 'my-deployment-group'
      });

      await handler(event);

      const createDeploymentCalls = mockCodeDeployClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'CreateDeploymentCommand'
      );

      const deployment = createDeploymentCalls[0][0];
      expect(deployment.input.autoRollbackConfiguration).toEqual({
        enabled: true,
        events: ['DEPLOYMENT_FAILURE', 'DEPLOYMENT_STOP_ON_ALARM', 'DEPLOYMENT_STOP_ON_REQUEST']
      });
    });

    test('should use correct AppSpec content structure', async () => {
      const event = createEvent({
        codeDeployApplicationName: 'my-app',
        codeDeployDeploymentGroupName: 'my-deployment-group'
      });

      await handler(event);

      const createDeploymentCalls = mockCodeDeployClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'CreateDeploymentCommand'
      );

      const deployment = createDeploymentCalls[0][0];
      expect(deployment.input.revision.revisionType).toBe('AppSpecContent');

      const appSpecContent = JSON.parse(deployment.input.revision.appSpecContent.content);
      expect(appSpecContent.Resources).toHaveLength(1);
      expect(appSpecContent.Resources[0].TargetService.Type).toBe('AWS::ECS::Service');
    });

    test('should include service info in AppSpec', async () => {
      const event = createEvent({
        codeDeployApplicationName: 'my-app',
        codeDeployDeploymentGroupName: 'my-deployment-group'
      });

      await handler(event);

      const createDeploymentCalls = mockCodeDeployClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'CreateDeploymentCommand'
      );

      const deployment = createDeploymentCalls[0][0];
      const appSpecContent = JSON.parse(deployment.input.revision.appSpecContent.content);
      const serviceProps = appSpecContent.Resources[0].TargetService.Properties;

      expect(serviceProps.TaskDefinition).toBe('arn:aws:ecs:us-east-1:123:task-definition/my-task:1');
      expect(serviceProps.LoadBalancerInfo.ContainerName).toBe('my-container');
      expect(serviceProps.LoadBalancerInfo.ContainerPort).toBe(8080);
      expect(serviceProps.PlatformVersion).toBe('LATEST');
    });
  });

  describe('ASG capacity scaling', () => {
    test('should double ASG desired capacity', async () => {
      mockAutoScalingClientSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'DescribeAutoScalingGroupsCommand') {
          return {
            AutoScalingGroups: [
              {
                AutoScalingGroupName: 'my-asg',
                DesiredCapacity: 3,
                MaxSize: 10
              }
            ]
          };
        }
        return {};
      });

      const event = createEvent();

      await handler(event);

      const setCapacityCalls = mockAutoScalingClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'SetDesiredCapacityCommand'
      );

      expect(setCapacityCalls.length).toBe(1);
      expect(setCapacityCalls[0][0].input.DesiredCapacity).toBe(6);
    });

    test('should not exceed ASG max size', async () => {
      mockAutoScalingClientSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'DescribeAutoScalingGroupsCommand') {
          return {
            AutoScalingGroups: [
              {
                AutoScalingGroupName: 'my-asg',
                DesiredCapacity: 8,
                MaxSize: 10
              }
            ]
          };
        }
        return {};
      });

      const event = createEvent();

      await handler(event);

      const setCapacityCalls = mockAutoScalingClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'SetDesiredCapacityCommand'
      );

      expect(setCapacityCalls[0][0].input.DesiredCapacity).toBe(10);
    });

    test('should use correct ASG name', async () => {
      const event = createEvent({
        asgName: 'production-asg'
      });

      await handler(event);

      const describeCalls = mockAutoScalingClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'DescribeAutoScalingGroupsCommand'
      );

      expect(describeCalls[0][0].input.AutoScalingGroupNames).toEqual(['production-asg']);
    });

    test('should handle ASG at min capacity', async () => {
      mockAutoScalingClientSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'DescribeAutoScalingGroupsCommand') {
          return {
            AutoScalingGroups: [
              {
                AutoScalingGroupName: 'my-asg',
                DesiredCapacity: 1,
                MaxSize: 10
              }
            ]
          };
        }
        return {};
      });

      const event = createEvent();

      await handler(event);

      const setCapacityCalls = mockAutoScalingClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'SetDesiredCapacityCommand'
      );

      expect(setCapacityCalls[0][0].input.DesiredCapacity).toBe(2);
    });

    test('should handle ASG at max capacity', async () => {
      mockAutoScalingClientSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'DescribeAutoScalingGroupsCommand') {
          return {
            AutoScalingGroups: [
              {
                AutoScalingGroupName: 'my-asg',
                DesiredCapacity: 10,
                MaxSize: 10
              }
            ]
          };
        }
        return {};
      });

      const event = createEvent();

      await handler(event);

      const setCapacityCalls = mockAutoScalingClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'SetDesiredCapacityCommand'
      );

      expect(setCapacityCalls[0][0].input.DesiredCapacity).toBe(10);
    });
  });

  describe('ECS service info retrieval', () => {
    test('should describe ECS service', async () => {
      const event = createEvent();

      await handler(event);

      const describeCalls = mockECSClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'DescribeServicesCommand'
      );

      expect(describeCalls.length).toBe(1);
      expect(describeCalls[0][0].input.services).toEqual([
        'arn:aws:ecs:us-east-1:123:service/my-cluster/my-service'
      ]);
      expect(describeCalls[0][0].input.cluster).toBe('my-cluster');
    });

    test('should use service info for deployment', async () => {
      mockECSClientSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'DescribeServicesCommand') {
          return {
            services: [
              {
                taskDefinition: 'arn:aws:ecs:us-east-1:123:task-definition/custom-task:5',
                loadBalancers: [
                  {
                    containerName: 'custom-container',
                    containerPort: 3000
                  }
                ],
                platformVersion: '1.4.0',
                networkConfiguration: {
                  awsvpcConfiguration: {
                    subnets: ['subnet-a', 'subnet-b', 'subnet-c'],
                    securityGroups: ['sg-custom']
                  }
                },
                capacityProviderStrategy: [
                  { capacityProvider: 'FARGATE', weight: 1 }
                ]
              }
            ]
          };
        }
        return {};
      });

      const event = createEvent({
        codeDeployApplicationName: 'my-app',
        codeDeployDeploymentGroupName: 'my-deployment-group'
      });

      await handler(event);

      const createDeploymentCalls = mockCodeDeployClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'CreateDeploymentCommand'
      );

      const appSpecContent = JSON.parse(createDeploymentCalls[0][0].input.revision.appSpecContent.content);
      const serviceProps = appSpecContent.Resources[0].TargetService.Properties;

      expect(serviceProps.TaskDefinition).toBe('arn:aws:ecs:us-east-1:123:task-definition/custom-task:5');
      expect(serviceProps.LoadBalancerInfo.ContainerPort).toBe(3000);
    });
  });

  describe('error handling', () => {
    test('should propagate ECS UpdateService errors', async () => {
      mockECSClientSend.mockRejectedValueOnce(new Error('Service not found'));

      const event = createEvent();

      await expect(handler(event)).rejects.toThrow('Service not found');
    });

    test('should propagate ECS DescribeServices errors', async () => {
      mockECSClientSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'DescribeServicesCommand') {
          throw new Error('Access denied');
        }
        return {};
      });

      const event = createEvent();

      await expect(handler(event)).rejects.toThrow('Access denied');
    });

    test('should propagate CodeDeploy ListDeployments errors', async () => {
      mockCodeDeployClientSend.mockRejectedValueOnce(new Error('Application not found'));

      const event = createEvent({
        codeDeployApplicationName: 'my-app',
        codeDeployDeploymentGroupName: 'my-deployment-group'
      });

      await expect(handler(event)).rejects.toThrow('Application not found');
    });

    test('should propagate CodeDeploy CreateDeployment errors', async () => {
      mockCodeDeployClientSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'CreateDeploymentCommand') {
          throw new Error('Deployment limit exceeded');
        }
        return { deployments: [] };
      });

      const event = createEvent({
        codeDeployApplicationName: 'my-app',
        codeDeployDeploymentGroupName: 'my-deployment-group'
      });

      await expect(handler(event)).rejects.toThrow('Deployment limit exceeded');
    });

    test('should propagate ASG errors', async () => {
      mockAutoScalingClientSend.mockRejectedValueOnce(new Error('ASG not found'));

      const event = createEvent();

      await expect(handler(event)).rejects.toThrow('ASG not found');
    });
  });

  describe('edge cases', () => {
    test('should handle service ARN with different regions', async () => {
      const event = createEvent({
        ecsServiceArn: 'arn:aws:ecs:eu-west-1:789:service/eu-cluster/eu-service'
      });

      await handler(event);

      const describeCalls = mockECSClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'DescribeServicesCommand'
      );

      expect(describeCalls[0][0].input.cluster).toBe('eu-cluster');
    });

    test('should handle multiple ongoing deployments', async () => {
      mockCodeDeployClientSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'ListDeploymentsCommand') {
          return { deployments: ['d-111', 'd-222', 'd-333'] };
        }
        return {};
      });

      const event = createEvent({
        codeDeployApplicationName: 'my-app',
        codeDeployDeploymentGroupName: 'my-deployment-group'
      });

      await handler(event);

      const createDeploymentCalls = mockCodeDeployClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'CreateDeploymentCommand'
      );

      expect(createDeploymentCalls.length).toBe(0);
    });

    test('should handle ASG with zero desired capacity', async () => {
      mockAutoScalingClientSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'DescribeAutoScalingGroupsCommand') {
          return {
            AutoScalingGroups: [
              {
                AutoScalingGroupName: 'my-asg',
                DesiredCapacity: 0,
                MaxSize: 10
              }
            ]
          };
        }
        return {};
      });

      const event = createEvent();

      await handler(event);

      const setCapacityCalls = mockAutoScalingClientSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'SetDesiredCapacityCommand'
      );

      expect(setCapacityCalls[0][0].input.DesiredCapacity).toBe(0);
    });

    test('should handle service with no load balancers', async () => {
      mockECSClientSend.mockImplementation(async (command) => {
        if (command.constructor.name === 'DescribeServicesCommand') {
          return {
            services: [
              {
                taskDefinition: 'arn:aws:ecs:us-east-1:123:task-definition/my-task:1',
                loadBalancers: [],
                platformVersion: 'LATEST',
                networkConfiguration: {},
                capacityProviderStrategy: []
              }
            ]
          };
        }
        return {};
      });

      const event = createEvent({
        codeDeployApplicationName: 'my-app',
        codeDeployDeploymentGroupName: 'my-deployment-group'
      });

      // This would fail when trying to access loadBalancers[0]
      await expect(handler(event)).rejects.toThrow();
    });
  });
});
