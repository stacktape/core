import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {
      resourceName: 'myDeploymentScript'
    }
  }
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: {
    deploymentScripts: [
      {
        name: 'myDeploymentScript',
        type: 'deployment-script',
        parameters: {
          param1: 'value1'
        }
      }
    ],
    findResourceInConfig: mock(({ nameChain }) => ({
      resource: {
        name: nameChain,
        type: 'deployment-script'
      }
    })),
    resolveDirectives: mock(async ({ itemToResolve }) => itemToResolve)
  }
}));

mock.module('@domain-services/deployed-stack-overview-manager', () => ({
  deployedStackOverviewManager: {
    getStpResource: mock(() => ({
      resourceType: 'deployment-script'
    }))
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e5: mock(({ resourceName, resourceType }) =>
      new Error(`Resource "${resourceName}" of type "${resourceType}" not found in config`)
    ),
    e6: mock(({ resourceName, resourceType }) =>
      new Error(`Resource "${resourceName}" of type "${resourceType}" not found in deployed stack`)
    )
  }
}));

mock.module('@shared/naming/tag-names', () => ({
  tagNames: {
    hotSwapDeploy: mock(() => 'stp-hotswap-deploy')
  }
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    tagLambdaFunction: mock(async () => {}),
    invokeLambdaFunction: mock(async () => ({
      FunctionError: undefined,
      Payload: JSON.stringify({ success: true, result: 'completed' })
    }))
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    info: mock(() => {}),
    success: mock(() => {}),
    colorize: mock((color: string, text: string) => text)
  }
}));

mock.module('../_utils/fn-deployment', () => ({
  buildAndUpdateFunctionCode: mock(async (resourceName) => ({
    lambdaArn: `arn:aws:lambda:us-east-1:123456789012:function:${resourceName}`
  }))
}));

mock.module('../_utils/initialization', () => ({
  initializeStackServicesForHotSwapDeploy: mock(async () => {})
}));

describe('deployment-script-run command', () => {
  test('should run deployment script successfully', async () => {
    const { initializeStackServicesForHotSwapDeploy } = await import('../_utils/initialization');
    const { buildAndUpdateFunctionCode } = await import('../_utils/fn-deployment');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { printer } = await import('@utils/printer');

    const { commandDeploymentScriptRun } = await import('./index');
    const result = await commandDeploymentScriptRun();

    expect(initializeStackServicesForHotSwapDeploy).toHaveBeenCalled();
    expect(buildAndUpdateFunctionCode).toHaveBeenCalledWith('myDeploymentScript');
    expect(awsSdkManager.tagLambdaFunction).toHaveBeenCalled();
    expect(awsSdkManager.invokeLambdaFunction).toHaveBeenCalled();
    expect(printer.success).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  test('should tag lambda function with hotswap tag', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { buildAndUpdateFunctionCode } = await import('../_utils/fn-deployment');

    const { commandDeploymentScriptRun } = await import('./index');
    await commandDeploymentScriptRun();

    expect(awsSdkManager.tagLambdaFunction).toHaveBeenCalledWith({
      lambdaArn: 'arn:aws:lambda:us-east-1:123456789012:function:myDeploymentScript',
      tags: [{ key: 'stp-hotswap-deploy', value: 'true' }]
    });
  });

  test('should handle script failure', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { printer } = await import('@utils/printer');
    (awsSdkManager.invokeLambdaFunction as any).mockImplementation(async () => ({
      FunctionError: 'Unhandled',
      Payload: JSON.stringify({ errorMessage: 'Script failed' })
    }));

    const { commandDeploymentScriptRun } = await import('./index');
    const result = await commandDeploymentScriptRun();

    expect(result.success).toBe(false);
    expect(printer.info).toHaveBeenCalledWith(
      expect.stringContaining('FAILED')
    );
  });

  test('should throw error when resource not found in config', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    (configManager.findResourceInConfig as any).mockImplementation(() => ({
      resource: null
    }));

    const { commandDeploymentScriptRun } = await import('./index');

    await expect(commandDeploymentScriptRun()).rejects.toThrow('not found in config');
  });

  test('should throw error when resource not found in deployed stack', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.getStpResource as any).mockImplementation(() => null);

    const { commandDeploymentScriptRun } = await import('./index');

    await expect(commandDeploymentScriptRun()).rejects.toThrow('not found in deployed stack');
  });

  test('should resolve script parameters', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');

    const { commandDeploymentScriptRun } = await import('./index');
    await commandDeploymentScriptRun();

    expect(configManager.resolveDirectives).toHaveBeenCalledWith(
      expect.objectContaining({
        itemToResolve: expect.objectContaining({ param1: 'value1' }),
        resolveRuntime: true,
        useLocalResolve: true
      })
    );
    expect(awsSdkManager.invokeLambdaFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ param1: 'value1' })
      })
    );
  });

  test('should return payload and success status', async () => {
    const { commandDeploymentScriptRun } = await import('./index');
    const result = await commandDeploymentScriptRun();

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('returnedPayload');
    expect(result.success).toBe(true);
  });

  test('should print formatted JSON response', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { printer } = await import('@utils/printer');
    (awsSdkManager.invokeLambdaFunction as any).mockImplementation(async () => ({
      FunctionError: undefined,
      Payload: JSON.stringify({ data: { nested: 'value' } })
    }));

    const { commandDeploymentScriptRun } = await import('./index');
    await commandDeploymentScriptRun();

    expect(printer.success).toHaveBeenCalledWith(
      expect.stringContaining('finished successfully')
    );
  });
});
