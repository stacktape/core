import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock all resource resolvers
const mockResolveStackOutputs = mock(async () => {});
const mockResolveCustomResources = mock(async () => {});
const mockResolveDeploymentBucket = mock(async () => {});
const mockResolveImageRepository = mock(async () => {});
const mockResolveApplicationLoadBalancers = mock(async () => {});
const mockResolveBatchJobs = mock(async () => {});
const mockResolveNetworkLoadBalancers = mock(async () => {});
const mockResolveBuckets = mock(async () => {});
const mockResolveContainerWorkloads = mock(async () => {});
const mockResolveAwsVpcDeployment = mock(async () => {});
const mockResolveDefaultEdgeLambdas = mock(async () => {});
const mockResolveDefaultEdgeLambdaBucket = mock(async () => {});
const mockResolveStacktapeServiceLambda = mock(async () => {});
const mockResolveFunctions = mock(async () => {});
const mockResolveS3EventsCustomResource = mock(async () => {});
const mockResolveSensitiveDataCustomResource = mock(async () => {});
const mockResolveAcceptVpcPeeringCustomResource = mock(async () => {});
const mockResolveDefaultDomainCertCustomResource = mock(async () => {});
const mockResolveDatabases = mock(async () => {});
const mockResolveDynamoTables = mock(async () => {});
const mockResolveOpenSearchDomains = mock(async () => {});
const mockResolveEventBuses = mock(async () => {});
const mockResolveBastions = mock(async () => {});
const mockResolveCloudformationResources = mock(async () => {});
const mockResolveStateMachines = mock(async () => {});
const mockResolveHttpApiGateways = mock(async () => {});
const mockResolveUserPools = mock(async () => {});
const mockResolveAtlasMongoClusters = mock(async () => {});
const mockResolveServiceDiscoveryPrivateNamespace = mock(async () => {});
const mockResolveRedisClusters = mock(async () => {});
const mockResolveUpstashRedisDatabases = mock(async () => {});
const mockResolveEdgeLambdaFunctions = mock(async () => {});
const mockResolveBudget = mock(async () => {});
const mockResolveCodeDeploySharedResources = mock(async () => {});
const mockResolveWebServices = mock(async () => {});
const mockResolveAwsCdkConstructs = mock(async () => {});
const mockResolvePrivateServices = mock(async () => {});
const mockResolveWorkerServices = mock(async () => {});
const mockResolveSqsQueues = mock(async () => {});
const mockResolveSnsTopics = mock(async () => {});
const mockResolveHostingBuckets = mock(async () => {});
const mockResolveWebAppFirewalls = mock(async () => {});
const mockResolveDeploymentScripts = mock(async () => {});
const mockResolveNextjsWebs = mock(async () => {});
const mockResolveEfsFilesystems = mock(async () => {});

mock.module('./resource-resolvers/outputs', () => ({
  resolveStackOutputs: mockResolveStackOutputs
}));

mock.module('./resource-resolvers/custom-resources', () => ({
  resolveCustomResources: mockResolveCustomResources
}));

mock.module('./resource-resolvers/background-resources/deployment-bucket', () => ({
  resolveDeploymentBucket: mockResolveDeploymentBucket
}));

mock.module('./resource-resolvers/background-resources/deployment-image-repository', () => ({
  resolveImageRepository: mockResolveImageRepository
}));

mock.module('./resource-resolvers/application-load-balancers', () => ({
  resolveApplicationLoadBalancers: mockResolveApplicationLoadBalancers
}));

mock.module('./resource-resolvers/batch-jobs', () => ({
  resolveBatchJobs: mockResolveBatchJobs
}));

mock.module('./resource-resolvers/network-load-balancers', () => ({
  resolveNetworkLoadBalancers: mockResolveNetworkLoadBalancers
}));

mock.module('./resource-resolvers/buckets', () => ({
  resolveBuckets: mockResolveBuckets
}));

mock.module('./resource-resolvers/multi-container-workloads', () => ({
  resolveContainerWorkloads: mockResolveContainerWorkloads
}));

mock.module('./resource-resolvers/background-resources/vpc', () => ({
  resolveAwsVpcDeployment: mockResolveAwsVpcDeployment
}));

mock.module('./resource-resolvers/background-resources/shared-edge-lambdas-custom-resource', () => ({
  resolveDefaultEdgeLambdas: mockResolveDefaultEdgeLambdas,
  resolveDefaultEdgeLambdaBucket: mockResolveDefaultEdgeLambdaBucket
}));

mock.module('./resource-resolvers/background-resources/stacktape-service-lambda', () => ({
  resolveStacktapeServiceLambda: mockResolveStacktapeServiceLambda
}));

