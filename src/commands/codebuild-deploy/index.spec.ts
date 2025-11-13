import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

// Mock all dependencies
mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mock(),
    finishEvent: mock(),
    addFinalAction: mock()
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    targetAwsAccount: { awsAccountId: '123456789012' },
    invocationId: 'test-invocation-id',
    workingDir: '/test/working/dir',
    rawArgs: { stage: 'dev', projectName: 'test-project' },
    configPath: '/test/working/dir/stacktape.yml',
    targetStack: { stackName: 'test-project-dev', projectName: 'test-project', stage: 'dev' },
    userData: { id: 'user-123' },
    apiKey: 'test-api-key',
    systemId: 'system-123',
    invokedFrom: 'cli',
    args: { showSensitiveValues: false }
  }
}));

mock.module('@application-services/stacktape-trpc-api-manager', () => ({
  stacktapeTrpcApiManager: {
    recordStackOperationProgress: mock(async () => {}),
    recordStackOperationEnd: mock(async () => {})
  }
}));

mock.module('@domain-services/budget-manager', () => ({
  budgetManager: {
    loadBudgets: mock(async () => {}),
    getBudgetInfoForSpecifiedStack: mock(() => ({}))
  }
}));

mock.module('@domain-services/calculated-stack-overview-manager', () => ({
  calculatedStackOverviewManager: {
    resolveAllResources: mock(async () => {})
  }
}));

mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: {
    refetchStackDetails: mock(async () => {}),
    existingStackDetails: { StackStatus: 'UPDATE_COMPLETE' },
    existingStackResources: []
  }
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: {
    isS3TransferAccelerationAvailableInDeploymentRegion: true,
    stackInfoDirPath: '/test/stack-info'
  }
}));

mock.module('@domain-services/deployed-stack-overview-manager', () => ({
  deployedStackOverviewManager: {
    refreshStackInfoMap: mock(async () => {}),
    printShortStackInfo: mock(),
    stackInfoMap: {
      'test-resource': {
        resourceName: 'test-resource',
        resourceType: 'function',
        outputs: { url: 'https://example.com' }
      }
    }
  }
}));

mock.module('@domain-services/template-manager', () => ({
  templateManager: {
    getOldTemplateDiff: mock(() => ({ differenceCount: 5 }))
  }
}));

mock.module('@shared/aws/codebuild', () => ({
  preparePipelineResources: mock(async () => ({
    bucketName: 'test-codebuild-bucket',
    projectName: 'test-codebuild-project'
  })),
  startCodebuildDeployment: mock(async ({ callbackAfterBuildStart }) => {
    const buildInfo = {
      id: 'build-123',
      arn: 'arn:aws:codebuild:us-east-1:123456789012:build/test-project:build-123',
      logs: {
        groupName: '/aws/codebuild/test-project',
        streamName: 'build-123'
      }
    };
    await callbackAfterBuildStart(buildInfo);
    return buildInfo;
  }),
  getCodebuildLogStreamNameFromBuildInfo: mock(() => 'build-123')
}));

mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: {
    absoluteTempFolderPath: mock(() => '/tmp/test-invocation'),
    stackInfoPath: mock(() => '/test/stack-info/test-project-dev.json')
  }
}));

mock.module('@shared/utils/fs-utils', () => ({
  getPathRelativeTo: mock((path: string) => 'stacktape.yml')
}));

mock.module('@shared/utils/misc', () => ({
  serialize: mock((obj: any) => ({ ...obj })),
  wait: mock(async () => {})
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    uploadToBucket: mock(async () => {}),
    getCodebuildDeployment: mock(async () => ({
      id: 'build-123',
      arn: 'arn:aws:codebuild:us-east-1:123456789012:build/test-project:build-123',
      buildStatus: 'SUCCEEDED',
      logs: {
        groupName: '/aws/codebuild/test-project',
        streamName: 'build-123'
      }
    }))
  }
}));

mock.module('@utils/cloudwatch-logs', () => ({
  CodebuildDeploymentCloudwatchLogPrinter: mock(
    class {
      printLogs = mock(async () => {});
    }
  )
}));

mock.module('@utils/git', () => ({
  gitCreateZipArchive: mock(async () => {})
}));

mock.module('@utils/git-info-manager', () => ({
  gitInfoManager: {
    gitInfo: Promise.resolve({
      branch: 'main',
      commitHash: 'abc123',
      isGitRepo: true
    })
  }
}));

mock.module('@utils/stack-info-map-diff', () => ({
  getDetailedStackInfoMap: mock(() => ({
    'test-resource': {
      resourceName: 'test-resource',
      resourceType: 'function',
      outputs: { url: 'https://example.com' }
    }
  }))
}));

mock.module('@utils/temp-files', () => ({
  ensureTempFolder: mock(async () => {})
}));

mock.module('@utils/time', () => ({
  getAwsSynchronizedTime: mock(async () => new Date('2023-01-01T12:00:00Z'))
}));

mock.module('@utils/versioning', () => ({
  getStacktapeVersion: mock(() => '2.5.0')
}));

