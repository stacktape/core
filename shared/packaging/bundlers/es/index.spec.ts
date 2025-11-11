import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('esbuild', () => ({
  build: mock(async () => ({
    errors: [],
    warnings: [],
    outputFiles: [],
    metafile: {
      inputs: {
        'src/index.ts': { bytes: 100, imports: [] }
      },
      outputs: {
        'dist/index.js': { bytes: 50, inputs: {} }
      }
    }
  }))
}));

mock.module('fs-extra', () => ({
  copy: mock(async () => {}),
  outputJSON: mock(async () => {}),
  readFile: mock(async () => ''),
  writeJson: mock(async () => {}),
  existsSync: mock(() => true)
}));

mock.module('lodash/uniqWith', () => ({
  default: mock((arr) => arr)
}));

mock.module('object-hash', () => ({
  default: mock(() => 'hash-123')
}));

mock.module('@shared/naming/project-fs-paths', () => ({
  SOURCE_MAP_INSTALL_DIST_PATH: '/source-map-install'
}));

mock.module('@shared/utils/dependency-installer', () => ({
  dependencyInstaller: {
    installDependencies: mock(async () => {})
  }
}));

mock.module('@shared/utils/fs-utils', () => ({
  getFirstExistingPath: mock((paths) => paths[0]),
  getHashFromMultipleFiles: mock(async () => 'file-hash-123'),
  getMatchingFilesByGlob: mock(async () => []),
  getRelativePath: mock((from, to) => 'relative/path'),
  isFileAccessible: mock(() => true),
  transformToUnixPath: mock((path) => path.replace(/\\/g, '/'))
}));

mock.module('@shared/utils/misc', () => ({
  builtinModules: ['fs', 'path', 'http', 'https'],
  filterDuplicates: mock((arr) => [...new Set(arr)]),
  getError: mock((opts) => new Error(opts.message)),
  getTsconfigAliases: mock(async () => ({})),
  raiseError: mock((opts) => {
    throw new Error(opts.message);
  })
}));

mock.module('./config', () => ({
  DEPENDENCIES_TO_EXCLUDE_FROM_BUNDLE: [],
  FILES_TO_INCLUDE_IN_DIGEST: ['package.json', 'package-lock.json'],
  IGNORED_MODULES: [],
  IGNORED_OPTIONAL_PEER_DEPS_FROM_INSTALL_IN_DOCKER: [],
  SPECIAL_TREATMENT_PACKAGES: []
}));

mock.module('./copy-docker-installed-modules', () => ({
  copyDockerInstalledModulesForLambda: mock(async () => {})
}));

mock.module('./esbuild-decorators', () => ({
  esbuildDecorators: mock(() => ({ name: 'decorators', setup: mock(() => {}) }))
}));

mock.module('./utils', () => ({
  determineIfAlias: mock(async () => false),
  getAllJsDependenciesFromMultipleFiles: mock(async () => []),
  getExternalDeps: mock(() => new Set()),
  getFailedImportsFromEsbuildError: mock(() => []),
  getInfoFromPackageJson: mock(async () => ({
    name: 'test-package',
    version: '1.0.0',
    hasBinary: false,
    dependencyType: 'standard',
    dependencies: [],
    peerDependencies: [],
    optionalPeerDependencies: []
  })),
  getLambdaRuntimeFromNodeTarget: mock((version) => Number.parseInt(version)),
  getLockFileData: mock(async () => ({ lockfilePath: '/package-lock.json', packageManager: 'npm' })),
  getModuleNameFromArgs: mock((args) => args.path),
  resolveDifferentSourceMapLocation: mock(async () => {}),
  resolvePrisma: mock(async () => {})
}));

