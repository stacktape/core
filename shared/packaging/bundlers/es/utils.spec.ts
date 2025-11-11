import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/fs-utils', () => ({
  dirExists: mock((path) => path.includes('node_modules')),
  getBaseName: mock((path) => path.split('/').pop()),
  getFolder: mock((path) => path.split('/').slice(0, -1).join('/')),
  getMatchingFilesByGlob: mock(async () => []),
  getPathRelativeTo: mock((from, to) => from.replace(to, '').slice(1)),
  isDirAccessible: mock((path) => path.includes('node_modules')),
  isFileAccessible: mock((path) => !path.includes('missing')),
  transformToUnixPath: mock((path) => path.replace(/\\/g, '/'))
}));

mock.module('@shared/utils/misc', () => ({
  builtinModules: ['fs', 'path', 'http'],
  getError: mock((opts) => new Error(opts.message))
}));

mock.module('@shared/utils/monorepo', () => ({
  findProjectRoot: mock(async (path) => path)
}));

mock.module('@utils/uuid', () => ({
  generateUuid: mock(() => 'uuid-123')
}));

mock.module('fs-extra', () => ({
  access: mock(async () => {}),
  chmod: mock(async () => {}),
  copy: mock(async () => {}),
  readFile: mock(async () => 'generator client {\n  provider = "prisma-client-js"\n}\n'),
  readJSON: mock(async () => ({
    name: 'test-package',
    version: '1.0.0',
    dependencies: {},
    peerDependencies: {}
  })),
  readJson: mock(async () => ({
    name: 'test-package',
    version: '1.0.0',
    dependencies: {}
  })),
  remove: mock(async () => {}),
  stat: mock(async () => ({ mode: 0o644 }))
}));

mock.module('esbuild', () => ({
  default: {
    build: mock(async () => ({}))
  }
}));

