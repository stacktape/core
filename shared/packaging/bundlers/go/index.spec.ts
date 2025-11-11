import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/docker', () => ({
  execDocker: mock(async () => ({ stdout: 'Build complete' }))
}));

mock.module('@shared/utils/dockerfiles', () => ({
  buildGoArtifactDockerfile: mock(() => 'FROM golang:1.21-alpine\nWORKDIR /app')
}));

mock.module('@shared/utils/fs-utils', () => ({
  transformToUnixPath: mock((path) => path.replace(/\\/g, '/'))
}));

mock.module('fs-extra', () => ({
  outputFile: mock(async () => {})
}));

mock.module('object-hash', () => ({
  default: mock((obj) => `hash-${JSON.stringify(obj)}`)
}));

mock.module('./utils', () => ({
  getBundleDigest: mock(async () => 'go-digest-123')
}));

describe('bundlers/go/index', () => {
  describe('buildGoArtifact', () => {
    test('should build Go artifact', async () => {
      const { buildGoArtifact } = await import('./index');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildGoArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'main.go',
        requiresGlibcBinaries: false
      });

      expect(result).toBeDefined();
      expect(result.outcome).toBe('bundled');
    });

    test('should skip if digest exists', async () => {
      const { buildGoArtifact } = await import('./index');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildGoArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: ['go-digest-123'],
        rawEntryfilePath: 'main.go',
        requiresGlibcBinaries: false
      });

      expect(result.outcome).toBe('skipped');
    });

    test('should create Dockerfile', async () => {
      const { buildGoArtifact } = await import('./index');
      const { outputFile } = await import('fs-extra');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildGoArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'handler.go',
        requiresGlibcBinaries: false
      });

      expect(outputFile).toHaveBeenCalled();
    });

    test('should execute Docker build', async () => {
      const { buildGoArtifact } = await import('./index');
      const { execDocker } = await import('@shared/utils/docker');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildGoArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'main.go',
        requiresGlibcBinaries: false
      });

      expect(execDocker).toHaveBeenCalled();
      const callArgs = execDocker.mock.calls[0][0];
      expect(callArgs).toContain('image');
      expect(callArgs).toContain('build');
    });

    test('should use Alpine when glibc not required', async () => {
      const { buildGoArtifact } = await import('./index');
      const { buildGoArtifactDockerfile } = await import('@shared/utils/dockerfiles');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildGoArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'main.go',
        requiresGlibcBinaries: false
      });

      expect(buildGoArtifactDockerfile).toHaveBeenCalledWith({ alpine: true });
    });

    test('should handle platform architecture', async () => {
      const { buildGoArtifact } = await import('./index');
      const { execDocker } = await import('@shared/utils/docker');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildGoArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'main.go',
        requiresGlibcBinaries: false,
        dockerBuildOutputArchitecture: 'linux/arm64'
      });

      const callArgs = execDocker.mock.calls[execDocker.mock.calls.length - 1][0];
      expect(callArgs).toContain('--platform');
      expect(callArgs).toContain('linux/arm64');
    });
  });
});
