import { describe, expect, mock, test } from 'bun:test';

// Mock all dependencies
mock.module('@cloudform/functions', () => ({
  GetAtt: mock((logicalName, attribute) => ({ 'Fn::GetAtt': [logicalName, attribute] }))
}));

mock.module('@errors', () => ({
  stpErrors: {
    e81: mock(({ stpSqsQueueName }) => {
      const error = new Error(`FIFO features require FIFO to be enabled for SQS queue: ${stpSqsQueueName}`);
      (error as any).type = 'CONFIG_VALIDATION';
      return error;
    }),
    e112: mock(({ sqsQueueReferencerStpName }) => {
      const error = new Error(
        `SQS queue ${sqsQueueReferencerStpName} redrive policy must specify exactly one of targetSqsQueueArn or targetSqsQueueName`
      );
      (error as any).type = 'CONFIG_VALIDATION';
      return error;
    })
  }
}));

mock.module('@shared/naming/logical-names', () => ({
  cfLogicalNames: {
    sqsQueue: mock((name) => `SqsQueue${name}`),
    eventBusRule: mock((name, index) => `EventBusRule${name}${index}`),
    snsTopic: mock((name) => `SnsTopic${name}`)
  }
}));

mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference, stpResourceType }) => ({
    name: stpResourceReference,
    type: stpResourceType,
    properties: {}
  }))
}));

mock.module('../index', () => ({
  configManager: {
    allLambdasTriggerableUsingEvents: []
  }
}));

