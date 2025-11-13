import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

// Mock all dependencies
mock.module('@application-services/application-manager', () => ({
  applicationManager: {
    handleExitSignal: mock(async () => {})
  }
}));

mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mock(async () => {}),
    finishEvent: mock(async () => {}),
    updateEvent: mock(async () => {}),
    addFinalAction: mock()
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    targetStack: { stackName: 'test-project-dev', projectName: 'test-project', stage: 'dev' },
    invokedFrom: 'cli',
    args: { hotSwap: false, showSensitiveValues: false }
  }
}));

mock.module('@application-services/stacktape-trpc-api-manager', () => ({
  stacktapeTrpcApiManager: {
    deleteUndeployedStage: mock(async () => {})
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
    resolveAllResources: mock(async () => {}),
    populateStackMetadata: mock(async () => {})
  }
}));

mock.module('@domain-services/cloudformation-registry-manager', () => ({
  cloudformationRegistryManager: {
    registerLatestCfPrivateTypes: mock(async () => {})
  }
}));

mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: {
    stackActionType: 'update',
    isAutoRollbackEnabled: true,
    deployStack: mock(async () => ({ warningMessages: [] })),
    createResourcesForArtifacts: mock(async () => {}),
    refetchStackDetails: mock(async () => {}),
    existingStackDetails: { StackStatus: 'UPDATE_COMPLETE' },
    existingStackResources: []
  }
}));

mock.module('@domain-services/cloudfront-manager', () => ({
  cloudfrontManager: {
    invalidateCaches: mock(async () => {})
  }
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: {
    allBucketsToSync: [],
    allResourcesWithCdnsToInvalidate: [],
    allContainerWorkloads: [],
    allLambdasEligibleForHotswap: [],
    requiredCloudformationPrivateTypes: [],
    guardrails: {},
    stackInfoDirPath: '/test/stack-info',
    invalidatePotentiallyChangedDirectiveResults: mock()
  }
}));

mock.module('@domain-services/config-manager/utils/validation', () => ({
  validateGuardrails: mock()
}));

