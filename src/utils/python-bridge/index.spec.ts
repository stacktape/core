import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('node:child_process', () => ({
  spawn: mock(() => ({
    send: mock(),
    once: mock(),
    removeListener: mock(),
    on: mock(),
    connected: true
  }))
}));

mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: {
    pythonBridgeScriptPath: mock(() => '/path/to/python_bridge.py')
  }
}));

describe('python-bridge', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('should create python bridge with default options', async () => {
    const { pythonBridge } = await import('./index');

    const bridge = pythonBridge({ pythonExecutable: 'python3' });

    expect(bridge).toBeDefined();
  });

  test('should create python bridge with custom options', async () => {
    const { pythonBridge } = await import('./index');

    const bridge = pythonBridge({
      pythonExecutable: 'python3',
      cwd: '/custom/dir',
      env: { CUSTOM_VAR: 'value' }
    });

    expect(bridge).toBeDefined();
  });

  test('should spawn python process with correct args', async () => {
    const { spawn } = await import('node:child_process');
    const { pythonBridge } = await import('./index');

    pythonBridge({ pythonExecutable: 'python3' });

    expect(spawn).toHaveBeenCalledWith(
      'python3',
      ['/path/to/python_bridge.py'],
      expect.objectContaining({
        stdio: expect.any(Array)
      })
    );
  });

  test('should use custom stdio options', async () => {
    const { spawn } = await import('node:child_process');
    const { pythonBridge } = await import('./index');

    const customStdio = ['pipe', 'pipe', 'pipe'];
    pythonBridge({
      pythonExecutable: 'python3',
      stdio: customStdio
    });

    expect(spawn).toHaveBeenCalled();
  });

  test('should pass environment variables to python process', async () => {
    const { spawn } = await import('node:child_process');
    const { pythonBridge } = await import('./index');

    const customEnv = { PYTHON_PATH: '/usr/local/lib/python3.9' };
    pythonBridge({
      pythonExecutable: 'python3',
      env: customEnv
    });

    const callArgs = (spawn as any).mock.calls[0][2];
    expect(callArgs.env).toEqual(customEnv);
  });

  test('should set cwd for python process', async () => {
    const { spawn } = await import('node:child_process');
    const { pythonBridge } = await import('./index');

    pythonBridge({
      pythonExecutable: 'python3',
      cwd: '/custom/working/dir'
    });

    const callArgs = (spawn as any).mock.calls[0][2];
    expect(callArgs.cwd).toBe('/custom/working/dir');
  });
});
