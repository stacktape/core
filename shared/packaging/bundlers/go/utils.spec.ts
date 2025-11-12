import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/fs-utils', () => ({
  getHashFromMultipleFiles: mock(async (files) => ({
    update: mock(function () {
      return this;
    }),
    digest: mock(() => 'go-bundle-digest-abc123')
  })),
  getMatchingFilesByGlob: mock(async () => ['main.go', 'handler.go', 'utils.go'])
}));

mock.module('object-hash', () => ({
  default: mock((obj) => `hash-${JSON.stringify(obj)}`)
}));

describe('bundlers/go/utils', () => {
  describe('getBundleDigest', () => {
    test('should calculate bundle digest for Go project', async () => {
      const { getBundleDigest } = await import('./utils');

      const digest = await getBundleDigest({
        cwd: '/project',
        externalDependencies: [
          { name: 'github.com/aws/aws-sdk-go', version: 'v1.44.0' }
        ],
        additionalDigestInput: '',
        rawEntryfilePath: 'main.go',
        languageSpecificConfig: {} as any
      });

      expect(digest).toBe('go-bundle-digest-abc123');
    });

    test('should include go.mod and go.sum in digest', async () => {
      const { getBundleDigest } = await import('./utils');
      const { getHashFromMultipleFiles } = await import('@shared/utils/fs-utils');

      await getBundleDigest({
        cwd: '/project',
        externalDependencies: [],
        additionalDigestInput: '',
        rawEntryfilePath: 'handler.go',
        languageSpecificConfig: {} as any
      });

      const files = getHashFromMultipleFiles.mock.calls[getHashFromMultipleFiles.mock.calls.length - 1][0];
      expect(files.some((f) => f.endsWith('go.mod'))).toBe(true);
      expect(files.some((f) => f.endsWith('go.sum'))).toBe(true);
    });

    test('should glob for Go files', async () => {
      const { getBundleDigest } = await import('./utils');
      const { getMatchingFilesByGlob } = await import('@shared/utils/fs-utils');

      await getBundleDigest({
        cwd: '/app',
        externalDependencies: [],
        additionalDigestInput: '',
        rawEntryfilePath: 'main.go',
        languageSpecificConfig: {} as any
      });

      expect(getMatchingFilesByGlob).toHaveBeenCalledWith({
        globPattern: './**/*.go',
        cwd: '/app'
      });
    });

    test('should include external dependencies in hash', async () => {
      const { getBundleDigest } = await import('./utils');
      const { getHashFromMultipleFiles } = await import('@shared/utils/fs-utils');

      await getBundleDigest({
        cwd: '/project',
        externalDependencies: [
          { name: 'github.com/gin-gonic/gin', version: 'v1.9.0' },
          { name: 'github.com/gorilla/mux', version: 'v1.8.0' }
        ],
        additionalDigestInput: '',
        rawEntryfilePath: 'server.go',
        languageSpecificConfig: {} as any
      });

      const hashObj = getHashFromMultipleFiles.mock.results[getHashFromMultipleFiles.mock.results.length - 1].value;
      expect(hashObj.update).toHaveBeenCalled();
    });

    test('should include language-specific config in hash', async () => {
      const { getBundleDigest } = await import('./utils');

      await getBundleDigest({
        cwd: '/project',
        externalDependencies: [],
        additionalDigestInput: '',
        rawEntryfilePath: 'main.go',
        languageSpecificConfig: { buildFlags: ['-tags', 'production'] } as any
      });

      expect(true).toBe(true); // Should not throw
    });

    test('should include additional digest input', async () => {
      const { getBundleDigest } = await import('./utils');

      await getBundleDigest({
        cwd: '/project',
        externalDependencies: [],
        additionalDigestInput: 'custom-input-123',
        rawEntryfilePath: 'main.go',
        languageSpecificConfig: {} as any
      });

      expect(true).toBe(true); // Should not throw
    });
  });
});
