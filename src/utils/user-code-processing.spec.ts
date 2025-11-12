import { describe, expect, mock, test } from 'bun:test';

// Mock all dependencies
mock.module('node:path', () => ({
  isAbsolute: mock((path: string) => path.startsWith('/')),
  join: mock((...parts: string[]) => parts.join('/'))
}));

mock.module('@shared/utils/fs-utils', () => ({
  getFileExtension: mock((filePath: string) => {
    const parts = filePath.split('.');
    return parts[parts.length - 1];
  }),
  getPathRelativeTo: mock((filePath: string, base: string) => {
    return filePath.replace(base + '/', '');
  })
}));

mock.module('./errors', () => ({
  ExpectedError: class ExpectedError extends Error {
    type: string;
    hint: string | string[];
    constructor(type: string, message: string, hint?: string | string[]) {
      super(message);
      this.type = type;
      this.hint = hint;
      this.name = 'ExpectedError';
    }
  },
  UserCodeError: class UserCodeError extends Error {
    originalError: Error;
    constructor(message: string, originalError: Error) {
      super(message);
      this.originalError = originalError;
      this.name = 'UserCodeError';
    }
  }
}));

mock.module('./file-loaders', () => ({
  isFile: mock(() => true),
  getJavascriptExport: mock(() => () => 'js function'),
  getTypescriptExport: mock(() => () => 'ts function'),
  getCallablePythonFunc: mock(() => () => 'py function')
}));

mock.module('./printer', () => ({
  printer: {
    prettyFilePath: mock((path) => path),
    prettyOption: mock((opt) => opt),
    makeBold: mock((text) => text)
  }
}));

