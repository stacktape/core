import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    workingDir: '/workspace'
  }
}));

mock.module('@shared/utils/docker', () => ({
  buildDockerImage: mock(async () => ({
    size: 150,
    imageId: 'sha256:abc123'
  }))
}));

mock.module('@shared/utils/fs-utils', () => ({
  getAllFilesInDir: mock(async () => ['/workspace/file1.ts', '/workspace/file2.ts'])
}));

mock.module('@shared/utils/hashing', () => ({
  getDirectoryChecksum: mock(async () => 'context-checksum-123'),
  mergeHashes: mock((...hashes) => hashes.join('-'))
}));

mock.module('object-hash', () => ({
  default: mock((obj) => `hash-${JSON.stringify(obj)}`)
}));

mock.module('./_shared', () => ({
  EXCLUDE_FROM_CHECKSUM_GLOBS: ['node_modules', 'test_coverage']
}));

describe('custom-dockerfile', () => {
  describe('buildUsingCustomDockerfile', () => {
    test('should build Docker image', async () => {
      const { buildUsingCustomDockerfile } = await import('./custom-dockerfile');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingCustomDockerfile({
        name: 'my-service',
        buildContextPath: './app',
        dockerfilePath: 'Dockerfile',
        progressLogger: mockProgressLogger,
        buildArgs: [],
        existingDigests: []
      });

      expect(result).toBeDefined();
      expect(result.outcome).toBe('bundled');
      expect(result.imageName).toBe('my-service');
    });

    test('should skip if digest exists', async () => {
      const { buildUsingCustomDockerfile } = await import('./custom-dockerfile');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingCustomDockerfile({
        name: 'my-service',
        buildContextPath: './app',
        dockerfilePath: 'Dockerfile',
        progressLogger: mockProgressLogger,
        buildArgs: [],
        existingDigests: ['context-checksum-123-hash-{"EXCLUDE_FROM_CHECKSUM_GLOBS":["node_modules","test_coverage"],"buildArgs":[]}']
      });

      expect(result.outcome).toBe('skipped');
    });

    test('should calculate directory checksum', async () => {
      const { buildUsingCustomDockerfile } = await import('./custom-dockerfile');
      const { getDirectoryChecksum } = await import('@shared/utils/hashing');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingCustomDockerfile({
        name: 'my-service',
        buildContextPath: './app',
        dockerfilePath: 'Dockerfile',
        progressLogger: mockProgressLogger,
        buildArgs: [],
        existingDigests: []
      });

      expect(getDirectoryChecksum).toHaveBeenCalled();
    });

    test('should pass build args to Docker', async () => {
      const { buildUsingCustomDockerfile } = await import('./custom-dockerfile');
      const { buildDockerImage } = await import('@shared/utils/docker');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingCustomDockerfile({
        name: 'my-service',
        buildContextPath: './app',
        dockerfilePath: 'Dockerfile',
        progressLogger: mockProgressLogger,
        buildArgs: [
          { argName: 'NODE_ENV', value: 'production' },
          { argName: 'PORT', value: '3000' }
        ],
        existingDigests: []
      });

      const callArgs = buildDockerImage.mock.calls[buildDockerImage.mock.calls.length - 1][0];
      expect(callArgs.buildArgs).toEqual({
        NODE_ENV: 'production',
        PORT: '3000'
      });
    });

    test('should use absolute build context path', async () => {
      const { buildUsingCustomDockerfile } = await import('./custom-dockerfile');
      const { buildDockerImage } = await import('@shared/utils/docker');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingCustomDockerfile({
        name: 'my-service',
        buildContextPath: './app',
        dockerfilePath: 'Dockerfile',
        progressLogger: mockProgressLogger,
        buildArgs: [],
        existingDigests: []
      });

      const callArgs = buildDockerImage.mock.calls[buildDockerImage.mock.calls.length - 1][0];
      expect(callArgs.buildContextPath).toContain('/workspace');
    });

    test('should return image size', async () => {
      const { buildUsingCustomDockerfile } = await import('./custom-dockerfile');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingCustomDockerfile({
        name: 'my-service',
        buildContextPath: './app',
        dockerfilePath: 'Dockerfile',
        progressLogger: mockProgressLogger,
        buildArgs: [],
        existingDigests: []
      });

      expect(result.size).toBe(150);
    });

    test('should handle docker build output architecture', async () => {
      const { buildUsingCustomDockerfile } = await import('./custom-dockerfile');
      const { buildDockerImage } = await import('@shared/utils/docker');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingCustomDockerfile({
        name: 'my-service',
        buildContextPath: './app',
        dockerfilePath: 'Dockerfile',
        progressLogger: mockProgressLogger,
        buildArgs: [],
        existingDigests: [],
        dockerBuildOutputArchitecture: 'linux/arm64'
      });

      const callArgs = buildDockerImage.mock.calls[buildDockerImage.mock.calls.length - 1][0];
      expect(callArgs.dockerBuildOutputArchitecture).toBe('linux/arm64');
    });

    test('should return source files', async () => {
      const { buildUsingCustomDockerfile } = await import('./custom-dockerfile');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingCustomDockerfile({
        name: 'my-service',
        buildContextPath: './app',
        dockerfilePath: 'Dockerfile',
        progressLogger: mockProgressLogger,
        buildArgs: [],
        existingDigests: []
      });

      expect(result.sourceFiles).toBeDefined();
      expect(result.sourceFiles.length).toBeGreaterThan(0);
    });
  });
});
