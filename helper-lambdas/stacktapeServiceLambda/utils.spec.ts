import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock dependencies
const mockDefaultProvider = mock(async () => ({
  accessKeyId: 'AKIATEST123',
  secretAccessKey: 'secret',
  sessionToken: 'token'
}));

const mockRetryPlugin = { name: 'retryPlugin' };

const mockAwsSdkManagerInit = mock(() => {});

const mockAwsSdkManager = {
  init: mockAwsSdkManagerInit
};

mock.module('@aws-sdk/credential-provider-node', () => ({
  defaultProvider: mockDefaultProvider
}));

mock.module('@shared/aws/sdk-manager', () => ({
  AwsSdkManager: class {
    constructor() {
      return mockAwsSdkManager;
    }
  }
}));

mock.module('@shared/aws/sdk-manager/utils', () => ({
  retryPlugin: mockRetryPlugin
}));

describe('stacktapeServiceLambda/utils', () => {
  let getAwsSdkManager: any;
  const originalEnv = process.env;

  beforeEach(async () => {
    mock.restore();

    // Clear mocks
    mockDefaultProvider.mockClear();
    mockAwsSdkManagerInit.mockClear();

    // Set up environment variables
    process.env = {
      ...originalEnv,
      AWS_REGION: 'us-east-1'
    };

    // Set up default implementations
    mockDefaultProvider.mockResolvedValue({
      accessKeyId: 'AKIATEST123',
      secretAccessKey: 'secret',
      sessionToken: 'token'
    });

    const module = await import('./utils');
    getAwsSdkManager = module.getAwsSdkManager;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getAwsSdkManager', () => {
    test('should create AwsSdkManager with default credentials', async () => {
      await getAwsSdkManager();

      expect(mockDefaultProvider).toHaveBeenCalled();
      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: 'AKIATEST123',
          secretAccessKey: 'secret',
          sessionToken: 'token'
        },
        region: 'us-east-1',
        plugins: [mockRetryPlugin]
      });
    });

    test('should use provided region', async () => {
      await getAwsSdkManager({ region: 'eu-west-1' as any });

      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: 'AKIATEST123',
          secretAccessKey: 'secret',
          sessionToken: 'token'
        },
        region: 'eu-west-1',
        plugins: [mockRetryPlugin]
      });
    });

    test('should use provided credentials', async () => {
      const customCredentials = {
        accessKeyId: 'AKIACUSTOM',
        secretAccessKey: 'custom-secret',
        sessionToken: 'custom-token'
      };

      await getAwsSdkManager({ credentials: customCredentials as any });

      expect(mockDefaultProvider).not.toHaveBeenCalled();
      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith({
        credentials: customCredentials,
        region: 'us-east-1',
        plugins: [mockRetryPlugin]
      });
    });

    test('should use provided plugins', async () => {
      const customPlugins = [
        { name: 'plugin1' },
        { name: 'plugin2' }
      ];

      await getAwsSdkManager({ plugins: customPlugins as any });

      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: 'AKIATEST123',
          secretAccessKey: 'secret',
          sessionToken: 'token'
        },
        region: 'us-east-1',
        plugins: customPlugins
      });
    });

    test('should use environment variable for region', async () => {
      process.env.AWS_REGION = 'ap-southeast-1';

      const module = await import('./utils');
      const newGetAwsSdkManager = module.getAwsSdkManager;

      await newGetAwsSdkManager();

      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: 'AKIATEST123',
          secretAccessKey: 'secret',
          sessionToken: 'token'
        },
        region: 'ap-southeast-1',
        plugins: [mockRetryPlugin]
      });
    });

    test('should return AwsSdkManager instance', async () => {
      const result = await getAwsSdkManager();

      expect(result).toBe(mockAwsSdkManager);
    });

    test('should handle all parameters together', async () => {
      const customCredentials = {
        accessKeyId: 'AKIAALL',
        secretAccessKey: 'all-secret',
        sessionToken: 'all-token'
      };
      const customPlugins = [{ name: 'customPlugin' }];

      await getAwsSdkManager({
        region: 'us-west-2' as any,
        credentials: customCredentials as any,
        plugins: customPlugins as any
      });

      expect(mockDefaultProvider).not.toHaveBeenCalled();
      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith({
        credentials: customCredentials,
        region: 'us-west-2',
        plugins: customPlugins
      });
    });

    test('should handle missing AWS_REGION environment variable', async () => {
      delete process.env.AWS_REGION;

      const module = await import('./utils');
      const newGetAwsSdkManager = module.getAwsSdkManager;

      await newGetAwsSdkManager();

      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: 'AKIATEST123',
          secretAccessKey: 'secret',
          sessionToken: 'token'
        },
        region: undefined,
        plugins: [mockRetryPlugin]
      });
    });

    test('should handle credentials without session token', async () => {
      mockDefaultProvider.mockResolvedValueOnce({
        accessKeyId: 'AKIANOSESSION',
        secretAccessKey: 'secret'
      });

      await getAwsSdkManager();

      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: 'AKIANOSESSION',
          secretAccessKey: 'secret'
        },
        region: 'us-east-1',
        plugins: [mockRetryPlugin]
      });
    });

    test('should handle empty plugins array', async () => {
      await getAwsSdkManager({ plugins: [] });

      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: 'AKIATEST123',
          secretAccessKey: 'secret',
          sessionToken: 'token'
        },
        region: 'us-east-1',
        plugins: []
      });
    });
  });

  describe('error handling', () => {
    test('should propagate credential provider errors', async () => {
      mockDefaultProvider.mockRejectedValueOnce(new Error('Credentials not available'));

      await expect(getAwsSdkManager()).rejects.toThrow('Credentials not available');
    });

    test('should handle credential provider timeout', async () => {
      mockDefaultProvider.mockImplementationOnce(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      await expect(getAwsSdkManager()).rejects.toThrow('Timeout');
    });

    test('should handle AwsSdkManager initialization errors', async () => {
      mockAwsSdkManagerInit.mockImplementationOnce(() => {
        throw new Error('SDK initialization failed');
      });

      await expect(getAwsSdkManager()).rejects.toThrow('SDK initialization failed');
    });
  });

  describe('integration scenarios', () => {
    test('should work in Lambda execution environment', async () => {
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_SESSION_TOKEN = 'lambda-session-token';

      const module = await import('./utils');
      const newGetAwsSdkManager = module.getAwsSdkManager;

      const result = await newGetAwsSdkManager();

      expect(result).toBe(mockAwsSdkManager);
      expect(mockAwsSdkManagerInit).toHaveBeenCalled();
    });

    test('should work with assumed role credentials', async () => {
      const assumedCredentials = {
        accessKeyId: 'ASIATEMP',
        secretAccessKey: 'temp-secret',
        sessionToken: 'assumed-token',
        expiration: new Date(Date.now() + 3600000)
      };

      mockDefaultProvider.mockResolvedValueOnce(assumedCredentials);

      await getAwsSdkManager();

      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: assumedCredentials
        })
      );
    });

    test('should work with multiple region configurations', async () => {
      const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1'];

      for (const region of regions) {
        mockAwsSdkManagerInit.mockClear();
        await getAwsSdkManager({ region: region as any });

        expect(mockAwsSdkManagerInit).toHaveBeenCalledWith(
          expect.objectContaining({
            region
          })
        );
      }
    });

    test('should handle concurrent initialization', async () => {
      const promises = Array.from({ length: 5 }, () => getAwsSdkManager());

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(mockDefaultProvider).toHaveBeenCalledTimes(5);
      expect(mockAwsSdkManagerInit).toHaveBeenCalledTimes(5);
    });
  });

  describe('edge cases', () => {
    test('should handle undefined input object', async () => {
      await getAwsSdkManager(undefined);

      expect(mockDefaultProvider).toHaveBeenCalled();
      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: 'AKIATEST123',
          secretAccessKey: 'secret',
          sessionToken: 'token'
        },
        region: 'us-east-1',
        plugins: [mockRetryPlugin]
      });
    });

    test('should handle empty input object', async () => {
      await getAwsSdkManager({});

      expect(mockDefaultProvider).toHaveBeenCalled();
      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith({
        credentials: {
          accessKeyId: 'AKIATEST123',
          secretAccessKey: 'secret',
          sessionToken: 'token'
        },
        region: 'us-east-1',
        plugins: [mockRetryPlugin]
      });
    });

    test('should handle credentials with additional properties', async () => {
      const extendedCredentials = {
        accessKeyId: 'AKIAEXTENDED',
        secretAccessKey: 'extended-secret',
        sessionToken: 'extended-token',
        customProperty: 'custom-value'
      };

      await getAwsSdkManager({ credentials: extendedCredentials as any });

      expect(mockAwsSdkManagerInit).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: extendedCredentials
        })
      );
    });
  });
});
