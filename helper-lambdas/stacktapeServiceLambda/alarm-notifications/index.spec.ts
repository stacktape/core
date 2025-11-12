import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock dependencies
const mockSendAlarmEmail = mock(async () => ({}));
const mockSendAlarmSlackMessage = mock(async () => ({}));

const mockGetParameter = mock(async () => ({
  Parameter: { Value: 'resolved-ssm-value' }
}));

const mockGetSecretValue = mock(async () => ({
  SecretString: '{"key":"secret-value"}'
}));

const mockSSMClient = {
  send: mock(async (command) => {
    if (command.constructor.name === 'GetParameterCommand') {
      return mockGetParameter(command);
    }
  })
};

const mockSecretsClient = {
  send: mock(async (command) => {
    if (command.constructor.name === 'GetSecretValueCommand') {
      return mockGetSecretValue(command);
    }
  })
};

mock.module('@aws-sdk/client-ssm', () => ({
  SSMClient: class {
    constructor() {
      return mockSSMClient;
    }
  },
  GetParameterCommand: class {
    constructor(public input: any) {}
  }
}));

mock.module('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: class {
    constructor() {
      return mockSecretsClient;
    }
  },
  GetSecretValueCommand: class {
    constructor(public input: any) {}
  }
}));

const mockConstants = {
  CF_ESCAPED_DYNAMIC_REFERENCE_START: '{{resolve:',
  CF_ESCAPED_DYNAMIC_REFERENCE_END: '}}'
};

mock.module('@shared/utils/constants', () => mockConstants);

const mockProcessAllNodes = mock(async (obj, fn) => {
  const process = async (node: any): Promise<any> => {
    if (Array.isArray(node)) {
      return Promise.all(node.map(process));
    }
    if (node && typeof node === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(node)) {
        result[key] = await process(value);
      }
      return result;
    }
    return fn(node);
  };
  return process(obj);
});

mock.module('@shared/utils/misc', () => ({
  processAllNodes: mockProcessAllNodes
}));

mock.module('./email', () => ({
  sendAlarmEmail: mockSendAlarmEmail
}));

mock.module('./slack', () => ({
  sendAlarmSlackMessage: mockSendAlarmSlackMessage
}));

