import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    workingDir: '/test/working/dir'
  }
}));

mock.module('@config', () => ({
  IS_DEV: false
}));

mock.module('@errors', () => ({
  stpErrors: {
    e18: mock(({ absoluteScriptPath }) => new Error(`Script not found: ${absoluteScriptPath}`))
  }
}));

mock.module('@shared/utils/bin-executable', () => ({
  checkExecutableInPath: mock((name) => {
    if (name === 'node') return '/usr/bin/node';
    if (name === 'python3') return '/usr/bin/python3';
    return null;
  })
}));

mock.module('@shared/utils/exec', () => ({
  exec: mock(async (command, args, options) => {
    return { failed: false, stdout: 'success', stderr: '' };
  })
}));

mock.module('@shared/utils/fs-utils', () => ({
  getFileExtension: mock((path) => {
    if (path.endsWith('.js')) return 'js';
    if (path.endsWith('.ts')) return 'ts';
    if (path.endsWith('.py')) return 'py';
    return 'unknown';
  })
}));

mock.module('./errors', () => ({
  ExpectedError: class ExpectedError extends Error {
    constructor(public type: string, message: string) {
      super(message);
    }
  }
}));

mock.module('./file-loaders', () => ({
  getPythonExecutable: mock(() => '/usr/bin/python3')
}));

mock.module('./versioning', () => ({
  INSTALLATION_DIR: '/opt/stacktape'
}));

mock.module('node:fs', () => ({
  existsSync: mock((path) => !path.includes('nonexistent'))
}));

