import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    targetStack: {
      stackName: 'test-project-dev'
    },
    loadTargetStackInfo: mock(async () => {})
  }
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: {
    init: mock(async () => {})
  }
}));

mock.module('@domain-services/packaging-manager', () => ({
  packagingManager: {
    init: mock(async () => {}),
    packageAllWorkloads: mock(async () => [
      {
        workloadName: 'myLambda',
        packagePath: '/tmp/lambda.zip',
        size: 1024
      },
      {
        workloadName: 'myContainer',
        packagePath: '/tmp/container.tar',
        size: 2048
      }
    ])
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    info: mock(() => {})
  }
}));

mock.module('../_utils/initialization', () => ({
  loadUserCredentials: mock(async () => {})
}));

describe('package-workloads command', () => {
  test('should package all workloads', async () => {
    const { loadUserCredentials } = await import('../_utils/initialization');
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { configManager } = await import('@domain-services/config-manager');
    const { packagingManager } = await import('@domain-services/packaging-manager');
    const { printer } = await import('@utils/printer');

    const { commandPackageWorkloads } = await import('./index');
    const result = await commandPackageWorkloads();

    expect(loadUserCredentials).toHaveBeenCalled();
    expect(globalStateManager.loadTargetStackInfo).toHaveBeenCalled();
    expect(configManager.init).toHaveBeenCalledWith({ configRequired: true });
    expect(packagingManager.init).toHaveBeenCalled();
    expect(packagingManager.packageAllWorkloads).toHaveBeenCalledWith({ commandCanUseCache: false });
    expect(printer.info).toHaveBeenCalledWith(
      expect.stringContaining('Successfully packaged compute resources')
    );
    expect(result).toHaveLength(2);
    expect(result[0].workloadName).toBe('myLambda');
  });

  test('should package workloads without cache', async () => {
    const { packagingManager } = await import('@domain-services/packaging-manager');

    const { commandPackageWorkloads } = await import('./index');
    await commandPackageWorkloads();

    expect(packagingManager.packageAllWorkloads).toHaveBeenCalledWith({ commandCanUseCache: false });
  });

  test('should initialize config with configRequired flag', async () => {
    const { configManager } = await import('@domain-services/config-manager');

    const { commandPackageWorkloads } = await import('./index');
    await commandPackageWorkloads();

    expect(configManager.init).toHaveBeenCalledWith({ configRequired: true });
  });

  test('should return packaged workloads', async () => {
    const { commandPackageWorkloads } = await import('./index');
    const result = await commandPackageWorkloads();

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workloadName: 'myLambda',
          packagePath: '/tmp/lambda.zip'
        }),
        expect.objectContaining({
          workloadName: 'myContainer',
          packagePath: '/tmp/container.tar'
        })
      ])
    );
  });

  test('should display success message with stack name', async () => {
    const { printer } = await import('@utils/printer');
    const { globalStateManager } = await import('@application-services/global-state-manager');

    const { commandPackageWorkloads } = await import('./index');
    await commandPackageWorkloads();

    expect(printer.info).toHaveBeenCalledWith(
      expect.stringContaining(globalStateManager.targetStack.stackName)
    );
  });

  test('should load target stack info before initializing config', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { configManager } = await import('@domain-services/config-manager');

    const { commandPackageWorkloads } = await import('./index');
    await commandPackageWorkloads();

    expect(globalStateManager.loadTargetStackInfo).toHaveBeenCalled();
    expect(configManager.init).toHaveBeenCalled();
  });
});
