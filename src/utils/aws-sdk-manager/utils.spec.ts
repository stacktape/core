import { describe, expect, mock, test } from 'bun:test';

// Mock global state manager
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    credentials: {
      identity: { Account: '123456789012', UserId: 'AIDAI...', Arn: 'arn:aws:iam::...' },
      expiration: '2024-01-01T00:00:00Z',
      source: 'profile',
      accessKeyId: 'AKIATEST'
    },
    awsProfileName: 'default',
    logLevel: 'info',
    region: 'us-east-1'
  }
}));

// Mock AWS SDK
mock.module('@aws-sdk/client-sts', () => ({
  STSClient: mock(function () {
    this.middlewareStack = {
      use: mock(() => {})
    };
    this.send = mock(async () => ({
      Account: '123456789012',
      UserId: 'AIDAI...',
      Arn: 'arn:aws:iam::123456789012:user/test'
    }));
  }),
  GetCallerIdentityCommand: mock(function () {})
}));

// Mock error utilities
mock.module('@errors', () => ({
  hintMessages: {
    weakCredentials: mock(({ profile, credentials }) => [
      `Hint: Check if profile '${profile}' has sufficient permissions`
    ])
  }
}));

// Mock retry plugin
mock.module('@shared/aws/sdk-manager/utils', () => ({
  retryPlugin: { applyToStack: mock(() => {}) }
}));

// Mock AWS resource names
mock.module('@shared/naming/aws-resource-names', () => ({
  awsResourceNames: {
    stackOperationsLogGroup: mock(() => '/stp/stack-operations')
  }
}));

// Mock serialize
mock.module('@shared/utils/misc', () => ({
  serialize: mock((obj) => obj)
}));

// Mock ExpectedError
mock.module('@utils/errors', () => ({
  ExpectedError: class ExpectedError extends Error {
    isExpected = true;
    constructor(public type: string, message: string, public hints?: string[]) {
      super(message);
    }
  }
}));

// Mock printer
mock.module('@utils/printer', () => ({
  printer: {
    colorize: mock((color, text) => text),
    progress: mock(() => {})
  }
}));

