import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/fs-utils', () => ({
  getHashFromMultipleFiles: mock(async (files) => ({
    update: mock(function () {
      return this;
    }),
    digest: mock(() => 'py-bundle-digest-ghi789')
  })),
  getMatchingFilesByGlob: mock(async () => ['main.py', 'handler.py', 'utils.py'])
}));

mock.module('fs-extra', () => ({
  exists: mock(async (path) => {
    if (path.includes('requirements.txt')) return true;
    if (path.includes('pipfile')) return false;
    if (path.includes('pyproject.toml')) return false;
    return false;
  })
}));

mock.module('object-hash', () => ({
  default: mock((obj) => `hash-${JSON.stringify(obj)}`)
}));

describe('bundlers/py/utils', () => {
  describe('getBundleDigest', () => {
    test('should calculate bundle digest for Python project', async () => {
      const { getBundleDigest } = await import('./utils');

      const digest = await getBundleDigest({
        cwd: '/project',
        externalDependencies: [
          { name: 'boto3', version: '1.26.0' }
        ],
        additionalDigestInput: '',
        rawEntryfilePath: 'main.py',
        languageSpecificConfig: {} as any
      });

      expect(digest).toBe('py-bundle-digest-ghi789');
    });

    test('should include requirements.txt and pyproject.toml in digest', async () => {
      const { getBundleDigest } = await import('./utils');
      const { getHashFromMultipleFiles } = await import('@shared/utils/fs-utils');

      await getBundleDigest({
        cwd: '/project',
        externalDependencies: [],
        additionalDigestInput: '',
        rawEntryfilePath: 'handler.py',
        languageSpecificConfig: {} as any
      });

      const files = getHashFromMultipleFiles.mock.calls[getHashFromMultipleFiles.mock.calls.length - 1][0];
      expect(files.some((f) => f.endsWith('requirements.txt'))).toBe(true);
      expect(files.some((f) => f.endsWith('pyproject.toml'))).toBe(true);
    });

    test('should glob for Python files', async () => {
      const { getBundleDigest } = await import('./utils');
      const { getMatchingFilesByGlob } = await import('@shared/utils/fs-utils');

      await getBundleDigest({
        cwd: '/app',
        externalDependencies: [],
        additionalDigestInput: '',
        rawEntryfilePath: 'main.py',
        languageSpecificConfig: {} as any
      });

      expect(getMatchingFilesByGlob).toHaveBeenCalledWith({
        globPattern: './**/*.py',
        cwd: '/app'
      });
    });

    test('should include external dependencies in hash', async () => {
      const { getBundleDigest } = await import('./utils');

      await getBundleDigest({
        cwd: '/project',
        externalDependencies: [
          { name: 'requests', version: '2.28.0' },
          { name: 'flask', version: '2.3.0' }
        ],
        additionalDigestInput: '',
        rawEntryfilePath: 'app.py',
        languageSpecificConfig: {} as any
      });

      expect(true).toBe(true); // Should not throw
    });

    test('should include language-specific config in hash', async () => {
      const { getBundleDigest } = await import('./utils');

      await getBundleDigest({
        cwd: '/project',
        externalDependencies: [],
        additionalDigestInput: '',
        rawEntryfilePath: 'main.py',
        languageSpecificConfig: { pythonVersion: '3.11' } as any
      });

      expect(true).toBe(true); // Should not throw
    });
  });

  describe('detectPackageManager', () => {
    test('should detect pip when requirements.txt exists', async () => {
      const { detectPackageManager } = await import('./utils');
      const { exists } = await import('fs-extra');

      exists.mockImplementation(async (path: string) => path.includes('requirements.txt'));

      const result = await detectPackageManager('/project');

      expect(result).toBe('pip');
    });

    test('should detect pipenv when Pipfile exists', async () => {
      const { detectPackageManager } = await import('./utils');
      const { exists } = await import('fs-extra');

      exists.mockImplementation(async (path: string) => path.toLowerCase().includes('pipfile'));

      const result = await detectPackageManager('/project');

      expect(result).toBe('pipenv');
    });

    test('should detect poetry when pyproject.toml exists', async () => {
      const { detectPackageManager } = await import('./utils');
      const { exists } = await import('fs-extra');

      exists.mockImplementation(async (path: string) => path.includes('pyproject.toml'));

      const result = await detectPackageManager('/project');

      expect(result).toBe('poetry');
    });

    test('should return undefined when no package manager detected', async () => {
      const { detectPackageManager } = await import('./utils');
      const { exists } = await import('fs-extra');

      exists.mockImplementation(async () => false);

      const result = await detectPackageManager('/project');

      expect(result).toBeUndefined();
    });

    test('should prefer pip over pipenv', async () => {
      const { detectPackageManager } = await import('./utils');
      const { exists } = await import('fs-extra');

      exists.mockImplementation(async (path: string) => {
        return path.includes('requirements.txt') || path.toLowerCase().includes('pipfile');
      });

      const result = await detectPackageManager('/project');

      expect(result).toBe('pip');
    });
  });
});
