import { describe, expect, mock, test, spyOn, beforeEach } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {
      resourceName: 'myLambda',
      raw: false,
      filter: undefined,
      container: undefined,
      startTime: undefined
    },
    targetStack: {
      stackName: 'test-project-dev'
    },
    loadTargetStackInfo: mock(async () => {})
  }
}));

mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: {
    init: mock(async () => {})
  }
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: {
    init: mock(async () => {})
  }
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    getLogStreams: mock(async () => [
      { logStreamName: 'stream1' },
      { logStreamName: 'stream2' }
    ]),
    getLogEvents: mock(async () => [
      {
        timestamp: 1704067200000,
        logStreamName: 'stream1',
        message: 'Log message 1'
      },
      {
        timestamp: 1704067260000,
        logStreamName: 'stream2',
        message: 'Log message 2'
      }
    ])
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    info: mock(() => {}),
    colorize: mock((color: string, text: string) => text)
  }
}));

mock.module('../_utils/initialization', () => ({
  loadUserCredentials: mock(async () => {})
}));

mock.module('../_utils/logs', () => ({
  getLogGroupInfoForStacktapeResource: mock(() => ({
    PhysicalResourceId: '/aws/lambda/my-function'
  }))
}));

describe('logs command', () => {
  let consoleInfoSpy: any;

  beforeEach(() => {
    consoleInfoSpy = spyOn(console, 'info').mockImplementation(() => {});
  });

  test('should fetch and display logs', async () => {
    const { loadUserCredentials } = await import('../_utils/initialization');
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { configManager } = await import('@domain-services/config-manager');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');

    const { commandLogs } = await import('./index');
    await commandLogs();

    expect(loadUserCredentials).toHaveBeenCalled();
    expect(globalStateManager.loadTargetStackInfo).toHaveBeenCalled();
    expect(configManager.init).toHaveBeenCalledWith({ configRequired: true });
    expect(stackManager.init).toHaveBeenCalledWith({
      stackName: 'test-project-dev',
      commandModifiesStack: false,
      commandRequiresDeployedStack: true
    });
    expect(awsSdkManager.getLogStreams).toHaveBeenCalled();
    expect(awsSdkManager.getLogEvents).toHaveBeenCalled();
  });

  test('should display formatted logs by default', async () => {
    const { commandLogs } = await import('./index');
    await commandLogs();

    expect(consoleInfoSpy).toHaveBeenCalled();
    const output = consoleInfoSpy.mock.calls[0][0];
    expect(output).toContain('Log message 1');
    expect(output).toContain('Log message 2');
  });

  test('should display raw logs when raw flag is set', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = { resourceName: 'myLambda', raw: true };

    const { commandLogs } = await import('./index');
    await commandLogs();

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          timestamp: expect.any(Number),
          logStreamName: expect.any(String),
          message: expect.any(String)
        })
      ])
    );
  });

  test('should use default start time of 1 hour ago', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    globalStateManager.args = { resourceName: 'myLambda', startTime: undefined };

    const { commandLogs } = await import('./index');
    await commandLogs();

    expect(awsSdkManager.getLogEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: expect.any(Number)
      })
    );
  });

  test('should use custom start time when provided', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const customStartTime = '2024-01-01T00:00:00Z';
    globalStateManager.args = { resourceName: 'myLambda', startTime: customStartTime };

    const { commandLogs } = await import('./index');
    await commandLogs();

    expect(awsSdkManager.getLogEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        startTime: new Date(customStartTime).getTime()
      })
    );
  });

  test('should apply filter pattern when provided', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    globalStateManager.args = { resourceName: 'myLambda', filter: 'ERROR' };

    const { commandLogs } = await import('./index');
    await commandLogs();

    expect(awsSdkManager.getLogEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        filterPattern: 'ERROR'
      })
    );
  });

  test('should display message when no log streams found', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { printer } = await import('@utils/printer');
    (awsSdkManager.getLogStreams as any).mockImplementation(async () => []);

    const { commandLogs } = await import('./index');
    await commandLogs();

    expect(printer.info).toHaveBeenCalledWith(
      expect.stringContaining('No log streams found')
    );
  });

  test('should pass container name to log group resolver', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { getLogGroupInfoForStacktapeResource } = await import('../_utils/logs');
    globalStateManager.args = { resourceName: 'myWebService', container: 'nginx' };

    const { commandLogs } = await import('./index');
    await commandLogs();

    expect(getLogGroupInfoForStacktapeResource).toHaveBeenCalledWith({
      resourceName: 'myWebService',
      containerName: 'nginx'
    });
  });

  test('should fetch logs from all log streams', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');

    const { commandLogs } = await import('./index');
    await commandLogs();

    expect(awsSdkManager.getLogEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        logStreamNames: ['stream1', 'stream2']
      })
    );
  });

  test('should return null', async () => {
    const { commandLogs } = await import('./index');
    const result = await commandLogs();

    expect(result).toBe(null);
  });
});
