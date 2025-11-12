import { describe, expect, test, beforeEach, mock } from 'bun:test';

const mockResolveDirectives = mock(async ({ itemToResolve }) => itemToResolve);
const mockInvalidatePotentiallyChangedDirectiveResults = mock(() => {});
const mockSlackPostMessage = mock(async () => ({}));
const mockJsonFetch = mock(async () => ({}));
const mockPrinter = {
  warn: mock(() => {}),
  colorize: mock((color, text) => text)
};
const mockGetPrettyPrintedFlatObject = mock((obj) => JSON.stringify(obj));

const mockGlobalStateManager = {
  targetStack: {
    stage: 'test',
    projectName: 'test-project',
    stackName: 'test-project-test'
  },
  command: 'deploy'
};

const mockConfigManager = {
  resolveDirectives: mockResolveDirectives,
  invalidatePotentiallyChangedDirectiveResults: mockInvalidatePotentiallyChangedDirectiveResults
};

mock.module('@domain-services/config-manager', () => ({
  configManager: mockConfigManager
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: mockGlobalStateManager
}));

mock.module('@slack/web-api', () => ({
  WebClient: class {
    chat = {
      postMessage: mockSlackPostMessage
    };
  }
}));

mock.module('@utils/http-client', () => ({
  jsonFetch: mockJsonFetch
}));

mock.module('@utils/printer', () => ({
  printer: mockPrinter
}));

mock.module('@utils/formatting', () => ({
  getPrettyPrintedFlatObject: mockGetPrettyPrintedFlatObject
}));

