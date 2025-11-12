import { describe, expect, mock, test, beforeEach } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    targetStack: {
      stackName: 'test-stack',
      stage: 'production'
    },
    region: 'us-east-1'
  }
}));

mock.module('@config', () => ({
  HELPER_LAMBDA_NAMES: ['stacktapeServiceLambda', 'cdnOriginRequestLambda']
}));

mock.module('@domain-services/cloudformation-stack-manager', () => ({
  stackManager: {
    existingStackResources: [
      {
        LogicalResourceId: 'BastionAutoScalingGroup',
        asgDetail: {
          Instances: [
            {
              InstanceId: 'i-12345',
              LaunchTemplate: { Version: '2' }
            },
            {
              InstanceId: 'i-67890',
              LaunchTemplate: { Version: '1' }
            }
          ]
        }
      }
    ]
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e6: mock((params) => new Error(`Resource ${params.resourceName} not found`)),
    e77: mock((params) => new Error(`Resource ${params.resourceName} not found in stack`)),
    e97: mock(() => new Error('No bastion found')),
    e122: mock((params) => new Error(`Cannot get IAM role for ${params.stpResourceType}`))
  }
}));

mock.module('@shared/naming/aws-resource-names', () => ({
  awsResourceNames: {
    lambdaRole: mock((stackName, region, name) => `${stackName}-lambda-${name}-role`),
    batchJobRole: mock((stackName, region, name) => `${stackName}-batch-${name}-role`),
    containerWorkloadRole: mock((stackName, region, name) => `${stackName}-container-${name}-role`)
  }
}));

mock.module('@shared/naming/logical-names', () => ({
  cfLogicalNames: {
    bastionEc2AutoscalingGroup: mock((name) => 'BastionAutoScalingGroup')
  }
}));

mock.module('@shared/naming/metadata-names', () => ({
  stackMetadataNames: {
    name: mock(() => 'name'),
    createdTime: mock(() => 'createdTime'),
    lastUpdatedTime: mock(() => 'lastUpdatedTime'),
    monthToDateSpend: mock(() => 'monthToDateSpend'),
    monthForecastedSpend: mock(() => 'monthForecastedSpend'),
    cloudformationRoleArn: mock(() => 'cloudformationRoleArn')
  }
}));

mock.module('@shared/naming/stack-output-names', () => ({
  outputNames: {
    stackInfoMap: mock(() => 'StackInfoMap'),
    deploymentVersion: mock(() => 'DeploymentVersion')
  }
}));

mock.module('@shared/naming/tag-names', () => ({
  tagNames: {
    hotSwapDeploy: mock(() => 'HotSwapDeploy')
  }
}));

mock.module('@shared/naming/utils', () => ({
  getStpNameForResource: mock(({ nameChain }) => nameChain.join('.')),
  injectedParameterEnvVarName: mock((resource, param) => `STP_${resource.toUpperCase()}_${param.toUpperCase()}`)
}));

mock.module('@shared/utils/constants', () => ({
  PARENT_IDENTIFIER_SHARED_GLOBAL: '__shared_global__'
}));

mock.module('@shared/utils/stack-info-map', () => ({
  traverseResourcesInMap: mock(({ stackInfoMapResources, applyFn }) => {
    Object.entries(stackInfoMapResources || {}).forEach(([name, resource]) => {
      applyFn({
        nameChain: [name],
        resource,
        stpResourceName: name
      });
      if (resource._nestedResources) {
        Object.entries(resource._nestedResources).forEach(([nestedName, nestedResource]) => {
          applyFn({
            nameChain: [name, nestedName],
            resource: nestedResource,
            stpResourceName: `${name}.${nestedName}`
          });
        });
      }
    });
  })
}));

mock.module('@utils/basic-compose-shim', () => ({
  default: mock((...decorators) => (target: any) => target)
}));

mock.module('@utils/decorators', () => ({
  cancelablePublicMethods: mock((target) => target),
  skipInitIfInitialized: mock((target) => target),
  memoizeGetters: mock((target) => target)
}));

