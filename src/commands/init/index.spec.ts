import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {}
  }
}));

mock.module('prompts', () => ({
  default: mock(async () => ({
    selectedInitType: 'starter-project'
  }))
}));

mock.module('./using-existing-config', () => ({
  initUsingExistingConfig: mock(async () => {})
}));

mock.module('./using-starter-project', () => ({
  initUsingStarterProject: mock(async () => {})
}));

describe('init command', () => {
  test('should use existing config when templateId is provided', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { initUsingExistingConfig } = await import('./using-existing-config');
    globalStateManager.args = { templateId: 'template-123' };

    const { commandInit } = await import('./index');
    await commandInit();

    expect(initUsingExistingConfig).toHaveBeenCalled();
  });

  test('should use starter project when starterId is provided', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { initUsingStarterProject } = await import('./using-starter-project');
    globalStateManager.args = { starterId: 'starter-123' };

    const { commandInit } = await import('./index');
    await commandInit();

    expect(initUsingStarterProject).toHaveBeenCalled();
  });

  test('should prompt user when no args provided', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const prompts = (await import('prompts')).default;
    globalStateManager.args = {};

    const { commandInit } = await import('./index');
    await commandInit();

    expect(prompts).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'select',
        name: 'selectedInitType',
        message: expect.stringContaining('How do you want to initialize')
      })
    );
  });

  test('should init using starter project when selected', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const prompts = (await import('prompts')).default;
    const { initUsingStarterProject } = await import('./using-starter-project');
    globalStateManager.args = {};
    (prompts as any).mockImplementation(async () => ({
      selectedInitType: 'starter-project'
    }));

    const { commandInit } = await import('./index');
    await commandInit();

    expect(initUsingStarterProject).toHaveBeenCalled();
  });

  test('should not init when create-config is selected', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const prompts = (await import('prompts')).default;
    const { initUsingStarterProject } = await import('./using-starter-project');
    const { initUsingExistingConfig } = await import('./using-existing-config');
    globalStateManager.args = {};
    (prompts as any).mockImplementation(async () => ({
      selectedInitType: 'create-config'
    }));

    (initUsingStarterProject as any).mock.calls = [];
    (initUsingExistingConfig as any).mock.calls = [];

    const { commandInit } = await import('./index');
    await commandInit();

    expect(initUsingStarterProject).not.toHaveBeenCalled();
    expect(initUsingExistingConfig).not.toHaveBeenCalled();
  });

  test('should provide correct prompt choices', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const prompts = (await import('prompts')).default;
    globalStateManager.args = {};

    const { commandInit } = await import('./index');
    await commandInit();

    expect(prompts).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: expect.arrayContaining([
          expect.objectContaining({
            value: 'create-config',
            title: expect.stringContaining('Interactive Config Editor')
          }),
          expect.objectContaining({
            value: 'starter-project',
            title: expect.stringContaining('Use a starter')
          })
        ])
      })
    );
  });
});
