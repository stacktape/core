import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { EventEmitter } from 'node:events';

// Mock dependencies
mock.module('@cli-config', () => ({
  sdkCommands: ['deploy', 'delete', 'stack-list', 'logs']
}));

mock.module('@config', () => ({
  INVOKED_FROM_ENV_VAR_NAME: 'STACKTAPE_INVOKED_FROM'
}));

mock.module('@shared/utils/bin-executable', () => ({
  getInstallationScript: mock(() => 'curl -L https://stacktape.com/install.sh | sh'),
  isStacktapeInstalledOnSystem: mock(() => true)
}));

mock.module('@shared/utils/fs-utils', () => ({
  isFileAccessible: mock((path: string) => path === '/valid/path/stacktape')
}));

mock.module('@utils/cli', () => ({
  transformToCliArgs: mock((args: any) => {
    const cliArgs: string[] = [];
    Object.entries(args).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        cliArgs.push(`--${key}`, String(value));
      }
    });
    return cliArgs;
  })
}));

mock.module('change-case', () => ({
  camelCase: mock((str: string) => str.replace(/[:-](\w)/g, (_, c) => c.toUpperCase()))
}));

const mockChildProcess = {
  on: mock((event: string, handler: Function) => {
    // Store handlers for testing
    mockChildProcess._handlers = mockChildProcess._handlers || {};
    mockChildProcess._handlers[event] = handler;
    return mockChildProcess;
  }),
  _handlers: {} as any,
  _emit: (event: string, data: any) => {
    if (mockChildProcess._handlers[event]) {
      mockChildProcess._handlers[event](data);
    }
  }
};

mock.module('execa', () => ({
  default: mock(() => mockChildProcess)
}));

mock.module('p-queue', () => ({
  default: mock(
    class PQueue {
      add = mock(async (fn: () => Promise<any>) => fn());
    }
  )
}));

