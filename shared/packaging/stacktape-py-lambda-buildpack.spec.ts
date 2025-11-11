import { describe, expect, mock, test } from 'bun:test';

mock.module('@shared/utils/fs-utils', () => ({
  getFileSize: mock(async () => 6),
  getFolderSize: mock(async () => 18)
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

mock.module('./bundlers/py', () => ({
  buildPythonArtifact: mock(async () => ({
    digest: 'py-digest',
    outcome: 'bundled',
    distFolderPath: '/dist',
    sourceFiles: []
  }))
}));

describe('stacktape-py-lambda-buildpack', () => {
  describe('buildUsingStacktapePyLambdaBuildpack', () => {
    test('should build Python Lambda package', async () => {
      const { buildUsingStacktapePyLambdaBuildpack } = await import('./stacktape-py-lambda-buildpack');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingStacktapePyLambdaBuildpack({
        name: 'my-py-function',
        progressLogger: mockProgressLogger,
        sizeLimit: 250,
        zippedSizeLimit: 50,
        pythonVersion: '3.11',
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        rawEntryfilePath: 'main.py',
        additionalDigestInput: '',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false
      });

      expect(result).toBeDefined();
    });
  });
});
