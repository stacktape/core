import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/docker', () => ({
  execDocker: mock(async () => ({ stdout: 'Build complete' }))
}));

mock.module('@shared/utils/dockerfiles', () => ({
  buildPythonArtifactDockerfile: mock(() => 'FROM python:3.11-slim\nWORKDIR /app')
}));

mock.module('@shared/utils/fs-utils', () => ({
  transformToUnixPath: mock((path) => path.replace(/\\/g, '/'))
}));

mock.module('@shared/utils/misc', () => ({
  raiseError: mock((opts) => {
    throw new Error(opts.message);
  })
}));

mock.module('fs-extra', () => ({
  outputFile: mock(async () => {})
}));

mock.module('object-hash', () => ({
  default: mock((obj) => `hash-${JSON.stringify(obj)}`)
}));

mock.module('./utils', () => ({
  detectPackageManager: mock(async () => 'pip'),
  getBundleDigest: mock(async () => 'py-digest-789')
}));

describe('bundlers/py/index', () => {
  describe('buildPythonArtifact', () => {
    test('should build Python artifact', async () => {
      const { buildPythonArtifact } = await import('./index');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildPythonArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'main.py',
        pythonVersion: '3.11',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false
      });

      expect(result).toBeDefined();
      expect(result.outcome).toBe('bundled');
    });

    test('should skip if digest exists', async () => {
      const { buildPythonArtifact } = await import('./index');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildPythonArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: ['py-digest-789'],
        rawEntryfilePath: 'handler.py',
        pythonVersion: '3.11',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false
      });

      expect(result.outcome).toBe('skipped');
    });

    test('should auto-detect package manager', async () => {
      const { buildPythonArtifact } = await import('./index');
      const { detectPackageManager } = await import('./utils');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildPythonArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'app.py',
        pythonVersion: '3.10',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false
      });

      expect(detectPackageManager).toHaveBeenCalled();
    });

    test('should throw error if package manager not detected', async () => {
      const { buildPythonArtifact } = await import('./index');
      const { detectPackageManager } = await import('./utils');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      detectPackageManager.mockResolvedValueOnce(undefined);

      await expect(
        buildPythonArtifact({
          sourcePath: '/src',
          distFolderPath: '/dist',
          cwd: '/project',
          additionalDigestInput: '',
          progressLogger: mockProgressLogger,
          existingDigests: [],
          rawEntryfilePath: 'main.py',
          pythonVersion: '3.11',
          languageSpecificConfig: {},
          requiresGlibcBinaries: false
        })
      ).rejects.toThrow();
    });

    test('should use provided package manager', async () => {
      const { buildPythonArtifact } = await import('./index');
      const { detectPackageManager } = await import('./utils');
      const { buildPythonArtifactDockerfile } = await import('@shared/utils/dockerfiles');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildPythonArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'main.py',
        pythonVersion: '3.11',
        packageManager: 'poetry',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false
      });

      expect(detectPackageManager).not.toHaveBeenCalled();
      const callArgs = buildPythonArtifactDockerfile.mock.calls[buildPythonArtifactDockerfile.mock.calls.length - 1][0];
      expect(callArgs.packageManager).toBe('poetry');
    });

    test('should execute Docker build', async () => {
      const { buildPythonArtifact } = await import('./index');
      const { execDocker } = await import('@shared/utils/docker');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildPythonArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'main.py',
        pythonVersion: '3.11',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false
      });

      expect(execDocker).toHaveBeenCalled();
      const callArgs = execDocker.mock.calls[0][0];
      expect(callArgs).toContain('image');
      expect(callArgs).toContain('build');
    });

    test('should handle platform architecture', async () => {
      const { buildPythonArtifact } = await import('./index');
      const { execDocker } = await import('@shared/utils/docker');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildPythonArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'main.py',
        pythonVersion: '3.11',
        languageSpecificConfig: {},
        requiresGlibcBinaries: false,
        dockerBuildOutputArchitecture: 'linux/arm64'
      });

      const callArgs = execDocker.mock.calls[execDocker.mock.calls.length - 1][0];
      expect(callArgs).toContain('--platform');
      expect(callArgs).toContain('linux/arm64');
    });

    test('should support minify option', async () => {
      const { buildPythonArtifact } = await import('./index');
      const { buildPythonArtifactDockerfile } = await import('@shared/utils/dockerfiles');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildPythonArtifact({
        sourcePath: '/src',
        distFolderPath: '/dist',
        cwd: '/project',
        additionalDigestInput: '',
        progressLogger: mockProgressLogger,
        existingDigests: [],
        rawEntryfilePath: 'main.py',
        pythonVersion: '3.11',
        languageSpecificConfig: { minify: false },
        requiresGlibcBinaries: false
      });

      const callArgs = buildPythonArtifactDockerfile.mock.calls[buildPythonArtifactDockerfile.mock.calls.length - 1][0];
      expect(callArgs.minify).toBe(false);
    });
  });
});