describe('alarm-notifications/index', () => {
  let handler: any;

  beforeEach(async () => {
    mock.restore();

    // Clear mocks
    mockSendAlarmEmail.mockClear();
    mockSendAlarmSlackMessage.mockClear();
    mockGetParameter.mockClear();
    mockGetSecretValue.mockClear();
    mockSSMClient.send.mockClear();
    mockSecretsClient.send.mockClear();
    mockProcessAllNodes.mockClear();

    // Set up default implementations
    mockGetParameter.mockResolvedValue({
      Parameter: { Value: 'resolved-ssm-value' }
    });

    mockGetSecretValue.mockResolvedValue({
      SecretString: '{"key":"secret-value"}'
    });

    mockSendAlarmEmail.mockResolvedValue({});
    mockSendAlarmSlackMessage.mockResolvedValue({});

    mockProcessAllNodes.mockImplementation(async (obj, fn) => {
      const process = async (node: any): Promise<any> => {
        if (Array.isArray(node)) {
          return Promise.all(node.map(process));
        }
        if (node && typeof node === 'object') {
          const result: any = {};
          for (const [key, value] of Object.entries(node)) {
            result[key] = await process(value);
          }
          return result;
        }
        return fn(node);
      };
      return process(obj);
    });

    const module = await import('./index');
    handler = module.default;
  });

  const createAlarmEvent = (overrides: any = {}): any => ({
    alarmConfig: {
      name: 'HighErrorRate',
      description: 'Error rate is too high',
      trigger: {
        type: 'lambda-error-rate',
        properties: {
          thresholdPercent: 5
        }
      },
      notificationTargets: [],
      ...overrides.alarmConfig
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
    time: '2024-01-01T00:00:00Z',
    ...overrides
  });

  describe('notification routing', () => {
    test('should send Slack notification', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: 'xoxb-slack-token',
                conversationId: 'C123456'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSendAlarmSlackMessage).toHaveBeenCalledWith({
        notificationDetail: event.alarmConfig.notificationTargets[0],
        alarmDetail: event
      });
    });

    test('should send email notification', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'email',
              properties: {
                sender: 'alerts@example.com',
                recipient: 'team@example.com'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSendAlarmEmail).toHaveBeenCalledWith({
        notificationDetail: event.alarmConfig.notificationTargets[0],
        alarmDetail: event
      });
    });

    test('should send multiple notifications', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: 'xoxb-token',
                conversationId: 'C123'
              }
            },
            {
              type: 'email',
              properties: {
                sender: 'alerts@example.com',
                recipient: 'team@example.com'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSendAlarmSlackMessage).toHaveBeenCalledTimes(1);
      expect(mockSendAlarmEmail).toHaveBeenCalledTimes(1);
    });

    test('should handle unknown notification type', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'unknown',
              properties: {}
            }
          ]
        }
      });

      await handler(event);

      expect(mockSendAlarmSlackMessage).not.toHaveBeenCalled();
      expect(mockSendAlarmEmail).not.toHaveBeenCalled();
    });

    test('should handle empty notification targets', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: []
        }
      });

      await handler(event);

      expect(mockSendAlarmSlackMessage).not.toHaveBeenCalled();
      expect(mockSendAlarmEmail).not.toHaveBeenCalled();
    });

    test('should handle missing notification targets', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: undefined
        }
      });

      await handler(event);

      expect(mockSendAlarmSlackMessage).not.toHaveBeenCalled();
      expect(mockSendAlarmEmail).not.toHaveBeenCalled();
    });
  });

  describe('dynamic reference resolution - SSM', () => {
    test('should resolve SSM parameter reference', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:ssm-secure:/my/token}}',
                conversationId: 'C123'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSSMClient.send).toHaveBeenCalled();
      expect(mockSendAlarmSlackMessage).toHaveBeenCalled();
    });

    test('should resolve SSM non-secure parameter', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:ssm:/my/parameter}}',
                conversationId: 'C123'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSSMClient.send).toHaveBeenCalled();
    });

    test('should resolve multiple SSM parameters', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:ssm-secure:/token1}}',
                conversationId: '{{resolve:ssm:/channel}}'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSSMClient.send).toHaveBeenCalledTimes(2);
    });

    test('should request decryption for SSM parameters', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:ssm-secure:/my/token}}',
                conversationId: 'C123'
              }
            }
          ]
        }
      });

      await handler(event);

      const ssmCall = mockSSMClient.send.mock.calls[0][0];
      expect(ssmCall.input.WithDecryption).toBe(true);
    });
  });

  describe('dynamic reference resolution - Secrets Manager', () => {
    test('should resolve Secrets Manager secret', async () => {
      mockGetSecretValue.mockResolvedValueOnce({
        SecretString: 'my-secret-value'
      });

      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:secretsmanager:my-secret}}',
                conversationId: 'C123'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSecretsClient.send).toHaveBeenCalled();
    });

    test('should resolve JSON key from secret', async () => {
      mockGetSecretValue.mockResolvedValueOnce({
        SecretString: '{"token":"my-token","channel":"C123"}'
      });

      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:secretsmanager:my-secret:SecretString:token}}',
                conversationId: 'C123'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSecretsClient.send).toHaveBeenCalled();
    });

    test('should resolve secret with version stage', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:secretsmanager:my-secret:SecretString:token:AWSCURRENT}}',
                conversationId: 'C123'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSecretsClient.send).toHaveBeenCalled();
    });

    test('should resolve secret with version ID', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:secretsmanager:my-secret:SecretString:token::version-id-123}}',
                conversationId: 'C123'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSecretsClient.send).toHaveBeenCalled();
    });

    test('should return full secret string when no JSON key specified', async () => {
      mockGetSecretValue.mockResolvedValueOnce({
        SecretString: 'plain-text-secret'
      });

      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:secretsmanager:my-secret}}',
                conversationId: 'C123'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSecretsClient.send).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    test('should handle Slack notification failure gracefully', async () => {
      mockSendAlarmSlackMessage.mockRejectedValueOnce(new Error('Slack API error'));

      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: 'token',
                conversationId: 'C123'
              }
            }
          ]
        }
      });

      // Should not throw
      await expect(handler(event)).resolves.not.toThrow();
    });

    test('should handle email notification failure gracefully', async () => {
      mockSendAlarmEmail.mockRejectedValueOnce(new Error('SES error'));

      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'email',
              properties: {
                sender: 'alerts@example.com',
                recipient: 'team@example.com'
              }
            }
          ]
        }
      });

      // Should not throw
      await expect(handler(event)).resolves.not.toThrow();
    });

    test('should continue with other notifications after one fails', async () => {
      mockSendAlarmSlackMessage.mockRejectedValueOnce(new Error('Slack error'));
      mockSendAlarmEmail.mockResolvedValueOnce({});

      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: 'token',
                conversationId: 'C123'
              }
            },
            {
              type: 'email',
              properties: {
                sender: 'alerts@example.com',
                recipient: 'team@example.com'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSendAlarmSlackMessage).toHaveBeenCalled();
      expect(mockSendAlarmEmail).toHaveBeenCalled();
    });

    test('should handle SSM parameter not found', async () => {
      mockSSMClient.send.mockRejectedValueOnce(new Error('ParameterNotFound'));

      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:ssm:/missing/parameter}}',
                conversationId: 'C123'
              }
            }
          ]
        }
      });

      await expect(handler(event)).rejects.toThrow('ParameterNotFound');
    });

    test('should handle Secrets Manager secret not found', async () => {
      mockSecretsClient.send.mockRejectedValueOnce(new Error('ResourceNotFoundException'));

      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:secretsmanager:missing-secret}}',
                conversationId: 'C123'
              }
            }
          ]
        }
      });

      await expect(handler(event)).rejects.toThrow('ResourceNotFoundException');
    });
  });

  describe('edge cases', () => {
    test('should handle event without alarmConfig', async () => {
      const event = {
        stackName: 'my-stack',
        alarmLink: 'https://example.com'
      } as any;

      await handler(event);

      expect(mockSendAlarmSlackMessage).not.toHaveBeenCalled();
      expect(mockSendAlarmEmail).not.toHaveBeenCalled();
    });

    test('should handle dynamic references in nested objects', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:ssm:/token}}',
                nested: {
                  deep: {
                    value: '{{resolve:ssm:/deep/value}}'
                  }
                }
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSSMClient.send).toHaveBeenCalled();
    });

    test('should handle dynamic references in arrays', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'email',
              properties: {
                sender: 'alerts@example.com',
                recipient: 'team@example.com',
                tags: ['{{resolve:ssm:/tag1}}', '{{resolve:ssm:/tag2}}']
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockProcessAllNodes).toHaveBeenCalled();
    });

    test('should handle mixed static and dynamic values', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: '{{resolve:ssm:/token}}',
                conversationId: 'C123'
              }
            },
            {
              type: 'email',
              properties: {
                sender: 'alerts@example.com',
                recipient: 'team@example.com'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSendAlarmSlackMessage).toHaveBeenCalled();
      expect(mockSendAlarmEmail).toHaveBeenCalled();
    });

    test('should handle empty string values', async () => {
      const event = createAlarmEvent({
        alarmConfig: {
          description: '',
          notificationTargets: [
            {
              type: 'slack',
              properties: {
                accessToken: 'token',
                conversationId: 'C123'
              }
            }
          ]
        }
      });

      await handler(event);

      expect(mockSendAlarmSlackMessage).toHaveBeenCalled();
    });
  });
});
