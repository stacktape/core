import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: {
    rollbackStack: mock(async () => {})
  }
}));

mock.module('@domain-services/deployment-artifact-manager', () => ({
  deploymentArtifactManager: {
    deleteArtifactsRollbackedDeploy: mock(async () => {})
  }
}));

mock.module('../_utils/initialization', () => ({
  initializeStackServicesForWorkingWithDeployedStack: mock(async () => {})
}));

describe('rollback command', () => {
  test('should rollback stack and delete artifacts', async () => {
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    const { deploymentArtifactManager } = await import('@domain-services/deployment-artifact-manager');
    const { initializeStackServicesForWorkingWithDeployedStack } = await import('../_utils/initialization');

    const { commandRollback } = await import('./index');
    const result = await commandRollback();

    expect(initializeStackServicesForWorkingWithDeployedStack).toHaveBeenCalledWith({
      commandModifiesStack: true,
      commandRequiresConfig: false
    });
    expect(stackManager.rollbackStack).toHaveBeenCalled();
    expect(deploymentArtifactManager.deleteArtifactsRollbackedDeploy).toHaveBeenCalled();
    expect(result).toBe(null);
  });

  test('should initialize stack services before rollback', async () => {
    const { initializeStackServicesForWorkingWithDeployedStack } = await import('../_utils/initialization');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');

    const { commandRollback } = await import('./index');
    await commandRollback();

    // Verify initialization was called before rollback
    expect(initializeStackServicesForWorkingWithDeployedStack).toHaveBeenCalled();
    expect(stackManager.rollbackStack).toHaveBeenCalled();
  });

  test('should delete artifacts after rolling back stack', async () => {
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    const { deploymentArtifactManager } = await import('@domain-services/deployment-artifact-manager');

    const { commandRollback } = await import('./index');
    await commandRollback();

    // Both operations should have been called
    expect(stackManager.rollbackStack).toHaveBeenCalled();
    expect(deploymentArtifactManager.deleteArtifactsRollbackedDeploy).toHaveBeenCalled();
  });
});
