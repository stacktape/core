import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/application-manager', () => ({
  applicationManager: {
    registerCleanUpHook: mock(() => {})
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {
      bastionResource: 'myBastion',
      resourceName: 'myDatabase',
      localTunnelingPort: 5432
    }
  }
}));

mock.module('@domain-services/deployed-stack-overview-manager', () => ({
  deployedStackOverviewManager: {
    getStpResource: mock(({ nameChain }) => ({
      resourceType: 'relational-database',
      referencableParams: {}
    })),
    resolveBastionTunnelsForTarget: mock(() => [
      {
        label: 'connectionString',
        additionalStringToSubstitute: 'postgres://host:5432/db',
        remoteHost: 'db.internal',
        remotePort: 5432
      }
    ])
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e98: mock(({ stpResourceName }) => new Error(`Resource "${stpResourceName}" not found`)),
    e99: mock(({ stpResourceName, stpResourceType }) =>
      new Error(`Bastion tunneling not possible for resource "${stpResourceName}" of type "${stpResourceType}"`)
    )
  }
}));

mock.module('@shared/utils/misc', () => ({
  wait: mock(async () => {
    // Prevent infinite loop in tests
    throw new Error('Test completed - infinite loop prevented');
  })
}));

mock.module('@utils/printer', () => ({
  printer: {
    info: mock(() => {}),
    prettyResourceName: mock((name: string) => name),
    colorize: mock((color: string, text: string) => text)
  }
}));

mock.module('@utils/ssm-session', () => ({
  startPortForwardingSessions: mock(async () => [
    {
      localPort: 15432,
      kill: mock(async () => {})
    }
  ])
}));

mock.module('../_utils/initialization', () => ({
  initializeStackServicesForWorkingWithDeployedStack: mock(async () => {})
}));

describe('bastion-tunnel command', () => {
  test('should start port forwarding tunnels', async () => {
    const { initializeStackServicesForWorkingWithDeployedStack } = await import('../_utils/initialization');
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    const { startPortForwardingSessions } = await import('@utils/ssm-session');
    const { applicationManager } = await import('@application-services/application-manager');

    const { commandBastionTunnel } = await import('./index');

    try {
      await commandBastionTunnel();
    } catch (err) {
      // Expected error from wait mock to break infinite loop
    }

    expect(initializeStackServicesForWorkingWithDeployedStack).toHaveBeenCalledWith({
      commandModifiesStack: false,
      commandRequiresConfig: false
    });
    expect(deployedStackOverviewManager.getStpResource).toHaveBeenCalledWith({ nameChain: 'myDatabase' });
    expect(deployedStackOverviewManager.resolveBastionTunnelsForTarget).toHaveBeenCalledWith({
      targetStpName: 'myDatabase',
      bastionStpName: 'myBastion'
    });
    expect(startPortForwardingSessions).toHaveBeenCalled();
    expect(applicationManager.registerCleanUpHook).toHaveBeenCalled();
  });

  test('should throw error when resource not found', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => null);

    const { commandBastionTunnel } = await import('./index');

    await expect(commandBastionTunnel()).rejects.toThrow('Resource "myDatabase" not found');
  });

  test('should throw error for unsupported resource type', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => ({
      resourceType: 'lambda-function'
    }));

    const { commandBastionTunnel } = await import('./index');

    await expect(commandBastionTunnel()).rejects.toThrow('Bastion tunneling not possible');
  });

  test('should support relational-database resource', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => ({
      resourceType: 'relational-database'
    }));

    const { commandBastionTunnel } = await import('./index');

    try {
      await commandBastionTunnel();
    } catch (err) {
      // Expected error from wait mock
    }

    expect(deployedStackOverviewManager.resolveBastionTunnelsForTarget).toHaveBeenCalled();
  });

  test('should support redis-cluster resource', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => ({
      resourceType: 'redis-cluster'
    }));

    const { commandBastionTunnel } = await import('./index');

    try {
      await commandBastionTunnel();
    } catch (err) {
      // Expected error
    }

    expect(deployedStackOverviewManager.resolveBastionTunnelsForTarget).toHaveBeenCalled();
  });

  test('should support application-load-balancer resource', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => ({
      resourceType: 'application-load-balancer'
    }));

    const { commandBastionTunnel } = await import('./index');

    try {
      await commandBastionTunnel();
    } catch (err) {
      // Expected error
    }

    expect(deployedStackOverviewManager.resolveBastionTunnelsForTarget).toHaveBeenCalled();
  });

  test('should register cleanup hook to close tunnels', async () => {
    const { applicationManager } = await import('@application-services/application-manager');

    const { commandBastionTunnel } = await import('./index');

    try {
      await commandBastionTunnel();
    } catch (err) {
      // Expected error
    }

    expect(applicationManager.registerCleanUpHook).toHaveBeenCalled();
  });

  test('should pass localTunnelingPort to port forwarding', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { startPortForwardingSessions } = await import('@utils/ssm-session');
    globalStateManager.args = {
      bastionResource: 'myBastion',
      resourceName: 'myDatabase',
      localTunnelingPort: 3306
    };

    const { commandBastionTunnel } = await import('./index');

    try {
      await commandBastionTunnel();
    } catch (err) {
      // Expected error
    }

    expect(startPortForwardingSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        startAtPort: 3306
      })
    );
  });

  test('should throw error for private-service without load balancer', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => ({
      resourceType: 'private-service',
      _nestedResources: {}
    }));

    const { commandBastionTunnel } = await import('./index');

    await expect(commandBastionTunnel()).rejects.toThrow('Bastion tunneling not possible');
  });

  test('should allow private-service with load balancer', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => ({
      resourceType: 'private-service',
      _nestedResources: {
        loadBalancer: {}
      }
    }));

    const { commandBastionTunnel } = await import('./index');

    try {
      await commandBastionTunnel();
    } catch (err) {
      // Expected error
    }

    expect(deployedStackOverviewManager.resolveBastionTunnelsForTarget).toHaveBeenCalled();
  });
});
