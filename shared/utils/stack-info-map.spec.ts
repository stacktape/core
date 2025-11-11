import { describe, expect, test } from 'bun:test';

// Mock naming utils
import('./stack-info-map').then((module) => module);

mock.module('@shared/naming/utils', () => ({
  getStpNameForResource: mock(({ nameChain }) => nameChain.join('-'))
}));

describe('stack-info-map', () => {
  describe('getCloudformationChildResources', () => {
    test('should return cloudformation child resources', async () => {
      const { getCloudformationChildResources } = await import('./stack-info-map');

      const resource: any = {
        cloudformationChildResources: { cfr1: {}, cfr2: {} }
      };

      const result = getCloudformationChildResources({ resource });

      expect(result).toEqual({ cfr1: {}, cfr2: {} });
    });

    test('should traverse nested resources', async () => {
      const { getCloudformationChildResources } = await import('./stack-info-map');

      const resource: any = {
        cloudformationChildResources: { cfr1: {} },
        _nestedResources: {
          nested1: {
            cloudformationChildResources: { cfr2: {} }
          }
        }
      };

      const result = getCloudformationChildResources({ resource });

      expect(result).toEqual({ cfr1: {}, cfr2: {} });
    });

    test('should handle empty cloudformation resources', async () => {
      const { getCloudformationChildResources } = await import('./stack-info-map');

      const resource: any = {};

      const result = getCloudformationChildResources({ resource });

      expect(result).toEqual({});
    });
  });

  describe('traverseResourcesInMap', () => {
    test('should traverse all resources', async () => {
      const { traverseResourcesInMap } = await import('./stack-info-map');

      const resources: any = {
        resource1: { type: 'function' },
        resource2: { type: 'bucket' }
      };

      const calls: any[] = [];
      traverseResourcesInMap({
        stackInfoMapResources: resources,
        applyFn: (info) => calls.push(info)
      });

      expect(calls).toHaveLength(2);
      expect(calls[0].resource).toBe(resources.resource1);
      expect(calls[1].resource).toBe(resources.resource2);
    });

    test('should handle nested resources', async () => {
      const { traverseResourcesInMap } = await import('./stack-info-map');

      const resources: any = {
        parent: {
          type: 'web-service',
          _nestedResources: {
            child: { type: 'function' }
          }
        }
      };

      const calls: any[] = [];
      traverseResourcesInMap({
        stackInfoMapResources: resources,
        applyFn: (info) => calls.push(info)
      });

      expect(calls).toHaveLength(2);
      expect(calls[0].nameChain).toEqual(['parent', 'child']);
      expect(calls[1].nameChain).toEqual(['parent']);
    });

    test('should build correct name chains', async () => {
      const { traverseResourcesInMap } = await import('./stack-info-map');

      const resources: any = {
        level1: {
          _nestedResources: {
            level2: { type: 'function' }
          }
        }
      };

      const calls: any[] = [];
      traverseResourcesInMap({
        stackInfoMapResources: resources,
        nameChain: ['root'],
        applyFn: (info) => calls.push(info)
      });

      expect(calls[0].nameChain).toEqual(['root', 'level1', 'level2']);
      expect(calls[1].nameChain).toEqual(['root', 'level1']);
    });
  });
});
