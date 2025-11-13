import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {
      resourceName: 'myLambda'
    },
    targetStack: {
      stackName: 'test-project-dev'
    }
  }
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: {
    findResourceInConfig: mock(({ nameChain }) => ({
      resource: {
        name: nameChain,
        type: 'function'
      }
    }))
  }
}));

mock.module('@domain-services/deployed-stack-overview-manager', () => ({
  deployedStackOverviewManager: {
    getStpResource: mock(() => ({
      resourceType: 'function'
    }))
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e1: mock(({ resourceName }) => new Error(`Resource "${resourceName}" not found in config`)),
    e6: mock(({ resourceName, resourceType }) =>
      new Error(`Resource "${resourceName}" of type "${resourceType}" not found in deployed stack`)
    ),
    e52: mock(({ resourceName, resourceType }) =>
      new Error(`Dev mode not supported for resource "${resourceName}" of type "${resourceType}"`)
    )
  }
}));

mock.module('../_utils/initialization', () => ({
  initializeStackServicesForHotSwapDeploy: mock(async () => {})
}));

mock.module('./container', () => ({
  runDevContainer: mock(async () => {})
}));

mock.module('./lambda-function', () => ({
  runDevLambdaFunction: mock(async () => {})
}));

describe('dev command', () => {
  test('should run dev mode for lambda function', async () => {
    const { initializeStackServicesForHotSwapDeploy } = await import('../_utils/initialization');
    const { runDevLambdaFunction } = await import('./lambda-function');

    const { commandDev } = await import('./index');
    await commandDev();

    expect(initializeStackServicesForHotSwapDeploy).toHaveBeenCalled();
    expect(runDevLambdaFunction).toHaveBeenCalled();
  });

  test('should run dev mode for web-service', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    const { runDevContainer } = await import('./container');
    (configManager.findResourceInConfig as any).mockImplementation(() => ({
      resource: { type: 'web-service' }
    }));
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => ({
      resourceType: 'web-service'
    }));

    const { commandDev } = await import('./index');
    await commandDev();

    expect(runDevContainer).toHaveBeenCalled();
  });

  test('should run dev mode for private-service', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    const { runDevContainer } = await import('./container');
    (configManager.findResourceInConfig as any).mockImplementation(() => ({
      resource: { type: 'private-service' }
    }));
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => ({
      resourceType: 'private-service'
    }));

    const { commandDev } = await import('./index');
    await commandDev();

    expect(runDevContainer).toHaveBeenCalled();
  });

  test('should run dev mode for worker-service', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    const { runDevContainer } = await import('./container');
    (configManager.findResourceInConfig as any).mockImplementation(() => ({
      resource: { type: 'worker-service' }
    }));
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => ({
      resourceType: 'worker-service'
    }));

    const { commandDev } = await import('./index');
    await commandDev();

    expect(runDevContainer).toHaveBeenCalled();
  });

  test('should run dev mode for multi-container-workload', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    const { runDevContainer } = await import('./container');
    (configManager.findResourceInConfig as any).mockImplementation(() => ({
      resource: { type: 'multi-container-workload' }
    }));
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => ({
      resourceType: 'multi-container-workload'
    }));

    const { commandDev } = await import('./index');
    await commandDev();

    expect(runDevContainer).toHaveBeenCalled();
  });

  test('should throw error when resource not found in config', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    (configManager.findResourceInConfig as any).mockImplementation(() => ({
      resource: null
    }));

    const { commandDev } = await import('./index');

    await expect(commandDev()).rejects.toThrow('not found in config');
  });

  test('should throw error when resource not deployed', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => null);

    const { commandDev } = await import('./index');

    await expect(commandDev()).rejects.toThrow('not found in deployed stack');
  });

  test('should throw error when resource type mismatch', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (configManager.findResourceInConfig as any).mockImplementation(() => ({
      resource: { type: 'function' }
    }));
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => ({
      resourceType: 'web-service'
    }));

    const { commandDev } = await import('./index');

    await expect(commandDev()).rejects.toThrow('not found in deployed stack');
  });

  test('should throw error for unsupported resource type', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (configManager.findResourceInConfig as any).mockImplementation(() => ({
      resource: { type: 'bucket' }
    }));
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => ({
      resourceType: 'bucket'
    }));

    const { commandDev } = await import('./index');

    await expect(commandDev()).rejects.toThrow('Dev mode not supported');
  });
});
