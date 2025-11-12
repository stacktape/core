import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    region: 'us-east-1',
    workingDir: '/home/user/project'
  }
}));

mock.module('@shared/naming/console-links', () => ({
  consoleLinks: {
    secretUrl: mock((region: string, secretName: string) =>
      `https://console.aws.amazon.com/secretsmanager/secret?region=${region}&name=${secretName}`
    )
  }
}));

mock.module('@shared/utils/user-prompt', () => ({
  userPrompt: mock(async ({ name }) => {
    if (name === 'secretName') return { secretName: 'my-new-secret' };
    if (name === 'provideOption') return { provideOption: 'Interactively using CLI' };
    if (name === 'secretString') return { secretString: 'my-secret-value' };
    if (name === 'shouldUpdate') return { shouldUpdate: true };
    return {};
  })
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    listAllSecrets: mock(async () => []),
    createNewSecret: mock(async () => {}),
    updateExistingSecret: mock(async () => {})
  }
}));

mock.module('@utils/file-loaders', () => ({
  loadRawFileContent: mock(async () => ({
    username: 'admin',
    password: 'pass123'
  }))
}));

mock.module('@utils/printer', () => ({
  printer: {
    success: mock(() => {}),
    info: mock(() => {})
  }
}));

mock.module('../_utils/initialization', () => ({
  loadUserCredentials: mock(async () => {})
}));

describe('secret-create command', () => {
  test('should create new secret interactively', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { printer } = await import('@utils/printer');
    const { loadUserCredentials } = await import('../_utils/initialization');
    (awsSdkManager.listAllSecrets as any).mockImplementation(async () => []);

    const { commandSecretCreate } = await import('./index');
    await commandSecretCreate();

    expect(loadUserCredentials).toHaveBeenCalled();
    expect(awsSdkManager.createNewSecret).toHaveBeenCalledWith('my-new-secret', 'my-secret-value');
    expect(printer.success).toHaveBeenCalledWith(
      expect.stringContaining('created successfully')
    );
  });

  test('should create secret from file', async () => {
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { loadRawFileContent } = await import('@utils/file-loaders');
    const { globalStateManager } = await import('@application-services/global-state-manager');
    (userPrompt as any).mockImplementation(async ({ name }) => {
      if (name === 'secretName') return { secretName: 'file-secret' };
      if (name === 'provideOption') return { provideOption: 'From file' };
      if (name === 'filePath') return { filePath: '/path/to/secrets.json' };
      return {};
    });
    (awsSdkManager.listAllSecrets as any).mockImplementation(async () => []);

    const { commandSecretCreate } = await import('./index');
    await commandSecretCreate();

    expect(loadRawFileContent).toHaveBeenCalledWith({
      filePath: '/path/to/secrets.json',
      workingDir: globalStateManager.workingDir
    });
    expect(awsSdkManager.createNewSecret).toHaveBeenCalledWith(
      'file-secret',
      JSON.stringify({ username: 'admin', password: 'pass123' })
    );
  });

  test('should update existing secret when user confirms', async () => {
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { printer } = await import('@utils/printer');
    (awsSdkManager.listAllSecrets as any).mockImplementation(async () => [
      {
        Name: 'my-new-secret',
        ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-new-secret-abc123'
      }
    ]);
    (userPrompt as any).mockImplementation(async ({ name }) => {
      if (name === 'secretName') return { secretName: 'my-new-secret' };
      if (name === 'provideOption') return { provideOption: 'Interactively using CLI' };
      if (name === 'secretString') return { secretString: 'updated-value' };
      if (name === 'shouldUpdate') return { shouldUpdate: true };
      return {};
    });

    const { commandSecretCreate } = await import('./index');
    await commandSecretCreate();

    expect(awsSdkManager.updateExistingSecret).toHaveBeenCalledWith(
      'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-new-secret-abc123',
      'updated-value'
    );
    expect(printer.success).toHaveBeenCalledWith(
      expect.stringContaining('updated')
    );
  });

  test('should abort when user declines to update existing secret', async () => {
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { printer } = await import('@utils/printer');
    (awsSdkManager.listAllSecrets as any).mockImplementation(async () => [
      {
        Name: 'my-new-secret',
        ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-new-secret-abc123'
      }
    ]);
    (userPrompt as any).mockImplementation(async ({ name }) => {
      if (name === 'secretName') return { secretName: 'my-new-secret' };
      if (name === 'shouldUpdate') return { shouldUpdate: false };
      return {};
    });

    (awsSdkManager.updateExistingSecret as any).mock.calls = [];
    (awsSdkManager.createNewSecret as any).mock.calls = [];

    const { commandSecretCreate } = await import('./index');
    await commandSecretCreate();

    expect(awsSdkManager.updateExistingSecret).not.toHaveBeenCalled();
    expect(awsSdkManager.createNewSecret).not.toHaveBeenCalled();
    expect(printer.info).toHaveBeenCalledWith('Aborting secret update.');
  });

  test('should display console link after creating secret', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { printer } = await import('@utils/printer');
    const { consoleLinks } = await import('@shared/naming/console-links');
    (awsSdkManager.listAllSecrets as any).mockImplementation(async () => []);

    const { commandSecretCreate } = await import('./index');
    await commandSecretCreate();

    expect(consoleLinks.secretUrl).toHaveBeenCalledWith('us-east-1', 'my-new-secret');
    expect(printer.info).toHaveBeenCalledWith(
      expect.stringContaining('You can view your secret at')
    );
  });
});
