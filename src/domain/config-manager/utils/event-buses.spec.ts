import { describe, expect, mock, test } from 'bun:test';

// Mock resource references
mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference, stpResourceType, referencedFrom, referencedFromType }) => ({
    name: stpResourceReference || 'default-event-bus',
    type: stpResourceType,
    props: { /* event bus properties */ }
  }))
}));

describe('config-manager/utils/event-buses', () => {
  describe('resolveReferenceToEventBus', () => {
    test('should call getPropsOfResourceReferencedInConfig with correct resource type', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEventBus } = await import('./event-buses');

      resolveReferenceToEventBus({
        referencedFrom: 'myLambda',
        stpResourceReference: 'myEventBus'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'myEventBus',
        stpResourceType: 'event-bus',
        referencedFrom: 'myLambda',
        referencedFromType: undefined
      });
    });

    test('should pass referencedFromType to getPropsOfResourceReferencedInConfig', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEventBus } = await import('./event-buses');

      resolveReferenceToEventBus({
        referencedFrom: 'myResource',
        referencedFromType: 'lambda-function',
        stpResourceReference: 'eventBus1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'eventBus1',
        stpResourceType: 'event-bus',
        referencedFrom: 'myResource',
        referencedFromType: 'lambda-function'
      });
    });

    test('should handle undefined stpResourceReference', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEventBus } = await import('./event-buses');

      resolveReferenceToEventBus({
        referencedFrom: 'myResource',
        stpResourceReference: undefined
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: undefined,
        stpResourceType: 'event-bus',
        referencedFrom: 'myResource',
        referencedFromType: undefined
      });
    });

    test('should return result from getPropsOfResourceReferencedInConfig', async () => {
      const { resolveReferenceToEventBus } = await import('./event-buses');

      const result = resolveReferenceToEventBus({
        referencedFrom: 'myResource',
        stpResourceReference: 'myEventBus'
      });

      expect(result.name).toBe('myEventBus');
      expect(result.type).toBe('event-bus');
    });

    test('should handle alarm as referencedFromType', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEventBus } = await import('./event-buses');

      resolveReferenceToEventBus({
        referencedFrom: 'myAlarm',
        referencedFromType: 'alarm',
        stpResourceReference: 'bus1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'bus1',
        stpResourceType: 'event-bus',
        referencedFrom: 'myAlarm',
        referencedFromType: 'alarm'
      });
    });

    test('should handle workload types', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEventBus } = await import('./event-buses');

      resolveReferenceToEventBus({
        referencedFrom: 'resource1',
        referencedFromType: 'batch-job',
        stpResourceReference: 'eventBus1'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          referencedFromType: 'batch-job'
        })
      );
    });

    test('should pass all parameters through', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEventBus } = await import('./event-buses');

      const params = {
        referencedFrom: 'testResource',
        referencedFromType: 'worker' as StpWorkloadType,
        stpResourceReference: 'testEventBus'
      };

      resolveReferenceToEventBus(params);

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: params.stpResourceReference,
        stpResourceType: 'event-bus',
        referencedFrom: params.referencedFrom,
        referencedFromType: params.referencedFromType
      });
    });

    test('should handle different event bus references', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToEventBus } = await import('./event-buses');

      resolveReferenceToEventBus({
        referencedFrom: 'resource1',
        stpResourceReference: 'custom-event-bus'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          stpResourceReference: 'custom-event-bus'
        })
      );
    });
  });
});
