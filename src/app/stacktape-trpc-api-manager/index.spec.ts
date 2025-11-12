import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock dependencies
const mockRecordStackOperation = mock(async () => ({ success: true }));
const mockDeleteUndeployedStage = mock(async () => ({ success: true }));
const mockDefaultDomainsInfo = mock(async () => ({
  suffix: '-abc123.stacktape-app.com',
  certDomainSuffix: '.stacktape-app.com',
  version: 1
}));

const mockApiClient = {
  init: mock(async () => {}),
  recordStackOperation: mockRecordStackOperation,
  deleteUndeployedStage: mockDeleteUndeployedStage,
  defaultDomainsInfo: mockDefaultDomainsInfo
};

const mockGlobalStateManager = {
  invocationId: 'test-invocation-123',
  command: 'deploy',
  args: ['--stage', 'dev'],
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'AKIATEST123',
    secretAccessKey: 'secret',
    sessionToken: undefined
  },
  targetAwsAccount: {
    awsAccountId: '123456789012',
    id: 'account-conn-123'
  },
  targetStack: {
    stackName: 'my-project-dev',
    projectName: 'my-project',
    stage: 'dev'
  },
  operationStart: new Date('2024-01-01T00:00:00Z'),
  isExecutingInsideCodebuild: false
};

const mockGitInfo = {
  branch: 'main',
  commit: 'abc123def456',
  gitUrl: 'https://github.com/user/repo.git'
};

const mockGitInfoManager = {
  gitInfo: Promise.resolve(mockGitInfo)
};

const mockGetStacktapeVersion = mock(() => '1.5.0');

const mockPrinter = {
  debug: mock(() => {}),
  warn: mock(() => {})
};

const mockStpErrors = {
  e503: mock(({ message }) => new Error(`API Error: ${message}`))
};

const mockConfig = {
  IS_DEV: false
};

mock.module('../../../shared/trpc/api-key-protected', () => ({
  ApiKeyProtectedClient: class {
    constructor() {
      return mockApiClient;
    }
  }
}));

mock.module('../../config/error-messages', () => ({
  stpErrors: mockStpErrors
}));

mock.module('../../config/random', () => mockConfig);

mock.module('../../utils/git-info-manager', () => ({
  gitInfoManager: mockGitInfoManager
}));

mock.module('../../utils/printer', () => ({
  printer: mockPrinter
}));

mock.module('../../utils/versioning', () => ({
  getStacktapeVersion: mockGetStacktapeVersion
}));

mock.module('../global-state-manager', () => ({
  globalStateManager: mockGlobalStateManager
}));

