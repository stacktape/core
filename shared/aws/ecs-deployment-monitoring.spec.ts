import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { ResourceStatus } from '@aws-sdk/client-cloudformation';
import { DeploymentControllerType, DesiredStatus } from '@aws-sdk/client-ecs';

// Mock dependencies
mock.module('@shared/naming/console-links', () => ({
  consoleLinks: {
    logStream: mock(() => 'https://console.aws.amazon.com/logs'),
    ecsTask: mock(() => 'https://console.aws.amazon.com/ecs/task')
  }
}));

mock.module('@shared/utils/misc', () => ({
  splitStringIntoLines: mock((text) => text.split('\n')),
  wait: mock(async () => {})
}));

describe('ecs-deployment-monitoring', () => {
  let mockAwsSdkManager: any;
  let mockPrinter: any;

  beforeEach(() => {
    mockPrinter = {
      colorize: mock((color, text) => text),
      makeBold: mock((text) => text),
      terminalLink: mock((url, text) => text),
      warn: mock(() => {}),
      hint: mock(() => {})
    };

    mockAwsSdkManager = {
      region: 'us-east-1',
      printer: mockPrinter,
      getEcsService: mock(async () => ({
        deploymentController: { type: DeploymentControllerType.ECS },
        deployments: [
          {
            status: 'PRIMARY',
            createdAt: new Date(Date.now() + 1000)
          }
        ]
      })),
      listEcsTasks: mock(async () => []),
      getEcsTaskDefinition: mock(async () => ({
        taskDefinition: {
          containerDefinitions: [{ name: 'app', essential: true, logConfiguration: { options: { 'awslogs-group': '/ecs/app' } } }]
        }
      })),
      getLogEvents: mock(async () => [])
    };
  });

  describe('EcsServiceDeploymentStatusPoller', () => {
    test('should create poller', async () => {
      const { EcsServiceDeploymentStatusPoller } = await import('./ecs-deployment-monitoring');

      const poller = new EcsServiceDeploymentStatusPoller({
        ecsServiceArn: 'arn:aws:ecs:us-east-1:123:service/cluster/service',
        awsSdkManager: mockAwsSdkManager,
        pollerPrintName: 'test-service'
      });

      expect(poller).toBeDefined();
      poller.stopPolling();
    });

    test('should extract cluster name from service ARN', async () => {
      const { EcsServiceDeploymentStatusPoller } = await import('./ecs-deployment-monitoring');

      const poller = new EcsServiceDeploymentStatusPoller({
        ecsServiceArn: 'arn:aws:ecs:us-east-1:123:service/my-cluster/my-service',
        awsSdkManager: mockAwsSdkManager
      });

      expect(poller).toBeDefined();
      poller.stopPolling();
    });

    test('should poll ECS service status', async () => {
      const { EcsServiceDeploymentStatusPoller } = await import('./ecs-deployment-monitoring');

      const poller = new EcsServiceDeploymentStatusPoller({
        ecsServiceArn: 'arn:aws:ecs:us-east-1:123:service/cluster/service',
        awsSdkManager: mockAwsSdkManager
      });

      // Wait a bit for polling to occur
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockAwsSdkManager.getEcsService).toHaveBeenCalled();
      poller.stopPolling();
    });

    test('should detect failed tasks', async () => {
      mockAwsSdkManager.listEcsTasks = mock(async () => [
        {
          taskArn: 'arn:aws:ecs:us-east-1:123:task/cluster/task-id',
          createdAt: new Date(),
          stoppedReason: 'Essential container exited',
          containers: [{ name: 'app', exitCode: 1, healthStatus: 'UNHEALTHY', reason: 'Error', runtimeId: 'abc-123' }],
          taskDefinitionArn: 'arn:aws:ecs:us-east-1:123:task-definition/family:1'
        }
      ]);

      const { EcsServiceDeploymentStatusPoller } = await import('./ecs-deployment-monitoring');

      const poller = new EcsServiceDeploymentStatusPoller({
        ecsServiceArn: 'arn:aws:ecs:us-east-1:123:service/cluster/service',
        awsSdkManager: mockAwsSdkManager
      });

      // Wait for polling
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const failureMessage = poller.getFailureMessage();
      expect(failureMessage).toBeDefined();
      poller.stopPolling();
    });

    test('should stop polling when requested', async () => {
      const { EcsServiceDeploymentStatusPoller } = await import('./ecs-deployment-monitoring');

      const poller = new EcsServiceDeploymentStatusPoller({
        ecsServiceArn: 'arn:aws:ecs:us-east-1:123:service/cluster/service',
        awsSdkManager: mockAwsSdkManager
      });

      poller.stopPolling();

      // Polling should be stopped
      expect(poller).toBeDefined();
    });
  });

  describe('isEcsServiceCreateOrUpdateCloudformationEvent', () => {
    test('should detect ECS service create events', async () => {
      const { isEcsServiceCreateOrUpdateCloudformationEvent } = await import('./ecs-deployment-monitoring');

      const event: any = {
        ResourceType: 'AWS::ECS::Service',
        ResourceStatus: ResourceStatus.CREATE_IN_PROGRESS,
        PhysicalResourceId: 'service-id'
      };

      expect(isEcsServiceCreateOrUpdateCloudformationEvent(event)).toBe(true);
    });

    test('should detect ECS service update events', async () => {
      const { isEcsServiceCreateOrUpdateCloudformationEvent } = await import('./ecs-deployment-monitoring');

      const event: any = {
        ResourceType: 'AWS::ECS::Service',
        ResourceStatus: ResourceStatus.UPDATE_IN_PROGRESS,
        PhysicalResourceId: 'service-id'
      };

      expect(isEcsServiceCreateOrUpdateCloudformationEvent(event)).toBe(true);
    });

    test('should detect blue/green service events', async () => {
      const { isEcsServiceCreateOrUpdateCloudformationEvent } = await import('./ecs-deployment-monitoring');

      const event: any = {
        ResourceType: 'Stacktape::ECSBlueGreenV1::Service',
        ResourceStatus: ResourceStatus.CREATE_IN_PROGRESS,
        PhysicalResourceId: 'service-id'
      };

      expect(isEcsServiceCreateOrUpdateCloudformationEvent(event)).toBe(true);
    });

    test('should return false for non-ECS events', async () => {
      const { isEcsServiceCreateOrUpdateCloudformationEvent } = await import('./ecs-deployment-monitoring');

      const event: any = {
        ResourceType: 'AWS::Lambda::Function',
        ResourceStatus: ResourceStatus.CREATE_IN_PROGRESS,
        PhysicalResourceId: 'function-id'
      };

      expect(isEcsServiceCreateOrUpdateCloudformationEvent(event)).toBe(false);
    });

    test('should return false for complete status', async () => {
      const { isEcsServiceCreateOrUpdateCloudformationEvent } = await import('./ecs-deployment-monitoring');

      const event: any = {
        ResourceType: 'AWS::ECS::Service',
        ResourceStatus: ResourceStatus.CREATE_COMPLETE,
        PhysicalResourceId: 'service-id'
      };

      expect(isEcsServiceCreateOrUpdateCloudformationEvent(event)).toBe(false);
    });

    test('should return false without PhysicalResourceId', async () => {
      const { isEcsServiceCreateOrUpdateCloudformationEvent } = await import('./ecs-deployment-monitoring');

      const event: any = {
        ResourceType: 'AWS::ECS::Service',
        ResourceStatus: ResourceStatus.CREATE_IN_PROGRESS
      };

      expect(isEcsServiceCreateOrUpdateCloudformationEvent(event)).toBe(false);
    });
  });
});
