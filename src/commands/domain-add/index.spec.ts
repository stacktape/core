import { describe, expect, mock, test } from 'bun:test';
import { CertificateStatus } from '@aws-sdk/client-acm';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    region: 'us-east-1'
  }
}));

mock.module('@domain-services/domain-manager', () => ({
  domainManager: {
    init: mock(async () => {}),
    getDomainStatus: mock((domainName) => ({
      registered: true,
      ownershipVerified: true,
      hostedZoneInfo: {
        HostedZone: { Id: '/hostedzone/Z123456' },
        DelegationSet: {
          NameServers: ['ns-1.awsdns.com', 'ns-2.awsdns.com']
        }
      },
      regionalCert: {
        Status: CertificateStatus.ISSUED,
        DomainValidationOptions: []
      },
      usEast1Cert: {
        Status: CertificateStatus.ISSUED,
        DomainValidationOptions: []
      }
    })),
    storeDomainStatusIntoParameterStore: mock(async () => {})
  }
}));

mock.module('@domain-services/ses-manager', () => ({
  sesManager: {
    init: mock(async () => {}),
    isIdentityVerified: mock(() => true)
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e38: mock(({ domainName }) => new Error(`Domain "${domainName}" must be root domain`))
  }
}));

mock.module('@shared/naming/console-links', () => ({
  consoleLinks: {
    route53HostedZone: mock((id) => `https://console.aws.amazon.com/route53/hosted-zones/${id}`)
  }
}));

mock.module('@shared/utils/user-prompt', () => ({
  userPrompt: mock(async ({ name }) => {
    if (name === 'domainName') return { domainName: 'example.com' };
    if (name === 'controlDomainDnsWithAws') return { controlDomainDnsWithAws: true };
    if (name === 'createHostedZone') return { createHostedZone: true };
    if (name === 'generateCerts') return { generateCerts: true };
    if (name === 'prepareForSES') return { prepareForSES: true };
    return {};
  })
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    createHostedZone: mock(async (domainName) => ({
      HostedZone: { Id: '/hostedzone/Z123456' },
      DelegationSet: {
        NameServers: ['ns-1.awsdns.com', 'ns-2.awsdns.com']
      }
    })),
    requestCertificateForDomainName: mock(async () => ({
      Status: CertificateStatus.ISSUED,
      DomainValidationOptions: []
    })),
    createCertificateValidationRecordInHostedZone: mock(async () => {}),
    verifyDomainForSesUsingDkim: mock(async () => ['token1', 'token2', 'token3']),
    createDkimAuthenticationRecordInHostedZone: mock(async () => {})
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    warn: mock(() => {}),
    hint: mock(() => {}),
    info: mock(() => {}),
    success: mock(() => {}),
    makeBold: mock((text) => text),
    colorize: mock((color, text) => text),
    getLink: mock((name, label) => label),
    terminalLink: mock((url, label) => label)
  }
}));

mock.module('tldts', () => ({
  parse: mock((domain) => ({
    subdomain: domain.split('.').length > 2 ? domain.split('.')[0] : null
  }))
}));

mock.module('../_utils/initialization', () => ({
  loadUserCredentials: mock(async () => {})
}));

