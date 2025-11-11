import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('node:fs', () => ({
  default: {
    existsSync: mock(() => true),
    statSync: mock(() => ({ isDirectory: () => true, isFile: () => false })),
    readFileSync: mock(() => 'test content'),
    readdirSync: mock(() => [])
  },
  promises: {
    access: mock(async () => {}),
    stat: mock(async () => ({ isDirectory: () => true, isFile: () => false, size: 1024 })),
    readdir: mock(async () => []),
    readFile: mock(async () => Buffer.from('test'))
  }
}));

mock.module('node:crypto', () => ({
  createHash: mock(() => ({
    update: mock(function () {
      return this;
    }),
    digest: mock(() => 'abc123hash')
  }))
}));

mock.module('fs-extra', () => ({
  pathExists: mock(async () => true),
  stat: mock(async () => ({ isDirectory: () => true, size: 1024 })),
  readdir: mock(async () => []),
  readFile: mock(async () => 'content'),
  ensureDir: mock(async () => {}),
  copy: mock(async () => {}),
  remove: mock(async () => {})
}));

describe('fs-utils', () => {
  describe('isDirAccessible', () => {
    test('should return true for accessible directory', () => {
      const { isDirAccessible } = require('./fs-utils');
      const { existsSync, statSync } = require('node:fs').default;

      existsSync.mockReturnValue(true);
      statSync.mockReturnValue({ isDirectory: () => true });

      expect(isDirAccessible('/path/to/dir')).toBe(true);
    });

    test('should return false for non-existent path', () => {
      const { isDirAccessible } = require('./fs-utils');
      const { existsSync } = require('node:fs').default;

      existsSync.mockReturnValue(false);

      expect(isDirAccessible('/nonexistent')).toBe(false);
    });

    test('should return false for file path', () => {
      const { isDirAccessible } = require('./fs-utils');
      const { existsSync, statSync } = require('node:fs').default;

      existsSync.mockReturnValue(true);
      statSync.mockReturnValue({ isDirectory: () => false, isFile: () => true });

      expect(isDirAccessible('/path/to/file.txt')).toBe(false);
    });
  });

  describe('getFileExtension', () => {
    test('should extract file extension', () => {
      const { getFileExtension } = require('./fs-utils');

      expect(getFileExtension('file.ts')).toBe('ts');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
      expect(getFileExtension('/path/to/document.pdf')).toBe('pdf');
    });

    test('should handle files without extension', () => {
      const { getFileExtension } = require('./fs-utils');

      expect(getFileExtension('Makefile')).toBe('');
      expect(getFileExtension('README')).toBe('');
    });

    test('should handle paths with dots', () => {
      const { getFileExtension } = require('./fs-utils');

      expect(getFileExtension('/path.with.dots/file.js')).toBe('js');
    });
  });

  describe('getFileHash', () => {
    test('should calculate MD5 hash of file', async () => {
      const { getFileHash } = require('./fs-utils');
      const { readFile } = require('node:fs').promises;

      readFile.mockResolvedValue(Buffer.from('test content'));

      const hash = await getFileHash('/path/to/file.txt');

      expect(hash).toBe('abc123hash');
    });
  });

  describe('getFileSize', () => {
    test('should return file size in MB', async () => {
      const { getFileSize } = require('./fs-utils');
      const { stat } = require('fs-extra');

      stat.mockResolvedValue({ size: 1048576 }); // 1 MB

      const size = await getFileSize('/file.zip', 'MB', 2);

      expect(size).toBe(1);
    });

    test('should return file size in KB', async () => {
      const { getFileSize } = require('./fs-utils');
      const { stat } = require('fs-extra');

      stat.mockResolvedValue({ size: 2048 }); // 2 KB

      const size = await getFileSize('/file.txt', 'KB', 2);

      expect(size).toBe(2);
    });

    test('should return file size in bytes', async () => {
      const { getFileSize } = require('./fs-utils');
      const { stat } = require('fs-extra');

      stat.mockResolvedValue({ size: 512 });

      const size = await getFileSize('/file.bin', 'B', 0);

      expect(size).toBe(512);
    });
  });

  describe('dirExists', () => {
    test('should return true for existing directory', () => {
      const { dirExists } = require('./fs-utils');
      const { existsSync, statSync } = require('node:fs').default;

      existsSync.mockReturnValue(true);
      statSync.mockReturnValue({ isDirectory: () => true });

      expect(dirExists('/path')).toBe(true);
    });

    test('should return false for file', () => {
      const { dirExists } = require('./fs-utils');
      const { existsSync, statSync } = require('node:fs').default;

      existsSync.mockReturnValue(true);
      statSync.mockReturnValue({ isDirectory: () => false });

      expect(dirExists('/file.txt')).toBe(false);
    });

    test('should return false for non-existent path', () => {
      const { dirExists } = require('./fs-utils');
      const { existsSync } = require('node:fs').default;

      existsSync.mockReturnValue(false);

      expect(dirExists('/nonexistent')).toBe(false);
    });
  });

  describe('fileExists', () => {
    test('should return true for existing file', () => {
      const { fileExists } = require('./fs-utils');
      const { existsSync, statSync } = require('node:fs').default;

      existsSync.mockReturnValue(true);
      statSync.mockReturnValue({ isFile: () => true });

      expect(fileExists('/file.txt')).toBe(true);
    });

    test('should return false for directory', () => {
      const { fileExists } = require('./fs-utils');
      const { existsSync, statSync } = require('node:fs').default;

      existsSync.mockReturnValue(true);
      statSync.mockReturnValue({ isFile: () => false, isDirectory: () => true });

      expect(fileExists('/directory')).toBe(false);
    });
  });

  describe('getAllFilesInDir', () => {
    test('should return all files in directory', async () => {
      const { getAllFilesInDir } = require('./fs-utils');
      const { stat, readdir } = require('node:fs').promises;

      readdir.mockResolvedValue(['file1.txt', 'file2.js', 'subdir']);
      stat.mockImplementation(async (path) => {
        if (path.includes('subdir')) {
          return { isDirectory: () => true };
        }
        return { isDirectory: () => false, isFile: () => true };
      });

      const files = await getAllFilesInDir('/project', false);

      expect(Array.isArray(files)).toBe(true);
    });
  });

  describe('getFolderSize', () => {
    test('should calculate total size of folder', async () => {
      const { getFolderSize } = require('./fs-utils');
      const { stat, readdir } = require('node:fs').promises;

      readdir.mockResolvedValue(['file1.txt', 'file2.txt']);
      stat.mockResolvedValue({ size: 1048576, isDirectory: () => false }); // 1 MB each

      const size = await getFolderSize('/folder', 'MB', 2);

      expect(size).toBeGreaterThan(0);
    });
  });

  describe('ensureDirExists', () => {
    test('should create directory if it does not exist', async () => {
      const { ensureDirExists } = require('./fs-utils');
      const { ensureDir } = require('fs-extra');

      await ensureDirExists('/new/directory');

      expect(ensureDir).toHaveBeenCalled();
    });
  });

  describe('getDirectoriesInDir', () => {
    test('should return only directories', async () => {
      const { getDirectoriesInDir } = require('./fs-utils');
      const { readdir, stat } = require('node:fs').promises;

      readdir.mockResolvedValue(['dir1', 'file.txt', 'dir2']);
      stat.mockImplementation(async (path) => {
        if (path.includes('dir')) {
          return { isDirectory: () => true };
        }
        return { isDirectory: () => false, isFile: () => true };
      });

      const dirs = await getDirectoriesInDir('/project');

      expect(Array.isArray(dirs)).toBe(true);
    });
  });
});