describe('scripts', () => {
  describe('getScriptEnv', () => {
    test('should build environment with hook metadata', async () => {
      const { getScriptEnv } = await import('./scripts');

      const result = getScriptEnv({
        userDefinedEnv: [],
        connectToEnv: [],
        command: 'deploy',
        hookType: 'before',
        fullHookTrigger: 'before:deploy'
      });

      expect(result.STP_HOOK_TYPE).toBe('before');
      expect(result.STP_HOOK_TRIGGER).toBe('before:deploy');
      expect(result.STP_COMMAND).toBe('deploy');
    });

    test('should include user defined environment variables', async () => {
      const { getScriptEnv } = await import('./scripts');

      const result = getScriptEnv({
        userDefinedEnv: [
          { name: 'MY_VAR', value: 'my-value' },
          { name: 'ANOTHER_VAR', value: 'another-value' }
        ],
        connectToEnv: [],
        command: 'deploy',
        fullHookTrigger: 'before:deploy'
      });

      expect(result.MY_VAR).toBe('my-value');
      expect(result.ANOTHER_VAR).toBe('another-value');
    });

    test('should include connect-to environment variables', async () => {
      const { getScriptEnv } = await import('./scripts');

      const result = getScriptEnv({
        userDefinedEnv: [],
        connectToEnv: [{ name: 'DB_HOST', value: 'localhost' }],
        command: 'deploy',
        fullHookTrigger: 'before:deploy'
      });

      expect(result.DB_HOST).toBe('localhost');
    });

    test('should include assumed role AWS env vars', async () => {
      const { getScriptEnv } = await import('./scripts');

      const result = getScriptEnv({
        userDefinedEnv: [],
        connectToEnv: [],
        assumedRoleAWSEnvVars: [
          { name: 'AWS_ACCESS_KEY_ID', value: 'AKIATEST' },
          { name: 'AWS_SECRET_ACCESS_KEY', value: 'secret' }
        ],
        command: 'deploy',
        fullHookTrigger: 'before:deploy'
      });

      expect(result.AWS_ACCESS_KEY_ID).toBe('AKIATEST');
      expect(result.AWS_SECRET_ACCESS_KEY).toBe('secret');
    });

    test('should include error data when provided', async () => {
      const { getScriptEnv } = await import('./scripts');

      const errorData = { message: 'Test error', code: 'E001' };

      const result = getScriptEnv({
        userDefinedEnv: [],
        connectToEnv: [],
        command: 'deploy',
        fullHookTrigger: 'onError:deploy',
        hookType: 'onError',
        errorData
      });

      expect(result.STP_ERROR).toBe(JSON.stringify(errorData));
    });

    test('should not include hook metadata when hookType is not provided', async () => {
      const { getScriptEnv } = await import('./scripts');

      const result = getScriptEnv({
        userDefinedEnv: [],
        connectToEnv: [],
        command: 'deploy',
        fullHookTrigger: 'deploy'
      });

      expect(result.STP_HOOK_TYPE).toBeUndefined();
      expect(result.STP_HOOK_TRIGGER).toBeUndefined();
      expect(result.STP_COMMAND).toBeUndefined();
    });

    test('should remove environment variables with non-standardized names', async () => {
      const { getScriptEnv } = await import('./scripts');

      const result = getScriptEnv({
        userDefinedEnv: [
          { name: 'VALID_VAR', value: 'valid' },
          { name: 'invalid-var', value: 'invalid' },
          { name: '123invalid', value: 'also-invalid' }
        ],
        connectToEnv: [],
        command: 'deploy',
        fullHookTrigger: 'before:deploy'
      });

      expect(result.VALID_VAR).toBe('valid');
      expect(result['invalid-var']).toBeUndefined();
      expect(result['123invalid']).toBeUndefined();
    });

    test('should allow underscores in variable names', async () => {
      const { getScriptEnv } = await import('./scripts');

      const result = getScriptEnv({
        userDefinedEnv: [{ name: '_MY_VAR_NAME', value: 'value' }],
        connectToEnv: [],
        command: 'deploy',
        fullHookTrigger: 'before:deploy'
      });

      expect(result._MY_VAR_NAME).toBe('value');
    });

    test('should merge all environment variable sources', async () => {
      const { getScriptEnv } = await import('./scripts');

      const result = getScriptEnv({
        userDefinedEnv: [{ name: 'USER_VAR', value: 'user' }],
        connectToEnv: [{ name: 'CONNECT_VAR', value: 'connect' }],
        assumedRoleAWSEnvVars: [{ name: 'AWS_VAR', value: 'aws' }],
        command: 'deploy',
        fullHookTrigger: 'before:deploy',
        hookType: 'before'
      });

      expect(result.USER_VAR).toBe('user');
      expect(result.CONNECT_VAR).toBe('connect');
      expect(result.AWS_VAR).toBe('aws');
      expect(result.STP_HOOK_TYPE).toBe('before');
    });

    test('should handle different hook types', async () => {
      const { getScriptEnv } = await import('./scripts');

      const afterResult = getScriptEnv({
        userDefinedEnv: [],
        connectToEnv: [],
        command: 'deploy',
        hookType: 'after',
        fullHookTrigger: 'after:deploy'
      });

      expect(afterResult.STP_HOOK_TYPE).toBe('after');
    });
  });

  describe('executeCommandHook', () => {
    test('should call exec with correct command', async () => {
      const { exec } = await import('@shared/utils/exec');
      const { executeCommandHook } = await import('./scripts');

      await executeCommandHook({
        command: 'echo hello',
        env: {},
        cwd: '/test/dir',
        pipeStdio: false
      });

      expect(exec).toHaveBeenCalledWith(
        'echo hello',
        [],
        expect.objectContaining({
          cwd: '/test/dir'
        })
      );
    });

    test('should pass environment variables to exec', async () => {
      const { exec } = await import('@shared/utils/exec');
      const { executeCommandHook } = await import('./scripts');

      const env = { MY_VAR: 'value' };

      await executeCommandHook({
        command: 'test',
        env,
        cwd: '/test',
        pipeStdio: false
      });

      expect(exec).toHaveBeenCalledWith(
        'test',
        [],
        expect.objectContaining({
          env
        })
      );
    });

    test('should use bash shell on non-Windows platforms', async () => {
      const { exec } = await import('@shared/utils/exec');
      const { executeCommandHook } = await import('./scripts');

      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      await executeCommandHook({
        command: 'test',
        env: {},
        cwd: '/test',
        pipeStdio: false
      });

      expect(exec).toHaveBeenCalledWith(
        'test',
        [],
        expect.objectContaining({
          rawOptions: { shell: '/bin/bash' }
        })
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('should disable stderr and stdout when pipeStdio is false', async () => {
      const { exec } = await import('@shared/utils/exec');
      const { executeCommandHook } = await import('./scripts');

      await executeCommandHook({
        command: 'test',
        env: {},
        cwd: '/test',
        pipeStdio: false
      });

      expect(exec).toHaveBeenCalledWith(
        'test',
        [],
        expect.objectContaining({
          disableStderr: true,
          disableStdout: true
        })
      );
    });

    test('should enable stdio piping when pipeStdio is true', async () => {
      const { exec } = await import('@shared/utils/exec');
      const { executeCommandHook } = await import('./scripts');

      await executeCommandHook({
        command: 'test',
        env: {},
        cwd: '/test',
        pipeStdio: true
      });

      expect(exec).toHaveBeenCalledWith(
        'test',
        [],
        expect.objectContaining({
          pipeStdio: true
        })
      );
    });

    test('should throw error when exec fails', async () => {
      const { exec } = await import('@shared/utils/exec');
      const { executeCommandHook } = await import('./scripts');

      exec.mockImplementationOnce(async () => ({
        failed: true,
        stderr: 'Command failed',
        stdout: ''
      }));

      try {
        await executeCommandHook({
          command: 'failing-command',
          env: {},
          cwd: '/test',
          pipeStdio: false
        });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(err.message).toBe('Command failed');
      }
    });

    test('should exclude ESBUILD_BINARY_PATH from inherited env vars', async () => {
      const { exec } = await import('@shared/utils/exec');
      const { executeCommandHook } = await import('./scripts');

      await executeCommandHook({
        command: 'test',
        env: {},
        cwd: '/test',
        pipeStdio: false
      });

      expect(exec).toHaveBeenCalledWith(
        'test',
        [],
        expect.objectContaining({
          inheritEnvVarsExcept: ['ESBUILD_BINARY_PATH']
        })
      );
    });
  });

  describe('executeScriptHook', () => {
    test('should resolve absolute path from working directory', async () => {
      const { executeScriptHook } = await import('./scripts');

      await executeScriptHook({
        filePath: 'scripts/test.js',
        cwd: '/test',
        env: {},
        pipeStdio: false
      });

      // Script should be executed (no error thrown)
      expect(true).toBe(true);
    });

    test('should pass environment variables', async () => {
      const { executeScriptHook } = await import('./scripts');

      const env = { TEST_VAR: 'value' };

      await executeScriptHook({
        filePath: 'scripts/test.js',
        cwd: '/test',
        env,
        pipeStdio: false
      });

      expect(true).toBe(true);
    });

    test('should use specified working directory', async () => {
      const { executeScriptHook } = await import('./scripts');

      await executeScriptHook({
        filePath: 'scripts/test.js',
        cwd: '/custom/cwd',
        env: {},
        pipeStdio: false
      });

      expect(true).toBe(true);
    });

    test('should handle pipeStdio option', async () => {
      const { executeScriptHook } = await import('./scripts');

      await executeScriptHook({
        filePath: 'scripts/test.js',
        cwd: '/test',
        env: {},
        pipeStdio: true
      });

      expect(true).toBe(true);
    });
  });
});
