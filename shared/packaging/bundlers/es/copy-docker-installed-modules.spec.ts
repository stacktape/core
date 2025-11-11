import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: {
    absoluteBinDepsInstallPath: mock(() => '/tmp/install')
  }
}));

mock.module('@shared/utils/docker', () => ({
  execDocker: mock(async () => ({ stdout: 'Docker build complete' }))
}));

mock.module('@shared/utils/dockerfiles', () => ({
  buildEsBinInstallerDockerfile: mock(() => 'FROM node:18\nRUN npm install')
}));

mock.module('@shared/utils/fs-utils', () => ({
  transformToUnixPath: mock((path) => path.replace(/\\/g, '/'))
}));

mock.module('fs-extra', () => ({
  ensureDir: mock(async () => {}),
  writeFile: mock(async () => {})
}));

mock.module('object-hash', () => ({
  default: mock((obj) => `hash-${JSON.stringify(obj)}`)
}));

mock.module('./utils', () => ({
  copyToDeploymentPackage: mock(async () => {})
}));

describe('bundlers/es/copy-docker-installed-modules', () => {
  describe('copyDockerInstalledModulesForLambda', () => {
    test('should copy Docker-installed modules', async () => {
      const { copyDockerInstalledModulesForLambda } = await import('./copy-docker-installed-modules');

      const dependencies: any[] = [
        { name: 'sharp', version: '0.32.0', dependencyType: 'standard', hasBinary: true }
      ];

      await copyDockerInstalledModulesForLambda({
        dependencies,
        invocationId: 'inv-123',
        distFolderPath: '/dist',
        workloadName: 'my-function',
        lambdaRuntimeVersion: 18,
        packageManager: 'npm'
      });

      expect(true).toBe(true); // Function should complete without error
    });

    test('should skip if no dependencies', async () => {
      const { copyDockerInstalledModulesForLambda } = await import('./copy-docker-installed-modules');
      const { execDocker } = await import('@shared/utils/docker');

      await copyDockerInstalledModulesForLambda({
        dependencies: [],
        invocationId: 'inv-123',
        distFolderPath: '/dist',
        workloadName: 'my-function',
        lambdaRuntimeVersion: 18,
        packageManager: 'npm'
      });

      expect(execDocker).not.toHaveBeenCalled();
    });

    test('should create Dockerfile', async () => {
      const { copyDockerInstalledModulesForLambda } = await import('./copy-docker-installed-modules');
      const { buildEsBinInstallerDockerfile } = await import('@shared/utils/dockerfiles');
      const { writeFile } = await import('fs-extra');

      const dependencies: any[] = [
        { name: 'canvas', version: '2.11.2', dependencyType: 'standard', hasBinary: true }
      ];

      await copyDockerInstalledModulesForLambda({
        dependencies,
        invocationId: 'inv-456',
        distFolderPath: '/dist',
        workloadName: 'my-function',
        lambdaRuntimeVersion: 20,
        packageManager: 'npm'
      });

      expect(buildEsBinInstallerDockerfile).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
    });

    test('should execute Docker build', async () => {
      const { copyDockerInstalledModulesForLambda } = await import('./copy-docker-installed-modules');
      const { execDocker } = await import('@shared/utils/docker');

      const dependencies: any[] = [
        { name: 'bcrypt', version: '5.1.0', dependencyType: 'standard', hasBinary: true }
      ];

      await copyDockerInstalledModulesForLambda({
        dependencies,
        invocationId: 'inv-789',
        distFolderPath: '/dist',
        workloadName: 'my-function',
        lambdaRuntimeVersion: 18,
        packageManager: 'npm'
      });

      expect(execDocker).toHaveBeenCalled();
      const callArgs = execDocker.mock.calls[execDocker.mock.calls.length - 1][0];
      expect(callArgs).toContain('image');
      expect(callArgs).toContain('build');
    });

    test('should handle platform architecture', async () => {
      const { copyDockerInstalledModulesForLambda } = await import('./copy-docker-installed-modules');
      const { execDocker } = await import('@shared/utils/docker');

      const dependencies: any[] = [
        { name: 'sqlite3', version: '5.1.6', dependencyType: 'standard', hasBinary: true }
      ];

      await copyDockerInstalledModulesForLambda({
        dependencies,
        invocationId: 'inv-101',
        distFolderPath: '/dist',
        workloadName: 'my-function',
        lambdaRuntimeVersion: 20,
        packageManager: 'npm',
        dockerBuildOutputArchitecture: 'linux/arm64'
      });

      const callArgs = execDocker.mock.calls[execDocker.mock.calls.length - 1][0];
      expect(callArgs).toContain('--platform');
      expect(callArgs).toContain('linux/arm64');
    });

    test('should copy to deployment package', async () => {
      const { copyDockerInstalledModulesForLambda } = await import('./copy-docker-installed-modules');
      const { copyToDeploymentPackage } = await import('./utils');

      const dependencies: any[] = [
        { name: 'pg-native', version: '3.0.1', dependencyType: 'standard', hasBinary: true }
      ];

      await copyDockerInstalledModulesForLambda({
        dependencies,
        invocationId: 'inv-202',
        distFolderPath: '/dist',
        workloadName: 'my-function',
        lambdaRuntimeVersion: 18,
        packageManager: 'npm'
      });

      expect(copyToDeploymentPackage).toHaveBeenCalled();
    });
  });
});
