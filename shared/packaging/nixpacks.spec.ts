import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/docker', () => ({
  getDockerImageDetails: mock(async () => ({
    size: 180,
    imageId: 'sha256:ghi789'
  }))
}));

mock.module('@shared/utils/fs-utils', () => ({
  getAllFilesInDir: mock(async () => ['/app/src/index.ts'])
}));

mock.module('@shared/utils/hashing', () => ({
  getDirectoryChecksum: mock(async () => 'nixpacks-checksum-789'),
  mergeHashes: mock((...hashes) => hashes.join('-'))
}));

mock.module('@shared/utils/misc', () => ({
  raiseError: mock((opts) => {
    throw new Error(opts.message);
  })
}));

mock.module('@shared/utils/nixpack-exec', () => ({
  execNixpacks: mock(async () => ({ stdout: 'Build successful' }))
}));

mock.module('@utils/file-loaders', () => ({
  loadFromIni: mock(async () => ({})),
  loadFromJson: mock(async () => ({}))
}));

mock.module('fs-extra', () => ({
  readdir: mock(async () => []),
  remove: mock(async () => {}),
  writeJson: mock(async () => {})
}));

mock.module('object-hash', () => ({
  default: mock((obj) => `hash-${JSON.stringify(obj)}`)
}));

mock.module('./_shared', () => ({
  EXCLUDE_FROM_CHECKSUM_GLOBS: ['node_modules', 'test_coverage']
}));

describe('nixpacks', () => {
  describe('buildUsingNixpacks', () => {
    test('should build using nixpacks', async () => {
      const { buildUsingNixpacks } = await import('./nixpacks');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingNixpacks({
        name: 'my-app',
        sourceDirectoryPath: './src',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: []
      });

      expect(result).toBeDefined();
      expect(result.outcome).toBe('bundled');
    });

    test('should skip if digest exists', async () => {
      const { buildUsingNixpacks } = await import('./nixpacks');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingNixpacks({
        name: 'my-app',
        sourceDirectoryPath: './src',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: ['nixpacks-checksum-789-hash-{"EXCLUDE_FROM_CHECKSUM_GLOBS":["node_modules","test_coverage"]}']
      });

      expect(result.outcome).toBe('skipped');
    });

    test('should create temporary nixpacks config file', async () => {
      const { buildUsingNixpacks } = await import('./nixpacks');
      const { writeJson } = await import('fs-extra');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingNixpacks({
        name: 'my-app',
        sourceDirectoryPath: './src',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: []
      });

      expect(writeJson).toHaveBeenCalled();
    });

    test('should remove config file after build', async () => {
      const { buildUsingNixpacks } = await import('./nixpacks');
      const { remove } = await import('fs-extra');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingNixpacks({
        name: 'my-app',
        sourceDirectoryPath: './src',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: []
      });

      expect(remove).toHaveBeenCalled();
    });

    test('should handle custom build image', async () => {
      const { buildUsingNixpacks } = await import('./nixpacks');
      const { writeJson } = await import('fs-extra');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingNixpacks({
        name: 'my-app',
        sourceDirectoryPath: './src',
        buildImage: 'custom-build:latest',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: []
      });

      const configWritten = writeJson.mock.calls[writeJson.mock.calls.length - 1][1];
      expect(configWritten.buildImage).toBe('custom-build:latest');
    });

    test('should handle custom phases', async () => {
      const { buildUsingNixpacks } = await import('./nixpacks');
      const { writeJson } = await import('fs-extra');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingNixpacks({
        name: 'my-app',
        sourceDirectoryPath: './src',
        phases: [
          { name: 'setup', cmds: ['npm install'] },
          { name: 'build', cmds: ['npm run build'] }
        ],
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: []
      });

      const configWritten = writeJson.mock.calls[writeJson.mock.calls.length - 1][1];
      expect(configWritten.phases).toBeDefined();
      expect(configWritten.phases.setup).toBeDefined();
    });

    test('should handle start command', async () => {
      const { buildUsingNixpacks } = await import('./nixpacks');
      const { writeJson } = await import('fs-extra');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingNixpacks({
        name: 'my-app',
        sourceDirectoryPath: './src',
        startCmd: 'npm start',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: []
      });

      const configWritten = writeJson.mock.calls[writeJson.mock.calls.length - 1][1];
      expect(configWritten.start.cmd).toBe('npm start');
    });

    test('should handle platform architecture', async () => {
      const { buildUsingNixpacks } = await import('./nixpacks');
      const { execNixpacks } = await import('@shared/utils/nixpack-exec');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingNixpacks({
        name: 'my-app',
        sourceDirectoryPath: './src',
        progressLogger: mockProgressLogger,
        cwd: '/project',
        existingDigests: [],
        dockerBuildOutputArchitecture: 'linux/arm64'
      });

      const callArgs = execNixpacks.mock.calls[execNixpacks.mock.calls.length - 1][0];
      expect(callArgs.args).toContain('--platform');
      expect(callArgs.args).toContain('linux/arm64');
    });

    test('should throw error on build failure', async () => {
      const { buildUsingNixpacks } = await import('./nixpacks');
      const { execNixpacks } = await import('@shared/utils/nixpack-exec');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      execNixpacks.mockRejectedValueOnce(new Error('Build failed'));

      await expect(
        buildUsingNixpacks({
          name: 'my-app',
          sourceDirectoryPath: './src',
          progressLogger: mockProgressLogger,
          cwd: '/project',
          existingDigests: []
        })
      ).rejects.toThrow();
    });
  });
});
