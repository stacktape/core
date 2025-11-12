import { describe, expect, mock, test, spyOn, beforeEach } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/misc', () => ({
  isJson: mock((str: string) => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  })
}));

mock.module('@shared/utils/user-prompt', () => ({
  userPrompt: mock(async () => ({
    secretName: 'my-secret'
  }))
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    getSecretValue: mock(async () => ({
      Name: 'my-secret',
      SecretString: 'my-secret-value',
      CreatedDate: new Date('2024-01-01'),
      ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123'
    }))
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

describe('secret-get command', () => {
  let consoleDirSpy: any;

  beforeEach(() => {
    consoleDirSpy = spyOn(console, 'dir').mockImplementation(() => {});
  });

  test('should retrieve and display secret with string value', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { printer } = await import('@utils/printer');
    const { loadUserCredentials } = await import('../_utils/initialization');

    const { commandSecretGet } = await import('./index');
    await commandSecretGet();

    expect(loadUserCredentials).toHaveBeenCalled();
    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'text',
        name: 'secretName',
        message: 'Secret name:'
      })
    );
    expect(awsSdkManager.getSecretValue).toHaveBeenCalledWith({ secretId: 'my-secret' });
    expect(printer.info).toHaveBeenCalledWith('Secret details:');
    expect(consoleDirSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'my-secret',
        value: 'my-secret-value',
        arn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123'
      }),
      { depth: 5 }
    );
  });

  test('should parse JSON secret values', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    (awsSdkManager.getSecretValue as any).mockImplementation(async () => ({
      Name: 'json-secret',
      SecretString: '{"username":"admin","password":"pass123"}',
      CreatedDate: new Date('2024-01-01'),
      ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:json-secret-abc123'
    }));

    const { commandSecretGet } = await import('./index');
    await commandSecretGet();

    expect(consoleDirSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'json-secret',
        value: {
          username: 'admin',
          password: 'pass123'
        }
      }),
      { depth: 5 }
    );
  });

  test('should format created date as locale string', async () => {
    const createdDate = new Date('2024-06-15T10:30:00Z');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    (awsSdkManager.getSecretValue as any).mockImplementation(async () => ({
      Name: 'my-secret',
      SecretString: 'value',
      CreatedDate: createdDate,
      ARN: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret-abc123'
    }));

    const { commandSecretGet } = await import('./index');
    await commandSecretGet();

    expect(consoleDirSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        created: createdDate.toLocaleString()
      }),
      { depth: 5 }
    );
  });

  test('should prompt for secret name when not provided', async () => {
    const { userPrompt } = await import('@shared/utils/user-prompt');
    (userPrompt as any).mockImplementation(async () => ({
      secretName: 'prompted-secret-name'
    }));

    const { awsSdkManager } = await import('@utils/aws-sdk-manager');

    const { commandSecretGet } = await import('./index');
    await commandSecretGet();

    expect(awsSdkManager.getSecretValue).toHaveBeenCalledWith({ secretId: 'prompted-secret-name' });
  });
});
