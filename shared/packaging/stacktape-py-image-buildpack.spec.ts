import { describe, expect, mock, test } from 'bun:test';

mock.module('@shared/utils/docker', () => ({
  buildDockerImage: mock(async () => ({
    size: 180,
    dockerOutput: 'Successfully built image',
    duration: 50,
    created: '2024-01-01T00:00:00Z'
  }))
}));

mock.module('@shared/utils/dockerfiles', () => ({
  buildPythonDockerfile: mock(() => 'FROM python:3.11\nWORKDIR /app\nCOPY . .\nRUN pip install -r requirements.txt')
}));

mock.module('@shared/utils/fs-utils', () => ({
  getFolder: mock((path) => path.split('/').slice(0, -1).join('/'))
}));

mock.module('fs-extra', () => ({
  outputFile: mock(async () => {})
}));

mock.module('./bundlers/py', () => ({
  buildPythonArtifact: mock(async () => ({
    digest: 'py-digest-789',
    outcome: 'bundled',
    distFolderPath: '/dist',
    sourceFiles: []
  }))
}));

describe('stacktape-py-image-buildpack', () => {
  describe('buildUsingStacktapePyImageBuildpack', () => {
    test('should build Python Docker image with default Python version', async () => {
      const { buildUsingStacktapePyImageBuildpack } = await import('./stacktape-py-image-buildpack');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingStacktapePyImageBuildpack({
        name: 'my-py-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.py',
        languageSpecificConfig: {},
        cwd: '/project',
        distFolderPath: '/dist',
        requiresGlibcBinaries: false,
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(result).toBeDefined();
      expect(result.outcome).toBe('bundled');
      expect(result.imageName).toBe('my-py-image');
      expect(result.size).toBe(180);
      expect(result.digest).toBe('py-digest-789');
    });

    test('should use specified Python version', async () => {
      const { buildUsingStacktapePyImageBuildpack } = await import('./stacktape-py-image-buildpack');
      const { buildPythonArtifact } = await import('./bundlers/py');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapePyImageBuildpack({
        name: 'my-py-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.py',
        languageSpecificConfig: { pythonVersion: 3.11 },
        cwd: '/project',
        distFolderPath: '/dist',
        requiresGlibcBinaries: false,
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(buildPythonArtifact).toHaveBeenCalledWith(
        expect.objectContaining({ pythonVersion: 3.11 })
      );
    });

    test('should handle skipped outcome', async () => {
      const { buildUsingStacktapePyImageBuildpack } = await import('./stacktape-py-image-buildpack');
      const { buildPythonArtifact } = await import('./bundlers/py');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      buildPythonArtifact.mockResolvedValueOnce({
        digest: 'py-digest-789',
        outcome: 'skipped',
        distFolderPath: '/dist',
        sourceFiles: []
      });

      const result = await buildUsingStacktapePyImageBuildpack({
        name: 'my-py-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.py',
        languageSpecificConfig: {},
        cwd: '/project',
        distFolderPath: '/dist',
        requiresGlibcBinaries: false,
        existingDigests: ['py-digest-789'],
        additionalDigestInput: ''
      } as any);

      expect(result.outcome).toBe('skipped');
      expect(result.size).toBe(null);
    });

    test('should handle handler extraction from entryfile', async () => {
      const { buildUsingStacktapePyImageBuildpack } = await import('./stacktape-py-image-buildpack');
      const { buildPythonDockerfile } = await import('@shared/utils/dockerfiles');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapePyImageBuildpack({
        name: 'my-py-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.py:handler',
        languageSpecificConfig: {},
        cwd: '/project',
        distFolderPath: '/dist',
        requiresGlibcBinaries: false,
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(buildPythonDockerfile).toHaveBeenCalledWith(
        expect.objectContaining({
          entryfilePath: '/project/main.py',
          handler: 'handler'
        })
      );
    });

    test('should support custom package manager', async () => {
      const { buildUsingStacktapePyImageBuildpack } = await import('./stacktape-py-image-buildpack');
      const { buildPythonArtifact } = await import('./bundlers/py');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapePyImageBuildpack({
        name: 'my-py-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.py',
        languageSpecificConfig: { packageManager: 'poetry' },
        cwd: '/project',
        distFolderPath: '/dist',
        requiresGlibcBinaries: false,
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(buildPythonArtifact).toHaveBeenCalledWith(
        expect.objectContaining({ packageManager: 'poetry' })
      );
    });

    test('should use Alpine when glibc not required', async () => {
      const { buildUsingStacktapePyImageBuildpack } = await import('./stacktape-py-image-buildpack');
      const { buildPythonDockerfile } = await import('@shared/utils/dockerfiles');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapePyImageBuildpack({
        name: 'my-py-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.py',
        languageSpecificConfig: {},
        cwd: '/project',
        distFolderPath: '/dist',
        requiresGlibcBinaries: false,
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(buildPythonDockerfile).toHaveBeenCalledWith(
        expect.objectContaining({ alpine: true })
      );
    });

    test('should support runAppAs configuration', async () => {
      const { buildUsingStacktapePyImageBuildpack } = await import('./stacktape-py-image-buildpack');
      const { buildPythonDockerfile } = await import('@shared/utils/dockerfiles');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapePyImageBuildpack({
        name: 'my-py-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.py',
        languageSpecificConfig: { runAppAs: 'uvicorn' },
        cwd: '/project',
        distFolderPath: '/dist',
        requiresGlibcBinaries: false,
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(buildPythonDockerfile).toHaveBeenCalledWith(
        expect.objectContaining({ runAppAs: 'uvicorn' })
      );
    });

    test('should build Docker image with correct context', async () => {
      const { buildUsingStacktapePyImageBuildpack } = await import('./stacktape-py-image-buildpack');
      const { buildDockerImage } = await import('@shared/utils/docker');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapePyImageBuildpack({
        name: 'my-py-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.py',
        languageSpecificConfig: {},
        cwd: '/project',
        distFolderPath: '/dist',
        requiresGlibcBinaries: false,
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(buildDockerImage).toHaveBeenCalledWith(
        expect.objectContaining({
          imageTag: 'my-py-image',
          buildContextPath: '/dist'
        })
      );
    });
  });
});
