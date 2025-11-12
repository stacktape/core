import { describe, expect, mock, test } from 'bun:test';

// Mock error messages
mock.module('@errors', () => ({
  stpErrors: {
    e1004: mock(({ firewallName }) => new Error(`Firewall scope mismatch for ${firewallName}`))
  }
}));

// Mock resource references
mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference, stpResourceType }) => ({
    name: stpResourceReference || 'default-firewall',
    type: stpResourceType,
    scope: 'regional' // default scope
  }))
}));

describe('config-manager/utils/web-app-firewall', () => {
  describe('resolveReferenceToFirewall', () => {
    test('should call getPropsOfResourceReferencedInConfig with correct resource type', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToFirewall } = await import('./web-app-firewall');

      resolveReferenceToFirewall({
        referencedFrom: 'myAlb',
        stpResourceReference: 'myFirewall'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'myFirewall',
        stpResourceType: 'web-app-firewall',
        referencedFrom: 'myAlb',
        referencedFromType: undefined
      });
    });

    test('should pass referencedFromType to getPropsOfResourceReferencedInConfig', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToFirewall } = await import('./web-app-firewall');

      resolveReferenceToFirewall({
        referencedFrom: 'myResource',
        referencedFromType: 'user-auth-pool',
        stpResourceReference: 'firewall1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'firewall1',
        stpResourceType: 'web-app-firewall',
        referencedFrom: 'myResource',
        referencedFromType: 'user-auth-pool'
      });
    });

    test('should return firewall when scope matches CDN requirement', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToFirewall } = await import('./web-app-firewall');

      getPropsOfResourceReferencedInConfig.mockImplementationOnce(() => ({
        name: 'cdn-firewall',
        type: 'web-app-firewall',
        scope: 'cdn'
      }));

      const result = resolveReferenceToFirewall({
        referencedFrom: 'myResource',
        stpResourceReference: 'firewall1',
        cdn: true
      });

      expect(result.name).toBe('cdn-firewall');
      expect(result.scope).toBe('cdn');
    });

    test('should return firewall when scope matches regional requirement', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToFirewall } = await import('./web-app-firewall');

      getPropsOfResourceReferencedInConfig.mockImplementationOnce(() => ({
        name: 'regional-firewall',
        type: 'web-app-firewall',
        scope: 'regional'
      }));

      const result = resolveReferenceToFirewall({
        referencedFrom: 'myResource',
        stpResourceReference: 'firewall1',
        cdn: false
      });

      expect(result.name).toBe('regional-firewall');
      expect(result.scope).toBe('regional');
    });

    test('should throw error when CDN is true but firewall scope is regional', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { stpErrors } = await import('@errors');
      const { resolveReferenceToFirewall } = await import('./web-app-firewall');

      getPropsOfResourceReferencedInConfig.mockImplementationOnce(() => ({
        name: 'regional-firewall',
        type: 'web-app-firewall',
        scope: 'regional'
      }));

      try {
        resolveReferenceToFirewall({
          referencedFrom: 'myResource',
          stpResourceReference: 'firewall1',
          cdn: true
        });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(stpErrors.e1004).toHaveBeenCalledWith({
          firewallName: 'regional-firewall'
        });
      }
    });

    test('should throw error when CDN is false but firewall scope is cdn', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { stpErrors } = await import('@errors');
      const { resolveReferenceToFirewall } = await import('./web-app-firewall');

      getPropsOfResourceReferencedInConfig.mockImplementationOnce(() => ({
        name: 'cdn-firewall',
        type: 'web-app-firewall',
        scope: 'cdn'
      }));

      try {
        resolveReferenceToFirewall({
          referencedFrom: 'myResource',
          stpResourceReference: 'firewall1',
          cdn: false
        });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(stpErrors.e1004).toHaveBeenCalledWith({
          firewallName: 'cdn-firewall'
        });
      }
    });

    test('should not throw when cdn parameter is not provided', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToFirewall } = await import('./web-app-firewall');

      getPropsOfResourceReferencedInConfig.mockImplementationOnce(() => ({
        name: 'firewall',
        type: 'web-app-firewall',
        scope: 'regional'
      }));

      const result = resolveReferenceToFirewall({
        referencedFrom: 'myResource',
        stpResourceReference: 'firewall1'
      });

      expect(result.name).toBe('firewall');
    });

    test('should handle undefined stpResourceReference', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToFirewall } = await import('./web-app-firewall');

      resolveReferenceToFirewall({
        referencedFrom: 'myResource',
        stpResourceReference: undefined
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: undefined,
        stpResourceType: 'web-app-firewall',
        referencedFrom: 'myResource',
        referencedFromType: undefined
      });
    });

    test('should handle web-service as referencedFromType', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToFirewall } = await import('./web-app-firewall');

      resolveReferenceToFirewall({
        referencedFrom: 'myWebService',
        referencedFromType: 'web-service',
        stpResourceReference: 'firewall1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          referencedFromType: 'web-service'
        })
      );
    });

    test('should handle hosting-bucket as referencedFromType', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToFirewall } = await import('./web-app-firewall');

      resolveReferenceToFirewall({
        referencedFrom: 'myBucket',
        referencedFromType: 'hosting-bucket',
        stpResourceReference: 'firewall1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          referencedFromType: 'hosting-bucket'
        })
      );
    });

    test('should handle CDN attachable resource types', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToFirewall } = await import('./web-app-firewall');

      resolveReferenceToFirewall({
        referencedFrom: 'myResource',
        referencedFromType: 'nextjs-web',
        stpResourceReference: 'firewall1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          referencedFromType: 'nextjs-web'
        })
      );
    });

    test('should pass all parameters through', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToFirewall } = await import('./web-app-firewall');

      const params = {
        referencedFrom: 'testResource',
        referencedFromType: 'user-auth-pool' as const,
        stpResourceReference: 'testFirewall',
        cdn: false
      };

      resolveReferenceToFirewall(params);

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: params.stpResourceReference,
        stpResourceType: 'web-app-firewall',
        referencedFrom: params.referencedFrom,
        referencedFromType: params.referencedFromType
      });
    });
  });
});
