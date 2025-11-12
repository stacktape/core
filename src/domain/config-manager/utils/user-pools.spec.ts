import { describe, expect, mock, test } from 'bun:test';

// Mock resource references
mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference, stpResourceType, referencedFrom, referencedFromType }) => ({
    name: stpResourceReference || 'default-user-pool',
    type: stpResourceType,
    props: { /* user pool properties */ }
  }))
}));

describe('config-manager/utils/user-pools', () => {
  describe('resolveReferenceToUserPool', () => {
    test('should call getPropsOfResourceReferencedInConfig with correct resource type', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToUserPool } = await import('./user-pools');

      resolveReferenceToUserPool({
        referencedFrom: 'myOpenSearch',
        stpResourceReference: 'myUserPool'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'myUserPool',
        stpResourceType: 'user-auth-pool',
        referencedFrom: 'myOpenSearch',
        referencedFromType: undefined
      });
    });

    test('should pass referencedFromType to getPropsOfResourceReferencedInConfig', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToUserPool } = await import('./user-pools');

      resolveReferenceToUserPool({
        referencedFrom: 'myResource',
        referencedFromType: 'open-search-domain',
        stpResourceReference: 'userPool1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'userPool1',
        stpResourceType: 'user-auth-pool',
        referencedFrom: 'myResource',
        referencedFromType: 'open-search-domain'
      });
    });

    test('should handle undefined stpResourceReference', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToUserPool } = await import('./user-pools');

      resolveReferenceToUserPool({
        referencedFrom: 'myResource',
        stpResourceReference: undefined
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: undefined,
        stpResourceType: 'user-auth-pool',
        referencedFrom: 'myResource',
        referencedFromType: undefined
      });
    });

    test('should return result from getPropsOfResourceReferencedInConfig', async () => {
      const { resolveReferenceToUserPool } = await import('./user-pools');

      const result = resolveReferenceToUserPool({
        referencedFrom: 'myResource',
        stpResourceReference: 'myUserPool'
      });

      expect(result.name).toBe('myUserPool');
      expect(result.type).toBe('user-auth-pool');
    });

    test('should handle open-search-domain as referencedFromType', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToUserPool } = await import('./user-pools');

      resolveReferenceToUserPool({
        referencedFrom: 'myOpenSearch',
        referencedFromType: 'open-search-domain',
        stpResourceReference: 'pool1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'pool1',
        stpResourceType: 'user-auth-pool',
        referencedFrom: 'myOpenSearch',
        referencedFromType: 'open-search-domain'
      });
    });

    test('should pass all parameters through', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToUserPool } = await import('./user-pools');

      const params = {
        referencedFrom: 'testResource',
        referencedFromType: 'open-search-domain' as const,
        stpResourceReference: 'testUserPool'
      };

      resolveReferenceToUserPool(params);

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: params.stpResourceReference,
        stpResourceType: 'user-auth-pool',
        referencedFrom: params.referencedFrom,
        referencedFromType: params.referencedFromType
      });
    });

    test('should handle different user pool references', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToUserPool } = await import('./user-pools');

      resolveReferenceToUserPool({
        referencedFrom: 'resource1',
        stpResourceReference: 'auth-pool-1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          stpResourceReference: 'auth-pool-1'
        })
      );
    });
  });
});
