import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {
      bastionResource: 'myBastion'
    },
    region: 'us-east-1'
  }
}));

mock.module('@domain-services/deployed-stack-overview-manager', () => ({
  deployedStackOverviewManager: {
    resolveBastionInstanceInfo: mock((bastionResource) => ({
      bastionResourceStpName: bastionResource,
      bastionInstanceId: 'i-1234567890abcdef0'
    }))
  }
}));

mock.module('@utils/ssm-session', () => ({
  runBastionSsmShellSession: mock(async () => {})
}));

mock.module('../_utils/initialization', () => ({
  initializeStackServicesForWorkingWithDeployedStack: mock(async () => {})
}));

describe('bastion-session command', () => {
  test('should start bastion shell session', async () => {
    const { initializeStackServicesForWorkingWithDeployedStack } = await import('../_utils/initialization');
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    const { runBastionSsmShellSession } = await import('@utils/ssm-session');
    const { globalStateManager } = await import('@application-services/global-state-manager');

    const { commandBastionSession } = await import('./index');
    await commandBastionSession();

    expect(initializeStackServicesForWorkingWithDeployedStack).toHaveBeenCalledWith({
      commandModifiesStack: false,
      commandRequiresConfig: false
    });
    expect(deployedStackOverviewManager.resolveBastionInstanceInfo).toHaveBeenCalledWith('myBastion');
    expect(runBastionSsmShellSession).toHaveBeenCalledWith({
      instanceId: 'i-1234567890abcdef0',
      region: 'us-east-1'
    });
  });

  test('should use bastion resource from args', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    globalStateManager.args = { bastionResource: 'anotherBastion' };

    const { commandBastionSession } = await import('./index');
    await commandBastionSession();

    expect(deployedStackOverviewManager.resolveBastionInstanceInfo).toHaveBeenCalledWith('anotherBastion');
  });

  test('should pass region to SSM session', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { runBastionSsmShellSession } = await import('@utils/ssm-session');
    globalStateManager.region = 'eu-west-1';

    const { commandBastionSession } = await import('./index');
    await commandBastionSession();

    expect(runBastionSsmShellSession).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'eu-west-1'
      })
    );
  });
});
