import { describe, expect, mock, test } from 'bun:test';

mock.module('@shared/utils/docker', () => ({
  buildDockerImage: mock(async () => ({
    size: 120,
    dockerOutput: 'Successfully built image',
    duration: 45,
    created: '2024-01-01T00:00:00Z'
  }))
}));

mock.module('@shared/utils/dockerfiles', () => ({
  buildGoDockerfile: mock(() => 'FROM golang:1.21\nWORKDIR /app\nCOPY . .\nRUN go build')
}));

mock.module('@shared/utils/fs-utils', () => ({
  getFolder: mock((path) => path.split('/').slice(0, -1).join('/'))
}));

mock.module('fs-extra', () => ({
  outputFile: mock(async () => {})
}));

mock.module('./bundlers/go', () => ({
  buildGoArtifact: mock(async () => ({
    digest: 'go-digest-123',
    outcome: 'bundled',
    distFolderPath: '/dist',
    sourceFiles: []
  }))
}));

describe('stacktape-go-image-buildpack', () => {
  describe('buildUsingStacktapeGoImageBuildpack', () => {
    test('should build Go Docker image', async () => {
      const { buildUsingStacktapeGoImageBuildpack } = await import('./stacktape-go-image-buildpack');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingStacktapeGoImageBuildpack({
        name: 'my-go-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.go',
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(result).toBeDefined();
      expect(result.outcome).toBe('bundled');
      expect(result.imageName).toBe('my-go-image');
      expect(result.size).toBe(120);
      expect(result.digest).toBe('go-digest-123');
    });

    test('should handle skipped outcome', async () => {
      const { buildUsingStacktapeGoImageBuildpack } = await import('./stacktape-go-image-buildpack');
      const { buildGoArtifact } = await import('./bundlers/go');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      buildGoArtifact.mockResolvedValueOnce({
        digest: 'go-digest-123',
        outcome: 'skipped',
        distFolderPath: '/dist',
        sourceFiles: []
      });

      const result = await buildUsingStacktapeGoImageBuildpack({
        name: 'my-go-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.go',
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: ['go-digest-123'],
        additionalDigestInput: ''
      } as any);

      expect(result.outcome).toBe('skipped');
      expect(result.size).toBe(null);
    });

    test('should create Dockerfile', async () => {
      const { buildUsingStacktapeGoImageBuildpack } = await import('./stacktape-go-image-buildpack');
      const { outputFile } = await import('fs-extra');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapeGoImageBuildpack({
        name: 'my-go-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.go',
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(outputFile).toHaveBeenCalled();
      const dockerfilePath = outputFile.mock.calls[0][0];
      expect(dockerfilePath).toContain('Dockerfile');
    });

    test('should use Alpine when glibc not required', async () => {
      const { buildUsingStacktapeGoImageBuildpack } = await import('./stacktape-go-image-buildpack');
      const { buildGoDockerfile } = await import('@shared/utils/dockerfiles');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapeGoImageBuildpack({
        name: 'my-go-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.go',
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        additionalDigestInput: '',
        requiresGlibcBinaries: false
      } as any);

      expect(buildGoDockerfile).toHaveBeenCalledWith(
        expect.objectContaining({ alpine: true })
      );
    });

    test('should build Docker image with correct context', async () => {
      const { buildUsingStacktapeGoImageBuildpack } = await import('./stacktape-go-image-buildpack');
      const { buildDockerImage } = await import('@shared/utils/docker');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapeGoImageBuildpack({
        name: 'my-go-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.go',
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(buildDockerImage).toHaveBeenCalledWith(
        expect.objectContaining({
          imageTag: 'my-go-image',
          buildContextPath: '/dist'
        })
      );
    });

    test('should support custom Docker build commands', async () => {
      const { buildUsingStacktapeGoImageBuildpack } = await import('./stacktape-go-image-buildpack');
      const { buildGoDockerfile } = await import('@shared/utils/dockerfiles');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const customCommands = ['RUN apk add --no-cache ca-certificates'];
      await buildUsingStacktapeGoImageBuildpack({
        name: 'my-go-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/main.go',
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        additionalDigestInput: '',
        customDockerBuildCommands: customCommands
      } as any);

      expect(buildGoDockerfile).toHaveBeenCalledWith(
        expect.objectContaining({
          customDockerBuildCommands: customCommands
        })
      );
    });
  });
});
