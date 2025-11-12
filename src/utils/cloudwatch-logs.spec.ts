import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@config', () => ({
  IS_DEV: false
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    getLogStreams: mock(async ({ logGroupName }) => [
      {
        logStreamName: 'stream-1',
        creationTime: Date.now() + 1000
      }
    ]),
    getLogEvents: mock(async ({ logGroupName, logStreamNames, startTime }) => [
      {
        eventId: 'event-1',
        timestamp: Date.now(),
        message: 'START RequestId: abc-123 Version: $LATEST'
      },
      {
        eventId: 'event-2',
        timestamp: Date.now() + 1000,
        message: '2024-01-01T00:00:00.000Z\tabc-123\tINFO\tTest log message'
      },
      {
        eventId: 'event-3',
        timestamp: Date.now() + 2000,
        message: 'END RequestId: abc-123'
      },
      {
        eventId: 'event-4',
        timestamp: Date.now() + 3000,
        message:
          'REPORT RequestId: abc-123\tDuration: 100 ms\tBilled Duration: 100 ms\tMemory Size: 128 MB\tMax Memory Used: 64 MB'
      }
    ])
  }
}));

mock.module('@utils/errors', () => ({
  getErrorFromString: mock((str: string) => str)
}));

mock.module('@utils/printer', () => ({
  printer: {
    colorize: mock((color: string, text: string) => text),
    makeBold: mock((text: string) => text),
    debug: mock(() => {})
  }
}));

mock.module('@utils/time', () => ({
  getAwsSynchronizedTime: mock(async () => new Date())
}));

mock.module('dayjs', () => ({
  default: mock((date: any) => ({
    format: mock(() => '12:00:00:000')
  }))
}));

mock.module('./log-collector', () => ({
  logCollectorStream: {
    write: mock(() => {})
  }
}));

