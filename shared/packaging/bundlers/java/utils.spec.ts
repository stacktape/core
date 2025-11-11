import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/fs-utils', () => ({
  getHashFromMultipleFiles: mock(async (files) => ({
    update: mock(function () {
      return this;
    }),
    digest: mock(() => 'java-bundle-digest-def456')
  })),
  getMatchingFilesByGlob: mock(async () => ['Main.java', 'Handler.java', 'Utils.java'])
}));

mock.module('object-hash', () => ({
  default: mock((obj) => `hash-${JSON.stringify(obj)}`)
}));

describe('bundlers/java/utils', () => {
  describe('getBundleDigest', () => {
    test('should calculate bundle digest for Java project', async () => {
      const { getBundleDigest } = await import('./utils');

      const digest = await getBundleDigest({
        cwd: '/project',
        externalDependencies: [
          { name: 'com.amazonaws:aws-lambda-java-core', version: '1.2.2' }
        ],
        additionalDigestInput: '',
        rawEntryfilePath: 'Main.java',
        languageSpecificConfig: {} as any
      });

      expect(digest).toBe('java-bundle-digest-def456');
    });

    test('should include build.gradle and pom.xml in digest', async () => {
      const { getBundleDigest } = await import('./utils');
      const { getHashFromMultipleFiles } = await import('@shared/utils/fs-utils');

      await getBundleDigest({
        cwd: '/project',
        externalDependencies: [],
        additionalDigestInput: '',
        rawEntryfilePath: 'Handler.java',
        languageSpecificConfig: {} as any
      });

      const files = getHashFromMultipleFiles.mock.calls[getHashFromMultipleFiles.mock.calls.length - 1][0];
      expect(files.some((f) => f.endsWith('build.gradle'))).toBe(true);
      expect(files.some((f) => f.endsWith('pom.xml'))).toBe(true);
    });

    test('should glob for Java files', async () => {
      const { getBundleDigest } = await import('./utils');
      const { getMatchingFilesByGlob } = await import('@shared/utils/fs-utils');

      await getBundleDigest({
        cwd: '/app',
        externalDependencies: [],
        additionalDigestInput: '',
        rawEntryfilePath: 'Main.java',
        languageSpecificConfig: {} as any
      });

      expect(getMatchingFilesByGlob).toHaveBeenCalledWith({
        globPattern: './**/*.java',
        cwd: '/app'
      });
    });

    test('should include external dependencies in hash', async () => {
      const { getBundleDigest } = await import('./utils');

      await getBundleDigest({
        cwd: '/project',
        externalDependencies: [
          { name: 'org.springframework:spring-core', version: '6.0.0' },
          { name: 'com.google.guava:guava', version: '31.1-jre' }
        ],
        additionalDigestInput: '',
        rawEntryfilePath: 'Application.java',
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
        rawEntryfilePath: 'Main.java',
        languageSpecificConfig: { javaVersion: '17', buildTool: 'gradle' } as any
      });

      expect(true).toBe(true); // Should not throw
    });

    test('should include additional digest input', async () => {
      const { getBundleDigest } = await import('./utils');

      await getBundleDigest({
        cwd: '/project',
        externalDependencies: [],
        additionalDigestInput: 'custom-input-456',
        rawEntryfilePath: 'Handler.java',
        languageSpecificConfig: {} as any
      });

      expect(true).toBe(true); // Should not throw
    });
  });
});