mock.module('@domain-services/deployed-stack-overview-manager', () => ({
  deployedStackOverviewManager: {
    analyzeCloudformationTemplateDiff: mock(() => ({
      isHotswapPossible: false,
      hotSwappableWorkloadsWhoseCodeWillBeUpdatedByCloudformation: []
    })),
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

mock.module('@domain-services/deployment-artifact-manager', () => ({
  deploymentArtifactManager: {
    uploadAllArtifacts: mock(async () => {}),
    syncBuckets: mock(async () => {}),
    deleteArtifactsRollbackedDeploy: mock(async () => {}),
    deleteArtifactsFixedDeploy: mock(async () => {}),
    deleteAllObsoleteArtifacts: mock(async () => {}),
    cloudformationTemplateUrl: 'https://s3.amazonaws.com/bucket/template.json'
  }
}));

mock.module('@domain-services/notification-manager', () => ({
  notificationManager: {
    sendDeploymentNotification: mock(async () => {})
  }
}));

mock.module('@domain-services/packaging-manager', () => ({
  packagingManager: {
    packageAllWorkloads: mock(async () => [
      { resourceName: 'myFunction', packagedPath: '/path/to/package' }
    ]),
    repackageSkippedPackagingJobsCurrentlyUsingHotSwapDeploy: mock(async () => {})
  }
}));

mock.module('@domain-services/template-manager', () => ({
  templateManager: {
    prepareForDeploy: mock(async () => {}),
    getOldTemplateDiff: mock(() => ({ differenceCount: 5 }))
  }
}));

mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: {
    stackInfoPath: mock(() => '/test/stack-info/test-project-dev.json')
  }
}));

mock.module('@shared/naming/utils', () => ({
  obfuscatedNamesStateHolder: {
    usingObfuscateNames: false
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    warn: mock(),
    success: mock(),
    info: mock()
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

mock.module('../_utils/common', () => ({
  potentiallyPromptBeforeOperation: mock(async () => ({ abort: false })),
  saveDetailedStackInfoMap: mock(async () => {}),
  injectEnvironmentToHostedHtmlFiles: mock(async () => {}),
  writeEnvironmentDotenvFile: mock(async () => {})
}));

mock.module('../_utils/cw-deployment', () => ({
  getECSHotswapInformation: mock(async () => ({
    ecsTaskDefinition: { needsUpdate: false },
    ecsService: { needsUpdate: false }
  })),
  updateEcsService: mock(async () => {})
}));

mock.module('../_utils/fn-deployment', () => ({
  getLambdaFunctionHotswapInformation: mock(async () => ({ needsUpdate: false })),
  updateFunctionCode: mock(async () => {})
}));

mock.module('../_utils/initialization', () => ({
  initializeAllStackServices: mock(async () => {})
}));

describe('commandDeploy', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('should execute successful full deployment', async () => {
    const { commandDeploy } = await import('./index');
    const { initializeAllStackServices } = await import('../_utils/initialization');
    const { packagingManager } = await import('@domain-services/packaging-manager');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    const { deploymentArtifactManager } = await import('@domain-services/deployment-artifact-manager');

    const result = await commandDeploy();

    expect(initializeAllStackServices).toHaveBeenCalledWith({
      commandRequiresDeployedStack: false,
      commandModifiesStack: true,
      loadGlobalConfig: true,
      requiresSubscription: true
    });
    expect(packagingManager.packageAllWorkloads).toHaveBeenCalled();
    expect(deploymentArtifactManager.uploadAllArtifacts).toHaveBeenCalled();
    expect(stackManager.deployStack).toHaveBeenCalled();
    expect(result).toHaveProperty('stackInfo');
    expect(result).toHaveProperty('packagedWorkloads');
  });

  test('should abort when user cancels operation', async () => {
    const { potentiallyPromptBeforeOperation } = await import('../_utils/common');
    (potentiallyPromptBeforeOperation as any).mockImplementation(async () => ({ abort: true }));

    const { commandDeploy } = await import('./index');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    const { applicationManager } = await import('@application-services/application-manager');

    const result = await commandDeploy();

    expect(result).toBeUndefined();
    expect(stackManager.deployStack).not.toHaveBeenCalled();
    expect(applicationManager.handleExitSignal).toHaveBeenCalledWith('SIGINT');
  });

  test('should perform hotswap deployment when conditions are met', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args.hotSwap = true;

    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.analyzeCloudformationTemplateDiff as any).mockImplementation(() => ({
      isHotswapPossible: true,
      hotSwappableWorkloadsWhoseCodeWillBeUpdatedByCloudformation: []
    }));

    const { commandDeploy } = await import('./index');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    const { eventManager } = await import('@application-services/event-manager');

    await commandDeploy();

    expect(stackManager.deployStack).not.toHaveBeenCalled();
    expect(eventManager.startEvent).toHaveBeenCalledWith({
      eventType: 'HOTSWAP_UPDATE',
      description: 'Performing hotswap update'
    });
  });

  test('should fallback to full deploy when hotswap not possible', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args.hotSwap = true;

    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.analyzeCloudformationTemplateDiff as any).mockImplementation(() => ({
      isHotswapPossible: false,
      hotSwappableWorkloadsWhoseCodeWillBeUpdatedByCloudformation: []
    }));

    const { commandDeploy } = await import('./index');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    const { printer } = await import('@utils/printer');

    await commandDeploy();

    expect(printer.warn).toHaveBeenCalledWith(
      'Stack changes are not hot-swappable. Performing CloudFormation deployment.'
    );
    expect(stackManager.deployStack).toHaveBeenCalled();
  });

  test('should create stack resources when creating new stack', async () => {
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    stackManager.stackActionType = 'create';

    const { commandDeploy } = await import('./index');

    await commandDeploy();

    expect(stackManager.createResourcesForArtifacts).toHaveBeenCalled();
  });

  test('should sync buckets when configured', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    configManager.allBucketsToSync = [{ resourceName: 'myBucket' }] as any;

    const { commandDeploy } = await import('./index');
    const { deploymentArtifactManager } = await import('@domain-services/deployment-artifact-manager');
    const { injectEnvironmentToHostedHtmlFiles, writeEnvironmentDotenvFile } = await import('../_utils/common');

    await commandDeploy();

    expect(injectEnvironmentToHostedHtmlFiles).toHaveBeenCalled();
    expect(deploymentArtifactManager.syncBuckets).toHaveBeenCalled();
    expect(writeEnvironmentDotenvFile).toHaveBeenCalled();
  });

  test('should invalidate CDN caches when configured', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    configManager.allResourcesWithCdnsToInvalidate = [{ resourceName: 'myCdn' }] as any;

    const { commandDeploy } = await import('./index');
    const { cloudfrontManager } = await import('@domain-services/cloudfront-manager');

    await commandDeploy();

    expect(cloudfrontManager.invalidateCaches).toHaveBeenCalled();
  });

  test('should handle deployment warnings', async () => {
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    (stackManager.deployStack as any).mockImplementation(async () => ({
      warningMessages: ['Warning: Resource limit approaching', 'Warning: Using default settings']
    }));

    const { commandDeploy } = await import('./index');
    const { printer } = await import('@utils/printer');

    await commandDeploy();

    expect(printer.warn).toHaveBeenCalledWith('Warning: Resource limit approaching');
    expect(printer.warn).toHaveBeenCalledWith('Warning: Using default settings');
  });

  test('should cleanup artifacts on failed deployment with auto-rollback', async () => {
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    (stackManager.deployStack as any).mockImplementation(async () => {
      throw Object.assign(new Error('Deployment failed'), { type: 'CLOUDFORMATION' });
    });

    const { commandDeploy } = await import('./index');
    const { deploymentArtifactManager } = await import('@domain-services/deployment-artifact-manager');

    await expect(commandDeploy()).rejects.toThrow('Deployment failed');
    expect(deploymentArtifactManager.deleteArtifactsRollbackedDeploy).toHaveBeenCalled();
  });

  test('should not cleanup artifacts on monitoring failure', async () => {
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    (stackManager.deployStack as any).mockImplementation(async () => {
      throw Object.assign(new Error('Monitoring failed'), { type: 'STACK_MONITORING' });
    });

    const { commandDeploy } = await import('./index');
    const { deploymentArtifactManager } = await import('@domain-services/deployment-artifact-manager');

    await expect(commandDeploy()).rejects.toThrow('Monitoring failed');
    expect(deploymentArtifactManager.deleteArtifactsRollbackedDeploy).not.toHaveBeenCalled();
  });

  test('should cleanup artifacts from fixed UPDATE_FAILED stack', async () => {
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    stackManager.existingStackDetails = { StackStatus: 'UPDATE_FAILED' } as any;

    const { commandDeploy } = await import('./index');
    const { deploymentArtifactManager } = await import('@domain-services/deployment-artifact-manager');

    await commandDeploy();

    expect(deploymentArtifactManager.deleteArtifactsFixedDeploy).toHaveBeenCalled();
    expect(deploymentArtifactManager.deleteAllObsoleteArtifacts).toHaveBeenCalled();
  });

  test('should register CloudFormation private types', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    configManager.requiredCloudformationPrivateTypes = ['AWS::Custom::Type1'] as any;

    const { commandDeploy } = await import('./index');
    const { cloudformationRegistryManager } = await import('@domain-services/cloudformation-registry-manager');

    await commandDeploy();

    expect(cloudformationRegistryManager.registerLatestCfPrivateTypes).toHaveBeenCalledWith(['AWS::Custom::Type1']);
  });

  test('should send deployment notifications', async () => {
    const { commandDeploy } = await import('./index');
    const { notificationManager } = await import('@domain-services/notification-manager');

    await commandDeploy();

    expect(notificationManager.sendDeploymentNotification).toHaveBeenCalledWith({
      message: {
        text: 'Deploying stack test-project-dev.',
        type: 'progress'
      }
    });
    expect(notificationManager.sendDeploymentNotification).toHaveBeenCalledWith({
      message: {
        text: 'Stack test-project-dev deployed successfully.',
        type: 'success'
      }
    });
  });

  test('should validate guardrails before deployment', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    configManager.guardrails = { maxCost: 100 } as any;

    const { commandDeploy } = await import('./index');
    const { validateGuardrails } = await import('@domain-services/config-manager/utils/validation');

    await commandDeploy();

    expect(validateGuardrails).toHaveBeenCalledWith({ maxCost: 100 });
  });

  test('should save stack info to configured directory', async () => {
    const { commandDeploy } = await import('./index');
    const { saveDetailedStackInfoMap } = await import('../_utils/common');

    await commandDeploy();

    expect(saveDetailedStackInfoMap).toHaveBeenCalled();
  });

  test('should print stack info when invoked from CLI', async () => {
    const { commandDeploy } = await import('./index');
    const { eventManager } = await import('@application-services/event-manager');

    await commandDeploy();

    expect(eventManager.addFinalAction).toHaveBeenCalled();
  });

  test('should warn when using obfuscated names', async () => {
    const { obfuscatedNamesStateHolder } = await import('@shared/naming/utils');
    obfuscatedNamesStateHolder.usingObfuscateNames = true;

    const { commandDeploy } = await import('./index');
    const { printer } = await import('@utils/printer');

    await commandDeploy();

    expect(printer.warn).toHaveBeenCalledWith(
      expect.stringContaining('obfuscated names')
    );
  });

  test('should update Lambda functions during hotswap', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args.hotSwap = true;

    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.analyzeCloudformationTemplateDiff as any).mockImplementation(() => ({
      isHotswapPossible: true,
      hotSwappableWorkloadsWhoseCodeWillBeUpdatedByCloudformation: []
    }));

    const { configManager } = await import('@domain-services/config-manager');
    configManager.allLambdasEligibleForHotswap = [{ resourceName: 'myFunction' }] as any;

    const { getLambdaFunctionHotswapInformation, updateFunctionCode } = await import('../_utils/fn-deployment');
    (getLambdaFunctionHotswapInformation as any).mockImplementation(async () => ({ needsUpdate: true }));

    const { commandDeploy } = await import('./index');

    await commandDeploy();

    expect(updateFunctionCode).toHaveBeenCalled();
  });

  test('should update ECS services during hotswap', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args.hotSwap = true;

    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    (deployedStackOverviewManager.analyzeCloudformationTemplateDiff as any).mockImplementation(() => ({
      isHotswapPossible: true,
      hotSwappableWorkloadsWhoseCodeWillBeUpdatedByCloudformation: []
    }));

    const { configManager } = await import('@domain-services/config-manager');
    configManager.allContainerWorkloads = [{ resourceName: 'myService' }] as any;

    const { getECSHotswapInformation, updateEcsService } = await import('../_utils/cw-deployment');
    (getECSHotswapInformation as any).mockImplementation(async () => ({
      ecsTaskDefinition: { needsUpdate: true },
      ecsService: { needsUpdate: false }
    }));

    const { commandDeploy } = await import('./index');

    await commandDeploy();

    expect(updateEcsService).toHaveBeenCalled();
  });
});
