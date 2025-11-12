import { describe, expect, mock, test, beforeEach } from 'bun:test';

// Mock dependencies
mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mock(async () => {}),
    finishEvent: mock(async () => {}),
    updateEvent: mock(() => {}),
    getNamespacedInstance: mock(() => ({
      startEvent: mock(async () => {}),
      finishEvent: mock(async () => {}),
      updateEvent: mock(() => {})
    }))
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    region: 'us-east-1',
    invocationId: 'test-invocation-123',
    targetStack: {
      stackName: 'test-stack',
      globallyUniqueStackHash: 'hash123'
    }
  }
}));

mock.module('@config', () => ({
  CF_TEMPLATE_FILE_NAME_WITHOUT_EXT: 'cloudformation-template',
  STP_TEMPLATE_FILE_NAME_WITHOUT_EXT: 'stacktape-template',
  DEFAULT_KEEP_PREVIOUS_DEPLOYMENT_ARTIFACTS_COUNT: 3,
  DEFAULT_MAXIMUM_PARALLEL_ARTIFACT_UPLOADS: 5,
  DEFAULT_MAXIMUM_PARALLEL_BUCKET_SYNCS: 3
}));

mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: {
    nextVersion: 'v1.0.1',
    existingStackResources: [
      {
        ResourceType: 'AWS::S3::Bucket',
        PhysicalResourceId: 'user-bucket-123'
      }
    ]
  }
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: {
    allLambdasToUpload: [],
    allContainersRequiringPackaging: [],
    allBucketsToSync: [],
    isS3TransferAccelerationAvailableInDeploymentRegion: true,
    deploymentConfig: {
      previousVersionsToKeep: undefined
    }
  }
}));

mock.module('@domain-services/packaging-manager', () => ({
  packagingManager: {
    getPackagingOutputForJob: mock((jobName) => ({
      artifactPath: `/tmp/${jobName}.zip`,
      digest: 'digest-abc123',
      skipped: false
    }))
  }
}));

mock.module('@shared/naming/aws-resource-names', () => ({
  awsResourceNames: {
    deploymentBucket: mock((hash) => `stp-deployment-${hash}`),
    deploymentEcrRepo: mock((hash) => `stp-ecr-${hash}`)
  }
}));

mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: {
    absoluteCfTemplateFilePath: mock(() => '/tmp/cf-template.yaml'),
    absoluteStpTemplateFilePath: mock(() => '/tmp/stp-template.yaml')
  }
}));

mock.module('@shared/naming/utils', () => ({
  buildLambdaS3Key: mock((name, version, digest) => `lambdas/${name}/${version}/${digest}.zip`),
  getBaseS3EndpointForRegion: mock((region) => `s3.${region}.amazonaws.com`),
  getCfTemplateS3Key: mock((version) => `templates/cf/${version}.yaml`),
  getCloudformationTemplateUrl: mock((bucket, region, version) =>
    `https://${bucket}.s3.${region}.amazonaws.com/templates/cf/${version}.yaml`
  ),
  getEcrImageTag: mock((name, version, digest) => `${version}-${digest}`),
  getEcrImageUrl: mock((repoUrl, tag) => `${repoUrl}:${tag}`),
  getEcrRepositoryUrl: mock((accountId, region, repoName) =>
    `${accountId}.dkr.ecr.${region}.amazonaws.com/${repoName}`
  ),
  getStpTemplateS3Key: mock((version) => `templates/stp/${version}.yaml`)
}));

mock.module('@shared/utils/docker', () => ({
  dockerLogin: mock(async () => {}),
  pushDockerImage: mock(async () => {}),
  tagDockerImage: mock(async () => {})
}));

mock.module('@shared/utils/misc', () => ({
  processConcurrently: mock(async (jobs, concurrency) => {
    return Promise.all(jobs.map(job => job()));
  })
}));

mock.module('@shared/utils/yaml', () => ({
  parseYaml: mock((content) => ({ parsed: true }))
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    ecrLogin: mock(async () => ({ password: 'test-password' })),
    listAllEcrImages: mock(async () => []),
    listAllObjectsInBucket: mock(async () => []),
    listAllVersionedObjectsInBucket: mock(async () => []),
    batchDeleteEcrImages: mock(async () => {}),
    batchDeleteObjects: mock(async () => {}),
    uploadFileToS3: mock(async () => {}),
    syncDirectoryIntoBucket: mock(async () => ({
      uploaded: 10,
      deleted: 2,
      unchanged: 5
    })),
    waitForBucketExists: mock(async () => {})
  }
}));

