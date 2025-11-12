import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: {
      outFile: 'custom-template.yaml'
    },
    invokedFrom: 'cli'
  }
}));

mock.module('@domain-services/calculated-stack-overview-manager', () => ({
  calculatedStackOverviewManager: {
    resolveAllResources: mock(async () => {})
  }
}));

mock.module('@domain-services/template-manager', () => ({
  templateManager: {
    finalizeTemplate: mock(async () => {}),
    getTemplate: mock(() => ({
      AWSTemplateFormatVersion: '2010-09-09',
      Description: 'Test stack template',
      Resources: {
        MyBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {
            BucketName: 'test-bucket'
          }
        }
      }
    }))
  }
}));

mock.module('@shared/utils/yaml', () => ({
  stringifyToYaml: mock((obj) => `AWSTemplateFormatVersion: '2010-09-09'\nDescription: Test stack template`)
}));

mock.module('fs-extra', () => ({
  default: {
    writeFile: mock(async () => {})
  }
}));

mock.module('../_utils/initialization', () => ({
  initializeAllStackServices: mock(async () => {})
}));

describe('compile-template command', () => {
  test('should compile template and write to file', async () => {
    const { initializeAllStackServices } = await import('../_utils/initialization');
    const { calculatedStackOverviewManager } = await import('@domain-services/calculated-stack-overview-manager');
    const { templateManager } = await import('@domain-services/template-manager');
    const fsExtra = (await import('fs-extra')).default;
    const { stringifyToYaml } = await import('@shared/utils/yaml');

    const { commandCompileTemplate } = await import('./index');
    const result = await commandCompileTemplate();

    expect(initializeAllStackServices).toHaveBeenCalledWith({
      commandModifiesStack: false,
      commandRequiresDeployedStack: false,
      loadGlobalConfig: true,
      requiresSubscription: false
    });
    expect(calculatedStackOverviewManager.resolveAllResources).toHaveBeenCalled();
    expect(templateManager.finalizeTemplate).toHaveBeenCalled();
    expect(templateManager.getTemplate).toHaveBeenCalled();
    expect(stringifyToYaml).toHaveBeenCalled();
    expect(fsExtra.writeFile).toHaveBeenCalledWith(
      'custom-template.yaml',
      expect.any(String)
    );
    expect(result).toHaveProperty('AWSTemplateFormatVersion');
  });

  test('should use default filename when not specified', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const fsExtra = (await import('fs-extra')).default;
    globalStateManager.args = {};

    const { commandCompileTemplate } = await import('./index');
    await commandCompileTemplate();

    expect(fsExtra.writeFile).toHaveBeenCalledWith(
      'compiled-template.yaml',
      expect.any(String)
    );
  });

  test('should not write file when invoked from SDK', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const fsExtra = (await import('fs-extra')).default;
    globalStateManager.invokedFrom = 'sdk';
    globalStateManager.args = { outFile: 'output.yaml' };

    (fsExtra.writeFile as any).mock.calls = [];

    const { commandCompileTemplate } = await import('./index');
    const result = await commandCompileTemplate();

    expect(fsExtra.writeFile).not.toHaveBeenCalled();
    expect(result).toHaveProperty('AWSTemplateFormatVersion');
  });

  test('should return compiled template', async () => {
    const { commandCompileTemplate } = await import('./index');
    const result = await commandCompileTemplate();

    expect(result).toEqual({
      AWSTemplateFormatVersion: '2010-09-09',
      Description: 'Test stack template',
      Resources: {
        MyBucket: {
          Type: 'AWS::S3::Bucket',
          Properties: {
            BucketName: 'test-bucket'
          }
        }
      }
    });
  });

  test('should convert template to YAML format', async () => {
    const { stringifyToYaml } = await import('@shared/utils/yaml');
    const { templateManager } = await import('@domain-services/template-manager');

    const { commandCompileTemplate } = await import('./index');
    await commandCompileTemplate();

    expect(stringifyToYaml).toHaveBeenCalledWith(templateManager.getTemplate());
  });

  test('should resolve all resources before finalizing template', async () => {
    const { calculatedStackOverviewManager } = await import('@domain-services/calculated-stack-overview-manager');
    const { templateManager } = await import('@domain-services/template-manager');

    const { commandCompileTemplate } = await import('./index');
    await commandCompileTemplate();

    expect(calculatedStackOverviewManager.resolveAllResources).toHaveBeenCalled();
    expect(templateManager.finalizeTemplate).toHaveBeenCalled();
  });
});
