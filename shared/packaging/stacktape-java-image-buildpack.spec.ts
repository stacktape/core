import { describe, expect, mock, test } from 'bun:test';

mock.module('@shared/utils/docker', () => ({
  buildDockerImage: mock(async () => ({
    size: 250,
    dockerOutput: 'Successfully built image',
    duration: 60,
    created: '2024-01-01T00:00:00Z'
  }))
}));

mock.module('@shared/utils/dockerfiles', () => ({
  buildJavaDockerfile: mock(() => 'FROM openjdk:11\nWORKDIR /app\nCOPY . .\nRUN ./gradlew build')
}));

mock.module('@shared/utils/fs-utils', () => ({
  getFolder: mock((path) => path.split('/').slice(0, -1).join('/'))
}));

mock.module('fs-extra', () => ({
  outputFile: mock(async () => {})
}));

mock.module('./bundlers/java', () => ({
  buildJavaArtifact: mock(async () => ({
    digest: 'java-digest-456',
    outcome: 'bundled',
    distFolderPath: '/dist',
    sourceFiles: []
  }))
}));

describe('stacktape-java-image-buildpack', () => {
  describe('buildUsingStacktapeJavaImageBuildpack', () => {
    test('should build Java Docker image with default Java version', async () => {
      const { buildUsingStacktapeJavaImageBuildpack } = await import('./stacktape-java-image-buildpack');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      const result = await buildUsingStacktapeJavaImageBuildpack({
        name: 'my-java-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/src/main/java/Main.java',
        languageSpecificConfig: {},
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(result).toBeDefined();
      expect(result.outcome).toBe('bundled');
      expect(result.imageName).toBe('my-java-image');
      expect(result.size).toBe(250);
      expect(result.digest).toBe('java-digest-456');
    });

    test('should use specified Java version', async () => {
      const { buildUsingStacktapeJavaImageBuildpack } = await import('./stacktape-java-image-buildpack');
      const { buildJavaArtifact } = await import('./bundlers/java');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapeJavaImageBuildpack({
        name: 'my-java-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/src/main/java/Main.java',
        languageSpecificConfig: { javaVersion: 17 },
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(buildJavaArtifact).toHaveBeenCalledWith(
        expect.objectContaining({ javaVersion: 17 })
      );
    });

    test('should handle skipped outcome', async () => {
      const { buildUsingStacktapeJavaImageBuildpack } = await import('./stacktape-java-image-buildpack');
      const { buildJavaArtifact } = await import('./bundlers/java');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      buildJavaArtifact.mockResolvedValueOnce({
        digest: 'java-digest-456',
        outcome: 'skipped',
        distFolderPath: '/dist',
        sourceFiles: []
      });

      const result = await buildUsingStacktapeJavaImageBuildpack({
        name: 'my-java-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/src/main/java/Main.java',
        languageSpecificConfig: {},
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: ['java-digest-456'],
        additionalDigestInput: ''
      } as any);

      expect(result.outcome).toBe('skipped');
      expect(result.size).toBe(null);
    });

    test('should extract root source path from entryfile path', async () => {
      const { buildUsingStacktapeJavaImageBuildpack } = await import('./stacktape-java-image-buildpack');
      const { buildJavaArtifact } = await import('./bundlers/java');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapeJavaImageBuildpack({
        name: 'my-java-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/src/main/java/com/example/Main.java',
        languageSpecificConfig: {},
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(buildJavaArtifact).toHaveBeenCalledWith(
        expect.objectContaining({ sourcePath: '/project/' })
      );
    });

    test('should support Maven build', async () => {
      const { buildUsingStacktapeJavaImageBuildpack } = await import('./stacktape-java-image-buildpack');
      const { buildJavaArtifact } = await import('./bundlers/java');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapeJavaImageBuildpack({
        name: 'my-java-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/src/main/java/Main.java',
        languageSpecificConfig: { useMaven: true },
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(buildJavaArtifact).toHaveBeenCalledWith(
        expect.objectContaining({ useMaven: true })
      );
    });

    test('should use Alpine when glibc not required', async () => {
      const { buildUsingStacktapeJavaImageBuildpack } = await import('./stacktape-java-image-buildpack');
      const { buildJavaDockerfile } = await import('@shared/utils/dockerfiles');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapeJavaImageBuildpack({
        name: 'my-java-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/src/main/java/Main.java',
        languageSpecificConfig: {},
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        additionalDigestInput: '',
        requiresGlibcBinaries: false
      } as any);

      expect(buildJavaDockerfile).toHaveBeenCalledWith(
        expect.objectContaining({ alpine: true })
      );
    });

    test('should build Docker image with correct context', async () => {
      const { buildUsingStacktapeJavaImageBuildpack } = await import('./stacktape-java-image-buildpack');
      const { buildDockerImage } = await import('@shared/utils/docker');
      const mockProgressLogger: any = {
        startEvent: mock(async () => {}),
        finishEvent: mock(async () => {})
      };

      await buildUsingStacktapeJavaImageBuildpack({
        name: 'my-java-image',
        progressLogger: mockProgressLogger,
        entryfilePath: '/project/src/main/java/Main.java',
        languageSpecificConfig: {},
        cwd: '/project',
        distFolderPath: '/dist',
        existingDigests: [],
        additionalDigestInput: ''
      } as any);

      expect(buildDockerImage).toHaveBeenCalledWith(
        expect.objectContaining({
          imageTag: 'my-java-image',
          buildContextPath: '/dist'
        })
      );
    });
  });
});