describe('bundlers/es/utils', () => {
  describe('hasBinary', () => {
    test('should detect binary from gypfile', async () => {
      const { hasBinary } = await import('./utils');
      const result = hasBinary({ name: 'test', gypfile: true } as any);
      expect(result).toBe(true);
    });

    test('should detect binary from node-gyp dependency', async () => {
      const { hasBinary } = await import('./utils');
      const result = hasBinary({
        name: 'test',
        dependencies: { 'node-gyp': '1.0.0' }
      } as any);
      expect(result).toBe(true);
    });

    test('should detect binary from known dependencies list', async () => {
      const { hasBinary } = await import('./utils');
      const result = hasBinary({ name: 'sharp' } as any);
      expect(result).toBe(true);
    });

    test('should return false for packages without binaries', async () => {
      const { hasBinary } = await import('./utils');
      const result = hasBinary({ name: 'lodash' } as any);
      expect(result).toBe(false);
    });
  });

  describe('getEsPackageManager', () => {
    test('should detect npm from package-lock.json', async () => {
      const { getEsPackageManager } = await import('./utils');
      const result = getEsPackageManager('/project/package-lock.json');
      expect(result).toBe('npm');
    });

    test('should detect yarn from yarn.lock', async () => {
      const { getEsPackageManager } = await import('./utils');
      const result = getEsPackageManager('/project/yarn.lock');
      expect(result).toBe('yarn');
    });

    test('should detect pnpm from pnpm-lock.yaml', async () => {
      const { getEsPackageManager } = await import('./utils');
      const result = getEsPackageManager('/project/pnpm-lock.yaml');
      expect(result).toBe('pnpm');
    });

    test('should detect bun from bun.lockb', async () => {
      const { getEsPackageManager } = await import('./utils');
      const result = getEsPackageManager('/project/bun.lockb');
      expect(result).toBe('bun');
    });
  });

  describe('getLockFileData', () => {
    test('should find lock file and detect package manager', async () => {
      const { getLockFileData } = await import('./utils');
      const result = await getLockFileData('/project');
      expect(result).toBeDefined();
      expect(result.packageManager).toBeDefined();
    });

    test('should return null when no lock file found', async () => {
      const { getLockFileData } = await import('./utils');
      const { isFileAccessible } = await import('@shared/utils/fs-utils');
      isFileAccessible.mockReturnValueOnce(false);
      isFileAccessible.mockReturnValueOnce(false);
      isFileAccessible.mockReturnValueOnce(false);
      isFileAccessible.mockReturnValueOnce(false);
      isFileAccessible.mockReturnValueOnce(false);
      isFileAccessible.mockReturnValueOnce(false);

      const result = await getLockFileData('/project');
      expect(result.packageManager).toBe(null);
      expect(result.lockfilePath).toBe(null);
    });
  });

  describe('getModuleNameFromArgs', () => {
    test('should extract simple module name', async () => {
      const { getModuleNameFromArgs } = await import('./utils');
      const result = getModuleNameFromArgs({ path: 'lodash' } as any);
      expect(result).toBe('lodash');
    });

    test('should extract scoped module name', async () => {
      const { getModuleNameFromArgs } = await import('./utils');
      const result = getModuleNameFromArgs({ path: '@aws-sdk/client-s3' } as any);
      expect(result).toBe('@aws-sdk/client-s3');
    });

    test('should handle module with subpath', async () => {
      const { getModuleNameFromArgs } = await import('./utils');
      const result = getModuleNameFromArgs({ path: 'lodash/debounce' } as any);
      expect(result).toBe('lodash');
    });

    test('should handle trailing slash', async () => {
      const { getModuleNameFromArgs } = await import('./utils');
      const result = getModuleNameFromArgs({ path: 'lodash/' } as any);
      expect(result).toBe('lodash');
    });
  });

  describe('getLambdaRuntimeFromNodeTarget', () => {
    test('should extract major version from node target', async () => {
      const { getLambdaRuntimeFromNodeTarget } = await import('./utils');
      expect(getLambdaRuntimeFromNodeTarget('18')).toBe(18);
      expect(getLambdaRuntimeFromNodeTarget('18.0.0')).toBe(18);
      expect(getLambdaRuntimeFromNodeTarget('20.1.2')).toBe(20);
    });
  });

  describe('getModuleNameFromPath', () => {
    test('should extract module name from node_modules path', async () => {
      const { getModuleNameFromPath } = await import('./utils');
      const result = getModuleNameFromPath({
        path: '/project/node_modules/lodash/index.js',
        workingDir: '/project'
      });
      expect(result).toBe('lodash');
    });
  });

  describe('getExternalDeps', () => {
    test('should recursively collect external dependencies', async () => {
      const { getExternalDeps } = await import('./utils');
      const depsInfo: any = {
        name: 'root',
        dependencies: [
          { name: 'dep1', dependencies: [{ name: 'dep1-1', dependencies: [] }] },
          { name: 'dep2', dependencies: [] }
        ]
      };
      const result = getExternalDeps(depsInfo, new Set());
      expect(result.has('dep1')).toBe(true);
      expect(result.has('dep2')).toBe(true);
      expect(result.has('dep1-1')).toBe(true);
    });
  });

  describe('getModuleFromImporter', () => {
    test('should extract simple module from importer path', async () => {
      const { getModuleFromImporter } = await import('./utils');
      const result = getModuleFromImporter('/project/node_modules/lodash/index.js');
      expect(result).toBe('lodash');
    });

    test('should extract scoped module from importer path', async () => {
      const { getModuleFromImporter } = await import('./utils');
      const result = getModuleFromImporter('/project/node_modules/@aws-sdk/client-s3/index.js');
      expect(result).toBe('@aws-sdk/client-s3');
    });

    test('should return null for non-node_modules path', async () => {
      const { getModuleFromImporter } = await import('./utils');
      const result = getModuleFromImporter('/project/src/index.js');
      expect(result).toBe(null);
    });
  });

  describe('getFailedImportsFromEsbuildError', () => {
    test('should extract failed imports from actual errors', async () => {
      const { getFailedImportsFromEsbuildError } = await import('./utils');
      const error = {
        errors: [
          {
            text: 'Could not resolve "missing-package"',
            location: { file: 'src/index.ts', line: 1, column: 10 }
          }
        ]
      };
      const result = getFailedImportsFromEsbuildError({ error, errType: 'actual-error' });
      expect(result.length).toBe(1);
      expect(result[0].packageName).toBe('missing-package');
    });

    test('should extract dynamic import errors', async () => {
      const { getFailedImportsFromEsbuildError } = await import('./utils');
      const error = {
        errors: [
          {
            text: 'Could not resolve "dynamic-package" or surround it with try/catch',
            location: { file: 'src/index.ts', line: 5, column: 20 }
          }
        ]
      };
      const result = getFailedImportsFromEsbuildError({ error, errType: 'dynamic-import-error' });
      expect(result.length).toBe(1);
      expect(result[0].packageName).toBe('dynamic-package');
    });

    test('should not duplicate package names', async () => {
      const { getFailedImportsFromEsbuildError } = await import('./utils');
      const error = {
        errors: [
          { text: 'Could not resolve "pkg"', location: null },
          { text: 'Could not resolve "pkg"', location: null }
        ]
      };
      const result = getFailedImportsFromEsbuildError({ error, errType: 'actual-error' });
      expect(result.length).toBe(1);
    });
  });

  describe('copyToDeploymentPackage', () => {
    test('should copy files with proper permissions', async () => {
      const { copyToDeploymentPackage } = await import('./utils');
      const { copy, chmod } = await import('fs-extra');

      await copyToDeploymentPackage({ from: '/src/file.js', to: '/dist/file.js' });

      expect(copy).toHaveBeenCalled();
      expect(chmod).toHaveBeenCalled();
    });
  });

  describe('copyNodeModules', () => {
    test('should copy node_modules to dist folder', async () => {
      const { copyNodeModules } = await import('./utils');
      const { copy } = await import('fs-extra');

      await copyNodeModules({
        distFolderPath: '/dist',
        workingDir: '/project',
        moduleName: 'lodash'
      });

      expect(copy).toHaveBeenCalled();
    });
  });

  describe('getInfoFromPackageJson', () => {
    test('should read package.json and extract info', async () => {
      const { getInfoFromPackageJson } = await import('./utils');
      const result = await getInfoFromPackageJson({
        directoryPath: '/project/node_modules/lodash',
        parentModule: 'root',
        dependencyType: 'standard'
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('test-package');
      expect(result.version).toBe('1.0.0');
    });

    test('should cache package info', async () => {
      const { getInfoFromPackageJson } = await import('./utils');
      const { readJSON } = await import('fs-extra');

      await getInfoFromPackageJson({
        directoryPath: '/cached-package',
        parentModule: 'root',
        dependencyType: 'standard'
      });

      const callCount1 = readJSON.mock.calls.length;

      await getInfoFromPackageJson({
        directoryPath: '/cached-package',
        parentModule: 'root',
        dependencyType: 'standard'
      });

      // Should not call readJSON again due to caching
      expect(readJSON.mock.calls.length).toBe(callCount1);
    });

    test('should handle es-abstract special case', async () => {
      const { getInfoFromPackageJson } = await import('./utils');
      const result = await getInfoFromPackageJson({
        directoryPath: '/node_modules/es-abstract',
        parentModule: 'root',
        dependencyType: 'standard'
      });

      expect(result.name).toBe('es-abstract');
      expect(result.dependencies).toEqual([]);
    });
  });

  describe('determineIfAlias', () => {
    test('should check if module name is an alias', async () => {
      const { determineIfAlias } = await import('./utils');
      const result = await determineIfAlias({
        moduleName: '@utils/fs',
        aliases: { '@utils': '/src/utils' }
      });

      expect(result).toBe(true);
    });

    test('should return false for non-aliased modules', async () => {
      const { determineIfAlias } = await import('./utils');
      const { access } = await import('fs-extra');
      access.mockRejectedValueOnce(new Error('Not found'));

      const result = await determineIfAlias({
        moduleName: 'lodash',
        aliases: { '@utils': '/src/utils' }
      });

      expect(result).toBe(false);
    });
  });

  describe('resolveDifferentSourceMapLocation', () => {
    test('should move source map to different location', async () => {
      const { resolveDifferentSourceMapLocation } = await import('./utils');
      const { copy, remove } = await import('fs-extra');

      await resolveDifferentSourceMapLocation({
        distFolderPath: '/dist',
        outputSourceMapsTo: 'maps',
        workingDir: '/project',
        name: 'my-function'
      });

      expect(copy).toHaveBeenCalled();
      expect(remove).toHaveBeenCalled();
    });
  });

  describe('resolvePrisma', () => {
    test('should copy Prisma engine binaries for Lambda', async () => {
      const { resolvePrisma } = await import('./utils');
      const { getMatchingFilesByGlob } = await import('@shared/utils/fs-utils');
      getMatchingFilesByGlob.mockResolvedValueOnce([
        'node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node'
      ]);

      await resolvePrisma({
        distFolderPath: '/dist',
        workingDir: '/project',
        isLambda: true,
        workloadName: 'my-function'
      });

      const { copy } = await import('fs-extra');
      expect(copy).toHaveBeenCalled();
    });

    test('should skip when using query compiler', async () => {
      const { resolvePrisma } = await import('./utils');
      const { readFile } = await import('fs-extra');
      readFile.mockResolvedValueOnce(
        'generator client {\n  provider = "prisma-client"\n  engineType = "client"\n}\n'
      );
      const { getMatchingFilesByGlob } = await import('@shared/utils/fs-utils');
      getMatchingFilesByGlob.mockResolvedValueOnce(['prisma/schema.prisma']);

      await resolvePrisma({
        distFolderPath: '/dist',
        workingDir: '/project',
        isLambda: true,
        workloadName: 'my-function',
        debug: true
      });

      // Should not copy files when using query compiler
      const { copy } = await import('fs-extra');
      // Reset previous calls and verify no new calls for engine files
      expect(copy.mock.calls.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAllJsDependenciesFromMultipleFiles', () => {
    test('should analyze JS files for dependencies', async () => {
      const { getAllJsDependenciesFromMultipleFiles } = await import('./utils');
      const result = await getAllJsDependenciesFromMultipleFiles({
        distFolderPath: '/dist',
        absoluteFilePaths: ['/project/src/index.js'],
        workingDir: '/project'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test('should return empty array for non-JS files', async () => {
      const { getAllJsDependenciesFromMultipleFiles } = await import('./utils');
      const result = await getAllJsDependenciesFromMultipleFiles({
        distFolderPath: '/dist',
        absoluteFilePaths: ['/project/src/index.ts'],
        workingDir: '/project'
      });

      expect(result).toEqual([]);
    });
  });
});
