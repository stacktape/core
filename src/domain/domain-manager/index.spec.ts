import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock dependencies
const mockResolveNs = mock(async () => ['ns1.example.com', 'ns2.example.com']);
const mockDefaultDomainsInfo = mock(async () => ({
  suffix: '-12345678.stacktape-app.com',
  certDomainSuffix: '.stacktape-app.com',
  version: 1
}));
const mockGetSsmParametersValues = mock(async () => []);
const mockPutSsmParameterValue = mock(async () => {});
const mockListAllHostedZones = mock(async () => []);
const mockGetInfoForHostedZone = mock(async () => ({}));
const mockGetRecordsForHostedZone = mock(async () => []);
const mockListCertificatesForAccount = mock(async () => []);
const mockGetCertificateInfo = mock(async () => ({}));
const mockStartEvent = mock(async () => {});
const mockFinishEvent = mock(async () => {});
const mockJsonFetch = mock(async () => ({ nameservers: [] }));
const mockWhoiser = mock(async () => ({ 'Name Server': [] }));

const mockGlobalStateManager = {
  region: 'us-east-1',
  targetAwsAccount: {
    awsAccountId: '123456789012'
  }
};

const mockStpErrors = {
  e39: mock(() => new Error('Certificate not found')),
  e40: mock(() => new Error('Certificate not issued')),
  e41: mock(() => new Error('Invalid domain level')),
  e48: mock(() => new Error('Domain not registered')),
  e49: mock(() => new Error('Domain ownership not verified')),
  e88: mock(() => new Error('Domain status not found'))
};

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    getSsmParametersValues: mockGetSsmParametersValues,
    putSsmParameterValue: mockPutSsmParameterValue,
    listAllHostedZones: mockListAllHostedZones,
    getInfoForHostedZone: mockGetInfoForHostedZone,
    getRecordsForHostedZone: mockGetRecordsForHostedZone,
    listCertificatesForAccount: mockListCertificatesForAccount,
    getCertificateInfo: mockGetCertificateInfo
  }
}));

mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mockStartEvent,
    finishEvent: mockFinishEvent
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: mockGlobalStateManager
}));

mock.module('@application-services/stacktape-trpc-api-manager', () => ({
  stacktapeTrpcApiManager: {
    apiClient: {
      defaultDomainsInfo: mockDefaultDomainsInfo
    }
  }
}));

mock.module('@errors', () => ({
  stpErrors: mockStpErrors
}));

mock.module('@shared/utils/json-fetch', () => ({
  jsonFetch: mockJsonFetch
}));

mock.module('whoiser', () => ({
  default: mockWhoiser
}));

mock.module('@utils/validator', () => ({
  validateDomain: mock(() => {})
}));

mock.module('@utils/domains', () => ({
  getApexDomain: mock((domain) => {
    const parts = domain.split('.');
    return parts.slice(-2).join('.');
  })
}));

mock.module('@shared/naming/domain-names', () => ({
  getPrefixForUserAppResourceDefaultDomainName: mock(() => 'myapp-test-stage')
}));

mock.module('@shared/naming/ssm-secret-parameters', () => ({
  getSsmParameterNameForDomainInfo: mock(() => '/stacktape/us-east-1/domains/example.com'),
  parseDomainNameFromSmmParamName: mock(() => 'example.com')
}));

mock.module('@shared/utils/short-hash', () => ({
  shortHash: mock((str) => 'abc123')
}));

mock.module('@shared/utils/constants', () => ({
  COMMENT_FOR_STACKTAPE_ZONE: 'Managed by Stacktape'
}));

mock.module('@shared/utils/misc', () => ({
  areStringArraysContentsEqual: mock((arr1, arr2) => 
    JSON.stringify(arr1?.sort()) === JSON.stringify(arr2?.sort())
  )
}));

mock.module('@aws-sdk/client-acm', () => ({
  CertificateStatus: {
    ISSUED: 'ISSUED',
    PENDING_VALIDATION: 'PENDING_VALIDATION',
    FAILED: 'FAILED'
  }
}));

mock.module('tldts', () => ({
  parse: mock((domain) => ({ publicSuffix: 'com' }))
}));

mock.module('node:dns', () => ({
  promises: {
    Resolver: class {
      setServers = mock(() => {});
      resolveNs = mockResolveNs;
    }
  }
}));

