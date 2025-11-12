import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@errors', () => ({
  stpErrors: {
    e44: mock(() => new Error('Listener port specified but load balancer has no custom listeners')),
    e45: mock(() => new Error('Referenced listener port not found')),
    e46: mock(() => new Error('Must specify listener port when load balancer has custom listeners')),
    e93: mock(() => new Error('Duplicate priority in load balancer integrations'))
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
    if (stpResourceReference === 'myLoadBalancer') {
      return {
        name: 'myLoadBalancer',
        listeners: []
      };
    }
    if (stpResourceReference === 'lbWithCustomListeners') {
      return {
        name: 'lbWithCustomListeners',
        listeners: [
          { port: 80, protocol: 'HTTP' },
          { port: 443, protocol: 'HTTPS', customCertificateArns: ['arn:aws:acm:us-east-1:123:cert/abc'] }
        ]
      };
    }
    return {
      name: stpResourceReference,
      listeners: []
    };
  })
}));

mock.module('../index', () => ({
  configManager: {
    allLambdasTriggerableUsingEvents: [],
    allContainerWorkloads: []
  }
}));

describe('application-load-balancers', () => {
  describe('resolveReferenceToApplicationLoadBalancer', () => {
    test('should resolve reference to load balancer with no custom listeners', async () => {
      const { resolveReferenceToApplicationLoadBalancer } = await import('./application-load-balancers');

      const reference: any = {
        loadBalancerName: 'myLoadBalancer'
      };

      const result = resolveReferenceToApplicationLoadBalancer(reference, 'myFunction', 'function');

      expect(result.loadBalancer.name).toBe('myLoadBalancer');
      expect(result.listenerPort).toBe(443);
      expect(result.protocol).toBe('HTTPS');
      expect(result.listenerHasCustomCerts).toBe(false);
    });

    test('should resolve reference with specific listener port', async () => {
      const { resolveReferenceToApplicationLoadBalancer } = await import('./application-load-balancers');

      const reference: any = {
        loadBalancerName: 'lbWithCustomListeners',
        listenerPort: 443
      };

      const result = resolveReferenceToApplicationLoadBalancer(reference, 'myService', 'web-service');

      expect(result.loadBalancer.name).toBe('lbWithCustomListeners');
      expect(result.listenerPort).toBe(443);
      expect(result.protocol).toBe('HTTPS');
      expect(result.listenerHasCustomCerts).toBe(true);
    });

    test('should resolve reference with HTTP listener', async () => {
      const { resolveReferenceToApplicationLoadBalancer } = await import('./application-load-balancers');

      const reference: any = {
        loadBalancerName: 'lbWithCustomListeners',
        listenerPort: 80
      };

      const result = resolveReferenceToApplicationLoadBalancer(reference, 'myService', 'web-service');

      expect(result.listenerPort).toBe(80);
      expect(result.protocol).toBe('HTTP');
      expect(result.listenerHasCustomCerts).toBe(false);
    });

    test('should throw error when listenerPort specified but LB has no custom listeners', async () => {
      const { resolveReferenceToApplicationLoadBalancer } = await import('./application-load-balancers');

      const reference: any = {
        loadBalancerName: 'myLoadBalancer',
        listenerPort: 8080
      };

      expect(() =>
        resolveReferenceToApplicationLoadBalancer(reference, 'myFunction', 'function')
      ).toThrow();
    });

    test('should throw error when listenerPort not found in custom listeners', async () => {
      const { resolveReferenceToApplicationLoadBalancer } = await import('./application-load-balancers');

      const reference: any = {
        loadBalancerName: 'lbWithCustomListeners',
        listenerPort: 8080
      };

      expect(() =>
        resolveReferenceToApplicationLoadBalancer(reference, 'myService', 'web-service')
      ).toThrow();
    });

    test('should throw error when LB has custom listeners but no listenerPort specified', async () => {
      const { resolveReferenceToApplicationLoadBalancer } = await import('./application-load-balancers');

      const reference: any = {
        loadBalancerName: 'lbWithCustomListeners'
      };

      expect(() =>
        resolveReferenceToApplicationLoadBalancer(reference, 'myService', 'web-service')
      ).toThrow();
    });

    test('should skip listener info resolution when resolveListenerInfo is false', async () => {
      const { resolveReferenceToApplicationLoadBalancer } = await import('./application-load-balancers');

      const reference: any = {
        loadBalancerName: 'lbWithCustomListeners'
      };

      const result = resolveReferenceToApplicationLoadBalancer(
        reference,
        'myService',
        'web-service',
        false
      );

      expect(result.loadBalancer.name).toBe('lbWithCustomListeners');
      expect(result.listenerPort).toBe(443);
      expect(result.protocol).toBe('HTTPS');
    });

    test('should set default containerPort to 0', async () => {
      const { resolveReferenceToApplicationLoadBalancer } = await import('./application-load-balancers');

      const reference: any = {
        loadBalancerName: 'myLoadBalancer'
      };

      const result = resolveReferenceToApplicationLoadBalancer(reference, 'myFunction', 'function');

      expect(result.containerPort).toBe(0);
    });

    test('should preserve properties from lb reference', async () => {
      const { resolveReferenceToApplicationLoadBalancer } = await import('./application-load-balancers');

      const reference: any = {
        loadBalancerName: 'myLoadBalancer',
        priority: 100,
        pathPattern: '/api/*'
      };

      const result = resolveReferenceToApplicationLoadBalancer(reference, 'myFunction', 'function');

      expect(result.priority).toBe(100);
      expect(result.pathPattern).toBe('/api/*');
    });
  });

  describe('getAllIntegrationsForApplicationLoadBalancerListener', () => {
    test('should return empty array when no integrations exist', async () => {
      const { getAllIntegrationsForApplicationLoadBalancerListener } = await import('./application-load-balancers');

      const result = getAllIntegrationsForApplicationLoadBalancerListener({
        stpLoadBalancerName: 'myLoadBalancer',
        listenerPort: 443
      });

      expect(result).toEqual([]);
    });

    test('should find lambda function integrations', async () => {
      const { configManager } = await import('../index');
      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'myFunction',
          events: [
            {
              type: 'application-load-balancer',
              properties: {
                loadBalancerName: 'myLoadBalancer',
                priority: 100
              } as any
            }
          ]
        } as any
      ];

      const { getAllIntegrationsForApplicationLoadBalancerListener } = await import('./application-load-balancers');

      const result = getAllIntegrationsForApplicationLoadBalancerListener({
        stpLoadBalancerName: 'myLoadBalancer',
        listenerPort: 443
      });

      expect(result.length).toBe(1);
      expect(result[0].workloadName).toBe('myFunction');
      expect(result[0].priority).toBe(100);
    });

    test('should find container workload integrations', async () => {
      const { configManager } = await import('../index');
      configManager.allContainerWorkloads = [
        {
          name: 'myService',
          containers: [
            {
              events: [
                {
                  type: 'application-load-balancer',
                  properties: {
                    loadBalancerName: 'myLoadBalancer',
                    priority: 200
                  } as any
                }
              ]
            }
          ]
        } as any
      ];

      const { getAllIntegrationsForApplicationLoadBalancerListener } = await import('./application-load-balancers');

      const result = getAllIntegrationsForApplicationLoadBalancerListener({
        stpLoadBalancerName: 'myLoadBalancer',
        listenerPort: 443
      });

      expect(result.length).toBe(1);
      expect(result[0].workloadName).toBe('myService');
      expect(result[0].priority).toBe(200);
    });

    test('should filter by listener port', async () => {
      const { configManager } = await import('../index');
      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'func1',
          events: [
            {
              type: 'application-load-balancer',
              properties: {
                loadBalancerName: 'lbWithCustomListeners',
                listenerPort: 80,
                priority: 100
              } as any
            }
          ]
        } as any,
        {
          name: 'func2',
          events: [
            {
              type: 'application-load-balancer',
              properties: {
                loadBalancerName: 'lbWithCustomListeners',
                listenerPort: 443,
                priority: 200
              } as any
            }
          ]
        } as any
      ];

      const { getAllIntegrationsForApplicationLoadBalancerListener } = await import('./application-load-balancers');

      const result = getAllIntegrationsForApplicationLoadBalancerListener({
        stpLoadBalancerName: 'lbWithCustomListeners',
        listenerPort: 80
      });

      expect(result.length).toBe(1);
      expect(result[0].workloadName).toBe('func1');
      expect(result[0].listenerPort).toBe(80);
    });

    test('should default listenerPort to 443 when not specified', async () => {
      const { configManager } = await import('../index');
      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'myFunction',
          events: [
            {
              type: 'application-load-balancer',
              properties: {
                loadBalancerName: 'myLoadBalancer',
                priority: 100
              } as any
            }
          ]
        } as any
      ];

      const { getAllIntegrationsForApplicationLoadBalancerListener } = await import('./application-load-balancers');

      const result = getAllIntegrationsForApplicationLoadBalancerListener({
        stpLoadBalancerName: 'myLoadBalancer',
        listenerPort: 443
      });

      expect(result.length).toBe(1);
      expect(result[0].listenerPort).toBe(443);
    });
  });

  describe('transformLoadBalancerToListenerForm', () => {
    test('should add default listeners when none defined', async () => {
      const { transformLoadBalancerToListenerForm } = await import('./application-load-balancers');

      const definition: any = {
        name: 'myLoadBalancer'
      };

      const result = transformLoadBalancerToListenerForm({ definition });

      expect(result.listeners).toBeDefined();
      expect(result.listeners.length).toBeGreaterThanOrEqual(2);
      expect(result.listeners.some(l => l.port === 80)).toBe(true);
      expect(result.listeners.some(l => l.port === 443)).toBe(true);
    });

    test('should add test listener when workload has beforeAllowTrafficFunction', async () => {
      const { configManager } = await import('../index');
      const { DEFAULT_TEST_LISTENER_PORT } = await import('./application-load-balancers');

      configManager.allContainerWorkloads = [
        {
          name: 'myService',
          deployment: {
            beforeAllowTrafficFunction: 'testFunction'
          },
          containers: [
            {
              events: [
                {
                  type: 'application-load-balancer',
                  properties: {
                    loadBalancerName: 'myLoadBalancer'
                  } as any
                }
              ]
            }
          ]
        } as any
      ];

      const { transformLoadBalancerToListenerForm } = await import('./application-load-balancers');

      const definition: any = {
        name: 'myLoadBalancer'
      };

      const result = transformLoadBalancerToListenerForm({ definition });

      expect(result.listeners.some(l => l.port === DEFAULT_TEST_LISTENER_PORT)).toBe(true);
    });

    test('should keep existing listeners unchanged', async () => {
      const { transformLoadBalancerToListenerForm } = await import('./application-load-balancers');

      const definition: any = {
        name: 'myLoadBalancer',
        listeners: [
          { port: 8080, protocol: 'HTTP' },
          { port: 8443, protocol: 'HTTPS' }
        ]
      };

      const result = transformLoadBalancerToListenerForm({ definition });

      expect(result.listeners).toEqual(definition.listeners);
      expect(result.listeners.length).toBe(2);
    });

    test('should add HTTP to HTTPS redirect listener', async () => {
      const { transformLoadBalancerToListenerForm } = await import('./application-load-balancers');

      const definition: any = {
        name: 'myLoadBalancer'
      };

      const result = transformLoadBalancerToListenerForm({ definition });

      const httpListener = result.listeners.find(l => l.port === 80);
      expect(httpListener).toBeDefined();
      expect(httpListener.protocol).toBe('HTTP');
      expect(httpListener.defaultAction.type).toBe('redirect');
      expect(httpListener.defaultAction.properties.protocol).toBe('HTTPS');
      expect(httpListener.defaultAction.properties.statusCode).toBe('HTTP_301');
    });
  });

  describe('validateApplicationLoadBalancerConfig', () => {
    test('should validate load balancer with no listeners', async () => {
      const { validateApplicationLoadBalancerConfig } = await import('./application-load-balancers');

      const definition: any = {
        name: 'myLoadBalancer'
      };

      expect(() => validateApplicationLoadBalancerConfig({ definition })).not.toThrow();
    });

    test('should throw error for duplicate listener ports', async () => {
      const { validateApplicationLoadBalancerConfig } = await import('./application-load-balancers');

      const definition: any = {
        name: 'myLoadBalancer',
        listeners: [
          { port: 80, protocol: 'HTTP' },
          { port: 80, protocol: 'HTTPS' }
        ]
      };

      expect(() => validateApplicationLoadBalancerConfig({ definition })).toThrow('same port');
    });

    test('should allow different listener ports', async () => {
      const { validateApplicationLoadBalancerConfig } = await import('./application-load-balancers');

      const definition: any = {
        name: 'myLoadBalancer',
        listeners: [
          { port: 80, protocol: 'HTTP' },
          { port: 443, protocol: 'HTTPS' },
          { port: 8080, protocol: 'HTTP' }
        ]
      };

      expect(() => validateApplicationLoadBalancerConfig({ definition })).not.toThrow();
    });

    test('should validate integrations for duplicate priorities', async () => {
      const { configManager } = await import('../index');

      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'func1',
          events: [
            {
              type: 'application-load-balancer',
              properties: {
                loadBalancerName: 'testLB',
                priority: 100
              } as any
            }
          ]
        } as any,
        {
          name: 'func2',
          events: [
            {
              type: 'application-load-balancer',
              properties: {
                loadBalancerName: 'testLB',
                priority: 100
              } as any
            }
          ]
        } as any
      ];

      const { validateApplicationLoadBalancerConfig } = await import('./application-load-balancers');

      const definition: any = {
        name: 'testLB',
        listeners: [{ port: 443, protocol: 'HTTPS' }]
      };

      expect(() => validateApplicationLoadBalancerConfig({ definition })).toThrow();
    });
  });

  describe('DEFAULT_TEST_LISTENER_PORT', () => {
    test('should be defined', async () => {
      const { DEFAULT_TEST_LISTENER_PORT } = await import('./application-load-balancers');
      expect(DEFAULT_TEST_LISTENER_PORT).toBeDefined();
      expect(typeof DEFAULT_TEST_LISTENER_PORT).toBe('number');
    });

    test('should be 8080', async () => {
      const { DEFAULT_TEST_LISTENER_PORT } = await import('./application-load-balancers');
      expect(DEFAULT_TEST_LISTENER_PORT).toBe(8080);
    });
  });
});
