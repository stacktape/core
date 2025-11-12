import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {
      currentWorkingDirectory: '/test/project',
      configPath: null
    },
    persistedState: {
      otherDefaults: {
        executablePython: null
      }
    }
  }
}));

mock.module('@config', () => ({
  VALID_CONFIG_PATHS: ['stacktape.ts', 'stacktape.yml', 'stacktape.yaml', 'stacktape.json']
}));

mock.module('@errors', () => ({
  stpErrors: {
    e14: mock(() => new Error('Config file not found')),
    e15: mock(() => new Error('Multiple config files found'))
  }
}));

mock.module('@shared/utils/bin-executable', () => ({
  checkExecutableInPath: mock((name) => name === 'python3')
}));

mock.module('@shared/utils/fs-utils', () => ({
  dynamicRequire: mock(({ filePath }) => ({ default: { test: 'data' } })),
  getBaseName: mock((path) => path.split('/').pop()),
  getFileContent: mock(async (path) => 'file content'),
  getIniFileContent: mock(async (path) => ({ section: { key: 'value' } })),
  isFileAccessible: mock(() => true)
}));

mock.module('@shared/utils/yaml', () => ({
  parseYaml: mock((content) => ({ parsed: 'yaml' }))
}));

mock.module('@utils/dotenv', () => ({
  parseDotenv: mock((content) => ({ KEY: 'value' }))
}));

mock.module('@utils/errors', () => ({
  ExpectedError: class ExpectedError extends Error {
    code: string;
    constructor(code: string, message: string, hint?: string) {
      super(message);
      this.code = code;
      this.name = 'ExpectedError';
    }
  }
}));

mock.module('@utils/python-bridge', () => ({
  pythonBridge: mock(() => ({
    ex: async (strings, ...values) => {},
    then: async (strings, ...values) => 'python result',
    kill: mock(() => {})
  }))
}));

mock.module('esbuild-register/dist/node', () => ({
  register: mock(() => {})
}));

mock.module('fs-extra', () => ({
  default: {
    readJson: mock(async () => ({ json: 'data' }))
  },
  lstatSync: mock((path) => ({
    isFile: () => !path.includes('directory')
  })),
  readdirSync: mock(() => ['stacktape.ts', 'package.json', 'README.md']),
  readFileSync: mock(() => 'def main():\n  return "test"')
}));

mock.module('./printer', () => ({
  printer: {
    prettyFilePath: mock((path) => path),
    prettyOption: mock((opt) => opt)
  }
}));

mock.module('./user-code-processing', () => ({
  parseUserCodeFilepath: mock(({ fullPath }) => ({
    filePath: fullPath,
    handler: 'default',
    extension: fullPath.split('.').pop()
  }))
}));