describe('DomainManager', () => {
  let domainManager: any;

  beforeEach(async () => {
    mock.restore();
    
    // Reset all mocks
    const allMocks = [
      mockResolveNs, mockDefaultDomainsInfo, mockGetSsmParametersValues,
      mockPutSsmParameterValue, mockListAllHostedZones, mockGetInfoForHostedZone,
      mockGetRecordsForHostedZone, mockListCertificatesForAccount, mockGetCertificateInfo,
      mockStartEvent, mockFinishEvent, mockJsonFetch, mockWhoiser
    ];
    allMocks.forEach(m => m.mockClear());

    // Setup default return values
    mockResolveNs.mockResolvedValue(['ns1.example.com', 'ns2.example.com']);
    mockDefaultDomainsInfo.mockResolvedValue({
      suffix: '-12345678.stacktape-app.com',
      certDomainSuffix: '.stacktape-app.com',
      version: 1
    });

    const module = await import('./index');
    domainManager = module.domainManager;
    await domainManager.init({ domains: [], stackName: null });
  });

  describe('initialization', () => {
    test('should initialize with default domains info', async () => {
      const { DomainManager } = await import('./index');
      const manager = new DomainManager();
      await manager.init({ domains: [], stackName: 'test-stack' });

      expect(manager.defaultDomainsInfo).toBeDefined();
      expect(manager.defaultDomainsInfo.suffix).toBeDefined();
    });

    test('should initialize DNS resolver', async () => {
      const { DomainManager } = await import('./index');
      const manager = new DomainManager();
      await manager.init({ domains: [], stackName: 'test-stack' });

      expect(manager.dnsResolver).toBeDefined();
    });

    test('should fetch domain statuses when domains provided', async () => {
      mockListAllHostedZones.mockResolvedValueOnce([]);
      mockResolveNs.mockResolvedValueOnce(['ns1.aws.com', 'ns2.aws.com']);

      const { DomainManager } = await import('./index');
      const manager = new DomainManager();
      await manager.init({ 
        domains: ['example.com'], 
        stackName: 'test-stack'
      });

      expect(mockStartEvent).toHaveBeenCalled();
      expect(mockFinishEvent).toHaveBeenCalled();
    });

    test('should load from parameter store when flag set', async () => {
      mockGetSsmParametersValues.mockResolvedValueOnce([
        {
          Name: '/stacktape/us-east-1/domains/example.com',
          Value: JSON.stringify({
            registered: true,
            ownershipVerified: true,
            hostedZoneInfo: {
              DelegationSet: {
                NameServers: ['ns1.aws.com', 'ns2.aws.com']
              }
            }
          })
        }
      ]);

      mockResolveNs.mockResolvedValueOnce(['ns1.aws.com', 'ns2.aws.com']);

      const { DomainManager } = await import('./index');
      const manager = new DomainManager();
      await manager.init({ 
        domains: ['example.com'], 
        stackName: 'test-stack',
        fromParameterStore: true
      });

      expect(mockGetSsmParametersValues).toHaveBeenCalled();
      expect(manager.domainStatuses['example.com']).toBeDefined();
    });
  });

  describe('getDefaultDomainForResource', () => {
    test('should generate default domain', async () => {
      const { DomainManager } = await import('./index');
      const manager = new DomainManager();
      await manager.init({ domains: [], stackName: 'test-stack' });

      const domain = manager.getDefaultDomainForResource({
        stpResourceName: 'myApp'
      });

      expect(domain).toContain('stacktape-app.com');
    });

    test('should truncate long prefix', async () => {
      const { DomainManager } = await import('./index');
      const manager = new DomainManager();
      await manager.init({ domains: [], stackName: 'test-stack' });

      const longName = 'a'.repeat(100);
      const domain = manager.getDefaultDomainForResource({
        stpResourceName: longName
      });

      // Domain label should not exceed 63 chars
      const firstLabel = domain.split('.')[0];
      expect(firstLabel.length).toBeLessThanOrEqual(63);
    });
  });

  describe('getDomainStatus', () => {
    test('should return domain status for apex domain', async () => {
      domainManager.domainStatuses = {
        'example.com': {
          registered: true,
          ownershipVerified: true
        }
      };

      const status = domainManager.getDomainStatus('www.example.com');
      expect(status.registered).toBe(true);
    });

    test('should return undefined for non-existent domain', () => {
      const status = domainManager.getDomainStatus('nonexistent.com');
      expect(status).toBeUndefined();
    });
  });

  describe('validateDomainUsability', () => {
    test('should pass for valid domain', () => {
      domainManager.domainStatuses = {
        'example.com': {
          registered: true,
          ownershipVerified: true,
          hostedZoneInfo: {}
        }
      };

      expect(() => {
        domainManager.validateDomainUsability('example.com');
      }).not.toThrow();
    });

    test('should throw for missing domain status', () => {
      expect(() => {
        domainManager.validateDomainUsability('unknown.com');
      }).toThrow();
    });

    test('should throw for unregistered domain', () => {
      domainManager.domainStatuses = {
        'example.com': {
          registered: false,
          ownershipVerified: false
        }
      };

      expect(() => {
        domainManager.validateDomainUsability('example.com');
      }).toThrow();
    });

    test('should throw for unverified ownership', () => {
      domainManager.domainStatuses = {
        'example.com': {
          registered: true,
          ownershipVerified: false,
          hostedZoneInfo: {
            DelegationSet: {
              NameServers: ['ns1.aws.com']
            }
          }
        }
      };

      expect(() => {
        domainManager.validateDomainUsability('example.com');
      }).toThrow();
    });
  });

  describe('getCertificateForDomain', () => {
    test('should return certificate ARN for valid domain', () => {
      domainManager.domainStatuses = {
        'example.com': {
          registered: true,
          ownershipVerified: true,
          regionalCert: {
            CertificateArn: 'arn:aws:acm:us-east-1:123:cert/abc',
            Status: 'ISSUED'
          }
        }
      };

      const certArn = domainManager.getCertificateForDomain('example.com', 'alb');
      expect(certArn).toBe('arn:aws:acm:us-east-1:123:cert/abc');
    });

    test('should return us-east-1 cert for CDN', () => {
      domainManager.domainStatuses = {
        'example.com': {
          registered: true,
          ownershipVerified: true,
          usEast1Cert: {
            CertificateArn: 'arn:aws:acm:us-east-1:123:cert/cdn',
            Status: 'ISSUED'
          }
        }
      };

      const certArn = domainManager.getCertificateForDomain('example.com', 'cdn');
      expect(certArn).toBe('arn:aws:acm:us-east-1:123:cert/cdn');
    });

    test('should throw when certificate not found', () => {
      domainManager.domainStatuses = {
        'example.com': {
          registered: true,
          ownershipVerified: true
        }
      };

      expect(() => {
        domainManager.getCertificateForDomain('example.com', 'alb');
      }).toThrow();
    });

    test('should throw when certificate not issued', () => {
      domainManager.domainStatuses = {
        'example.com': {
          registered: true,
          ownershipVerified: true,
          regionalCert: {
            CertificateArn: 'arn:aws:acm:us-east-1:123:cert/abc',
            Status: 'PENDING_VALIDATION'
          }
        }
      };

      expect(() => {
        domainManager.getCertificateForDomain('example.com', 'alb');
      }).toThrow();
    });
  });

  describe('resolveCurrentNameServersForDomain', () => {
    test('should resolve nameservers via DNS', async () => {
      mockResolveNs.mockResolvedValueOnce(['NS1.AWS.COM', 'NS2.AWS.COM']);

      const nameServers = await domainManager.resolveCurrentNameServersForDomain('example.com');
      expect(nameServers).toEqual(['ns1.aws.com', 'ns2.aws.com']);
    });

    test('should use WHOIS when flag set', async () => {
      mockJsonFetch.mockResolvedValueOnce({
        services: [
          [['com'], ['https://rdap.example.com']]
        ]
      });

      mockJsonFetch.mockResolvedValueOnce({
        nameservers: [
          { ldhName: 'ns1.example.com' },
          { ldhName: 'ns2.example.com' }
        ]
      });

      const nameServers = await domainManager.resolveCurrentNameServersForDomain('example.com', true);
      expect(nameServers).toContain('ns1.example.com');
    });
  });

  describe('storeDomainStatusIntoParameterStore', () => {
    test('should store cleaned domain status', async () => {
      const status = {
        registered: true,
        ownershipVerified: true,
        regionalCert: {
          CertificateArn: 'arn:cert',
          Status: 'ISSUED',
          DomainValidationOptions: [],
          InUseBy: [],
          RenewalSummary: {}
        }
      };

      await domainManager.storeDomainStatusIntoParameterStore({
        domainName: 'example.com',
        status
      });

      expect(mockPutSsmParameterValue).toHaveBeenCalled();
    });
  });
});