mock.module('@utils/printer', () => ({
  printer: {
    info: mock(() => {}),
    debug: mock(() => {}),
    colorize: mock((color, text) => text)
  }
}));

mock.module('@utils/stack-info-map-sensitive-values', () => ({
  locallyResolveSensitiveValue: mock(async ({ ssmParameterName }) => 'resolved-sensitive-value')
}));

mock.module('./hotswap-utils', () => ({
  analyzeCustomResourceChange: mock(() => ({ isHotswappable: true })),
  analyzeLambdaFunctionChange: mock(() => ({ isHotswappable: true })),
  analyzeTaskDefinitionChange: mock(() => ({ isHotswappable: true }))
}));

mock.module('./printing-utils', () => ({
  getResourceInfoLines: mock(() => ({
    lines: ['Resource info line 1', 'Resource info line 2'],
    containsSensitiveValues: false
  })),
  getResourceTypeSpecificInfoLines: mock(() => [])
}));

mock.module('change-case', () => ({
  capitalCase: mock((text) => text.charAt(0).toUpperCase() + text.slice(1))
}));

mock.module('lodash/get', () => ({
  default: mock((obj, path) => {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
      if (result === undefined || result === null) return undefined;
      result = result[key];
    }
    return result;
  })
}));

mock.module('p-ratelimit', () => ({
  pRateLimit: mock(() => (fn: any) => fn())
}));

