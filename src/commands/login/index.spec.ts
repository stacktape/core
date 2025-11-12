import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {},
    systemId: 'test-system-id'
  }
}));

mock.module('@application-services/stacktape-trpc-api-manager', () => ({
  stacktapeTrpcApiManager: {
    init: mock(async () => {}),
    apiClient: {
      currentUserAndOrgData: mock(async () => ({
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com'
        },
        organization: {
          name: 'Test Organization'
        }
      }))
    }
  }
}));

mock.module('@shared/utils/user-prompt', () => ({
  userPrompt: mock(async () => ({
    apiKey: 'prompted-api-key'
  }))
}));

mock.module('@utils/printer', () => ({
  printer: {
    success: mock(() => {}),
    getLink: mock((name: string, label: string) => label)
  }
}));

mock.module('../../../shared/utils/telemetry', () => ({
  identifyUserInMixpanel: mock(async () => {})
}));

describe('login command', () => {
  test('should login with provided API key', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { stacktapeTrpcApiManager } = await import('@application-services/stacktape-trpc-api-manager');
    const { identifyUserInMixpanel } = await import('../../../shared/utils/telemetry');
    globalStateManager.args = { apiKey: 'test-api-key' };
    globalStateManager.saveApiKey = mock(async () => {});

    const { commandLogin } = await import('./index');
    await commandLogin();

    expect(globalStateManager.saveApiKey).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    expect(stacktapeTrpcApiManager.init).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    expect(stacktapeTrpcApiManager.apiClient.currentUserAndOrgData).toHaveBeenCalled();
    expect(identifyUserInMixpanel).toHaveBeenCalledWith({
      userId: 'user-123',
      systemId: 'test-system-id'
    });
  });

  test('should prompt for API key when not provided', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { stacktapeTrpcApiManager } = await import('@application-services/stacktape-trpc-api-manager');
    globalStateManager.args = {};
    globalStateManager.saveApiKey = mock(async () => {});

    const { commandLogin } = await import('./index');
    await commandLogin();

    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'password',
        name: 'apiKey'
      })
    );
    expect(globalStateManager.saveApiKey).toHaveBeenCalledWith({ apiKey: 'prompted-api-key' });
  });

  test('should display success message with user info', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { printer } = await import('@utils/printer');
    globalStateManager.args = { apiKey: 'test-api-key' };
    globalStateManager.saveApiKey = mock(async () => {});

    const { commandLogin } = await import('./index');
    await commandLogin();

    expect(printer.success).toHaveBeenCalledWith(
      expect.stringContaining('Test User')
    );
    expect(printer.success).toHaveBeenCalledWith(
      expect.stringContaining('Test Organization')
    );
  });
});
