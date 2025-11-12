import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@errors', () => ({
  stpErrors: {
    e54: mock(() => new Error('Deployment config requires load balancer events')),
    e61: mock(() => new Error('All load balancer events must target same container/port/listener')),
    e75: mock(() => new Error('Service connect workloads cannot use deployment config')),
    e87: mock(() => new Error('Resources must specify either instanceTypes or cpu/memory')),
    e89: mock(() => new Error('Invalid scaling configuration')),
    e125: mock(() => new Error('Warm pool requires exactly one instance type')),
    e126: mock(() => new Error('Cannot specify both instanceTypes and architecture'))
  }
}));

mock.module('@shared/aws/fargate', () => ({
  ALLOWED_MEMORY_VALUES_FOR_CPU: {
    256: [512, 1024, 2048],
    512: [1024, 2048, 3072, 4096],
    1024: [2048, 3072, 4096, 5120, 6144, 7168, 8192],
    2048: [4096, 5120, 6144, 7168, 8192, 9216, 10240, 11264, 12288, 13312, 14336, 15360, 16384],
    4096: [8192, 9216, 10240, 11264, 12288, 13312, 14336, 15360, 16384]
  }
}));

mock.module('@utils/errors', () => ({
  ExpectedError: class ExpectedError extends Error {
    type: string;
    hint: string | string[];
    constructor(type: string, message: string, hint?: string | string[]) {
      super(message);
      this.type = type;
      this.hint = hint;
      this.name = 'ExpectedError';
    }
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    colorize: mock((color, text) => text)
  }
}));

mock.module('../index', () => ({
  configManager: {
    serviceConnectContainerWorkloadsAssociations: {}
  }
}));

