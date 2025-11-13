import { describe, expect, mock, test } from 'bun:test';
import { StackStatus } from '@aws-sdk/client-cloudformation';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {
      detailed: false,
      outFormat: 'json',
      showSensitiveValues: false
    },
    invokedFrom: 'cli',
    targetStack: {
      stackName: 'test-project-dev'
    },
    targetAwsAccount: {
      name: 'test-account'
    },
    organizationData: {
      name: 'test-org'
    },
    command: 'stack:info'
  }
}));

mock.module('@domain-services/budget-manager', () => ({
  budgetManager: {
    init: mock(async () => {})
  }
}));

mock.module('@domain-services/calculated-stack-overview-manager', () => ({
  calculatedStackOverviewManager: {
    init: mock(() => {}),
    stackInfoMap: {}
  }
}));

mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: {
    existingStackDetails: {
      StackStatus: StackStatus.CREATE_COMPLETE
    }
  }
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: {
    config: {
      serviceName: 'test-service'
    }
  }
}));

mock.module('@domain-services/deployed-stack-overview-manager', () => ({
  deployedStackOverviewManager: {
    stackInfoMap: {
      resources: {
        myApi: {
          resourceType: 'http-api-gateway',
          referencableParams: {
            url: { value: 'https://api.example.com' }
          }
        }
      }
    },
    printEntireStackInfo: mock(() => {})
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e30: mock(() => new Error('Stack not found')),
    e31: mock(() => new Error('Stack info map not available'))
  }
}));

mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: {
    stackInfoCommandOutFile: mock(() => 'stack-info.json'),
    stackInfoPath: mock(() => 'stack-info.json')
  }
}));

mock.module('@utils/file-loaders', () => ({
  getIsConfigPotentiallyUsable: mock(() => true)
}));

mock.module('@utils/printer', () => ({
  printer: {
    warn: mock(() => {})
  }
}));

mock.module('@utils/stack-info-map-diff', () => ({
  getDetailedStackInfoMap: mock(() => ({
    resources: {
      myApi: {
        url: 'https://api.example.com'
      }
    }
  }))
}));

mock.module('../_utils/common', () => ({
  saveDetailedStackInfoMap: mock(async () => {})
}));

mock.module('../_utils/initialization', () => ({
  initializeStackServicesForWorkingWithDeployedStack: mock(async () => {}),
  initializeAllStackServices: mock(async () => {})
}));

mock.module('../deploy', () => ({
  prepareArtifactsForStackDeployment: mock(async () => ({
    cfTemplateDiff: { differenceCount: 5 }
  }))
}));

describe('stack-info command', () => {
  test('should display simple stack info', async () => {
    const { initializeStackServicesForWorkingWithDeployedStack } = await import('../_utils/initialization');
    const { budgetManager } = await import('@domain-services/budget-manager');
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    const { getDetailedStackInfoMap } = await import('@utils/stack-info-map-diff');

    const { commandStackInfo } = await import('./index');
    const result = await commandStackInfo();

    expect(initializeStackServicesForWorkingWithDeployedStack).toHaveBeenCalledWith({
      commandModifiesStack: false,
      commandRequiresConfig: false
    });
    expect(budgetManager.init).toHaveBeenCalled();
    expect(deployedStackOverviewManager.printEntireStackInfo).toHaveBeenCalled();
    expect(result).toHaveProperty('resources');
  });

  test('should throw error when stack does not exist', async () => {
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    stackManager.existingStackDetails = null;

    const { commandStackInfo } = await import('./index');

    await expect(commandStackInfo()).rejects.toThrow('Stack not found');
  });

  test('should throw error when stack info map is not available', async () => {
    const { deployedStackOverviewManager } = await import('@domain-services/deployed-stack-overview-manager');
    deployedStackOverviewManager.stackInfoMap = null;

    const { commandStackInfo } = await import('./index');

    await expect(commandStackInfo()).rejects.toThrow('Stack info map not available');
  });

  test('should warn when stack is in UPDATE_FAILED state', async () => {
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    const { printer } = await import('@utils/printer');
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = { detailed: true };
    stackManager.existingStackDetails = {
      StackStatus: StackStatus.UPDATE_FAILED
    };

    const { commandStackInfo } = await import('./index');
    await commandStackInfo();

    expect(printer.warn).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE_FAILED')
    );
  });

  test('should get detailed stack info when detailed flag is set', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { initializeAllStackServices } = await import('../_utils/initialization');
    const { prepareArtifactsForStackDeployment } = await import('../deploy');
    globalStateManager.args = { detailed: true };

    const { commandStackInfo } = await import('./index');
    await commandStackInfo();

    expect(initializeAllStackServices).toHaveBeenCalledWith({
      commandRequiresDeployedStack: false,
      commandModifiesStack: false,
      loadGlobalConfig: true,
      requiresSubscription: true
    });
    expect(prepareArtifactsForStackDeployment).toHaveBeenCalled();
  });

  test('should save detailed stack info to file when detailed and CLI', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { saveDetailedStackInfoMap } = await import('../_utils/common');
    globalStateManager.args = { detailed: true, outFormat: 'yml' };
    globalStateManager.invokedFrom = 'cli';

    const { commandStackInfo } = await import('./index');
    await commandStackInfo();

    expect(saveDetailedStackInfoMap).toHaveBeenCalledWith(
      expect.objectContaining({
        detailedStackInfo: expect.any(Object),
        outFormat: 'yml'
      })
    );
  });

  test('should not save file when invoked from SDK', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { saveDetailedStackInfoMap } = await import('../_utils/common');
    globalStateManager.args = { detailed: true };
    globalStateManager.invokedFrom = 'sdk';

    (saveDetailedStackInfoMap as any).mock.calls = [];

    const { commandStackInfo } = await import('./index');
    await commandStackInfo();

    expect(saveDetailedStackInfoMap).not.toHaveBeenCalled();
  });

  test('should show sensitive values when requested', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { getDetailedStackInfoMap } = await import('@utils/stack-info-map-diff');
    globalStateManager.args = { detailed: true, showSensitiveValues: true };

    const { commandStackInfo } = await import('./index');
    await commandStackInfo();

    expect(getDetailedStackInfoMap).toHaveBeenCalledWith(
      expect.objectContaining({
        showSensitiveValues: true
      })
    );
  });

  test('should show sensitive values when invoked from SDK', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { getDetailedStackInfoMap } = await import('@utils/stack-info-map-diff');
    globalStateManager.args = { detailed: true, showSensitiveValues: false };
    globalStateManager.invokedFrom = 'sdk';

    const { commandStackInfo } = await import('./index');
    await commandStackInfo();

    expect(getDetailedStackInfoMap).toHaveBeenCalledWith(
      expect.objectContaining({
        showSensitiveValues: true
      })
    );
  });

  test('should skip detailed processing when config is not usable', async () => {
    const { getIsConfigPotentiallyUsable } = await import('@utils/file-loaders');
    const { initializeAllStackServices } = await import('../_utils/initialization');
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.args = { detailed: true };
    (getIsConfigPotentiallyUsable as any).mockImplementation(() => false);

    (initializeAllStackServices as any).mock.calls = [];

    const { commandStackInfo } = await import('./index');
    await commandStackInfo();

    expect(initializeAllStackServices).not.toHaveBeenCalled();
  });
});