mock.module('./resource-resolvers/functions', () => ({
  resolveFunctions: mockResolveFunctions
}));

mock.module('./resource-resolvers/background-resources/s3-events-custom-resource', () => ({
  resolveS3EventsCustomResource: mockResolveS3EventsCustomResource
}));

mock.module('./resource-resolvers/background-resources/sensitive-data-custom-resource', () => ({
  resolveSensitiveDataCustomResource: mockResolveSensitiveDataCustomResource
}));

mock.module('./resource-resolvers/background-resources/accept-vpc-peerings-custom-resource', () => ({
  resolveAcceptVpcPeeringCustomResource: mockResolveAcceptVpcPeeringCustomResource
}));

mock.module('./resource-resolvers/background-resources/default-domain-cert-custom-resource', () => ({
  resolveDefaultDomainCertCustomResource: mockResolveDefaultDomainCertCustomResource
}));

mock.module('./resource-resolvers/databases', () => ({
  resolveDatabases: mockResolveDatabases
}));

mock.module('./resource-resolvers/dynamo-db-tables', () => ({
  resolveDynamoTables: mockResolveDynamoTables
}));

mock.module('./resource-resolvers/open-search', () => ({
  resolveOpenSearchDomains: mockResolveOpenSearchDomains
}));

mock.module('./resource-resolvers/event-buses', () => ({
  resolveEventBuses: mockResolveEventBuses
}));

mock.module('./resource-resolvers/bastion', () => ({
  resolveBastions: mockResolveBastions
}));

mock.module('./resource-resolvers/cloudformation-resources', () => ({
  resolveCloudformationResources: mockResolveCloudformationResources
}));

mock.module('./resource-resolvers/state-machines', () => ({
  resolveStateMachines: mockResolveStateMachines
}));

mock.module('./resource-resolvers/http-api-gateways', () => ({
  resolveHttpApiGateways: mockResolveHttpApiGateways
}));

mock.module('./resource-resolvers/user-pools', () => ({
  resolveUserPools: mockResolveUserPools
}));

mock.module('./resource-resolvers/mongo-db-atlas-clusters', () => ({
  resolveAtlasMongoClusters: mockResolveAtlasMongoClusters
}));

mock.module('./resource-resolvers/background-resources/service-discovery', () => ({
  resolveServiceDiscoveryPrivateNamespace: mockResolveServiceDiscoveryPrivateNamespace
}));

mock.module('./resource-resolvers/redis-clusters', () => ({
  resolveRedisClusters: mockResolveRedisClusters
}));

mock.module('./resource-resolvers/upstash-redis', () => ({
  resolveUpstashRedisDatabases: mockResolveUpstashRedisDatabases
}));

mock.module('./resource-resolvers/edge-lambda-functions', () => ({
  resolveEdgeLambdaFunctions: mockResolveEdgeLambdaFunctions
}));

mock.module('./resource-resolvers/budget', () => ({
  resolveBudget: mockResolveBudget
}));

mock.module('./resource-resolvers/background-resources/code-deploy', () => ({
  resolveCodeDeploySharedResources: mockResolveCodeDeploySharedResources
}));

mock.module('./resource-resolvers/web-services', () => ({
  resolveWebServices: mockResolveWebServices
}));

mock.module('./resource-resolvers/aws-cdk-construct', () => ({
  resolveAwsCdkConstructs: mockResolveAwsCdkConstructs
}));

mock.module('./resource-resolvers/private-services', () => ({
  resolvePrivateServices: mockResolvePrivateServices
}));

mock.module('./resource-resolvers/worker-services', () => ({
  resolveWorkerServices: mockResolveWorkerServices
}));

mock.module('./resource-resolvers/sqs-queues', () => ({
  resolveSqsQueues: mockResolveSqsQueues
}));

mock.module('./resource-resolvers/sns-topics', () => ({
  resolveSnsTopics: mockResolveSnsTopics
}));

mock.module('./resource-resolvers/hosting-buckets', () => ({
  resolveHostingBuckets: mockResolveHostingBuckets
}));

mock.module('./resource-resolvers/web-app-firewalls', () => ({
  resolveWebAppFirewalls: mockResolveWebAppFirewalls
}));

mock.module('./resource-resolvers/deployment-scripts', () => ({
  resolveDeploymentScripts: mockResolveDeploymentScripts
}));

mock.module('./resource-resolvers/nextjs-web', () => ({
  resolveNextjsWebs: mockResolveNextjsWebs
}));

mock.module('./resource-resolvers/efs-filesystems', () => ({
  resolveEfsFilesystems: mockResolveEfsFilesystems
}));