describe('file-loaders', () => {
  describe('isFile', () => {
    test('should return true for files', async () => {
      const { isFile } = await import('./file-loaders');
      expect(isFile('/path/to/file.ts')).toBe(true);
    });

    test('should return false for directories', async () => {
      const { isFile } = await import('./file-loaders');
      expect(isFile('/path/to/directory')).toBe(false);
    });

    test('should return false for non-existent paths', async () => {
      mock.module('fs-extra', () => ({
        lstatSync: mock(() => {
          throw new Error('ENOENT');
        })
      }));

      const { isFile } = await import('./file-loaders');
      expect(isFile('/non/existent/path')).toBe(false);
    });
  });

  describe('loadFromJson', () => {
    test('should load JSON file', async () => {
      const { loadFromJson } = await import('./file-loaders');
      const result = await loadFromJson('/path/to/file.json');
      expect(result).toEqual({ json: 'data' });
    });
  });

  describe('loadFromYaml', () => {
    test('should load and parse YAML file', async () => {
      const { loadFromYaml } = await import('./file-loaders');
      const result = await loadFromYaml('/path/to/file.yaml');
      expect(result).toEqual({ parsed: 'yaml' });
    });
  });

  describe('loadFromDotenv', () => {
    test('should load and parse dotenv file', async () => {
      const { loadFromDotenv } = await import('./file-loaders');
      const result = await loadFromDotenv('/path/to/.env');
      expect(result).toEqual({ KEY: 'value' });
    });
  });

  describe('loadFromIni', () => {
    test('should load INI file', async () => {
      const { loadFromIni } = await import('./file-loaders');
      const result = await loadFromIni('/path/to/config.ini');
      expect(result).toEqual({ section: { key: 'value' } });
    });
  });

  describe('getPythonExecutable', () => {
    test('should return python3 when available', async () => {
      const { getPythonExecutable } = await import('./file-loaders');
      const result = getPythonExecutable();
      expect(result).toBe('python3');
    });

    test('should throw when no python executable found', async () => {
      mock.module('@shared/utils/bin-executable', () => ({
        checkExecutableInPath: mock(() => false)
      }));

      const { getPythonExecutable } = await import('./file-loaders');
      expect(() => getPythonExecutable()).toThrow('Python executable is missing');
    });

    test('should use persisted python executable if available', async () => {
      mock.module('@application-services/global-state-manager', () => ({
        globalStateManager: {
          persistedState: {
            otherDefaults: {
              executablePython: 'python3.9'
            }
          }
        }
      }));

      const { getPythonExecutable } = await import('./file-loaders');
      const result = getPythonExecutable();
      expect(result).toBe('python3.9');
    });
  });

  describe('getIsConfigPotentiallyUsable', () => {
    test('should return true when configPath is provided', async () => {
      mock.module('@application-services/global-state-manager', () => ({
        globalStateManager: {
          args: {
            configPath: 'stacktape.ts',
            currentWorkingDirectory: '/test'
          }
        }
      }));

      const { getIsConfigPotentiallyUsable } = await import('./file-loaders');
      expect(getIsConfigPotentiallyUsable()).toBe(true);
    });

    test('should return true when config files exist', async () => {
      const { getIsConfigPotentiallyUsable } = await import('./file-loaders');
      expect(getIsConfigPotentiallyUsable()).toBe(true);
    });

    test('should return false when no config available', async () => {
      mock.module('fs-extra', () => ({
        readdirSync: mock(() => ['package.json', 'README.md'])
      }));

      const { getIsConfigPotentiallyUsable } = await import('./file-loaders');
      expect(getIsConfigPotentiallyUsable()).toBe(false);
    });
  });

  describe('getConfigPath', () => {
    test('should return provided configPath', async () => {
      mock.module('@application-services/global-state-manager', () => ({
        globalStateManager: {
          args: {
            configPath: 'stacktape.ts',
            currentWorkingDirectory: '/test'
          }
        }
      }));

      const { getConfigPath } = await import('./file-loaders');
      const result = getConfigPath();
      expect(result).toContain('stacktape.ts');
    });

    test('should find config in directory', async () => {
      mock.module('@application-services/global-state-manager', () => ({
        globalStateManager: {
          args: {
            configPath: null,
            currentWorkingDirectory: '/test'
          }
        }
      }));

      const { getConfigPath } = await import('./file-loaders');
      const result = getConfigPath();
      expect(result).toContain('stacktape.ts');
    });

    test('should throw when config file not accessible', async () => {
      mock.module('@application-services/global-state-manager', () => ({
        globalStateManager: {
          args: {
            configPath: 'missing.ts',
            currentWorkingDirectory: '/test'
          }
        }
      }));

      mock.module('@shared/utils/fs-utils', () => ({
        isFileAccessible: mock(() => false)
      }));

      const { getConfigPath } = await import('./file-loaders');
      expect(() => getConfigPath()).toThrow();
    });
  });

  describe('activateTypescriptResolving', () => {
    test('should register esbuild only once', async () => {
      const { register } = await import('esbuild-register/dist/node');
      const { activateTypescriptResolving } = await import('./file-loaders');

      activateTypescriptResolving();
      activateTypescriptResolving();
      activateTypescriptResolving();

      expect(register).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTypescriptExport', () => {
    test('should load TypeScript export', async () => {
      const { getTypescriptExport } = await import('./file-loaders');
      const result = getTypescriptExport({
        filePath: '/path/to/file.ts',
        exportName: 'default',
        cache: true
      });
      expect(result).toEqual({ test: 'data' });
    });

    test('should activate TypeScript resolving', async () => {
      const { register } = await import('esbuild-register/dist/node');
      const { getTypescriptExport } = await import('./file-loaders');

      getTypescriptExport({
        filePath: '/path/to/file.ts',
        exportName: 'default',
        cache: true
      });

      expect(register).toHaveBeenCalled();
    });
  });

  describe('getJavascriptExport', () => {
    test('should load JavaScript export', async () => {
      const { getJavascriptExport } = await import('./file-loaders');
      const result = getJavascriptExport({
        filePath: '/path/to/file.js',
        exportName: 'default',
        cache: true
      });
      expect(result).toEqual({ test: 'data' });
    });

    test('should return full module when no exportName', async () => {
      const { getJavascriptExport } = await import('./file-loaders');
      const result = getJavascriptExport({
        filePath: '/path/to/file.js',
        cache: true,
        exportName: undefined
      });
      expect(result).toBeDefined();
    });
  });

  describe('loadFromTypescript', () => {
    test('should load TypeScript file', async () => {
      const { loadFromTypescript } = await import('./file-loaders');
      const result = await loadFromTypescript({
        filePath: '/path/to/file.ts',
        exportName: 'default'
      });
      expect(result).toEqual({ test: 'data' });
    });
  });

  describe('loadFromJavascript', () => {
    test('should load JavaScript file', async () => {
      const { loadFromJavascript } = await import('./file-loaders');
      const result = await loadFromJavascript({
        filePath: '/path/to/file.js',
        exportName: 'default'
      });
      expect(result).toEqual({ test: 'data' });
    });
  });

  describe('loadRawFileContent', () => {
    test('should load raw file content', async () => {
      const { loadRawFileContent } = await import('./file-loaders');
      const result = await loadRawFileContent({
        workingDir: '/test',
        filePath: 'file.txt'
      });
      expect(result).toBe('file content');
    });

    test('should handle absolute paths', async () => {
      const { loadRawFileContent } = await import('./file-loaders');
      const result = await loadRawFileContent({
        workingDir: '/test',
        filePath: '/absolute/path/file.txt'
      });
      expect(result).toBe('file content');
    });

    test('should throw when file does not exist', async () => {
      mock.module('fs-extra', () => ({
        lstatSync: mock(() => {
          throw new Error('ENOENT');
        })
      }));

      const { loadRawFileContent } = await import('./file-loaders');
      await expect(
        loadRawFileContent({
          workingDir: '/test',
          filePath: 'missing.txt'
        })
      ).rejects.toThrow();
    });
  });
});