describe('StacktapeTrpcApiManager', () => {
  let stacktapeTrpcApiManager: any;

  beforeEach(async () => {
    mock.restore();

    // Clear all mocks
    mockApiClient.init.mockClear();
    mockRecordStackOperation.mockClear();
    mockDeleteUndeployedStage.mockClear();
    mockDefaultDomainsInfo.mockClear();
    mockGetStacktapeVersion.mockClear();
    mockPrinter.debug.mockClear();
    mockPrinter.warn.mockClear();
    mockStpErrors.e503.mockClear();

    // Set up default implementations
    mockApiClient.init.mockResolvedValue(undefined);
    mockRecordStackOperation.mockResolvedValue({ success: true });
    mockDeleteUndeployedStage.mockResolvedValue({ success: true });
    mockDefaultDomainsInfo.mockResolvedValue({
      suffix: '-abc123.stacktape-app.com',
      certDomainSuffix: '.stacktape-app.com',
      version: 1
    });
    mockGetStacktapeVersion.mockReturnValue('1.5.0');
    mockStpErrors.e503.mockImplementation(({ message }) => new Error(`API Error: ${message}`));
    mockConfig.IS_DEV = false;
    mockGlobalStateManager.isExecutingInsideCodebuild = false;
    mockGlobalStateManager.targetAwsAccount.id = 'account-conn-123';
    process.env.CODEBUILD_LOG_PATH = undefined;

    const module = await import('./index');
    stacktapeTrpcApiManager = module.stacktapeTrpcApiManager;
  });

  describe('initialization', () => {
    test('should initialize with API key', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-api-key-123' });

      expect(mockApiClient.init).toHaveBeenCalledWith({
        apiKey: 'test-api-key-123'
      });
    });

    test('should wrap all API client methods with logging', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.apiClient.recordStackOperation({
        invocationId: 'test-123',
        command: 'deploy'
      });

      expect(mockPrinter.debug).toHaveBeenCalledWith(
        expect.stringContaining('Performing TRPC operation recordStackOperation')
      );
      expect(mockPrinter.debug).toHaveBeenCalledWith(
        expect.stringContaining('Stacktape TRPC operation recordStackOperation took')
      );
    });

    test('should handle API client init without apiKey', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: '' });

      expect(mockApiClient.init).toHaveBeenCalledWith({
        apiKey: ''
      });
    });
  });

  describe('recordStackOperationStart', () => {
    test('should record stack operation start with all details', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationStart({
        startingCodebuildOperation: false
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith({
        invocationId: 'test-invocation-123',
        command: 'deploy',
        startTime: mockGlobalStateManager.operationStart.getTime(),
        awsAccessKeyId: 'AKIATEST123',
        awsAccountId: '123456789012',
        accountConnectionId: 'account-conn-123',
        region: 'us-east-1',
        commandArgs: ['--stage', 'dev'],
        gitBranch: 'main',
        gitCommit: 'abc123def456',
        gitUrl: 'https://github.com/user/repo.git',
        isCodebuildOperation: false,
        inProgress: true,
        stacktapeVersion: '1.5.0',
        logStreamName: undefined
      });
    });

    test('should record codebuild operation start', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationStart({
        startingCodebuildOperation: true
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          isCodebuildOperation: true
        })
      );
    });

    test('should include log stream name when executing inside codebuild', async () => {
      mockGlobalStateManager.isExecutingInsideCodebuild = true;
      process.env.CODEBUILD_LOG_PATH = 'log/path/stream-name';

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationStart({
        startingCodebuildOperation: false
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          logStreamName: 'log/path/stream-name'
        })
      );
    });

    test('should handle missing account connection ID', async () => {
      mockGlobalStateManager.targetAwsAccount.id = undefined;

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationStart({
        startingCodebuildOperation: false
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          accountConnectionId: undefined
        })
      );
    });
  });

  describe('recordStackOperationProgress', () => {
    test('should record stack operation progress', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationProgress({
        stackName: 'my-stack-dev',
        projectName: 'my-stack'
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith({
        invocationId: 'test-invocation-123',
        commandArgs: ['--stage', 'dev'],
        command: 'deploy',
        region: 'us-east-1',
        stackName: 'my-stack-dev',
        serviceName: 'my-stack',
        accountConnectionId: 'account-conn-123',
        codebuildBuildArn: undefined,
        logStreamName: undefined,
        inProgress: true,
        stacktapeVersion: '1.5.0',
        gitBranch: 'main',
        gitCommit: 'abc123def456',
        gitUrl: 'https://github.com/user/repo.git'
      });
    });

    test('should include codebuild build ARN when provided', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationProgress({
        stackName: 'my-stack-dev',
        projectName: 'my-stack',
        codebuildBuildArn: 'arn:aws:codebuild:us-east-1:123:build/project:build-id'
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          codebuildBuildArn: 'arn:aws:codebuild:us-east-1:123:build/project:build-id'
        })
      );
    });

    test('should include log stream name when provided', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationProgress({
        stackName: 'my-stack-dev',
        projectName: 'my-stack',
        logStreamName: 'my-log-stream'
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          logStreamName: 'my-log-stream'
        })
      );
    });

    test('should handle missing account connection ID', async () => {
      mockGlobalStateManager.targetAwsAccount.id = undefined;

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationProgress({
        stackName: 'my-stack-dev',
        projectName: 'my-stack'
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          accountConnectionId: undefined
        })
      );
    });
  });

  describe('recordStackOperationEnd', () => {
    test('should record successful operation end', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationEnd({
        success: true,
        interrupted: false,
        stackName: 'my-stack-dev'
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith({
        invocationId: 'test-invocation-123',
        endTime: expect.any(Number),
        success: true,
        interrupted: false,
        description: undefined,
        region: 'us-east-1',
        stackName: 'my-stack-dev',
        codebuildBuildArn: undefined,
        logStreamName: undefined,
        command: 'deploy',
        inProgress: false,
        stacktapeVersion: '1.5.0'
      });
    });

    test('should record failed operation with error', async () => {
      const error = new Error('Deployment failed');

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationEnd({
        success: false,
        interrupted: false,
        error,
        stackName: 'my-stack-dev'
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          description: 'Error: Deployment failed'
        })
      );
    });

    test('should record interrupted operation', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationEnd({
        success: false,
        interrupted: true,
        stackName: 'my-stack-dev'
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          interrupted: true,
          description: 'Operation was interrupted'
        })
      );
    });

    test('should prefix command with codebuild when executing inside codebuild', async () => {
      mockGlobalStateManager.isExecutingInsideCodebuild = true;

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationEnd({
        success: true,
        interrupted: false,
        stackName: 'my-stack-dev'
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'codebuild:deploy'
        })
      );
    });

    test('should include codebuild build ARN and log stream', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationEnd({
        success: true,
        interrupted: false,
        stackName: 'my-stack-dev',
        codebuildBuildArn: 'arn:aws:codebuild:us-east-1:123:build/project:build-id',
        logStreamName: 'my-log-stream'
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          codebuildBuildArn: 'arn:aws:codebuild:us-east-1:123:build/project:build-id',
          logStreamName: 'my-log-stream'
        })
      );
    });
  });

  describe('deleteUndeployedStage', () => {
    test('should delete undeployed stage', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.deleteUndeployedStage();

      expect(mockDeleteUndeployedStage).toHaveBeenCalledWith({
        projectName: 'my-project',
        stageName: 'dev'
      });
    });
  });

  describe('error handling', () => {
    test('should throw error on UNAUTHORIZED with API key', async () => {
      mockRecordStackOperation.mockRejectedValueOnce({
        shape: {
          data: { code: 'UNAUTHORIZED' },
          message: 'Invalid API key'
        }
      });

      await stacktapeTrpcApiManager.init({ apiKey: 'invalid-key' });

      await expect(
        stacktapeTrpcApiManager.recordStackOperationStart({
          startingCodebuildOperation: false
        })
      ).rejects.toThrow('API Error: Invalid API key.');

      expect(mockStpErrors.e503).toHaveBeenCalledWith({
        message: 'Invalid API key.'
      });
    });

    test('should throw different error on UNAUTHORIZED without API key', async () => {
      mockRecordStackOperation.mockRejectedValueOnce({
        shape: {
          data: { code: 'UNAUTHORIZED' },
          message: 'No API key'
        }
      });

      await stacktapeTrpcApiManager.init({ apiKey: '' });

      await expect(
        stacktapeTrpcApiManager.recordStackOperationStart({
          startingCodebuildOperation: false
        })
      ).rejects.toThrow('API Error: Invalid API key or no API key specified.');

      expect(mockStpErrors.e503).toHaveBeenCalledWith({
        message: 'Invalid API key or no API key specified.'
      });
    });

    test('should handle generic API errors', async () => {
      mockRecordStackOperation.mockRejectedValueOnce({
        shape: {
          data: { code: 'INTERNAL_SERVER_ERROR' },
          message: 'Server error occurred'
        }
      });

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await expect(
        stacktapeTrpcApiManager.recordStackOperationStart({
          startingCodebuildOperation: false
        })
      ).rejects.toThrow('API Error: Server error occurred');

      expect(mockStpErrors.e503).toHaveBeenCalledWith({
        message: 'Server error occurred'
      });
    });

    test('should handle errors without shape', async () => {
      mockRecordStackOperation.mockRejectedValueOnce(
        new Error('Network error')
      );

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await expect(
        stacktapeTrpcApiManager.recordStackOperationStart({
          startingCodebuildOperation: false
        })
      ).rejects.toThrow('API Error: Unknown error');
    });

    test('should warn in dev mode on API failure', async () => {
      mockConfig.IS_DEV = true;
      mockRecordStackOperation.mockRejectedValueOnce(
        new Error('Test error')
      );

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await expect(
        stacktapeTrpcApiManager.recordStackOperationStart({
          startingCodebuildOperation: false
        })
      ).rejects.toThrow();

      expect(mockPrinter.warn).toHaveBeenCalledWith(
        expect.stringContaining('Communication with Stacktape API has failed')
      );
    });

    test('should log timing even on error', async () => {
      mockRecordStackOperation.mockRejectedValueOnce(
        new Error('Test error')
      );

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      try {
        await stacktapeTrpcApiManager.recordStackOperationStart({
          startingCodebuildOperation: false
        });
      } catch (err) {
        // Expected to throw
      }

      expect(mockPrinter.debug).toHaveBeenCalledWith(
        expect.stringContaining('Stacktape TRPC API operation recordStackOperation took')
      );
    });
  });

  describe('edge cases', () => {
    test('should handle missing git info gracefully', async () => {
      mockGitInfoManager.gitInfo = Promise.resolve({
        branch: undefined,
        commit: undefined,
        gitUrl: undefined
      });

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationStart({
        startingCodebuildOperation: false
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          gitBranch: undefined,
          gitCommit: undefined,
          gitUrl: undefined
        })
      );
    });

    test('should handle missing AWS account ID', async () => {
      mockGlobalStateManager.targetAwsAccount.awsAccountId = undefined;

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationStart({
        startingCodebuildOperation: false
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          awsAccountId: undefined
        })
      );
    });

    test('should handle operations without stack name', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationEnd({
        success: true,
        interrupted: false
      });

      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          stackName: undefined
        })
      );
    });

    test('should handle very long error messages', async () => {
      const longError = new Error('x'.repeat(10000));

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationEnd({
        success: false,
        interrupted: false,
        error: longError,
        stackName: 'my-stack-dev'
      });

      expect(mockRecordStackOperation).toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    test('should handle full operation lifecycle', async () => {
      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      // Start operation
      await stacktapeTrpcApiManager.recordStackOperationStart({
        startingCodebuildOperation: false
      });

      // Record progress
      await stacktapeTrpcApiManager.recordStackOperationProgress({
        stackName: 'my-stack-dev',
        projectName: 'my-stack'
      });

      // End operation
      await stacktapeTrpcApiManager.recordStackOperationEnd({
        success: true,
        interrupted: false,
        stackName: 'my-stack-dev'
      });

      expect(mockRecordStackOperation).toHaveBeenCalledTimes(3);
    });

    test('should handle operation with codebuild', async () => {
      mockGlobalStateManager.isExecutingInsideCodebuild = true;
      process.env.CODEBUILD_LOG_PATH = 'log/path/stream';

      await stacktapeTrpcApiManager.init({ apiKey: 'test-key' });

      await stacktapeTrpcApiManager.recordStackOperationStart({
        startingCodebuildOperation: true
      });

      await stacktapeTrpcApiManager.recordStackOperationProgress({
        stackName: 'my-stack-dev',
        projectName: 'my-stack',
        codebuildBuildArn: 'arn:aws:codebuild:us-east-1:123:build/proj:id'
      });

      await stacktapeTrpcApiManager.recordStackOperationEnd({
        success: true,
        interrupted: false,
        stackName: 'my-stack-dev',
        codebuildBuildArn: 'arn:aws:codebuild:us-east-1:123:build/proj:id'
      });

      expect(mockRecordStackOperation).toHaveBeenCalledTimes(3);
      expect(mockRecordStackOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'codebuild:deploy'
        })
      );
    });
  });
});
