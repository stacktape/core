import { describe, expect, mock, test } from 'bun:test';

// Mock resource references
mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference, stpResourceType, referencedFrom, referencedFromType }) => ({
    name: stpResourceReference || 'default-edge-function',
    type: stpResourceType,
    props: { /* edge function properties */ }
  }))
}));

describe('config-manager/utils/edge-functions', () => {
  describe('resolveReferenceToEdgeLambdaFunction', () => {
    test('should call getPropsOfResourceReferencedInConfig with correct resource type', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEdgeLambdaFunction } = await import('./edge-functions');

      resolveReferenceToEdgeLambdaFunction({
        stpResourceReference: 'myEdgeFunction',
        referencedFrom: 'myCdn'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'myEdgeFunction',
        stpResourceType: 'edge-lambda-function',
        referencedFrom: 'myCdn',
        referencedFromType: undefined
      });
    });

    test('should pass referencedFromType to getPropsOfResourceReferencedInConfig', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEdgeLambdaFunction } = await import('./edge-functions');

      resolveReferenceToEdgeLambdaFunction({
        stpResourceReference: 'edgeFunc1',
        referencedFrom: 'myResource',
        referencedFromType: 'nextjs-web'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'edgeFunc1',
        stpResourceType: 'edge-lambda-function',
        referencedFrom: 'myResource',
        referencedFromType: 'nextjs-web'
      });
    });

    test('should return result from getPropsOfResourceReferencedInConfig', async () => {
      const { resolveReferenceToEdgeLambdaFunction } = await import('./edge-functions');

      const result = resolveReferenceToEdgeLambdaFunction({
        stpResourceReference: 'myEdgeFunction',
        referencedFrom: 'myResource'
      });

      expect(result.name).toBe('myEdgeFunction');
      expect(result.type).toBe('edge-lambda-function');
    });

    test('should handle different resource types', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEdgeLambdaFunction } = await import('./edge-functions');

      resolveReferenceToEdgeLambdaFunction({
        stpResourceReference: 'func1',
        referencedFrom: 'resource1',
        referencedFromType: 'hosting-bucket'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          referencedFromType: 'hosting-bucket'
        })
      );
    });

    test('should pass all parameters through', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEdgeLambdaFunction } = await import('./edge-functions');

      const params = {
        stpResourceReference: 'testEdgeFunc',
        referencedFrom: 'testResource',
        referencedFromType: 'web-service' as StpResourceType
      };

      resolveReferenceToEdgeLambdaFunction(params);

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: params.stpResourceReference,
        stpResourceType: 'edge-lambda-function',
        referencedFrom: params.referencedFrom,
        referencedFromType: params.referencedFromType
      });
    });

    test('should handle CDN-related resource types', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEdgeLambdaFunction } = await import('./edge-functions');

      resolveReferenceToEdgeLambdaFunction({
        stpResourceReference: 'cloudfront-func',
        referencedFrom: 'cdn-resource'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalled();
    });

    test('should handle different edge function names', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEdgeLambdaFunction } = await import('./edge-functions');

      resolveReferenceToEdgeLambdaFunction({
        stpResourceReference: 'auth-edge-function',
        referencedFrom: 'myApp'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          stpResourceReference: 'auth-edge-function'
        })
      );
    });
  });
});
