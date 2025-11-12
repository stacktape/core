import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock all dependencies
const mockListAllObjectsInBucket = mock(() => []);
const mockListAllPrivateCloudformationResourceTypesWithVersions = mock(() => ({}));
const mockGetFromBucket = mock(() => '');
const mockGetRole = mock(() => null);
const mockCreateIamRole = mock(() => ({ Arn: 'arn:aws:iam::123456789012:role/test-role' }));
const mockModifyInlinePoliciesForIamRole = mock(async () => {});
const mockGetLogGroup = mock(() => null);
const mockCreateLogGroup = mock(() => ({
  logGroupName: '/aws/cloudformation/test',
  arn: 'arn:aws:logs:us-east-1:123456789012:log-group:/aws/cloudformation/test:*'
}));
const mockRegisterPrivateCloudformationResourceType = mock(() => 'arn:aws:cloudformation:us-east-1:123456789012:type/resource/test');
const mockSetPrivateCloudformationResourceTypeAsDefault = mock(async () => {});
const mockDeregisterPrivateCloudformationType = mock(async () => {});

const mockGlobalStateManager = {
  cloudformationRegistryBucketRegion: 'us-east-1',
  cloudformationRegistryBucketName: 'stacktape-cf-registry',
  credentials: {
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret'
  },
  region: 'us-east-1',
  targetAwsAccount: {
    awsAccountId: '123456789012'
  }
};

const mockStartEvent = mock(async () => {});
const mockFinishEvent = mock(async () => {});

const mockParseYaml = mock(() => ({
  Resources: {
    ExecutionRole: {
      Properties: {
        MaxSessionDuration: 3600,
        Policies: [
          {
            PolicyName: 'TestPolicy',
            PolicyDocument: {
              Version: '2012-10-17',
              Statement: []
            }
          }
        ]
      }
    }
  }
}));

const mockWait = mock(async () => {});

const mockBuildRoleNameFromPackagePrefix = mock(() => 'test-role-name');
const mockBuildLogGroupNameFromPackagePrefix = mock(() => '/aws/cloudformation/test');
const mockBuildZipPackageNameFromPackagePrefix = mock(() => 'test-package.zip');
const mockBuildRoleDefinitionFileNameFromPackagePrefix = mock(() => 'test-package-role.yml');

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    listAllObjectsInBucket: mockListAllObjectsInBucket,
    listAllPrivateCloudformationResourceTypesWithVersions: mockListAllPrivateCloudformationResourceTypesWithVersions,
    getFromBucket: mockGetFromBucket,
    getRole: mockGetRole,
    createIamRole: mockCreateIamRole,
    modifyInlinePoliciesForIamRole: mockModifyInlinePoliciesForIamRole,
    getLogGroup: mockGetLogGroup,
    createLogGroup: mockCreateLogGroup,
    registerPrivateCloudformationResourceType: mockRegisterPrivateCloudformationResourceType,
    setPrivateCloudformationResourceTypeAsDefault: mockSetPrivateCloudformationResourceTypeAsDefault,
    deregisterPrivateCloudformationType: mockDeregisterPrivateCloudformationType
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: mockGlobalStateManager
}));

mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mockStartEvent,
    finishEvent: mockFinishEvent
  }
}));

mock.module('@shared/utils/yaml', () => ({
  parseYaml: mockParseYaml
}));

mock.module('@shared/utils/misc', () => ({
  wait: mockWait
}));

mock.module('@shared/naming/cf-registry-types', () => ({
  cfRegistryNames: {
    buildRoleNameFromPackagePrefix: mockBuildRoleNameFromPackagePrefix,
    buildLogGroupNameFromPackagePrefix: mockBuildLogGroupNameFromPackagePrefix,
    buildZipPackageNameFromPackagePrefix: mockBuildZipPackageNameFromPackagePrefix,
    buildRoleDefinitionFileNameFromPackagePrefix: mockBuildRoleDefinitionFileNameFromPackagePrefix
  }
}));

