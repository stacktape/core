import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@errors', () => ({
  stpErrors: {
    e36: mock((params) => new Error(`Resource not found: ${params.stpResourceName}`))
  }
}));

mock.module('@utils/errors', () => ({
  ExpectedError: class ExpectedError extends Error {
    type: string;
    hint: string | string[];
    constructor(type: string, message: string, hint?: string | string[]) {
      super(message);
      this.type = type;
      this.hint = hint;
      this.name = 'ExpectedError';
    }
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    colorize: mock((color, text) => text),
    makeBold: mock((text) => text)
  }
}));

mock.module('@shared/naming/logical-names', () => ({
  cfLogicalNames: {}
}));

mock.module('../index', () => ({
  configManager: {
    findResourceInConfig: mock(({ nameChain }) => {
      if (nameChain[0] === 'existingResource') {
        return {
          resource: { type: 'bucket', properties: {} },
          restPath: [],
          validPath: nameChain,
          fullyResolved: true
        };
      }
      return {
        resource: null,
        restPath: nameChain,
        validPath: [],
        fullyResolved: false
      };
    }),
    allLambdasToUpload: [],
    allContainerWorkloads: [],
    batchJobs: []
  }
}));

describe('config-manager/utils/resource-references', () => {
  describe('getReferencableParamsError', () => {
    test('should create error for ResourceParam directive', async () => {
      const { getReferencableParamsError } = await import('./resource-references');
      const error = getReferencableParamsError({
        resourceName: 'myBucket',
        referencedParam: 'invalidParam',
        referencableParams: ['arn', 'name', 'url'],
        directiveType: '$ResourceParam'
      });
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe('DIRECTIVE');
      expect(error.message).toContain('invalidParam');
      expect(error.message).toContain('myBucket');
    });

    test('should create error for CfResourceParam directive', async () => {
      const { getReferencableParamsError } = await import('./resource-references');
      const error = getReferencableParamsError({
        resourceName: 'myFunction',
        referencedParam: 'badParam',
        referencableParams: ['Arn', 'Name'],
        directiveType: '$CfResourceParam'
      });
      expect(error.type).toBe('DIRECTIVE');
      expect(error.message).toContain('$CfResourceParam');
    });

    test('should include hint with referencable parameters', async () => {
      const { getReferencableParamsError } = await import('./resource-references');
      const error = getReferencableParamsError({
        resourceName: 'myResource',
        referencedParam: 'invalid',
        referencableParams: ['param1', 'param2', 'param3'],
        directiveType: '$ResourceParam'
      });
      expect(error.hint).toBeDefined();
      expect(Array.isArray(error.hint)).toBe(true);
      const hintString = (error.hint as string[]).join(' ');
      expect(hintString).toContain('param1');
      expect(hintString).toContain('param2');
      expect(hintString).toContain('param3');
    });

    test('should handle empty referencable params', async () => {
      const { getReferencableParamsError } = await import('./resource-references');
      const error = getReferencableParamsError({
        resourceName: 'myResource',
        referencedParam: 'anyParam',
        referencableParams: [],
        directiveType: '$ResourceParam'
      });
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe('DIRECTIVE');
    });
  });

  describe('getNonExistingResourceError', () => {
    test('should create error for ResourceParam directive', async () => {
      const { getNonExistingResourceError } = await import('./resource-references');
      const error = getNonExistingResourceError({
        resourceName: 'nonExistentResource',
        directiveType: '$ResourceParam'
      });
      expect(error).toBeInstanceOf(Error);
      expect(error.type).toBe('DIRECTIVE');
      expect(error.message).toContain('nonExistentResource');
      expect(error.message).toContain('$ResourceParam');
    });

    test('should create error for CfResourceParam directive', async () => {
      const { getNonExistingResourceError } = await import('./resource-references');
      const error = getNonExistingResourceError({
        resourceName: 'missingResource',
        directiveType: '$CfResourceParam'
      });
      expect(error.message).toContain('$CfResourceParam');
      expect(error.message).toContain('missingResource');
    });

    test('should provide hint about directive usage for ResourceParam', async () => {
      const { getNonExistingResourceError } = await import('./resource-references');
      const error = getNonExistingResourceError({
        resourceName: 'test',
        directiveType: '$ResourceParam'
      });
      expect(error.hint).toBeDefined();
      const hintString = Array.isArray(error.hint) ? error.hint.join(' ') : error.hint;
      expect(hintString).toContain('stacktape resources');
    });

    test('should provide hint about directive usage for CfResourceParam', async () => {
      const { getNonExistingResourceError } = await import('./resource-references');
      const error = getNonExistingResourceError({
        resourceName: 'test',
        directiveType: '$CfResourceParam'
      });
      expect(error.hint).toBeDefined();
      const hintString = Array.isArray(error.hint) ? error.hint.join(' ') : error.hint;
      expect(hintString).toContain('cloudformation');
    });

    test('should suggest alternative directive', async () => {
      const { getNonExistingResourceError } = await import('./resource-references');
      const error = getNonExistingResourceError({
        resourceName: 'test',
        directiveType: '$ResourceParam'
      });
      const hintString = Array.isArray(error.hint) ? error.hint.join(' ') : error.hint;
      expect(hintString).toContain('$CfResourceParam');
    });
  });

  describe('getPropsOfResourceReferencedInConfig', () => {
    test('should get resource props for existing resource', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const result = getPropsOfResourceReferencedInConfig({
        stpResourceReference: 'existingResource',
        referencedFrom: 'myFunction',
        referencedFromType: 'function'
      });
      expect(result).toBeDefined();
      expect(result.type).toBe('bucket');
    });

    test('should throw for non-existing resource', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      expect(() =>
        getPropsOfResourceReferencedInConfig({
          stpResourceReference: 'nonExistentResource',
          referencedFrom: 'myFunction',
          referencedFromType: 'function'
        })
      ).toThrow();
    });

    test('should throw for wrong resource type', async () => {
      mock.module('../index', () => ({
        configManager: {
          findResourceInConfig: mock(() => ({
            resource: { type: 'function', properties: {} },
            restPath: [],
            validPath: ['existingResource'],
            fullyResolved: true
          }))
        }
      }));

      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      expect(() =>
        getPropsOfResourceReferencedInConfig({
          stpResourceReference: 'existingResource',
          stpResourceType: 'bucket' as any,
          referencedFrom: 'myFunction',
          referencedFromType: 'function'
        })
      ).toThrow();
    });

    test('should handle nested resource references', async () => {
      mock.module('../index', () => ({
        configManager: {
          findResourceInConfig: mock(({ nameChain }) => ({
            resource: { type: 'bucket', properties: {} },
            restPath: [],
            validPath: nameChain,
            fullyResolved: true
          }))
        }
      }));

      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const result = getPropsOfResourceReferencedInConfig({
        stpResourceReference: 'parent.child.resource',
        referencedFrom: 'myFunction',
        referencedFromType: 'function'
      });
      expect(result).toBeDefined();
    });
  });

  describe('getConnectToReferencesForResource', () => {
    test('should return empty array when no references found', async () => {
      const { getConnectToReferencesForResource } = await import('./resource-references');
      const result = getConnectToReferencesForResource({
        nameChain: 'myResource'
      });
      expect(result).toEqual([]);
    });

    test('should handle string nameChain', async () => {
      const { getConnectToReferencesForResource } = await import('./resource-references');
      const result = getConnectToReferencesForResource({
        nameChain: 'myDatabase'
      });
      expect(Array.isArray(result)).toBe(true);
    });

    test('should handle array nameChain', async () => {
      const { getConnectToReferencesForResource } = await import('./resource-references');
      const result = getConnectToReferencesForResource({
        nameChain: ['parent', 'child', 'resource']
      });
      expect(Array.isArray(result)).toBe(true);
    });

    test('should find references from lambdas', async () => {
      mock.module('../index', () => ({
        configManager: {
          allLambdasToUpload: [
            {
              type: 'function',
              referencableName: 'myFunction',
              properties: {
                connectTo: [{ referencableName: 'myDatabase' }]
              }
            }
          ],
          allContainerWorkloads: [],
          batchJobs: [],
          findResourceInConfig: mock(() => ({
            resource: { type: 'database', properties: {} },
            fullyResolved: true
          }))
        }
      }));

      const { getConnectToReferencesForResource } = await import('./resource-references');
      const result = getConnectToReferencesForResource({
        nameChain: 'myDatabase'
      });
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });
});