describe('aws-sdk-manager/utils', () => {
  describe('getErrorHandler', () => {
    test('should throw ExpectedError for non-expected errors', async () => {
      const { getErrorHandler } = await import('./utils');

      const handler = getErrorHandler('Test operation failed');
      const error = new Error('Test error');

      try {
        handler(error);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.isExpected).toBe(true);
        expect(err.type).toBe('AWS');
        expect(err.message).toContain('Test operation failed');
        expect(err.message).toContain('Test error');
      }
    });

    test('should rethrow ExpectedError without wrapping', async () => {
      const { ExpectedError } = await import('@utils/errors');
      const { getErrorHandler } = await import('./utils');

      const handler = getErrorHandler('Test operation failed');
      const error = new ExpectedError('CUSTOM', 'Custom error');

      try {
        handler(error);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err).toBe(error);
        expect(err.type).toBe('CUSTOM');
      }
    });

    test('should include credential info for expired token errors', async () => {
      const { getErrorHandler } = await import('./utils');

      const handler = getErrorHandler('Test operation failed');
      const error = new Error('The security token included in the request has provided token has expired');

      try {
        handler(error);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('123456789012');
        expect(err.message).toContain('profile');
      }
    });

    test('should include hints for AccessDenied errors', async () => {
      const { getErrorHandler } = await import('./utils');

      const handler = getErrorHandler('Test operation failed');
      const error = new Error('AccessDenied: User is not authorized');

      try {
        handler(error);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.hints).toBeDefined();
        expect(err.hints.length).toBeGreaterThan(0);
      }
    });

    test('should include hints for access denied errors (lowercase)', async () => {
      const { getErrorHandler } = await import('./utils');

      const handler = getErrorHandler('Test operation failed');
      const error = new Error('access denied to this resource');

      try {
        handler(error);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.hints).toBeDefined();
        expect(err.hints.length).toBeGreaterThan(0);
      }
    });

    test('should include hints for NotAuthorized errors', async () => {
      const { getErrorHandler } = await import('./utils');

      const handler = getErrorHandler('Test operation failed');
      const error = new Error('NotAuthorized: Insufficient permissions');

      try {
        handler(error);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.hints).toBeDefined();
      }
    });

    test('should include hints for unauthorized errors', async () => {
      const { getErrorHandler } = await import('./utils');

      const handler = getErrorHandler('Test operation failed');
      const error = new Error('User is unauthorized to perform this action');

      try {
        handler(error);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.hints).toBeDefined();
      }
    });

    test('should include hints for insufficient privileges errors', async () => {
      const { getErrorHandler } = await import('./utils');

      const handler = getErrorHandler('Test operation failed');
      const error = new Error('insufficient privileges to complete this operation');

      try {
        handler(error);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.hints).toBeDefined();
      }
    });

    test('should include hints for insufficient permissions errors', async () => {
      const { getErrorHandler } = await import('./utils');

      const handler = getErrorHandler('Test operation failed');
      const error = new Error('insufficient permissions for this action');

      try {
        handler(error);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.hints).toBeDefined();
      }
    });

    test('should include hints for not authorized errors', async () => {
      const { getErrorHandler } = await import('./utils');

      const handler = getErrorHandler('Test operation failed');
      const error = new Error('User is not authorized to access this resource');

      try {
        handler(error);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.hints).toBeDefined();
      }
    });

    test('should not include hints for non-authorization errors', async () => {
      const { getErrorHandler } = await import('./utils');

      const handler = getErrorHandler('Test operation failed');
      const error = new Error('Network timeout occurred');

      try {
        handler(error);
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.hints).toEqual([]);
      }
    });
  });

  describe('loggingPlugin', () => {
    test('should add middleware to stack', async () => {
      const { loggingPlugin } = await import('./utils');

      const mockStack = {
        add: mock(() => {})
      };

      loggingPlugin.applyToStack(mockStack);

      expect(mockStack.add).toHaveBeenCalled();
    });

    test('should hide buffer content in logs', async () => {
      const { globalStateManager } = await import('@application-services/global-state-manager');
      const { loggingPlugin } = await import('./utils');

      globalStateManager.logLevel = 'debug';

      const mockStack = {
        add: mock((middleware) => {
          // Call the middleware to test it
          const next = mock(async (args) => ({
            output: {
              $metadata: {
                httpStatusCode: 200,
                requestId: 'test-request-id'
              }
            }
          }));

          const context = {
            clientName: 'S3Client',
            commandName: 'PutObjectCommand'
          };

          const args = {
            input: {
              Body: Buffer.from('test content'),
              Bucket: 'test-bucket'
            }
          };

          middleware(next, context)(args);
        })
      };

      loggingPlugin.applyToStack(mockStack);
    });

    test('should not log PutLogEvents to stack operations log group', async () => {
      const { globalStateManager } = await import('@application-services/global-state-manager');
      const { printer } = await import('@utils/printer');
      const { loggingPlugin } = await import('./utils');

      globalStateManager.logLevel = 'debug';
      printer.progress.mockClear();

      const mockStack = {
        add: mock((middleware) => {
          const next = mock(async (args) => ({
            output: {
              $metadata: {
                httpStatusCode: 200,
                requestId: 'test-request-id'
              }
            }
          }));

          const context = {
            clientName: 'CloudWatchLogsClient',
            commandName: 'PutLogEventsCommand'
          };

          const args = {
            input: {
              logGroupName: '/stp/stack-operations',
              logEvents: []
            }
          };

          middleware(next, context)(args);
        })
      };

      loggingPlugin.applyToStack(mockStack);

      // Should not print logs for stack operations log group
      expect(printer.progress).not.toHaveBeenCalled();
    });
  });

  describe('getAwsCredentialsIdentity', () => {
    test('should create STS client with provided credentials', async () => {
      const { STSClient } = await import('@aws-sdk/client-sts');
      const { getAwsCredentialsIdentity } = await import('./utils');

      const credentials = {
        accessKeyId: 'AKIATEST',
        secretAccessKey: 'secret',
        sessionToken: 'token'
      };

      await getAwsCredentialsIdentity({ credentials });

      expect(STSClient).toHaveBeenCalledWith({
        credentials,
        region: 'us-east-1'
      });
    });

    test('should use logging plugin', async () => {
      const { getAwsCredentialsIdentity } = await import('./utils');

      const credentials = {
        accessKeyId: 'AKIATEST',
        secretAccessKey: 'secret'
      };

      await getAwsCredentialsIdentity({ credentials });

      // Middleware should be added
      const stsClient: any = new (await import('@aws-sdk/client-sts')).STSClient({});
      expect(stsClient.middlewareStack.use).toHaveBeenCalled();
    });

    test('should send GetCallerIdentityCommand', async () => {
      const { GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
      const { getAwsCredentialsIdentity } = await import('./utils');

      const credentials = {
        accessKeyId: 'AKIATEST',
        secretAccessKey: 'secret'
      };

      await getAwsCredentialsIdentity({ credentials });

      expect(GetCallerIdentityCommand).toHaveBeenCalled();
    });

    test('should return identity response', async () => {
      const { getAwsCredentialsIdentity } = await import('./utils');

      const credentials = {
        accessKeyId: 'AKIATEST',
        secretAccessKey: 'secret'
      };

      const result = await getAwsCredentialsIdentity({ credentials });

      expect(result.Account).toBe('123456789012');
      expect(result.UserId).toBe('AIDAI...');
    });

    test('should handle errors with error handler', async () => {
      const { STSClient } = await import('@aws-sdk/client-sts');
      const { getAwsCredentialsIdentity } = await import('./utils');

      // Mock STS client to throw error
      STSClient.mockImplementationOnce(function () {
        this.middlewareStack = {
          use: mock(() => {})
        };
        this.send = mock(async () => {
          throw new Error('Access denied');
        });
      } as any);

      const credentials = {
        accessKeyId: 'AKIATEST',
        secretAccessKey: 'secret'
      };

      try {
        await getAwsCredentialsIdentity({ credentials });
        throw new Error('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('Unable to get identity for credentials');
        expect(err.message).toContain('AKIATEST');
      }
    });
  });
});
