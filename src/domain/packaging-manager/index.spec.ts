import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock all dependencies
const mockDockerRunOnce = mock();
const mockBuildUsingCustomDockerfileImageBuildpack = mock();
const mockBuildUsingExternalBuildpackImageBuildpack = mock();
const mockBuildUsingNixpacksImageBuildpack = mock();
const mockBuildUsingCustomArtifact = mock();
const mockBuildUsingStacktapeEsLambdaBuildpack = mock();
const mockBuildUsingStacktapeEsImageBuildpack = mock();
const mockBuildUsingStacktapePythonLambdaBuildpack = mock();
const mockBuildUsingStacktapePythonImageBuildpack = mock();
const mockBuildUsingStacktapeJavaLambdaBuildpack = mock();
const mockBuildUsingStacktapeJavaImageBuildpack = mock();
const mockBuildUsingStacktapeGoLambdaBuildpack = mock();
const mockBuildUsingStacktapeGoImageBuildpack = mock();
const mockBuildUsingStacktapeNextjsWebImageBuildpack = mock();

mock.module('@shared/utils/docker', () => ({
  dockerRunOnce: mockDockerRunOnce
}));

mock.module('@shared/packaging/custom-dockerfile-image-buildpack', () => ({
  buildUsingCustomDockerfileImageBuildpack: mockBuildUsingCustomDockerfileImageBuildpack
}));

mock.module('@shared/packaging/external-buildpack-image-buildpack', () => ({
  buildUsingExternalBuildpackImageBuildpack: mockBuildUsingExternalBuildpackImageBuildpack
}));

mock.module('@shared/packaging/nixpacks-image-buildpack', () => ({
  buildUsingNixpacksImageBuildpack: mockBuildUsingNixpacksImageBuildpack
}));

mock.module('@shared/packaging/custom-artifact', () => ({
  buildUsingCustomArtifact: mockBuildUsingCustomArtifact
}));

mock.module('@shared/packaging/stacktape-es-lambda-buildpack', () => ({
  buildUsingStacktapeEsLambdaBuildpack: mockBuildUsingStacktapeEsLambdaBuildpack
}));

mock.module('@shared/packaging/stacktape-es-image-buildpack', () => ({
  buildUsingStacktapeEsImageBuildpack: mockBuildUsingStacktapeEsImageBuildpack
}));

mock.module('@shared/packaging/stacktape-python-lambda-buildpack', () => ({
  buildUsingStacktapePythonLambdaBuildpack: mockBuildUsingStacktapePythonLambdaBuildpack
}));

mock.module('@shared/packaging/stacktape-python-image-buildpack', () => ({
  buildUsingStacktapePythonImageBuildpack: mockBuildUsingStacktapePythonImageBuildpack
}));

mock.module('@shared/packaging/stacktape-java-lambda-buildpack', () => ({
  buildUsingStacktapeJavaLambdaBuildpack: mockBuildUsingStacktapeJavaLambdaBuildpack
}));

mock.module('@shared/packaging/stacktape-java-image-buildpack', () => ({
  buildUsingStacktapeJavaImageBuildpack: mockBuildUsingStacktapeJavaImageBuildpack
}));

mock.module('@shared/packaging/stacktape-go-lambda-buildpack', () => ({
  buildUsingStacktapeGoLambdaBuildpack: mockBuildUsingStacktapeGoLambdaBuildpack
}));

mock.module('@shared/packaging/stacktape-go-image-buildpack', () => ({
  buildUsingStacktapeGoImageBuildpack: mockBuildUsingStacktapeGoImageBuildpack
}));

mock.module('@shared/packaging/stacktape-nextjs-web-image-buildpack', () => ({
  buildUsingStacktapeNextjsWebImageBuildpack: mockBuildUsingStacktapeNextjsWebImageBuildpack
}));

const mockGlobalStateManager = {
  invocationId: 'test-invocation-123',
  projectAbsolutePath: '/test/project',
  stackName: 'test-stack',
  stage: 'test',
  region: 'us-east-1'
};

