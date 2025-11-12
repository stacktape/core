import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock dependencies
const mockSend = mock(async () => ({}));

const mockSESClient = {
  send: mockSend
};

mock.module('@aws-sdk/client-sesv2', () => ({
  SESv2Client: class {
    constructor() {
      return mockSESClient;
    }
  },
  SendEmailCommand: class {
    constructor(public input: any) {}
  }
}));

const mockGetCauseString = mock(() => 'Average Lambda error rate > 5%');

mock.module('../utils', () => ({
  getCauseString: mockGetCauseString
}));

describe('alarm-notifications/email', () => {
  let sendAlarmEmail: any;

  beforeEach(async () => {
    mock.restore();

    mockSend.mockClear();
    mockGetCauseString.mockClear();

    mockSend.mockResolvedValue({});
    mockGetCauseString.mockReturnValue('Average Lambda error rate > 5%');

    const module = await import('./index');
    sendAlarmEmail = module.sendAlarmEmail;
  });

  const createNotificationDetail = (overrides: any = {}): any => ({
    type: 'email',
    properties: {
      sender: 'alerts@example.com',
      recipient: 'team@example.com',
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

  describe('email sending', () => {
    test('should send email with correct sender and recipient', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      expect(mockSend).toHaveBeenCalled();
      const command = mockSend.mock.calls[0][0];
      expect(command.input.FromEmailAddress).toBe('alerts@example.com');
      expect(command.input.Destination.ToAddresses).toEqual(['team@example.com']);
    });

    test('should include alarm name in subject', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Content.Simple.Subject.Data).toContain('HighErrorRate');
    });

    test('should include stack name in subject', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Content.Simple.Subject.Data).toContain('my-stack-dev');
    });

    test('should format subject correctly', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Content.Simple.Subject.Data).toBe(
        'Alarm HighErrorRate (stack my-stack-dev)'
      );
    });

    test('should use UTF-8 charset for subject', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Content.Simple.Subject.Charset).toBe('UTF-8');
    });

    test('should use UTF-8 charset for body', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Content.Simple.Body.Text.Charset).toBe('UTF-8');
    });
  });

  describe('email body content', () => {
    test('should include alarm name in body', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(body).toContain('HighErrorRate');
    });

    test('should include stack name in body', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(body).toContain('my-stack-dev');
    });

    test('should include alarm link in body', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(body).toContain('https://console.aws.amazon.com/cloudwatch/alarm');
    });

    test('should include description when present', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        description: 'Error rate is too high'
      });

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(body).toContain('Error rate is too high');
    });

    test('should not include description section when missing', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'HighErrorRate',
          description: undefined
        }
      });

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(body).not.toContain('Description:');
    });

    test('should include affected resource name in body', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(body).toContain('MyFunction');
    });

    test('should include affected resource link in body', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(body).toContain('https://console.aws.amazon.com/lambda/function');
    });

    test('should include cause string from utils', async () => {
      mockGetCauseString.mockReturnValue('Average Lambda error rate > 5%');

      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      expect(mockGetCauseString).toHaveBeenCalledWith({ alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(body).toContain('Average Lambda error rate > 5%');
    });

    test('should format body with proper sections', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;

      expect(body).toContain('Alarm link:');
      expect(body).toContain('Affected resource:');
      expect(body).toContain('Cause:');
    });
  });

  describe('different recipient configurations', () => {
    test('should handle different sender addresses', async () => {
      const notificationDetail = createNotificationDetail({
        properties: {
          sender: 'no-reply@example.com',
          recipient: 'team@example.com'
        }
      });
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.FromEmailAddress).toBe('no-reply@example.com');
    });

    test('should handle different recipient addresses', async () => {
      const notificationDetail = createNotificationDetail({
        properties: {
          sender: 'alerts@example.com',
          recipient: 'ops-team@example.com'
        }
      });
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Destination.ToAddresses).toEqual(['ops-team@example.com']);
    });

    test('should handle email addresses with plus signs', async () => {
      const notificationDetail = createNotificationDetail({
        properties: {
          sender: 'alerts+dev@example.com',
          recipient: 'team+alerts@example.com'
        }
      });
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.FromEmailAddress).toBe('alerts+dev@example.com');
      expect(command.input.Destination.ToAddresses).toEqual(['team+alerts@example.com']);
    });

    test('should handle email addresses with dots', async () => {
      const notificationDetail = createNotificationDetail({
        properties: {
          sender: 'alerts.system@example.com',
          recipient: 'john.doe@example.com'
        }
      });
      const alarmDetail = createAlarmDetail();

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.FromEmailAddress).toBe('alerts.system@example.com');
      expect(command.input.Destination.ToAddresses).toEqual(['john.doe@example.com']);
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

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const subject = command.input.Content.Simple.Subject.Data;
      const body = command.input.Content.Simple.Body.Text.Data;

      expect(subject).toContain('HighCPU');
      expect(body).toContain('MyDatabase');
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

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(body).toContain('MyAPI');
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

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(body).toContain('MyQueue');
    });
  });

  describe('error handling', () => {
    test('should propagate SES send errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('SES rate limit exceeded'));

      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await expect(
        sendAlarmEmail({ notificationDetail, alarmDetail })
      ).rejects.toThrow('SES rate limit exceeded');
    });

    test('should propagate invalid email address errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Invalid email address'));

      const notificationDetail = createNotificationDetail({
        properties: {
          sender: 'invalid-email',
          recipient: 'team@example.com'
        }
      });
      const alarmDetail = createAlarmDetail();

      await expect(
        sendAlarmEmail({ notificationDetail, alarmDetail })
      ).rejects.toThrow('Invalid email address');
    });

    test('should propagate unverified sender errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Email address is not verified'));

      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail();

      await expect(
        sendAlarmEmail({ notificationDetail, alarmDetail })
      ).rejects.toThrow('Email address is not verified');
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

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const subject = command.input.Content.Simple.Subject.Data;
      expect(subject).toContain('A'.repeat(200));
    });

    test('should handle very long stack names', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        stackName: 'very-long-stack-name-' + 'x'.repeat(100)
      });

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const subject = command.input.Content.Simple.Subject.Data;
      expect(subject.length).toBeGreaterThan(100);
    });

    test('should handle empty description', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'TestAlarm',
          description: ''
        }
      });

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(body).toBeDefined();
    });

    test('should handle special characters in alarm name', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'Alarm-With_Special.Characters!',
          description: 'Test'
        }
      });

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const subject = command.input.Content.Simple.Subject.Data;
      expect(subject).toContain('Alarm-With_Special.Characters!');
    });

    test('should handle Unicode characters in content', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmConfig: {
          name: 'Алярм 警报',
          description: 'Тест テスト'
        },
        description: 'Тест テスト'
      });

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const subject = command.input.Content.Simple.Subject.Data;
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(subject).toContain('Алярм 警报');
      expect(body).toContain('Тест テスト');
    });

    test('should handle very long URLs', async () => {
      const notificationDetail = createNotificationDetail();
      const alarmDetail = createAlarmDetail({
        alarmLink: 'https://console.aws.amazon.com/' + 'a'.repeat(500),
        affectedResource: {
          displayName: 'MyResource',
          link: 'https://console.aws.amazon.com/' + 'b'.repeat(500)
        }
      });

      await sendAlarmEmail({ notificationDetail, alarmDetail });

      const command = mockSend.mock.calls[0][0];
      const body = command.input.Content.Simple.Body.Text.Data;
      expect(body.length).toBeGreaterThan(1000);
    });
  });
});
