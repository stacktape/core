import { describe, expect, mock, test } from 'bun:test';

// Mock errors
mock.module('@errors', () => ({
  stpErrors: {
    e79: mock(({ webServiceName }) => new Error(`Deployment not supported for ${webServiceName}`)),
    e80: mock(({ webServiceName }) => new Error(`Alarm type mismatch for ${webServiceName}`)),
    e1003: mock(({ webServiceName }) => new Error(`Firewall not supported for ${webServiceName}`)),
    e117: mock(({ webServiceName }) => new Error(`CDN not supported for ${webServiceName}`)),
    e118: mock(({ webServiceName }) => new Error(`Custom certificate required for ${webServiceName}`))
  }
}));

describe('config-manager/utils/web-services', () => {
  describe('validateWebServiceConfig', () => {
    test('should not throw for valid config with default load balancing', async () => {
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService'
      };

      expect(() => validateWebServiceConfig({ resource })).not.toThrow();
    });

    test('should not throw for valid config with HTTP API Gateway', async () => {
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        loadBalancing: { type: 'http-api-gateway' }
      };

      expect(() => validateWebServiceConfig({ resource })).not.toThrow();
    });

    test('should throw when deployment is configured with non-ALB load balancing', async () => {
      const { stpErrors } = await import('@errors');
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        loadBalancing: { type: 'http-api-gateway' },
        deployment: { type: 'blue-green' }
      };

      try {
        validateWebServiceConfig({ resource });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(stpErrors.e79).toHaveBeenCalledWith({ webServiceName: 'myWebService' });
      }
    });

    test('should not throw when deployment is configured with ALB', async () => {
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        loadBalancing: { type: 'application-load-balancer' },
        deployment: { type: 'blue-green' }
      };

      expect(() => validateWebServiceConfig({ resource })).not.toThrow();
    });

    test('should throw when alarm type does not match load balancing type', async () => {
      const { stpErrors } = await import('@errors');
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        loadBalancing: { type: 'http-api-gateway' },
        alarms: [
          {
            trigger: { type: 'application-load-balancer.targetGroupUnhealthyHosts' }
          }
        ]
      };

      try {
        validateWebServiceConfig({ resource });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(stpErrors.e80).toHaveBeenCalledWith({ webServiceName: 'myWebService' });
      }
    });

    test('should not throw when alarm type matches load balancing type', async () => {
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        loadBalancing: { type: 'http-api-gateway' },
        alarms: [
          {
            trigger: { type: 'http-api-gateway.5xxErrors' }
          }
        ]
      };

      expect(() => validateWebServiceConfig({ resource })).not.toThrow();
    });

    test('should throw when firewall is used with non-ALB load balancing', async () => {
      const { stpErrors } = await import('@errors');
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        loadBalancing: { type: 'http-api-gateway' },
        useFirewall: true
      };

      try {
        validateWebServiceConfig({ resource });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(stpErrors.e1003).toHaveBeenCalledWith({ webServiceName: 'myWebService' });
      }
    });

    test('should not throw when firewall is used with ALB', async () => {
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        loadBalancing: { type: 'application-load-balancer' },
        useFirewall: true
      };

      expect(() => validateWebServiceConfig({ resource })).not.toThrow();
    });

    test('should throw when CDN is used with unsupported load balancing', async () => {
      const { stpErrors } = await import('@errors');
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        loadBalancing: { type: 'network-load-balancer' },
        cdn: {}
      };

      try {
        validateWebServiceConfig({ resource });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(stpErrors.e117).toHaveBeenCalledWith({ webServiceName: 'myWebService' });
      }
    });

    test('should not throw when CDN is used with HTTP API Gateway', async () => {
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        loadBalancing: { type: 'http-api-gateway' },
        cdn: {}
      };

      expect(() => validateWebServiceConfig({ resource })).not.toThrow();
    });

    test('should not throw when CDN is used with ALB', async () => {
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        loadBalancing: { type: 'application-load-balancer' },
        cdn: {}
      };

      expect(() => validateWebServiceConfig({ resource })).not.toThrow();
    });

    test('should throw when custom domain has disabled DNS but no certificate', async () => {
      const { stpErrors } = await import('@errors');
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        customDomains: [
          {
            disableDnsRecordCreation: true
          }
        ]
      };

      try {
        validateWebServiceConfig({ resource });
        throw new Error('Should have thrown');
      } catch (err) {
        expect(stpErrors.e118).toHaveBeenCalledWith({ webServiceName: 'myWebService' });
      }
    });

    test('should not throw when custom domain has disabled DNS with certificate', async () => {
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        customDomains: [
          {
            disableDnsRecordCreation: true,
            customCertificateArn: 'arn:aws:acm:...'
          }
        ]
      };

      expect(() => validateWebServiceConfig({ resource })).not.toThrow();
    });

    test('should not throw when custom domain has DNS enabled without certificate', async () => {
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        customDomains: [
          {
            disableDnsRecordCreation: false
          }
        ]
      };

      expect(() => validateWebServiceConfig({ resource })).not.toThrow();
    });

    test('should handle multiple validation errors', async () => {
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myWebService',
        loadBalancing: { type: 'http-api-gateway' },
        deployment: { type: 'blue-green' },
        useFirewall: true
      };

      expect(() => validateWebServiceConfig({ resource })).toThrow();
    });

    test('should validate complex configuration', async () => {
      const { validateWebServiceConfig } = await import('./web-services');

      const resource: any = {
        name: 'myComplexService',
        loadBalancing: { type: 'application-load-balancer' },
        deployment: { type: 'blue-green' },
        useFirewall: true,
        cdn: {},
        alarms: [
          {
            trigger: { type: 'application-load-balancer.targetGroupUnhealthyHosts' }
          }
        ],
        customDomains: [
          {
            disableDnsRecordCreation: true,
            customCertificateArn: 'arn:aws:acm:...'
          }
        ]
      };

      expect(() => validateWebServiceConfig({ resource })).not.toThrow();
    });
  });
});
