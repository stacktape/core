import { ResourceImpact } from '@aws-cdk/cloudformation-diff';
import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/constants', () => ({
  PARENT_IDENTIFIER_CUSTOM_CF: '__CUSTOM_CF__',
  PARENT_IDENTIFIER_SHARED_GLOBAL: '__SHARED_GLOBAL__'
}));

mock.module('@shared/utils/misc', () => ({
  serialize: mock((obj) => (obj ? JSON.parse(JSON.stringify(obj)) : obj))
}));

mock.module('@shared/utils/stack-info-map', () => ({
  getCloudformationChildResources: mock((args) => {
    return args.resource?.cloudformationChildResources || {};
  })
}));

mock.module('@utils/referenceable-types', () => ({
  getAllReferencableParams: mock((resourceType) => {
    if (resourceType === 'AWS::Lambda::Function') {
      return ['arn', 'name'];
    }
    if (resourceType === 'AWS::DynamoDB::Table') {
      return ['arn', 'name', 'streamArn'];
    }
    return [];
  })
}));

describe('stack-info-map-diff', () => {
  describe('calculateComplexResourceMap', () => {
    test('should process resources from both calculated and deployed maps', async () => {
      const { calculateComplexResourceMap } = await import('./stack-info-map-diff');

      const calculatedResourceMap: any = {
        myFunction: {
          resourceType: 'function',
          cloudformationChildResources: {
            MyFunctionLogicalId: { cloudformationResourceType: 'AWS::Lambda::Function' }
          },
          referencableParams: { arn: { value: 'unknown' } }
        }
      };

      const deployedResourceMap: any = {
        myFunction: {
          resourceType: 'function',
          cloudformationChildResources: {
            MyFunctionLogicalId: { cloudformationResourceType: 'AWS::Lambda::Function' }
          },
          referencableParams: { arn: { value: 'arn:aws:lambda:us-east-1:123456789012:function:my-fn' } },
          outputs: { url: 'https://example.com' },
          links: { console: 'https://console.aws.amazon.com' }
        }
      };

      const result = calculateComplexResourceMap({
        calculatedResourceMap,
        deployedResourceMap,
        showSensitiveValues: false
      });

      expect(result).toBeDefined();
      expect(result.myFunction).toBeDefined();
      expect(result.myFunction.status).toBe('DEPLOYED');
      expect(result.myFunction.resourceType).toBe('function');
      expect(result.myFunction.outputs).toEqual({ url: 'https://example.com' });
    });

    test('should handle resources only in calculated map (TO_BE_CREATED)', async () => {
      const { calculateComplexResourceMap } = await import('./stack-info-map-diff');

      const calculatedResourceMap: any = {
        newResource: {
          resourceType: 'function',
          referencableParams: {},
          cloudformationChildResources: {}
        }
      };

      const result = calculateComplexResourceMap({
        calculatedResourceMap,
        deployedResourceMap: {},
        showSensitiveValues: false
      });

      expect(result.newResource.status).toBe('TO_BE_CREATED');
    });

    test('should handle resources only in deployed map (TO_BE_DELETED)', async () => {
      const { calculateComplexResourceMap } = await import('./stack-info-map-diff');

      const deployedResourceMap: any = {
        oldResource: {
          resourceType: 'function',
          referencableParams: {},
          cloudformationChildResources: {}
        }
      };

      const result = calculateComplexResourceMap({
        calculatedResourceMap: {},
        deployedResourceMap,
        showSensitiveValues: false
      });

      expect(result.oldResource.status).toBe('TO_BE_DELETED');
    });

    test('should handle resource type changes (TO_BE_REPLACED)', async () => {
      const { calculateComplexResourceMap } = await import('./stack-info-map-diff');

      const calculatedResourceMap: any = {
        myResource: {
          resourceType: 'web-service',
          cloudformationChildResources: {}
        }
      };

      const deployedResourceMap: any = {
        myResource: {
          resourceType: 'function',
          cloudformationChildResources: {}
        }
      };

      const result = calculateComplexResourceMap({
        calculatedResourceMap,
        deployedResourceMap,
        showSensitiveValues: false
      });

      expect(result.myResource.status).toBe('TO_BE_REPLACED');
      expect(result.myResource.afterUpdateResourceType).toBe('web-service');
    });

    test('should process nested resources recursively', async () => {
      const { calculateComplexResourceMap } = await import('./stack-info-map-diff');

      const calculatedResourceMap: any = {
        parent: {
          resourceType: 'api-gateway',
          cloudformationChildResources: {},
          _nestedResources: {
            child: {
              resourceType: 'function',
              cloudformationChildResources: {}
            }
          }
        }
      };

      const deployedResourceMap: any = {
        parent: {
          resourceType: 'api-gateway',
          cloudformationChildResources: {},
          _nestedResources: {
            child: {
              resourceType: 'function',
              cloudformationChildResources: {}
            }
          }
        }
      };

      const result = calculateComplexResourceMap({
        calculatedResourceMap,
        deployedResourceMap,
        showSensitiveValues: false
      });

      expect(result.parent._nestedResources).toBeDefined();
      expect(result.parent._nestedResources.child).toBeDefined();
      expect(result.parent._nestedResources.child.status).toBe('DEPLOYED');
    });

    test('should handle sensitive values correctly', async () => {
      const { calculateComplexResourceMap } = await import('./stack-info-map-diff');

      const deployedResourceMap: any = {
        mySecret: {
          resourceType: 'function',
          cloudformationChildResources: {},
          referencableParams: {
            secretValue: { value: 'super-secret', ssmParameterName: '/my/secret' }
          }
        }
      };

      const resultHidden = calculateComplexResourceMap({
        deployedResourceMap,
        showSensitiveValues: false
      });

      expect(resultHidden.mySecret.referenceableParams.secretValue).toBe('<<OMITTED>>');

      const resultShown = calculateComplexResourceMap({
        deployedResourceMap,
        showSensitiveValues: true
      });

      expect(resultShown.mySecret.referenceableParams.secretValue).toBe('super-secret');
    });

    test('should handle unknown values for calculated resources', async () => {
      const { calculateComplexResourceMap } = await import('./stack-info-map-diff');

      const calculatedResourceMap: any = {
        myFunction: {
          resourceType: 'function',
          cloudformationChildResources: {},
          referencableParams: { arn: { value: 'unknown' } },
          links: { console: 'unknown' }
        }
      };

      const result = calculateComplexResourceMap({
        calculatedResourceMap,
        showSensitiveValues: false
      });

      expect(result.myFunction.referenceableParams.arn).toBe('<<unknown>>');
      expect(result.myFunction.links.console).toBe('<<unknown>>');
    });

    test('should process cloudformation child resources with template diff', async () => {
      const { calculateComplexResourceMap } = await import('./stack-info-map-diff');

      const calculatedResourceMap: any = {
        myFunction: {
          resourceType: 'function',
          cloudformationChildResources: {
            FunctionRole: { cloudformationResourceType: 'AWS::IAM::Role' }
          }
        }
      };

      const cfTemplateDiff: any = {
        resources: {
          logicalIds: ['FunctionRole'],
          get: mock((logicalId) => {
            if (logicalId === 'FunctionRole') {
              return {
                changeImpact: ResourceImpact.WILL_UPDATE,
                oldResourceType: 'AWS::IAM::Role',
                newResourceType: 'AWS::IAM::Role',
                resourceTypeChanged: false,
                propertyUpdates: {}
              };
            }
            return null;
          })
        }
      };

      const result = calculateComplexResourceMap({
        calculatedResourceMap,
        cfTemplateDiff,
        showSensitiveValues: false
      });

      expect(result.myFunction.cloudformationChildResources.FunctionRole).toBeDefined();
      expect(result.myFunction.cloudformationChildResources.FunctionRole.status).toBe(ResourceImpact.WILL_UPDATE);
    });
  });

  describe('getCriticalResourcesPotentiallyEndangeredByOperation', () => {
    test('should identify critical resources with dangerous impact', async () => {
      const { getCriticalResourcesPotentiallyEndangeredByOperation } = await import('./stack-info-map-diff');

      const calculatedStackInfoMap: any = {
        resources: {
          myDatabase: {
            resourceType: 'relational-database',
            cloudformationChildResources: {
              DBCluster: { cloudformationResourceType: 'AWS::RDS::DBCluster' }
            }
          }
        },
        customOutputs: {}
      };

      const deployedStackInfoMap: any = {
        resources: {
          myDatabase: {
            resourceType: 'relational-database',
            cloudformationChildResources: {
              DBCluster: { cloudformationResourceType: 'AWS::RDS::DBCluster' }
            }
          }
        },
        customOutputs: {}
      };

      const cfTemplateDiff: any = {
        resources: {
          logicalIds: ['DBCluster'],
          get: mock((logicalId) => {
            if (logicalId === 'DBCluster') {
              return {
                changeImpact: ResourceImpact.WILL_REPLACE,
                oldResourceType: 'AWS::RDS::DBCluster',
                newResourceType: 'AWS::RDS::DBCluster',
                resourceTypeChanged: false
              };
            }
            return null;
          })
        }
      };

      const result = getCriticalResourcesPotentiallyEndangeredByOperation({
        calculatedStackInfoMap,
        deployedStackInfoMap,
        cfTemplateDiff
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].stpResourceName).toBe('myDatabase');
      expect(result[0].resourceType).toBe('relational-database');
      expect(result[0].impactedCfResources.DBCluster).toBeDefined();
      expect(result[0].impactedCfResources.DBCluster.impact).toBe(ResourceImpact.WILL_REPLACE);
    });

    test('should not include resources with safe changes', async () => {
      const { getCriticalResourcesPotentiallyEndangeredByOperation } = await import('./stack-info-map-diff');

      const calculatedStackInfoMap: any = {
        resources: {
          myDatabase: {
            resourceType: 'relational-database',
            cloudformationChildResources: {
              DBCluster: { cloudformationResourceType: 'AWS::RDS::DBCluster' }
            }
          }
        },
        customOutputs: {}
      };

      const deployedStackInfoMap: any = {
        resources: {
          myDatabase: {
            resourceType: 'relational-database',
            cloudformationChildResources: {
              DBCluster: { cloudformationResourceType: 'AWS::RDS::DBCluster' }
            }
          }
        },
        customOutputs: {}
      };

      const cfTemplateDiff: any = {
        resources: {
          logicalIds: ['DBCluster'],
          get: mock((logicalId) => {
            if (logicalId === 'DBCluster') {
              return {
                changeImpact: ResourceImpact.WILL_UPDATE,
                oldResourceType: 'AWS::RDS::DBCluster',
                newResourceType: 'AWS::RDS::DBCluster',
                resourceTypeChanged: false
              };
            }
            return null;
          })
        }
      };

      const result = getCriticalResourcesPotentiallyEndangeredByOperation({
        calculatedStackInfoMap,
        deployedStackInfoMap,
        cfTemplateDiff
      });

      expect(result.length).toBe(0);
    });

    test('should check all critical resource types', async () => {
      const { getCriticalResourcesPotentiallyEndangeredByOperation } = await import('./stack-info-map-diff');

      const criticalResourceTypes = [
        'AWS::RDS::DBInstance',
        'AWS::DynamoDB::Table',
        'AWS::S3::Bucket',
        'AWS::Cognito::UserPool',
        'AWS::EFS::FileSystem'
      ];

      const resources: any = {};
      const cfLogicalIds: string[] = [];

      criticalResourceTypes.forEach((type, index) => {
        const logicalId = `Resource${index}`;
        resources[`resource${index}`] = {
          resourceType: 'test-resource',
          cloudformationChildResources: {
            [logicalId]: { cloudformationResourceType: type }
          }
        };
        cfLogicalIds.push(logicalId);
      });

      const calculatedStackInfoMap: any = { resources, customOutputs: {} };
      const deployedStackInfoMap: any = { resources, customOutputs: {} };

      const cfTemplateDiff: any = {
        resources: {
          logicalIds: cfLogicalIds,
          get: mock((logicalId) => ({
            changeImpact: ResourceImpact.WILL_DESTROY,
            oldResourceType: criticalResourceTypes[parseInt(logicalId.replace('Resource', ''))],
            resourceTypeChanged: false
          }))
        }
      };

      const result = getCriticalResourcesPotentiallyEndangeredByOperation({
        calculatedStackInfoMap,
        deployedStackInfoMap,
        cfTemplateDiff
      });

      expect(result.length).toBe(criticalResourceTypes.length);
    });

    test('should skip parent identifiers', async () => {
      const { getCriticalResourcesPotentiallyEndangeredByOperation } = await import('./stack-info-map-diff');

      const calculatedStackInfoMap: any = {
        resources: {
          __SHARED_GLOBAL__: {
            resourceType: 'global',
            cloudformationChildResources: {
              CriticalResource: { cloudformationResourceType: 'AWS::RDS::DBCluster' }
            }
          },
          __CUSTOM_CF__: {
            resourceType: 'custom',
            cloudformationChildResources: {
              AnotherCritical: { cloudformationResourceType: 'AWS::DynamoDB::Table' }
            }
          }
        },
        customOutputs: {}
      };

      const deployedStackInfoMap: any = {
        resources: {
          __SHARED_GLOBAL__: {
            resourceType: 'global',
            cloudformationChildResources: {
              CriticalResource: { cloudformationResourceType: 'AWS::RDS::DBCluster' }
            }
          },
          __CUSTOM_CF__: {
            resourceType: 'custom',
            cloudformationChildResources: {
              AnotherCritical: { cloudformationResourceType: 'AWS::DynamoDB::Table' }
            }
          }
        },
        customOutputs: {}
      };

      const cfTemplateDiff: any = {
        resources: {
          logicalIds: ['CriticalResource', 'AnotherCritical'],
          get: mock(() => ({
            changeImpact: ResourceImpact.WILL_DESTROY,
            oldResourceType: 'AWS::RDS::DBCluster',
            resourceTypeChanged: false
          }))
        }
      };

      const result = getCriticalResourcesPotentiallyEndangeredByOperation({
        calculatedStackInfoMap,
        deployedStackInfoMap,
        cfTemplateDiff
      });

      expect(result.length).toBe(0);
    });
  });

  describe('getDetailedStackInfoMap', () => {
    test('should create detailed stack info map with metadata', async () => {
      const { getDetailedStackInfoMap } = await import('./stack-info-map-diff');

      const calculatedStackInfoMap: any = {
        resources: {
          myFunction: {
            resourceType: 'function',
            cloudformationChildResources: {}
          }
        },
        customOutputs: {
          apiUrl: 'unknown'
        }
      };

      const deployedStackInfoMap: any = {
        resources: {
          myFunction: {
            resourceType: 'function',
            cloudformationChildResources: {}
          }
        },
        customOutputs: {
          apiUrl: 'https://api.example.com'
        },
        metadata: {
          name: { value: 'my-stack' },
          createdTime: { value: '2024-01-01T00:00:00Z' },
          lastUpdatedTime: { value: '2024-01-02T00:00:00Z' }
        }
      };

      const result = getDetailedStackInfoMap({
        calculatedStackInfoMap,
        deployedStackInfoMap,
        showSensitiveValues: false
      });

      expect(result.metadata.name).toBe('my-stack');
      expect(result.metadata.createdTime).toBe('2024-01-01T00:00:00Z');
      expect(result.metadata.lastUpdatedTime).toBe('2024-01-02T00:00:00Z');
      expect(result.customOutputs.apiUrl).toBe('https://api.example.com');
    });

    test('should handle unknown custom outputs when no deployed stack', async () => {
      const { getDetailedStackInfoMap } = await import('./stack-info-map-diff');

      const calculatedStackInfoMap: any = {
        resources: {},
        customOutputs: {
          apiUrl: 'will-be-set',
          dbEndpoint: 'will-be-set'
        }
      };

      const result = getDetailedStackInfoMap({
        calculatedStackInfoMap,
        showSensitiveValues: false
      });

      expect(result.customOutputs.apiUrl).toBe('<<unknown>>');
      expect(result.customOutputs.dbEndpoint).toBe('<<unknown>>');
    });

    test('should use deployed resources when no template diff', async () => {
      const { getDetailedStackInfoMap } = await import('./stack-info-map-diff');

      const calculatedStackInfoMap: any = {
        resources: {
          newResource: {
            resourceType: 'function',
            cloudformationChildResources: {}
          }
        },
        customOutputs: {}
      };

      const deployedStackInfoMap: any = {
        resources: {
          existingResource: {
            resourceType: 'function',
            cloudformationChildResources: {}
          }
        },
        customOutputs: {}
      };

      const result = getDetailedStackInfoMap({
        calculatedStackInfoMap,
        deployedStackInfoMap,
        showSensitiveValues: false
      });

      // When there's no cfTemplateDiff, it uses deployed resources
      expect(result.resources.existingResource).toBeDefined();
    });

    test('should use calculated resources when template diff is provided', async () => {
      const { getDetailedStackInfoMap } = await import('./stack-info-map-diff');

      const calculatedStackInfoMap: any = {
        resources: {
          newResource: {
            resourceType: 'function',
            cloudformationChildResources: {}
          }
        },
        customOutputs: {}
      };

      const deployedStackInfoMap: any = {
        resources: {
          existingResource: {
            resourceType: 'function',
            cloudformationChildResources: {}
          }
        },
        customOutputs: {}
      };

      const cfTemplateDiff: any = {
        resources: {
          logicalIds: [],
          get: mock(() => null)
        }
      };

      const result = getDetailedStackInfoMap({
        calculatedStackInfoMap,
        deployedStackInfoMap,
        showSensitiveValues: false,
        cfTemplateDiff
      });

      // When cfTemplateDiff is provided, it uses calculated resources
      expect(result.resources.newResource).toBeDefined();
    });
  });
});
