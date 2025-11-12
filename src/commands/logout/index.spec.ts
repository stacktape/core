import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    saveApiKey: mock(async () => {})
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    success: mock(() => {})
  }
}));

describe('logout command', () => {
  test('should remove API key and show success message', async () => {
    const { commandLogout } = await import('./index');
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { printer } = await import('@utils/printer');

    await commandLogout();

    expect(globalStateManager.saveApiKey).toHaveBeenCalledWith({ apiKey: null });
    expect(printer.success).toHaveBeenCalledWith('Successfully logged out and removed API Key.');
  });
});
