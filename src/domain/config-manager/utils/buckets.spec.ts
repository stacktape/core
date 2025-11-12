import { describe, expect, mock, test } from 'bun:test';

// Mock all dependencies
mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference, stpResourceType }) => ({
    name: stpResourceReference,
    type: stpResourceType,
    properties: {}
  }))
}));

mock.module('../index', () => ({
  configManager: {
    simplifiedCdnAssociations: {
      bucket: {}
    },
    allHttpApiGateways: [],
    allBuckets: [],
    allApplicationLoadBalancers: []
  }
}));

describe('config-manager/utils/buckets', () => {
  describe('resolveReferenceToBucket', () => {
    test('should resolve bucket reference', async () => {
      const { resolveReferenceToBucket } = await import('./buckets');
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');

      const result = resolveReferenceToBucket({
        stpResourceReference: 'myBucket',
        referencedFrom: 'myFunction',
        referencedFromType: 'function'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'myBucket',
        stpResourceType: 'bucket',
        referencedFrom: 'myFunction',
        referencedFromType: 'function'
      });
      expect(result.name).toBe('myBucket');
    });

    test('should resolve bucket reference without referencedFromType', async () => {
      const { resolveReferenceToBucket } = await import('./buckets');
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');

      const result = resolveReferenceToBucket({
        stpResourceReference: 'storageBucket',
        referencedFrom: 'myLambda'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalled();
      expect(result.name).toBe('storageBucket');
    });

    test('should pass correct resource type to reference resolver', async () => {
      const { resolveReferenceToBucket } = await import('./buckets');
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');

      resolveReferenceToBucket({
        stpResourceReference: 'assetsBucket',
        referencedFrom: 'webService',
        referencedFromType: 'web-service'
      });

      const lastCall = getPropsOfResourceReferencedInConfig.mock.calls[
        getPropsOfResourceReferencedInConfig.mock.calls.length - 1
      ][0];
      expect(lastCall.stpResourceType).toBe('bucket');
    });
  });

  describe('validateBucketConfig', () => {
    test('should validate bucket without directory upload', async () => {
      const { validateBucketConfig } = await import('./buckets');

      const definition: any = {
        type: 'bucket',
        name: 'myBucket',
        properties: {}
      };

      expect(() => validateBucketConfig({ definition })).not.toThrow();
    });

    test('should validate bucket with directory upload but no headers preset', async () => {
      const { validateBucketConfig } = await import('./buckets');

      const definition: any = {
        type: 'bucket',
        name: 'myBucket',
        directoryUpload: {
          path: './dist'
        }
      };

      expect(() => validateBucketConfig({ definition })).not.toThrow();
    });

    test('should validate bucket with headers preset', async () => {
      mock.module('../index', () => ({
        configManager: {
          simplifiedCdnAssociations: {
            bucket: {
              myBucket: ['cdn1']
            }
          },
          allHttpApiGateways: [],
          allBuckets: [
            {
              name: 'cdn1',
              type: 'bucket',
              cdn: {}
            }
          ],
          allApplicationLoadBalancers: []
        }
      }));

      const { validateBucketConfig } = await import('./buckets');

      const definition: any = {
        type: 'bucket',
        name: 'myBucket',
        directoryUpload: {
          path: './dist',
          headersPreset: 'spa'
        }
      };

      // Should not throw as the error logic is commented out
      expect(() => validateBucketConfig({ definition })).not.toThrow();
    });

    test('should handle bucket with CDN associations', async () => {
      mock.module('../index', () => ({
        configManager: {
          simplifiedCdnAssociations: {
            bucket: {
              myBucket: ['gateway1', 'alb1']
            }
          },
          allHttpApiGateways: [
            {
              name: 'gateway1',
              type: 'http-api-gateway',
              cdn: {}
            }
          ],
          allBuckets: [],
          allApplicationLoadBalancers: [
            {
              name: 'alb1',
              type: 'application-load-balancer',
              cdn: {}
            }
          ]
        }
      }));

      const { validateBucketConfig } = await import('./buckets');

      const definition: any = {
        type: 'bucket',
        name: 'myBucket',
        directoryUpload: {
          path: './dist',
          headersPreset: 'custom'
        }
      };

      expect(() => validateBucketConfig({ definition })).not.toThrow();
    });

    test('should handle bucket with no CDN associations', async () => {
      mock.module('../index', () => ({
        configManager: {
          simplifiedCdnAssociations: {
            bucket: {}
          },
          allHttpApiGateways: [],
          allBuckets: [],
          allApplicationLoadBalancers: []
        }
      }));

      const { validateBucketConfig } = await import('./buckets');

      const definition: any = {
        type: 'bucket',
        name: 'standaloneBucket',
        directoryUpload: {
          headersPreset: 'spa'
        }
      };

      expect(() => validateBucketConfig({ definition })).not.toThrow();
    });

    test('should handle complex bucket configuration', async () => {
      const { validateBucketConfig } = await import('./buckets');

      const definition: any = {
        type: 'bucket',
        name: 'complexBucket',
        directoryUpload: {
          path: './build',
          headersPreset: 'custom',
          cacheControl: 'max-age=3600'
        },
        properties: {
          versioning: true,
          encryption: true
        }
      };

      expect(() => validateBucketConfig({ definition })).not.toThrow();
    });
  });
});
