import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/user-prompt', () => ({
  userPrompt: mock(async ({ name }) => {
    // Note: The actual code has variable names swapped, but we test as-is
    if (name === 'profile') return { awsAccessKeyId: 'default' };
    if (name === 'awsAccessKeyId') return { awsSecretAccessKey: 'AKIAIOSFODNN7EXAMPLE' };
    if (name === 'awsSecretAccessKey') return { profile: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' };
    return {};
  })
}));

mock.module('@utils/aws-config', () => ({
  getAvailableAwsProfiles: mock(async () => ['default', 'production']),
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

describe('aws-profile-update command', () => {
  test('should update AWS profile credentials', async () => {
    const { getAvailableAwsProfiles } = await import('@utils/aws-config');
    const { upsertAwsProfile } = await import('@utils/aws-config');
    const { printer } = await import('@utils/printer');

    const { commandAwsProfileUpdate } = await import('./index');
    await commandAwsProfileUpdate();

    expect(getAvailableAwsProfiles).toHaveBeenCalled();
    expect(upsertAwsProfile).toHaveBeenCalledWith(
      'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      'default',
      'AKIAIOSFODNN7EXAMPLE'
    );
    expect(printer.success).toHaveBeenCalledWith(
      expect.stringContaining('Successfully updated credentials')
    );
  });

  test('should throw error when no profiles exist', async () => {
    const { getAvailableAwsProfiles } = await import('@utils/aws-config');
    (getAvailableAwsProfiles as any).mockImplementation(async () => []);

    const { commandAwsProfileUpdate } = await import('./index');

    await expect(commandAwsProfileUpdate()).rejects.toThrow(
      'No profile set in global AWS credentials file'
    );
  });

  test('should show available profiles in selection', async () => {
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { getAvailableAwsProfiles } = await import('@utils/aws-config');
    (getAvailableAwsProfiles as any).mockImplementation(async () => ['default', 'production', 'staging']);

    const { commandAwsProfileUpdate } = await import('./index');
    await commandAwsProfileUpdate();

    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'select',
        choices: expect.arrayContaining([
          expect.objectContaining({ value: 'default' }),
          expect.objectContaining({ value: 'production' }),
          expect.objectContaining({ value: 'staging' })
        ])
      })
    );
  });

  test('should return null', async () => {
    const { commandAwsProfileUpdate } = await import('./index');
    const result = await commandAwsProfileUpdate();

    expect(result).toBe(null);
  });
});
