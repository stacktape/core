import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@config', () => ({
  IS_DEV: false
}));

mock.module('@shared/naming/project-fs-paths', () => ({
  SCRIPTS_ASSETS_PATH: '/assets'
}));

mock.module('./bin-executable', () => ({
  getPlatform: mock(() => 'linux')
}));

mock.module('./constants', () => ({
  NIXPACKS_BINARY_FILE_NAMES: {
    linux: 'nixpacks-linux',
    darwin: 'nixpacks-darwin',
    win: 'nixpacks.exe'
  }
}));

mock.module('./exec', () => ({
  exec: mock(async () => ({ stdout: 'nixpacks output', stderr: '' }))
}));

mock.module('./misc', () => ({
  getError: mock((opts) => new Error(opts.message))
}));

describe('nixpack-exec', () => {
  describe('execNixpacks', () => {
    test('should execute nixpacks command', async () => {
      const { execNixpacks } = await import('./nixpack-exec');
      const { exec } = await import('./exec');

      await execNixpacks({
        args: ['build', '.'],
        cwd: '/project'
      });

      expect(exec).toHaveBeenCalled();
    });

    test('should pass args to nixpacks', async () => {
      const { execNixpacks } = await import('./nixpack-exec');
      const { exec } = await import('./exec');

      await execNixpacks({
        args: ['plan', '--format', 'json'],
        cwd: '/workspace'
      });

      const callArgs = exec.mock.calls[exec.mock.calls.length - 1];
      expect(callArgs[1]).toEqual(['plan', '--format', 'json']);
    });

    test('should pass cwd to exec', async () => {
      const { execNixpacks } = await import('./nixpack-exec');
      const { exec } = await import('./exec');

      await execNixpacks({
        args: ['version'],
        cwd: '/app'
      });

      const callArgs = exec.mock.calls[exec.mock.calls.length - 1];
      expect(callArgs[2].cwd).toBe('/app');
    });

    test('should disable stdout and stderr', async () => {
      const { execNixpacks } = await import('./nixpack-exec');
      const { exec } = await import('./exec');

      await execNixpacks({
        args: ['build', '.'],
        cwd: '/project'
      });

      const callArgs = exec.mock.calls[exec.mock.calls.length - 1];
      expect(callArgs[2].disableStdout).toBe(true);
      expect(callArgs[2].disableStderr).toBe(true);
    });

    test('should throw error on exec failure', async () => {
      const { exec } = await import('./exec');
      exec.mockImplementationOnce(async () => {
        throw new Error('Command failed');
      });

      const { execNixpacks } = await import('./nixpack-exec');

      await expect(
        execNixpacks({
          args: ['build', '.'],
          cwd: '/project'
        })
      ).rejects.toThrow();
    });

    test('should include error message in thrown error', async () => {
      const { exec } = await import('./exec');
      exec.mockImplementationOnce(async () => {
        throw new Error('Build failed');
      });

      const { execNixpacks } = await import('./nixpack-exec');

      await expect(
        execNixpacks({
          args: ['build', 'app'],
          cwd: '/project'
        })
      ).rejects.toThrow(/Failed to execute nixpacks/);
    });
  });
});
