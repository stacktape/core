import { describe, expect, mock, test } from 'bun:test';

// Mock resource references
mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference, stpResourceType, referencedFrom, referencedFromType }) => ({
    name: stpResourceReference || 'default-bastion',
    type: stpResourceType,
    props: { /* bastion properties */ }
  }))
}));

describe('config-manager/utils/bastion', () => {
  describe('resolveReferenceToBastion', () => {
    test('should call getPropsOfResourceReferencedInConfig with correct resource type', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToBastion } = await import('./bastion');

      resolveReferenceToBastion({
        referencedFrom: 'myDatabase',
        stpResourceReference: 'myBastion'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'myBastion',
        stpResourceType: 'bastion',
        referencedFrom: 'myDatabase',
        referencedFromType: undefined
      });
    });

    test('should pass referencedFromType to getPropsOfResourceReferencedInConfig', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToBastion } = await import('./bastion');

      resolveReferenceToBastion({
        referencedFrom: 'myResource',
        referencedFromType: 'relational-database',
        stpResourceReference: 'bastion1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'bastion1',
        stpResourceType: 'bastion',
        referencedFrom: 'myResource',
        referencedFromType: 'relational-database'
      });
    });

    test('should handle undefined stpResourceReference', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToBastion } = await import('./bastion');

      resolveReferenceToBastion({
        referencedFrom: 'myResource',
        stpResourceReference: undefined
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: undefined,
        stpResourceType: 'bastion',
        referencedFrom: 'myResource',
        referencedFromType: undefined
      });
    });

    test('should return result from getPropsOfResourceReferencedInConfig', async () => {
      const { resolveReferenceToBastion } = await import('./bastion');

      const result = resolveReferenceToBastion({
        referencedFrom: 'myResource',
        stpResourceReference: 'myBastion'
      });

      expect(result.name).toBe('myBastion');
      expect(result.type).toBe('bastion');
    });

    test('should handle alarm as referencedFromType', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToBastion } = await import('./bastion');

      resolveReferenceToBastion({
        referencedFrom: 'myAlarm',
        referencedFromType: 'alarm',
        stpResourceReference: 'bastion1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'bastion1',
        stpResourceType: 'bastion',
        referencedFrom: 'myAlarm',
        referencedFromType: 'alarm'
      });
    });

    test('should handle different resource types', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToBastion } = await import('./bastion');

      resolveReferenceToBastion({
        referencedFrom: 'resource1',
        referencedFromType: 'redis-cluster',
        stpResourceReference: 'bastion1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          referencedFromType: 'redis-cluster'
        })
      );
    });

    test('should pass all parameters through', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToBastion } = await import('./bastion');

      const params = {
        referencedFrom: 'testResource',
        referencedFromType: 'mongo-db-cluster' as StpResourceType,
        stpResourceReference: 'testBastion'
      };

      resolveReferenceToBastion(params);

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: params.stpResourceReference,
        stpResourceType: 'bastion',
        referencedFrom: params.referencedFrom,
        referencedFromType: params.referencedFromType
      });
    });
  });
});