describe('multi-container-workloads', () => {
  describe('validateMultiContainerWorkloadConfig', () => {
    test('should validate workload with unique container names', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [
          { name: 'app', events: [] },
          { name: 'sidecar', events: [] }
        ],
        resources: {
          cpu: 256,
          memory: 512
        },
        scaling: {
          minInstances: 1,
          maxInstances: 10
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).not.toThrow();
    });

    test('should throw error for duplicate container names', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [
          { name: 'app', events: [] },
          { name: 'app', events: [] }
        ],
        resources: {
          cpu: 256,
          memory: 512
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow('same name');
    });

    test('should throw error when container depends on non-existent container', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [
          { name: 'app', events: [], dependsOn: [{ containerName: 'nonexistent', condition: 'START' }] }
        ],
        resources: {
          cpu: 256,
          memory: 512
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow('depends on non-existent');
    });

    test('should validate valid container dependencies', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [
          { name: 'init', events: [] },
          { name: 'app', events: [], dependsOn: [{ containerName: 'init', condition: 'COMPLETE' }] }
        ],
        resources: {
          cpu: 256,
          memory: 512
        },
        scaling: {
          minInstances: 1,
          maxInstances: 5
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).not.toThrow();
    });

    test('should throw error for port overlap within same container (tcp/udp)', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [
          {
            name: 'app',
            events: [
              { type: 'application-load-balancer', properties: { containerPort: 8080, loadBalancerName: 'lb' } },
              { type: 'network-load-balancer-udp', properties: { containerPort: 8080, loadBalancerName: 'nlb' } }
            ]
          }
        ],
        resources: {
          cpu: 256,
          memory: 512
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow('Port overlap');
    });

    test('should throw error for port overlap between containers', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [
          {
            name: 'app1',
            events: [
              { type: 'application-load-balancer', properties: { containerPort: 8080, loadBalancerName: 'lb' } }
            ]
          },
          {
            name: 'app2',
            events: [
              { type: 'http-api-gateway', properties: { containerPort: 8080, httpApiGatewayName: 'api' } }
            ]
          }
        ],
        resources: {
          cpu: 256,
          memory: 512
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow('Port overlap');
    });

    test('should allow same port in different containers if no overlap', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [
          {
            name: 'app1',
            events: [
              { type: 'application-load-balancer', properties: { containerPort: 8080, loadBalancerName: 'lb' } }
            ]
          },
          {
            name: 'app2',
            events: [
              { type: 'application-load-balancer', properties: { containerPort: 9090, loadBalancerName: 'lb' } }
            ]
          }
        ],
        resources: {
          cpu: 256,
          memory: 512
        },
        scaling: {
          minInstances: 1,
          maxInstances: 3
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).not.toThrow();
    });

    test('should throw error when deployment config exists without load balancer events', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [
          {
            name: 'app',
            events: [
              { type: 'http-api-gateway', properties: { containerPort: 8080, httpApiGatewayName: 'api' } }
            ]
          }
        ],
        deployment: {
          beforeAllowTrafficFunction: 'testFunction'
        },
        resources: {
          cpu: 256,
          memory: 512
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow();
    });

    test('should validate deployment config with load balancer events', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [
          {
            name: 'app',
            events: [
              { type: 'application-load-balancer', properties: { containerPort: 8080, loadBalancerName: 'lb' } }
            ]
          }
        ],
        deployment: {
          beforeAllowTrafficFunction: 'testFunction'
        },
        resources: {
          cpu: 256,
          memory: 512
        },
        scaling: {
          minInstances: 2,
          maxInstances: 10
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).not.toThrow();
    });

    test('should throw error when LB events target different containers', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [
          {
            name: 'app1',
            events: [
              { type: 'application-load-balancer', properties: { containerPort: 8080, loadBalancerName: 'lb' } }
            ]
          },
          {
            name: 'app2',
            events: [
              { type: 'application-load-balancer', properties: { containerPort: 9090, loadBalancerName: 'lb' } }
            ]
          }
        ],
        deployment: {
          beforeAllowTrafficFunction: 'testFunction'
        },
        resources: {
          cpu: 256,
          memory: 512
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow();
    });

    test('should throw error for service connect with deployment config', async () => {
      const { configManager } = await import('../index');
      configManager.serviceConnectContainerWorkloadsAssociations = {
        myWorkload: true
      };

      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [{ name: 'app', events: [] }],
        deployment: {
          beforeAllowTrafficFunction: 'testFunction'
        },
        resources: {
          cpu: 256,
          memory: 512
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow();
    });

    test('should throw error when neither instanceTypes nor cpu/memory specified', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [{ name: 'app', events: [] }],
        resources: {}
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow();
    });

    test('should validate Fargate memory setting with valid cpu/memory combo', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [{ name: 'app', events: [] }],
        resources: {
          cpu: 1024,
          memory: 2048
        },
        scaling: {
          minInstances: 1,
          maxInstances: 5
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).not.toThrow();
    });

    test('should throw error for invalid Fargate memory setting', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [{ name: 'app', events: [] }],
        resources: {
          cpu: 256,
          memory: 4096 // Invalid for 256 CPU
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow('not compatible');
    });

    test('should throw error when scaling maxInstances < minInstances', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [{ name: 'app', events: [] }],
        resources: {
          cpu: 256,
          memory: 512
        },
        scaling: {
          minInstances: 10,
          maxInstances: 5
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow();
    });

    test('should throw error when scaling maxInstances not specified', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [{ name: 'app', events: [] }],
        resources: {
          cpu: 256,
          memory: 512
        },
        scaling: {
          minInstances: 1
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow();
    });

    test('should throw error when warm pool enabled with multiple instance types', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [{ name: 'app', events: [] }],
        resources: {
          instanceTypes: ['t3.small', 't3.medium'],
          enableWarmPool: true
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow();
    });

    test('should throw error when warm pool enabled without instance types', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [{ name: 'app', events: [] }],
        resources: {
          cpu: 256,
          memory: 512,
          enableWarmPool: true
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow();
    });

    test('should throw error when both instanceTypes and architecture specified', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [{ name: 'app', events: [] }],
        resources: {
          instanceTypes: ['t3.small'],
          architecture: 'arm64'
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).toThrow();
    });

    test('should allow architecture without instance types', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [{ name: 'app', events: [] }],
        resources: {
          cpu: 256,
          memory: 512,
          architecture: 'arm64'
        },
        scaling: {
          minInstances: 1,
          maxInstances: 5
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).not.toThrow();
    });

    test('should allow instance types without architecture', async () => {
      const { validateMultiContainerWorkloadConfig } = await import('./multi-container-workloads');

      const definition: any = {
        name: 'myWorkload',
        type: 'web-service',
        configParentResourceType: 'web-service',
        containers: [{ name: 'app', events: [] }],
        resources: {
          instanceTypes: ['t3.small', 't3.medium']
        }
      };

      expect(() => validateMultiContainerWorkloadConfig({ definition })).not.toThrow();
    });
  });
});
