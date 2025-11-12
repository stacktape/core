import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/user-prompt', () => ({
  userPrompt: mock(async () => ({
    secretName: 'secret-to-delete'
  }))
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    deleteSecret: mock(async () => {})
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    success: mock(() => {})
  }
}));

mock.module('../_utils/initialization', () => ({
  loadUserCredentials: mock(async () => {})
}));

describe('secret-delete command', () => {
  test('should delete secret', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { printer } = await import('@utils/printer');
    const { loadUserCredentials } = await import('../_utils/initialization');

    const { commandSecretDelete } = await import('./index');
    await commandSecretDelete();

    expect(loadUserCredentials).toHaveBeenCalled();
    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'text',
        name: 'secretName',
        message: 'Secret name:'
      })
    );
    expect(awsSdkManager.deleteSecret).toHaveBeenCalledWith('secret-to-delete');
    expect(printer.success).toHaveBeenCalledWith(
      'Secret "secret-to-delete" deleted successfully.'
    );
  });

  test('should prompt for secret name', async () => {
    const { userPrompt } = await import('@shared/utils/user-prompt');
    (userPrompt as any).mockImplementation(async () => ({
      secretName: 'another-secret'
    }));

    const { awsSdkManager } = await import('@utils/aws-sdk-manager');

    const { commandSecretDelete } = await import('./index');
    await commandSecretDelete();

    expect(awsSdkManager.deleteSecret).toHaveBeenCalledWith('another-secret');
  });

  test('should return null', async () => {
    const { commandSecretDelete } = await import('./index');
    const result = await commandSecretDelete();

    expect(result).toBe(null);
  });
});
