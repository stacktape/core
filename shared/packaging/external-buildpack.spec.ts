import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/docker', () => ({
  getDockerImageDetails: mock(async () => ({
    size: 200,
    imageId: 'sha256:def456'
  }))
}));

mock.module('@shared/utils/fs-utils', () => ({
  getAllFilesInDir: mock(async () => ['/app/index.js', '/app/package.json'])
}));

mock.module('@shared/utils/hashing', () => ({
  getDirectoryChecksum: mock(async () => 'source-checksum-456'),
  mergeHashes: mock((...hashes) => hashes.join('-'))
}));

mock.module('@shared/utils/pack-exec', () => ({
  execPack: mock(async () => ({ stdout: 'Successfully built image' }))
}));

mock.module('object-hash', () => ({
  default: mock((obj) => `hash-${JSON.stringify(obj)}`)
}));

mock.module('./_shared', () => ({
  EXCLUDE_FROM_CHECKSUM_GLOBS: ['node_modules', 'test_coverage']
}));

describe('external-buildpack', () => {
  describe('buildUsingExternalBuildpack', () => {
    test('should build using pack CLI', async () => {
      const { buildUsingExternalBuildpack } = await import('./external-buildpack');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingExternalBuildpack({
        name: 'my-app',
        sourceDirectoryPath: './src',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: []
      });

      expect(result).toBeDefined();
      expect(result.outcome).toBe('bundled');
      expect(result.imageName).toBe('my-app');
    });

    test('should use default builder', async () => {
      const { buildUsingExternalBuildpack } = await import('./external-buildpack');
      const { execPack } = await import('@shared/utils/pack-exec');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingExternalBuildpack({
        name: 'my-app',
        sourceDirectoryPath: './src',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: []
      });

      const callArgs = execPack.mock.calls[execPack.mock.calls.length - 1][0];
      expect(callArgs.args).toContain('--builder');
      expect(callArgs.args).toContain('paketobuildpacks/builder-jammy-base');
    });

    test('should skip if digest exists', async () => {
      const { buildUsingExternalBuildpack } = await import('./external-buildpack');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingExternalBuildpack({
        name: 'my-app',
        sourceDirectoryPath: './src',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: ['source-checksum-456-hash-{"EXCLUDE_FROM_CHECKSUM_GLOBS":["node_modules","test_coverage"]}']
      });

      expect(result.outcome).toBe('skipped');
    });

    test('should use custom builder', async () => {
      const { buildUsingExternalBuildpack } = await import('./external-buildpack');
      const { execPack } = await import('@shared/utils/pack-exec');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingExternalBuildpack({
        name: 'my-app',
        builder: 'custom/builder:latest',
        sourceDirectoryPath: './src',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: []
      });

      const callArgs = execPack.mock.calls[execPack.mock.calls.length - 1][0];
      expect(callArgs.args).toContain('custom/builder:latest');
    });

    test('should pass buildpacks to pack', async () => {
      const { buildUsingExternalBuildpack } = await import('./external-buildpack');
      const { execPack } = await import('@shared/utils/pack-exec');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingExternalBuildpack({
        name: 'my-app',
        sourceDirectoryPath: './src',
        buildpacks: ['paketo-buildpacks/nodejs', 'paketo-buildpacks/npm'],
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: []
      });

      const callArgs = execPack.mock.calls[execPack.mock.calls.length - 1][0];
      expect(callArgs.args).toContain('--buildpack');
      expect(callArgs.args).toContain('paketo-buildpacks/nodejs');
      expect(callArgs.args).toContain('paketo-buildpacks/npm');
    });

    test('should set JAVA_TOOL_OPTIONS env var', async () => {
      const { buildUsingExternalBuildpack } = await import('./external-buildpack');
      const { execPack } = await import('@shared/utils/pack-exec');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingExternalBuildpack({
        name: 'my-app',
        sourceDirectoryPath: './src',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: []
      });

      const callArgs = execPack.mock.calls[execPack.mock.calls.length - 1][0];
      expect(callArgs.args).toContain('--env');
      expect(callArgs.args.some((arg) => arg.includes('JAVA_TOOL_OPTIONS'))).toBe(true);
    });

    test('should handle platform architecture', async () => {
      const { buildUsingExternalBuildpack } = await import('./external-buildpack');
      const { execPack } = await import('@shared/utils/pack-exec');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingExternalBuildpack({
        name: 'my-app',
        sourceDirectoryPath: './src',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: [],
        dockerBuildOutputArchitecture: 'linux/arm64'
      });

      const callArgs = execPack.mock.calls[execPack.mock.calls.length - 1][0];
      expect(callArgs.args).toContain('--platform');
      expect(callArgs.args).toContain('linux/arm64');
    });

    test('should return image size and details', async () => {
      const { buildUsingExternalBuildpack } = await import('./external-buildpack');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingExternalBuildpack({
        name: 'my-app',
        sourceDirectoryPath: './src',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: []
      });

      expect(result.size).toBe(200);
      expect(result.details).toBeDefined();
    });
  });
});
