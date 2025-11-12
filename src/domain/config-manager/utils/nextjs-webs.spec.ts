import { describe, expect, mock, test } from 'bun:test';

// Mock global state manager
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    workingDir: '/test/project'
  }
}));

// Mock errors
mock.module('@errors', () => ({
  stpErrors: {
    e106: mock(({ directoryPath, stpResourceName }) =>
      new Error(`Directory not found: ${directoryPath} for ${stpResourceName}`)
    ),
    e107: mock(({ directoryPath, stpResourceName }) =>
      new Error(`Next.js config not found in ${directoryPath} for ${stpResourceName}`)
    ),
    e105: mock(({ stpResourceName }) => new Error(`Streaming incompatible with edge lambda for ${stpResourceName}`)),
    e124: mock(({ stpResourceName }) => new Error(`VPC incompatible with edge lambda for ${stpResourceName}`))
  }
}));

// Mock filesystem utilities
mock.module('@shared/utils/fs-utils', () => ({
  dirExists: mock((path) => !path.includes('nonexistent')),
  isFileAccessible: mock((path) => {
    if (path.includes('next.config.js')) return true;
    if (path.includes('next.config.ts')) return false;
    return false;
  })
}));

describe('config-manager/utils/nextjs-webs', () => {
  describe('validateNextjsWebConfig', () => {
    test('should not throw for valid config', async () => {
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      const resource: any = {
        name: 'myNextApp',
        appDirectory: 'apps/web'
      };

      expect(() => validateNextjsWebConfig({ resource })).not.toThrow();
    });

    test('should throw when app directory does not exist', async () => {
      const { stpErrors } = await import('@errors');
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      const resource: any = {
        name: 'myNextApp',
        appDirectory: 'nonexistent/dir'
      };

      try {
        validateNextjsWebConfig({ resource });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(stpErrors.e106).toHaveBeenCalledWith({
          directoryPath: 'nonexistent/dir',
          stpResourceName: 'myNextApp'
        });
      }
    });

    test('should throw when next.config.js is not accessible', async () => {
      const { dirExists, isFileAccessible } = await import('@shared/utils/fs-utils');
      const { stpErrors } = await import('@errors');
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      dirExists.mockImplementationOnce(() => true);
      isFileAccessible.mockImplementation(() => false);

      const resource: any = {
        name: 'myNextApp',
        appDirectory: 'apps/web'
      };

      try {
        validateNextjsWebConfig({ resource });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(stpErrors.e107).toHaveBeenCalledWith({
          directoryPath: 'apps/web',
          stpResourceName: 'myNextApp'
        });
      }
    });

    test('should not throw when next.config.ts exists', async () => {
      const { dirExists, isFileAccessible } = await import('@shared/utils/fs-utils');
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      dirExists.mockImplementationOnce(() => true);
      isFileAccessible.mockImplementation((path) => path.includes('next.config.ts'));

      const resource: any = {
        name: 'myNextApp',
        appDirectory: 'apps/web'
      };

      expect(() => validateNextjsWebConfig({ resource })).not.toThrow();
    });

    test('should throw when streaming is enabled with edge lambda', async () => {
      const { stpErrors } = await import('@errors');
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      const resource: any = {
        name: 'myNextApp',
        appDirectory: 'apps/web',
        streamingEnabled: true,
        useEdgeLambda: true
      };

      try {
        validateNextjsWebConfig({ resource });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(stpErrors.e105).toHaveBeenCalledWith({
          stpResourceName: 'myNextApp'
        });
      }
    });

    test('should not throw when streaming is enabled without edge lambda', async () => {
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      const resource: any = {
        name: 'myNextApp',
        appDirectory: 'apps/web',
        streamingEnabled: true,
        useEdgeLambda: false
      };

      expect(() => validateNextjsWebConfig({ resource })).not.toThrow();
    });

    test('should not throw when edge lambda is used without streaming', async () => {
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      const resource: any = {
        name: 'myNextApp',
        appDirectory: 'apps/web',
        streamingEnabled: false,
        useEdgeLambda: true
      };

      expect(() => validateNextjsWebConfig({ resource })).not.toThrow();
    });

    test('should throw when server lambda joins VPC with edge lambda', async () => {
      const { stpErrors } = await import('@errors');
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      const resource: any = {
        name: 'myNextApp',
        appDirectory: 'apps/web',
        serverLambda: {
          joinDefaultVpc: true
        },
        useEdgeLambda: true
      };

      try {
        validateNextjsWebConfig({ resource });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(stpErrors.e124).toHaveBeenCalledWith({
          stpResourceName: 'myNextApp'
        });
      }
    });

    test('should not throw when server lambda joins VPC without edge lambda', async () => {
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      const resource: any = {
        name: 'myNextApp',
        appDirectory: 'apps/web',
        serverLambda: {
          joinDefaultVpc: true
        },
        useEdgeLambda: false
      };

      expect(() => validateNextjsWebConfig({ resource })).not.toThrow();
    });

    test('should not throw when edge lambda is used without VPC', async () => {
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      const resource: any = {
        name: 'myNextApp',
        appDirectory: 'apps/web',
        serverLambda: {
          joinDefaultVpc: false
        },
        useEdgeLambda: true
      };

      expect(() => validateNextjsWebConfig({ resource })).not.toThrow();
    });

    test('should check directory path relative to working directory', async () => {
      const { dirExists } = await import('@shared/utils/fs-utils');
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      const resource: any = {
        name: 'myNextApp',
        appDirectory: 'frontend'
      };

      validateNextjsWebConfig({ resource });

      expect(dirExists).toHaveBeenCalledWith('/test/project/frontend');
    });

    test('should check both JS and TS config files', async () => {
      const { isFileAccessible } = await import('@shared/utils/fs-utils');
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      isFileAccessible.mockClear();

      const resource: any = {
        name: 'myNextApp',
        appDirectory: 'apps/web'
      };

      validateNextjsWebConfig({ resource });

      expect(isFileAccessible).toHaveBeenCalledWith('/test/project/apps/web/next.config.js');
      expect(isFileAccessible).toHaveBeenCalledWith('/test/project/apps/web/next.config.ts');
    });

    test('should handle complex configuration', async () => {
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      const resource: any = {
        name: 'myComplexApp',
        appDirectory: 'apps/main',
        streamingEnabled: false,
        useEdgeLambda: false,
        serverLambda: {
          joinDefaultVpc: false
        }
      };

      expect(() => validateNextjsWebConfig({ resource })).not.toThrow();
    });

    test('should validate all constraints together', async () => {
      const { validateNextjsWebConfig } = await import('./nextjs-webs');

      const resource: any = {
        name: 'myApp',
        appDirectory: 'apps/web',
        streamingEnabled: true,
        useEdgeLambda: true,
        serverLambda: {
          joinDefaultVpc: true
        }
      };

      // Should throw for the first error encountered (streaming + edge lambda)
      expect(() => validateNextjsWebConfig({ resource })).toThrow();
    });
  });
});
