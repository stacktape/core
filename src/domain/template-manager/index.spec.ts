import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock all dependencies
const mockGetCfStackTemplate = mock(() => ({
  Resources: {},
  Outputs: {}
}));

const mockDiffTemplate = mock(() => ({}));

const mockGlobalStateManager = {
  targetStack: {
    projectName: 'test-project',
    stage: 'test',
    globallyUniqueStackHash: 'abc123',
    stackName: 'test-stack'
  },
  invokedFrom: 'cli',
  command: 'deploy'
};

const mockStackManager = {
  nextVersion: '2',
  stackActionType: 'update'
};

const mockCalculatedStackOverviewManager = {
  getSubstitutedStackInfoMap: mock(async () => '{"resources":{}}'),
  getStpResource: mock(() => ({
    name: 'myFunction',
    resourceType: 'function'
  })),
  getChildResourceList: mock(() => ({
    myFunctionRole: { cfLogicalName: 'myFunctionRole', resourceType: 'AWS::IAM::Role' }
  })),
  isCfResourceChildOfStpResource: mock(() => true),
  stackInfoMap: {
    resources: {
      myFunction: {
        resourceType: 'function',
        nameChain: ['myFunction']
      },
      myScript: {
        resourceType: 'deployment-script',
        nameChain: ['myScript']
      }
    }
  }
};

const mockConfigManager = {
  resolveDirectives: mock(async ({ itemToResolve }) => itemToResolve),
  rawConfig: { resources: {} },
  allConfigResources: [
    {
      name: 'myFunction',
      type: 'function',
      nameChain: ['myFunction'],
      overrides: {
        myFunctionRole: {
          'AssumeRolePolicyDocument.Statement[0].Effect': 'Deny'
        }
      }
    },
    {
      name: 'myScript',
      type: 'deployment-script',
      trigger: 'after:deploy',
      nameChain: ['myScript']
    }
  ],
  deploymentScripts: [
    {
      name: 'myScript',
      trigger: 'after:deploy'
    }
  ]
};

const mockSaveToCfTemplateFile = mock(async () => {});
const mockSaveToInitialCfTemplateFile = mock(async () => {});
const mockSaveToStpTemplateFile = mock(async () => {});
const mockStringifyToYaml = mock((obj) => JSON.stringify(obj));
const mockValidateStackOutput = mock(() => {});
const mockValidateUniqueness = mock(() => {});
const mockSerialize = mock((obj) => JSON.parse(JSON.stringify(obj)));
const mockGetCloudformationChildResources = mock(() => ({}));
const mockGetStackCfTemplateDescription = mock(() => 'Stack description');
const mockGetExportedStackOutputName = mock(() => 'exported-output-name');

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    getCfStackTemplate: mockGetCfStackTemplate
  }
}));

mock.module('@aws-cdk/cloudformation-diff', () => ({
  diffTemplate: mockDiffTemplate
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: mockGlobalStateManager
}));

mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: mockStackManager
}));

mock.module('@domain-services/calculated-stack-overview-manager', () => ({
  calculatedStackOverviewManager: mockCalculatedStackOverviewManager
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: mockConfigManager
}));

mock.module('@utils/temp-files', () => ({
  saveToCfTemplateFile: mockSaveToCfTemplateFile,
  saveToInitialCfTemplateFile: mockSaveToInitialCfTemplateFile,
  saveToStpTemplateFile: mockSaveToStpTemplateFile
}));

mock.module('@shared/utils/yaml', () => ({
  stringifyToYaml: mockStringifyToYaml
}));

mock.module('@utils/validator', () => ({
  validateStackOutput: mockValidateStackOutput,
  validateUniqueness: mockValidateUniqueness
}));

mock.module('@shared/utils/misc', () => ({
  serialize: mockSerialize
}));

mock.module('@shared/utils/stack-info-map', () => ({
  getCloudformationChildResources: mockGetCloudformationChildResources
}));

mock.module('@shared/naming/utils', () => ({
  getStackCfTemplateDescription: mockGetStackCfTemplateDescription,
  getExportedStackOutputName: mockGetExportedStackOutputName
}));

mock.module('@shared/naming/stack-output-names', () => ({
  outputNames: {
    deploymentVersion: () => 'DeploymentVersion',
    stackInfoMap: () => 'StackInfoMap'
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e101: mock(() => new Error('Invalid child resource'))
  }
}));

