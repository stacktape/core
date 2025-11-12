import { describe, expect, mock, test } from 'bun:test';

// Mock exec
mock.module('./exec', () => ({
  exec: mock(async () => ({ stdout: 'pack output', stderr: '' }))
}));

mock.module('./misc', () => ({
  getError: mock((opts) => new Error(opts.message))
}));

mock.module('./bin-executable', () => ({
  getPlatform: mock(() => 'linux')
}));

mock.module('./constants', () => ({
  PACK_BINARY_FILE_NAMES: {
    linux: 'pack-linux',
    darwin: 'pack-darwin',
    win: 'pack.exe'
  }
}));

mock.module('@config', () => ({
  IS_DEV: false
}));

mock.module('@shared/naming/project-fs-paths', () => ({
  SCRIPTS_ASSETS_PATH: '/assets'
}));

describe('pack-exec', () => {
  describe('execPack', () => {
    test('should execute pack command', async () => {
      const { execPack } = await import('./pack-exec');
      const { exec } = await import('./exec');

      await execPack({
        args: ['build', 'myapp'],
        cwd: '/project'
      });

      expect(exec).toHaveBeenCalledWith(expect.stringContaining('pack'), ['build', 'myapp'], expect.any(Object));
    });

    test('should pass cwd to exec', async () => {
      const { execPack } = await import('./pack-exec');
      const { exec } = await import('./exec');

      await execPack({
        args: ['version'],
        cwd: '/workspace'
      });

      const callArgs = exec.mock.calls[exec.mock.calls.length - 1];
      expect(callArgs[2].cwd).toBe('/workspace');
    });

    test('should disable stdout and stderr', async () => {
      const { execPack } = await import('./pack-exec');
      const { exec } = await import('./exec');

      await execPack({
        args: ['inspect', 'image'],
        cwd: '/app'
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

      const { execPack } = await import('./pack-exec');

      await expect(
        execPack({
          args: ['build', 'app'],
          cwd: '/project'
        })
      ).rejects.toThrow();
    });
  });
});
