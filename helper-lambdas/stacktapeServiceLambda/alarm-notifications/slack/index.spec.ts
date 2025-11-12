import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock dependencies
const mockPostMessage = mock(async () => ({ ok: true }));

const mockWebClient = {
  chat: {
    postMessage: mockPostMessage
  }
};

mock.module('@slack/web-api', () => ({
  WebClient: class {
    chat = mockWebClient.chat;
    constructor(public token: string) {}
  }
}));

const mockGetCauseString = mock(() => 'Average Lambda error rate > 5%');

mock.module('../utils', () => ({
  getCauseString: mockGetCauseString
}));

describe('alarm-notifications/slack', () => {
  let sendAlarmSlackMessage: any;

  beforeEach(async () => {
    mock.restore();

    mockPostMessage.mockClear();
    mockGetCauseString.mockClear();

    mockPostMessage.mockResolvedValue({ ok: true });
    mockGetCauseString.mockReturnValue('Average Lambda error rate > 5%');

    const module = await import('./index');
    sendAlarmSlackMessage = module.sendAlarmSlackMessage;
  });

  const createNotificationDetail = (overrides: any = {}): any => ({
    type: 'slack',
    properties: {
      accessToken: 'xoxb-test-token',
      conversationId: 'C123456',
      ...overrides.properties
    },
    ...overrides
  });

  const createAlarmDetail = (overrides: any = {}): any => ({
    alarmConfig: {
      name: 'HighErrorRate',
      description: 'Error rate is too high',
      trigger: {
        type: 'lambda-error-rate',
        properties: { thresholdPercent: 5 }
      }
    },
    stackName: 'my-stack-dev',
    alarmLink: 'https://console.aws.amazon.com/cloudwatch/alarm',
    affectedResource: {
      displayName: 'MyFunction',
      link: 'https://console.aws.amazon.com/lambda/function'
    },
    comparisonOperator: 'GreaterThanThreshold',
    statFunction: 'Average',
    measuringUnit: '%',
    description: 'Error rate is too high',
    time: '2024-01-01T00:00:00Z',
    ...overrides
  });

  describe('Slack message sending', () => {
    test('should send message to correct channel', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: 'C123456',
        text: expect.any(String)
      });
    });

    test('should use access token from notification detail', async () => {
      const notificationDetail = createNotificationDetail({
        properties: {
          accessToken: 'xoxb-custom-token',
          conversationId: 'C123'
        }
      });
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      expect(mockPostMessage).toHaveBeenCalled();
    });

    test('should handle different channel IDs', async () => {
      const notificationDetail = createNotificationDetail({
        properties: {
          accessToken: 'xoxb-token',
          conversationId: 'C9876543'
        }
      });
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: 'C9876543',
        text: expect.any(String)
      });
    });
  });

  describe('message formatting', () => {
    test('should include red circle emoji', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain(':red_circle:');
    });

    test('should include alarm name as link', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('HighErrorRate');
      expect(call.text).toContain('https://console.aws.amazon.com/cloudwatch/alarm');
    });

    test('should include stack name', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('my-stack-dev');
    });

    test('should include description when present', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        description: 'Error rate is too high'
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain(':information_source:');
      expect(call.text).toContain('Error rate is too high');
    });

    test('should not include description section when missing', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'HighErrorRate',
          description: undefined
        }
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).not.toContain(':information_source:');
    });

    test('should include affected resource as link', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain(':o:');
      expect(call.text).toContain('MyFunction');
      expect(call.text).toContain('https://console.aws.amazon.com/lambda/function');
    });

    test('should include cause string from utils', async () => {
      mockGetCauseString.mockReturnValue('Average Lambda error rate > 5%');

      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      expect(mockGetCauseString).toHaveBeenCalledWith({ alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain(':question:');
      expect(call.text).toContain('Average Lambda error rate > 5%');
    });

    test('should include timestamp', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        time: '2024-01-01T00:00:00Z'
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain(':hourglass:');
      expect(call.text).toContain('2024-01-01T00:00:00Z');
    });

    test('should use Slack markdown formatting', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('*');
      expect(call.text).toContain('`');
    });

    test('should include separator line', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('------------------------------------------------');
    });

    test('should format complete message correctly', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      const message = call.text;

      // Check message structure
      expect(message).toMatch(/^:red_circle:/);
      expect(message).toContain('ALARM fired');
      expect(message).toContain('*Resource:*');
      expect(message).toContain('*Cause:*');
      expect(message).toContain('*Time:*');
    });
  });

  describe('different alarm types', () => {
    test('should handle database alarm', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'HighCPU',
          description: 'Database CPU is high',
          trigger: {
            type: 'database-cpu-utilization',
            properties: { thresholdPercent: 80 }
          }
        },
        affectedResource: {
          displayName: 'MyDatabase',
          link: 'https://console.aws.amazon.com/rds/database'
        }
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('HighCPU');
      expect(call.text).toContain('MyDatabase');
    });

    test('should handle API Gateway alarm', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'HighLatency',
          description: 'API latency is high',
          trigger: {
            type: 'http-api-gateway-latency',
            properties: { thresholdMilliseconds: 1000 }
          }
        },
        affectedResource: {
          displayName: 'MyAPI',
          link: 'https://console.aws.amazon.com/apigateway/api'
        }
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('HighLatency');
      expect(call.text).toContain('MyAPI');
    });

    test('should handle SQS queue alarm', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'QueueNotEmpty',
          description: 'Queue has messages',
          trigger: {
            type: 'sqs-queue-not-empty',
            properties: {}
          }
        },
        affectedResource: {
          displayName: 'MyQueue',
          link: 'https://console.aws.amazon.com/sqs/queue'
        }
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('QueueNotEmpty');
      expect(call.text).toContain('MyQueue');
    });
  });

  describe('error handling', () => {
    test('should propagate Slack API errors', async () => {
      mockPostMessage.mockRejectedValueOnce(new Error('channel_not_found'));

      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await expect(
        sendAlarmSlackMessage({ notificationDetail, alarmDetail })
      ).rejects.toThrow('channel_not_found');
    });

    test('should propagate invalid token errors', async () => {
      mockPostMessage.mockRejectedValueOnce(new Error('invalid_auth'));

      const notificationDetail = createNotificationDetail({
        properties: {
          accessToken: 'invalid-token',
          conversationId: 'C123'
        }
      });
      const alarmDetail = createAlarmDetail();

      await expect(
        sendAlarmSlackMessage({ notificationDetail, alarmDetail })
      ).rejects.toThrow('invalid_auth');
    });

    test('should propagate rate limit errors', async () => {
      mockPostMessage.mockRejectedValueOnce(new Error('rate_limited'));

      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await expect(
        sendAlarmSlackMessage({ notificationDetail, alarmDetail })
      ).rejects.toThrow('rate_limited');
    });

    test('should propagate network errors', async () => {
      mockPostMessage.mockRejectedValueOnce(new Error('Network error'));

      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await expect(
        sendAlarmSlackMessage({ notificationDetail, alarmDetail })
      ).rejects.toThrow('Network error');
    });
  });

  describe('edge cases', () => {
    test('should handle very long alarm names', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'A'.repeat(200),
          description: 'Test'
        }
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('A'.repeat(200));
    });

    test('should handle very long stack names', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        stackName: 'very-long-stack-name-' + 'x'.repeat(100)
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text.length).toBeGreaterThan(100);
    });

    test('should handle empty description', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'TestAlarm',
          description: ''
        }
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toBeDefined();
    });

    test('should handle special characters in alarm name', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'Alarm-With_Special.Characters!',
          description: 'Test'
        }
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('Alarm-With_Special.Characters!');
    });

    test('should handle URLs with query parameters', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmLink: 'https://console.aws.amazon.com/cloudwatch/alarm?region=us-east-1&id=123',
        affectedResource: {
          displayName: 'MyResource',
          link: 'https://console.aws.amazon.com/lambda/function?name=MyFunction&tab=configuration'
        }
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('region=us-east-1');
      expect(call.text).toContain('name=MyFunction');
    });

    test('should handle Unicode characters', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'Алярм 警报',
          description: 'Тест テスト'
        },
        description: 'Тест テスト',
        affectedResource: {
          displayName: '函数 функция',
          link: 'https://console.aws.amazon.com/lambda'
        }
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('Алярм 警报');
      expect(call.text).toContain('Тест テスト');
      expect(call.text).toContain('函数 функция');
    });

    test('should handle Slack special characters that need escaping', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'Alarm*with*asterisks',
          description: 'Description_with_underscores'
        },
        description: 'Description_with_underscores'
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('Alarm*with*asterisks');
      expect(call.text).toContain('Description_with_underscores');
    });

    test('should handle different timestamp formats', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        time: '2024-12-31T23:59:59.999Z'
      });

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      const call = mockPostMessage.mock.calls[0][0];
      expect(call.text).toContain('2024-12-31T23:59:59.999Z');
    });

    test('should handle private channel IDs', async () => {
      const notificationDetail = createNotificationDetail({
        properties: {
          accessToken: 'xoxb-token',
          conversationId: 'G123PRIVATE'
        }
      });
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: 'G123PRIVATE',
        text: expect.any(String)
      });
    });

    test('should handle DM channel IDs', async () => {
      const notificationDetail = createNotificationDetail({
        properties: {
          accessToken: 'xoxb-token',
          conversationId: 'D123DM'
        }
      });
      const alarmDetail = createAlarmDetail();

      await sendAlarmSlackMessage({ notificationDetail, alarmDetail });

      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: 'D123DM',
        text: expect.any(String)
      });
    });
  });
});