const mockStartEvent = mock(async () => {});
const mockFinishEvent = mock(async () => {});
const mockAddStackOutput = mock(() => {});
const mockAddResource = mock(() => {});
const mockResolveDirectives = mock(async ({ itemToResolve }) => itemToResolve);
const mockFindResourceInConfig = mock(() => ({
  resource: {
    type: 'function',
    _nestedResources: undefined
  }
}));
const mockTransformIntoCloudformationSubstitutedString = mock((obj) => obj);
const mockGetCloudformationChildResources = mock(() => ({}));
const mockConsoleLinks = {
  stackUrl: mock(() => 'https://console.aws.amazon.com/cloudformation')
};
const mockSerialize = mock((obj) => JSON.parse(JSON.stringify(obj)));

const mockGlobalStateManager = {
  region: 'us-east-1',
  targetStack: {
    stackName: 'test-stack',
    projectName: 'test-project',
    stage: 'test'
  }
};

const mockConfigManager = {
  allImagesCount: 5,
  allLambdaResourcesCount: 10,
  deploymentConfig: {
    cloudformationRoleArn: 'arn:aws:iam::123456789012:role/cf-role'
  },
  sharedGlobalNestedResources: {},
  findResourceInConfig: mockFindResourceInConfig,
  resolveDirectives: mockResolveDirectives
};

const mockTemplateManager = {
  addStackOutput: mockAddStackOutput,
  addResource: mockAddResource
};

mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mockStartEvent,
    finishEvent: mockFinishEvent
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: mockGlobalStateManager
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: mockConfigManager
}));

mock.module('@domain-services/template-manager', () => ({
  templateManager: mockTemplateManager
}));

mock.module('@utils/cloudformation', () => ({
  transformIntoCloudformationSubstitutedString: mockTransformIntoCloudformationSubstitutedString
}));

mock.module('@shared/utils/stack-info-map', () => ({
  getCloudformationChildResources: mockGetCloudformationChildResources
}));

mock.module('@shared/naming/console-links', () => ({
  consoleLinks: mockConsoleLinks
}));

mock.module('@shared/naming/metadata-names', () => ({
  stackMetadataNames: {
    stackConsole: () => 'stack-console',
    imageCount: () => 'image-count',
    functionCount: () => 'function-count',
    cloudformationRoleArn: () => 'cloudformation-role-arn'
  }
}));

mock.module('@shared/naming/ssm-secret-parameters', () => ({
  buildSSMParameterNameForReferencableParam: mock(() => '/stacktape/test-stack/myFunction/apiKey')
}));

mock.module('@shared/utils/misc', () => ({
  serialize: mockSerialize
}));

mock.module('@shared/utils/constants', () => ({
  PARENT_IDENTIFIER_CUSTOM_CF: '__CUSTOM_CF__',
  PARENT_IDENTIFIER_SHARED_GLOBAL: '__SHARED_GLOBAL__'
}));

