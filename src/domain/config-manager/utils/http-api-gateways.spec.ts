import { describe, expect, mock, test } from 'bun:test';

// Mock errors
mock.module('@errors', () => ({
  stpErrors: {
    e92: mock(({ stpHttpApiGatewayName, stpResourceName1, stpResourceName2 }) =>
      new Error(`Duplicate route in ${stpHttpApiGatewayName}: ${stpResourceName1} and ${stpResourceName2}`)
    )
  }
}));

// Mock config manager
mock.module('../index.js', () => ({
  configManager: {
    allLambdasTriggerableUsingEvents: [],
    allContainerWorkloads: []
  }
}));

// Mock resource references
mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference, stpResourceType }) => ({
    name: stpResourceReference,
    type: stpResourceType
  }))
}));

describe('config-manager/utils/http-api-gateways', () => {
  describe('resolveReferenceToHttpApiGateway', () => {
    test('should call getPropsOfResourceReferencedInConfig with correct resource type', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToHttpApiGateway } = await import('./http-api-gateways');

      resolveReferenceToHttpApiGateway({
        stpResourceReference: 'myApi',
        referencedFrom: 'myLambda'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'myApi',
        stpResourceType: 'http-api-gateway',
        referencedFrom: 'myLambda',
        referencedFromType: undefined
      });
    });

    test('should pass referencedFromType to getPropsOfResourceReferencedInConfig', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToHttpApiGateway } = await import('./http-api-gateways');

      resolveReferenceToHttpApiGateway({
        stpResourceReference: 'api1',
        referencedFrom: 'myResource',
        referencedFromType: 'lambda-function'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'api1',
        stpResourceType: 'http-api-gateway',
        referencedFrom: 'myResource',
        referencedFromType: 'lambda-function'
      });
    });

    test('should return result from getPropsOfResourceReferencedInConfig', async () => {
      const { resolveReferenceToHttpApiGateway } = await import('./http-api-gateways');

      const result = resolveReferenceToHttpApiGateway({
        stpResourceReference: 'myApi',
        referencedFrom: 'myResource'
      });

      expect(result.name).toBe('myApi');
      expect(result.type).toBe('http-api-gateway');
    });
  });

  describe('getDefaultHttpApiCorsAllowedMethods', () => {
    test('should return OPTIONS for API with no integrations', async () => {
      const { configManager } = await import('../index.js');
      const { getDefaultHttpApiCorsAllowedMethods } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [];
      configManager.allContainerWorkloads = [];

      const resource: any = {
        nameChain: ['myApi']
      };

      const result = getDefaultHttpApiCorsAllowedMethods({ resource });

      expect(result).toEqual(['OPTIONS']);
    });

    test('should include GET method from lambda integration', async () => {
      const { configManager } = await import('../index.js');
      const { getDefaultHttpApiCorsAllowedMethods } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'myLambda',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'myApi',
                method: 'GET',
                path: '/users'
              }
            }
          ]
        } as any
      ];
      configManager.allContainerWorkloads = [];

      const resource: any = {
        nameChain: ['myApi']
      };

      const result = getDefaultHttpApiCorsAllowedMethods({ resource });

      expect(result).toContain('GET');
      expect(result).toContain('OPTIONS');
    });

    test('should deduplicate methods', async () => {
      const { configManager } = await import('../index.js');
      const { getDefaultHttpApiCorsAllowedMethods } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'lambda1',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'myApi',
                method: 'GET',
                path: '/users'
              }
            }
          ]
        } as any,
        {
          name: 'lambda2',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'myApi',
                method: 'GET',
                path: '/posts'
              }
            }
          ]
        } as any
      ];

      const resource: any = {
        nameChain: ['myApi']
      };

      const result = getDefaultHttpApiCorsAllowedMethods({ resource });

      expect(result.filter((m) => m === 'GET').length).toBe(1);
    });

    test('should include multiple methods', async () => {
      const { configManager } = await import('../index.js');
      const { getDefaultHttpApiCorsAllowedMethods } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'lambda1',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'myApi',
                method: 'GET',
                path: '/users'
              }
            }
          ]
        } as any,
        {
          name: 'lambda2',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'myApi',
                method: 'POST',
                path: '/users'
              }
            }
          ]
        } as any
      ];

      const resource: any = {
        nameChain: ['myApi']
      };

      const result = getDefaultHttpApiCorsAllowedMethods({ resource });

      expect(result).toContain('GET');
      expect(result).toContain('POST');
      expect(result).toContain('OPTIONS');
    });
  });

  describe('getAllIntegrationsForHttpApiGateway', () => {
    test('should return empty array when no integrations exist', async () => {
      const { configManager } = await import('../index.js');
      const { getAllIntegrationsForHttpApiGateway } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [];
      configManager.allContainerWorkloads = [];

      const resource: any = {
        nameChain: ['myApi']
      };

      const result = getAllIntegrationsForHttpApiGateway({ resource });

      expect(result).toEqual([]);
    });

    test('should find lambda integration', async () => {
      const { configManager } = await import('../index.js');
      const { getAllIntegrationsForHttpApiGateway } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'myLambda',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'myApi',
                method: 'GET',
                path: '/users'
              }
            }
          ]
        } as any
      ];

      const resource: any = {
        nameChain: ['myApi']
      };

      const result = getAllIntegrationsForHttpApiGateway({ resource });

      expect(result.length).toBe(1);
      expect(result[0].workloadName).toBe('myLambda');
      expect(result[0].properties.method).toBe('GET');
    });

    test('should find container workload integration', async () => {
      const { configManager } = await import('../index.js');
      const { getAllIntegrationsForHttpApiGateway } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [];
      configManager.allContainerWorkloads = [
        {
          name: 'myContainer',
          containers: [
            {
              events: [
                {
                  type: 'http-api-gateway',
                  properties: {
                    httpApiGatewayName: 'myApi',
                    method: 'POST',
                    path: '/data'
                  }
                }
              ]
            }
          ]
        } as any
      ];

      const resource: any = {
        nameChain: ['myApi']
      };

      const result = getAllIntegrationsForHttpApiGateway({ resource });

      expect(result.length).toBe(1);
      expect(result[0].workloadName).toBe('myContainer');
      expect(result[0].properties.method).toBe('POST');
    });

    test('should handle nested API gateway names', async () => {
      const { configManager } = await import('../index.js');
      const { getAllIntegrationsForHttpApiGateway } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'myLambda',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'app.api',
                method: 'GET',
                path: '/users'
              }
            }
          ]
        } as any
      ];

      const resource: any = {
        nameChain: ['app', 'api']
      };

      const result = getAllIntegrationsForHttpApiGateway({ resource });

      expect(result.length).toBe(1);
    });

    test('should ignore integrations for different API gateways', async () => {
      const { configManager } = await import('../index.js');
      const { getAllIntegrationsForHttpApiGateway } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'lambda1',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'otherApi',
                method: 'GET',
                path: '/users'
              }
            }
          ]
        } as any
      ];

      const resource: any = {
        nameChain: ['myApi']
      };

      const result = getAllIntegrationsForHttpApiGateway({ resource });

      expect(result).toEqual([]);
    });

    test('should handle lambda without events', async () => {
      const { configManager } = await import('../index.js');
      const { getAllIntegrationsForHttpApiGateway } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'myLambda'
          // No events
        } as any
      ];

      const resource: any = {
        nameChain: ['myApi']
      };

      const result = getAllIntegrationsForHttpApiGateway({ resource });

      expect(result).toEqual([]);
    });
  });

  describe('validateHttpApiGatewayConfig', () => {
    test('should not throw for valid config with no integrations', async () => {
      const { configManager } = await import('../index.js');
      const { validateHttpApiGatewayConfig } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [];
      configManager.allContainerWorkloads = [];

      const resource: any = {
        name: 'myApi',
        nameChain: ['myApi']
      };

      expect(() => validateHttpApiGatewayConfig({ resource })).not.toThrow();
    });

    test('should not throw for unique routes', async () => {
      const { configManager } = await import('../index.js');
      const { validateHttpApiGatewayConfig } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'lambda1',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'myApi',
                method: 'GET',
                path: '/users'
              }
            }
          ]
        } as any,
        {
          name: 'lambda2',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'myApi',
                method: 'POST',
                path: '/users'
              }
            }
          ]
        } as any
      ];

      const resource: any = {
        name: 'myApi',
        nameChain: ['myApi']
      };

      expect(() => validateHttpApiGatewayConfig({ resource })).not.toThrow();
    });

    test('should throw for duplicate routes', async () => {
      const { configManager } = await import('../index.js');
      const { stpErrors } = await import('@errors');
      const { validateHttpApiGatewayConfig } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'lambda1',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'myApi',
                method: 'GET',
                path: '/users'
              }
            }
          ]
        } as any,
        {
          name: 'lambda2',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'myApi',
                method: 'GET',
                path: '/users'
              }
            }
          ]
        } as any
      ];

      const resource: any = {
        name: 'myApi',
        nameChain: ['myApi']
      };

      try {
        validateHttpApiGatewayConfig({ resource });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(stpErrors.e92).toHaveBeenCalledWith({
          stpHttpApiGatewayName: 'myApi',
          stpResourceName1: 'lambda2',
          stpResourceName2: 'lambda1'
        });
      }
    });

    test('should allow same path with different methods', async () => {
      const { configManager } = await import('../index.js');
      const { validateHttpApiGatewayConfig } = await import('./http-api-gateways');

      configManager.allLambdasTriggerableUsingEvents = [
        {
          name: 'lambda1',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'myApi',
                method: 'GET',
                path: '/users'
              }
            }
          ]
        } as any,
        {
          name: 'lambda2',
          events: [
            {
              type: 'http-api-gateway',
              properties: {
                httpApiGatewayName: 'myApi',
                method: 'DELETE',
                path: '/users'
              }
            }
          ]
        } as any
      ];

      const resource: any = {
        name: 'myApi',
        nameChain: ['myApi']
      };

      expect(() => validateHttpApiGatewayConfig({ resource })).not.toThrow();
    });
  });
});