mock.module('@config', () => ({
  SUPPORTED_CF_INFRASTRUCTURE_MODULES: {
    atlasMongo: {
      type: 'atlasMongo',
      privateTypesMajorVersionUsed: 'V1',
      privateTypesMinimalRequiredSubversion: '0000001',
      privateTypesSpecs: {
        'MongoDB::Atlas::V1::Cluster': {
          packagePrefix: 'mongodb-atlas-cluster'
        }
      }
    },
    upstashRedis: {
      type: 'upstashRedis',
      privateTypesMajorVersionUsed: 'V1',
      privateTypesMinimalRequiredSubversion: '0000001',
      privateTypesSpecs: {
        'Upstash::Redis::V1::Database': {
          packagePrefix: 'upstash-redis-database'
        }
      }
    }
  }
}));

mock.module('@shared/utils/constants', () => ({
  UNKNOWN_CLOUDFORMATION_PRIVATE_TYPE_VERSION_IDENTIFIER: 'unknown'
}));

mock.module('@shared/aws/sdk-manager/utils', () => ({
  retryPlugin: {}
}));

mock.module('@utils/aws-sdk-manager/utils', () => ({
  loggingPlugin: {}
}));

mock.module('@aws-sdk/client-s3', () => ({
  S3Client: class {
    middlewareStack = {
      use: mock(() => {})
    };
  }
}));