describe('Stacktape SDK', () => {
  beforeEach(() => {
    mock.restore();
    mockChildProcess._handlers = {};
  });

  describe('constructor', () => {
    test('should create instance with default options', async () => {
      const { Stacktape } = await import('./index');

      const client = new Stacktape();

      expect(client).toBeDefined();
      expect(client).toHaveProperty('deploy');
      expect(client).toHaveProperty('delete');
      expect(client).toHaveProperty('stackList');
    });

    test('should create instance with custom options', async () => {
      const { Stacktape } = await import('./index');

      const client = new Stacktape({
        region: 'us-east-1',
        stage: 'prod',
        printProgress: true,
        concurrency: 5
      });

      expect(client).toBeDefined();
    });

    test('should throw error for invalid constructor arguments', async () => {
      const { Stacktape } = await import('./index');

      expect(() => {
        new Stacktape('invalid' as any);
      }).toThrow('Invalid arguments passed to the Stacktape constructor');
    });

    test('should use custom executable path when provided', async () => {
      const { Stacktape } = await import('./index');

      const client = new Stacktape({
        executablePath: '/valid/path/stacktape'
      });

      expect(client).toBeDefined();
    });

    test('should throw error for inaccessible executable path', async () => {
      const { Stacktape } = await import('./index');

      expect(() => {
        new Stacktape({
          executablePath: '/invalid/path/stacktape'
        });
      }).toThrow('not accessible');
    });

    test('should throw error when Stacktape not installed', async () => {
      const { isStacktapeInstalledOnSystem } = await import('@shared/utils/bin-executable');
      (isStacktapeInstalledOnSystem as any).mockImplementation(() => false);

      const { Stacktape } = await import('./index');

      expect(() => {
        new Stacktape();
      }).toThrow('Stacktape is not installed on the system');
    });

    test('should create methods for all SDK commands', async () => {
      const { Stacktape } = await import('./index');

      const client = new Stacktape();

      expect(typeof client.deploy).toBe('function');
      expect(typeof client.delete).toBe('function');
      expect(typeof client.stackList).toBe('function');
      expect(typeof client.logs).toBe('function');
    });
  });

  describe('command execution', () => {
    test('should execute deploy command', async () => {
      const { Stacktape } = await import('./index');
      const execa = (await import('execa')).default;

      const client = new Stacktape();

      const deployPromise = client.deploy({ stage: 'dev', region: 'us-east-1' });

      // Simulate successful command completion
      setTimeout(() => {
        mockChildProcess._emit('message', {
          type: 'FINISH',
          data: { stackInfo: { resources: [] } }
        });
      }, 10);

      const result = await deployPromise;

      expect(execa).toHaveBeenCalled();
      expect(result).toHaveProperty('stackInfo');
    });

    test('should handle command errors', async () => {
      const { Stacktape } = await import('./index');

      const client = new Stacktape();

      const deployPromise = client.deploy({ stage: 'dev' });

      setTimeout(() => {
        mockChildProcess._emit('message', {
          type: 'ERROR',
          data: {
            errorType: 'CLOUDFORMATION_ERROR',
            message: 'Stack deployment failed'
          }
        });
      }, 10);

      await expect(deployPromise).rejects.toThrow('CLOUDFORMATION_ERROR: Stack deployment failed');
    });

    test('should pass global args to command', async () => {
      const { Stacktape } = await import('./index');
      const execa = (await import('execa')).default;

      const client = new Stacktape({
        region: 'us-west-2',
        stage: 'prod'
      });

      const deployPromise = client.deploy();

      setTimeout(() => {
        mockChildProcess._emit('message', {
          type: 'FINISH',
          data: {}
        });
      }, 10);

      await deployPromise;

      const callArgs = (execa as any).mock.calls[0];
      expect(callArgs[1]).toContain('--region');
      expect(callArgs[1]).toContain('us-west-2');
      expect(callArgs[1]).toContain('--stage');
      expect(callArgs[1]).toContain('prod');
    });

    test('should merge global and command-specific args', async () => {
      const { Stacktape } = await import('./index');
      const execa = (await import('execa')).default;

      const client = new Stacktape({
        region: 'us-west-2'
      });

      const deployPromise = client.deploy({
        stage: 'dev',
        hotSwap: true
      });

      setTimeout(() => {
        mockChildProcess._emit('message', {
          type: 'FINISH',
          data: {}
        });
      }, 10);

      await deployPromise;

      const callArgs = (execa as any).mock.calls[0];
      expect(callArgs[1]).toContain('--region');
      expect(callArgs[1]).toContain('--stage');
      expect(callArgs[1]).toContain('--hotSwap');
    });

    test('should handle config parameter', async () => {
      const { Stacktape } = await import('./index');
      const execa = (await import('execa')).default;

      const client = new Stacktape();

      const config = {
        resources: {
          myFunction: { type: 'function' }
        }
      };

      const deployPromise = client.deploy({ config });

      setTimeout(() => {
        mockChildProcess._emit('message', {
          type: 'FINISH',
          data: {}
        });
      }, 10);

      await deployPromise;

      const callArgs = (execa as any).mock.calls[0];
      expect(callArgs[1]).toContain('--config');
    });

    test('should print progress when enabled', async () => {
      const { Stacktape } = await import('./index');
      const consoleInfoSpy = mock();
      const originalConsoleInfo = console.info;
      console.info = consoleInfoSpy;

      const client = new Stacktape({ printProgress: true });

      const deployPromise = client.deploy();

      setTimeout(() => {
        mockChildProcess._emit('message', {
          type: 'MESSAGE',
          data: {
            printType: 'INFO',
            message: 'Deploying stack'
          }
        });
        mockChildProcess._emit('message', {
          type: 'FINISH',
          data: {}
        });
      }, 10);

      await deployPromise;

      expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] Deploying stack');

      console.info = originalConsoleInfo;
    });

    test('should call onEvent callback', async () => {
      const { Stacktape } = await import('./index');
      const onEventMock = mock();

      const client = new Stacktape({ onEvent: onEventMock });

      const deployPromise = client.deploy();

      setTimeout(() => {
        mockChildProcess._emit('message', {
          type: 'MESSAGE',
          data: {
            printType: 'INFO',
            message: 'Deploying'
          }
        });
        mockChildProcess._emit('message', {
          type: 'FINISH',
          data: {}
        });
      }, 10);

      await deployPromise;

      expect(onEventMock).toHaveBeenCalled();
    });

    test('should use command-specific onEvent over global', async () => {
      const { Stacktape } = await import('./index');
      const globalOnEvent = mock();
      const commandOnEvent = mock();

      const client = new Stacktape({ onEvent: globalOnEvent });

      const deployPromise = client.deploy({ onEvent: commandOnEvent });

      setTimeout(() => {
        mockChildProcess._emit('message', {
          type: 'MESSAGE',
          data: {
            printType: 'INFO',
            message: 'Deploying'
          }
        });
        mockChildProcess._emit('message', {
          type: 'FINISH',
          data: {}
        });
      }, 10);

      await deployPromise;

      expect(commandOnEvent).toHaveBeenCalled();
      expect(globalOnEvent).not.toHaveBeenCalled();
    });

    test('should set INVOKED_FROM environment variable', async () => {
      const { Stacktape } = await import('./index');
      const execa = (await import('execa')).default;

      const client = new Stacktape();

      const deployPromise = client.deploy();

      setTimeout(() => {
        mockChildProcess._emit('message', {
          type: 'FINISH',
          data: {}
        });
      }, 10);

      await deployPromise;

      const callArgs = (execa as any).mock.calls[0];
      const options = callArgs[2];
      expect(options.env.STACKTAPE_INVOKED_FROM).toBe('sdk');
    });

    test('should respect concurrency setting', async () => {
      const { Stacktape } = await import('./index');
      const PQueue = (await import('p-queue')).default;

      new Stacktape({ concurrency: 3 });

      expect(PQueue).toHaveBeenCalledWith({ concurrency: 3 });
    });

    test('should use default concurrency of 1', async () => {
      const { Stacktape } = await import('./index');
      const PQueue = (await import('p-queue')).default;

      new Stacktape();

      expect(PQueue).toHaveBeenCalledWith({ concurrency: 1 });
    });

    test('should pass custom environment variables', async () => {
      const { Stacktape } = await import('./index');
      const execa = (await import('execa')).default;

      const client = new Stacktape({
        env: {
          CUSTOM_VAR: 'custom-value',
          DEBUG: 'true'
        }
      });

      const deployPromise = client.deploy();

      setTimeout(() => {
        mockChildProcess._emit('message', {
          type: 'FINISH',
          data: {}
        });
      }, 10);

      await deployPromise;

      const callArgs = (execa as any).mock.calls[0];
      const options = callArgs[2];
      expect(options.env.CUSTOM_VAR).toBe('custom-value');
      expect(options.env.DEBUG).toBe('true');
    });
  });
});
