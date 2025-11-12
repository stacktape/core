import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {
      scriptName: 'test-script'
    }
  }
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: {
    scripts: {
      'test-script': {
        type: 'local-script',
        properties: {
          executeCommand: 'echo "Hello World"'
        }
      },
      'bastion-script': {
        type: 'bastion-script',
        properties: {
          executeCommand: 'echo "On Bastion"',
          bastionResource: 'myBastion'
        }
      }
    }
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e20: mock(({ scriptName }) => new Error(`Script "${scriptName}" not found in config`))
  }
}));

mock.module('../_utils/initialization', () => ({
  initializeStackServicesForLocalResolve: mock(async () => {})
}));

mock.module('./utils', () => ({
  getExecutableScriptFunction: mock(({ scriptDefinition }) => {
    return async () => {
      // Simulate script execution
      return { success: true };
    };
  })
}));

describe('script-run command', () => {
  test('should run script from config', async () => {
    const { initializeStackServicesForLocalResolve } = await import('../_utils/initialization');
    const { getExecutableScriptFunction } = await import('./utils');

    const { commandScriptRun } = await import('./index');
    await commandScriptRun();

    expect(initializeStackServicesForLocalResolve).toHaveBeenCalled();
    expect(getExecutableScriptFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptDefinition: expect.objectContaining({
          scriptName: 'test-script',
          type: 'local-script'
        })
      })
    );
  });

  test('should throw error when script not found', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = { scriptName: 'non-existent-script' };

    const { commandScriptRun } = await import('./index');

    await expect(commandScriptRun()).rejects.toThrow('Script "non-existent-script" not found');
  });

  test('should use assumeRoleOfResource from args if provided', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { getExecutableScriptFunction } = await import('./utils');
    globalStateManager.args = {
      scriptName: 'test-script',
      assumeRoleOfResource: 'myLambda'
    };

    const { commandScriptRun } = await import('./index');
    await commandScriptRun();

    expect(getExecutableScriptFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptDefinition: expect.objectContaining({
          properties: expect.objectContaining({
            assumeRoleOfResource: 'myLambda'
          })
        })
      })
    );
  });

  test('should use assumeRoleOfResource from script definition if not in args', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { configManager } = await import('@domain-services/config-manager');
    const { getExecutableScriptFunction } = await import('./utils');
    globalStateManager.args = { scriptName: 'test-script' };
    configManager.scripts = {
      'test-script': {
        type: 'local-script',
        properties: {
          executeCommand: 'echo test',
          assumeRoleOfResource: 'myApiRole'
        }
      }
    };

    const { commandScriptRun } = await import('./index');
    await commandScriptRun();

    expect(getExecutableScriptFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        scriptDefinition: expect.objectContaining({
          properties: expect.objectContaining({
            assumeRoleOfResource: 'myApiRole'
          })
        })
      })
    );
  });

  test('should execute the function returned by getExecutableScriptFunction', async () => {
    const mockExecuteFn = mock(async () => {});
    const { getExecutableScriptFunction } = await import('./utils');
    (getExecutableScriptFunction as any).mockImplementation(() => mockExecuteFn);

    const { commandScriptRun } = await import('./index');
    await commandScriptRun();

    expect(mockExecuteFn).toHaveBeenCalledWith({});
  });
});
