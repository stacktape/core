import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('dotenv', () => ({
  config: mock()
}));

mock.module('@config', () => ({
  INVOKED_FROM_ENV_VAR_NAME: 'STACKTAPE_INVOKED_FROM'
}));

mock.module('@utils/cli', () => ({
  getCliInput: mock(() => ({
    commands: ['deploy'],
    options: { stage: 'dev', region: 'us-east-1' },
    additionalArgs: []
  }))
}));

mock.module('../../index', () => ({
  runCommand: mock(async () => ({ success: true }))
}));

describe('api/cli', () => {
  beforeEach(() => {
    mock.restore();
    delete process.env.STACKTAPE_INVOKED_FROM;
  });

  describe('runUsingCli', () => {
    test('should parse CLI input and run command', async () => {
      const { runUsingCli } = await import('./index');
      const { getCliInput } = await import('@utils/cli');
      const { runCommand } = await import('../../index');

      await runUsingCli();

      expect(getCliInput).toHaveBeenCalled();
      expect(runCommand).toHaveBeenCalledWith({
        args: { stage: 'dev', region: 'us-east-1' },
        commands: ['deploy'],
        additionalArgs: [],
        invokedFrom: 'cli'
      });
    });

    test('should use environment variable for invokedFrom if set', async () => {
      process.env.STACKTAPE_INVOKED_FROM = 'sdk';

      const { runUsingCli } = await import('./index');
      const { runCommand } = await import('../../index');

      await runUsingCli();

      const callArgs = (runCommand as any).mock.calls[0][0];
      expect(callArgs.invokedFrom).toBe('sdk');
    });

    test('should default to cli when env var not set', async () => {
      const { runUsingCli } = await import('./index');
      const { runCommand } = await import('../../index');

      await runUsingCli();

      const callArgs = (runCommand as any).mock.calls[0][0];
      expect(callArgs.invokedFrom).toBe('cli');
    });

    test('should load dotenv configuration', async () => {
      const { config } = await import('dotenv');

      // Just importing the module should trigger dotenv.config()
      await import('./index');

      expect(config).toHaveBeenCalled();
    });

    test('should pass commands from CLI input', async () => {
      const { getCliInput } = await import('@utils/cli');
      (getCliInput as any).mockImplementation(() => ({
        commands: ['stack-list'],
        options: {},
        additionalArgs: []
      }));

      const { runUsingCli } = await import('./index');
      const { runCommand } = await import('../../index');

      await runUsingCli();

      const callArgs = (runCommand as any).mock.calls[0][0];
      expect(callArgs.commands).toEqual(['stack-list']);
    });

    test('should pass options from CLI input', async () => {
      const { getCliInput } = await import('@utils/cli');
      (getCliInput as any).mockImplementation(() => ({
        commands: ['deploy'],
        options: { stage: 'prod', region: 'eu-west-1', hotSwap: true },
        additionalArgs: []
      }));

      const { runUsingCli } = await import('./index');
      const { runCommand } = await import('../../index');

      await runUsingCli();

      const callArgs = (runCommand as any).mock.calls[0][0];
      expect(callArgs.args).toEqual({ stage: 'prod', region: 'eu-west-1', hotSwap: true });
    });

    test('should pass additional args from CLI input', async () => {
      const { getCliInput } = await import('@utils/cli');
      (getCliInput as any).mockImplementation(() => ({
        commands: ['deploy'],
        options: {},
        additionalArgs: ['--verbose', '--debug']
      }));

      const { runUsingCli } = await import('./index');
      const { runCommand } = await import('../../index');

      await runUsingCli();

      const callArgs = (runCommand as any).mock.calls[0][0];
      expect(callArgs.additionalArgs).toEqual(['--verbose', '--debug']);
    });

    test('should return result from runCommand', async () => {
      const { runCommand } = await import('../../index');
      (runCommand as any).mockImplementation(async () => ({
        stackInfo: { resources: [] }
      }));

      const { runUsingCli } = await import('./index');

      const result = await runUsingCli();

      expect(result).toEqual({ stackInfo: { resources: [] } });
    });
  });

  describe('esbuild binary path setup', () => {
    test('should set ESBUILD_BINARY_PATH environment variable', async () => {
      // Import should set the env var
      await import('./index');

      expect(process.env.ESBUILD_BINARY_PATH).toBeDefined();
      expect(process.env.ESBUILD_BINARY_PATH).toContain('esbuild');
    });

    test('should use correct binary name for platform', async () => {
      await import('./index');

      const expectedBinary = process.platform === 'win32' ? 'exec.exe' : 'exec';
      expect(process.env.ESBUILD_BINARY_PATH).toContain(expectedBinary);
    });
  });
});
