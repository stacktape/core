import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock AWS SDK
const mockSend = mock(async () => ({
  executionArn: 'arn:aws:states:us-east-1:123456789012:execution:my-state-machine:exec-123'
}));

const mockSFNClient = {
  send: mockSend
};

mock.module('@aws-sdk/client-sfn', () => ({
  SFNClient: class {
    constructor() {
      return mockSFNClient;
    }
  },
  StartExecutionCommand: class {
    constructor(public input: any) {}
  }
}));

describe('batchJobTriggerLambda', () => {
  let handler: any;
  const originalEnv = process.env;

  beforeEach(async () => {
    mock.restore();

    // Clear mocks
    mockSend.mockClear();

    // Set up environment variables
    process.env = {
      ...originalEnv,
      STATE_MACHINE_ARN: 'arn:aws:states:us-east-1:123456789012:stateMachine:my-state-machine',
      STATE_MACHINE_NAME: 'my-state-machine',
      BATCH_JOB_NAME_BASE: 'my-batch-job'
    };

    // Set up default mock implementation
    mockSend.mockResolvedValue({
      executionArn: 'arn:aws:states:us-east-1:123456789012:execution:my-state-machine:exec-123'
    });

    const module = await import('./index');
    handler = module.default;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('handler execution', () => {
    test('should start Step Functions state machine', async () => {
      const event = { key: 'value', data: 'test' };
      const context = { awsRequestId: 'request-123' };

      const result = await handler(event, context);

      expect(mockSend).toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
    });

    test('should use correct batch job name', async () => {
      const event = { key: 'value' };
      const context = { awsRequestId: 'request-456' };

      await handler(event, context);

      const sendCall = mockSend.mock.calls[0][0];
      const input = JSON.parse(sendCall.input.input);
      expect(input.jobName).toBe('my-batch-job-request-456');
    });

    test('should use correct state machine execution name', async () => {
      const event = { key: 'value' };
      const context = { awsRequestId: 'request-789' };

      await handler(event, context);

      const sendCall = mockSend.mock.calls[0][0];
      expect(sendCall.input.name).toBe('my-batch-job-request-789');
    });

    test('should truncate long batch job names for state machine name', async () => {
      process.env.BATCH_JOB_NAME_BASE = 'a'.repeat(60);
      const event = { key: 'value' };
      const context = { awsRequestId: 'request-abc' };

      const module = await import('./index');
      const newHandler = module.default;
      await newHandler(event, context);

      const sendCall = mockSend.mock.calls[0][0];
      const stateMachineName = sendCall.input.name;
      expect(stateMachineName).toContain('request-abc');
      expect(stateMachineName.length).toBeLessThanOrEqual(80);
    });

    test('should pass correct state machine ARN', async () => {
      const event = { key: 'value' };
      const context = { awsRequestId: 'request-123' };

      await handler(event, context);

      const sendCall = mockSend.mock.calls[0][0];
      expect(sendCall.input.stateMachineArn).toBe(
        'arn:aws:states:us-east-1:123456789012:stateMachine:my-state-machine'
      );
    });

    test('should pass trigger event as stringified JSON', async () => {
      const event = { key: 'value', nested: { data: 'test' } };
      const context = { awsRequestId: 'request-123' };

      await handler(event, context);

      const sendCall = mockSend.mock.calls[0][0];
      const input = JSON.parse(sendCall.input.input);
      expect(input.triggerEvent).toBe(JSON.stringify(event));
    });

    test('should return success response with execution details', async () => {
      const event = { key: 'value' };
      const context = { awsRequestId: 'request-123' };

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.isBase64Encoded).toBe(false);
      expect(result.headers).toEqual({});

      const body = JSON.parse(result.body);
      expect(body.message).toContain('Successfully started batch job state machine');
      expect(body.stateMachineName).toBe('my-batch-job-request-123');
      expect(body.stateMachineExecutionArn).toBe(
        'arn:aws:states:us-east-1:123456789012:execution:my-state-machine:exec-123'
      );
    });

    test('should handle complex event objects', async () => {
      const event = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            s3: {
              bucket: { name: 'my-bucket' },
              object: { key: 'file.txt' }
            }
          }
        ]
      };
      const context = { awsRequestId: 'request-s3' };

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const sendCall = mockSend.mock.calls[0][0];
      const input = JSON.parse(sendCall.input.input);
      expect(input.triggerEvent).toBe(JSON.stringify(event));
    });

    test('should handle empty event object', async () => {
      const event = {};
      const context = { awsRequestId: 'request-empty' };

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const sendCall = mockSend.mock.calls[0][0];
      const input = JSON.parse(sendCall.input.input);
      expect(input.triggerEvent).toBe('{}');
    });

    test('should handle null event', async () => {
      const event = null;
      const context = { awsRequestId: 'request-null' };

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const sendCall = mockSend.mock.calls[0][0];
      const input = JSON.parse(sendCall.input.input);
      expect(input.triggerEvent).toBe('null');
    });
  });

  describe('error handling', () => {
    test('should propagate Step Functions errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('State machine not found'));

      const event = { key: 'value' };
      const context = { awsRequestId: 'request-error' };

      await expect(handler(event, context)).rejects.toThrow('State machine not found');
    });

    test('should propagate execution limit errors', async () => {
      mockSend.mockRejectedValueOnce(
        new Error('ExecutionLimitExceeded: Maximum number of running executions reached')
      );

      const event = { key: 'value' };
      const context = { awsRequestId: 'request-limit' };

      await expect(handler(event, context)).rejects.toThrow('ExecutionLimitExceeded');
    });

    test('should handle missing environment variables gracefully', async () => {
      delete process.env.STATE_MACHINE_ARN;
      delete process.env.BATCH_JOB_NAME_BASE;

      const module = await import('./index');
      const newHandler = module.default;

      const event = { key: 'value' };
      const context = { awsRequestId: 'request-missing-env' };

      // Should still attempt to execute, even though it will likely fail
      await expect(newHandler(event, context)).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    test('should handle very long awsRequestId', async () => {
      const event = { key: 'value' };
      const context = { awsRequestId: 'x'.repeat(100) };

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const sendCall = mockSend.mock.calls[0][0];
      expect(sendCall.input.name).toBeDefined();
    });

    test('should handle special characters in event', async () => {
      const event = {
        message: 'Test with "quotes" and \'apostrophes\'',
        data: { special: '<>&' }
      };
      const context = { awsRequestId: 'request-special' };

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const sendCall = mockSend.mock.calls[0][0];
      const input = JSON.parse(sendCall.input.input);
      const parsedEvent = JSON.parse(input.triggerEvent);
      expect(parsedEvent.message).toBe('Test with "quotes" and \'apostrophes\'');
    });

    test('should handle different context properties', async () => {
      const event = { key: 'value' };
      const context = {
        awsRequestId: 'request-context',
        functionName: 'my-function',
        functionVersion: '1',
        invokedFunctionArn: 'arn:aws:lambda:us-east-1:123:function:my-function',
        memoryLimitInMB: '128',
        logGroupName: '/aws/lambda/my-function',
        logStreamName: '2024/01/01/[$LATEST]abc123'
      };

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      // Only awsRequestId should be used
      const sendCall = mockSend.mock.calls[0][0];
      expect(sendCall.input.name).toContain('request-context');
    });

    test('should handle event with circular references gracefully', async () => {
      const event: any = { key: 'value' };
      event.self = event;
      const context = { awsRequestId: 'request-circular' };

      // JSON.stringify will throw on circular references
      await expect(handler(event, context)).rejects.toThrow();
    });
  });

  describe('integration scenarios', () => {
    test('should work with scheduled event trigger', async () => {
      const event = {
        version: '0',
        id: 'event-id',
        'detail-type': 'Scheduled Event',
        source: 'aws.events',
        account: '123456789012',
        time: '2024-01-01T00:00:00Z',
        region: 'us-east-1',
        resources: ['arn:aws:events:us-east-1:123:rule/my-rule'],
        detail: {}
      };
      const context = { awsRequestId: 'request-scheduled' };

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.stateMachineName).toBe('my-batch-job-request-scheduled');
    });

    test('should work with S3 event trigger', async () => {
      const event = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'us-east-1',
            eventTime: '2024-01-01T00:00:00.000Z',
            eventName: 'ObjectCreated:Put',
            s3: {
              bucket: { name: 'my-bucket' },
              object: { key: 'uploads/file.txt', size: 1024 }
            }
          }
        ]
      };
      const context = { awsRequestId: 'request-s3-trigger' };

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const sendCall = mockSend.mock.calls[0][0];
      const input = JSON.parse(sendCall.input.input);
      expect(JSON.parse(input.triggerEvent).Records).toHaveLength(1);
    });

    test('should work with API Gateway event trigger', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/batch-jobs',
        headers: { 'Content-Type': 'application/json' },
        body: '{"param": "value"}',
        isBase64Encoded: false
      };
      const context = { awsRequestId: 'request-apigw' };

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(result.body).toBeDefined();
      const body = JSON.parse(result.body);
      expect(body.message).toContain('Successfully started');
    });
  });
});
