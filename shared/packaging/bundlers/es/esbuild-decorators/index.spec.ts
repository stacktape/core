import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/fs-utils', () => ({
  dynamicRequireLibraryFromUserNodeModules: mock(() => ({
    transpileModule: mock(() => ({ outputText: 'compiled code' })),
    findConfigFile: mock(() => 'tsconfig.json'),
    sys: {},
    parseConfigFileTextToJson: mock(() => ({ config: {} })),
    parseJsonConfigFileContent: mock(() => ({ options: { emitDecoratorMetadata: true } }))
  }))
}));

mock.module('@shared/utils/misc', () => ({
  getError: mock((opts) => new Error(opts.message))
}));

mock.module('fs-extra', () => ({
  readFile: mock(async () => '@Injectable() class Test {}')
}));

mock.module('./strip-it', () => ({
  strip: mock((content) => content)
}));

describe('bundlers/es/esbuild-decorators/index', () => {
  describe('esbuildDecorators', () => {
    test('should create esbuild plugin', async () => {
      const { esbuildDecorators } = await import('./index');

      const plugin = esbuildDecorators();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('emit-decorator-metadata');
      expect(plugin.setup).toBeDefined();
    });

    test('should use provided tsconfig path', async () => {
      const { esbuildDecorators } = await import('./index');

      const plugin = esbuildDecorators({
        tsconfig: '/custom/tsconfig.json'
      });

      expect(plugin).toBeDefined();
    });

    test('should use provided cwd', async () => {
      const { esbuildDecorators } = await import('./index');

      const plugin = esbuildDecorators({
        cwd: '/custom/cwd'
      });

      expect(plugin).toBeDefined();
    });

    test('should support force option', async () => {
      const { esbuildDecorators } = await import('./index');

      const plugin = esbuildDecorators({
        force: true
      });

      expect(plugin).toBeDefined();
    });

    test('should support tsx option', async () => {
      const { esbuildDecorators } = await import('./index');

      const plugin = esbuildDecorators({
        tsx: false
      });

      expect(plugin).toBeDefined();
    });

    test('should throw error when typescript not installed', async () => {
      const { dynamicRequireLibraryFromUserNodeModules } = await import('@shared/utils/fs-utils');
      dynamicRequireLibraryFromUserNodeModules.mockImplementationOnce(() => {
        throw new Error('Module not found');
      });

      const { esbuildDecorators } = await import('./index');

      const plugin = esbuildDecorators();
      const mockBuild: any = {
        initialOptions: {},
        onLoad: mock(() => {})
      };

      expect(() => plugin.setup(mockBuild)).toThrow();
    });
  });
});
