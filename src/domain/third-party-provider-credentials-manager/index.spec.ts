import { describe, expect, test, beforeEach, mock } from 'bun:test';

const mockGetSsmParameterValue = mock(async () => 'parameter-value');
const mockStartEvent = mock(async () => {});
const mockFinishEvent = mock(async () => {});
const mockGetAtt = mock((logicalName, attribute) => ({ 'Fn::GetAtt': [logicalName, attribute] }));

const mockGetSsmParameterNameForThirdPartyCredentials = mock(
  ({ credentialsIdentifier, region }) => `/stacktape/${region}/credentials/${credentialsIdentifier}`
);

const mockCfLogicalNames = {
  atlasMongoCredentialsProvider: mock(() => 'AtlasMongoCredentialsProvider'),
  upstashCredentialsProvider: mock(() => 'UpstashCredentialsProvider')
};

const mockStpErrors = {
  e113: mock(({ providerType }) => new Error(`Credentials not found for ${providerType}`))
};

const mockConfigManager = {
  mongoDbAtlasProvider: undefined,
  upstashProvider: undefined
};

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    getSsmParameterValue: mockGetSsmParameterValue
  }
}));

mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mockStartEvent,
    finishEvent: mockFinishEvent
  }
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: mockConfigManager
}));

mock.module('@shared/naming/ssm-secret-parameters', () => ({
  getSsmParameterNameForThirdPartyCredentials: mockGetSsmParameterNameForThirdPartyCredentials
}));

mock.module('@shared/naming/logical-names', () => ({
  cfLogicalNames: mockCfLogicalNames
}));

mock.module('@errors', () => ({
  stpErrors: mockStpErrors
}));

mock.module('@cloudform/functions', () => ({
  GetAtt: mockGetAtt
}));

mock.module('@shared/utils/constants', () => ({
  MONGODB_PROVIDER_DEFAULT_CREDENTIALS_ID: 'mongodb-default',
  UPSTASH_PROVIDER_DEFAULT_CREDENTIALS_ID: 'upstash-default',
  THIRD_PARTY_PROVIDER_CREDENTIALS_REGION: 'us-east-1'
}));

mock.module('@aws-sdk/client-ssm', () => ({
  ParameterNotFound: class extends Error {
    constructor() {
      super('ParameterNotFound');
      this.name = 'ParameterNotFound';
    }
  }
}));