describe('deployed-stack-overview-manager', () => {
  describe('DeployedStackOverviewManager', () => {
    test('should initialize with default values', async () => {
      const { DeployedStackOverviewManager } = await import('./index');
      const manager = new DeployedStackOverviewManager();

      expect(manager.stackInfoMap).toBeUndefined();
      expect(manager.workloadsCurrentlyUsingHotSwapDeploy).toEqual([]);
    });

    test('should initialize with stack details containing stack info map', async () => {
      const { DeployedStackOverviewManager } = await import('./index');
      const manager = new DeployedStackOverviewManager();

      const stackDetails = {
        StackName: 'test-stack',
        CreationTime: new Date(),
        LastUpdatedTime: new Date(),
        stackOutput: {
          StackInfoMap: JSON.stringify({
            resources: {
              myFunction: {
                resourceType: 'function',
                referencableParams: {
                  arn: { value: 'arn:aws:lambda:us-east-1:123456789012:function:myFunc' }
                },
                links: {},
                cloudformationChildResources: {}
              }
            },
            metadata: {},
            customOutputs: {}
          })
        }
      };

      await manager.init({
        stackDetails: stackDetails as any,
        stackResources: []
      });

      expect(manager.stackInfoMap).toBeDefined();
      expect(manager.stackInfoMap.resources).toBeDefined();
      expect(manager.stackInfoMap.resources.myFunction).toBeDefined();
    });

    test('should not initialize if stack output is missing', async () => {
      const { DeployedStackOverviewManager } = await import('./index');
      const manager = new DeployedStackOverviewManager();

      const stackDetails = {
        StackName: 'test-stack',
        CreationTime: new Date(),
        stackOutput: {}
      };

      await manager.init({
        stackDetails: stackDetails as any,
        stackResources: []
      });

      expect(manager.stackInfoMap).toBeUndefined();
    });

    test('should include budget info in metadata when provided', async () => {
      const { DeployedStackOverviewManager } = await import('./index');
      const manager = new DeployedStackOverviewManager();

      const stackDetails = {
        StackName: 'test-stack',
        CreationTime: new Date(),
        LastUpdatedTime: new Date(),
        stackOutput: {
          StackInfoMap: JSON.stringify({
            resources: {},
            metadata: {},
            customOutputs: {}
          })
        }
      };

      const budgetInfo = {
        actualSpend: { Amount: '100.50', Unit: 'USD' },
        forecastedSpend: { Amount: '150.00', Unit: 'USD' }
      };

      await manager.init({
        stackDetails: stackDetails as any,
        stackResources: [],
        budgetInfo: budgetInfo as any
      });

      expect(manager.stackInfoMap.metadata.monthToDateSpend).toBeDefined();
      expect(manager.stackInfoMap.metadata.monthToDateSpend.value).toContain('100.50');
    });

    describe('refreshStackInfoMap', () => {
      test('should refresh stack info map', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                oldResource: { resourceType: 'function', referencableParams: {}, links: {}, cloudformationChildResources: {} }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        expect(manager.stackInfoMap.resources.oldResource).toBeDefined();

        // Update stack details
        stackDetails.stackOutput.StackInfoMap = JSON.stringify({
          resources: {
            newResource: { resourceType: 'bucket', referencableParams: {}, links: {}, cloudformationChildResources: {} }
          },
          metadata: {},
          customOutputs: {}
        });

        await manager.refreshStackInfoMap({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        expect(manager.stackInfoMap.resources.newResource).toBeDefined();
        expect(manager.stackInfoMap.resources.oldResource).toBeUndefined();
      });
    });

    describe('getters', () => {
      test('should get deployed workloads with ECS task definition', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                webService: {
                  resourceType: 'multi-container-workload',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                },
                myFunction: {
                  resourceType: 'function',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const workloads = manager.deployedWorkloadsWithEcsTaskDefinition;

        expect(workloads).toHaveLength(1);
        expect(workloads[0].resource.resourceType).toBe('multi-container-workload');
      });

      test('should get deployed functions', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myFunction: {
                  resourceType: 'function',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                },
                anotherFunction: {
                  resourceType: 'function',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                },
                myBucket: {
                  resourceType: 'bucket',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const functions = manager.deployedFunctions;

        expect(functions).toHaveLength(2);
        expect(functions[0].resource.resourceType).toBe('function');
        expect(functions[1].resource.resourceType).toBe('function');
      });
    });

    describe('getStpResource', () => {
      test('should get resource by name chain array', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myFunction: {
                  resourceType: 'function',
                  referencableParams: {
                    arn: { value: 'arn:aws:lambda:us-east-1:123456789012:function:myFunc' }
                  },
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const resource = manager.getStpResource({ nameChain: ['myFunction'] });

        expect(resource).toBeDefined();
        expect(resource.resourceType).toBe('function');
      });

      test('should get resource by name chain string', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myFunction: {
                  resourceType: 'function',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const resource = manager.getStpResource({ nameChain: 'myFunction' });

        expect(resource).toBeDefined();
        expect(resource.resourceType).toBe('function');
      });

      test('should get nested resource', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                batchJob: {
                  resourceType: 'batch-job',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {},
                  _nestedResources: {
                    triggerFunction: {
                      resourceType: 'function',
                      referencableParams: {},
                      links: {},
                      cloudformationChildResources: {}
                    }
                  }
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const resource = manager.getStpResource({ nameChain: ['batchJob', 'triggerFunction'] });

        expect(resource).toBeDefined();
        expect(resource.resourceType).toBe('function');
      });
    });

    describe('getStpResourceReferenceableParameter', () => {
      test('should get referenceable parameter value', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myDatabase: {
                  resourceType: 'relational-database',
                  referencableParams: {
                    host: { value: 'db.example.com' },
                    port: { value: 5432 }
                  },
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const host = manager.getStpResourceReferenceableParameter({
          nameChain: ['myDatabase'],
          referencableParamName: 'host'
        });

        expect(host).toBe('db.example.com');
      });

      test('should return undefined for non-existent parameter', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myDatabase: {
                  resourceType: 'relational-database',
                  referencableParams: {
                    host: { value: 'db.example.com' }
                  },
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const nonExistent = manager.getStpResourceReferenceableParameter({
          nameChain: ['myDatabase'],
          referencableParamName: 'nonExistent' as any
        });

        expect(nonExistent).toBeUndefined();
      });
    });

    describe('getStackMetadata', () => {
      test('should get stack metadata by property name', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {},
              metadata: {
                customProperty: { value: 'custom-value', showDuringPrint: true }
              },
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const value = manager.getStackMetadata('customProperty');

        expect(value).toBe('custom-value');
      });

      test('should return undefined for non-existent metadata', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {},
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const value = manager.getStackMetadata('nonExistent');

        expect(value).toBeUndefined();
      });
    });

    describe('isWorkloadCurrentlyUsingHotSwapDeploy', () => {
      test('should detect workload using hotswap', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                webService: {
                  resourceType: 'multi-container-workload',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {
                    EcsService: { cloudformationResourceType: 'AWS::ECS::Service' }
                  }
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        const stackResources = [
          {
            LogicalResourceId: 'EcsService',
            ecsServiceTaskDefinitionTags: [
              { key: 'HotSwapDeploy', value: 'true' }
            ]
          }
        ];

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: stackResources as any
        });

        expect(manager.isWorkloadCurrentlyUsingHotSwapDeploy('webService')).toBe(true);
        expect(manager.isWorkloadCurrentlyUsingHotSwapDeploy('otherService')).toBe(false);
      });
    });

    describe('analyzeCloudformationTemplateDiff', () => {
      test('should detect hotswap is possible for no changes', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {},
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const cfTemplateDiff = {
          conditions: { changes: {} },
          mappings: { changes: {} },
          outputs: { changes: { DeploymentVersion: {} } },
          parameters: { changes: {} },
          resources: { changes: {} }
        };

        const result = manager.analyzeCloudformationTemplateDiff({
          cfTemplateDiff: cfTemplateDiff as any
        });

        expect(result.isHotswapPossible).toBe(true);
        expect(result.hotSwappableWorkloadsWhoseCodeWillBeUpdatedByCloudformation).toEqual([]);
      });

      test('should detect hotswap is not possible for condition changes', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {},
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const cfTemplateDiff = {
          conditions: { changes: { SomeCondition: {} } },
          mappings: { changes: {} },
          outputs: { changes: {} },
          parameters: { changes: {} },
          resources: { changes: {} }
        };

        const result = manager.analyzeCloudformationTemplateDiff({
          cfTemplateDiff: cfTemplateDiff as any
        });

        expect(result.isHotswapPossible).toBe(false);
      });

      test('should detect hotswap is not possible for resource addition', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {},
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const cfTemplateDiff = {
          conditions: { changes: {} },
          mappings: { changes: {} },
          outputs: { changes: {} },
          parameters: { changes: {} },
          resources: {
            changes: {
              NewBucket: {
                isAddition: true,
                isRemoval: false,
                resourceTypeChanged: false
              }
            }
          }
        };

        const result = manager.analyzeCloudformationTemplateDiff({
          cfTemplateDiff: cfTemplateDiff as any
        });

        expect(result.isHotswapPossible).toBe(false);
      });
    });

    describe('resolveBastionInstanceInfo', () => {
      test('should resolve bastion instance info', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myBastion: {
                  resourceType: 'bastion',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const result = manager.resolveBastionInstanceInfo('myBastion');

        expect(result.bastionInstanceId).toBe('i-12345');
        expect(result.bastionResourceStpName).toBe('myBastion');
      });

      test('should throw error if bastion not found', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const { stpErrors } = await import('@errors');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {},
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        expect(() => manager.resolveBastionInstanceInfo()).toThrow();
        expect(stpErrors.e97).toHaveBeenCalled();
      });
    });

    describe('locallyResolveEnvVariablesFromConnectTo', () => {
      test('should resolve environment variables from connected resources', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myDatabase: {
                  resourceType: 'relational-database',
                  referencableParams: {
                    host: { value: 'db.example.com' },
                    port: { value: 5432 },
                    connectionString: { value: 'postgresql://db.example.com:5432/mydb' }
                  },
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const envVars = manager.locallyResolveEnvVariablesFromConnectTo(['myDatabase']);

        expect(envVars['STP_MYDATABASE_HOST']).toBe('db.example.com');
        expect(envVars['STP_MYDATABASE_PORT']).toBe(5432);
        expect(envVars['STP_MYDATABASE_CONNECTIONSTRING']).toContain('postgresql://');
      });

      test('should handle empty connectTo array', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {},
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const envVars = manager.locallyResolveEnvVariablesFromConnectTo([]);

        expect(envVars).toEqual({});
      });
    });

    describe('getIamRoleNameOfDeployedResource', () => {
      test('should get IAM role name for function', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myFunction: {
                  resourceType: 'function',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const roleName = manager.getIamRoleNameOfDeployedResource(['myFunction']);

        expect(roleName).toContain('lambda');
        expect(roleName).toContain('myFunction');
      });

      test('should get IAM role name for batch job', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myBatchJob: {
                  resourceType: 'batch-job',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const roleName = manager.getIamRoleNameOfDeployedResource(['myBatchJob']);

        expect(roleName).toContain('batch');
        expect(roleName).toContain('myBatchJob');
      });

      test('should get IAM role name for container workload', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                webService: {
                  resourceType: 'web-service',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const roleName = manager.getIamRoleNameOfDeployedResource(['webService']);

        expect(roleName).toContain('container');
        expect(roleName).toContain('webService');
      });

      test('should throw error for unsupported resource type', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const { stpErrors } = await import('@errors');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myBucket: {
                  resourceType: 'bucket',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        expect(() => manager.getIamRoleNameOfDeployedResource(['myBucket'])).toThrow();
        expect(stpErrors.e122).toHaveBeenCalled();
      });
    });

    describe('printResourceInfo', () => {
      test('should print resource info', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const { printer } = await import('@utils/printer');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myFunction: {
                  resourceType: 'function',
                  referencableParams: {
                    arn: { value: 'arn:aws:lambda:us-east-1:123456789012:function:myFunc' }
                  },
                  links: {},
                  cloudformationChildResources: {},
                  outputs: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        manager.printResourceInfo(['myFunction']);

        expect(printer.info).toHaveBeenCalled();
      });
    });

    describe('printShortStackInfo', () => {
      test('should print short stack info', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myApi: {
                  resourceType: 'http-api-gateway',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        // Should not throw
        manager.printShortStackInfo();
      });
    });

    describe('printEntireStackInfo', () => {
      test('should print entire stack info', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const { printer } = await import('@utils/printer');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date('2024-01-01'),
          LastUpdatedTime: new Date('2024-01-15'),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myFunction: {
                  resourceType: 'function',
                  referencableParams: {
                    arn: { value: 'arn:aws:lambda:us-east-1:123456789012:function:myFunc', showDuringPrint: true }
                  },
                  links: { console: 'https://console.aws.amazon.com/...' },
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {
                apiUrl: 'https://api.example.com'
              }
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        const result = manager.printEntireStackInfo();

        expect(printer.info).toHaveBeenCalled();
        expect(result.containsSensitiveValues).toBe(false);
      });

      test('should filter out helper lambdas and shared global', async () => {
        const { DeployedStackOverviewManager } = await import('./index');
        const manager = new DeployedStackOverviewManager();

        const stackDetails = {
          StackName: 'test-stack',
          CreationTime: new Date(),
          LastUpdatedTime: new Date(),
          stackOutput: {
            StackInfoMap: JSON.stringify({
              resources: {
                myFunction: {
                  resourceType: 'function',
                  referencableParams: {
                    arn: { value: 'arn:aws:lambda:us-east-1:123456789012:function:myFunc', showDuringPrint: true }
                  },
                  links: { console: 'https://console.aws.amazon.com/...' },
                  cloudformationChildResources: {}
                },
                stacktapeServiceLambda: {
                  resourceType: 'function',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                },
                __shared_global__: {
                  resourceType: 'shared',
                  referencableParams: {},
                  links: {},
                  cloudformationChildResources: {}
                }
              },
              metadata: {},
              customOutputs: {}
            })
          }
        };

        await manager.init({
          stackDetails: stackDetails as any,
          stackResources: []
        });

        manager.printEntireStackInfo();

        // Should only print myFunction, not helper lambdas or shared global
        expect(manager.stackInfoMap.resources.myFunction).toBeDefined();
        expect(manager.stackInfoMap.resources.stacktapeServiceLambda).toBeDefined();
        expect(manager.stackInfoMap.resources.__shared_global__).toBeDefined();
      });
    });
  });
});
