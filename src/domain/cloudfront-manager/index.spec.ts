import { describe, expect, test, beforeEach, mock } from 'bun:test';

const mockInvalidateCloudfrontDistributionCache = mock(() => 'invalidation-id');
const mockStartEvent = mock(async () => {});
const mockFinishEvent = mock(async () => {});
const mockGetCloudfrontDistributionConfigs = mock(() => ({}));
const mockFindImmediateParent = mock(() => ({ name: 'parentResource' }));

const mockStackManager = {
  existingStackResources: []
};

const mockConfigManager = {
  allResourcesWithCdnsToInvalidate: [],
  findImmediateParent: mockFindImmediateParent
};

const mockCfLogicalNames = {
  cloudfrontDistribution: mock((name, index) => `${name}CloudfrontDistribution${index}`)
};

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    invalidateCloudfrontDistributionCache: mockInvalidateCloudfrontDistributionCache
  }
}));

mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mockStartEvent,
    finishEvent: mockFinishEvent
  }
}));

mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: mockStackManager
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: mockConfigManager
}));

mock.module('@domain-services/calculated-stack-overview-manager/resource-resolvers/_utils/cdn', () => ({
  getCloudfrontDistributionConfigs: mockGetCloudfrontDistributionConfigs
}));

mock.module('@shared/naming/logical-names', () => ({
  cfLogicalNames: mockCfLogicalNames
}));

