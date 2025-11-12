import { describe, expect, mock, test, spyOn, beforeEach } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {
      resourceName: 'myApi',
      paramName: 'url'
    },
    targetStack: {
      stackName: 'test-project-dev'
    },
    invokedFrom: 'cli'
  }
}));

mock.module('@domain-services/deployed-stack-overview-manager', () => ({
  deployedStackOverviewManager: {
    stackInfoMap: {
      resources: {
        myApi: {
          resourceType: 'http-api-gateway',
          referencableParams: {
            url: {
              value: 'https://abc123.execute-api.us-east-1.amazonaws.com'
            },
            id: {
              value: 'abc123'
            }
          }
        },
        myBucket: {
          resourceType: 'bucket',
          referencableParams: {
            name: {
              value: 'my-bucket-name'
            }
          }
        }
      }
    }
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e77: mock(({ stackName, resourceName }) =>
      new Error(`Resource "${resourceName}" not found in stack "${stackName}"`)
    ),
    e78: mock(({ resourceName, resourceParamName, referenceableParams }) =>
      new Error(`Parameter "${resourceParamName}" not found on resource "${resourceName}". Available: ${referenceableParams.join(', ')}`)
    )
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    success: mock(() => {}),
    makeBold: mock((text: string) => `**${text}**`),
    prettyResourceName: mock((name: string) => name),
    prettyResourceParamName: mock((name: string) => name)
  }
}));

mock.module('../_utils/initialization', () => ({
  initializeStackServicesForWorkingWithDeployedStack: mock(async () => {})
}));

describe('param-get command', () => {
  let consoleInfoSpy: any;

  beforeEach(() => {
    consoleInfoSpy = spyOn(console, 'info').mockImplementation(() => {});
  });

  test('should retrieve parameter value from resource', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { initializeStackServicesForWorkingWithDeployedStack } = await import('../_utils/initialization');
    globalStateManager.args = {
      resourceName: 'myApi',
      paramName: 'url'
    };

    const { commandParamGet } = await import('./index');
    const result = await commandParamGet();

    expect(initializeStackServicesForWorkingWithDeployedStack).toHaveBeenCalledWith({
      commandModifiesStack: false,
      commandRequiresConfig: false
    });
    expect(result).toBe('https://abc123.execute-api.us-east-1.amazonaws.com');
  });

  test('should print parameter value when invoked from CLI', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { printer } = await import('@utils/printer');
    globalStateManager.invokedFrom = 'cli';
    globalStateManager.args = {
      resourceName: 'myApi',
      paramName: 'url'
    };

    const { commandParamGet } = await import('./index');
    await commandParamGet();

    expect(printer.success).toHaveBeenCalledWith(
      expect.stringContaining('Successfully retrieved parameter')
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://abc123.execute-api.us-east-1.amazonaws.com')
    );
  });

  test('should not print when invoked from SDK', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { printer } = await import('@utils/printer');
    globalStateManager.invokedFrom = 'sdk';
    globalStateManager.args = {
      resourceName: 'myApi',
      paramName: 'url'
    };

    (printer.success as any).mock.calls = [];
    consoleInfoSpy.mock.calls = [];

    const { commandParamGet } = await import('./index');
    const result = await commandParamGet();

    expect(result).toBe('https://abc123.execute-api.us-east-1.amazonaws.com');
    expect(printer.success).not.toHaveBeenCalled();
  });

  test('should throw error when resource does not exist', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = {
      resourceName: 'nonExistentResource',
      paramName: 'url'
    };

    const { commandParamGet } = await import('./index');

    await expect(commandParamGet()).rejects.toThrow('Resource "nonExistentResource" not found');
  });

  test('should throw error when parameter does not exist on resource', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = {
      resourceName: 'myApi',
      paramName: 'nonExistentParam'
    };

    const { commandParamGet } = await import('./index');

    await expect(commandParamGet()).rejects.toThrow(
      'Parameter "nonExistentParam" not found on resource "myApi"'
    );
  });

  test('should retrieve different parameters from different resources', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = {
      resourceName: 'myBucket',
      paramName: 'name'
    };

    const { commandParamGet } = await import('./index');
    const result = await commandParamGet();

    expect(result).toBe('my-bucket-name');
  });
});