describe('NotificationManager', () => {
  let notificationManager: any;

  beforeEach(async () => {
    mock.restore();
    mockResolveDirectives.mockClear();
    mockInvalidatePotentiallyChangedDirectiveResults.mockClear();
    mockSlackPostMessage.mockClear();
    mockJsonFetch.mockClear();
    mockPrinter.warn.mockClear();
    mockPrinter.colorize.mockClear();
    mockGetPrettyPrintedFlatObject.mockClear();

    mockResolveDirectives.mockImplementation(async ({ itemToResolve }) => itemToResolve);
    mockSlackPostMessage.mockResolvedValue({});
    mockJsonFetch.mockResolvedValue({});
    mockPrinter.colorize.mockImplementation((color, text) => text);
    mockGetPrettyPrintedFlatObject.mockImplementation((obj) => JSON.stringify(obj));

    const module = await import('./index');
    notificationManager = module.notificationManager;
    await notificationManager.init([]);
  });

  describe('initialization', () => {
    test('should initialize successfully with empty notifications', async () => {
      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init([]);
      expect(manager.isInitialized).toBe(true);
    });

    test('should resolve directives on init', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: '$Secret(slack-token)',
              conversationId: 'C123'
            }
          },
          forStages: ['test']
        }
      ];

      mockResolveDirectives.mockResolvedValueOnce([
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-resolved-token',
              conversationId: 'C123'
            }
          },
          forStages: ['test']
        }
      ]);

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      expect(mockResolveDirectives).toHaveBeenCalledWith(
        expect.objectContaining({
          itemToResolve: notifications,
          resolveRuntime: true,
          useLocalResolve: true
        })
      );
      expect(mockInvalidatePotentiallyChangedDirectiveResults).toHaveBeenCalled();
    });

    test('should handle null notifications', async () => {
      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(null);
      expect(manager.isInitialized).toBe(true);
    });
  });

  describe('sendDeploymentNotification', () => {
    test('should send Slack notification', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forStages: ['test']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: 'Deployment started',
          type: 'progress'
        }
      });

      expect(mockSlackPostMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: expect.stringContaining('Deployment started')
      });
    });

    test('should send MS Teams notification', async () => {
      const notifications = [
        {
          integration: {
            type: 'ms-teams',
            properties: {
              webhookUrl: 'https://outlook.office.com/webhook/xxx'
            }
          },
          forStages: ['test']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: 'Deployment completed',
          type: 'success'
        }
      });

      expect(mockJsonFetch).toHaveBeenCalledWith(
        'https://outlook.office.com/webhook/xxx',
        {
          method: 'POST',
          body: { text: 'Deployment completed' }
        }
      );
    });

    test('should filter notifications by stage', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forStages: ['production']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: 'Deployment started',
          type: 'progress'
        }
      });

      expect(mockSlackPostMessage).not.toHaveBeenCalled();
    });

    test('should send to all stages when forStages includes wildcard', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forStages: ['*']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: 'Deployment started',
          type: 'progress'
        }
      });

      expect(mockSlackPostMessage).toHaveBeenCalled();
    });

    test('should filter notifications by service', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forServices: ['other-project']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: 'Deployment started',
          type: 'progress'
        }
      });

      expect(mockSlackPostMessage).not.toHaveBeenCalled();
    });

    test('should send to all services when forServices includes wildcard', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forServices: ['*']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: 'Deployment started',
          type: 'progress'
        }
      });

      expect(mockSlackPostMessage).toHaveBeenCalled();
    });

    test('should prettify Slack messages for progress', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forStages: ['test']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: '[DEPLOY] Starting deployment',
          type: 'progress'
        }
      });

      expect(mockSlackPostMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: expect.stringContaining(':large_purple_circle:')
      });
    });

    test('should prettify Slack messages for error', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forStages: ['test']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: '[ERROR] Deployment failed',
          type: 'error'
        }
      });

      expect(mockSlackPostMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: expect.stringContaining(':x:')
      });
    });

    test('should prettify Slack messages for success', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forStages: ['test']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: '[SUCCESS] Deployment completed',
          type: 'success'
        }
      });

      expect(mockSlackPostMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: expect.stringContaining(':white_check_mark:')
      });
    });

    test('should handle notification errors gracefully', async () => {
      mockSlackPostMessage.mockRejectedValueOnce(new Error('Slack API Error'));

      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forStages: ['test']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: 'Test message',
          type: 'progress'
        }
      });

      expect(mockPrinter.warn).toHaveBeenCalled();
    });

    test('should send to multiple integrations', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forStages: ['test']
        },
        {
          integration: {
            type: 'ms-teams',
            properties: {
              webhookUrl: 'https://outlook.office.com/webhook/xxx'
            }
          },
          forStages: ['test']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: 'Deployment started',
          type: 'progress'
        }
      });

      expect(mockSlackPostMessage).toHaveBeenCalled();
      expect(mockJsonFetch).toHaveBeenCalled();
    });
  });

  describe('reportError', () => {
    test('should send error notification with stack name', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forStages: ['test']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.reportError('Error stack trace here');

      expect(mockSlackPostMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: expect.stringContaining('test-project-test')
      });
    });

    test('should send error notification without stack name', async () => {
      mockGlobalStateManager.targetStack = undefined;

      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forStages: ['test']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.reportError('Error stack trace here');

      expect(mockSlackPostMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: expect.stringContaining('Error performing operation')
      });

      mockGlobalStateManager.targetStack = {
        stage: 'test',
        projectName: 'test-project',
        stackName: 'test-project-test'
      };
    });

    test('should include error stack in message', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forStages: ['test']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.reportError('Custom error stack trace');

      expect(mockSlackPostMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: expect.stringContaining('Custom error stack trace')
      });
    });
  });

  describe('edge cases', () => {
    test('should handle no notifications configured', async () => {
      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init([]);

      await manager.sendDeploymentNotification({
        message: {
          text: 'Test message',
          type: 'progress'
        }
      });

      expect(mockSlackPostMessage).not.toHaveBeenCalled();
      expect(mockJsonFetch).not.toHaveBeenCalled();
    });

    test('should handle message with details', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          },
          forStages: ['test']
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: 'Deployment started',
          type: 'progress',
          details: { region: 'us-east-1', version: '1.0.0' }
        }
      });

      expect(mockSlackPostMessage).toHaveBeenCalled();
    });

    test('should handle notifications without stage/service filters', async () => {
      const notifications = [
        {
          integration: {
            type: 'slack',
            properties: {
              accessToken: 'xoxb-token',
              conversationId: 'C123'
            }
          }
        }
      ];

      const { NotificationManager } = await import('./index');
      const manager = new NotificationManager();
      await manager.init(notifications);

      await manager.sendDeploymentNotification({
        message: {
          text: 'Test message',
          type: 'progress'
        }
      });

      expect(mockSlackPostMessage).toHaveBeenCalled();
    });
  });
});