describe('domain-add command', () => {
  test('should add domain successfully when fully configured', async () => {
    const { loadUserCredentials } = await import('../_utils/initialization');
    const { domainManager } = await import('@domain-services/domain-manager');
    const { sesManager } = await import('@domain-services/ses-manager');
    const { printer } = await import('@utils/printer');

    const { commandDomainAdd } = await import('./index');
    await commandDomainAdd();

    expect(loadUserCredentials).toHaveBeenCalled();
    expect(domainManager.init).toHaveBeenCalledWith({ domains: ['example.com'] });
    expect(domainManager.getDomainStatus).toHaveBeenCalledWith('example.com');
    expect(sesManager.init).toHaveBeenCalledWith({ identities: ['example.com'] });
    expect(printer.success).toHaveBeenCalled();
  });

  test('should throw error for subdomain', async () => {
    const { userPrompt } = await import('@shared/utils/user-prompt');
    (userPrompt as any).mockImplementation(async ({ name }) => {
      if (name === 'domainName') return { domainName: 'sub.example.com' };
      return {};
    });

    const { commandDomainAdd } = await import('./index');

    await expect(commandDomainAdd()).rejects.toThrow('must be root domain');
  });

  test('should warn when domain is not registered', async () => {
    const { domainManager } = await import('@domain-services/domain-manager');
    const { printer } = await import('@utils/printer');
    (domainManager.getDomainStatus as any).mockImplementation(() => ({
      registered: false
    }));

    const { commandDomainAdd } = await import('./index');
    await commandDomainAdd();

    expect(printer.warn).toHaveBeenCalledWith(
      expect.stringContaining('not registered')
    );
    expect(printer.hint).toHaveBeenCalled();
  });

  test('should create hosted zone when requested', async () => {
    const { domainManager } = await import('@domain-services/domain-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    (domainManager.getDomainStatus as any).mockImplementation(() => ({
      registered: true,
      ownershipVerified: false,
      hostedZoneInfo: null
    }));

    const { commandDomainAdd } = await import('./index');
    await commandDomainAdd();

    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'controlDomainDnsWithAws'
      })
    );
    expect(userPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'createHostedZone'
      })
    );
    expect(awsSdkManager.createHostedZone).toHaveBeenCalledWith('example.com');
  });

  test('should abort when user declines DNS control', async () => {
    const { domainManager } = await import('@domain-services/domain-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { printer } = await import('@utils/printer');
    (domainManager.getDomainStatus as any).mockImplementation(() => ({
      registered: true,
      ownershipVerified: false
    }));
    (userPrompt as any).mockImplementation(async ({ name }) => {
      if (name === 'domainName') return { domainName: 'example.com' };
      if (name === 'controlDomainDnsWithAws') return { controlDomainDnsWithAws: false };
      return {};
    });

    const { commandDomainAdd } = await import('./index');
    await commandDomainAdd();

    expect(printer.warn).toHaveBeenCalledWith(
      expect.stringContaining('Aborting')
    );
  });

  test('should generate certificates when not present', async () => {
    const { domainManager } = await import('@domain-services/domain-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    (domainManager.getDomainStatus as any).mockImplementation(() => ({
      registered: true,
      ownershipVerified: true,
      hostedZoneInfo: {
        HostedZone: { Id: '/hostedzone/Z123456' },
        DelegationSet: { NameServers: [] }
      },
      regionalCert: null,
      usEast1Cert: null
    }));

    const { commandDomainAdd } = await import('./index');
    await commandDomainAdd();

    expect(awsSdkManager.requestCertificateForDomainName).toHaveBeenCalled();
  });

  test('should create validation records for pending certificates', async () => {
    const { domainManager } = await import('@domain-services/domain-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    (domainManager.getDomainStatus as any).mockImplementation(() => ({
      registered: true,
      ownershipVerified: true,
      hostedZoneInfo: {
        HostedZone: { Id: '/hostedzone/Z123456' },
        DelegationSet: { NameServers: [] }
      },
      regionalCert: {
        Status: CertificateStatus.PENDING_VALIDATION,
        DomainValidationOptions: [
          {
            ResourceRecord: {
              Name: '_validation.example.com',
              Value: 'validation-value'
            }
          }
        ]
      },
      usEast1Cert: null
    }));

    const { commandDomainAdd } = await import('./index');
    await commandDomainAdd();

    expect(awsSdkManager.createCertificateValidationRecordInHostedZone).toHaveBeenCalled();
  });

  test('should setup SES verification when requested', async () => {
    const { sesManager } = await import('@domain-services/ses-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    (sesManager.isIdentityVerified as any).mockImplementation(() => false);

    const { commandDomainAdd } = await import('./index');
    await commandDomainAdd();

    expect(awsSdkManager.verifyDomainForSesUsingDkim).toHaveBeenCalled();
    expect(awsSdkManager.createDkimAuthenticationRecordInHostedZone).toHaveBeenCalled();
  });

  test('should skip SES setup when already verified', async () => {
    const { sesManager } = await import('@domain-services/ses-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    const { printer } = await import('@utils/printer');
    (sesManager.isIdentityVerified as any).mockImplementation(() => true);

    (awsSdkManager.verifyDomainForSesUsingDkim as any).mock.calls = [];

    const { commandDomainAdd } = await import('./index');
    await commandDomainAdd();

    expect(awsSdkManager.verifyDomainForSesUsingDkim).not.toHaveBeenCalled();
    expect(printer.success).toHaveBeenCalledWith(
      expect.stringContaining('verified for using with AWS SES')
    );
  });

  test('should store domain status in parameter store', async () => {
    const { domainManager } = await import('@domain-services/domain-manager');

    const { commandDomainAdd } = await import('./index');
    await commandDomainAdd();

    expect(domainManager.storeDomainStatusIntoParameterStore).toHaveBeenCalledWith({
      domainName: 'example.com',
      status: expect.any(Object)
    });
  });

  test('should handle us-east-1 certificate generation for other regions', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    const { domainManager } = await import('@domain-services/domain-manager');
    const { awsSdkManager } = await import('@utils/aws-sdk-manager');
    globalStateManager.region = 'eu-west-1';
    (domainManager.getDomainStatus as any).mockImplementation(() => ({
      registered: true,
      ownershipVerified: true,
      hostedZoneInfo: {
        HostedZone: { Id: '/hostedzone/Z123456' },
        DelegationSet: { NameServers: [] }
      },
      regionalCert: null,
      usEast1Cert: null
    }));

    const { commandDomainAdd } = await import('./index');
    await commandDomainAdd();

    // Should request both regional and us-east-1 certificates
    expect(awsSdkManager.requestCertificateForDomainName).toHaveBeenCalledTimes(2);
  });

  test('should abort when user declines certificate generation', async () => {
    const { domainManager } = await import('@domain-services/domain-manager');
    const { userPrompt } = await import('@shared/utils/user-prompt');
    const { printer } = await import('@utils/printer');
    (domainManager.getDomainStatus as any).mockImplementation(() => ({
      registered: true,
      ownershipVerified: true,
      hostedZoneInfo: {
        HostedZone: { Id: '/hostedzone/Z123456' },
        DelegationSet: { NameServers: [] }
      },
      regionalCert: null,
      usEast1Cert: null
    }));
    (userPrompt as any).mockImplementation(async ({ name }) => {
      if (name === 'domainName') return { domainName: 'example.com' };
      if (name === 'generateCerts') return { generateCerts: false };
      return {};
    });

    const { commandDomainAdd } = await import('./index');
    await commandDomainAdd();

    expect(printer.warn).toHaveBeenCalledWith(
      expect.stringContaining('Aborting')
    );
  });
});
