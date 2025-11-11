import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/fs-utils', () => ({
  getFileSize: mock(async () => 5),
  getFolderSize: mock(async () => 15)
}));

mock.module('@shared/utils/misc', () => ({
  getError: mock((opts) => new Error(opts.message))
}));

mock.module('@shared/utils/zip', () => ({
  archiveItem: mock(async () => '/dist.zip')
}));

mock.module('fs-extra', () => ({
  rename: mock(async () => {})
}));

mock.module('./bundlers/es', () => ({
  createEsBundle: mock(async () => ({
    digest: 'es-digest',
    outcome: 'bundled',
    distFolderPath: '/dist',
    sourceFiles: [],
    languageSpecificBundleOutput: {}
  }))
}));

describe('stacktape-es-lambda-buildpack', () => {
  describe('buildUsingStacktapeEsLambdaBuildpack', () => {
    test('should build ES Lambda package', async () => {
      const { buildUsingStacktapeEsLambdaBuildpack } = await import('./stacktape-es-lambda-buildpack');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingStacktapeEsLambdaBuildpack({
        name: 'my-function',
        progressLogger: mockProgressLogger,
        sizeLimit: 250,
        zippedSizeLimit: 50,
        nodeTarget: '18',
        minify: true,
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        rawEntryfilePath: 'index.ts',
        additionalDigestInput: ''
      });

      expect(result).toBeDefined();
    });

    test('should handle skipped outcome', async () => {
      const { buildUsingStacktapeEsLambdaBuildpack } = await import('./stacktape-es-lambda-buildpack');
      const { createEsBundle } = await import('./bundlers/es');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      createEsBundle.mockResolvedValueOnce({
        digest: 'es-digest',
        outcome: 'skipped',
        distFolderPath: '/dist',
        sourceFiles: []
      });

      const result = await buildUsingStacktapeEsLambdaBuildpack({
        name: 'my-function',
        progressLogger: mockProgressLogger,
        sizeLimit: 250,
        zippedSizeLimit: 50,
        nodeTarget: '18',
        minify: true,
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        rawEntryfilePath: 'index.ts',
        additionalDigestInput: ''
      });

      expect(result.outcome).toBe('skipped');
    });

    test('should throw error if size exceeds limit', async () => {
      const { buildUsingStacktapeEsLambdaBuildpack } = await import('./stacktape-es-lambda-buildpack');
      const { getFolderSize } = await import('@shared/utils/fs-utils');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      getFolderSize.mockResolvedValueOnce(300);

      await expect(
        buildUsingStacktapeEsLambdaBuildpack({
          name: 'my-function',
          progressLogger: mockProgressLogger,
          sizeLimit: 250,
          zippedSizeLimit: 50,
          nodeTarget: '18',
          minify: true,
          cwd: '/project',
          distFolderPath: '/dist',
          existingDigests: [],
          rawEntryfilePath: 'index.ts',
          additionalDigestInput: ''
        })
      ).rejects.toThrow();
    });
  });
});
