import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    invokedFrom: 'cli'
  }
}));

mock.module('@utils/aws-config', () => ({
  listAwsProfiles: mock(async () => [])
}));

mock.module('@utils/printer', () => ({
  printer: {
    colorize: mock((color: string, text: string) => text),
    warn: mock(() => {}),
    printTable: mock(() => {})
  }
}));

describe('aws-profile-list command', () => {
  test('should list AWS profiles', async () => {
    const { listAwsProfiles } = await import('@utils/aws-config');
    (listAwsProfiles as any).mockImplementation(async () => [
      {
        profile: 'default',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
      },
      {
        profile: 'production',
        AWS_ACCESS_KEY_ID: 'AKIAI44QH8DHBEXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'je7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY'
      }
    ]);

    const { commandAwsProfileList } = await import('./index');
    const result = await commandAwsProfileList();

    expect(listAwsProfiles).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0].profile).toBe('default');
    expect(result[0].AWS_ACCESS_KEY_ID).toBe('AKIAIOSFODNN7EXAMPLE');
    expect(result[1].profile).toBe('production');
  });

  test('should display table when invoked from CLI with profiles', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { listAwsProfiles } = await import('@utils/aws-config');
    const { printer } = await import('@utils/printer');
    globalStateManager.invokedFrom = 'cli';
    (listAwsProfiles as any).mockImplementation(async () => [
      {
        profile: 'default',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
      }
    ]);

    const { commandAwsProfileList } = await import('./index');
    await commandAwsProfileList();

    expect(printer.printTable).toHaveBeenCalled();
    expect(printer.warn).not.toHaveBeenCalled();
  });

  test('should display warning when no profiles exist', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { listAwsProfiles } = await import('@utils/aws-config');
    const { printer } = await import('@utils/printer');
    globalStateManager.invokedFrom = 'cli';
    (listAwsProfiles as any).mockImplementation(async () => []);

    const { commandAwsProfileList } = await import('./index');
    await commandAwsProfileList();

    expect(printer.warn).toHaveBeenCalledWith(
      expect.stringContaining('No AWS profiles are set on this system')
    );
    expect(printer.printTable).not.toHaveBeenCalled();
  });

  test('should not print when invoked from SDK', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { listAwsProfiles } = await import('@utils/aws-config');
    const { printer } = await import('@utils/printer');
    globalStateManager.invokedFrom = 'sdk';
    (listAwsProfiles as any).mockImplementation(async () => [
      {
        profile: 'default',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
      }
    ]);

    (printer.printTable as any).mock.calls = [];
    (printer.warn as any).mock.calls = [];

    const { commandAwsProfileList } = await import('./index');
    const result = await commandAwsProfileList();

    expect(result).toHaveLength(1);
    expect(printer.printTable).not.toHaveBeenCalled();
    expect(printer.warn).not.toHaveBeenCalled();
  });

  test('should mask secret access keys in CLI output', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { listAwsProfiles } = await import('@utils/aws-config');
    const { printer } = await import('@utils/printer');
    globalStateManager.invokedFrom = 'cli';
    (listAwsProfiles as any).mockImplementation(async () => [
      {
        profile: 'default',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
      }
    ]);

    const { commandAwsProfileList } = await import('./index');
    await commandAwsProfileList();

    expect(printer.printTable).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: expect.arrayContaining([
          expect.arrayContaining([
            expect.any(String),
            'AKIAIOSFODNN7EXAMPLE',
            expect.stringMatching(/^\*{36}/)
          ])
        ])
      })
    );
  });
});