describe('user-code-processing', () => {
  describe('parseUserCodeFilepath', () => {
    test('should parse simple file path', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: 'src/handler.js',
        codeType: 'DIRECTIVE',
        workingDir: '/project'
      });

      expect(result.filePath).toBe('/project/src/handler.js');
      expect(result.handler).toBe('default');
      expect(result.extension).toBe('js');
      expect(result.hasExplicitHandler).toBe(false);
    });

    test('should parse file path with explicit handler', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: 'src/handler.js:myHandler',
        codeType: 'DIRECTIVE',
        workingDir: '/project'
      });

      expect(result.filePath).toBe('/project/src/handler.js');
      expect(result.handler).toBe('myHandler');
      expect(result.extension).toBe('js');
      expect(result.hasExplicitHandler).toBe(true);
    });

    test('should parse TypeScript file without handler', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: 'functions/process.ts',
        codeType: 'WORKLOAD',
        workingDir: '/app'
      });

      expect(result.filePath).toBe('/app/functions/process.ts');
      expect(result.handler).toBe('default');
      expect(result.extension).toBe('ts');
    });

    test('should parse Python file without handler', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: 'lambda/main.py',
        codeType: 'WORKLOAD',
        workingDir: '/service'
      });

      expect(result.filePath).toBe('/service/lambda/main.py');
      expect(result.handler).toBe('main');
      expect(result.extension).toBe('py');
    });

    test('should parse Python file with explicit handler', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: 'script.py:custom_handler',
        codeType: 'HOOK',
        workingDir: '/hooks'
      });

      expect(result.filePath).toBe('/hooks/script.py');
      expect(result.handler).toBe('custom_handler');
      expect(result.hasExplicitHandler).toBe(true);
    });

    test('should handle absolute path', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: '/absolute/path/to/file.js',
        codeType: 'DIRECTIVE',
        workingDir: '/project'
      });

      expect(result.filePath).toBe('/absolute/path/to/file.js');
    });

    test('should handle absolute path with handler', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: '/absolute/handler.ts:processEvent',
        codeType: 'WORKLOAD',
        workingDir: '/app'
      });

      expect(result.filePath).toBe('/absolute/handler.ts');
      expect(result.handler).toBe('processEvent');
    });

    test('should handle Windows-style path with drive letter', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: 'C:/project/src/handler.js:myHandler',
        codeType: 'DIRECTIVE',
        workingDir: '/project'
      });

      expect(result.filePath).toBe('C:/project/src/handler.js');
      expect(result.handler).toBe('myHandler');
    });

    test('should handle path with multiple colons (Windows)', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: 'C:/Users/name/code/handler.ts:process',
        codeType: 'HOOK',
        workingDir: '/app'
      });

      expect(result.filePath).toBe('C:/Users/name/code/handler.ts');
      expect(result.handler).toBe('process');
    });

    test('should use default handler for JS files', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: 'index.js',
        codeType: 'DIRECTIVE',
        workingDir: '/src'
      });

      expect(result.handler).toBe('default');
      expect(result.hasExplicitHandler).toBe(false);
    });

    test('should use default handler for TS files', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: 'index.ts',
        codeType: 'DIRECTIVE',
        workingDir: '/src'
      });

      expect(result.handler).toBe('default');
    });

    test('should use main handler for Python files', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: 'app.py',
        codeType: 'WORKLOAD',
        workingDir: '/lambda'
      });

      expect(result.handler).toBe('main');
    });

    test('should throw error for non-existent file', async () => {
      mock.module('./file-loaders', () => ({
        isFile: mock(() => false)
      }));

      const { parseUserCodeFilepath } = await import('./user-code-processing');

      expect(() =>
        parseUserCodeFilepath({
          fullPath: 'missing.js',
          codeType: 'DIRECTIVE',
          workingDir: '/project'
        })
      ).toThrow();
    });

    test('should handle nested directory paths', async () => {
      mock.module('./file-loaders', () => ({
        isFile: mock(() => true)
      }));

      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result = parseUserCodeFilepath({
        fullPath: 'src/utils/helpers/format.js',
        codeType: 'DIRECTIVE',
        workingDir: '/app'
      });

      expect(result.filePath).toBe('/app/src/utils/helpers/format.js');
    });

    test('should extract correct extension from file path', async () => {
      const { parseUserCodeFilepath } = await import('./user-code-processing');

      const result1 = parseUserCodeFilepath({
        fullPath: 'handler.js',
        codeType: 'DIRECTIVE',
        workingDir: '/app'
      });

      const result2 = parseUserCodeFilepath({
        fullPath: 'handler.ts',
        codeType: 'DIRECTIVE',
        workingDir: '/app'
      });

      const result3 = parseUserCodeFilepath({
        fullPath: 'handler.py',
        codeType: 'DIRECTIVE',
        workingDir: '/app'
      });

      expect(result1.extension).toBe('js');
      expect(result2.extension).toBe('ts');
      expect(result3.extension).toBe('py');
    });
  });

  describe('getUserCodeAsFn', () => {
    test('should load JavaScript function', async () => {
      const { getUserCodeAsFn } = await import('./user-code-processing');

      const fn = getUserCodeAsFn({
        filePath: 'handler.js',
        cache: false,
        codeType: 'DIRECTIVE',
        workingDir: '/project'
      });

      expect(typeof fn).toBe('function');
    });

    test('should load TypeScript function', async () => {
      const { getUserCodeAsFn } = await import('./user-code-processing');

      const fn = getUserCodeAsFn({
        filePath: 'processor.ts',
        cache: true,
        codeType: 'WORKLOAD',
        workingDir: '/app'
      });

      expect(typeof fn).toBe('function');
    });

    test('should load Python function', async () => {
      const { getUserCodeAsFn } = await import('./user-code-processing');

      const fn = getUserCodeAsFn({
        filePath: 'script.py',
        cache: false,
        codeType: 'HOOK',
        workingDir: '/hooks'
      });

      expect(typeof fn).toBe('function');
    });

    test('should load function with explicit handler', async () => {
      const { getUserCodeAsFn } = await import('./user-code-processing');

      const fn = getUserCodeAsFn({
        filePath: 'handler.js:customHandler',
        cache: false,
        codeType: 'DIRECTIVE',
        workingDir: '/app'
      });

      expect(typeof fn).toBe('function');
    });

    test('should throw UserCodeError if export not found', async () => {
      mock.module('./file-loaders', () => ({
        isFile: mock(() => true),
        getJavascriptExport: mock(() => null)
      }));

      const { getUserCodeAsFn } = await import('./user-code-processing');

      expect(() =>
        getUserCodeAsFn({
          filePath: 'handler.js',
          cache: false,
          codeType: 'DIRECTIVE',
          workingDir: '/app'
        })
      ).toThrow();
    });

    test('should throw UserCodeError on load failure', async () => {
      mock.module('./file-loaders', () => ({
        isFile: mock(() => true),
        getJavascriptExport: mock(() => {
          throw new Error('Load failed');
        })
      }));

      const { getUserCodeAsFn } = await import('./user-code-processing');

      expect(() =>
        getUserCodeAsFn({
          filePath: 'broken.js',
          cache: false,
          codeType: 'DIRECTIVE',
          workingDir: '/app'
        })
      ).toThrow();
    });

    test('should return async function wrapper', async () => {
      mock.module('./file-loaders', () => ({
        isFile: mock(() => true),
        getJavascriptExport: mock(() => () => 'result')
      }));

      const { getUserCodeAsFn } = await import('./user-code-processing');

      const fn = getUserCodeAsFn({
        filePath: 'handler.js',
        cache: false,
        codeType: 'DIRECTIVE',
        workingDir: '/app'
      });

      const result = await fn();

      expect(result).toBe('result');
    });

    test('should pass cache parameter to loader', async () => {
      const mockGetJsExport = mock(() => () => 'cached');
      mock.module('./file-loaders', () => ({
        isFile: mock(() => true),
        getJavascriptExport: mockGetJsExport
      }));

      const { getUserCodeAsFn } = await import('./user-code-processing');

      getUserCodeAsFn({
        filePath: 'handler.js',
        cache: true,
        codeType: 'DIRECTIVE',
        workingDir: '/app'
      });

      expect(mockGetJsExport).toHaveBeenCalled();
    });

    test('should handle TypeScript with cache enabled', async () => {
      const mockGetTsExport = mock(() => () => 'ts result');
      mock.module('./file-loaders', () => ({
        isFile: mock(() => true),
        getTypescriptExport: mockGetTsExport
      }));

      const { getUserCodeAsFn } = await import('./user-code-processing');

      const fn = getUserCodeAsFn({
        filePath: 'handler.ts',
        cache: true,
        codeType: 'WORKLOAD',
        workingDir: '/app'
      });

      expect(typeof fn).toBe('function');
      expect(mockGetTsExport).toHaveBeenCalled();
    });

    test('should wrap user code errors with context', async () => {
      mock.module('./file-loaders', () => ({
        isFile: mock(() => true),
        getJavascriptExport: mock(() => () => {
          throw new Error('User code failed');
        })
      }));

      const { getUserCodeAsFn } = await import('./user-code-processing');

      const fn = getUserCodeAsFn({
        filePath: 'handler.js',
        cache: false,
        codeType: 'DIRECTIVE',
        workingDir: '/app'
      });

      await expect(fn()).rejects.toThrow();
    });
  });
});
