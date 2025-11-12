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
  userPrompt: mock(async () => ({ profile: 'test-profile' }))
}));

mock.module('@utils/aws-config', () => ({
  deleteAwsProfile: mock(async () => {})
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

describe('aws-profile-delete command', () => {
  test('should delete AWS profile', async () => {
    const { getIniFileContent } = await import('@shared/utils/fs-utils');
    const { deleteAwsProfile } = await import('@utils/aws-config');
    const { printer } = await import('@utils/printer');
    (getIniFileContent as any).mockImplementation(async () => ({
      default: { aws_access_key_id: 'key1' },
      'test-profile': { aws_access_key_id: 'key2' }
    }));

    const { commandAwsProfileDelete } = await import('./index');
    await commandAwsProfileDelete();

    expect(deleteAwsProfile).toHaveBeenCalledWith('test-profile');
    expect(printer.success).toHaveBeenCalledWith(
      'Successfully deleted credentials for profile test-profile.'
    );
  });

  test('should collect profiles from both credentials and config files', async () => {
    const { getIniFileContent } = await import('@shared/utils/fs-utils');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    (getIniFileContent as any).mockImplementation(async (path) => {
      if (path.includes('credentials')) {
        return { default: { aws_access_key_id: 'key1' } };
      }
      if (path.includes('config')) {
        return { 'profile production': { region: 'us-east-1' } };
      }
      return {};
    });

    const { commandAwsProfileDelete } = await import('./index');
    await commandAwsProfileDelete();

    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'select',
        choices: expect.arrayContaining([
          expect.objectContaining({ value: 'default' }),
          expect.objectContaining({ value: 'production' })
        ])
      })
    );
  });

  test('should handle profiles with "profile " prefix in config file', async () => {
    const { getIniFileContent } = await import('@shared/utils/fs-utils');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    (getIniFileContent as any).mockImplementation(async (path) => {
      if (path.includes('config')) {
        return { 'profile test-profile': { region: 'us-east-1' } };
      }
      return {};
    });

    const { commandAwsProfileDelete } = await import('./index');
    await commandAwsProfileDelete();

    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: expect.arrayContaining([
          expect.objectContaining({ value: 'test-profile' })
        ])
      })
    );
  });

  test('should throw error when no profiles exist', async () => {
    const { getIniFileContent } = await import('@shared/utils/fs-utils');
    (getIniFileContent as any).mockImplementation(async () => ({}));

    const { commandAwsProfileDelete } = await import('./index');

    await expect(commandAwsProfileDelete()).rejects.toThrow(
      'No profile set in global AWS credentials file'
    );
  });

  test('should deduplicate profiles from both files', async () => {
    const { getIniFileContent } = await import('@shared/utils/fs-utils');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    (getIniFileContent as any).mockImplementation(async (path) => {
      if (path.includes('credentials')) {
        return { default: { aws_access_key_id: 'key1' } };
      }
      if (path.includes('config')) {
        return { 'profile default': { region: 'us-east-1' } };
      }
      return {};
    });

    const { commandAwsProfileDelete } = await import('./index');
    await commandAwsProfileDelete();

    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        choices: [expect.objectContaining({ value: 'default' })]
      })
    );
  });
});