describe('TemplateManager', () => {
  let templateManager: any;

  beforeEach(async () => {
    mock.restore();
    mockGetCfStackTemplate.mockClear();
    mockDiffTemplate.mockClear();
    mockSaveToCfTemplateFile.mockClear();
    mockSaveToInitialCfTemplateFile.mockClear();
    mockSaveToStpTemplateFile.mockClear();
    mockValidateStackOutput.mockClear();
    mockValidateUniqueness.mockClear();
    mockCalculatedStackOverviewManager.getSubstitutedStackInfoMap.mockClear();
    mockCalculatedStackOverviewManager.getStpResource.mockClear();
    mockCalculatedStackOverviewManager.getChildResourceList.mockClear();
    mockCalculatedStackOverviewManager.isCfResourceChildOfStpResource.mockClear();
    mockConfigManager.resolveDirectives.mockClear();

    mockGetCfStackTemplate.mockResolvedValue({
      Resources: {
        OldResource: {
          Type: 'AWS::Lambda::Function'
        }
      },
      Outputs: {}
    });

    const module = await import('./index');
    templateManager = module.templateManager;
    await templateManager.init({ stackDetails: null });
  });

  describe('initialization', () => {
    test('should initialize successfully without stack details', async () => {
      const { TemplateManager } = await import('./index');
      const manager = new TemplateManager();
      await manager.init({ stackDetails: null });
      expect(manager.template).toBeDefined();
      expect(manager.initialTemplate).toBeDefined();
      expect(manager.oldTemplate).toBeDefined();
    });

    test('should load old template when stack exists', async () => {
      const { TemplateManager } = await import('./index');
      const manager = new TemplateManager();

      mockGetCfStackTemplate.mockResolvedValueOnce({
        Resources: { ExistingResource: { Type: 'AWS::S3::Bucket' } },
        Outputs: {}
      });

      await manager.init({
        stackDetails: {
          StackName: 'test-stack',
          StackStatus: 'UPDATE_COMPLETE'
        }
      });

      expect(mockGetCfStackTemplate).toHaveBeenCalledWith('test-stack');
      expect(manager.oldTemplate.Resources.ExistingResource).toBeDefined();
    });

    test('should skip loading template for deleted stacks', async () => {
      const { TemplateManager } = await import('./index');
      const manager = new TemplateManager();

      await manager.init({
        stackDetails: {
          StackName: 'deleted-stack',
          StackStatus: 'DELETE_COMPLETE'
        }
      });

      expect(mockGetCfStackTemplate).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    test('should reset templates and override functions', () => {
      templateManager.template.Resources.TestResource = { Type: 'AWS::S3::Bucket' };
      templateManager.addFinalTemplateOverrideFn(async () => {});

      templateManager.reset();

      expect(Object.keys(templateManager.template.Resources)).toHaveLength(0);
      expect(templateManager.templateOverrideFunctions).toHaveLength(0);
    });
  });

  describe('getTemplate', () => {
    test('should return serialized template', () => {
      templateManager.template.Resources.MyBucket = { Type: 'AWS::S3::Bucket' };
      const result = templateManager.getTemplate();

      expect(result.Resources.MyBucket).toBeDefined();
      expect(mockSerialize).toHaveBeenCalled();
    });

    test('should warn when approaching 500 resource limit', () => {
      // Add 471 resources to trigger warning
      for (let i = 0; i < 471; i++) {
        templateManager.template.Resources[`Resource${i}`] = { Type: 'AWS::S3::Bucket' };
      }

      const result = templateManager.getTemplate();
      expect(result).toBeDefined();
    });

    test('should throw error when exceeding 500 resource limit', () => {
      // Add 501 resources to trigger error
      for (let i = 0; i < 501; i++) {
        templateManager.template.Resources[`Resource${i}`] = { Type: 'AWS::S3::Bucket' };
      }

      expect(() => templateManager.getTemplate()).toThrow();
    });
  });

  describe('addResource', () => {
    test('should add resource to template', () => {
      templateManager.addResource({
        cfLogicalName: 'MyFunction',
        resource: {
          Type: 'AWS::Lambda::Function',
          Properties: { FunctionName: 'my-function' }
        },
        initial: false
      });

      expect(templateManager.template.Resources.MyFunction).toBeDefined();
      expect(templateManager.initialTemplate.Resources.MyFunction).toBeUndefined();
      expect(mockValidateUniqueness).toHaveBeenCalled();
    });

    test('should add resource to both templates when initial is true', () => {
      templateManager.addResource({
        cfLogicalName: 'InitialFunction',
        resource: {
          Type: 'AWS::Lambda::Function',
          Properties: { FunctionName: 'initial-function' }
        },
        initial: true
      });

      expect(templateManager.template.Resources.InitialFunction).toBeDefined();
      expect(templateManager.initialTemplate.Resources.InitialFunction).toBeDefined();
    });
  });

  describe('addTemplateTransformMacro', () => {
    test('should add macro when Transform is undefined', () => {
      templateManager.addTemplateTransformMacro({ macro: 'AWS::Serverless-2016-10-31' });

      expect(templateManager.template.Transform).toContain('AWS::Serverless-2016-10-31');
    });

    test('should not add duplicate macros', () => {
      templateManager.addTemplateTransformMacro({ macro: 'AWS::Serverless-2016-10-31' });
      templateManager.addTemplateTransformMacro({ macro: 'AWS::Serverless-2016-10-31' });

      expect(templateManager.template.Transform).toHaveLength(1);
    });

    test('should add multiple different macros', () => {
      templateManager.addTemplateTransformMacro({ macro: 'AWS::Serverless-2016-10-31' });
      templateManager.addTemplateTransformMacro({ macro: 'AWS::LanguageExtensions' });

      expect(templateManager.template.Transform).toHaveLength(2);
    });
  });

  describe('addTemplateHook', () => {
    test('should add hook to template', () => {
      const hook = {
        Type: 'AWS::CodeDeploy::BlueGreen',
        Properties: {}
      };

      templateManager.addTemplateHook({
        hookLogicalName: 'MyHook',
        hook
      });

      expect(templateManager.template.Hooks.MyHook).toEqual(hook);
    });
  });

  describe('addStackOutput', () => {
    test('should add output to template', () => {
      templateManager.addStackOutput({
        cfOutputName: 'MyOutput',
        value: 'test-value',
        description: 'Test output'
      });

      expect(templateManager.template.Outputs.MyOutput).toBeDefined();
      expect(templateManager.template.Outputs.MyOutput.Value).toBe('test-value');
      expect(templateManager.template.Outputs.MyOutput.Description).toBe('Test output');
      expect(mockValidateStackOutput).toHaveBeenCalled();
    });

    test('should add exported output', () => {
      templateManager.addStackOutput({
        cfOutputName: 'ExportedOutput',
        value: 'exported-value',
        exportOutput: true
      });

      expect(templateManager.template.Outputs.ExportedOutput.Export).toBeDefined();
      expect(mockGetExportedStackOutputName).toHaveBeenCalled();
    });

    test('should handle number values', () => {
      templateManager.addStackOutput({
        cfOutputName: 'NumericOutput',
        value: 42
      });

      expect(templateManager.template.Outputs.NumericOutput.Value).toBe('42');
    });

    test('should handle boolean values', () => {
      templateManager.addStackOutput({
        cfOutputName: 'BoolOutput',
        value: true
      });

      expect(templateManager.template.Outputs.BoolOutput.Value).toBe('true');
    });

    test('should handle object values', () => {
      const objValue = { Ref: 'MyResource' };
      templateManager.addStackOutput({
        cfOutputName: 'ObjectOutput',
        value: objValue
      });

      expect(templateManager.template.Outputs.ObjectOutput.Value).toEqual(objValue);
    });
  });

  describe('addFinalTemplateOverrideFn', () => {
    test('should add override function', () => {
      const overrideFn = async (template: any) => {
        template.Resources.Modified = { Type: 'AWS::S3::Bucket' };
      };

      templateManager.addFinalTemplateOverrideFn(overrideFn);

      expect(templateManager.templateOverrideFunctions).toHaveLength(1);
    });

    test('should add multiple override functions', () => {
      templateManager.addFinalTemplateOverrideFn(async () => {});
      templateManager.addFinalTemplateOverrideFn(async () => {});

      expect(templateManager.templateOverrideFunctions).toHaveLength(2);
    });
  });

  describe('getCfResourceFromTemplate', () => {
    test('should return resource by logical name', () => {
      templateManager.template.Resources.MyBucket = {
        Type: 'AWS::S3::Bucket',
        Properties: { BucketName: 'my-bucket' }
      };

      const resource = templateManager.getCfResourceFromTemplate('MyBucket');

      expect(resource).toBeDefined();
      expect(resource.Type).toBe('AWS::S3::Bucket');
    });

    test('should return undefined for non-existent resource', () => {
      const resource = templateManager.getCfResourceFromTemplate('NonExistent');
      expect(resource).toBeUndefined();
    });
  });

  describe('getOldTemplateDiff', () => {
    test('should calculate diff between old and current template', () => {
      mockDiffTemplate.mockReturnValueOnce({
        resources: {
          differenceCount: 1
        }
      });

      const diff = templateManager.getOldTemplateDiff();

      expect(mockDiffTemplate).toHaveBeenCalled();
      expect(diff).toBeDefined();
    });
  });

  describe('finalizeTemplate', () => {
    test('should add deployment outputs and resolve directives', async () => {
      mockCalculatedStackOverviewManager.getSubstitutedStackInfoMap.mockResolvedValueOnce(
        '{"resources":{"myFunction":{}}}'
      );

      await templateManager.finalizeTemplate();

      expect(templateManager.template.Outputs.DeploymentVersion).toBeDefined();
      expect(templateManager.template.Outputs.StackInfoMap).toBeDefined();
      expect(mockConfigManager.resolveDirectives).toHaveBeenCalledTimes(2);
      expect(mockGetStackCfTemplateDescription).toHaveBeenCalled();
    });

    test('should execute template override functions', async () => {
      const overrideFn = mock(async (template: any) => {
        template.Resources.OverriddenResource = { Type: 'AWS::S3::Bucket' };
      });

      templateManager.addFinalTemplateOverrideFn(overrideFn);

      await templateManager.finalizeTemplate();

      expect(overrideFn).toHaveBeenCalledWith(templateManager.template);
    });

    test('should skip override functions when invoked from server', async () => {
      const originalInvokedFrom = mockGlobalStateManager.invokedFrom;
      mockGlobalStateManager.invokedFrom = 'server';

      const overrideFn = mock(async () => {});
      templateManager.addFinalTemplateOverrideFn(overrideFn);

      await templateManager.finalizeTemplate();

      expect(overrideFn).not.toHaveBeenCalled();

      mockGlobalStateManager.invokedFrom = originalInvokedFrom;
    });

    test('should resolve overrides from config', async () => {
      templateManager.template.Resources.myFunctionRole = {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: {
            Statement: [{ Effect: 'Allow' }]
          }
        }
      };

      await templateManager.finalizeTemplate();

      expect(mockCalculatedStackOverviewManager.isCfResourceChildOfStpResource).toHaveBeenCalled();
    });

    test('should set description on both templates', async () => {
      await templateManager.finalizeTemplate();

      expect(templateManager.template.Description).toBe('Stack description');
      expect(templateManager.initialTemplate.Description).toBe('Stack description');
    });
  });

  describe('prepareForDeploy', () => {
    test('should finalize template and save files for update', async () => {
      mockStackManager.stackActionType = 'update';

      await templateManager.prepareForDeploy();

      expect(mockSaveToCfTemplateFile).toHaveBeenCalled();
      expect(mockSaveToInitialCfTemplateFile).not.toHaveBeenCalled();
      expect(mockSaveToStpTemplateFile).toHaveBeenCalled();
      expect(mockStringifyToYaml).toHaveBeenCalled();
    });

    test('should save initial template for create action', async () => {
      mockStackManager.stackActionType = 'create';

      await templateManager.prepareForDeploy();

      expect(mockSaveToCfTemplateFile).toHaveBeenCalled();
      expect(mockSaveToInitialCfTemplateFile).toHaveBeenCalled();
      expect(mockSaveToStpTemplateFile).toHaveBeenCalled();
    });
  });

  describe('resource overrides', () => {
    test('should apply overrides to child resources', async () => {
      templateManager.template.Resources.myFunctionRole = {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: {
            Statement: [{ Effect: 'Allow' }]
          }
        }
      };

      mockCalculatedStackOverviewManager.getChildResourceList.mockReturnValueOnce({
        myFunctionRole: { cfLogicalName: 'myFunctionRole' }
      });
      mockCalculatedStackOverviewManager.isCfResourceChildOfStpResource.mockReturnValueOnce(true);

      await templateManager.finalizeTemplate();

      expect(mockCalculatedStackOverviewManager.isCfResourceChildOfStpResource).toHaveBeenCalledWith({
        stpResourceName: 'myFunction',
        cfLogicalName: 'myFunctionRole'
      });
    });

    test('should throw error for invalid child resource override', async () => {
      mockCalculatedStackOverviewManager.isCfResourceChildOfStpResource.mockReturnValueOnce(false);
      mockCalculatedStackOverviewManager.getChildResourceList.mockReturnValueOnce({});

      await expect(templateManager.finalizeTemplate()).rejects.toThrow();
    });
  });

  describe('resource dependencies', () => {
    test('should add dependencies for after:deploy scripts', async () => {
      templateManager.template.Resources.myScript = {
        Type: 'AWS::CloudFormation::CustomResource',
        Properties: {}
      };

      templateManager.template.Resources.myFunction = {
        Type: 'AWS::Lambda::Function',
        Properties: {}
      };

      mockGetCloudformationChildResources.mockReturnValue({
        myScript: {}
      });

      await templateManager.finalizeTemplate();

      expect(mockGetCloudformationChildResources).toHaveBeenCalled();
    });

    test('should not create circular dependencies between scripts', async () => {
      mockConfigManager.allConfigResources = [
        {
          name: 'script1',
          type: 'deployment-script',
          trigger: 'after:deploy',
          nameChain: ['script1']
        },
        {
          name: 'script2',
          type: 'deployment-script',
          trigger: 'after:deploy',
          nameChain: ['script2']
        }
      ];

      mockConfigManager.deploymentScripts = [
        { name: 'script1', trigger: 'after:deploy' },
        { name: 'script2', trigger: 'after:deploy' }
      ];

      mockCalculatedStackOverviewManager.stackInfoMap = {
        resources: {
          script1: {
            resourceType: 'deployment-script',
            nameChain: ['script1']
          },
          script2: {
            resourceType: 'deployment-script',
            nameChain: ['script2']
          }
        }
      };

      templateManager.template.Resources.script1 = {
        Type: 'AWS::CloudFormation::CustomResource'
      };

      templateManager.template.Resources.script2 = {
        Type: 'AWS::CloudFormation::CustomResource'
      };

      mockGetCloudformationChildResources.mockReturnValue({
        script1: {},
        script2: {}
      });

      await templateManager.finalizeTemplate();

      // Should not throw circular dependency error
      expect(templateManager.template).toBeDefined();
    });
  });

  describe('edge cases', () => {
    test('should handle empty templates', () => {
      const template = templateManager.getTemplate();
      expect(template.Resources).toBeDefined();
      expect(Object.keys(template.Resources)).toHaveLength(0);
    });

    test('should handle templates without outputs', () => {
      expect(templateManager.template.Outputs).toBeDefined();
    });

    test('should handle templates without transforms', () => {
      expect(templateManager.template.Transform).toBeUndefined();
    });

    test('should handle directive resolution failures', async () => {
      mockConfigManager.resolveDirectives.mockRejectedValueOnce(new Error('Directive resolution failed'));

      await expect(templateManager.finalizeTemplate()).rejects.toThrow('Directive resolution failed');
    });

    test('should handle multiple override functions in sequence', async () => {
      let callOrder = 0;
      const fn1 = mock(async (template: any) => {
        expect(callOrder).toBe(0);
        callOrder++;
        template.Resources.First = { Type: 'AWS::S3::Bucket' };
      });

      const fn2 = mock(async (template: any) => {
        expect(callOrder).toBe(1);
        callOrder++;
        template.Resources.Second = { Type: 'AWS::S3::Bucket' };
      });

      templateManager.addFinalTemplateOverrideFn(fn1);
      templateManager.addFinalTemplateOverrideFn(fn2);

      await templateManager.finalizeTemplate();

      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
      expect(callOrder).toBe(2);
    });
  });
});
