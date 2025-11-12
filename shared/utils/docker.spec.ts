import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Mock Dockerode
const mockDockerClient = {
  listImages: mock(async () => [
    { RepoTags: ['test:latest'], Size: 1024000, Id: 'sha256:123', Created: 1234567890 }
  ]),
  getContainer: mock((name) => ({
    inspect: mock(async () => ({ Id: name })),
    stop: mock(async () => {})
  })),
  listContainers: mock(async () => []),
  buildImage: mock(async () => ({ on: mock(() => ({ on: mock(() => {}) })) })),
  info: mock(async () => ({ ServerVersion: '20.10.0' }))
};

mock.module('dockerode', () => ({
  default: mock(function () {
    return mockDockerClient;
  })
}));

mock.module('./exec', () => ({
  exec: mock(async () => ({ stdout: '', stderr: '', exitCode: 0 }))
}));

mock.module('./fs-utils', () => ({
  getAllFilesInDir: mock(async () => ['file1.ts', 'file2.ts'])
}));

describe('docker', () => {
  describe('handleDockerError', () => {
    test('should handle docker daemon connection error', () => {
      const { handleDockerError } = require('./docker');
      const error = new Error('connect ENOENT pipe/docker_engine');

      expect(() => handleDockerError(error)).toThrow("Can't connect to the docker daemon");
    });

    test('should handle rate limit error', () => {
      const { handleDockerError } = require('./docker');
      const error = new Error('unauthenticated pull rate limit');

      expect(() => handleDockerError(error)).toThrow();
    });

    test('should throw generic docker error for unknown errors', () => {
      const { handleDockerError } = require('./docker');
      const error = new Error('unknown error');

      expect(() => handleDockerError(error)).toThrow('unknown error');
    });
  });

  describe('getDockerImageDetails', () => {
    test('should get image details by tag', async () => {
      const { getDockerImageDetails } = await import('./docker');
      const details = await getDockerImageDetails('test:latest');

      expect(details).toBeDefined();
      expect(details.id).toBe('sha256:123');
    });
  });

  describe('execDocker', () => {
    test('should execute docker command', async () => {
      const { execDocker } = await import('./docker');
      const { exec } = await import('./exec');

      await execDocker(['build', '-t', 'myimage', '.']);

      expect(exec).toHaveBeenCalledWith('docker', ['build', '-t', 'myimage', '.'], expect.any(Object));
    });
  });

  describe('inspectDockerContainer', () => {
    test('should inspect container', async () => {
      const { inspectDockerContainer } = await import('./docker');
      const info = await inspectDockerContainer('test-container');

      expect(info).toBeDefined();
      expect(info.Id).toBe('test-container');
    });

    test('should return empty object for non-existent container', async () => {
      const containerMock = {
        inspect: mock(async () => {
          throw new Error('no such container');
        })
      };
      mockDockerClient.getContainer = mock(() => containerMock);

      const { inspectDockerContainer } = await import('./docker');
      const info = await inspectDockerContainer('nonexistent');

      expect(info).toEqual({});
    });
  });

  describe('listDockerContainers', () => {
    test('should list all containers', async () => {
      const { listDockerContainers } = await import('./docker');
      const containers = await listDockerContainers();

      expect(containers).toEqual([]);
      expect(mockDockerClient.listContainers).toHaveBeenCalled();
    });
  });

  describe('stopDockerContainer', () => {
    test('should stop container with timeout', async () => {
      const { stopDockerContainer } = await import('./docker');
      await stopDockerContainer('test-container', 10);

      const containerMock = mockDockerClient.getContainer('test-container');
      expect(containerMock.stop).toHaveBeenCalledWith({ t: 10, signal: 'SIGTERM' });
    });
  });

  describe('dockerLogin', () => {
    test('should login to docker registry', async () => {
      const { dockerLogin } = await import('./docker');
      const { exec } = await import('./exec');

      await dockerLogin({
        user: 'testuser',
        password: 'testpass',
        proxyEndpoint: 'https://registry.example.com'
      });

      expect(exec).toHaveBeenCalledWith(
        'docker',
        ['login', '-u', 'testuser', '-p', 'testpass', 'https://registry.example.com'],
        expect.any(Object)
      );
    });
  });

  describe('tagDockerImage', () => {
    test('should tag docker image', async () => {
      const { tagDockerImage } = await import('./docker');
      const { exec } = await import('./exec');

      await tagDockerImage('source:latest', 'target:latest');

      expect(exec).toHaveBeenCalledWith('docker', ['tag', 'source:latest', 'target:latest'], expect.any(Object));
    });
  });

  describe('pushDockerImage', () => {
    test('should push docker image', async () => {
      const { pushDockerImage } = await import('./docker');
      const { exec } = await import('./exec');

      await pushDockerImage('myrepo/myimage:tag');

      expect(exec).toHaveBeenCalledWith('docker', ['push', 'myrepo/myimage:tag'], expect.any(Object));
    });
  });

  describe('isDockerRunning', () => {
    test('should return true when docker is running', async () => {
      const { isDockerRunning } = await import('./docker');
      const isRunning = await isDockerRunning();

      expect(isRunning).toBe(true);
    });

    test('should return false when docker is not running', async () => {
      mockDockerClient.info = mock(async () => {
        throw new Error('Docker not running');
      });

      const { isDockerRunning } = await import('./docker');
      const isRunning = await isDockerRunning();

      expect(isRunning).toBe(false);
    });
  });
});
