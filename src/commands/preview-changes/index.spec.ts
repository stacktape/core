import { describe, expect, mock, test, spyOn, beforeEach } from 'bun:test';

// Mock dependencies
mock.module('@domain-services/calculated-stack-overview-manager', () => ({
  calculatedStackOverviewManager: {
    resolveAllResources: mock(async () => {}),
    populateStackMetadata: mock(async () => {})
  }
}));

mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: {
    validateTemplate: mock(async () => {}),
    getChangeSet: mock(async () => ({
      changes: [
        {
          Type: 'Resource',
          ResourceChange: {
            Action: 'Add',
            LogicalResourceId: 'MyBucket',
            ResourceType: 'AWS::S3::Bucket'
          }
        }
      ]
    }))
  }
}));

mock.module('@domain-services/packaging-manager', () => ({
  packagingManager: {
    packageAllWorkloads: mock(async () => [])
  }
}));

mock.module('@domain-services/template-manager', () => ({
  templateManager: {
    finalizeTemplate: mock(async () => {}),
    getTemplate: mock(() => ({
      AWSTemplateFormatVersion: '2010-09-09',
      Resources: {
        MyBucket: {
          Type: 'AWS::S3::Bucket'
        }
      }
    }))
  }
}));

mock.module('@shared/utils/yaml', () => ({
  stringifyToYaml: mock((obj) => JSON.stringify(obj))
}));

mock.module('../_utils/initialization', () => ({
  initializeAllStackServices: mock(async () => {})
}));

describe('preview-changes command', () => {
  let consoleDirSpy: any;

  beforeEach(() => {
    consoleDirSpy = spyOn(console, 'dir').mockImplementation(() => {});
  });

  test('should preview changes for stack', async () => {
    const { initializeAllStackServices } = await import('../_utils/initialization');
    const { packagingManager } = await import('@domain-services/packaging-manager');
    const { calculatedStackOverviewManager } = await import('@domain-services/calculated-stack-overview-manager');
    const { templateManager } = await import('@domain-services/template-manager');
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');

    const { commandPreviewChanges } = await import('./index');
    await commandPreviewChanges();

    expect(initializeAllStackServices).toHaveBeenCalledWith({
      commandModifiesStack: false,
      commandRequiresDeployedStack: true
    });
    expect(packagingManager.packageAllWorkloads).toHaveBeenCalledWith({ commandCanUseCache: true });
    expect(calculatedStackOverviewManager.resolveAllResources).toHaveBeenCalled();
    expect(calculatedStackOverviewManager.populateStackMetadata).toHaveBeenCalled();
    expect(templateManager.finalizeTemplate).toHaveBeenCalled();
    expect(stackManager.validateTemplate).toHaveBeenCalled();
    expect(stackManager.getChangeSet).toHaveBeenCalled();
  });

  test('should validate template before getting change set', async () => {
    const { stackManager } = await import('@domain-services/cloudformation-stack-manager');
    const { templateManager } = await import('@domain-services/template-manager');

    const { commandPreviewChanges } = await import('./index');
    await commandPreviewChanges();

    expect(stackManager.validateTemplate).toHaveBeenCalledWith({
      templateBody: expect.any(String)
    });
    expect(stackManager.getChangeSet).toHaveBeenCalledWith({
      templateBody: expect.any(String)
    });
  });

  test('should display changes using console.dir', async () => {
    const { commandPreviewChanges } = await import('./index');
    await commandPreviewChanges();

    expect(consoleDirSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          Type: 'Resource'
        })
      ]),
      { depth: 7 }
    );
  });

  test('should package workloads with cache enabled', async () => {
    const { packagingManager } = await import('@domain-services/packaging-manager');

    const { commandPreviewChanges } = await import('./index');
    await commandPreviewChanges();

    expect(packagingManager.packageAllWorkloads).toHaveBeenCalledWith({ commandCanUseCache: true });
  });

  test('should return null', async () => {
    const { commandPreviewChanges } = await import('./index');
    const result = await commandPreviewChanges();

    expect(result).toBe(null);
  });

  test('should resolve resources and populate metadata before finalizing template', async () => {
    const { calculatedStackOverviewManager } = await import('@domain-services/calculated-stack-overview-manager');
    const { templateManager } = await import('@domain-services/template-manager');

    const { commandPreviewChanges } = await import('./index');
    await commandPreviewChanges();

    expect(calculatedStackOverviewManager.resolveAllResources).toHaveBeenCalled();
    expect(calculatedStackOverviewManager.populateStackMetadata).toHaveBeenCalled();
    expect(templateManager.finalizeTemplate).toHaveBeenCalled();
  });

  test('should convert template to YAML for validation and change set', async () => {
    const { stringifyToYaml } = await import('@shared/utils/yaml');
    const { templateManager } = await import('@domain-services/template-manager');

    const { commandPreviewChanges } = await import('./index');
    await commandPreviewChanges();

    expect(stringifyToYaml).toHaveBeenCalledWith(templateManager.getTemplate());
  });
});