describe('bundlers/es/index', () => {
  describe('buildEsCode', () => {
    test('should build ES code with basic configuration', async () => {
      const { buildEsCode } = await import('./index');

      const result = await buildEsCode({
        sourcePath: '/src/index.ts',
        distPath: '/dist/index.js',
        minify: true,
        externals: [],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        sourceMapBannerType: 'node_modules',
        isLambda: false
      });

      expect(result).toBeDefined();
      expect(result.dependenciesToInstallInDocker).toBeDefined();
      expect(result.externalModules).toBeDefined();
      expect(result.sourceFiles).toBeDefined();
    });

    test('should handle multiple source paths', async () => {
      const { buildEsCode } = await import('./index');

      const result = await buildEsCode({
        sourcePaths: ['/src/index.ts', '/src/server.ts'],
        distDir: '/dist',
        minify: false,
        externals: [],
        sourceMaps: 'disabled',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(result).toBeDefined();
    });

    test('should handle raw code input', async () => {
      const { buildEsCode } = await import('./index');

      const result = await buildEsCode({
        rawCode: 'console.log("Hello World");',
        distPath: '/dist/index.js',
        minify: true,
        externals: [],
        sourceMaps: 'inline',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(result).toBeDefined();
    });

    test('should support ESM output format', async () => {
      const { buildEsCode } = await import('./index');
      const { build } = await import('esbuild');

      await buildEsCode({
        sourcePath: '/src/index.ts',
        distPath: '/dist/index.js',
        minify: false,
        externals: [],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        outputModuleFormat: 'esm',
        splitting: true,
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(build).toHaveBeenCalled();
    });

    test('should support code splitting', async () => {
      const { buildEsCode } = await import('./index');
      const { build } = await import('esbuild');

      await buildEsCode({
        sourcePaths: ['/src/page1.ts', '/src/page2.ts'],
        distDir: '/dist',
        minify: false,
        externals: [],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        outputModuleFormat: 'esm',
        splitting: true,
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(build).toHaveBeenCalled();
    });

    test('should handle decorator metadata emission', async () => {
      const { buildEsCode } = await import('./index');
      const { esbuildDecorators } = await import('./esbuild-decorators');

      await buildEsCode({
        sourcePath: '/src/index.ts',
        distPath: '/dist/index.js',
        minify: false,
        externals: [],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        emitTsDecoratorMetadata: true,
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(esbuildDecorators).toHaveBeenCalled();
    });

    test('should externalize AWS SDK for Lambda runtime 18+', async () => {
      const { buildEsCode } = await import('./index');
      const { build } = await import('esbuild');

      await buildEsCode({
        sourcePath: '/src/index.ts',
        distPath: '/dist/index.js',
        minify: true,
        externals: [],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        nodeTarget: '18',
        isLambda: true,
        sourceMapBannerType: 'disabled'
      });

      expect(build).toHaveBeenCalled();
    });

    test('should handle wildcard external dependencies', async () => {
      const { buildEsCode } = await import('./index');

      const result = await buildEsCode({
        sourcePath: '/src/index.ts',
        distPath: '/dist/index.js',
        minify: false,
        externals: [],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        dependenciesToExcludeFromBundle: ['*'],
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(result).toBeDefined();
    });

    test('should support custom define values', async () => {
      const { buildEsCode } = await import('./index');
      const { build } = await import('esbuild');

      await buildEsCode({
        sourcePath: '/src/index.ts',
        distPath: '/dist/index.js',
        minify: false,
        externals: [],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        define: {
          'process.env.NODE_ENV': '"production"',
          'process.env.API_URL': '"https://api.example.com"'
        },
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(build).toHaveBeenCalled();
    });

    test('should handle keep names option', async () => {
      const { buildEsCode } = await import('./index');
      const { build } = await import('esbuild');

      await buildEsCode({
        sourcePath: '/src/index.ts',
        distPath: '/dist/index.js',
        minify: true,
        externals: [],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        keepNames: true,
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(build).toHaveBeenCalled();
    });

    test('should support custom plugins', async () => {
      const { buildEsCode } = await import('./index');
      const { build } = await import('esbuild');

      const customPlugin = {
        name: 'custom-plugin',
        setup: mock(() => {})
      };

      await buildEsCode({
        sourcePath: '/src/index.ts',
        distPath: '/dist/index.js',
        minify: false,
        externals: [],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        plugins: [customPlugin],
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(build).toHaveBeenCalled();
    });

    test('should handle metafile generation', async () => {
      const { buildEsCode } = await import('./index');
      const { outputJSON } = await import('fs-extra');

      await buildEsCode({
        sourcePath: '/src/index.ts',
        distPath: '/dist/index.js',
        minify: false,
        externals: [],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        metafile: '/dist/meta.json',
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(outputJSON).toHaveBeenCalled();
    });

    test('should handle different legal comments options', async () => {
      const { buildEsCode } = await import('./index');
      const { build } = await import('esbuild');

      await buildEsCode({
        sourcePath: '/src/index.ts',
        distPath: '/dist/index.js',
        minify: true,
        externals: [],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        legalComments: 'inline',
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(build).toHaveBeenCalled();
    });

    test('should support node target version', async () => {
      const { buildEsCode } = await import('./index');
      const { build } = await import('esbuild');

      await buildEsCode({
        sourcePath: '/src/index.ts',
        distPath: '/dist/index.js',
        minify: false,
        externals: [],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        nodeTarget: '20.0.0',
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(build).toHaveBeenCalled();
    });

    test('should handle excluded dependencies', async () => {
      const { buildEsCode } = await import('./index');

      const result = await buildEsCode({
        sourcePath: '/src/index.ts',
        distPath: '/dist/index.js',
        minify: false,
        externals: ['lodash'],
        sourceMaps: 'external',
        tsConfigPath: '/tsconfig.json',
        cwd: '/project',
        excludeDependencies: ['axios', 'express'],
        sourceMapBannerType: 'disabled',
        isLambda: false
      });

      expect(result).toBeDefined();
      expect(result.externalModules).toBeDefined();
    });
  });
});
