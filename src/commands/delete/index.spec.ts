import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/application-manager', () => ({
  applicationManager: {
    handleExitSignal: mock(async () => {})
  }
}));

mock.module('@application-services/event-manager', () => ({
  eventManager: {
    registerHooks: mock(async () => {}),
    processHooks: mock(async () => {})
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    targetStack: {
      stackName: 'test-project-dev'
    }
  }
}));

mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: {
    existingStackDetails: {
      EnableTerminationProtection: false
    },
    deleteStack: mock(async () => {})
  }
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: {
    config: {
      serviceName: 'test-service'
    },
    hooks: [],
    loadGlobalConfig: mock(async () => {})
  }
}));

mock.module('@domain-services/deployment-artifact-manager', () => ({
  deploymentArtifactManager: {
    deleteAllArtifacts: mock(async () => {})
  }
}));

mock.module('@domain-services/notification-manager', () => ({
  notificationManager: {
    init: mock(async () => {}),
    sendDeploymentNotification: mock(async () => {})
  }
}));

mock.module('@domain-services/template-manager', () => ({
  templateManager: {
    getOldTemplateDiff: mock(() => ({ differenceCount: 0 }))
  }
}));

mock.module('@utils/errors', () => ({
  ExpectedError: class ExpectedError extends Error {
    constructor(public type: string, ...messages: string[]) {
      super(messages.join('\n'));
      this.name = 'ExpectedError';
    }
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    colorize: mock((color: string, text: string) => text),
    success: mock(() => {})
  }
}));

mock.module('../_utils/common', () => ({
  potentiallyPromptBeforeOperation: mock(async () => ({ abort: false }))
}));

mock.module('../_utils/initialization', () => ({
  initializeStackServicesForWorkingWithDeployedStack: mock(async () => {})
}));

describe('delete command', () => {
  test('should delete stack successfully', async () => {
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    const { deploymentArtifactManager } = await import('@domain-services/deployment-artifact-manager');
    const { notificationManager } = await import('@domain-services/notification-manager');
    const { printer } = await import('@utils/printer');

    const { commandDelete } = await import('./index');
    await commandDelete();

    expect(stackManager.deleteStack).toHaveBeenCalled();
    expect(deploymentArtifactManager.deleteAllArtifacts).toHaveBeenCalled();
    expect(notificationManager.sendDeploymentNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ type: 'success' })
      })
    );
    expect(printer.success).toHaveBeenCalledWith(
      expect.stringContaining('Successfully deleted stack')
    );
  });

  test('should abort deletion when user cancels prompt', async () => {
    const { potentiallyPromptBeforeOperation } = await import('../_utils/common');
    const { applicationManager } = await import('@application-services/application-manager');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    (potentiallyPromptBeforeOperation as any).mockImplementation(async () => ({ abort: true }));

    const { commandDelete } = await import('./index');
    await commandDelete();

    expect(applicationManager.handleExitSignal).toHaveBeenCalledWith('SIGINT');
    expect(stackManager.deleteStack).not.toHaveBeenCalled();
  });

  test('should throw error when termination protection is enabled', async () => {
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    stackManager.existingStackDetails = {
      EnableTerminationProtection: true
    };

    const { commandDelete } = await import('./index');

    await expect(commandDelete()).rejects.toThrow('Unable to delete stack');
  });

  test('should process hooks when config is available', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    const { eventManager } = await import('@application-services/event-manager');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    stackManager.existingStackDetails = { EnableTerminationProtection: false };
    configManager.config = { serviceName: 'test-service' };
    configManager.hooks = [{ type: 'pre-deploy', script: 'test-script' }];

    const { commandDelete } = await import('./index');
    await commandDelete();

    expect(eventManager.registerHooks).toHaveBeenCalledWith(configManager.hooks);
    expect(eventManager.processHooks).toHaveBeenCalledWith({ captureType: 'START' });
  });

  test('should not process hooks when config is not available', async () => {
    const { configManager } = await import('@domain-services/config-manager');
    const { eventManager } = await import('@application-services/event-manager');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    stackManager.existingStackDetails = { EnableTerminationProtection: false };
    configManager.config = null;

    (eventManager.registerHooks as any).mock.calls = [];
    (eventManager.processHooks as any).mock.calls = [];

    const { commandDelete } = await import('./index');
    await commandDelete();

    expect(eventManager.registerHooks).not.toHaveBeenCalled();
    expect(eventManager.processHooks).not.toHaveBeenCalled();
  });

  test('should delete artifacts before deleting stack', async () => {
    const { deploymentArtifactManager } = await import('@domain-services/deployment-artifact-manager');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    stackManager.existingStackDetails = { EnableTerminationProtection: false };

    const { commandDelete } = await import('./index');
    await commandDelete();

    expect(deploymentArtifactManager.deleteAllArtifacts).toHaveBeenCalled();
    expect(stackManager.deleteStack).toHaveBeenCalled();
  });

  test('should send progress notification before deletion', async () => {
    const { notificationManager } = await import('@domain-services/notification-manager');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    stackManager.existingStackDetails = { EnableTerminationProtection: false };

    const { commandDelete } = await import('./index');
    await commandDelete();

    expect(notificationManager.sendDeploymentNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'progress',
          text: expect.stringContaining('Deleting stack')
        })
      })
    );
  });
});
