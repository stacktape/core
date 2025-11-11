import { describe, expect, mock, test } from 'bun:test';

// Mock archiver
const mockArchive = {
  directory: mock(function (path, prefix, entryCallback) {
    if (entryCallback) {
      entryCallback({ name: 'test.txt', mode: 0o644 });
    }
    return this;
  }),
  append: mock(function () {
    return this;
  }),
  on: mock(function (event, callback) {
    return this;
  }),
  pipe: mock(function (stream) {
    setTimeout(() => stream.emit('close'), 10);
    return this;
  }),
  finalize: mock(function () {})
};

mock.module('archiver', () => ({
  default: mock(() => mockArchive)
}));

mock.module('fs-extra', () => ({
  createFile: mock(async () => {}),
  rename: mock(async () => {}),
  createReadStream: mock(() => ({ on: mock(() => ({})) })),
  createWriteStream: mock(() => ({
    on: mock((event, callback) => {
      if (event === 'close') {
        setTimeout(callback, 10);
      }
      return {};
    })
  }))
}));

mock.module('tar', () => ({
  x: mock(async () => {})
}));

mock.module('./fs-utils', () => ({
  getFileNameWithoutExtension: mock((path: string) => {
    const name = path.split('/').pop() || '';
    return name.split('.')[0];
  }),
  getFolder: mock((path: string) => {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }),
  isDirAccessible: mock(() => true)
}));

describe('zip', () => {
  describe('archiveItem', () => {
    test('should create zip archive from directory', async () => {
      const { archiveItem } = await import('./zip');
      const archivePath = await archiveItem({
        format: 'zip',
        absoluteSourcePath: '/path/to/source',
        absoluteDestDirPath: '/path/to/dest'
      });

      expect(archivePath).toContain('.zip');
      expect(archivePath).toContain('/path/to/dest');
    });

    test('should create tgz archive', async () => {
      const { archiveItem } = await import('./zip');
      const archivePath = await archiveItem({
        format: 'tgz',
        absoluteSourcePath: '/path/to/source',
        absoluteDestDirPath: '/path/to/dest'
      });

      expect(archivePath).toContain('.tar.gz');
    });

    test('should use custom file name base', async () => {
      const { archiveItem } = await import('./zip');
      const archivePath = await archiveItem({
        format: 'zip',
        absoluteSourcePath: '/path/to/source',
        absoluteDestDirPath: '/path/to/dest',
        fileNameBase: 'custom-archive'
      });

      expect(archivePath).toContain('custom-archive.zip');
    });

    test('should handle executable patterns', async () => {
      const { archiveItem } = await import('./zip');
      await archiveItem({
        format: 'zip',
        absoluteSourcePath: '/path/to/source',
        absoluteDestDirPath: '/path/to/dest',
        executablePatterns: ['*.sh', 'bin/*']
      });

      expect(mockArchive.directory).toHaveBeenCalled();
    });

    test('should archive single file', async () => {
      const fsUtils = await import('./fs-utils');
      fsUtils.isDirAccessible = mock(() => false);

      const { archiveItem } = await import('./zip');
      const archivePath = await archiveItem({
        format: 'zip',
        absoluteSourcePath: '/path/to/file.txt',
        absoluteDestDirPath: '/path/to/dest'
      });

      expect(archivePath).toContain('.zip');
      expect(mockArchive.append).toHaveBeenCalled();
    });
  });

  describe('extractTgzArchive', () => {
    test('should extract tgz archive', async () => {
      const { extractTgzArchive } = await import('./zip');
      const tar = await import('tar');

      const distPath = await extractTgzArchive({
        sourcePath: '/path/to/archive.tgz',
        distDirPath: '/path/to/dist'
      });

      expect(tar.x).toHaveBeenCalledWith({
        file: '/path/to/archive.tgz',
        cwd: '/path/to/dist'
      });
      expect(distPath).toBeDefined();
    });

    test('should rename extracted package directory', async () => {
      const { extractTgzArchive } = await import('./zip');
      const fsExtra = await import('fs-extra');

      await extractTgzArchive({
        sourcePath: '/path/to/package.tgz',
        distDirPath: '/dist'
      });

      expect(fsExtra.rename).toHaveBeenCalled();
    });
  });
});
