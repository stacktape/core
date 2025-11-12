import { describe, expect, mock, test } from 'bun:test';

// Mock resource references
mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference, stpResourceType, referencedFrom, referencedFromType }) => ({
    name: stpResourceReference || 'default-custom-resource',
    type: stpResourceType,
    props: { /* custom resource properties */ }
  }))
}));

describe('config-manager/utils/custom-resource-definitions', () => {
  describe('resolveReferenceToCustomResourceDefinition', () => {
    test('should call getPropsOfResourceReferencedInConfig with correct resource type', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToCustomResourceDefinition } = await import('./custom-resource-definitions');

      resolveReferenceToCustomResourceDefinition({
        stpResourceReference: 'myCustomResource',
        referencedFrom: 'myStack'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'myCustomResource',
        stpResourceType: 'custom-resource-definition',
        referencedFrom: 'myStack',
        referencedFromType: undefined
      });
    });

    test('should pass referencedFromType to getPropsOfResourceReferencedInConfig', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToCustomResourceDefinition } = await import('./custom-resource-definitions');

      resolveReferenceToCustomResourceDefinition({
        stpResourceReference: 'customRes1',
        referencedFrom: 'myResource',
        referencedFromType: 'lambda-function'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'customRes1',
        stpResourceType: 'custom-resource-definition',
        referencedFrom: 'myResource',
        referencedFromType: 'lambda-function'
      });
    });

    test('should return result from getPropsOfResourceReferencedInConfig', async () => {
      const { resolveReferenceToCustomResourceDefinition } = await import('./custom-resource-definitions');

      const result = resolveReferenceToCustomResourceDefinition({
        stpResourceReference: 'myCustomResource',
        referencedFrom: 'myResource'
      });

      expect(result.name).toBe('myCustomResource');
      expect(result.type).toBe('custom-resource-definition');
    });

    test('should handle different resource types', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToCustomResourceDefinition } = await import('./custom-resource-definitions');

      resolveReferenceToCustomResourceDefinition({
        stpResourceReference: 'custom1',
        referencedFrom: 'resource1',
        referencedFromType: 'batch-job'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          referencedFromType: 'batch-job'
        })
      );
    });

    test('should pass all parameters through', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToCustomResourceDefinition } = await import('./custom-resource-definitions');

      const params = {
        stpResourceReference: 'testCustomResource',
        referencedFrom: 'testResource',
        referencedFromType: 'worker' as StpResourceType
      };

      resolveReferenceToCustomResourceDefinition(params);

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: params.stpResourceReference,
        stpResourceType: 'custom-resource-definition',
        referencedFrom: params.referencedFrom,
        referencedFromType: params.referencedFromType
      });
    });

    test('should handle different custom resource names', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToCustomResourceDefinition } = await import('./custom-resource-definitions');

      resolveReferenceToCustomResourceDefinition({
        stpResourceReference: 'domain-validator',
        referencedFrom: 'myApp'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          stpResourceReference: 'domain-validator'
        })
      );
    });

    test('should handle container workload types', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToCustomResourceDefinition } = await import('./custom-resource-definitions');

      resolveReferenceToCustomResourceDefinition({
        stpResourceReference: 'custom-def',
        referencedFrom: 'container',
        referencedFromType: 'multi-container-workload'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          referencedFromType: 'multi-container-workload'
        })
      );
    });
  });
});
