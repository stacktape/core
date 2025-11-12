import { describe, expect, mock, test } from 'bun:test';

// Mock all dependencies
mock.module('@errors', () => ({
  stpErrors: {
    e82: mock(({ stpSqsQueueName }) => {
      const error = new Error(`Content-based deduplication requires FIFO to be enabled for SNS topic: ${stpSqsQueueName}`);
      (error as any).type = 'CONFIG_VALIDATION';
      return error;
    })
  }
}));

mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference, stpResourceType }) => ({
    name: stpResourceReference,
    type: stpResourceType,
    properties: {}
  }))
}));

describe('config-manager/utils/sns-topics', () => {
  describe('resolveReferenceToSnsTopic', () => {
    test('should resolve SNS topic reference', async () => {
      const { resolveReferenceToSnsTopic } = await import('./sns-topics');
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');

      const result = resolveReferenceToSnsTopic({
        stpResourceReference: 'myTopic',
        referencedFrom: 'myFunction',
        referencedFromType: 'function'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'myTopic',
        stpResourceType: 'sns-topic',
        referencedFrom: 'myFunction',
        referencedFromType: 'function'
      });
      expect(result.name).toBe('myTopic');
    });

    test('should resolve SNS topic reference from alarm', async () => {
      const { resolveReferenceToSnsTopic } = await import('./sns-topics');
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');

      const result = resolveReferenceToSnsTopic({
        stpResourceReference: 'alertTopic',
        referencedFrom: 'highCpuAlarm',
        referencedFromType: 'alarm'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalled();
      expect(result.name).toBe('alertTopic');
    });

    test('should handle undefined resource reference', async () => {
      const { resolveReferenceToSnsTopic } = await import('./sns-topics');
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');

      resolveReferenceToSnsTopic({
        stpResourceReference: undefined,
        referencedFrom: 'myFunction'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          stpResourceReference: undefined,
          stpResourceType: 'sns-topic'
        })
      );
    });

    test('should pass correct resource type to reference resolver', async () => {
      const { resolveReferenceToSnsTopic } = await import('./sns-topics');
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');

      resolveReferenceToSnsTopic({
        stpResourceReference: 'notificationTopic',
        referencedFrom: 'processor',
        referencedFromType: 'function'
      });

      const lastCall = getPropsOfResourceReferencedInConfig.mock.calls[
        getPropsOfResourceReferencedInConfig.mock.calls.length - 1
      ][0];
      expect(lastCall.stpResourceType).toBe('sns-topic');
    });
  });

  describe('validateSnsTopicConfig', () => {
    test('should validate SNS topic with FIFO enabled and content-based deduplication', async () => {
      const { validateSnsTopicConfig } = await import('./sns-topics');

      const resource: any = {
        name: 'myTopic',
        type: 'sns-topic',
        fifoEnabled: true,
        contentBasedDeduplication: true
      };

      expect(() => validateSnsTopicConfig({ resource })).not.toThrow();
    });

    test('should validate SNS topic without content-based deduplication', async () => {
      const { validateSnsTopicConfig } = await import('./sns-topics');

      const resource: any = {
        name: 'myTopic',
        type: 'sns-topic',
        fifoEnabled: false,
        contentBasedDeduplication: false
      };

      expect(() => validateSnsTopicConfig({ resource })).not.toThrow();
    });

    test('should validate SNS topic with FIFO but no content-based deduplication', async () => {
      const { validateSnsTopicConfig } = await import('./sns-topics');

      const resource: any = {
        name: 'myTopic',
        type: 'sns-topic',
        fifoEnabled: true,
        contentBasedDeduplication: false
      };

      expect(() => validateSnsTopicConfig({ resource })).not.toThrow();
    });

    test('should throw error when content-based deduplication enabled without FIFO', async () => {
      const { validateSnsTopicConfig } = await import('./sns-topics');

      const resource: any = {
        name: 'invalidTopic',
        type: 'sns-topic',
        fifoEnabled: false,
        contentBasedDeduplication: true
      };

      expect(() => validateSnsTopicConfig({ resource })).toThrow();
    });

    test('should include topic name in error message', async () => {
      const { validateSnsTopicConfig } = await import('./sns-topics');

      const resource: any = {
        name: 'testTopic',
        type: 'sns-topic',
        fifoEnabled: false,
        contentBasedDeduplication: true
      };

      try {
        validateSnsTopicConfig({ resource });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('testTopic');
      }
    });

    test('should validate standard SNS topic', async () => {
      const { validateSnsTopicConfig } = await import('./sns-topics');

      const resource: any = {
        name: 'standardTopic',
        type: 'sns-topic'
      };

      expect(() => validateSnsTopicConfig({ resource })).not.toThrow();
    });

    test('should validate SNS topic with other properties', async () => {
      const { validateSnsTopicConfig } = await import('./sns-topics');

      const resource: any = {
        name: 'fullTopic',
        type: 'sns-topic',
        fifoEnabled: true,
        contentBasedDeduplication: true,
        displayName: 'My Topic',
        subscriptions: []
      };

      expect(() => validateSnsTopicConfig({ resource })).not.toThrow();
    });
  });
});