describe('config-manager/utils/sqs-queues', () => {
  describe('resolveReferenceToSqsQueue', () => {
    test('should resolve SQS queue reference', async () => {
      const { resolveReferenceToSqsQueue } = await import('./sqs-queues');
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');

      const result = resolveReferenceToSqsQueue({
        stpResourceReference: 'myQueue',
        referencedFrom: 'myFunction',
        referencedFromType: 'function'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'myQueue',
        stpResourceType: 'sqs-queue',
        referencedFrom: 'myFunction',
        referencedFromType: 'function'
      });
      expect(result.name).toBe('myQueue');
    });

    test('should resolve SQS queue reference from alarm', async () => {
      const { resolveReferenceToSqsQueue } = await import('./sqs-queues');

      const result = resolveReferenceToSqsQueue({
        stpResourceReference: 'processingQueue',
        referencedFrom: 'queueDepthAlarm',
        referencedFromType: 'alarm'
      });

      expect(result.name).toBe('processingQueue');
    });

    test('should handle undefined resource reference', async () => {
      const { resolveReferenceToSqsQueue } = await import('./sqs-queues');
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');

      resolveReferenceToSqsQueue({
        stpResourceReference: undefined,
        referencedFrom: 'myLambda'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          stpResourceReference: undefined,
          stpResourceType: 'sqs-queue'
        })
      );
    });
  });

  describe('validateSqsQueueConfig', () => {
    test('should validate SQS queue with FIFO and content-based deduplication', async () => {
      const { validateSqsQueueConfig } = await import('./sqs-queues');

      const resource: any = {
        name: 'myQueue',
        type: 'sqs-queue',
        fifoEnabled: true,
        contentBasedDeduplication: true
      };

      expect(() => validateSqsQueueConfig({ resource })).not.toThrow();
    });

    test('should validate SQS queue with FIFO and high throughput', async () => {
      const { validateSqsQueueConfig } = await import('./sqs-queues');

      const resource: any = {
        name: 'myQueue',
        type: 'sqs-queue',
        fifoEnabled: true,
        fifoHighThroughput: true
      };

      expect(() => validateSqsQueueConfig({ resource })).not.toThrow();
    });

    test('should throw error when content-based deduplication enabled without FIFO', async () => {
      const { validateSqsQueueConfig } = await import('./sqs-queues');

      const resource: any = {
        name: 'invalidQueue',
        type: 'sqs-queue',
        fifoEnabled: false,
        contentBasedDeduplication: true
      };

      expect(() => validateSqsQueueConfig({ resource })).toThrow();
    });

    test('should throw error when FIFO high throughput enabled without FIFO', async () => {
      const { validateSqsQueueConfig } = await import('./sqs-queues');

      const resource: any = {
        name: 'invalidQueue',
        type: 'sqs-queue',
        fifoEnabled: false,
        fifoHighThroughput: true
      };

      expect(() => validateSqsQueueConfig({ resource })).toThrow();
    });

    test('should validate queue with valid redrive policy using targetSqsQueueArn', async () => {
      const { validateSqsQueueConfig } = await import('./sqs-queues');

      const resource: any = {
        name: 'myQueue',
        type: 'sqs-queue',
        redrivePolicy: {
          targetSqsQueueArn: 'arn:aws:sqs:us-east-1:123456789012:dlq',
          maxReceiveCount: 3
        }
      };

      expect(() => validateSqsQueueConfig({ resource })).not.toThrow();
    });

    test('should validate queue with valid redrive policy using targetSqsQueueName', async () => {
      const { validateSqsQueueConfig } = await import('./sqs-queues');

      const resource: any = {
        name: 'myQueue',
        type: 'sqs-queue',
        redrivePolicy: {
          targetSqsQueueName: 'deadLetterQueue',
          maxReceiveCount: 5
        }
      };

      expect(() => validateSqsQueueConfig({ resource })).not.toThrow();
    });

    test('should throw error when both targetSqsQueueArn and targetSqsQueueName are specified', async () => {
      const { validateSqsQueueConfig } = await import('./sqs-queues');

      const resource: any = {
        name: 'invalidQueue',
        type: 'sqs-queue',
        redrivePolicy: {
          targetSqsQueueArn: 'arn:aws:sqs:us-east-1:123456789012:dlq',
          targetSqsQueueName: 'deadLetterQueue',
          maxReceiveCount: 3
        }
      };

      expect(() => validateSqsQueueConfig({ resource })).toThrow();
    });

    test('should throw error when neither targetSqsQueueArn nor targetSqsQueueName are specified', async () => {
      const { validateSqsQueueConfig } = await import('./sqs-queues');

      const resource: any = {
        name: 'invalidQueue',
        type: 'sqs-queue',
        redrivePolicy: {
          maxReceiveCount: 3
        }
      };

      expect(() => validateSqsQueueConfig({ resource })).toThrow();
    });

    test('should validate standard queue without special features', async () => {
      const { validateSqsQueueConfig } = await import('./sqs-queues');

      const resource: any = {
        name: 'standardQueue',
        type: 'sqs-queue'
      };

      expect(() => validateSqsQueueConfig({ resource })).not.toThrow();
    });
  });

  describe('getAllQueuePolicyStatements', () => {
    test('should return empty policy statements for basic queue', async () => {
      mock.module('../index', () => ({
        configManager: {
          allLambdasTriggerableUsingEvents: []
        }
      }));

      const { getAllQueuePolicyStatements } = await import('./sqs-queues');

      const resource: any = {
        name: 'myQueue',
        type: 'sqs-queue',
        nameChain: ['myQueue']
      };

      const result = getAllQueuePolicyStatements({ resource });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test('should include custom policy statements', async () => {
      const { getAllQueuePolicyStatements } = await import('./sqs-queues');

      const resource: any = {
        name: 'myQueue',
        type: 'sqs-queue',
        nameChain: ['myQueue'],
        policyStatements: [
          {
            Effect: 'Allow',
            Principal: { Service: 's3.amazonaws.com' },
            Action: ['sqs:SendMessage']
          }
        ]
      };

      const result = getAllQueuePolicyStatements({ resource });

      expect(result.length).toBe(1);
      expect(result[0].Effect).toBe('Allow');
      expect(result[0].Principal.Service).toBe('s3.amazonaws.com');
      expect(result[0].Resource).toBeDefined();
    });

    test('should add EventBridge permissions for lambda event-bus events with failure queue', async () => {
      mock.module('../index', () => ({
        configManager: {
          allLambdasTriggerableUsingEvents: [
            {
              name: 'myLambda',
              events: [
                {
                  type: 'event-bus',
                  properties: {
                    onDeliveryFailure: {
                      sqsQueueName: 'myQueue'
                    }
                  }
                }
              ]
            }
          ]
        }
      }));

      const { getAllQueuePolicyStatements } = await import('./sqs-queues');

      const resource: any = {
        name: 'myQueue',
        type: 'sqs-queue',
        nameChain: ['myQueue']
      };

      const result = getAllQueuePolicyStatements({ resource });

      expect(result.length).toBeGreaterThan(0);
      const eventBridgeStatement = result.find((s) => s.Principal?.Service === 'events.amazonaws.com');
      expect(eventBridgeStatement).toBeDefined();
      expect(eventBridgeStatement.Action).toContain('sqs:SendMessage');
    });

    test('should add SNS permissions for lambda SNS events with failure queue', async () => {
      mock.module('../index', () => ({
        configManager: {
          allLambdasTriggerableUsingEvents: [
            {
              name: 'myLambda',
              events: [
                {
                  type: 'sns',
                  properties: {
                    snsTopicName: 'myTopic',
                    onDeliveryFailure: {
                      sqsQueueName: 'myQueue'
                    }
                  }
                }
              ]
            }
          ]
        }
      }));

      const { getAllQueuePolicyStatements } = await import('./sqs-queues');

      const resource: any = {
        name: 'myQueue',
        type: 'sqs-queue',
        nameChain: ['myQueue']
      };

      const result = getAllQueuePolicyStatements({ resource });

      const snsStatement = result.find((s) => s.Principal?.Service === 'sns.amazonaws.com');
      expect(snsStatement).toBeDefined();
      expect(snsStatement.Action).toContain('sqs:SendMessage');
    });

    test('should add permissions for queue event-bus events', async () => {
      const { getAllQueuePolicyStatements } = await import('./sqs-queues');

      const resource: any = {
        name: 'myQueue',
        type: 'sqs-queue',
        nameChain: ['myQueue'],
        events: [
          {
            type: 'event-bus',
            properties: {
              eventBusName: 'default'
            }
          }
        ]
      };

      const result = getAllQueuePolicyStatements({ resource });

      const eventBridgeStatement = result.find((s) => s.Principal?.Service === 'events.amazonaws.com');
      expect(eventBridgeStatement).toBeDefined();
    });

    test('should handle nested queue name chains', async () => {
      const { getAllQueuePolicyStatements } = await import('./sqs-queues');

      const resource: any = {
        name: 'parent.child.queue',
        type: 'sqs-queue',
        nameChain: ['parent', 'child', 'queue'],
        policyStatements: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['sqs:*']
          }
        ]
      };

      const result = getAllQueuePolicyStatements({ resource });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].Resource).toBeDefined();
    });

    test('should combine policy statements from multiple sources', async () => {
      mock.module('../index', () => ({
        configManager: {
          allLambdasTriggerableUsingEvents: [
            {
              name: 'lambda1',
              events: [
                {
                  type: 'event-bus',
                  properties: {
                    onDeliveryFailure: { sqsQueueName: 'myQueue' }
                  }
                }
              ]
            }
          ]
        }
      }));

      const { getAllQueuePolicyStatements } = await import('./sqs-queues');

      const resource: any = {
        name: 'myQueue',
        type: 'sqs-queue',
        nameChain: ['myQueue'],
        policyStatements: [
          {
            Effect: 'Allow',
            Principal: { Service: 's3.amazonaws.com' },
            Action: ['sqs:SendMessage']
          }
        ],
        events: [
          {
            type: 'event-bus',
            properties: {}
          }
        ]
      };

      const result = getAllQueuePolicyStatements({ resource });

      expect(result.length).toBeGreaterThan(1);
    });
  });
});
