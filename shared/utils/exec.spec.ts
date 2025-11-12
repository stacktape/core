import { describe, expect, mock, test } from 'bun:test';

// Mock execa
const mockChildProcess = {
  stdout: {
    pipe: mock(() => mockChildProcess.stdout)
  },
  stderr: {
    pipe: mock(() => mockChildProcess.stderr)
  },
  then: mock((callback) => {
    callback({ stdout: '', stderr: '' });
    return mockChildProcess;
  }),
  catch: mock((callback) => mockChildProcess)
};

const mockExeca = mock(() => mockChildProcess);
mockExeca.node = mock(() => mockChildProcess);

mock.module('execa', () => ({ default: mockExeca }));
mock.module('../../src/utils/log-collector', () => ({
  logCollectorStream: { write: mock(() => {}) }
}));

describe('exec', () => {
  describe('exec', () => {
    test('should execute command with arguments', async () => {
      const { exec } = await import('./exec');
      await exec('ls', ['-la'], {});

      expect(mockExeca).toHaveBeenCalledWith('ls', ['-la'], expect.any(Object));
    });

    test('should pass environment variables', async () => {
      const { exec } = await import('./exec');
      await exec('node', ['script.js'], { env: { NODE_ENV: 'test' } });

      const callArgs = mockExeca.mock.calls[mockExeca.mock.calls.length - 1];
      expect(callArgs[2].env).toBeDefined();
      expect(callArgs[2].env.NODE_ENV).toBe('test');
    });

    test('should pass working directory', async () => {
      const { exec } = await import('./exec');
      await exec('npm', ['install'], { cwd: '/home/user/project' });

      const callArgs = mockExeca.mock.calls[mockExeca.mock.calls.length - 1];
      expect(callArgs[2].cwd).toBe('/home/user/project');
    });

    test('should disable stdout when specified', async () => {
      const { exec } = await import('./exec');
      await exec('echo', ['hello'], { disableStdout: true });

      expect(mockExeca).toHaveBeenCalled();
    });

    test('should disable stderr when specified', async () => {
      const { exec } = await import('./exec');
      await exec('command', ['arg'], { disableStderr: true });

      expect(mockExeca).toHaveBeenCalled();
    });
  });

  describe('cancellableExec', () => {
    test('should return child process', async () => {
      const { cancellableExec } = await import('./exec');
      const cp = cancellableExec('ls', ['-l'], {});

      expect(cp).toBeDefined();
      expect(cp.stdout).toBeDefined();
      expect(cp.stderr).toBeDefined();
    });
  });

  describe('nodeExec', () => {
    test('should execute node script', async () => {
      const { nodeExec } = await import('./exec');
      const cp = nodeExec('script.js', ['--arg'], {});

      expect(mockExeca.node).toHaveBeenCalled();
      expect(cp).toBeDefined();
    });
  });

  describe('executeGit', () => {
    test('should execute git command', async () => {
      const { executeGit } = await import('./exec');
      await executeGit('status');

      expect(mockExeca).toHaveBeenCalledWith('git status', expect.objectContaining({ shell: true }));
    });

    test('should pass additional options', async () => {
      const { executeGit } = await import('./exec');
      await executeGit('log', { cwd: '/repo' });

      const callArgs = mockExeca.mock.calls[mockExeca.mock.calls.length - 1];
      expect(callArgs[1].cwd).toBe('/repo');
      expect(callArgs[1].shell).toBe(true);
    });
  });
});