describe('ThirdPartyProviderManager', () => {
  let providerManager: any;

  beforeEach(async () => {
    mock.restore();
    mockGetSsmParameterValue.mockClear();
    mockStartEvent.mockClear();
    mockFinishEvent.mockClear();
    mockGetAtt.mockClear();
    mockGetSsmParameterNameForThirdPartyCredentials.mockClear();
    mockCfLogicalNames.atlasMongoCredentialsProvider.mockClear();
    mockCfLogicalNames.upstashCredentialsProvider.mockClear();

    mockGetSsmParameterValue.mockResolvedValue('parameter-value');
    mockGetAtt.mockImplementation((logicalName, attribute) => ({ 'Fn::GetAtt': [logicalName, attribute] }));
    mockGetSsmParameterNameForThirdPartyCredentials.mockImplementation(
      ({ credentialsIdentifier, region }) => `/stacktape/${region}/credentials/${credentialsIdentifier}`
    );
    mockCfLogicalNames.atlasMongoCredentialsProvider.mockReturnValue('AtlasMongoCredentialsProvider');
    mockCfLogicalNames.upstashCredentialsProvider.mockReturnValue('UpstashCredentialsProvider');
    mockConfigManager.mongoDbAtlasProvider = undefined;
    mockConfigManager.upstashProvider = undefined;

    const module = await import('./index');
    providerManager = module.thirdPartyProviderManager;
    await providerManager.init({
      requireAtlasCredentialsParameter: false,
      requireUpstashCredentialsParameter: false
    });
  });

  describe('initialization', () => {
    test('should initialize successfully without required credentials', async () => {
      const { ThirdPartyProviderManager } = await import('./index');
      const manager = new ThirdPartyProviderManager();
      await manager.init({
        requireAtlasCredentialsParameter: false,
        requireUpstashCredentialsParameter: false
      });
      expect(manager).toBeDefined();
    });

    test('should skip fetching when no credentials required', async () => {
      const { ThirdPartyProviderManager } = await import('./index');
      const manager = new ThirdPartyProviderManager();
      await manager.init({
        requireAtlasCredentialsParameter: false,
        requireUpstashCredentialsParameter: false
      });

      expect(mockStartEvent).not.toHaveBeenCalled();
      expect(mockGetSsmParameterValue).not.toHaveBeenCalled();
    });

    test('should load Atlas Mongo credentials when required', async () => {
      mockGetSsmParameterValue.mockResolvedValueOnce('atlas-credentials');

      const { ThirdPartyProviderManager } = await import('./index');
      const manager = new ThirdPartyProviderManager();
      await manager.init({
        requireAtlasCredentialsParameter: true,
        requireUpstashCredentialsParameter: false
      });

      expect(mockStartEvent).toHaveBeenCalledWith({
        eventType: 'LOAD_PROVIDER_CREDENTIALS',
        description: 'Load provider credentials'
      });

      expect(mockGetSsmParameterValue).toHaveBeenCalledWith({
        ssmParameterName: '/stacktape/us-east-1/credentials/mongodb-default',
        region: 'us-east-1'
      });

      expect(mockFinishEvent).toHaveBeenCalledWith({
        eventType: 'LOAD_PROVIDER_CREDENTIALS'
      });
    });

    test('should load Upstash credentials when required', async () => {
      mockGetSsmParameterValue.mockResolvedValueOnce('upstash-credentials');

      const { ThirdPartyProviderManager } = await import('./index');
      const manager = new ThirdPartyProviderManager();
      await manager.init({
        requireAtlasCredentialsParameter: false,
        requireUpstashCredentialsParameter: true
      });

      expect(mockGetSsmParameterValue).toHaveBeenCalledWith({
        ssmParameterName: '/stacktape/us-east-1/credentials/upstash-default',
        region: 'us-east-1'
      });
    });

    test('should load both credentials when both required', async () => {
      mockGetSsmParameterValue.mockResolvedValue('credentials');

      const { ThirdPartyProviderManager } = await import('./index');
      const manager = new ThirdPartyProviderManager();
      await manager.init({
        requireAtlasCredentialsParameter: true,
        requireUpstashCredentialsParameter: true
      });

      expect(mockGetSsmParameterValue).toHaveBeenCalledTimes(2);
    });

    test('should throw error when Atlas credentials not found', async () => {
      const ParameterNotFound = (await import('@aws-sdk/client-ssm')).ParameterNotFound;
      mockGetSsmParameterValue.mockRejectedValueOnce(new ParameterNotFound());

      const { ThirdPartyProviderManager } = await import('./index');
      const manager = new ThirdPartyProviderManager();

      await expect(
        manager.init({
          requireAtlasCredentialsParameter: true,
          requireUpstashCredentialsParameter: false
        })
      ).rejects.toThrow();
    });

    test('should throw error when Upstash credentials not found', async () => {
      mockGetSsmParameterValue.mockRejectedValueOnce(new Error('ParameterNotFound: xxx'));

      const { ThirdPartyProviderManager } = await import('./index');
      const manager = new ThirdPartyProviderManager();

      await expect(
        manager.init({
          requireAtlasCredentialsParameter: false,
          requireUpstashCredentialsParameter: true
        })
      ).rejects.toThrow();
    });

    test('should propagate other errors', async () => {
      mockGetSsmParameterValue.mockRejectedValueOnce(new Error('Network Error'));

      const { ThirdPartyProviderManager } = await import('./index');
      const manager = new ThirdPartyProviderManager();

      await expect(
        manager.init({
          requireAtlasCredentialsParameter: true,
          requireUpstashCredentialsParameter: false
        })
      ).rejects.toThrow('Network Error');
    });
  });

  describe('getAtlasMongoDbProviderConfig', () => {
    test('should return CloudFormation GetAtt references when no config provided', () => {
      const config = providerManager.getAtlasMongoDbProviderConfig();

      expect(config.privateKey).toEqual({
        'Fn::GetAtt': ['AtlasMongoCredentialsProvider', 'privateKey']
      });
      expect(config.publicKey).toEqual({
        'Fn::GetAtt': ['AtlasMongoCredentialsProvider', 'publicKey']
      });
      expect(config.organizationId).toEqual({
        'Fn::GetAtt': ['AtlasMongoCredentialsProvider', 'organizationId']
      });
      expect(config.accessibility).toBeUndefined();
    });

    test('should return config values when provided', () => {
      mockConfigManager.mongoDbAtlasProvider = {
        privateKey: 'my-private-key',
        publicKey: 'my-public-key',
        organizationId: 'org-123',
        accessibility: 'private'
      };

      const config = providerManager.getAtlasMongoDbProviderConfig();

      expect(config.privateKey).toBe('my-private-key');
      expect(config.publicKey).toBe('my-public-key');
      expect(config.organizationId).toBe('org-123');
      expect(config.accessibility).toBe('private');
    });

    test('should use CloudFormation refs for missing config fields', () => {
      mockConfigManager.mongoDbAtlasProvider = {
        privateKey: 'my-private-key',
        publicKey: undefined,
        organizationId: undefined,
        accessibility: 'public'
      };

      const config = providerManager.getAtlasMongoDbProviderConfig();

      expect(config.privateKey).toBe('my-private-key');
      expect(config.publicKey).toEqual({
        'Fn::GetAtt': ['AtlasMongoCredentialsProvider', 'publicKey']
      });
      expect(config.organizationId).toEqual({
        'Fn::GetAtt': ['AtlasMongoCredentialsProvider', 'organizationId']
      });
      expect(config.accessibility).toBe('public');
    });
  });

  describe('getUpstashProviderConfig', () => {
    test('should return CloudFormation GetAtt references when no config provided', () => {
      const config = providerManager.getUpstashProviderConfig();

      expect(config.accountEmail).toEqual({
        'Fn::GetAtt': ['UpstashCredentialsProvider', 'accountEmail']
      });
      expect(config.apiKey).toEqual({
        'Fn::GetAtt': ['UpstashCredentialsProvider', 'apiKey']
      });
    });

    test('should return config values when provided', () => {
      mockConfigManager.upstashProvider = {
        accountEmail: 'user@example.com',
        apiKey: 'upstash-api-key-123'
      };

      const config = providerManager.getUpstashProviderConfig();

      expect(config.accountEmail).toBe('user@example.com');
      expect(config.apiKey).toBe('upstash-api-key-123');
    });

    test('should use CloudFormation refs for missing config fields', () => {
      mockConfigManager.upstashProvider = {
        accountEmail: 'user@example.com',
        apiKey: undefined
      };

      const config = providerManager.getUpstashProviderConfig();

      expect(config.accountEmail).toBe('user@example.com');
      expect(config.apiKey).toEqual({
        'Fn::GetAtt': ['UpstashCredentialsProvider', 'apiKey']
      });
    });
  });

  describe('edge cases', () => {
    test('should handle SSM API errors gracefully', async () => {
      mockGetSsmParameterValue.mockRejectedValueOnce(new Error('SSM Service Unavailable'));

      const { ThirdPartyProviderManager } = await import('./index');
      const manager = new ThirdPartyProviderManager();

      await expect(
        manager.init({
          requireAtlasCredentialsParameter: true,
          requireUpstashCredentialsParameter: false
        })
      ).rejects.toThrow('SSM Service Unavailable');
    });

    test('should handle partial config for Atlas', () => {
      mockConfigManager.mongoDbAtlasProvider = {
        privateKey: 'key',
        publicKey: null,
        organizationId: null,
        accessibility: undefined
      };

      const config = providerManager.getAtlasMongoDbProviderConfig();

      expect(config.privateKey).toBe('key');
      expect(config.publicKey).toEqual({
        'Fn::GetAtt': ['AtlasMongoCredentialsProvider', 'publicKey']
      });
    });

    test('should handle partial config for Upstash', () => {
      mockConfigManager.upstashProvider = {
        accountEmail: null,
        apiKey: 'api-key'
      };

      const config = providerManager.getUpstashProviderConfig();

      expect(config.accountEmail).toEqual({
        'Fn::GetAtt': ['UpstashCredentialsProvider', 'accountEmail']
      });
      expect(config.apiKey).toBe('api-key');
    });

    test('should call finish event even if credentials loading fails', async () => {
      const ParameterNotFound = (await import('@aws-sdk/client-ssm')).ParameterNotFound;
      mockGetSsmParameterValue.mockRejectedValueOnce(new ParameterNotFound());

      const { ThirdPartyProviderManager } = await import('./index');
      const manager = new ThirdPartyProviderManager();

      try {
        await manager.init({
          requireAtlasCredentialsParameter: true,
          requireUpstashCredentialsParameter: false
        });
      } catch (err) {
        // Expected to throw
      }

      expect(mockFinishEvent).not.toHaveBeenCalled();
    });
  });
});