describe('CalculatedStackOverviewManager', () => {
  let calculatedManager: any;

  beforeEach(async () => {
    mock.restore();
    mockStartEvent.mockClear();
    mockFinishEvent.mockClear();
    mockAddStackOutput.mockClear();
    mockAddResource.mockClear();
    mockResolveDirectives.mockClear();
    mockFindResourceInConfig.mockClear();
    mockTransformIntoCloudformationSubstitutedString.mockClear();
    mockGetCloudformationChildResources.mockClear();
    mockSerialize.mockClear();

    // Clear all resource resolver mocks
    mockResolveStackOutputs.mockClear();
    mockResolveCustomResources.mockClear();
    mockResolveDeploymentBucket.mockClear();
    mockResolveImageRepository.mockClear();
    mockResolveApplicationLoadBalancers.mockClear();
    mockResolveBatchJobs.mockClear();
    mockResolveNetworkLoadBalancers.mockClear();
    mockResolveBuckets.mockClear();
    mockResolveContainerWorkloads.mockClear();
    mockResolveAwsVpcDeployment.mockClear();
    mockResolveDefaultEdgeLambdas.mockClear();
    mockResolveDefaultEdgeLambdaBucket.mockClear();
    mockResolveStacktapeServiceLambda.mockClear();
    mockResolveFunctions.mockClear();
    mockResolveS3EventsCustomResource.mockClear();
    mockResolveSensitiveDataCustomResource.mockClear();
    mockResolveAcceptVpcPeeringCustomResource.mockClear();
    mockResolveDefaultDomainCertCustomResource.mockClear();
    mockResolveDatabases.mockClear();
    mockResolveDynamoTables.mockClear();
    mockResolveOpenSearchDomains.mockClear();
    mockResolveEventBuses.mockClear();
    mockResolveBastions.mockClear();
    mockResolveCloudformationResources.mockClear();
    mockResolveStateMachines.mockClear();
    mockResolveHttpApiGateways.mockClear();
    mockResolveUserPools.mockClear();
    mockResolveAtlasMongoClusters.mockClear();
    mockResolveServiceDiscoveryPrivateNamespace.mockClear();
    mockResolveRedisClusters.mockClear();
    mockResolveUpstashRedisDatabases.mockClear();
    mockResolveEdgeLambdaFunctions.mockClear();
    mockResolveBudget.mockClear();
    mockResolveCodeDeploySharedResources.mockClear();
    mockResolveWebServices.mockClear();
    mockResolveAwsCdkConstructs.mockClear();
    mockResolvePrivateServices.mockClear();
    mockResolveWorkerServices.mockClear();
    mockResolveSqsQueues.mockClear();
    mockResolveSnsTopics.mockClear();
    mockResolveHostingBuckets.mockClear();
    mockResolveWebAppFirewalls.mockClear();
    mockResolveDeploymentScripts.mockClear();
    mockResolveNextjsWebs.mockClear();
    mockResolveEfsFilesystems.mockClear();

    const module = await import('./index');
    calculatedManager = module.calculatedStackOverviewManager;
    await calculatedManager.init();
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      const { CalculatedStackOverviewManager } = await import('./index');
      const manager = new CalculatedStackOverviewManager();
      await manager.init();
      expect(manager.stackInfoMap).toBeDefined();
      expect(manager.stackInfoMap.resources).toEqual({});
      expect(manager.stackInfoMap.metadata).toEqual({});
      expect(manager.stackInfoMap.customOutputs).toEqual({});
    });
  });

  describe('reset', () => {
    test('should reset stack info map', () => {
      calculatedManager.stackInfoMap.resources.myFunction = {
        resourceType: 'function',
        cloudformationChildResources: {}
      };

      calculatedManager.reset();

      expect(Object.keys(calculatedManager.stackInfoMap.resources)).toHaveLength(0);
      expect(Object.keys(calculatedManager.stackInfoMap.metadata)).toHaveLength(0);
      expect(Object.keys(calculatedManager.stackInfoMap.customOutputs)).toHaveLength(0);
    });
  });

  describe('resolveAllResources', () => {
    test('should call all resource resolvers in parallel', async () => {
      await calculatedManager.resolveAllResources();

      expect(mockStartEvent).toHaveBeenCalledWith({
        eventType: 'RESOLVE_CONFIG',
        description: 'Resolving configuration'
      });

      expect(mockResolveStackOutputs).toHaveBeenCalled();
      expect(mockResolveCustomResources).toHaveBeenCalled();
      expect(mockResolveDeploymentBucket).toHaveBeenCalled();
      expect(mockResolveImageRepository).toHaveBeenCalled();
      expect(mockResolveApplicationLoadBalancers).toHaveBeenCalled();
      expect(mockResolveBatchJobs).toHaveBeenCalled();
      expect(mockResolveNetworkLoadBalancers).toHaveBeenCalled();
      expect(mockResolveBuckets).toHaveBeenCalled();
      expect(mockResolveContainerWorkloads).toHaveBeenCalled();
      expect(mockResolveAwsVpcDeployment).toHaveBeenCalled();
      expect(mockResolveDefaultEdgeLambdas).toHaveBeenCalled();
      expect(mockResolveDefaultEdgeLambdaBucket).toHaveBeenCalled();
      expect(mockResolveStacktapeServiceLambda).toHaveBeenCalled();
      expect(mockResolveFunctions).toHaveBeenCalled();
      expect(mockResolveS3EventsCustomResource).toHaveBeenCalled();
      expect(mockResolveSensitiveDataCustomResource).toHaveBeenCalled();
      expect(mockResolveAcceptVpcPeeringCustomResource).toHaveBeenCalled();
      expect(mockResolveDefaultDomainCertCustomResource).toHaveBeenCalled();
      expect(mockResolveDatabases).toHaveBeenCalled();
      expect(mockResolveDynamoTables).toHaveBeenCalled();
      expect(mockResolveOpenSearchDomains).toHaveBeenCalled();
      expect(mockResolveEventBuses).toHaveBeenCalled();
      expect(mockResolveBastions).toHaveBeenCalled();
      expect(mockResolveCloudformationResources).toHaveBeenCalled();
      expect(mockResolveStateMachines).toHaveBeenCalled();
      expect(mockResolveHttpApiGateways).toHaveBeenCalled();
      expect(mockResolveUserPools).toHaveBeenCalled();
      expect(mockResolveAtlasMongoClusters).toHaveBeenCalled();
      expect(mockResolveServiceDiscoveryPrivateNamespace).toHaveBeenCalled();
      expect(mockResolveRedisClusters).toHaveBeenCalled();
      expect(mockResolveUpstashRedisDatabases).toHaveBeenCalled();
      expect(mockResolveEdgeLambdaFunctions).toHaveBeenCalled();
      expect(mockResolveBudget).toHaveBeenCalled();
      expect(mockResolveCodeDeploySharedResources).toHaveBeenCalled();
      expect(mockResolveWebServices).toHaveBeenCalled();
      expect(mockResolveAwsCdkConstructs).toHaveBeenCalled();
      expect(mockResolvePrivateServices).toHaveBeenCalled();
      expect(mockResolveWorkerServices).toHaveBeenCalled();
      expect(mockResolveSqsQueues).toHaveBeenCalled();
      expect(mockResolveSnsTopics).toHaveBeenCalled();
      expect(mockResolveHostingBuckets).toHaveBeenCalled();
      expect(mockResolveWebAppFirewalls).toHaveBeenCalled();
      expect(mockResolveDeploymentScripts).toHaveBeenCalled();
      expect(mockResolveNextjsWebs).toHaveBeenCalled();
      expect(mockResolveEfsFilesystems).toHaveBeenCalled();

      expect(mockFinishEvent).toHaveBeenCalledWith({
        eventType: 'RESOLVE_CONFIG'
      });
    });

    test('should handle resolver failures', async () => {
      mockResolveFunctions.mockRejectedValueOnce(new Error('Function resolution failed'));

      await expect(calculatedManager.resolveAllResources()).rejects.toThrow('Function resolution failed');
    });
  });

  describe('resourceCount', () => {
    test('should return total number of CloudFormation resources', () => {
      calculatedManager.stackInfoMap.resources = {
        myFunction: {
          resourceType: 'function',
          cloudformationChildResources: {
            MyFunctionRole: { cloudformationResourceType: 'AWS::IAM::Role' },
            MyFunctionLogGroup: { cloudformationResourceType: 'AWS::Logs::LogGroup' }
          },
          referencableParams: {},
          links: {},
          outputs: {}
        },
        myBucket: {
          resourceType: 'bucket',
          cloudformationChildResources: {
            MyBucket: { cloudformationResourceType: 'AWS::S3::Bucket' }
          },
          referencableParams: {},
          links: {},
          outputs: {}
        }
      };

      const count = calculatedManager.resourceCount;
      expect(count).toBe(3);
    });

    test('should return 0 for empty stack', () => {
      expect(calculatedManager.resourceCount).toBe(0);
    });
  });

  describe('getStpResource', () => {
    test('should get resource by name chain array', () => {
      calculatedManager.stackInfoMap.resources.myFunction = {
        resourceType: 'function',
        cloudformationChildResources: {},
        referencableParams: {},
        links: {},
        outputs: {}
      };

      const resource = calculatedManager.getStpResource({ nameChain: ['myFunction'] });
      expect(resource).toBeDefined();
      expect(resource.resourceType).toBe('function');
    });

    test('should get resource by name chain string', () => {
      calculatedManager.stackInfoMap.resources.myFunction = {
        resourceType: 'function',
        cloudformationChildResources: {},
        referencableParams: {},
        links: {},
        outputs: {}
      };

      const resource = calculatedManager.getStpResource({ nameChain: 'myFunction' });
      expect(resource).toBeDefined();
      expect(resource.resourceType).toBe('function');
    });

    test('should get nested resource', () => {
      calculatedManager.stackInfoMap.resources.myService = {
        resourceType: 'web-service',
        cloudformationChildResources: {},
        referencableParams: {},
        links: {},
        outputs: {},
        _nestedResources: {
          myFunction: {
            resourceType: 'function',
            cloudformationChildResources: {},
            referencableParams: {},
            links: {},
            outputs: {}
          }
        }
      };

      const resource = calculatedManager.getStpResource({ nameChain: ['myService', 'myFunction'] });
      expect(resource).toBeDefined();
      expect(resource.resourceType).toBe('function');
    });

    test('should return undefined for non-existent resource', () => {
      const resource = calculatedManager.getStpResource({ nameChain: 'nonExistent' });
      expect(resource).toBeUndefined();
    });
  });

  describe('addCfChildResource', () => {
    test('should add CloudFormation child resource', () => {
      mockFindResourceInConfig.mockReturnValueOnce({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addCfChildResource({
        cfLogicalName: 'MyFunctionRole',
        nameChain: ['myFunction'],
        resource: {
          Type: 'AWS::IAM::Role',
          Properties: {}
        },
        initial: false
      });

      expect(calculatedManager.stackInfoMap.resources.myFunction).toBeDefined();
      expect(
        calculatedManager.stackInfoMap.resources.myFunction.cloudformationChildResources.MyFunctionRole
      ).toBeDefined();
      expect(mockAddResource).toHaveBeenCalledWith({
        cfLogicalName: 'MyFunctionRole',
        resource: expect.objectContaining({ Type: 'AWS::IAM::Role' }),
        initial: false
      });
    });

    test('should throw error for duplicate CloudFormation logical name', () => {
      mockFindResourceInConfig.mockReturnValue({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addCfChildResource({
        cfLogicalName: 'MyFunctionRole',
        nameChain: ['myFunction'],
        resource: { Type: 'AWS::IAM::Role', Properties: {} }
      });

      expect(() => {
        calculatedManager.addCfChildResource({
          cfLogicalName: 'MyFunctionRole',
          nameChain: ['myFunction'],
          resource: { Type: 'AWS::IAM::Role', Properties: {} }
        });
      }).toThrow();
    });

    test('should handle initial flag', () => {
      mockFindResourceInConfig.mockReturnValueOnce({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addCfChildResource({
        cfLogicalName: 'MyFunctionRole',
        nameChain: ['myFunction'],
        resource: { Type: 'AWS::IAM::Role', Properties: {} },
        initial: true
      });

      expect(mockAddResource).toHaveBeenCalledWith(
        expect.objectContaining({
          initial: true
        })
      );
    });
  });

  describe('addUserCustomStackOutput', () => {
    test('should add custom output to stack info map and template', () => {
      calculatedManager.addUserCustomStackOutput({
        cloudformationOutputName: 'MyOutput',
        value: 'my-value',
        description: 'My custom output'
      });

      expect(calculatedManager.stackInfoMap.customOutputs.MyOutput).toBe('my-value');
      expect(mockAddStackOutput).toHaveBeenCalledWith({
        cfOutputName: 'MyOutput',
        value: 'my-value',
        exportOutput: undefined,
        description: 'My custom output'
      });
    });

    test('should handle exported outputs', () => {
      calculatedManager.addUserCustomStackOutput({
        cloudformationOutputName: 'ExportedOutput',
        value: 'exported-value',
        exportOutput: true
      });

      expect(mockAddStackOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          exportOutput: true
        })
      );
    });
  });

  describe('addStacktapeResourceLink', () => {
    test('should add link to resource', () => {
      mockFindResourceInConfig.mockReturnValueOnce({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addStacktapeResourceLink({
        nameChain: ['myFunction'],
        linkName: 'Console URL',
        linkValue: 'https://console.aws.amazon.com/lambda'
      });

      expect(calculatedManager.stackInfoMap.resources.myFunction.links['console-url']).toBe(
        'https://console.aws.amazon.com/lambda'
      );
    });

    test('should kebab-case link names', () => {
      mockFindResourceInConfig.mockReturnValueOnce({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addStacktapeResourceLink({
        nameChain: ['myFunction'],
        linkName: 'My Custom Link Name',
        linkValue: 'https://example.com'
      });

      expect(calculatedManager.stackInfoMap.resources.myFunction.links['my-custom-link-name']).toBe(
        'https://example.com'
      );
    });
  });

  describe('addStackMetadata', () => {
    test('should add metadata to stack info map', () => {
      calculatedManager.addStackMetadata({
        metaName: 'test-meta',
        metaValue: 'test-value',
        showDuringPrint: true
      });

      expect(calculatedManager.stackInfoMap.metadata['test-meta']).toEqual({
        showDuringPrint: true,
        value: 'test-value'
      });
    });

    test('should default showDuringPrint to true', () => {
      calculatedManager.addStackMetadata({
        metaName: 'test-meta',
        metaValue: 'test-value'
      });

      expect(calculatedManager.stackInfoMap.metadata['test-meta'].showDuringPrint).toBe(true);
    });

    test('should allow showDuringPrint to be false', () => {
      calculatedManager.addStackMetadata({
        metaName: 'test-meta',
        metaValue: 'test-value',
        showDuringPrint: false
      });

      expect(calculatedManager.stackInfoMap.metadata['test-meta'].showDuringPrint).toBe(false);
    });
  });

  describe('addStacktapeResourceReferenceableParam', () => {
    test('should add referenceable param to resource', () => {
      mockFindResourceInConfig.mockReturnValueOnce({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addStacktapeResourceReferenceableParam({
        nameChain: ['myFunction'],
        paramName: 'functionArn',
        paramValue: { 'Fn::GetAtt': ['MyFunction', 'Arn'] },
        showDuringPrint: true
      });

      expect(calculatedManager.stackInfoMap.resources.myFunction.referencableParams.functionArn).toEqual({
        showDuringPrint: true,
        value: { 'Fn::GetAtt': ['MyFunction', 'Arn'] },
        ssmParameterName: undefined
      });
    });

    test('should handle sensitive params with SSM parameter name', () => {
      mockFindResourceInConfig.mockReturnValueOnce({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addStacktapeResourceReferenceableParam({
        nameChain: ['myFunction'],
        paramName: 'apiKey',
        paramValue: 'secret-key',
        sensitive: true
      });

      const param = calculatedManager.stackInfoMap.resources.myFunction.referencableParams.apiKey;
      expect(param.ssmParameterName).toBeDefined();
      expect(param.ssmParameterName).toContain('/stacktape/');
    });

    test('should default showDuringPrint to true', () => {
      mockFindResourceInConfig.mockReturnValueOnce({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addStacktapeResourceReferenceableParam({
        nameChain: ['myFunction'],
        paramName: 'functionName',
        paramValue: 'my-function'
      });

      expect(calculatedManager.stackInfoMap.resources.myFunction.referencableParams.functionName.showDuringPrint).toBe(
        true
      );
    });
  });

  describe('addStacktapeResourceOutput', () => {
    test('should add output to resource', () => {
      mockFindResourceInConfig.mockReturnValueOnce({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addStacktapeResourceOutput({
        nameChain: ['myFunction'],
        output: {
          functionName: 'my-function',
          functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-function'
        }
      });

      expect(calculatedManager.stackInfoMap.resources.myFunction.outputs).toEqual({
        functionName: 'my-function',
        functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-function'
      });
    });

    test('should merge outputs', () => {
      mockFindResourceInConfig.mockReturnValue({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addStacktapeResourceOutput({
        nameChain: ['myFunction'],
        output: { functionName: 'my-function' }
      });

      calculatedManager.addStacktapeResourceOutput({
        nameChain: ['myFunction'],
        output: { functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-function' }
      });

      expect(calculatedManager.stackInfoMap.resources.myFunction.outputs).toEqual({
        functionName: 'my-function',
        functionArn: 'arn:aws:lambda:us-east-1:123456789012:function:my-function'
      });
    });
  });

  describe('getSubstitutedStackInfoMap', () => {
    test('should substitute sensitive values with placeholders', async () => {
      mockFindResourceInConfig.mockReturnValue({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addStacktapeResourceReferenceableParam({
        nameChain: ['myFunction'],
        paramName: 'apiKey',
        paramValue: 'secret-key-123',
        sensitive: true
      });

      mockResolveDirectives.mockImplementationOnce(async ({ itemToResolve }) => itemToResolve);

      const result = await calculatedManager.getSubstitutedStackInfoMap();

      expect(mockResolveDirectives).toHaveBeenCalledWith(
        expect.objectContaining({
          resolveRuntime: true,
          useLocalResolve: false
        })
      );

      expect(mockTransformIntoCloudformationSubstitutedString).toHaveBeenCalled();
    });

    test('should resolve directives with runtime flag', async () => {
      await calculatedManager.getSubstitutedStackInfoMap();

      expect(mockResolveDirectives).toHaveBeenCalledWith(
        expect.objectContaining({
          resolveRuntime: true
        })
      );
    });

    test('should transform into CloudFormation substituted string', async () => {
      await calculatedManager.getSubstitutedStackInfoMap();

      expect(mockTransformIntoCloudformationSubstitutedString).toHaveBeenCalled();
    });
  });

  describe('populateStackMetadata', () => {
    test('should populate all stack metadata', async () => {
      await calculatedManager.populateStackMetadata();

      expect(calculatedManager.stackInfoMap.metadata['stack-console']).toBeDefined();
      expect(calculatedManager.stackInfoMap.metadata['image-count']).toBeDefined();
      expect(calculatedManager.stackInfoMap.metadata['function-count']).toBeDefined();
      expect(calculatedManager.stackInfoMap.metadata['cloudformation-role-arn']).toBeDefined();
    });

    test('should include console link', async () => {
      await calculatedManager.populateStackMetadata();

      expect(mockConsoleLinks.stackUrl).toHaveBeenCalledWith('us-east-1', 'test-stack', 'resources');
    });

    test('should skip CloudFormation role ARN when not configured', async () => {
      mockConfigManager.deploymentConfig = undefined;

      await calculatedManager.populateStackMetadata();

      expect(calculatedManager.stackInfoMap.metadata['cloudformation-role-arn']).toBeUndefined();
    });
  });

  describe('isCfResourceChildOfStpResource', () => {
    test('should return true for valid child resource', () => {
      mockGetCloudformationChildResources.mockReturnValueOnce({
        MyFunctionRole: { cloudformationResourceType: 'AWS::IAM::Role' }
      });

      calculatedManager.stackInfoMap.resources.myFunction = {
        resourceType: 'function',
        cloudformationChildResources: {},
        referencableParams: {},
        links: {},
        outputs: {}
      };

      const result = calculatedManager.isCfResourceChildOfStpResource({
        stpResourceName: 'myFunction',
        cfLogicalName: 'MyFunctionRole'
      });

      expect(result).toBe(true);
    });

    test('should return false for invalid child resource', () => {
      mockGetCloudformationChildResources.mockReturnValueOnce({});

      calculatedManager.stackInfoMap.resources.myFunction = {
        resourceType: 'function',
        cloudformationChildResources: {},
        referencableParams: {},
        links: {},
        outputs: {}
      };

      const result = calculatedManager.isCfResourceChildOfStpResource({
        stpResourceName: 'myFunction',
        cfLogicalName: 'NonExistentResource'
      });

      expect(result).toBe(false);
    });
  });

  describe('getChildResourceList', () => {
    test('should return child resources for STP resource', () => {
      calculatedManager.stackInfoMap.resources.myFunction = {
        resourceType: 'function',
        cloudformationChildResources: {
          MyFunctionRole: { cloudformationResourceType: 'AWS::IAM::Role' },
          MyFunctionLogGroup: { cloudformationResourceType: 'AWS::Logs::LogGroup' }
        },
        referencableParams: {},
        links: {},
        outputs: {}
      };

      mockGetCloudformationChildResources.mockReturnValueOnce({
        MyFunctionRole: { cloudformationResourceType: 'AWS::IAM::Role' },
        MyFunctionLogGroup: { cloudformationResourceType: 'AWS::Logs::LogGroup' }
      });

      const children = calculatedManager.getChildResourceList({ stpResourceName: 'myFunction' });

      expect(Object.keys(children)).toHaveLength(2);
    });
  });

  describe('findStpParentNameOfCfResource', () => {
    test('should find parent STP resource of CloudFormation resource', () => {
      calculatedManager.stackInfoMap.resources.myFunction = {
        resourceType: 'function',
        cloudformationChildResources: {},
        referencableParams: {},
        links: {},
        outputs: {}
      };

      mockGetCloudformationChildResources.mockReturnValueOnce({
        MyFunctionRole: { cloudformationResourceType: 'AWS::IAM::Role' }
      });

      const parent = calculatedManager.findStpParentNameOfCfResource({
        cfLogicalName: 'MyFunctionRole'
      });

      expect(parent).toBe('myFunction');
    });

    test('should return undefined when no parent found', () => {
      mockGetCloudformationChildResources.mockReturnValue({});

      const parent = calculatedManager.findStpParentNameOfCfResource({
        cfLogicalName: 'NonExistentResource'
      });

      expect(parent).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    test('should handle empty stack info map', () => {
      expect(calculatedManager.stackInfoMap.resources).toEqual({});
      expect(calculatedManager.resourceCount).toBe(0);
    });

    test('should handle nested resources with multiple levels', () => {
      mockFindResourceInConfig.mockReturnValue({
        resource: {
          type: 'web-service',
          _nestedResources: {
            myFunction: {
              type: 'function',
              _nestedResources: undefined
            }
          }
        }
      });

      calculatedManager.addCfChildResource({
        cfLogicalName: 'NestedFunctionRole',
        nameChain: ['myService', 'myFunction'],
        resource: { Type: 'AWS::IAM::Role', Properties: {} }
      });

      const resource = calculatedManager.getStpResource({ nameChain: ['myService', 'myFunction'] });
      expect(resource).toBeDefined();
    });

    test('should handle special parent identifiers', () => {
      mockFindResourceInConfig.mockReturnValue({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addCfChildResource({
        cfLogicalName: 'SharedResource',
        nameChain: ['__SHARED_GLOBAL__'],
        resource: { Type: 'AWS::S3::Bucket', Properties: {} }
      });

      expect(calculatedManager.stackInfoMap.resources['__SHARED_GLOBAL__']).toBeDefined();
    });

    test('should handle concurrent resource additions', () => {
      mockFindResourceInConfig.mockReturnValue({
        resource: { type: 'function', _nestedResources: undefined }
      });

      calculatedManager.addCfChildResource({
        cfLogicalName: 'Function1Role',
        nameChain: ['function1'],
        resource: { Type: 'AWS::IAM::Role', Properties: {} }
      });

      calculatedManager.addCfChildResource({
        cfLogicalName: 'Function2Role',
        nameChain: ['function2'],
        resource: { Type: 'AWS::IAM::Role', Properties: {} }
      });

      expect(Object.keys(calculatedManager.stackInfoMap.resources)).toHaveLength(2);
    });
  });
});
