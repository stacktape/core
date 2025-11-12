import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    persistedState: {
      cliArgsDefaults: {},
      otherDefaults: {}
    },
    saveDefaults: mock(async () => {}),
    reloadPersistedState: mock(async () => {})
  }
}));

mock.module('@config', () => ({
  configurableGlobalDefaultCliArgs: {
    region: {
      description: 'Default AWS region',
      default: null,
      isSensitive: false
    },
    stage: {
      description: 'Default stage name',
      default: null,
      isSensitive: false
    }
  },
  configurableGlobalDefaultOtherProps: {
    awsProfile: {
      description: 'Default AWS profile',
      default: null,
      isSensitive: false
    },
    apiKey: {
      description: 'Stacktape API key',
      default: null,
      isSensitive: true
    }
  }
}));

mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: {
    persistedStateFilePath: mock(() => '/home/user/.stacktape/state.json')
  }
}));

mock.module('@shared/utils/user-prompt', () => ({
  userPrompt: mock(async ({ name, initial }) => {
    if (name === 'region') return { region: 'us-east-1' };
    if (name === 'stage') return { stage: 'production' };
    if (name === 'awsProfile') return { awsProfile: 'my-profile' };
    if (name === 'apiKey') return { apiKey: 'test-api-key-value' };
    return { [name]: initial || '' };
  })
}));

mock.module('@utils/printer', () => ({
  printer: {
    success: mock(() => {})
  }
}));

describe('defaults-configure command', () => {
  test('should configure CLI args defaults', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { printer } = await import('@utils/printer');

    const { commandDefaultsConfigure } = await import('./index');
    await commandDefaultsConfigure();

    expect(globalStateManager.saveDefaults).toHaveBeenCalledWith(
      expect.objectContaining({
        cliArgsDefaults: expect.objectContaining({
          region: 'us-east-1',
          stage: 'production'
        })
      })
    );
    expect(globalStateManager.reloadPersistedState).toHaveBeenCalled();
    expect(printer.success).toHaveBeenCalledWith(
      expect.stringContaining('Defaults successfully saved')
    );
  });

  test('should configure other defaults including sensitive values', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');

    const { commandDefaultsConfigure } = await import('./index');
    await commandDefaultsConfigure();

    expect(globalStateManager.saveDefaults).toHaveBeenCalledWith(
      expect.objectContaining({
        otherDefaults: expect.objectContaining({
          awsProfile: 'my-profile',
          apiKey: 'test-api-key-value'
        })
      })
    );
  });

  test('should preserve existing defaults when input is empty', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    globalStateManager.persistedState = {
      cliArgsDefaults: {
        region: 'eu-west-1'
      },
      otherDefaults: {}
    };
    (userPrompt as any).mockImplementation(async ({ name }) => {
      if (name === 'region') return { region: '' };
      if (name === 'stage') return { stage: 'dev' };
      if (name === 'awsProfile') return { awsProfile: '' };
      if (name === 'apiKey') return { apiKey: '' };
      return { [name]: '' };
    });

    const { commandDefaultsConfigure } = await import('./index');
    await commandDefaultsConfigure();

    const saveCall = (globalStateManager.saveDefaults as any).mock.calls[0][0];
    expect(saveCall.cliArgsDefaults.stage).toBe('dev');
    expect(saveCall.cliArgsDefaults.region).toBeUndefined();
  });

  test('should unset defaults when whitespace is provided', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    globalStateManager.persistedState = {
      cliArgsDefaults: {
        region: 'us-east-1'
      },
      otherDefaults: {}
    };
    (userPrompt as any).mockImplementation(async ({ name }) => {
      if (name === 'region') return { region: ' ' };
      if (name === 'stage') return { stage: '' };
      if (name === 'awsProfile') return { awsProfile: '' };
      if (name === 'apiKey') return { apiKey: '' };
      return { [name]: '' };
    });

    const { commandDefaultsConfigure } = await import('./index');
    await commandDefaultsConfigure();

    const saveCall = (globalStateManager.saveDefaults as any).mock.calls[0][0];
    expect(saveCall.cliArgsDefaults.region).toBe(null);
  });

  test('should prompt with masked value for sensitive fields', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    globalStateManager.persistedState = {
      cliArgsDefaults: {},
      otherDefaults: {
        apiKey: 'very-long-api-key-value-12345'
      }
    };

    const { commandDefaultsConfigure } = await import('./index');
    await commandDefaultsConfigure();

    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'password',
        name: 'apiKey',
        message: expect.stringContaining('***************************2345')
      })
    );
  });

  test('should show current value in prompt message', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    globalStateManager.persistedState = {
      cliArgsDefaults: {
        region: 'us-west-2'
      },
      otherDefaults: {}
    };

    const { commandDefaultsConfigure } = await import('./index');
    await commandDefaultsConfigure();

    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'region',
        message: expect.stringContaining('us-west-2')
      })
    );
  });
});