describe('CloudformationRegistryManager', () => {
  let registryManager: any;

  beforeEach(async () => {
    mock.restore();
    mockListAllObjectsInBucket.mockClear();
    mockListAllPrivateCloudformationResourceTypesWithVersions.mockClear();
    mockGetFromBucket.mockClear();
    mockGetRole.mockClear();
    mockCreateIamRole.mockClear();
    mockModifyInlinePoliciesForIamRole.mockClear();
    mockGetLogGroup.mockClear();
    mockCreateLogGroup.mockClear();
    mockRegisterPrivateCloudformationResourceType.mockClear();
    mockSetPrivateCloudformationResourceTypeAsDefault.mockClear();
    mockDeregisterPrivateCloudformationType.mockClear();
    mockStartEvent.mockClear();
    mockFinishEvent.mockClear();
    mockParseYaml.mockClear();
    mockWait.mockClear();

    const module = await import('./index');
    registryManager = module.cloudformationRegistryManager;
    await registryManager.init({});
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      const { CloudformationRegistryManager } = await import('./index');
      const manager = new CloudformationRegistryManager();
      await manager.init();
      expect(manager).toBeDefined();
    });

    test('should initialize with empty cloudformation private types info', async () => {
      const { CloudformationRegistryManager } = await import('./index');
      const manager = new CloudformationRegistryManager();
      await manager.init();

      expect(manager.cloudformationPrivateTypesInfo).toBeDefined();
      expect(manager.cloudformationPrivateTypesInfo.registeredCloudformationPrivateTypes).toEqual({});
      expect(manager.cloudformationPrivateTypesInfo.availableCloudformationPrivateTypesFiles).toBeDefined();
    });
  });

  describe('privateTypePackagesS3Client', () => {
    test('should create S3 client with correct configuration', () => {
      const client = registryManager.privateTypePackagesS3Client;
      expect(client).toBeDefined();
    });
  });

  describe('stacktapeInfrastructureModuleTypes', () => {
    test('should return all module types', () => {
      const types = registryManager.stacktapeInfrastructureModuleTypes;
      expect(types).toContain('atlasMongo');
      expect(types).toContain('upstashRedis');
    });
  });

  describe('loadAvailableCloudformationPrivateTypePackages', () => {
    test('should load available packages from S3', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000001/mongodb-atlas-cluster.zip' },
        { Key: 'atlasMongo/V1/0000001/mongodb-atlas-cluster-role.yml' }
      ]);

      await registryManager.loadAvailableCloudformationPrivateTypePackages();

      expect(mockListAllObjectsInBucket).toHaveBeenCalledWith(
        'stacktape-cf-registry',
        expect.any(Object)
      );
      expect(registryManager.cloudformationPrivateTypesInfo.availableCloudformationPrivateTypesFiles.atlasMongo).toBeDefined();
    });

    test('should skip invalid keys', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/' },
        { Key: 'atlasMongo/V1/' },
        { Key: 'atlasMongo/V1/invalid/' },
        { Key: 'atlasMongo/V1/0000001/valid.zip' }
      ]);

      await registryManager.loadAvailableCloudformationPrivateTypePackages();

      const atlasMongo = registryManager.cloudformationPrivateTypesInfo.availableCloudformationPrivateTypesFiles.atlasMongo;
      expect(atlasMongo.V1['0000001']).toBeDefined();
      expect(atlasMongo.V1['0000001']).toHaveLength(1);
    });

    test('should organize packages by major version and subversion', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000001/package1.zip' },
        { Key: 'atlasMongo/V1/0000002/package2.zip' },
        { Key: 'atlasMongo/V2/0000001/package3.zip' }
      ]);

      await registryManager.loadAvailableCloudformationPrivateTypePackages();

      const atlasMongo = registryManager.cloudformationPrivateTypesInfo.availableCloudformationPrivateTypesFiles.atlasMongo;
      expect(atlasMongo.V1['0000001']).toHaveLength(1);
      expect(atlasMongo.V1['0000002']).toHaveLength(1);
      expect(atlasMongo.V2['0000001']).toHaveLength(1);
    });
  });

  describe('loadRegisteredCloudformationPrivateTypes', () => {
    test('should load registered types from AWS', async () => {
      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({
        'MongoDB::Atlas::V1::Cluster': [
          { Description: '0000001', IsDefaultVersion: true }
        ]
      });

      await registryManager.loadRegisteredCloudformationPrivateTypes();

      expect(mockListAllPrivateCloudformationResourceTypesWithVersions).toHaveBeenCalled();
      expect(registryManager.cloudformationPrivateTypesInfo.registeredCloudformationPrivateTypes).toBeDefined();
    });
  });

  describe('checkCloudformationPrivateTypesController', () => {
    test('should validate module configuration', () => {
      expect(() =>
        registryManager.checkCloudformationPrivateTypesController({
          infrastructureModuleType: 'atlasMongo'
        })
      ).not.toThrow();
    });

    test('should throw error for invalid subversion format', () => {
      const { CloudformationRegistryManager } = await import('./index');
      const manager = new CloudformationRegistryManager();

      // Temporarily override the config
      const originalConfig = require('@config').SUPPORTED_CF_INFRASTRUCTURE_MODULES;
      require('@config').SUPPORTED_CF_INFRASTRUCTURE_MODULES.invalidModule = {
        type: 'invalidModule',
        privateTypesMajorVersionUsed: 'V1',
        privateTypesMinimalRequiredSubversion: 'invalid',
        privateTypesSpecs: {}
      };

      expect(() =>
        manager.checkCloudformationPrivateTypesController({
          infrastructureModuleType: 'invalidModule' as any
        })
      ).toThrow();

      // Restore original config
      require('@config').SUPPORTED_CF_INFRASTRUCTURE_MODULES = originalConfig;
    });
  });

  describe('loadPrivateTypesAndPackages', () => {
    test('should load and determine status for required modules', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000001/mongodb-atlas-cluster.zip' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      expect(mockListAllObjectsInBucket).toHaveBeenCalled();
      expect(mockListAllPrivateCloudformationResourceTypesWithVersions).toHaveBeenCalled();
      expect(registryManager.stacktapeInfrastructureModulesStatus).toBeDefined();
    });
  });

  describe('determineModulePrivateTypesStatus', () => {
    test('should determine status with no registered types', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      expect(registryManager.stacktapeInfrastructureModulesStatus.atlasMongo).toBeDefined();
      expect(
        registryManager.stacktapeInfrastructureModulesStatus.atlasMongo.newestCompatibleCloudformationPrivateTypeVersion
      ).toBe('0000002');
    });

    test('should determine status with registered types', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({
        'MongoDB::Atlas::V1::Cluster': [
          { Description: '0000001', IsDefaultVersion: true }
        ]
      });

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      const status = registryManager.stacktapeInfrastructureModulesStatus.atlasMongo;
      expect(status.currentlyUsedPrivateCloudformationTypes['MongoDB::Atlas::V1::Cluster'].version).toBe('0000001');
    });

    test('should throw error when no compatible version found', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      await expect(registryManager.loadPrivateTypesAndPackages(['atlasMongo'])).rejects.toThrow();
    });

    test('should detect role file availability', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' },
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster-role.yml' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      mockBuildZipPackageNameFromPackagePrefix.mockReturnValueOnce('mongodb-atlas-cluster.zip');
      mockBuildRoleDefinitionFileNameFromPackagePrefix.mockReturnValueOnce('mongodb-atlas-cluster-role.yml');

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      const specs = registryManager.stacktapeInfrastructureModulesStatus.atlasMongo.newestPrivateTypesSpecs;
      expect(specs['MongoDB::Atlas::V1::Cluster']?.hasRoleFileAvailable).toBe(true);
    });
  });

  describe('areMinimalRequirementsForModulePrivateTypesMet', () => {
    test('should return true when requirements are met', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({
        'MongoDB::Atlas::V1::Cluster': [
          { Description: '0000002', IsDefaultVersion: true }
        ]
      });

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      const result = registryManager.areMinimalRequirementsForModulePrivateTypesMet({
        infrastructureModuleType: 'atlasMongo'
      });

      expect(result).toBe(true);
    });

    test('should return false when version is below minimum', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({
        'MongoDB::Atlas::V1::Cluster': [
          { Description: '0000000', IsDefaultVersion: true }
        ]
      });

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      const result = registryManager.areMinimalRequirementsForModulePrivateTypesMet({
        infrastructureModuleType: 'atlasMongo'
      });

      expect(result).toBe(false);
    });
  });

  describe('isUpdateForModulePrivateTypesAvailable', () => {
    test('should return true when newer version is available', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000003/mongodb-atlas-cluster.zip' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({
        'MongoDB::Atlas::V1::Cluster': [
          { Description: '0000002', IsDefaultVersion: true }
        ]
      });

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      const result = registryManager.isUpdateForModulePrivateTypesAvailable({
        infrastructureModuleType: 'atlasMongo'
      });

      expect(result).toBe(true);
    });

    test('should return false when using latest version', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({
        'MongoDB::Atlas::V1::Cluster': [
          { Description: '0000002', IsDefaultVersion: true }
        ]
      });

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      const result = registryManager.isUpdateForModulePrivateTypesAvailable({
        infrastructureModuleType: 'atlasMongo'
      });

      expect(result).toBe(false);
    });
  });

  describe('resolveRoleForPrivateType', () => {
    test('should create role when it does not exist', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' },
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster-role.yml' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      mockBuildZipPackageNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster.zip');
      mockBuildRoleDefinitionFileNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster-role.yml');

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      mockGetRole.mockResolvedValueOnce(null);
      mockCreateIamRole.mockResolvedValueOnce({
        Arn: 'arn:aws:iam::123456789012:role/new-role'
      });

      mockGetFromBucket.mockResolvedValueOnce(`
Resources:
  ExecutionRole:
    Properties:
      MaxSessionDuration: 3600
      Policies:
        - PolicyName: TestPolicy
          PolicyDocument:
            Version: "2012-10-17"
            Statement: []
      `);

      const result = await registryManager.resolveRoleForPrivateType({
        infrastructureModuleType: 'atlasMongo',
        privateTypeName: 'MongoDB::Atlas::V1::Cluster',
        region: 'us-east-1'
      });

      expect(mockGetRole).toHaveBeenCalled();
      expect(mockCreateIamRole).toHaveBeenCalled();
      expect(mockModifyInlinePoliciesForIamRole).toHaveBeenCalled();
      expect(result.roleArn).toBe('arn:aws:iam::123456789012:role/new-role');
    });

    test('should use existing role when it exists', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' },
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster-role.yml' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      mockBuildZipPackageNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster.zip');
      mockBuildRoleDefinitionFileNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster-role.yml');

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      mockGetRole.mockResolvedValueOnce({
        Arn: 'arn:aws:iam::123456789012:role/existing-role'
      });

      mockGetFromBucket.mockResolvedValueOnce(`
Resources:
  ExecutionRole:
    Properties:
      MaxSessionDuration: 3600
      Policies: []
      `);

      const result = await registryManager.resolveRoleForPrivateType({
        infrastructureModuleType: 'atlasMongo',
        privateTypeName: 'MongoDB::Atlas::V1::Cluster',
        region: 'us-east-1'
      });

      expect(mockGetRole).toHaveBeenCalled();
      expect(mockCreateIamRole).not.toHaveBeenCalled();
      expect(mockModifyInlinePoliciesForIamRole).toHaveBeenCalled();
      expect(result.roleArn).toBe('arn:aws:iam::123456789012:role/existing-role');
    });
  });

  describe('resolveLogGroupForPrivateType', () => {
    test('should create log group when it does not exist', async () => {
      mockGetLogGroup.mockResolvedValueOnce(null);
      mockCreateLogGroup.mockResolvedValueOnce({
        logGroupName: '/aws/cloudformation/test',
        arn: 'arn:aws:logs:us-east-1:123456789012:log-group:/aws/cloudformation/test:*'
      });

      const result = await registryManager.resolveLogGroupForPrivateType({
        infrastructureModuleType: 'atlasMongo',
        privateTypeName: 'MongoDB::Atlas::V1::Cluster'
      });

      expect(mockGetLogGroup).toHaveBeenCalled();
      expect(mockCreateLogGroup).toHaveBeenCalledWith({
        logGroupName: '/aws/cloudformation/test',
        retentionDays: 30
      });
      expect(result.logGroupArn).toBe('arn:aws:logs:us-east-1:123456789012:log-group:/aws/cloudformation/test');
    });

    test('should use existing log group', async () => {
      mockGetLogGroup.mockResolvedValueOnce({
        logGroupName: '/aws/cloudformation/existing',
        arn: 'arn:aws:logs:us-east-1:123456789012:log-group:/aws/cloudformation/existing:*'
      });

      const result = await registryManager.resolveLogGroupForPrivateType({
        infrastructureModuleType: 'atlasMongo',
        privateTypeName: 'MongoDB::Atlas::V1::Cluster'
      });

      expect(mockGetLogGroup).toHaveBeenCalled();
      expect(mockCreateLogGroup).not.toHaveBeenCalled();
      expect(result.logGroupArn).toBe('arn:aws:logs:us-east-1:123456789012:log-group:/aws/cloudformation/existing');
    });
  });

  describe('buildNewestAvailableFileBucketKeyForPrivateType', () => {
    test('should build key for zip package', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      mockBuildZipPackageNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster.zip');

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      const key = registryManager.buildNewestAvailableFileBucketKeyForPrivateType({
        infrastructureModuleType: 'atlasMongo',
        privateTypeName: 'MongoDB::Atlas::V1::Cluster',
        fileType: 'zipPackage'
      });

      expect(key).toContain('atlasMongo/V1/');
      expect(key).toContain('mongodb-atlas-cluster.zip');
    });

    test('should build key for role definition', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      mockBuildRoleDefinitionFileNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster-role.yml');

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      const key = registryManager.buildNewestAvailableFileBucketKeyForPrivateType({
        infrastructureModuleType: 'atlasMongo',
        privateTypeName: 'MongoDB::Atlas::V1::Cluster',
        fileType: 'roleDefinition'
      });

      expect(key).toContain('atlasMongo/V1/');
      expect(key).toContain('mongodb-atlas-cluster-role.yml');
    });
  });

  describe('registerLatestCfPrivateTypes', () => {
    test('should register types when requirements not met', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' },
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster-role.yml' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      mockBuildZipPackageNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster.zip');
      mockBuildRoleDefinitionFileNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster-role.yml');

      mockGetRole.mockResolvedValue({ Arn: 'arn:aws:iam::123456789012:role/test-role' });
      mockGetFromBucket.mockResolvedValue(`
Resources:
  ExecutionRole:
    Properties:
      MaxSessionDuration: 3600
      Policies: []
      `);

      mockRegisterPrivateCloudformationResourceType.mockResolvedValue('arn:test');

      await registryManager.registerLatestCfPrivateTypes(['atlasMongo']);

      expect(mockStartEvent).toHaveBeenCalled();
      expect(mockRegisterPrivateCloudformationResourceType).toHaveBeenCalled();
      expect(mockSetPrivateCloudformationResourceTypeAsDefault).toHaveBeenCalled();
      expect(mockFinishEvent).toHaveBeenCalled();
    });

    test('should skip registration when requirements already met', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({
        'MongoDB::Atlas::V1::Cluster': [
          { Description: '0000002', IsDefaultVersion: true }
        ]
      });

      await registryManager.registerLatestCfPrivateTypes(['atlasMongo']);

      expect(mockStartEvent).not.toHaveBeenCalled();
      expect(mockRegisterPrivateCloudformationResourceType).not.toHaveBeenCalled();
    });

    test('should deregister old versions after registration', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' },
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster-role.yml' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({
        'MongoDB::Atlas::V1::Cluster': [
          { Description: '0000001', IsDefaultVersion: false, Arn: 'arn:old' }
        ]
      });

      mockBuildZipPackageNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster.zip');
      mockBuildRoleDefinitionFileNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster-role.yml');

      mockGetRole.mockResolvedValue({ Arn: 'arn:aws:iam::123456789012:role/test-role' });
      mockGetFromBucket.mockResolvedValue(`
Resources:
  ExecutionRole:
    Properties:
      MaxSessionDuration: 3600
      Policies: []
      `);

      mockRegisterPrivateCloudformationResourceType.mockResolvedValue('arn:new');

      await registryManager.registerLatestCfPrivateTypes(['atlasMongo']);

      expect(mockDeregisterPrivateCloudformationType).toHaveBeenCalledWith({
        typeVersionArn: 'arn:old',
        rateLimiter: expect.any(Function)
      });
    });
  });

  describe('registerNewestAvailablePrivateTypes', () => {
    test('should register all private types for module', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' },
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster-role.yml' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      mockBuildZipPackageNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster.zip');
      mockBuildRoleDefinitionFileNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster-role.yml');

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      mockGetRole.mockResolvedValue({ Arn: 'arn:aws:iam::123456789012:role/test-role' });
      mockGetFromBucket.mockResolvedValue(`
Resources:
  ExecutionRole:
    Properties:
      MaxSessionDuration: 3600
      Policies: []
      `);

      mockRegisterPrivateCloudformationResourceType.mockResolvedValue('arn:test');

      await registryManager.registerNewestAvailablePrivateTypes({
        infrastructureModuleType: 'atlasMongo'
      });

      expect(mockRegisterPrivateCloudformationResourceType).toHaveBeenCalled();
      expect(mockSetPrivateCloudformationResourceTypeAsDefault).toHaveBeenCalled();
      expect(mockWait).toHaveBeenCalled();
    });

    test('should use rate limiting for API calls', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' },
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster-role.yml' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      mockBuildZipPackageNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster.zip');
      mockBuildRoleDefinitionFileNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster-role.yml');

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      mockGetRole.mockResolvedValue({ Arn: 'arn:aws:iam::123456789012:role/test-role' });
      mockGetFromBucket.mockResolvedValue(`
Resources:
  ExecutionRole:
    Properties:
      MaxSessionDuration: 3600
      Policies: []
      `);

      mockRegisterPrivateCloudformationResourceType.mockResolvedValue('arn:test');

      await registryManager.registerNewestAvailablePrivateTypes({
        infrastructureModuleType: 'atlasMongo'
      });

      expect(mockRegisterPrivateCloudformationResourceType).toHaveBeenCalledWith(
        expect.objectContaining({
          rateLimiter: expect.any(Function)
        })
      );
    });
  });

  describe('edge cases', () => {
    test('should handle multiple modules in parallel', async () => {
      mockListAllObjectsInBucket.mockResolvedValue([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' },
        { Key: 'upstashRedis/V1/0000002/upstash-redis-database.zip' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValue({});

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo', 'upstashRedis']);

      expect(registryManager.stacktapeInfrastructureModulesStatus.atlasMongo).toBeDefined();
      expect(registryManager.stacktapeInfrastructureModulesStatus.upstashRedis).toBeDefined();
    });

    test('should handle empty bucket', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([]);
      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      await expect(registryManager.loadPrivateTypesAndPackages(['atlasMongo'])).rejects.toThrow();
    });

    test('should handle missing role file gracefully', async () => {
      mockListAllObjectsInBucket.mockResolvedValueOnce([
        { Key: 'atlasMongo/V1/0000002/mongodb-atlas-cluster.zip' }
      ]);

      mockListAllPrivateCloudformationResourceTypesWithVersions.mockResolvedValueOnce({});

      mockBuildZipPackageNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster.zip');
      mockBuildRoleDefinitionFileNameFromPackagePrefix.mockReturnValue('mongodb-atlas-cluster-role.yml');

      await registryManager.loadPrivateTypesAndPackages(['atlasMongo']);

      const specs = registryManager.stacktapeInfrastructureModulesStatus.atlasMongo.newestPrivateTypesSpecs;
      expect(specs['MongoDB::Atlas::V1::Cluster']?.hasRoleFileAvailable).toBeUndefined();
    });
  });
});