mock.module('../_utils/common', () => ({
  potentiallyPromptBeforeOperation: mock(async () => ({ abort: false })),
  saveDetailedStackInfoMap: mock(async () => {})
}));

mock.module('../_utils/initialization', () => ({
  initializeAllStackServices: mock(async () => {})
}));

mock.module('@config', () => ({
  STACKTAPE_TRPC_API_ENDPOINT: 'https://api.stacktape.com'
}));

mock.module('@errors', () => ({
  stpErrors: {
    e64: mock(() => new Error('Codebuild deployment failed'))
  }
}));

describe('commandCodebuildDeploy', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('should execute successful codebuild deployment', async () => {
    const { commandCodebuildDeploy } = await import('./index');
    const { initializeAllStackServices } = await import('../_utils/initialization');
    const { preparePipelineResources, startCodebuildDeployment } = await import('@shared/aws/codebuild');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { gitCreateZipArchive } = await import('@utils/git');

    const result = await commandCodebuildDeploy();

    expect(initializeAllStackServices).toHaveBeenCalledWith({
      commandRequiresDeployedStack: false,
      commandModifiesStack: true,
      requiresSubscription: true
    });
    expect(preparePipelineResources).toHaveBeenCalled();
    expect(gitCreateZipArchive).toHaveBeenCalled();
    expect(awsSdkManager.uploadToBucket).toHaveBeenCalled();
    expect(startCodebuildDeployment).toHaveBeenCalled();
    expect(awsSdkManager.getCodebuildDeployment).toHaveBeenCalled();
    expect(result).toHaveProperty('stackInfo');
  });

  test('should abort when user cancels operation', async () => {
    const { potentiallyPromptBeforeOperation } = await import('../_utils/common');
    (potentiallyPromptBeforeOperation as any).mockImplementation(async () => ({ abort: true }));

    const { commandCodebuildDeploy } = await import('./index');
    const { startCodebuildDeployment } = await import('@shared/aws/codebuild');

    const result = await commandCodebuildDeploy();

    expect(result).toBeUndefined();
    expect(startCodebuildDeployment).not.toHaveBeenCalled();
  });

  test('should handle codebuild deployment failure', async () => {
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    (awsSdkManager.getCodebuildDeployment as any).mockImplementation(async () => ({
      id: 'build-123',
      buildStatus: 'FAILED',
      logs: { groupName: '/aws/codebuild/test', streamName: 'build-123' }
    }));

    const { commandCodebuildDeploy } = await import('./index');
    const { stpErrors } = await import('@errors');

    await expect(commandCodebuildDeploy()).rejects.toThrow();
    expect(stpErrors.e64).toHaveBeenCalled();
  });

  test('should record operation progress and callbacks', async () => {
    const { commandCodebuildDeploy } = await import('./index');
    const { stacktapeTrpcApiManager } = await import('@application-services/stacktape-trpc-api-manager');

    await commandCodebuildDeploy();

    expect(stacktapeTrpcApiManager.recordStackOperationProgress).toHaveBeenCalled();
  });

  test('should adjust CLI arguments for codebuild execution', async () => {
    const { commandCodebuildDeploy } = await import('./index');
    const { startCodebuildDeployment } = await import('@shared/aws/codebuild');

    await commandCodebuildDeploy();

    const callArgs = (startCodebuildDeployment as any).mock.calls[0][0];
    expect(callArgs.commandArgs).toHaveProperty('autoConfirmOperation', true);
    expect(callArgs.commandArgs).toHaveProperty('showSensitiveValues', false);
  });

  test('should use S3 transfer acceleration when available', async () => {
    const { commandCodebuildDeploy } = await import('./index');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');

    await commandCodebuildDeploy();

    const uploadCall = (awsSdkManager.uploadToBucket as any).mock.calls[0][0];
    expect(uploadCall.useS3Acceleration).toBe(true);
  });

  test('should save stack info to configured directory', async () => {
    const { commandCodebuildDeploy } = await import('./index');
    const { saveDetailedStackInfoMap } = await import('../_utils/common');

    await commandCodebuildDeploy();

    expect(saveDetailedStackInfoMap).toHaveBeenCalled();
  });

  test('should print stack info when invoked from CLI', async () => {
    const { commandCodebuildDeploy } = await import('./index');
    const { eventManager } = await import('@application-services/event-manager');

    await commandCodebuildDeploy();

    expect(eventManager.addFinalAction).toHaveBeenCalled();
  });

  test('should record operation end on error', async () => {
    const { calculatedStackOverviewManager } = await import('@domain-services/calculated-stack-overview-manager');
    (calculatedStackOverviewManager.resolveAllResources as any).mockImplementation(async () => {
      throw new Error('Resource resolution failed');
    });

    const { commandCodebuildDeploy } = await import('./index');
    const { stacktapeTrpcApiManager } = await import('@application-services/stacktape-trpc-api-manager');

    await expect(commandCodebuildDeploy()).rejects.toThrow('Resource resolution failed');
    expect(stacktapeTrpcApiManager.recordStackOperationEnd).toHaveBeenCalledWith({
      stackName: 'test-project-dev',
      error: expect.any(Error),
      success: false,
      interrupted: false
    });
  });
});
