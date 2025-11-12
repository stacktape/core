import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/fs-utils', () => ({
  getAllFilesInDir: mock(async () => ['/project/index.js', '/project/package.json']),
  getFileExtension: mock(() => 'zip'),
  getFileHash: mock(async () => 'abc123hash'),
  getFileSize: mock(async () => 10),
  getFolderSize: mock(async () => 20),
  isDirAccessible: mock(() => true),
  isAbsolute: mock((path) => path.startsWith('/'))
}));

mock.module('@shared/utils/hashing', () => ({
  getDirectoryChecksum: mock(async () => 'dir-checksum-123'),
  mergeHashes: mock((...hashes) => hashes.join('-'))
}));

mock.module('@shared/utils/misc', () => ({
  getError: mock((opts) => new Error(opts.message))
}));

mock.module('@shared/utils/zip', () => ({
  archiveItem: mock(async () => '/dist/package.zip')
}));

mock.module('fs-extra', () => ({
  copy: mock(async () => {})
}));

mock.module('object-hash', () => ({
  default: mock((obj) => `hash-${JSON.stringify(obj)}`)
}));

mock.module('./_shared', () => ({
  EXCLUDE_FROM_CHECKSUM_GLOBS: ['node_modules', 'test_coverage']
}));

describe('custom-artifact', () => {
  describe('buildUsingCustomArtifact', () => {
    test('should build artifact from directory', async () => {
      const { buildUsingCustomArtifact } = await import('./custom-artifact');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingCustomArtifact({
        packagePath: '/project/dist',
        name: 'my-function',
        cwd: '/project',
        distFolderPath: '/dist',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        handler: 'index.handler'
      });

      expect(result).toBeDefined();
      expect(result.outcome).toBe('bundled');
      expect(result.digest).toBeDefined();
    });

    test('should skip if digest already exists', async () => {
      const { buildUsingCustomArtifact } = await import('./custom-artifact');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingCustomArtifact({
        packagePath: '/project/dist',
        name: 'my-function',
        cwd: '/project',
        distFolderPath: '/dist',
        progressLogger: mockProgressLogger,
        existingDigests: ['dir-checksum-123-hash-{"handler":"index.handler","packagePath":"/project/dist"}-'],
        handler: 'index.handler'
      });

      expect(result.outcome).toBe('skipped');
    });

    test('should calculate checksum', async () => {
      const { buildUsingCustomArtifact } = await import('./custom-artifact');
      const { getDirectoryChecksum } = await import('@shared/utils/hashing');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingCustomArtifact({
        packagePath: '/project/dist',
        name: 'my-function',
        cwd: '/project',
        distFolderPath: '/dist',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        handler: 'index.handler'
      });

      expect(getDirectoryChecksum).toHaveBeenCalled();
    });

    test('should archive directory to zip', async () => {
      const { buildUsingCustomArtifact } = await import('./custom-artifact');
      const { archiveItem } = await import('@shared/utils/zip');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingCustomArtifact({
        packagePath: '/project/dist',
        name: 'my-function',
        cwd: '/project',
        distFolderPath: '/dist',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        handler: 'index.handler'
      });

      expect(archiveItem).toHaveBeenCalled();
    });

    test('should handle zip file input', async () => {
      const { buildUsingCustomArtifact } = await import('./custom-artifact');
      const { isDirAccessible, getFileExtension } = await import('@shared/utils/fs-utils');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      isDirAccessible.mockReturnValue(false);
      getFileExtension.mockReturnValue('zip' as any);

      const result = await buildUsingCustomArtifact({
        packagePath: '/project/package.zip',
        name: 'my-function',
        cwd: '/project',
        distFolderPath: '/dist',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        handler: 'index.handler'
      });

      expect(result.outcome).toBe('bundled');
    });

    test('should throw error if size exceeds limit', async () => {
      const { buildUsingCustomArtifact } = await import('./custom-artifact');
      const { getFolderSize } = await import('@shared/utils/fs-utils');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      getFolderSize.mockResolvedValue(300); // Exceeds 250 MB limit

      await expect(
        buildUsingCustomArtifact({
          packagePath: '/project/dist',
          name: 'my-function',
          cwd: '/project',
          distFolderPath: '/dist',
          progressLogger: mockProgressLogger,
          existingDigests: [],
          handler: 'index.handler'
        })
      ).rejects.toThrow();
    });

    test('should include additional digest input', async () => {
      const { buildUsingCustomArtifact } = await import('./custom-artifact');
      const { mergeHashes } = await import('@shared/utils/hashing');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingCustomArtifact({
        packagePath: '/project/dist',
        name: 'my-function',
        cwd: '/project',
        distFolderPath: '/dist',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        handler: 'index.handler',
        additionalDigestInput: 'custom-input'
      });

      expect(mergeHashes).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'custom-input');
    });

    test('should return source files', async () => {
      const { buildUsingCustomArtifact } = await import('./custom-artifact');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingCustomArtifact({
        packagePath: '/project/dist',
        name: 'my-function',
        cwd: '/project',
        distFolderPath: '/dist',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        handler: 'index.handler'
      });

      expect(result.sourceFiles).toBeDefined();
      expect(Array.isArray(result.sourceFiles)).toBe(true);
    });
  });
});
