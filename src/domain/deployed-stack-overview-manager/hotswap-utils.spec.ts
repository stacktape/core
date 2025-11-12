import type { ResourceDifference } from '@aws-cdk/cloudformation-diff';
import type { ContainerDefinition, TaskDefinition as SdkTaskDefinition } from '@aws-sdk/client-ecs';
import type CloudformationTaskDefinition from '@cloudform/ecs/taskDefinition';
import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/misc', () => ({
  lowerCaseFirstCharacterOfObjectKeys: mock((obj) => {
    if (Array.isArray(obj)) {
      return obj.map((item) => {
        if (typeof item === 'object' && item !== null) {
          const result: any = {};
          Object.keys(item).forEach((key) => {
            const newKey = key.charAt(0).toLowerCase() + key.slice(1);
            result[newKey] = item[key];
          });
          return result;
        }
        return item;
      });
    }
    return obj;
  }),
  serialize: mock((obj) => JSON.parse(JSON.stringify(obj)))
}));

mock.module('lodash/isEqual', () => ({
  default: mock((a, b) => JSON.stringify(a) === JSON.stringify(b))
}));

mock.module('lodash/orderBy', () => ({
  default: mock((arr, keys, orders) => {
    if (!arr || !Array.isArray(arr)) return arr;
    return [...arr].sort((a, b) => {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const order = orders[i];
        if (a[key] < b[key]) return order === 'asc' ? -1 : 1;
        if (a[key] > b[key]) return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  })
}));

describe('hotswap-utils', () => {
  describe('analyzeTaskDefinitionChange', () => {
    test('should detect hotswappable change when only ContainerDefinitions changed', async () => {
      const { analyzeTaskDefinitionChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {
          ContainerDefinitions: {
            oldValue: [{ image: 'old:latest' }],
            newValue: [{ image: 'new:latest' }]
          }
        }
      } as any;

      const deployedWorkloads = [
        {
          nameChain: ['myService'],
          stpResourceName: 'myService',
          resource: {
            cloudformationChildResources: {
              TaskDefinition: {}
            }
          } as any
        }
      ];

      const result = analyzeTaskDefinitionChange({
        change,
        cfLogicalName: 'TaskDefinition',
        deployedWorkloads
      });

      expect(result.isHotswappable).toBe(true);
      expect(result.willUpdateCodeOfWorkload).toBeDefined();
    });

    test('should detect non-hotswappable change when other properties changed', async () => {
      const { analyzeTaskDefinitionChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {
          ContainerDefinitions: {
            oldValue: [{ image: 'old:latest' }],
            newValue: [{ image: 'new:latest' }]
          },
          ExecutionRoleArn: {
            oldValue: 'arn:aws:iam::123:role/old',
            newValue: 'arn:aws:iam::123:role/new'
          }
        }
      } as any;

      const deployedWorkloads = [
        {
          nameChain: ['myService'],
          stpResourceName: 'myService',
          resource: {
            cloudformationChildResources: {
              TaskDefinition: {}
            }
          } as any
        }
      ];

      const result = analyzeTaskDefinitionChange({
        change,
        cfLogicalName: 'TaskDefinition',
        deployedWorkloads
      });

      expect(result.isHotswappable).toBe(false);
      expect(result.willUpdateCodeOfWorkload).toBeDefined();
    });

    test('should return not hotswappable when resource is not part of workload', async () => {
      const { analyzeTaskDefinitionChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {
          ContainerDefinitions: {
            oldValue: [],
            newValue: []
          }
        }
      } as any;

      const deployedWorkloads = [
        {
          nameChain: ['myService'],
          stpResourceName: 'myService',
          resource: {
            cloudformationChildResources: {
              DifferentResource: {}
            }
          } as any
        }
      ];

      const result = analyzeTaskDefinitionChange({
        change,
        cfLogicalName: 'NotPartOfWorkload',
        deployedWorkloads
      });

      expect(result.isHotswappable).toBe(false);
      expect(result.willUpdateCodeOfWorkload).toBeUndefined();
    });

    test('should detect code update when task definition changes', async () => {
      const { analyzeTaskDefinitionChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {
          ContainerDefinitions: {
            oldValue: [{ image: 'old:v1' }],
            newValue: [{ image: 'new:v2' }]
          }
        }
      } as any;

      const deployedWorkloads = [
        {
          nameChain: ['webService'],
          stpResourceName: 'webService',
          resource: {
            cloudformationChildResources: {
              WebTaskDef: {}
            }
          } as any
        }
      ];

      const result = analyzeTaskDefinitionChange({
        change,
        cfLogicalName: 'WebTaskDef',
        deployedWorkloads
      });

      expect(result.willUpdateCodeOfWorkload).toBeTruthy();
      expect(result.willUpdateCodeOfWorkload.nameChain).toEqual(['webService']);
    });
  });

  describe('analyzeLambdaFunctionChange', () => {
    test('should detect hotswappable change when only Code and Tags changed', async () => {
      const { analyzeLambdaFunctionChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {
          Code: {
            oldValue: { S3Bucket: 'bucket', S3Key: 'old.zip' },
            newValue: { S3Bucket: 'bucket', S3Key: 'new.zip' }
          },
          Tags: {
            oldValue: [{ Key: 'Version', Value: '1' }],
            newValue: [{ Key: 'Version', Value: '2' }]
          }
        }
      } as any;

      const deployedWorkloads = [
        {
          nameChain: ['myFunction'],
          stpResourceName: 'myFunction',
          resource: {
            cloudformationChildResources: {
              FunctionResource: {}
            }
          } as any
        }
      ];

      const result = analyzeLambdaFunctionChange({
        change,
        cfLogicalName: 'FunctionResource',
        deployedWorkloads
      });

      expect(result.isHotswappable).toBe(true);
      expect(result.willUpdateCodeOfWorkload).toBeTruthy();
    });

    test('should detect non-hotswappable when Code and other properties changed', async () => {
      const { analyzeLambdaFunctionChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {
          Code: {
            oldValue: { S3Bucket: 'bucket', S3Key: 'old.zip' },
            newValue: { S3Bucket: 'bucket', S3Key: 'new.zip' }
          },
          MemorySize: {
            oldValue: 512,
            newValue: 1024
          }
        }
      } as any;

      const deployedWorkloads = [
        {
          nameChain: ['myFunction'],
          stpResourceName: 'myFunction',
          resource: {
            cloudformationChildResources: {
              FunctionResource: {}
            }
          } as any
        }
      ];

      const result = analyzeLambdaFunctionChange({
        change,
        cfLogicalName: 'FunctionResource',
        deployedWorkloads
      });

      expect(result.isHotswappable).toBe(false);
      expect(result.willUpdateCodeOfWorkload).toBeTruthy();
    });

    test('should detect code change without hotswap when only Code changed', async () => {
      const { analyzeLambdaFunctionChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {
          Code: {
            oldValue: { S3Bucket: 'bucket', S3Key: 'old.zip' },
            newValue: { S3Bucket: 'bucket', S3Key: 'new.zip' }
          }
        }
      } as any;

      const deployedWorkloads = [
        {
          nameChain: ['apiFunction'],
          stpResourceName: 'apiFunction',
          resource: {
            cloudformationChildResources: {
              ApiFunctionResource: {}
            }
          } as any
        }
      ];

      const result = analyzeLambdaFunctionChange({
        change,
        cfLogicalName: 'ApiFunctionResource',
        deployedWorkloads
      });

      // Only Code changed (no Tags), so not hotswappable but code did change
      expect(result.isHotswappable).toBe(false);
      expect(result.willUpdateCodeOfWorkload).toBeTruthy();
    });

    test('should return not hotswappable when no code changed', async () => {
      const { analyzeLambdaFunctionChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {
          Environment: {
            oldValue: { Variables: { KEY: 'old' } },
            newValue: { Variables: { KEY: 'new' } }
          }
        }
      } as any;

      const deployedWorkloads = [
        {
          nameChain: ['myFunction'],
          stpResourceName: 'myFunction',
          resource: {
            cloudformationChildResources: {
              FunctionResource: {}
            }
          } as any
        }
      ];

      const result = analyzeLambdaFunctionChange({
        change,
        cfLogicalName: 'FunctionResource',
        deployedWorkloads
      });

      expect(result.isHotswappable).toBe(false);
      expect(result.willUpdateCodeOfWorkload).toBeFalsy();
    });

    test('should return not hotswappable when resource is not part of workload', async () => {
      const { analyzeLambdaFunctionChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {
          Code: {
            oldValue: { S3Key: 'old.zip' },
            newValue: { S3Key: 'new.zip' }
          }
        }
      } as any;

      const deployedWorkloads = [
        {
          nameChain: ['myFunction'],
          stpResourceName: 'myFunction',
          resource: {
            cloudformationChildResources: {
              SomeOtherResource: {}
            }
          } as any
        }
      ];

      const result = analyzeLambdaFunctionChange({
        change,
        cfLogicalName: 'NotPartOfWorkload',
        deployedWorkloads
      });

      expect(result.isHotswappable).toBe(false);
      expect(result.willUpdateCodeOfWorkload).toBeUndefined();
    });
  });

  describe('compareEcsTaskDefinitions', () => {
    test('should detect no changes when task definitions are identical', async () => {
      const { compareEcsTaskDefinitions } = await import('./hotswap-utils');

      const containerDef: ContainerDefinition = {
        name: 'app',
        image: 'nginx:latest',
        essential: true,
        portMappings: [{ containerPort: 80 }],
        environment: [{ name: 'ENV', value: 'prod' }]
      };

      const calculatedTaskDefinition: CloudformationTaskDefinition = {
        Properties: {
          ContainerDefinitions: [
            {
              Name: 'app',
              Image: 'nginx:latest',
              Essential: true,
              PortMappings: [{ ContainerPort: 80 }],
              Environment: [{ Name: 'ENV', Value: 'prod' }]
            }
          ]
        }
      } as any;

      const currentTaskDefinition: SdkTaskDefinition = {
        containerDefinitions: [containerDef]
      };

      const result = compareEcsTaskDefinitions({
        calculatedTaskDefinition,
        currentTaskDefinition
      });

      expect(result.needsUpdate).toBe(false);
    });

    test('should detect changes when image differs', async () => {
      const { compareEcsTaskDefinitions } = await import('./hotswap-utils');

      const calculatedTaskDefinition: CloudformationTaskDefinition = {
        Properties: {
          ContainerDefinitions: [
            {
              Name: 'app',
              Image: 'nginx:v2',
              Essential: true
            }
          ]
        }
      } as any;

      const currentTaskDefinition: SdkTaskDefinition = {
        containerDefinitions: [
          {
            name: 'app',
            image: 'nginx:v1',
            essential: true
          }
        ]
      };

      const result = compareEcsTaskDefinitions({
        calculatedTaskDefinition,
        currentTaskDefinition
      });

      expect(result.needsUpdate).toBe(true);
    });

    test('should detect changes when environment variables differ', async () => {
      const { compareEcsTaskDefinitions } = await import('./hotswap-utils');

      const calculatedTaskDefinition: CloudformationTaskDefinition = {
        Properties: {
          ContainerDefinitions: [
            {
              Name: 'app',
              Image: 'nginx:latest',
              Environment: [
                { Name: 'VAR1', Value: 'value1' },
                { Name: 'VAR2', Value: 'value2' }
              ]
            }
          ]
        }
      } as any;

      const currentTaskDefinition: SdkTaskDefinition = {
        containerDefinitions: [
          {
            name: 'app',
            image: 'nginx:latest',
            environment: [{ name: 'VAR1', value: 'value1' }]
          }
        ]
      };

      const result = compareEcsTaskDefinitions({
        calculatedTaskDefinition,
        currentTaskDefinition
      });

      expect(result.needsUpdate).toBe(true);
    });

    test('should handle port mappings order differences', async () => {
      const { compareEcsTaskDefinitions } = await import('./hotswap-utils');

      const calculatedTaskDefinition: CloudformationTaskDefinition = {
        Properties: {
          ContainerDefinitions: [
            {
              Name: 'app',
              Image: 'nginx:latest',
              PortMappings: [{ ContainerPort: 80 }, { ContainerPort: 443 }]
            }
          ]
        }
      } as any;

      const currentTaskDefinition: SdkTaskDefinition = {
        containerDefinitions: [
          {
            name: 'app',
            image: 'nginx:latest',
            portMappings: [{ containerPort: 443 }, { containerPort: 80 }]
          }
        ]
      };

      const result = compareEcsTaskDefinitions({
        calculatedTaskDefinition,
        currentTaskDefinition
      });

      // Should be considered the same after ordering
      expect(result.needsUpdate).toBe(false);
    });

    test('should handle secrets and mount points', async () => {
      const { compareEcsTaskDefinitions } = await import('./hotswap-utils');

      const calculatedTaskDefinition: CloudformationTaskDefinition = {
        Properties: {
          ContainerDefinitions: [
            {
              Name: 'app',
              Image: 'nginx:latest',
              Secrets: [{ Name: 'DB_PASSWORD', ValueFrom: 'arn:aws:ssm:us-east-1:123:parameter/db-pass' }],
              MountPoints: [{ ContainerPath: '/data', SourceVolume: 'data-vol' }]
            }
          ]
        }
      } as any;

      const currentTaskDefinition: SdkTaskDefinition = {
        containerDefinitions: [
          {
            name: 'app',
            image: 'nginx:latest',
            secrets: [{ name: 'DB_PASSWORD', valueFrom: 'arn:aws:ssm:us-east-1:123:parameter/db-pass' }],
            mountPoints: [{ containerPath: '/data', sourceVolume: 'data-vol' }]
          }
        ]
      };

      const result = compareEcsTaskDefinitions({
        calculatedTaskDefinition,
        currentTaskDefinition
      });

      expect(result.needsUpdate).toBe(false);
    });

    test('should handle health check configurations', async () => {
      const { compareEcsTaskDefinitions } = await import('./hotswap-utils');

      const calculatedTaskDefinition: CloudformationTaskDefinition = {
        Properties: {
          ContainerDefinitions: [
            {
              Name: 'app',
              Image: 'nginx:latest',
              HealthCheck: {
                Command: ['CMD-SHELL', 'curl -f http://localhost/ || exit 1'],
                Interval: 30,
                Timeout: 5,
                Retries: 3
              }
            }
          ]
        }
      } as any;

      const currentTaskDefinition: SdkTaskDefinition = {
        containerDefinitions: [
          {
            name: 'app',
            image: 'nginx:latest',
            healthCheck: {
              command: ['CMD-SHELL', 'curl -f http://localhost/ || exit 1'],
              interval: 30,
              timeout: 5,
              retries: 3
            }
          }
        ]
      };

      const result = compareEcsTaskDefinitions({
        calculatedTaskDefinition,
        currentTaskDefinition
      });

      expect(result.needsUpdate).toBe(false);
    });

    test('should handle container dependencies', async () => {
      const { compareEcsTaskDefinitions } = await import('./hotswap-utils');

      const calculatedTaskDefinition: CloudformationTaskDefinition = {
        Properties: {
          ContainerDefinitions: [
            {
              Name: 'app',
              Image: 'nginx:latest',
              DependsOn: [
                { ContainerName: 'sidecar', Condition: 'START' },
                { ContainerName: 'init', Condition: 'COMPLETE' }
              ]
            }
          ]
        }
      } as any;

      const currentTaskDefinition: SdkTaskDefinition = {
        containerDefinitions: [
          {
            name: 'app',
            image: 'nginx:latest',
            dependsOn: [
              { containerName: 'init', condition: 'COMPLETE' },
              { containerName: 'sidecar', condition: 'START' }
            ]
          }
        ]
      };

      const result = compareEcsTaskDefinitions({
        calculatedTaskDefinition,
        currentTaskDefinition
      });

      // Should be the same after ordering by containerName
      expect(result.needsUpdate).toBe(false);
    });

    test('should handle default empty arrays for optional properties', async () => {
      const { compareEcsTaskDefinitions } = await import('./hotswap-utils');

      const calculatedTaskDefinition: CloudformationTaskDefinition = {
        Properties: {
          ContainerDefinitions: [
            {
              Name: 'app',
              Image: 'nginx:latest',
              Essential: true
            }
          ]
        }
      } as any;

      const currentTaskDefinition: SdkTaskDefinition = {
        containerDefinitions: [
          {
            name: 'app',
            image: 'nginx:latest',
            essential: true
          }
        ]
      };

      const result = compareEcsTaskDefinitions({
        calculatedTaskDefinition,
        currentTaskDefinition
      });

      expect(result.needsUpdate).toBe(false);
    });
  });

  describe('analyzeCustomResourceChange', () => {
    test('should detect hotswappable when only forceUpdate changed', async () => {
      const { analyzeCustomResourceChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {
          forceUpdate: {
            oldValue: false,
            newValue: true
          }
        }
      } as any;

      const result = analyzeCustomResourceChange({ change });

      expect(result.isHotswappable).toBe(true);
    });

    test('should detect non-hotswappable when other properties changed', async () => {
      const { analyzeCustomResourceChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {
          forceUpdate: {
            oldValue: false,
            newValue: true
          },
          ServiceToken: {
            oldValue: 'arn:old',
            newValue: 'arn:new'
          }
        }
      } as any;

      const result = analyzeCustomResourceChange({ change });

      expect(result.isHotswappable).toBe(false);
    });

    test('should detect non-hotswappable when no forceUpdate in changes', async () => {
      const { analyzeCustomResourceChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {
          Properties: {
            oldValue: { key: 'old' },
            newValue: { key: 'new' }
          }
        }
      } as any;

      const result = analyzeCustomResourceChange({ change });

      expect(result.isHotswappable).toBe(false);
    });

    test('should handle empty property updates', async () => {
      const { analyzeCustomResourceChange } = await import('./hotswap-utils');

      const change: ResourceDifference = {
        propertyUpdates: {}
      } as any;

      const result = analyzeCustomResourceChange({ change });

      expect(result.isHotswappable).toBe(false);
    });
  });
});
