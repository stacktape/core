import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: {
    awsCredentialsFilePath: mock(() => '/home/user/.aws/credentials'),
    awsConfigFilePath: mock(() => '/home/user/.aws/config')
  }
}));

mock.module('@shared/utils/fs-utils', () => ({
  getIniFileContent: mock(async () => ({}))
}));

mock.module('@shared/utils/user-prompt', () => ({
  userPrompt: mock(async ({ name }) => {
    if (name === 'profile') return { profile: 'test-profile' };
    if (name === 'awsAccessKeyId') return { awsAccessKeyId: 'AKIAIOSFODNN7EXAMPLE' };
    if (name === 'awsSecretAccessKey') return { awsSecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' };
    return {};
  })
}));

mock.module('@utils/aws-config', () => ({
  upsertAwsProfile: mock(async () => {})
}));

mock.module('@utils/errors', () => ({
  ExpectedError: class ExpectedError extends Error {
    constructor(public type: string, message: string) {
      super(message);
      this.name = 'ExpectedError';
    }
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    success: mock(() => {})
  }
}));

describe('aws-profile-create command', () => {
  test('should create new AWS profile with prompted values', async () => {
    const { getIniFileContent } = await import('@shared/utils/fs-utils');
    const { upsertAwsProfile } = await import('@utils/aws-config');
    const { printer } = await import('@utils/printer');
    (getIniFileContent as any).mockImplementation(async () => ({}));

    const { commandAwsProfileCreate } = await import('./index');
    await commandAwsProfileCreate();

    expect(upsertAwsProfile).toHaveBeenCalledWith(
      'test-profile',
      'AKIAIOSFODNN7EXAMPLE',
      'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
    );
    expect(printer.success).toHaveBeenCalledWith(
      'Successfully saved credentials for profile test-profile.'
    );
  });

  test('should use "default" when profile name is empty', async () => {
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { getIniFileContent } = await import('@shared/utils/fs-utils');
    const { upsertAwsProfile } = await import('@utils/aws-config');
    (getIniFileContent as any).mockImplementation(async () => ({}));
    (userPrompt as any).mockImplementation(async ({ name }) => {
      if (name === 'profile') return { profile: '' };
      if (name === 'awsAccessKeyId') return { awsAccessKeyId: 'AKIAIOSFODNN7EXAMPLE' };
      if (name === 'awsSecretAccessKey') return { awsSecretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' };
      return {};
    });

    const { commandAwsProfileCreate } = await import('./index');
    await commandAwsProfileCreate();

    expect(upsertAwsProfile).toHaveBeenCalledWith(
      'default',
      'AKIAIOSFODNN7EXAMPLE',
      'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
    );
  });

  test('should throw error when profile already exists in credentials file', async () => {
    const { getIniFileContent } = await import('@shared/utils/fs-utils');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    (getIniFileContent as any).mockImplementation(async (path) => {
      if (path.includes('credentials')) {
        return { 'test-profile': { aws_access_key_id: 'existing' } };
      }
      return {};
    });
    (userPrompt as any).mockImplementation(async ({ name }) => {
      if (name === 'profile') return { profile: 'test-profile' };
      return {};
    });

    const { commandAwsProfileCreate } = await import('./index');

    await expect(commandAwsProfileCreate()).rejects.toThrow(
      'Credentials for profile test-profile are already set in credentials file'
    );
  });

  test('should throw error when profile already exists in config file', async () => {
    const { getIniFileContent } = await import('@shared/utils/fs-utils');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    (getIniFileContent as any).mockImplementation(async (path) => {
      if (path.includes('config')) {
        return { 'test-profile': { region: 'us-east-1' } };
      }
      return {};
    });
    (userPrompt as any).mockImplementation(async ({ name }) => {
      if (name === 'profile') return { profile: 'test-profile' };
      return {};
    });

    const { commandAwsProfileCreate } = await import('./index');

    await expect(commandAwsProfileCreate()).rejects.toThrow(
      'Credentials for profile test-profile are already set in config file'
    );
  });
});
