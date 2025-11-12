import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/docker', () => ({
  execDocker: mock(async () => ({ stdout: 'Build complete' }))
}));

mock.module('@shared/utils/dockerfiles', () => ({
  buildJavaArtifactDockerfile: mock(() => 'FROM eclipse-temurin:17-jdk\nWORKDIR /app')
}));

mock.module('@shared/utils/fs-utils', () => ({
  transformToUnixPath: mock((path) => path.replace(/\\/g, '/'))
}));

mock.module('fs-extra', () => ({
  outputFile: mock(async () => {}),
  remove: mock(async () => {})
}));

mock.module('object-hash', () => ({
  default: mock((obj) => `hash-${JSON.stringify(obj)}`)
}));

mock.module('./utils', () => ({
  getBundleDigest: mock(async () => 'java-digest-456')
}));

describe('bundlers/java/index', () => {
  describe('buildJavaArtifact', () => {
    test('should build Java artifact', async () => {
      const { buildJavaArtifact } = await import('./index');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildJavaArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'Main.java',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false
      });

      expect(result).toBeDefined();
      expect(result.outcome).toBe('bundled');
    });

    test('should skip if digest exists', async () => {
      const { buildJavaArtifact } = await import('./index');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildJavaArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: ['java-digest-456'],
        rawEntryfilePath: 'Handler.java',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false
      });

      expect(result.outcome).toBe('skipped');
    });

    test('should create init.gradle file', async () => {
      const { buildJavaArtifact } = await import('./index');
      const { outputFile } = await import('fs-extra');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildJavaArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'Main.java',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false
      });

      expect(outputFile).toHaveBeenCalled();
    });

    test('should remove init.gradle after build', async () => {
      const { buildJavaArtifact } = await import('./index');
      const { remove } = await import('fs-extra');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildJavaArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'Application.java',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false
      });

      expect(remove).toHaveBeenCalled();
    });

    test('should execute Docker build', async () => {
      const { buildJavaArtifact } = await import('./index');
      const { execDocker } = await import('@shared/utils/docker');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildJavaArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'Main.java',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false
      });

      expect(execDocker).toHaveBeenCalled();
      const callArgs = execDocker.mock.calls[0][0];
      expect(callArgs).toContain('image');
      expect(callArgs).toContain('build');
    });

    test('should support Maven', async () => {
      const { buildJavaArtifact } = await import('./index');
      const { buildJavaArtifactDockerfile } = await import('@shared/utils/dockerfiles');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildJavaArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'Main.java',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false,
        useMaven: true
      });

      const callArgs = buildJavaArtifactDockerfile.mock.calls[buildJavaArtifactDockerfile.mock.calls.length - 1][0];
      expect(callArgs.useMaven).toBe(true);
    });

    test('should handle platform architecture', async () => {
      const { buildJavaArtifact } = await import('./index');
      const { execDocker } = await import('@shared/utils/docker');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildJavaArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'Main.java',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false,
        dockerBuildOutputArchitecture: 'linux/amd64'
      });

      const callArgs = execDocker.mock.calls[execDocker.mock.calls.length - 1][0];
      expect(callArgs).toContain('--platform');
      expect(callArgs).toContain('linux/amd64');
    });
  });
});