mock.module('@utils/basic-compose-shim', () => ({
  default: mock((...decorators) => (target: any) => target)
}));

mock.module('@utils/decorators', () => ({
  cancelablePublicMethods: mock((target) => target),
  skipInitIfInitialized: mock((target) => target)
}));

mock.module('@utils/errors', () => ({
  ExpectedError: class ExpectedError extends Error {}
}));

mock.module('@utils/printer', () => ({
  printer: {
    warn: mock(() => {})
  }
}));

mock.module('@utils/versioning', () => ({
  getHotSwapDeployVersionString: mock(() => 'hotswap-v1.0.0')
}));

mock.module('./utils', () => ({
  getDeploymentBucketObjectType: mock((s3Key) => {
    if (s3Key.includes('lambda')) return 'user-lambda';
    if (s3Key.includes('template')) return 'template';
    return 'other';
  }),
  parseBucketObjectS3Key: mock((s3Key) => ({
    name: 'test-artifact',
    version: 'v1.0.0',
    digest: 'digest123'
  })),
  parseImageTag: mock((tag) => ({
    name: 'test-image',
    version: 'v1.0.0',
    digest: 'digest456'
  }))
}));

describe('deployment-artifact-manager', () => {
  describe('DeploymentArtifactManager', () => {
    test('should initialize with default values', async () => {
      const { DeploymentArtifactManager } = await import('./index');
      const manager = new DeploymentArtifactManager();

      expect(manager.successfullyUploadedImages).toEqual([]);
      expect(manager.successfullyCreatedObjects).toEqual([]);
      expect(manager.previousObjects).toEqual([]);
      expect(manager.previousImages).toEqual([]);
    });

    test('should initialize and setup deployment bucket and ECR repo', async () => {
      const { DeploymentArtifactManager } = await import('./index');
      const { dockerLogin } = await import('@shared/utils/docker');
      const manager = new DeploymentArtifactManager();

      await manager.init({
        globallyUniqueStackHash: 'hash123',
        accountId: '123456789012',
        stackActionType: 'create'
      });

      expect(manager.deploymentBucketName).toBe('stp-deployment-hash123');
      expect(manager.repositoryName).toBe('stp-ecr-hash123');
      expect(manager.repositoryUrl).toContain('123456789012.dkr.ecr');
      expect(dockerLogin).toHaveBeenCalled();
    });

    test('should load previous artifacts for update operation', async () => {
      const { DeploymentArtifactManager } = await import('./index');
      const { eventManager } = await import('@application-services/event-manager');
      const { awsSdkManager } = await import('@utils/aws-sdk-manager');

      awsSdkManager.listAllEcrImages.mockResolvedValueOnce([
        {
          imageId: { imageTag: 'v1.0.0-digest123' },
          imagePushedAt: new Date()
        }
      ]);

      awsSdkManager.listAllObjectsInBucket.mockResolvedValueOnce([
        {
          Key: 'lambdas/myFunc/v1.0.0/digest123.zip',
          LastModified: new Date()
        }
      ]);

      const manager = new DeploymentArtifactManager();

      await manager.init({
        globallyUniqueStackHash: 'hash123',
        accountId: '123456789012',
        stackActionType: 'update'
      });

      expect(eventManager.startEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'FETCH_PREVIOUS_ARTIFACTS' })
      );
      expect(awsSdkManager.listAllEcrImages).toHaveBeenCalled();
      expect(awsSdkManager.listAllObjectsInBucket).toHaveBeenCalled();
    });

    test('should not load previous artifacts for create operation', async () => {
      const { DeploymentArtifactManager } = await import('./index');
      const { awsSdkManager } = await import('@utils/aws-sdk-manager');

      const listCallsBefore = (awsSdkManager.listAllEcrImages as any).mock.calls.length;

      const manager = new DeploymentArtifactManager();

      await manager.init({
        globallyUniqueStackHash: 'hash123',
        accountId: '123456789012',
        stackActionType: 'create'
      });

      // Should not add new calls
      expect((awsSdkManager.listAllEcrImages as any).mock.calls.length).toBe(listCallsBefore);
    });

    describe('getters', () => {
      test('should get base S3 endpoint for region', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const manager = new DeploymentArtifactManager();

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'create'
        });

        expect(manager.baseS3Endpoint).toBe('s3.us-east-1.amazonaws.com');
      });

      test('should get CloudFormation template URL', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const manager = new DeploymentArtifactManager();

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'create'
        });

        const url = manager.cloudformationTemplateUrl;

        expect(url).toContain('stp-deployment-hash123');
        expect(url).toContain('v1.0.1');
      });

      test('should get max artifact versions to keep from default', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const manager = new DeploymentArtifactManager();

        expect(manager.maxArtifactVersionsToKeep).toBe(4); // 1 + DEFAULT (3)
      });

      test('should get max artifact versions to keep from config', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { configManager } = await import('@domain-services/config-manager');
        const manager = new DeploymentArtifactManager();

        configManager.deploymentConfig.previousVersionsToKeep = 5;

        expect(manager.maxArtifactVersionsToKeep).toBe(6); // 1 + 5

        // Cleanup
        configManager.deploymentConfig.previousVersionsToKeep = undefined;
      });

      test('should get available previous versions from CloudFormation templates', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const manager = new DeploymentArtifactManager();

        manager.previousObjects = [
          { name: 'cloudformation-template', version: 'v1.0.0', digest: 'd1', s3Key: 'key1', type: 'template' },
          { name: 'cloudformation-template', version: 'v1.0.1', digest: 'd2', s3Key: 'key2', type: 'template' },
          { name: 'lambda-func', version: 'v1.0.0', digest: 'd3', s3Key: 'key3', type: 'user-lambda' }
        ];

        const versions = manager.availablePreviousVersions;

        expect(versions).toContain('v1.0.0');
        expect(versions).toContain('v1.0.1');
        expect(versions).not.toContain('lambda-func');
      });
    });

    describe('getLambdasToUpload', () => {
      test('should get lambdas that need uploading', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { configManager } = await import('@domain-services/config-manager');
        const manager = new DeploymentArtifactManager();

        configManager.allLambdasToUpload = [
          {
            artifactName: 'myFunc',
            packaging: { type: 'stacktape-lambda-buildpack' }
          } as any
        ];

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'create'
        });

        const lambdas = manager.getLambdasToUpload({ hotSwapDeploy: false });

        expect(lambdas.length).toBeGreaterThan(0);
        expect(lambdas[0].artifactName).toBe('myFunc');

        // Cleanup
        configManager.allLambdasToUpload = [];
      });

      test('should skip already uploaded lambdas', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { configManager } = await import('@domain-services/config-manager');
        const { packagingManager } = await import('@domain-services/packaging-manager');
        const manager = new DeploymentArtifactManager();

        configManager.allLambdasToUpload = [
          {
            artifactName: 'myFunc',
            packaging: { type: 'stacktape-lambda-buildpack' }
          } as any
        ];

        packagingManager.getPackagingOutputForJob.mockReturnValueOnce({
          artifactPath: '/tmp/myFunc.zip',
          digest: 'digest123',
          skipped: true
        });

        manager.previousObjects = [
          {
            name: 'myFunc',
            version: 'v1.0.0',
            digest: 'digest123',
            s3Key: 'lambdas/myFunc/v1.0.0/digest123.zip',
            type: 'user-lambda'
          }
        ];

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'update'
        });

        const lambdas = manager.getLambdasToUpload({ hotSwapDeploy: false });

        expect(lambdas.length).toBe(0);
        expect(manager.previouslyUploadedLambdaS3KeysUsedInDeployment).toContain(
          'lambdas/myFunc/v1.0.0/digest123.zip'
        );

        // Cleanup
        configManager.allLambdasToUpload = [];
      });
    });

    describe('getImagesToUpload', () => {
      test('should get images that need uploading', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { configManager } = await import('@domain-services/config-manager');
        const manager = new DeploymentArtifactManager();

        configManager.allContainersRequiringPackaging = [
          {
            jobName: 'web-service'
          } as any
        ];

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'create'
        });

        const images = manager.getImagesToUpload({ hotSwapDeploy: false });

        expect(images.length).toBeGreaterThan(0);
        expect(images[0].jobName).toBe('web-service');

        // Cleanup
        configManager.allContainersRequiringPackaging = [];
      });

      test('should skip already deployed images', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { configManager } = await import('@domain-services/config-manager');
        const { packagingManager } = await import('@domain-services/packaging-manager');
        const manager = new DeploymentArtifactManager();

        configManager.allContainersRequiringPackaging = [
          {
            jobName: 'web-service'
          } as any
        ];

        packagingManager.getPackagingOutputForJob.mockReturnValueOnce({
          digest: 'digest456',
          skipped: true
        });

        manager.previousImages = [
          {
            name: 'web-service',
            version: 'v1.0.0',
            digest: 'digest456',
            tag: 'v1.0.0-digest456',
            dockerDigest: 'sha256:abc'
          }
        ];

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'update'
        });

        const images = manager.getImagesToUpload({ hotSwapDeploy: false });

        expect(images.length).toBe(0);

        // Cleanup
        configManager.allContainersRequiringPackaging = [];
      });
    });

    describe('getImageUrlForJob', () => {
      test('should get ECR image URL', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const manager = new DeploymentArtifactManager();

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'create'
        });

        const url = manager.getImageUrlForJob({ tag: 'v1.0.0-digest123' });

        expect(url).toContain('123456789012.dkr.ecr');
        expect(url).toContain('v1.0.0-digest123');
      });
    });

    describe('uploadCloudFormationTemplate', () => {
      test('should upload CloudFormation template', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { awsSdkManager } = await import('@utils/aws-sdk-manager');
        const manager = new DeploymentArtifactManager();

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'create'
        });

        const result = await manager.uploadCloudFormationTemplate();

        expect(awsSdkManager.uploadFileToS3).toHaveBeenCalled();
        expect(result.artifactName).toBe('cloudformation-template');
        expect(result.s3Key).toContain('templates/cf');
      });
    });

    describe('uploadStacktapeTemplate', () => {
      test('should upload Stacktape template', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { awsSdkManager } = await import('@utils/aws-sdk-manager');
        const manager = new DeploymentArtifactManager();

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'create'
        });

        const result = await manager.uploadStacktapeTemplate();

        expect(awsSdkManager.uploadFileToS3).toHaveBeenCalled();
        expect(result.artifactName).toBe('stacktape-template');
        expect(result.s3Key).toContain('templates/stp');
      });
    });

    describe('uploadAllArtifacts', () => {
      test('should upload all artifacts for normal deploy', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { eventManager } = await import('@application-services/event-manager');
        const { configManager } = await import('@domain-services/config-manager');
        const manager = new DeploymentArtifactManager();

        configManager.allLambdasToUpload = [
          {
            artifactName: 'myFunc',
            packaging: { type: 'stacktape-lambda-buildpack' }
          } as any
        ];

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'create'
        });

        await manager.uploadAllArtifacts({ useHotswap: false });

        expect(eventManager.startEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'UPLOAD_DEPLOYMENT_ARTIFACTS' })
        );

        // Cleanup
        configManager.allLambdasToUpload = [];
      });

      test('should skip templates for hotswap deploy', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { awsSdkManager } = await import('@utils/aws-sdk-manager');
        const { configManager } = await import('@domain-services/config-manager');
        const manager = new DeploymentArtifactManager();

        configManager.allLambdasToUpload = [
          {
            artifactName: 'myFunc',
            packaging: { type: 'stacktape-lambda-buildpack' }
          } as any
        ];

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'update'
        });

        const uploadCalls = (awsSdkManager.uploadFileToS3 as any).mock.calls.length;

        await manager.uploadAllArtifacts({ useHotswap: true });

        // Should upload lambda but not templates
        expect((awsSdkManager.uploadFileToS3 as any).mock.calls.length).toBeGreaterThan(uploadCalls);

        // Cleanup
        configManager.allLambdasToUpload = [];
      });
    });

    describe('syncBuckets', () => {
      test('should sync directories into buckets', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { eventManager } = await import('@application-services/event-manager');
        const { configManager } = await import('@domain-services/config-manager');
        const { awsSdkManager } = await import('@utils/aws-sdk-manager');
        const manager = new DeploymentArtifactManager();

        configManager.allBucketsToSync = [
          {
            bucketName: 'my-website-bucket',
            uploadConfiguration: {
              directoryPath: './dist'
            },
            stpConfigBucketName: 'websiteBucket',
            deleteRemoved: true
          }
        ];

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'update'
        });

        await manager.syncBuckets();

        expect(eventManager.startEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'SYNC_BUCKET' })
        );
        expect(awsSdkManager.syncDirectoryIntoBucket).toHaveBeenCalled();

        // Cleanup
        configManager.allBucketsToSync = [];
      });
    });

    describe('getObsoleteItems', () => {
      test('should identify obsolete artifacts based on version retention', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const manager = new DeploymentArtifactManager();

        manager.previousObjects = [
          { name: 'myFunc', version: 'v1.0.0', digest: 'd1', s3Key: 'key1', type: 'user-lambda' },
          { name: 'myFunc', version: 'v1.0.1', digest: 'd2', s3Key: 'key2', type: 'user-lambda' },
          { name: 'myFunc', version: 'v1.0.2', digest: 'd3', s3Key: 'key3', type: 'user-lambda' },
          { name: 'myFunc', version: 'v1.0.3', digest: 'd4', s3Key: 'key4', type: 'user-lambda' },
          { name: 'myFunc', version: 'v1.0.4', digest: 'd5', s3Key: 'key5', type: 'user-lambda' }
        ];

        const obsolete = manager.getObsoleteItems(manager.previousObjects);

        // With default retention (4 versions), the oldest version should be obsolete
        expect(obsolete.length).toBeGreaterThan(0);
        expect(obsolete[0].version).toBe('v1.0.0');
      });

      test('should not mark currently used artifacts as obsolete', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const manager = new DeploymentArtifactManager();

        manager.previousObjects = [
          { name: 'myFunc', version: 'v1.0.0', digest: 'd1', s3Key: 'key1', type: 'user-lambda' },
          { name: 'myFunc', version: 'v1.0.1', digest: 'd2', s3Key: 'key2', type: 'user-lambda' }
        ];

        manager.previouslyUploadedLambdaS3KeysUsedInDeployment = ['key1'];

        const obsolete = manager.getObsoleteItems(manager.previousObjects);

        // key1 is used in deployment, so should not be obsolete
        expect(obsolete.find(item => item.s3Key === 'key1')).toBeUndefined();
      });

      test('should handle images with tags', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const manager = new DeploymentArtifactManager();

        manager.previousImages = [
          { name: 'web', version: 'v1.0.0', digest: 'd1', tag: 'tag1', dockerDigest: 'sha256:abc' },
          { name: 'web', version: 'v1.0.1', digest: 'd2', tag: 'tag2', dockerDigest: 'sha256:def' }
        ];

        manager.successfullyUploadedImages = [{ name: 'web', tag: 'tag3' }];

        const obsolete = manager.getObsoleteItems(manager.previousImages);

        expect(Array.isArray(obsolete)).toBe(true);
      });
    });

    describe('deleteAllObsoleteArtifacts', () => {
      test('should delete obsolete artifacts', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { eventManager } = await import('@application-services/event-manager');
        const { awsSdkManager } = await import('@utils/aws-sdk-manager');
        const manager = new DeploymentArtifactManager();

        manager.previousObjects = [
          { name: 'myFunc', version: 'v1.0.0', digest: 'd1', s3Key: 'old-key', type: 'user-lambda' }
        ];
        manager.previousImages = [
          { name: 'web', version: 'v1.0.0', digest: 'd1', tag: 'old-tag', dockerDigest: 'sha256:old' }
        ];

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'update'
        });

        // Force some to be obsolete by adding many newer versions
        for (let i = 1; i <= 10; i++) {
          manager.previousObjects.push({
            name: 'myFunc',
            version: `v1.0.${i}`,
            digest: `d${i}`,
            s3Key: `key${i}`,
            type: 'user-lambda'
          });
        }

        await manager.deleteAllObsoleteArtifacts();

        expect(eventManager.startEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'DELETE_OBSOLETE_ARTIFACTS' })
        );
        expect(awsSdkManager.batchDeleteObjects).toHaveBeenCalled();
      });

      test('should skip delete if no obsolete artifacts', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { eventManager } = await import('@application-services/event-manager');
        const manager = new DeploymentArtifactManager();

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'update'
        });

        const startEventCalls = (eventManager.startEvent as any).mock.calls.length;

        await manager.deleteAllObsoleteArtifacts();

        // Should not start delete event if nothing to delete
        expect((eventManager.startEvent as any).mock.calls.length).toBe(startEventCalls);
      });
    });

    describe('deleteArtifactsRollbackedDeploy', () => {
      test('should delete artifacts from failed deployment', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
        const { awsSdkManager } = await import('@utils/aws-sdk-manager');
        const manager = new DeploymentArtifactManager();

        manager.successfullyUploadedImages = [{ name: 'web', tag: 'new-tag' }];
        manager.successfullyCreatedObjects = [{ name: 'myFunc', s3Key: 'new-key' }];
        manager.previousImages = [
          { name: 'web', version: 'v1.0.1', digest: 'd', tag: 'old-tag', dockerDigest: 'sha256:x' }
        ];
        manager.previousObjects = [
          { name: 'myFunc', version: 'v1.0.1', digest: 'd', s3Key: 'old-key', type: 'user-lambda' }
        ];

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'update'
        });

        await manager.deleteArtifactsRollbackedDeploy();

        expect(awsSdkManager.batchDeleteEcrImages).toHaveBeenCalled();
        expect(awsSdkManager.batchDeleteObjects).toHaveBeenCalled();
      });
    });

    describe('deleteArtifactsFixedDeploy', () => {
      test('should delete unused artifacts after fixing failed deployment', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { awsSdkManager } = await import('@utils/aws-sdk-manager');
        const manager = new DeploymentArtifactManager();

        manager.previousImages = [
          { name: 'web', version: 'v1.0.1', digest: 'd1', tag: 'unused-tag', dockerDigest: 'sha256:x' },
          { name: 'web', version: 'v1.0.1', digest: 'd2', tag: 'used-tag', dockerDigest: 'sha256:y' }
        ];
        manager.previouslyUploadedImageTagsUsedInDeployment = ['used-tag'];

        manager.previousObjects = [
          { name: 'func', version: 'v1.0.1', digest: 'd1', s3Key: 'unused-key', type: 'user-lambda' },
          { name: 'func', version: 'v1.0.1', digest: 'd2', s3Key: 'used-key', type: 'user-lambda' }
        ];
        manager.previouslyUploadedLambdaS3KeysUsedInDeployment = ['used-key'];

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'update'
        });

        await manager.deleteArtifactsFixedDeploy();

        expect(awsSdkManager.batchDeleteEcrImages).toHaveBeenCalled();
        expect(awsSdkManager.batchDeleteObjects).toHaveBeenCalled();
      });
    });

    describe('deleteAllArtifacts', () => {
      test('should delete all deployment artifacts and bucket contents', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { eventManager } = await import('@application-services/event-manager');
        const { awsSdkManager } = await import('@utils/aws-sdk-manager');
        const manager = new DeploymentArtifactManager();

        awsSdkManager.listAllObjectsInBucket.mockResolvedValueOnce([
          { Key: 'file1.txt' },
          { Key: 'file2.txt' }
        ]);

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'delete'
        });

        await manager.deleteAllArtifacts();

        expect(eventManager.startEvent).toHaveBeenCalledWith(
          expect.objectContaining({ eventType: 'DELETE_ARTIFACTS' })
        );
        expect(awsSdkManager.batchDeleteObjects).toHaveBeenCalled();
      });
    });

    describe('getExistingDigestsForJob', () => {
      test('should get existing digests for a job', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const manager = new DeploymentArtifactManager();

        manager.previousImages = [
          { name: 'web-service', version: 'v1.0.0', digest: 'digest1', tag: 'tag1', dockerDigest: 'sha256:a' },
          { name: 'web-service', version: 'v1.0.1', digest: 'digest2', tag: 'tag2', dockerDigest: 'sha256:b' },
          { name: 'other-service', version: 'v1.0.0', digest: 'digest3', tag: 'tag3', dockerDigest: 'sha256:c' }
        ];

        manager.previousObjects = [
          { name: 'web-service', version: 'v1.0.0', digest: 'digest4', s3Key: 'key1', type: 'user-lambda' }
        ];

        const digests = manager.getExistingDigestsForJob('web-service');

        expect(digests).toContain('digest1');
        expect(digests).toContain('digest2');
        expect(digests).toContain('digest4');
        expect(digests).not.toContain('digest3');
      });
    });

    describe('uploadLambda', () => {
      test('should upload lambda artifact to S3', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { awsSdkManager } = await import('@utils/aws-sdk-manager');
        const manager = new DeploymentArtifactManager();

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'create'
        });

        const result = await manager.uploadLambda({
          artifactName: 'myFunc',
          artifactPath: '/tmp/myFunc.zip',
          s3Key: 'lambdas/myFunc/v1.0.0/digest.zip'
        });

        expect(awsSdkManager.uploadFileToS3).toHaveBeenCalled();
        expect(manager.successfullyCreatedObjects).toContainEqual({
          name: 'myFunc',
          s3Key: 'lambdas/myFunc/v1.0.0/digest.zip'
        });
      });
    });

    describe('uploadImage', () => {
      test('should upload Docker image to ECR', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { tagDockerImage, pushDockerImage } = await import('@shared/utils/docker');
        const manager = new DeploymentArtifactManager();

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'create'
        });

        const result = await manager.uploadImage({
          tag: 'v1.0.0-digest123',
          jobName: 'web-service',
          imageTagWithUrl: '123456789012.dkr.ecr.us-east-1.amazonaws.com/repo:v1.0.0-digest123'
        });

        expect(tagDockerImage).toHaveBeenCalled();
        expect(pushDockerImage).toHaveBeenCalled();
        expect(manager.successfullyUploadedImages).toContainEqual({
          name: 'web-service',
          tag: 'v1.0.0-digest123'
        });
      });
    });

    describe('getBucketsContent', () => {
      test('should get content of all user buckets', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { awsSdkManager } = await import('@utils/aws-sdk-manager');
        const manager = new DeploymentArtifactManager();

        awsSdkManager.listAllObjectsInBucket.mockResolvedValueOnce([
          { Key: 'file1.txt' },
          { Key: 'file2.txt' }
        ]);

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'delete'
        });

        const buckets = await manager.getBucketsContent();

        expect(buckets['user-bucket-123']).toBeDefined();
        expect(buckets['user-bucket-123'].length).toBe(2);
      });

      test('should check for versioned objects if no regular objects', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { awsSdkManager } = await import('@utils/aws-sdk-manager');
        const manager = new DeploymentArtifactManager();

        awsSdkManager.listAllObjectsInBucket.mockResolvedValueOnce([]);
        awsSdkManager.listAllVersionedObjectsInBucket.mockResolvedValueOnce([
          { Key: 'file1.txt', VersionId: 'v1' }
        ]);

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'delete'
        });

        const buckets = await manager.getBucketsContent();

        expect(awsSdkManager.listAllVersionedObjectsInBucket).toHaveBeenCalled();
      });
    });

    describe('syncDirectoryIntoBucket', () => {
      test('should sync directory with progress updates', async () => {
        const { DeploymentArtifactManager } = await import('./index');
        const { awsSdkManager } = await import('@utils/aws-sdk-manager');
        const manager = new DeploymentArtifactManager();

        await manager.init({
          globallyUniqueStackHash: 'hash123',
          accountId: '123456789012',
          stackActionType: 'update'
        });

        await manager.syncDirectoryIntoBucket({
          uploadConfiguration: {
            directoryPath: './dist',
            headersPreset: 'static-website'
          },
          bucketName: 'my-website-bucket',
          deleteRemoved: true,
          shortName: 'websiteBucket'
        });

        expect(awsSdkManager.syncDirectoryIntoBucket).toHaveBeenCalledWith(
          expect.objectContaining({
            bucketName: 'my-website-bucket',
            deleteRemoved: true
          })
        );
      });
    });
  });
});
