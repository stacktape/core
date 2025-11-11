import { describe, expect, mock, test } from 'bun:test';

// Mock fs-extra
const mockFiles = {
  '/test/dir': true,
  '/test/dir/file1.txt': false,
  '/test/dir/subdir': true,
  '/test/dir/subdir/file2.txt': false
};

mock.module('fs-extra', () => ({
  stat: mock(async (path: string) => ({
    isDirectory: () => mockFiles[path] === true
  })),
  readdir: mock(async (dir: string) => {
    if (dir === '/test/dir') {
      return ['file1.txt', 'subdir'];
    }
    if (dir === '/test/dir/subdir') {
      return ['file2.txt'];
    }
    return [];
  }),
  rm: mock(async () => {}),
  chmod: mock(async () => {}),
  unlink: mock(async () => {})
}));

describe('force-delete', () => {
  describe('forceRemoveWithRetry', () => {
    test('should remove directory recursively', async () => {
      const { forceRemoveWithRetry } = await import('./force-delete');
      const { rm } = await import('fs-extra');

      await forceRemoveWithRetry('/test/dir');

      expect(rm).toHaveBeenCalled();
    });

    test('should chmod files before unlinking', async () => {
      const { forceRemoveWithRetry } = await import('./force-delete');
      const { chmod, unlink } = await import('fs-extra');

      await forceRemoveWithRetry('/test/dir');

      expect(chmod).toHaveBeenCalled();
      expect(unlink).toHaveBeenCalled();
    });

    test('should retry on EPERM errors', async () => {
      const { unlink } = await import('fs-extra');
      let callCount = 0;
      unlink.mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          const err: any = new Error('EPERM');
          err.code = 'EPERM';
          throw err;
        }
      });

      const { forceRemoveWithRetry } = await import('./force-delete');
      await forceRemoveWithRetry('/test/dir');

      expect(callCount).toBeGreaterThan(1);
    });

    test('should handle empty directories', async () => {
      const { readdir } = await import('fs-extra');
      readdir.mockImplementation(async () => []);

      const { forceRemoveWithRetry } = await import('./force-delete');
      await forceRemoveWithRetry('/test/empty');

      const { rm } = await import('fs-extra');
      expect(rm).toHaveBeenCalled();
    });
  });
});
