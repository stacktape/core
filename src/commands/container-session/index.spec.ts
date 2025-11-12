import { describe, expect, mock, test } from 'bun:test';
import { DesiredStatus } from '@aws-sdk/client-ecs';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {
      resourceName: 'myWebService',
      container: 'web',
      command: '/bin/bash'
    },
    region: 'us-east-1'
  }
}));

mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: {
    existingStackResources: [
      {
        LogicalResourceId: 'MyWebServiceEcsService',
        ecsServiceTaskDefinition: {
          containerDefinitions: [
            { name: 'web' },
            { name: 'nginx' }
          ]
        },
        ecsService: {
          clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/my-cluster'
        }
      }
    ]
  }
}));

mock.module('@domain-services/deployed-stack-overview-manager', () => ({
  deployedStackOverviewManager: {
    deployedWorkloadsWithEcsTaskDefinition: [
      {
        nameChain: ['myWebService'],
        resource: {
          cloudformationChildResources: {
            MyWebServiceEcsService: {
              cloudformationResourceType: 'AWS::ECS::Service'
            }
          }
        }
      }
    ]
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e119: mock(({ containerResourceName }) =>
      new Error(`Container workload "${containerResourceName}" not found`)
    ),
    e120: mock(({ containerResourceName, availableContainers }) =>
      new Error(`Container not specified or invalid. Available: ${availableContainers.join(', ')}`)
    )
  }
}));

mock.module('@shared/utils/user-prompt', () => ({
  userPrompt: mock(async () => ({
    taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123'
  }))
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    listEcsTasks: mock(async () => [
      {
        taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123',
        startedAt: '2024-01-01T10:00:00Z'
      }
    ])
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    debug: mock(() => {})
  }
}));

mock.module('@utils/ssm-session', () => ({
  runEcsExecSsmShellSession: mock(async () => {})
}));

mock.module('../_utils/initialization', () => ({
  initializeStackServicesForWorkingWithDeployedStack: mock(async () => {})
}));

describe('container-session command', () => {
  test('should start container session', async () => {
    const { initializeStackServicesForWorkingWithDeployedStack } = await import('../_utils/initialization');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { runEcsExecSsmShellSession } = await import('@utils/ssm-session');

    const { commandContainerSession } = await import('./index');
    await commandContainerSession();

    expect(initializeStackServicesForWorkingWithDeployedStack).toHaveBeenCalledWith({
      commandModifiesStack: false,
      commandRequiresConfig: false
    });
    expect(awsSdkManager.listEcsTasks).toHaveBeenCalledWith({
      ecsClusterName: 'arn:aws:ecs:us-east-1:123456789012:cluster/my-cluster',
      desiredStatus: DesiredStatus.RUNNING
    });
    expect(runEcsExecSsmShellSession).toHaveBeenCalledWith({
      task: expect.objectContaining({
        taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/abc123'
      }),
      containerName: 'web',
      region: 'us-east-1',
      command: '/bin/bash'
    });
  });

  test('should throw error when workload not found', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    deployedStackOverviewManager.deployedWorkloadsWithEcsTaskDefinition = [];

    const { commandContainerSession } = await import('./index');

    await expect(commandContainerSession()).rejects.toThrow('Container workload');
  });

  test('should throw error when container not specified for multi-container workload', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = {
      resourceName: 'myWebService',
      container: undefined
    };

    const { commandContainerSession } = await import('./index');

    await expect(commandContainerSession()).rejects.toThrow('Container not specified');
  });

  test('should use first container when only one exists', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    const { runEcsExecSsmShellSession } = await import('@utils/ssm-session');
    globalStateManager.args = { resourceName: 'myWebService', container: undefined };
    stackManager.existingStackResources = [
      {
        LogicalResourceId: 'MyWebServiceEcsService',
        ecsServiceTaskDefinition: {
          containerDefinitions: [{ name: 'single-container' }]
        },
        ecsService: {
          clusterArn: 'arn:aws:ecs:us-east-1:123456789012:cluster/my-cluster'
        }
      }
    ];

    const { commandContainerSession } = await import('./index');
    await commandContainerSession();

    expect(runEcsExecSsmShellSession).toHaveBeenCalledWith(
      expect.objectContaining({
        containerName: 'single-container'
      })
    );
  });

  test('should prompt user when multiple tasks are running', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    (awsSdkManager.listEcsTasks as any).mockImplementation(async () => [
      {
        taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/task1',
        startedAt: '2024-01-01T10:00:00Z'
      },
      {
        taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/task2',
        startedAt: '2024-01-01T11:00:00Z'
      }
    ]);

    const { commandContainerSession } = await import('./index');
    await commandContainerSession();

    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'select',
        name: 'taskArn',
        message: expect.stringContaining('multiple instances')
      })
    );
  });

  test('should support Stacktape ECS BlueGreen service type', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    const { runEcsExecSsmShellSession } = await import('@utils/ssm-session');
    deployedStackOverviewManager.deployedWorkloadsWithEcsTaskDefinition = [
      {
        nameChain: ['myWebService'],
        resource: {
          cloudformationChildResources: {
            MyWebServiceEcsService: {
              cloudformationResourceType: 'Stacktape::ECSBlueGreenV1::Service'
            }
          }
        }
      }
    ];

    const { commandContainerSession } = await import('./index');
    await commandContainerSession();

    expect(runEcsExecSsmShellSession).toHaveBeenCalled();
  });

  test('should throw error when invalid container specified', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = {
      resourceName: 'myWebService',
      container: 'invalid-container'
    };

    const { commandContainerSession } = await import('./index');

    await expect(commandContainerSession()).rejects.toThrow('Container not specified');
  });

  test('should use task when only one is running', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { runEcsExecSsmShellSession } = await import('@utils/ssm-session');
    (awsSdkManager.listEcsTasks as any).mockImplementation(async () => [
      {
        taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/single-task',
        startedAt: '2024-01-01T10:00:00Z'
      }
    ]);

    (userPrompt as any).mock.calls = [];

    const { commandContainerSession } = await import('./index');
    await commandContainerSession();

    expect(userPrompt).not.toHaveBeenCalled();
    expect(runEcsExecSsmShellSession).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({
          taskArn: 'arn:aws:ecs:us-east-1:123456789012:task/my-cluster/single-task'
        })
      })
    );
  });
});
