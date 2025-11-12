import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@domain-services/config-manager', () => ({
  configManager: {
    allContainerWorkloads: []
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e116: mock(() => new Error('Network load balancer listener must have exactly one integration'))
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

mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference }) => {
    if (stpResourceReference === 'myNetworkLB') {
      return {
        name: 'myNetworkLB',
        listeners: [
          { port: 80, protocol: 'TCP' },
          { port: 443, protocol: 'TLS', customCertificateArns: ['arn:aws:acm:us-east-1:123:cert/abc'] }
        ]
      };
    }
    if (stpResourceReference === 'nlbNoListeners') {
      return {
        name: 'nlbNoListeners',
        listeners: []
      };
    }
    return {
      name: stpResourceReference,
      listeners: [{ port: 443, protocol: 'TLS' }]
    };
  })
}));

describe('network-load-balancers', () => {
  describe('resolveReferenceToNetworkLoadBalancer', () => {
    test('should resolve reference to network load balancer', async () => {
      const { resolveReferenceToNetworkLoadBalancer } = await import('./network-load-balancers');

      const reference: any = {
        loadBalancerName: 'myNetworkLB',
        listenerPort: 443
      };

      const result = resolveReferenceToNetworkLoadBalancer(reference, 'myService', 'web-service');

      expect(result.loadBalancer.name).toBe('myNetworkLB');
      expect(result.listenerPort).toBe(443);
      expect(result.protocol).toBe('TLS');
      expect(result.listenerHasCustomCerts).toBe(true);
    });

    test('should resolve reference with TCP protocol', async () => {
      const { resolveReferenceToNetworkLoadBalancer } = await import('./network-load-balancers');

      const reference: any = {
        loadBalancerName: 'myNetworkLB',
        listenerPort: 80
      };

      const result = resolveReferenceToNetworkLoadBalancer(reference, 'myService', 'web-service');

      expect(result.listenerPort).toBe(80);
      expect(result.protocol).toBe('TCP');
      expect(result.listenerHasCustomCerts).toBe(false);
    });

    test('should default to TLS protocol when not specified', async () => {
      const { resolveReferenceToNetworkLoadBalancer } = await import('./network-load-balancers');

      const reference: any = {
        loadBalancerName: 'defaultLB',
        listenerPort: 443
      };

      const result = resolveReferenceToNetworkLoadBalancer(reference, 'myService', 'web-service');

      expect(result.protocol).toBe('TLS');
    });

    test('should throw error when listener port not found', async () => {
      const { resolveReferenceToNetworkLoadBalancer } = await import('./network-load-balancers');

      const reference: any = {
        loadBalancerName: 'myNetworkLB',
        listenerPort: 8080
      };

      expect(() =>
        resolveReferenceToNetworkLoadBalancer(reference, 'myService', 'web-service')
      ).toThrow('No listener found for port');
    });

    test('should preserve properties from reference', async () => {
      const { resolveReferenceToNetworkLoadBalancer } = await import('./network-load-balancers');

      const reference: any = {
        loadBalancerName: 'myNetworkLB',
        listenerPort: 443,
        containerPort: 8080,
        healthCheckPath: '/health'
      };

      const result = resolveReferenceToNetworkLoadBalancer(reference, 'myService', 'web-service');

      expect(result.containerPort).toBe(8080);
      expect(result.healthCheckPath).toBe('/health');
    });

    test('should handle load balancer without custom certificates', async () => {
      const { resolveReferenceToNetworkLoadBalancer } = await import('./network-load-balancers');

      const reference: any = {
        loadBalancerName: 'defaultLB',
        listenerPort: 443
      };

      const result = resolveReferenceToNetworkLoadBalancer(reference, 'myService', 'web-service');

      expect(result.listenerHasCustomCerts).toBe(false);
    });
  });

  describe('getAllIntegrationsForNetworkLoadBalancerListener', () => {
    test('should return empty array when no integrations exist', async () => {
      const { getAllIntegrationsForNetworkLoadBalancerListener } = await import('./network-load-balancers');

      const result = getAllIntegrationsForNetworkLoadBalancerListener({
        stpLoadBalancerName: 'myNetworkLB',
        listenerPort: 443
      });

      expect(result).toEqual([]);
    });

    test('should find container workload integrations', async () => {
      const { configManager } = await import('@domain-services/config-manager');
      configManager.allContainerWorkloads = [
        {
          name: 'myService',
          containers: [
            {
              events: [
                {
                  type: 'network-load-balancer',
                  properties: {
                    loadBalancerName: 'myNetworkLB',
                    listenerPort: 443,
                    containerPort: 8080
                  } as any
                }
              ]
            }
          ]
        } as any
      ];

      const { getAllIntegrationsForNetworkLoadBalancerListener } = await import('./network-load-balancers');

      const result = getAllIntegrationsForNetworkLoadBalancerListener({
        stpLoadBalancerName: 'myNetworkLB',
        listenerPort: 443
      });

      expect(result.length).toBe(1);
      expect(result[0].workloadName).toBe('myService');
      expect(result[0].listenerPort).toBe(443);
      expect(result[0].containerPort).toBe(8080);
    });

    test('should filter by listener port', async () => {
      const { configManager } = await import('@domain-services/config-manager');
      configManager.allContainerWorkloads = [
        {
          name: 'service1',
          containers: [
            {
              events: [
                {
                  type: 'network-load-balancer',
                  properties: {
                    loadBalancerName: 'myNetworkLB',
                    listenerPort: 80,
                    containerPort: 8080
                  } as any
                }
              ]
            }
          ]
        } as any,
        {
          name: 'service2',
          containers: [
            {
              events: [
                {
                  type: 'network-load-balancer',
                  properties: {
                    loadBalancerName: 'myNetworkLB',
                    listenerPort: 443,
                    containerPort: 8443
                  } as any
                }
              ]
            }
          ]
        } as any
      ];

      const { getAllIntegrationsForNetworkLoadBalancerListener } = await import('./network-load-balancers');

      const result = getAllIntegrationsForNetworkLoadBalancerListener({
        stpLoadBalancerName: 'myNetworkLB',
        listenerPort: 80
      });

      expect(result.length).toBe(1);
      expect(result[0].workloadName).toBe('service1');
      expect(result[0].listenerPort).toBe(80);
    });

    test('should default listenerPort to 443 when not specified', async () => {
      const { configManager } = await import('@domain-services/config-manager');
      configManager.allContainerWorkloads = [
        {
          name: 'myService',
          containers: [
            {
              events: [
                {
                  type: 'network-load-balancer',
                  properties: {
                    loadBalancerName: 'defaultLB',
                    containerPort: 8080
                  } as any
                }
              ]
            }
          ]
        } as any
      ];

      const { getAllIntegrationsForNetworkLoadBalancerListener } = await import('./network-load-balancers');

      const result = getAllIntegrationsForNetworkLoadBalancerListener({
        stpLoadBalancerName: 'defaultLB',
        listenerPort: 443
      });

      expect(result.length).toBe(1);
      expect(result[0].listenerPort).toBe(443);
    });

    test('should handle multiple containers in single workload', async () => {
      const { configManager } = await import('@domain-services/config-manager');
      configManager.allContainerWorkloads = [
        {
          name: 'myService',
          containers: [
            {
              events: [
                {
                  type: 'network-load-balancer',
                  properties: {
                    loadBalancerName: 'myNetworkLB',
                    listenerPort: 443,
                    containerPort: 8080
                  } as any
                }
              ]
            },
            {
              events: [
                {
                  type: 'http-api-gateway',
                  properties: {
                    httpApiGatewayName: 'myApi'
                  } as any
                }
              ]
            }
          ]
        } as any
      ];

      const { getAllIntegrationsForNetworkLoadBalancerListener } = await import('./network-load-balancers');

      const result = getAllIntegrationsForNetworkLoadBalancerListener({
        stpLoadBalancerName: 'myNetworkLB',
        listenerPort: 443
      });

      expect(result.length).toBe(1);
      expect(result[0].workloadName).toBe('myService');
    });

    test('should skip containers without events', async () => {
      const { configManager } = await import('@domain-services/config-manager');
      configManager.allContainerWorkloads = [
        {
          name: 'myService',
          containers: [
            {
              // no events
            }
          ]
        } as any
      ];

      const { getAllIntegrationsForNetworkLoadBalancerListener } = await import('./network-load-balancers');

      const result = getAllIntegrationsForNetworkLoadBalancerListener({
        stpLoadBalancerName: 'myNetworkLB',
        listenerPort: 443
      });

      expect(result.length).toBe(0);
    });
  });

  describe('validateNetworkLoadBalancerConfig', () => {
    test('should validate load balancer with unique listener ports', async () => {
      const { validateNetworkLoadBalancerConfig } = await import('./network-load-balancers');

      const definition: any = {
        name: 'myNetworkLB',
        listeners: [
          { port: 80, protocol: 'TCP' },
          { port: 443, protocol: 'TLS' },
          { port: 8080, protocol: 'TCP' }
        ]
      };

      // Should set up workload integration for validation
      const { configManager } = await import('@domain-services/config-manager');
      configManager.allContainerWorkloads = [
        {
          name: 'myService',
          containers: [
            {
              events: [
                {
                  type: 'network-load-balancer',
                  properties: {
                    loadBalancerName: 'myNetworkLB',
                    listenerPort: 80,
                    containerPort: 8080
                  } as any
                }
              ]
            }
          ]
        } as any,
        {
          name: 'myService2',
          containers: [
            {
              events: [
                {
                  type: 'network-load-balancer',
                  properties: {
                    loadBalancerName: 'myNetworkLB',
                    listenerPort: 443,
                    containerPort: 8443
                  } as any
                }
              ]
            }
          ]
        } as any,
        {
          name: 'myService3',
          containers: [
            {
              events: [
                {
                  type: 'network-load-balancer',
                  properties: {
                    loadBalancerName: 'myNetworkLB',
                    listenerPort: 8080,
                    containerPort: 9000
                  } as any
                }
              ]
            }
          ]
        } as any
      ];

      expect(() => validateNetworkLoadBalancerConfig({ definition })).not.toThrow();
    });

    test('should throw error for duplicate listener ports', async () => {
      const { validateNetworkLoadBalancerConfig } = await import('./network-load-balancers');

      const definition: any = {
        name: 'myNetworkLB',
        listeners: [
          { port: 80, protocol: 'TCP' },
          { port: 80, protocol: 'TLS' }
        ]
      };

      expect(() => validateNetworkLoadBalancerConfig({ definition })).toThrow('same port');
    });

    test('should throw error when listener has no integrations', async () => {
      const { configManager } = await import('@domain-services/config-manager');
      configManager.allContainerWorkloads = [];

      const { validateNetworkLoadBalancerConfig } = await import('./network-load-balancers');

      const definition: any = {
        name: 'testNLB',
        listeners: [{ port: 443, protocol: 'TLS' }]
      };

      expect(() => validateNetworkLoadBalancerConfig({ definition })).toThrow();
    });

    test('should throw error when listener has multiple integrations', async () => {
      const { configManager } = await import('@domain-services/config-manager');
      configManager.allContainerWorkloads = [
        {
          name: 'service1',
          containers: [
            {
              events: [
                {
                  type: 'network-load-balancer',
                  properties: {
                    loadBalancerName: 'testNLB',
                    listenerPort: 443,
                    containerPort: 8080
                  } as any
                }
              ]
            }
          ]
        } as any,
        {
          name: 'service2',
          containers: [
            {
              events: [
                {
                  type: 'network-load-balancer',
                  properties: {
                    loadBalancerName: 'testNLB',
                    listenerPort: 443,
                    containerPort: 8443
                  } as any
                }
              ]
            }
          ]
        } as any
      ];

      const { validateNetworkLoadBalancerConfig } = await import('./network-load-balancers');

      const definition: any = {
        name: 'testNLB',
        listeners: [{ port: 443, protocol: 'TLS' }]
      };

      expect(() => validateNetworkLoadBalancerConfig({ definition })).toThrow();
    });

    test('should validate each listener independently', async () => {
      const { configManager } = await import('@domain-services/config-manager');
      configManager.allContainerWorkloads = [
        {
          name: 'service1',
          containers: [
            {
              events: [
                {
                  type: 'network-load-balancer',
                  properties: {
                    loadBalancerName: 'multiNLB',
                    listenerPort: 80,
                    containerPort: 8080
                  } as any
                }
              ]
            }
          ]
        } as any,
        {
          name: 'service2',
          containers: [
            {
              events: [
                {
                  type: 'network-load-balancer',
                  properties: {
                    loadBalancerName: 'multiNLB',
                    listenerPort: 443,
                    containerPort: 8443
                  } as any
                }
              ]
            }
          ]
        } as any
      ];

      const { validateNetworkLoadBalancerConfig } = await import('./network-load-balancers');

      const definition: any = {
        name: 'multiNLB',
        listeners: [
          { port: 80, protocol: 'TCP' },
          { port: 443, protocol: 'TLS' }
        ]
      };

      expect(() => validateNetworkLoadBalancerConfig({ definition })).not.toThrow();
    });
  });
});