const mockConfigManager = {
  config: {
    resources: {
      myFunction: {
        type: 'function',
        properties: {
          packaging: {
            type: 'stacktape-lambda-buildpack',
            properties: { entryfilePath: 'src/lambda.ts' }
          }
        }
      },
      myContainer: {
        type: 'batch-job',
        properties: {
          packaging: {
            type: 'stacktape-image-buildpack',
            properties: { entryfilePath: 'src/app.js' }
          },
          resources: { cpu: 1024, memory: 2048 }
        }
      }
    }
  }
};

const mockEc2Manager = {
  ec2InstanceTypes: [
    {
      InstanceType: 't3.small',
      ProcessorInfo: { SupportedArchitectures: ['x86_64'] }
    },
    {
      InstanceType: 't4g.small',
      ProcessorInfo: { SupportedArchitectures: ['arm64'] }
    }
  ]
};

const mockFsPaths = {
  absoluteLambdaArtifactFolderPath: mock(() => '/tmp/lambda-artifacts'),
  absoluteContainerArtifactFolderPath: mock(() => '/tmp/container-artifacts')
};

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: mockGlobalStateManager
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: mockConfigManager
}));

mock.module('@domain-services/ec2-manager', () => ({
  ec2Manager: mockEc2Manager
}));

mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: mockFsPaths
}));

