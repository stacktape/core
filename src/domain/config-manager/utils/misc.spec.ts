import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@config', () => ({
  RESOURCE_DEFAULTS: {
    function: {
      properties: {
        memory: 1024,
        timeout: 30
      }
    },
    bucket: {
      properties: {
        versioning: false
      }
    },
    'multi-container-workload': {
      container: {
        cpu: 256,
        memory: 512
      }
    }
  }
}));

mock.module('@shared/utils/misc', () => ({
  removePropertiesFromObject: mock((obj, props) => {
    const result = { ...obj };
    props.forEach((prop) => delete result[prop]);
    return result;
  }),
  serialize: mock((obj) => JSON.parse(JSON.stringify(obj)))
}));

mock.module('@utils/errors', () => ({
  UnexpectedError: class UnexpectedError extends Error {
    customMessage: string;
    constructor({ customMessage }: { customMessage: string }) {
      super(customMessage);
      this.customMessage = customMessage;
      this.name = 'UnexpectedError';
    }
  }
}));

describe('config-manager/utils/misc', () => {
  describe('mergeStacktapeDefaults', () => {
    test('should merge defaults for function', async () => {
      const { mergeStacktapeDefaults } = await import('./misc');
      const resource: any = {
        type: 'function',
        properties: {
          handler: 'index.handler'
        }
      };
      const result = mergeStacktapeDefaults(resource);
      expect(result.properties.memory).toBe(1024);
      expect(result.properties.timeout).toBe(30);
      expect(result.properties.handler).toBe('index.handler');
    });

    test('should merge defaults for bucket', async () => {
      const { mergeStacktapeDefaults } = await import('./misc');
      const resource: any = {
        type: 'bucket',
        properties: {
          name: 'my-bucket'
        }
      };
      const result = mergeStacktapeDefaults(resource);
      expect(result.properties.versioning).toBe(false);
      expect(result.properties.name).toBe('my-bucket');
    });

    test('should not override existing properties', async () => {
      const { mergeStacktapeDefaults } = await import('./misc');
      const resource: any = {
        type: 'function',
        properties: {
          memory: 2048,
          handler: 'custom.handler'
        }
      };
      const result = mergeStacktapeDefaults(resource);
      expect(result.properties.memory).toBe(2048);
      expect(result.properties.handler).toBe('custom.handler');
    });

    test('should merge nested objects', async () => {
      const { mergeStacktapeDefaults } = await import('./misc');
      const resource: any = {
        type: 'function',
        properties: {
          handler: 'index.handler'
        }
      };
      const result = mergeStacktapeDefaults(resource);
      expect(result.properties).toBeDefined();
      expect(typeof result.properties).toBe('object');
    });

    test('should handle resource without defaults', async () => {
      const { mergeStacktapeDefaults } = await import('./misc');
      const resource: any = {
        type: 'custom-resource',
        properties: {
          custom: 'value'
        }
      };
      const result = mergeStacktapeDefaults(resource);
      expect(result.properties.custom).toBe('value');
    });

    test('should merge arrays by concatenation', async () => {
      mock.module('@config', () => ({
        RESOURCE_DEFAULTS: {
          function: {
            properties: {
              tags: ['default-tag']
            }
          }
        }
      }));

      const { mergeStacktapeDefaults } = await import('./misc');
      const resource: any = {
        type: 'function',
        properties: {
          tags: ['custom-tag']
        }
      };
      const result = mergeStacktapeDefaults(resource);
      expect(result.properties.tags).toContain('custom-tag');
      expect(result.properties.tags).toContain('default-tag');
    });

    test('should handle special merge behavior for containers', async () => {
      const { mergeStacktapeDefaults } = await import('./misc');
      const resource: any = {
        type: 'multi-container-workload',
        properties: {
          containers: [
            { name: 'app', image: 'nginx' },
            { name: 'sidecar', image: 'envoy' }
          ]
        }
      };
      const result = mergeStacktapeDefaults(resource);
      expect(result.properties.containers).toHaveLength(2);
    });
  });

  describe('cleanConfigForMinimalTemplateCompilerMode', () => {
    test('should remove budgetControl from config', async () => {
      const { cleanConfigForMinimalTemplateCompilerMode } = await import('./misc');
      const config: any = {
        serviceName: 'test',
        budgetControl: { maxCost: 100 },
        resources: {}
      };
      const result = cleanConfigForMinimalTemplateCompilerMode(config);
      expect(result.budgetControl).toBeUndefined();
    });

    test('should remove customDomains from config', async () => {
      const { cleanConfigForMinimalTemplateCompilerMode } = await import('./misc');
      const config: any = {
        serviceName: 'test',
        customDomains: ['example.com'],
        resources: {}
      };
      const result = cleanConfigForMinimalTemplateCompilerMode(config);
      expect(result.customDomains).toBeUndefined();
    });

    test('should remove directives from config', async () => {
      const { cleanConfigForMinimalTemplateCompilerMode } = await import('./misc');
      const config: any = {
        serviceName: 'test',
        directives: { myDirective: {} },
        resources: {}
      };
      const result = cleanConfigForMinimalTemplateCompilerMode(config);
      expect(result.directives).toBeUndefined();
    });

    test('should remove aws-cdk-construct resources', async () => {
      const { cleanConfigForMinimalTemplateCompilerMode } = await import('./misc');
      const config: any = {
        serviceName: 'test',
        resources: {
          myBucket: { type: 'bucket' },
          cdkConstruct: { type: 'aws-cdk-construct' },
          myFunction: { type: 'function' }
        }
      };
      const result = cleanConfigForMinimalTemplateCompilerMode(config);
      expect(result.resources.myBucket).toBeDefined();
      expect(result.resources.myFunction).toBeDefined();
      expect(result.resources.cdkConstruct).toBeUndefined();
    });

    test('should preserve other properties', async () => {
      const { cleanConfigForMinimalTemplateCompilerMode } = await import('./misc');
      const config: any = {
        serviceName: 'test-service',
        stage: 'production',
        resources: {
          myBucket: { type: 'bucket', properties: {} }
        }
      };
      const result = cleanConfigForMinimalTemplateCompilerMode(config);
      expect(result.serviceName).toBe('test-service');
      expect(result.stage).toBe('production');
      expect(result.resources.myBucket).toBeDefined();
    });

    test('should handle empty resources', async () => {
      const { cleanConfigForMinimalTemplateCompilerMode } = await import('./misc');
      const config: any = {
        serviceName: 'test',
        resources: {}
      };
      const result = cleanConfigForMinimalTemplateCompilerMode(config);
      expect(result.resources).toEqual({});
    });

    test('should handle config without resources', async () => {
      const { cleanConfigForMinimalTemplateCompilerMode } = await import('./misc');
      const config: any = {
        serviceName: 'test'
      };
      const result = cleanConfigForMinimalTemplateCompilerMode(config);
      expect(result).toBeDefined();
    });
  });
});