describe('CloudfrontManager', () => {
  let cloudfrontManager: any;

  beforeEach(async () => {
    mock.restore();
    mockInvalidateCloudfrontDistributionCache.mockClear();
    mockStartEvent.mockClear();
    mockFinishEvent.mockClear();
    mockGetCloudfrontDistributionConfigs.mockClear();
    mockFindImmediateParent.mockClear();
    mockCfLogicalNames.cloudfrontDistribution.mockClear();

    mockInvalidateCloudfrontDistributionCache.mockResolvedValue('invalidation-id-123');
    mockStackManager.existingStackResources = [];
    mockConfigManager.allResourcesWithCdnsToInvalidate = [];
    mockFindImmediateParent.mockReturnValue({ name: 'parentResource' });
    mockCfLogicalNames.cloudfrontDistribution.mockImplementation(
      (name, index) => `${name}CloudfrontDistribution${index}`
    );

    const module = await import('./index');
    cloudfrontManager = module.cloudfrontManager;
    await cloudfrontManager.init();
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      const { CloudfrontManager } = await import('./index');
      const manager = new CloudfrontManager();
      await manager.init();
      expect(manager).toBeDefined();
    });
  });

  describe('invalidateCaches', () => {
    test('should invalidate cache for single distribution without custom domains', async () => {
      mockConfigManager.allResourcesWithCdnsToInvalidate = [
        {
          name: 'myHostingBucket',
          configParentResourceType: 'hosting-bucket',
          nameChain: ['myHostingBucket'],
          cdn: {}
        }
      ];

      mockStackManager.existingStackResources = [
        {
          LogicalResourceId: 'myHostingBucketCloudfrontDistribution0',
          PhysicalResourceId: 'DIST123'
        }
      ];

      await cloudfrontManager.invalidateCaches();

      expect(mockStartEvent).toHaveBeenCalledWith({
        eventType: 'INVALIDATE_CACHE',
        description: 'Invalidating CDN caches'
      });

      expect(mockInvalidateCloudfrontDistributionCache).toHaveBeenCalledWith({
        distributionId: 'DIST123',
        invalidatePaths: ['/*']
      });

      expect(mockFinishEvent).toHaveBeenCalledWith({
        eventType: 'INVALIDATE_CACHE',
        data: { invalidatedDistributionIds: ['invalidation-id-123'] },
        finalMessage: expect.stringContaining('Invalidation has started')
      });
    });

    test('should invalidate caches for multiple distributions with custom domains', async () => {
      mockConfigManager.allResourcesWithCdnsToInvalidate = [
        {
          name: 'myHostingBucket',
          configParentResourceType: 'hosting-bucket',
          nameChain: ['myHostingBucket'],
          cdn: {
            customDomains: [
              { domainName: 'example.com' },
              { domainName: 'www.example.com' }
            ]
          }
        }
      ];

      mockGetCloudfrontDistributionConfigs.mockReturnValueOnce({
        config1: {},
        config2: {}
      });

      mockStackManager.existingStackResources = [
        {
          LogicalResourceId: 'myHostingBucketCloudfrontDistribution0',
          PhysicalResourceId: 'DIST123'
        },
        {
          LogicalResourceId: 'myHostingBucketCloudfrontDistribution1',
          PhysicalResourceId: 'DIST456'
        }
      ];

      await cloudfrontManager.invalidateCaches();

      expect(mockInvalidateCloudfrontDistributionCache).toHaveBeenCalledTimes(2);
      expect(mockInvalidateCloudfrontDistributionCache).toHaveBeenCalledWith({
        distributionId: 'DIST123',
        invalidatePaths: ['/*']
      });
      expect(mockInvalidateCloudfrontDistributionCache).toHaveBeenCalledWith({
        distributionId: 'DIST456',
        invalidatePaths: ['/*']
      });
    });

    test('should handle nextjs-web resources', async () => {
      mockConfigManager.allResourcesWithCdnsToInvalidate = [
        {
          name: 'myNextjsApp',
          configParentResourceType: 'nextjs-web',
          nameChain: ['myNextjsService', 'myNextjsApp'],
          cdn: {}
        }
      ];

      mockFindImmediateParent.mockReturnValueOnce({
        name: 'myNextjsService'
      });

      mockStackManager.existingStackResources = [
        {
          LogicalResourceId: 'myNextjsServiceCloudfrontDistribution0',
          PhysicalResourceId: 'DIST789'
        }
      ];

      await cloudfrontManager.invalidateCaches();

      expect(mockFindImmediateParent).toHaveBeenCalledWith({
        nameChain: ['myNextjsService', 'myNextjsApp']
      });

      expect(mockInvalidateCloudfrontDistributionCache).toHaveBeenCalledWith({
        distributionId: 'DIST789',
        invalidatePaths: ['/*']
      });
    });

    test('should skip resources without distribution IDs', async () => {
      mockConfigManager.allResourcesWithCdnsToInvalidate = [
        {
          name: 'myHostingBucket',
          configParentResourceType: 'hosting-bucket',
          nameChain: ['myHostingBucket'],
          cdn: {}
        }
      ];

      mockStackManager.existingStackResources = [];

      await cloudfrontManager.invalidateCaches();

      expect(mockInvalidateCloudfrontDistributionCache).not.toHaveBeenCalled();
    });

    test('should handle multiple resources with CDNs', async () => {
      mockConfigManager.allResourcesWithCdnsToInvalidate = [
        {
          name: 'hosting1',
          configParentResourceType: 'hosting-bucket',
          nameChain: ['hosting1'],
          cdn: {}
        },
        {
          name: 'hosting2',
          configParentResourceType: 'hosting-bucket',
          nameChain: ['hosting2'],
          cdn: {}
        }
      ];

      mockStackManager.existingStackResources = [
        {
          LogicalResourceId: 'hosting1CloudfrontDistribution0',
          PhysicalResourceId: 'DIST111'
        },
        {
          LogicalResourceId: 'hosting2CloudfrontDistribution0',
          PhysicalResourceId: 'DIST222'
        }
      ];

      await cloudfrontManager.invalidateCaches();

      expect(mockInvalidateCloudfrontDistributionCache).toHaveBeenCalledTimes(2);
    });

    test('should handle no resources to invalidate', async () => {
      mockConfigManager.allResourcesWithCdnsToInvalidate = [];

      await cloudfrontManager.invalidateCaches();

      expect(mockInvalidateCloudfrontDistributionCache).not.toHaveBeenCalled();
      expect(mockFinishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { invalidatedDistributionIds: [] }
        })
      );
    });

    test('should handle invalidation errors', async () => {
      mockConfigManager.allResourcesWithCdnsToInvalidate = [
        {
          name: 'myHostingBucket',
          configParentResourceType: 'hosting-bucket',
          nameChain: ['myHostingBucket'],
          cdn: {}
        }
      ];

      mockStackManager.existingStackResources = [
        {
          LogicalResourceId: 'myHostingBucketCloudfrontDistribution0',
          PhysicalResourceId: 'DIST123'
        }
      ];

      mockInvalidateCloudfrontDistributionCache.mockRejectedValueOnce(
        new Error('CloudFront API Error')
      );

      await expect(cloudfrontManager.invalidateCaches()).rejects.toThrow('CloudFront API Error');
    });
  });

  describe('edge cases', () => {
    test('should handle mixed scenarios with custom domains and default domains', async () => {
      mockConfigManager.allResourcesWithCdnsToInvalidate = [
        {
          name: 'hosting1',
          configParentResourceType: 'hosting-bucket',
          nameChain: ['hosting1'],
          cdn: {}
        },
        {
          name: 'hosting2',
          configParentResourceType: 'hosting-bucket',
          nameChain: ['hosting2'],
          cdn: {
            customDomains: [{ domainName: 'example.com' }]
          }
        }
      ];

      mockGetCloudfrontDistributionConfigs.mockReturnValueOnce({
        config1: {}
      });

      mockStackManager.existingStackResources = [
        {
          LogicalResourceId: 'hosting1CloudfrontDistribution0',
          PhysicalResourceId: 'DIST111'
        },
        {
          LogicalResourceId: 'hosting2CloudfrontDistribution0',
          PhysicalResourceId: 'DIST222'
        }
      ];

      await cloudfrontManager.invalidateCaches();

      expect(mockInvalidateCloudfrontDistributionCache).toHaveBeenCalledTimes(2);
    });

    test('should handle resources with missing physical IDs', async () => {
      mockConfigManager.allResourcesWithCdnsToInvalidate = [
        {
          name: 'myHostingBucket',
          configParentResourceType: 'hosting-bucket',
          nameChain: ['myHostingBucket'],
          cdn: {}
        }
      ];

      mockStackManager.existingStackResources = [
        {
          LogicalResourceId: 'myHostingBucketCloudfrontDistribution0',
          PhysicalResourceId: undefined
        }
      ];

      await cloudfrontManager.invalidateCaches();

      expect(mockInvalidateCloudfrontDistributionCache).not.toHaveBeenCalled();
    });

    test('should flatten multiple distribution configs correctly', async () => {
      mockConfigManager.allResourcesWithCdnsToInvalidate = [
        {
          name: 'hosting',
          configParentResourceType: 'hosting-bucket',
          nameChain: ['hosting'],
          cdn: {
            customDomains: [
              { domainName: 'example.com' },
              { domainName: 'www.example.com' },
              { domainName: 'api.example.com' }
            ]
          }
        }
      ];

      mockGetCloudfrontDistributionConfigs.mockReturnValueOnce({
        config1: {},
        config2: {},
        config3: {}
      });

      mockStackManager.existingStackResources = [
        {
          LogicalResourceId: 'hostingCloudfrontDistribution0',
          PhysicalResourceId: 'DIST1'
        },
        {
          LogicalResourceId: 'hostingCloudfrontDistribution1',
          PhysicalResourceId: 'DIST2'
        },
        {
          LogicalResourceId: 'hostingCloudfrontDistribution2',
          PhysicalResourceId: 'DIST3'
        }
      ];

      await cloudfrontManager.invalidateCaches();

      expect(mockInvalidateCloudfrontDistributionCache).toHaveBeenCalledTimes(3);
    });
  });
});
