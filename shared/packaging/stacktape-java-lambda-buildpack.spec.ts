import { describe, expect, mock, test } from 'bun:test';

mock.module('@shared/utils/fs-utils', () => ({
  getFileSize: mock(async () => 12),
  getFolderSize: mock(async () => 30)
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

mock.module('./bundlers/java', () => ({
  buildJavaArtifact: mock(async () => ({
    digest: 'java-digest',
    outcome: 'bundled',
    distFolderPath: '/dist',
    sourceFiles: []
  }))
}));

describe('stacktape-java-lambda-buildpack', () => {
  describe('buildUsingStacktapeJavaLambdaBuildpack', () => {
    test('should build Java Lambda package', async () => {
      const { buildUsingStacktapeJavaLambdaBuildpack } = await import('./stacktape-java-lambda-buildpack');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingStacktapeJavaLambdaBuildpack({
        name: 'my-java-function',
        progressLogger: mockProgressLogger,
        sizeLimit: 250,
        zippedSizeLimit: 50,
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        rawEntryfilePath: 'Main.java',
        additionalDigestInput: '',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false
      });

      expect(result).toBeDefined();
    });
  });
});
