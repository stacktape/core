import { describe, expect, mock, test } from 'bun:test';

mock.module('@shared/utils/fs-utils', () => ({
  getFileSize: mock(async () => 8),
  getFolderSize: mock(async () => 20)
}));

mock.module('@shared/utils/misc', () => ({
  getError: mock((opts) => new Error(opts.message))
}));

mock.module('@shared/utils/zip', () => ({
  archiveItem: mock(async () => '/dist.zip')
}));

mock.module('fs-extra', () => ({
  rename: mock(async () => {}),
  move: mock(async () => {})
}));

mock.module('./bundlers/go', () => ({
  buildGoArtifact: mock(async () => ({
    digest: 'go-digest',
    outcome: 'bundled',
    distFolderPath: '/dist',
    sourceFiles: []
  }))
}));

describe('stacktape-go-lambda-buildpack', () => {
  describe('buildUsingStacktapeGoLambdaBuildpack', () => {
    test('should build Go Lambda package', async () => {
      const { buildUsingStacktapeGoLambdaBuildpack } = await import('./stacktape-go-lambda-buildpack');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingStacktapeGoLambdaBuildpack({
        name: 'my-go-function',
        progressLogger: mockProgressLogger,
        sizeLimit: 250,
        zippedSizeLimit: 50,
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        rawEntryfilePath: 'main.go',
        additionalDigestInput: '',
        requiresGlibcBinaries: false
      });

      expect(result).toBeDefined();
    });
  });
});