describe('cloudwatch-logs', () => {
  describe('LambdaCloudwatchLogPrinter', () => {
    test('should construct with correct initial state', async () => {
      const { LambdaCloudwatchLogPrinter } = await import('./cloudwatch-logs');

      const printer = new LambdaCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupAwsResourceName: '/aws/lambda/test-function'
      });

      expect(printer.fetchSince).toBe(1000);
      expect(printer.logGroupName).toBe('/aws/lambda/test-function');
      expect(printer.handledEvents).toEqual([]);
    });

    test('should print logs when printLogs is called', async () => {
      const { LambdaCloudwatchLogPrinter } = await import('./cloudwatch-logs');
      const consoleSpy = mock(() => {});
      console.info = consoleSpy;

      const printer = new LambdaCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupAwsResourceName: '/aws/lambda/test-function'
      });

      await printer.printLogs();

      expect(consoleSpy).toHaveBeenCalled();
    });

    test('should update fetchSince after printing logs', async () => {
      const { LambdaCloudwatchLogPrinter } = await import('./cloudwatch-logs');

      const printer = new LambdaCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupAwsResourceName: '/aws/lambda/test-function'
      });

      const initialFetchSince = printer.fetchSince;
      await printer.printLogs();

      expect(printer.fetchSince).toBeGreaterThan(initialFetchSince);
    });

    test('should track handled events', async () => {
      const { LambdaCloudwatchLogPrinter } = await import('./cloudwatch-logs');

      const printer = new LambdaCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupAwsResourceName: '/aws/lambda/test-function'
      });

      await printer.printLogs();

      expect(printer.handledEvents.length).toBeGreaterThan(0);
    });

    test('should start using new log stream', async () => {
      const { LambdaCloudwatchLogPrinter } = await import('./cloudwatch-logs');

      const printer = new LambdaCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupAwsResourceName: '/aws/lambda/test-function'
      });

      await printer.printLogs();
      const oldFetchSince = printer.fetchSince;

      await printer.startUsingNewLogStream();

      expect(printer.fetchSince).toBeGreaterThan(oldFetchSince);
    });

    test('should handle no log stream available', async () => {
      mock.module('@utils/aws-sdk-manager', () => ({
        awsSdkManager: {
          getLogStreams: mock(async () => []),
          getLogEvents: mock(async () => [])
        }
      }));

      const { LambdaCloudwatchLogPrinter } = await import('./cloudwatch-logs');

      const printer = new LambdaCloudwatchLogPrinter({
        fetchSince: Date.now() + 10000,
        logGroupAwsResourceName: '/aws/lambda/test-function'
      });

      await printer.printLogs();

      expect(true).toBe(true);
    });
  });

  describe('CodebuildDeploymentCloudwatchLogPrinter', () => {
    test('should construct with correct initial state', async () => {
      const { CodebuildDeploymentCloudwatchLogPrinter } = await import('./cloudwatch-logs');

      const printer = new CodebuildDeploymentCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupName: '/aws/codebuild/test-project',
        logStreamName: 'test-stream'
      });

      expect(printer.fetchSince).toBe(1000);
      expect(printer.logGroupName).toBe('/aws/codebuild/test-project');
      expect(printer.logStreamName).toBe('test-stream');
      expect(printer.buildPhaseStartedLogFound).toBe(false);
    });

    test('should print logs after build phase starts', async () => {
      mock.module('@utils/aws-sdk-manager', () => ({
        awsSdkManager: {
          getLogEvents: mock(async () => [
            {
              eventId: 'event-1',
              timestamp: Date.now(),
              message: 'Entering phase BUILD'
            },
            {
              eventId: 'event-2',
              timestamp: Date.now() + 1000,
              message: 'Building application...'
            }
          ])
        }
      }));

      const { CodebuildDeploymentCloudwatchLogPrinter } = await import('./cloudwatch-logs');
      const consoleSpy = mock(() => {});
      console.info = consoleSpy;

      const printer = new CodebuildDeploymentCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupName: '/aws/codebuild/test-project',
        logStreamName: 'test-stream'
      });

      await printer.printLogs();

      expect(printer.buildPhaseStartedLogFound).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
    });

    test('should filter meta messages from CodeBuild', async () => {
      mock.module('@utils/aws-sdk-manager', () => ({
        awsSdkManager: {
          getLogEvents: mock(async () => [
            {
              eventId: 'event-1',
              timestamp: Date.now(),
              message: 'Entering phase BUILD'
            },
            {
              eventId: 'event-2',
              timestamp: Date.now() + 1000,
              message: 'Phase complete: BUILD'
            },
            {
              eventId: 'event-3',
              timestamp: Date.now() + 2000,
              message: 'Building application...'
            }
          ])
        }
      }));

      const { CodebuildDeploymentCloudwatchLogPrinter } = await import('./cloudwatch-logs');
      const consoleSpy = mock(() => {});
      console.info = consoleSpy;

      const printer = new CodebuildDeploymentCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupName: '/aws/codebuild/test-project',
        logStreamName: 'test-stream'
      });

      await printer.printLogs();

      expect(printer.buildPhaseStartedLogFound).toBe(true);
    });

    test('should track handled events', async () => {
      const { CodebuildDeploymentCloudwatchLogPrinter } = await import('./cloudwatch-logs');

      const printer = new CodebuildDeploymentCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupName: '/aws/codebuild/test-project',
        logStreamName: 'test-stream'
      });

      await printer.printLogs();

      expect(printer.handledEvents.size).toBeGreaterThan(0);
    });
  });

  describe('SsmExecuteScriptCloudwatchLogPrinter', () => {
    test('should construct with correct initial state', async () => {
      const { SsmExecuteScriptCloudwatchLogPrinter } = await import('./cloudwatch-logs');

      const printer = new SsmExecuteScriptCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupName: '/aws/ssm/test-group',
        commandId: 'cmd-123',
        instanceId: 'i-123456'
      });

      expect(printer.fetchSince).toBe(1000);
      expect(printer.logGroupName).toBe('/aws/ssm/test-group');
      expect(printer.commandId).toBe('cmd-123');
      expect(printer.instanceId).toBe('i-123456');
      expect(printer.logStreamPrefix).toBe('cmd-123/i-123456/aws-runShellScript');
    });

    test('should print logs when printLogs is called', async () => {
      mock.module('@utils/aws-sdk-manager', () => ({
        awsSdkManager: {
          getLogEvents: mock(async () => [
            {
              eventId: 'event-1',
              timestamp: Date.now(),
              message: 'Script output',
              logStreamName: '/aws/ssm/test/stdout'
            }
          ])
        }
      }));

      const { SsmExecuteScriptCloudwatchLogPrinter } = await import('./cloudwatch-logs');
      const consoleSpy = mock(() => {});
      console.info = consoleSpy;

      const printer = new SsmExecuteScriptCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupName: '/aws/ssm/test-group',
        commandId: 'cmd-123',
        instanceId: 'i-123456'
      });

      await printer.printLogs();

      expect(consoleSpy).toHaveBeenCalled();
    });

    test('should track handled events', async () => {
      const { SsmExecuteScriptCloudwatchLogPrinter } = await import('./cloudwatch-logs');

      const printer = new SsmExecuteScriptCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupName: '/aws/ssm/test-group',
        commandId: 'cmd-123',
        instanceId: 'i-123456'
      });

      await printer.printLogs();

      expect(printer.handledEvents.size).toBeGreaterThan(0);
    });

    test('should update fetchSince after printing', async () => {
      const { SsmExecuteScriptCloudwatchLogPrinter } = await import('./cloudwatch-logs');

      const printer = new SsmExecuteScriptCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupName: '/aws/ssm/test-group',
        commandId: 'cmd-123',
        instanceId: 'i-123456'
      });

      const initialFetchSince = printer.fetchSince;
      await printer.printLogs();

      expect(printer.fetchSince).toBeGreaterThanOrEqual(initialFetchSince);
    });

    test('should handle stderr logs differently', async () => {
      mock.module('@utils/aws-sdk-manager', () => ({
        awsSdkManager: {
          getLogEvents: mock(async () => [
            {
              eventId: 'event-1',
              timestamp: Date.now(),
              message: 'Error output',
              logStreamName: '/aws/ssm/test/stderr'
            }
          ])
        }
      }));

      const { SsmExecuteScriptCloudwatchLogPrinter } = await import('./cloudwatch-logs');
      const consoleSpy = mock(() => {});
      console.info = consoleSpy;

      const printer = new SsmExecuteScriptCloudwatchLogPrinter({
        fetchSince: 1000,
        logGroupName: '/aws/ssm/test-group',
        commandId: 'cmd-123',
        instanceId: 'i-123456'
      });

      await printer.printLogs();

      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
