import { describe, expect, mock, test } from 'bun:test';

mock.module('@shared/utils/docker', () => ({
  getDockerImageDetails: mock(async () => ({
    size: 150,
    imageId: 'sha256:abc123'
  }))
}));

mock.module('./bundlers/es', () => ({
  createEsBundle: mock(async () => ({
    digest: 'es-image-digest',
    outcome: 'bundled',
    distFolderPath: '/dist',
    sourceFiles: [],
    languageSpecificBundleOutput: {}
  }))
}));

describe('stacktape-es-image-buildpack', () => {
  describe('buildUsingStacktapeEsImageBuildpack', () => {
    test('should build ES Docker image', async () => {
      const { buildUsingStacktapeEsImageBuildpack } = await import('./stacktape-es-image-buildpack');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingStacktapeEsImageBuildpack({
        name: 'my-es-image',
        progressLogger: mockProgressLogger,
        nodeTarget: '18',
        minify: true,
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        rawEntryfilePath: 'index.ts',
        additionalDigestInput: ''
      });

      expect(result).toBeDefined();
      expect(result.outcome).toBe('bundled');
    });

    test('should handle skipped outcome', async () => {
      const { buildUsingStacktapeEsImageBuildpack } = await import('./stacktape-es-image-buildpack');
      const { createEsBundle } = await import('./bundlers/es');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      createEsBundle.mockResolvedValueOnce({
        digest: 'es-image-digest',
        outcome: 'skipped',
        distFolderPath: '/dist',
        sourceFiles: []
      });

      const result = await buildUsingStacktapeEsImageBuildpack({
        name: 'my-es-image',
        progressLogger: mockProgressLogger,
        nodeTarget: '18',
        minify: true,
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: ['es-image-digest'],
        rawEntryfilePath: 'index.ts',
        additionalDigestInput: ''
      });

      expect(result.outcome).toBe('skipped');
    });
  });
});
