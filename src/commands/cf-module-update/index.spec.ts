import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@domain-services/cloudformation-registry-manager', () => ({
  cloudformationRegistryManager: {
    init: mock(async () => {}),
    loadPrivateTypesAndPackages: mock(async () => {}),
    registerNewestAvailablePrivateTypes: mock(async () => {})
  }
}));

mock.module('@shared/utils/user-prompt', () => ({
  userPrompt: mock(async () => ({
    moduleType: 'atlasMongo'
  }))
}));

mock.module('../_utils/initialization', () => ({
  loadUserCredentials: mock(async () => {})
}));

describe('cf-module-update command', () => {
  test('should update CloudFormation module', async () => {
    const { cloudformationRegistryManager } = await import('@domain-services/cloudformation-registry-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { loadUserCredentials } = await import('../_utils/initialization');

    const { commandCfModuleUpdate } = await import('./index');
    await commandCfModuleUpdate();

    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'select',
        name: 'moduleType',
        message: expect.stringContaining('Choose a module')
      })
    );
    expect(loadUserCredentials).toHaveBeenCalled();
    expect(cloudformationRegistryManager.init).toHaveBeenCalled();
    expect(cloudformationRegistryManager.loadPrivateTypesAndPackages).toHaveBeenCalledWith(['atlasMongo']);
    expect(cloudformationRegistryManager.registerNewestAvailablePrivateTypes).toHaveBeenCalledWith({
      infrastructureModuleType: 'atlasMongo'
    });
  });

  test('should support all allowed module types', async () => {
    const { userPrompt } = await import('@shared/utils/user-prompt');

    const { commandCfModuleUpdate } = await import('./index');
    await commandCfModuleUpdate();

    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: expect.arrayContaining([
          expect.objectContaining({ value: 'atlasMongo' }),
          expect.objectContaining({ value: 'upstashRedis' }),
          expect.objectContaining({ value: 'ecsBlueGreen' })
        ])
      })
    );
  });

  test('should update upstashRedis module', async () => {
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { cloudformationRegistryManager } = await import('@domain-services/cloudformation-registry-manager');
    (userPrompt as any).mockImplementation(async () => ({
      moduleType: 'upstashRedis'
    }));

    const { commandCfModuleUpdate } = await import('./index');
    await commandCfModuleUpdate();

    expect(cloudformationRegistryManager.loadPrivateTypesAndPackages).toHaveBeenCalledWith(['upstashRedis']);
    expect(cloudformationRegistryManager.registerNewestAvailablePrivateTypes).toHaveBeenCalledWith({
      infrastructureModuleType: 'upstashRedis'
    });
  });

  test('should update ecsBlueGreen module', async () => {
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { cloudformationRegistryManager } = await import('@domain-services/cloudformation-registry-manager');
    (userPrompt as any).mockImplementation(async () => ({
      moduleType: 'ecsBlueGreen'
    }));

    const { commandCfModuleUpdate } = await import('./index');
    await commandCfModuleUpdate();

    expect(cloudformationRegistryManager.loadPrivateTypesAndPackages).toHaveBeenCalledWith(['ecsBlueGreen']);
    expect(cloudformationRegistryManager.registerNewestAvailablePrivateTypes).toHaveBeenCalledWith({
      infrastructureModuleType: 'ecsBlueGreen'
    });
  });

  test('should initialize services in parallel', async () => {
    const { cloudformationRegistryManager } = await import('@domain-services/cloudformation-registry-manager');

    const { commandCfModuleUpdate } = await import('./index');
    await commandCfModuleUpdate();

    expect(cloudformationRegistryManager.init).toHaveBeenCalled();
  });
});