describe('PackagingManager', () => {
  let packagingManager: any;

  beforeEach(async () => {
    mock.restore();
    mockDockerRunOnce.mockClear();
    mockBuildUsingCustomDockerfileImageBuildpack.mockClear();
    mockBuildUsingExternalBuildpackImageBuildpack.mockClear();
    mockBuildUsingNixpacksImageBuildpack.mockClear();
    mockBuildUsingCustomArtifact.mockClear();
    mockBuildUsingStacktapeEsLambdaBuildpack.mockClear();
    mockBuildUsingStacktapeEsImageBuildpack.mockClear();
    mockBuildUsingStacktapePythonLambdaBuildpack.mockClear();
    mockBuildUsingStacktapePythonImageBuildpack.mockClear();
    mockBuildUsingStacktapeJavaLambdaBuildpack.mockClear();
    mockBuildUsingStacktapeJavaImageBuildpack.mockClear();
    mockBuildUsingStacktapeGoLambdaBuildpack.mockClear();
    mockBuildUsingStacktapeGoImageBuildpack.mockClear();
    mockBuildUsingStacktapeNextjsWebImageBuildpack.mockClear();
    mockFsPaths.absoluteLambdaArtifactFolderPath.mockClear();
    mockFsPaths.absoluteContainerArtifactFolderPath.mockClear();

    const module = await import('./index');
    packagingManager = module.packagingManager;
    await packagingManager.init({});
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      const { PackagingManager } = await import('./index');
      const manager = new PackagingManager();
      await manager.init({});
      expect(manager).toBeDefined();
    });

    test('should initialize packaged jobs array', async () => {
      expect(packagingManager).toBeDefined();
    });
  });

  describe('clearPackagedJobs', () => {
    test('should clear packaged jobs array', async () => {
      packagingManager.clearPackagedJobs();
      const output = packagingManager.getPackagingOutputForJob({ jobName: 'nonexistent' });
      expect(output).toBeUndefined();
    });
  });

  describe('getPackagingOutputForJob', () => {
    test('should return undefined when job not found', () => {
      const output = packagingManager.getPackagingOutputForJob({ jobName: 'nonexistent' });
      expect(output).toBeUndefined();
    });

    test('should return packaging output for existing job', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValueOnce({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda.zip',
        digest: 'abc123',
        jobName: 'myFunction'
      });

      await packagingManager.packageWorkload({
        jobName: 'myFunction',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/lambda.ts' }
        }
      });

      const output = packagingManager.getPackagingOutputForJob({ jobName: 'myFunction' });
      expect(output).toBeDefined();
      expect(output.jobName).toBe('myFunction');
      expect(output.artifactPath).toBe('/tmp/lambda.zip');
    });
  });

  describe('packageAllWorkloads', () => {
    test('should package all workloads in parallel', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda.zip',
        digest: 'abc123',
        jobName: 'myFunction'
      });

      mockBuildUsingStacktapeEsImageBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/container',
        digest: 'def456',
        jobName: 'myContainer'
      });

      const workloads = [
        {
          jobName: 'myFunction',
          packagingConfig: {
            type: 'stacktape-lambda-buildpack',
            properties: { entryfilePath: 'src/lambda.ts' }
          }
        },
        {
          jobName: 'myContainer',
          packagingConfig: {
            type: 'stacktape-image-buildpack',
            properties: { entryfilePath: 'src/app.js' }
          },
          resources: { cpu: 1024, memory: 2048 }
        }
      ];

      await packagingManager.packageAllWorkloads({ workloads });

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalledTimes(1);
      expect(mockBuildUsingStacktapeEsImageBuildpack).toHaveBeenCalledTimes(1);

      const func = packagingManager.getPackagingOutputForJob({ jobName: 'myFunction' });
      expect(func).toBeDefined();

      const container = packagingManager.getPackagingOutputForJob({ jobName: 'myContainer' });
      expect(container).toBeDefined();
    });

    test('should handle empty workloads array', async () => {
      await packagingManager.packageAllWorkloads({ workloads: [] });
      expect(mockBuildUsingStacktapeEsLambdaBuildpack).not.toHaveBeenCalled();
    });

    test('should track skipped packaging jobs', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValue({
        outcome: 'skipped',
        artifactPath: '/tmp/lambda.zip',
        digest: 'abc123',
        jobName: 'myFunction'
      });

      const workloads = [
        {
          jobName: 'myFunction',
          packagingConfig: {
            type: 'stacktape-lambda-buildpack',
            properties: { entryfilePath: 'src/lambda.ts' }
          }
        }
      ];

      await packagingManager.packageAllWorkloads({ workloads });

      const output = packagingManager.getPackagingOutputForJob({ jobName: 'myFunction' });
      expect(output.skipped).toBe(true);
    });
  });

  describe('installMissingDockerBuildPlatforms', () => {
    test('should install missing Docker build platforms', async () => {
      mockDockerRunOnce.mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: ''
      });

      await packagingManager.installMissingDockerBuildPlatforms({
        platforms: ['linux/amd64', 'linux/arm64']
      });

      expect(mockDockerRunOnce).toHaveBeenCalled();
    });

    test('should handle platform installation when no platforms needed', async () => {
      await packagingManager.installMissingDockerBuildPlatforms({ platforms: [] });
      expect(mockDockerRunOnce).not.toHaveBeenCalled();
    });

    test('should install unique platforms only', async () => {
      mockDockerRunOnce.mockResolvedValue({
        exitCode: 0,
        stdout: '',
        stderr: ''
      });

      await packagingManager.installMissingDockerBuildPlatforms({
        platforms: ['linux/amd64', 'linux/amd64', 'linux/arm64']
      });

      expect(mockDockerRunOnce).toHaveBeenCalled();
    });
  });

  describe('repackageSkippedPackagingJobsCurrentlyUsingHotSwapDeploy', () => {
    test('should repackage skipped jobs with hotswap deploy', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack
        .mockResolvedValueOnce({
          outcome: 'skipped',
          artifactPath: '/tmp/lambda.zip',
          digest: 'abc123',
          jobName: 'myFunction',
          usedHotSwapDeployment: true
        })
        .mockResolvedValueOnce({
          outcome: 'packaged',
          artifactPath: '/tmp/lambda-new.zip',
          digest: 'xyz789',
          jobName: 'myFunction'
        });

      await packagingManager.packageWorkload({
        jobName: 'myFunction',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/lambda.ts' }
        },
        hotSwapDeploy: true
      });

      await packagingManager.repackageSkippedPackagingJobsCurrentlyUsingHotSwapDeploy();

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalledTimes(2);
    });

    test('should not repackage jobs without hotswap flag', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValueOnce({
        outcome: 'skipped',
        artifactPath: '/tmp/lambda.zip',
        digest: 'abc123',
        jobName: 'myFunction',
        usedHotSwapDeployment: false
      });

      await packagingManager.packageWorkload({
        jobName: 'myFunction',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/lambda.ts' }
        },
        hotSwapDeploy: false
      });

      await packagingManager.repackageSkippedPackagingJobsCurrentlyUsingHotSwapDeploy();

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalledTimes(1);
    });
  });

  describe('packageNextjsWeb', () => {
    test('should package Next.js web application', async () => {
      mockBuildUsingStacktapeNextjsWebImageBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/nextjs-app',
        digest: 'nextjs123',
        jobName: 'myNextjsApp'
      });

      await packagingManager.packageNextjsWeb({
        jobName: 'myNextjsApp',
        packagingConfig: {
          type: 'stacktape-nextjs-web-buildpack',
          properties: { entryfilePath: 'app' }
        },
        resources: { cpu: 2048, memory: 4096 },
        targetCpuArchitecture: 'linux/amd64'
      });

      expect(mockBuildUsingStacktapeNextjsWebImageBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'myNextjsApp',
          targetCpuArchitecture: 'linux/amd64'
        })
      );

      const output = packagingManager.getPackagingOutputForJob({ jobName: 'myNextjsApp' });
      expect(output).toBeDefined();
      expect(output.digest).toBe('nextjs123');
    });

    test('should handle Next.js packaging with ARM architecture', async () => {
      mockBuildUsingStacktapeNextjsWebImageBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/nextjs-app',
        digest: 'nextjs456',
        jobName: 'myNextjsAppArm'
      });

      await packagingManager.packageNextjsWeb({
        jobName: 'myNextjsAppArm',
        packagingConfig: {
          type: 'stacktape-nextjs-web-buildpack',
          properties: { entryfilePath: 'app' }
        },
        resources: { cpu: 2048, memory: 4096 },
        targetCpuArchitecture: 'linux/arm64'
      });

      expect(mockBuildUsingStacktapeNextjsWebImageBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          targetCpuArchitecture: 'linux/arm64'
        })
      );
    });
  });

  describe('packageWorkload - custom-dockerfile', () => {
    test('should package with custom Dockerfile', async () => {
      mockBuildUsingCustomDockerfileImageBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/custom-image',
        digest: 'custom123',
        jobName: 'customContainer'
      });

      await packagingManager.packageWorkload({
        jobName: 'customContainer',
        packagingConfig: {
          type: 'custom-dockerfile',
          properties: {
            dockerfilePath: 'Dockerfile',
            buildContextPath: '.'
          }
        },
        resources: { cpu: 1024, memory: 2048 },
        targetCpuArchitecture: 'linux/amd64'
      });

      expect(mockBuildUsingCustomDockerfileImageBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'customContainer',
          dockerfilePath: 'Dockerfile',
          buildContextPath: '.'
        })
      );

      const output = packagingManager.getPackagingOutputForJob({ jobName: 'customContainer' });
      expect(output).toBeDefined();
    });
  });

  describe('packageWorkload - external-buildpack', () => {
    test('should package with external buildpack', async () => {
      mockBuildUsingExternalBuildpackImageBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/external-image',
        digest: 'external123',
        jobName: 'externalContainer'
      });

      await packagingManager.packageWorkload({
        jobName: 'externalContainer',
        packagingConfig: {
          type: 'external-buildpack',
          properties: {
            builder: 'paketobuildpacks/builder:base',
            buildpacks: ['paketo-buildpacks/nodejs']
          }
        },
        resources: { cpu: 1024, memory: 2048 },
        targetCpuArchitecture: 'linux/amd64'
      });

      expect(mockBuildUsingExternalBuildpackImageBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'externalContainer',
          builder: 'paketobuildpacks/builder:base'
        })
      );
    });
  });

  describe('packageWorkload - nixpacks', () => {
    test('should package with Nixpacks', async () => {
      mockBuildUsingNixpacksImageBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/nixpacks-image',
        digest: 'nixpacks123',
        jobName: 'nixpacksContainer'
      });

      await packagingManager.packageWorkload({
        jobName: 'nixpacksContainer',
        packagingConfig: {
          type: 'nixpacks',
          properties: { entryfilePath: 'src/app.ts' }
        },
        resources: { cpu: 1024, memory: 2048 },
        targetCpuArchitecture: 'linux/amd64'
      });

      expect(mockBuildUsingNixpacksImageBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'nixpacksContainer'
        })
      );
    });
  });

  describe('packageWorkload - custom-artifact', () => {
    test('should package custom artifact', async () => {
      mockBuildUsingCustomArtifact.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/custom-artifact.zip',
        digest: 'artifact123',
        jobName: 'customArtifact'
      });

      await packagingManager.packageWorkload({
        jobName: 'customArtifact',
        packagingConfig: {
          type: 'custom-artifact',
          properties: { artifactPath: 'dist/app.zip' }
        }
      });

      expect(mockBuildUsingCustomArtifact).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'customArtifact',
          artifactPath: 'dist/app.zip'
        })
      );
    });
  });

  describe('packageWorkload - ES buildpack (JavaScript/TypeScript)', () => {
    test('should package TypeScript Lambda with ES buildpack', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda.zip',
        digest: 'eslambda123',
        jobName: 'tsLambda'
      });

      await packagingManager.packageWorkload({
        jobName: 'tsLambda',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/handler.ts' }
        }
      });

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'tsLambda',
          entryfilePath: 'src/handler.ts'
        })
      );
    });

    test('should package JavaScript Lambda with ES buildpack', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda.zip',
        digest: 'eslambda456',
        jobName: 'jsLambda'
      });

      await packagingManager.packageWorkload({
        jobName: 'jsLambda',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/handler.js' }
        }
      });

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalled();
    });

    test('should package JSX Lambda with ES buildpack', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda.zip',
        digest: 'eslambda789',
        jobName: 'jsxLambda'
      });

      await packagingManager.packageWorkload({
        jobName: 'jsxLambda',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/handler.jsx' }
        }
      });

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalled();
    });

    test('should package TypeScript container with ES image buildpack', async () => {
      mockBuildUsingStacktapeEsImageBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/container',
        digest: 'esimage123',
        jobName: 'tsContainer'
      });

      await packagingManager.packageWorkload({
        jobName: 'tsContainer',
        packagingConfig: {
          type: 'stacktape-image-buildpack',
          properties: { entryfilePath: 'src/app.ts' }
        },
        resources: { cpu: 1024, memory: 2048 },
        targetCpuArchitecture: 'linux/amd64'
      });

      expect(mockBuildUsingStacktapeEsImageBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'tsContainer',
          entryfilePath: 'src/app.ts'
        })
      );
    });

    test('should package MJS module with ES buildpack', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda.zip',
        digest: 'mjs123',
        jobName: 'mjsLambda'
      });

      await packagingManager.packageWorkload({
        jobName: 'mjsLambda',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/handler.mjs' }
        }
      });

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalled();
    });
  });

  describe('packageWorkload - Python buildpack', () => {
    test('should package Python Lambda with Python buildpack', async () => {
      mockBuildUsingStacktapePythonLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/python-lambda.zip',
        digest: 'pylambda123',
        jobName: 'pyLambda'
      });

      await packagingManager.packageWorkload({
        jobName: 'pyLambda',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/handler.py' }
        }
      });

      expect(mockBuildUsingStacktapePythonLambdaBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'pyLambda',
          entryfilePath: 'src/handler.py'
        })
      );
    });

    test('should package Python container with Python image buildpack', async () => {
      mockBuildUsingStacktapePythonImageBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/python-container',
        digest: 'pyimage123',
        jobName: 'pyContainer'
      });

      await packagingManager.packageWorkload({
        jobName: 'pyContainer',
        packagingConfig: {
          type: 'stacktape-image-buildpack',
          properties: { entryfilePath: 'src/app.py' }
        },
        resources: { cpu: 1024, memory: 2048 },
        targetCpuArchitecture: 'linux/amd64'
      });

      expect(mockBuildUsingStacktapePythonImageBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'pyContainer',
          entryfilePath: 'src/app.py'
        })
      );
    });
  });

  describe('packageWorkload - Java buildpack', () => {
    test('should package Java Lambda with Java buildpack', async () => {
      mockBuildUsingStacktapeJavaLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/java-lambda.zip',
        digest: 'javalambda123',
        jobName: 'javaLambda'
      });

      await packagingManager.packageWorkload({
        jobName: 'javaLambda',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/Handler.java' }
        }
      });

      expect(mockBuildUsingStacktapeJavaLambdaBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'javaLambda',
          entryfilePath: 'src/Handler.java'
        })
      );
    });

    test('should package Java container with Java image buildpack', async () => {
      mockBuildUsingStacktapeJavaImageBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/java-container',
        digest: 'javaimage123',
        jobName: 'javaContainer'
      });

      await packagingManager.packageWorkload({
        jobName: 'javaContainer',
        packagingConfig: {
          type: 'stacktape-image-buildpack',
          properties: { entryfilePath: 'src/App.java' }
        },
        resources: { cpu: 1024, memory: 2048 },
        targetCpuArchitecture: 'linux/amd64'
      });

      expect(mockBuildUsingStacktapeJavaImageBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'javaContainer',
          entryfilePath: 'src/App.java'
        })
      );
    });
  });

  describe('packageWorkload - Go buildpack', () => {
    test('should package Go Lambda with Go buildpack', async () => {
      mockBuildUsingStacktapeGoLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/go-lambda.zip',
        digest: 'golambda123',
        jobName: 'goLambda'
      });

      await packagingManager.packageWorkload({
        jobName: 'goLambda',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/handler.go' }
        }
      });

      expect(mockBuildUsingStacktapeGoLambdaBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'goLambda',
          entryfilePath: 'src/handler.go',
          sizeLimit: 250,
          zippedSizeLimit: 50
        })
      );
    });

    test('should package Go container with Go image buildpack', async () => {
      mockBuildUsingStacktapeGoImageBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/go-container',
        digest: 'goimage123',
        jobName: 'goContainer'
      });

      await packagingManager.packageWorkload({
        jobName: 'goContainer',
        packagingConfig: {
          type: 'stacktape-image-buildpack',
          properties: { entryfilePath: 'src/main.go' }
        },
        resources: { cpu: 1024, memory: 2048 },
        targetCpuArchitecture: 'linux/amd64'
      });

      expect(mockBuildUsingStacktapeGoImageBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: 'goContainer',
          entryfilePath: 'src/main.go'
        })
      );
    });
  });

  describe('getTargetCpuArchitectureForContainer', () => {
    test('should return arm64 for ARM instance types', () => {
      const arch = packagingManager.getTargetCpuArchitectureForContainer({
        instanceTypes: ['t4g.small']
      });

      expect(arch).toBe('linux/arm64');
    });

    test('should return amd64 for x86 instance types', () => {
      const arch = packagingManager.getTargetCpuArchitectureForContainer({
        instanceTypes: ['t3.small']
      });

      expect(arch).toBe('linux/amd64');
    });

    test('should use architecture property when specified', () => {
      const arch = packagingManager.getTargetCpuArchitectureForContainer({
        architecture: 'arm64'
      });

      expect(arch).toBe('linux/arm64');
    });

    test('should default to amd64 when no architecture specified', () => {
      const arch = packagingManager.getTargetCpuArchitectureForContainer({
        cpu: 1024,
        memory: 2048
      });

      expect(arch).toBe('linux/amd64');
    });

    test('should prioritize instanceTypes over architecture property', () => {
      const arch = packagingManager.getTargetCpuArchitectureForContainer({
        instanceTypes: ['t4g.small'],
        architecture: 'x86_64'
      });

      expect(arch).toBe('linux/arm64');
    });

    test('should handle unknown instance types gracefully', () => {
      const arch = packagingManager.getTargetCpuArchitectureForContainer({
        instanceTypes: ['unknown.type']
      });

      expect(arch).toBe('linux/amd64');
    });
  });

  describe('hotswap deployment', () => {
    test('should pass hotSwapDeploy flag to buildpack', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda.zip',
        digest: 'hotswap123',
        jobName: 'hotswapLambda'
      });

      await packagingManager.packageWorkload({
        jobName: 'hotswapLambda',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/handler.ts' }
        },
        hotSwapDeploy: true
      });

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          hotSwapDeploy: true
        })
      );
    });

    test('should handle hotswap with additional digest input', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda.zip',
        digest: 'hotswap456',
        jobName: 'hotswapLambdaWithDigest'
      });

      await packagingManager.packageWorkload({
        jobName: 'hotswapLambdaWithDigest',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/handler.ts' }
        },
        hotSwapDeploy: true,
        additionalDigestInput: 'custom-digest-data'
      });

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalledWith(
        expect.objectContaining({
          hotSwapDeploy: true,
          additionalDigestInput: 'custom-digest-data'
        })
      );
    });
  });

  describe('error handling', () => {
    test('should handle buildpack errors gracefully', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockRejectedValue(
        new Error('Build failed: syntax error')
      );

      await expect(
        packagingManager.packageWorkload({
          jobName: 'errorLambda',
          packagingConfig: {
            type: 'stacktape-lambda-buildpack',
            properties: { entryfilePath: 'src/handler.ts' }
          }
        })
      ).rejects.toThrow('Build failed: syntax error');
    });

    test('should handle missing entryfile path', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockRejectedValue(
        new Error('Entryfile not found')
      );

      await expect(
        packagingManager.packageWorkload({
          jobName: 'missingEntryfile',
          packagingConfig: {
            type: 'stacktape-lambda-buildpack',
            properties: { entryfilePath: 'src/nonexistent.ts' }
          }
        })
      ).rejects.toThrow('Entryfile not found');
    });
  });

  describe('parallel packaging', () => {
    test('should handle concurrent packaging jobs', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda1.zip',
        digest: 'concurrent1',
        jobName: 'lambda1'
      });

      mockBuildUsingStacktapePythonLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda2.zip',
        digest: 'concurrent2',
        jobName: 'lambda2'
      });

      mockBuildUsingStacktapeGoLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda3.zip',
        digest: 'concurrent3',
        jobName: 'lambda3'
      });

      const workloads = [
        {
          jobName: 'lambda1',
          packagingConfig: {
            type: 'stacktape-lambda-buildpack',
            properties: { entryfilePath: 'src/handler1.ts' }
          }
        },
        {
          jobName: 'lambda2',
          packagingConfig: {
            type: 'stacktape-lambda-buildpack',
            properties: { entryfilePath: 'src/handler2.py' }
          }
        },
        {
          jobName: 'lambda3',
          packagingConfig: {
            type: 'stacktape-lambda-buildpack',
            properties: { entryfilePath: 'src/handler3.go' }
          }
        }
      ];

      await packagingManager.packageAllWorkloads({ workloads });

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalledTimes(1);
      expect(mockBuildUsingStacktapePythonLambdaBuildpack).toHaveBeenCalledTimes(1);
      expect(mockBuildUsingStacktapeGoLambdaBuildpack).toHaveBeenCalledTimes(1);

      expect(packagingManager.getPackagingOutputForJob({ jobName: 'lambda1' })).toBeDefined();
      expect(packagingManager.getPackagingOutputForJob({ jobName: 'lambda2' })).toBeDefined();
      expect(packagingManager.getPackagingOutputForJob({ jobName: 'lambda3' })).toBeDefined();
    });
  });

  describe('edge cases', () => {
    test('should handle packaging with no resources specified', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda.zip',
        digest: 'noresources123',
        jobName: 'noResourcesLambda'
      });

      await packagingManager.packageWorkload({
        jobName: 'noResourcesLambda',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/handler.ts' }
        }
      });

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalled();
    });

    test('should handle packaging with minimal config', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda.zip',
        digest: 'minimal123',
        jobName: 'minimalLambda'
      });

      await packagingManager.packageWorkload({
        jobName: 'minimalLambda',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'index.js' }
        }
      });

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalled();
    });

    test('should handle TSX file extension', async () => {
      mockBuildUsingStacktapeEsLambdaBuildpack.mockResolvedValue({
        outcome: 'packaged',
        artifactPath: '/tmp/lambda.zip',
        digest: 'tsx123',
        jobName: 'tsxLambda'
      });

      await packagingManager.packageWorkload({
        jobName: 'tsxLambda',
        packagingConfig: {
          type: 'stacktape-lambda-buildpack',
          properties: { entryfilePath: 'src/handler.tsx' }
        }
      });

      expect(mockBuildUsingStacktapeEsLambdaBuildpack).toHaveBeenCalled();
    });
  });
});
