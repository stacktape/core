import { describe, expect, mock, test, beforeEach } from 'bun:test';

// Mock all dependencies
mock.module('@application-services/application-manager', () => ({
  applicationManager: {
    registerCleanUpHook: mock(() => {})
  }
}));

mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mock(async () => {}),
    finishEvent: mock(async () => {})
  }
}));

mock.module('@application-services/stacktape-trpc-api-manager', () => ({
  stacktapeTrpcApiManager: {
    init: mock(async () => {}),
    apiClient: {
      currentUserAndOrgData: mock(async () => ({
        user: { id: 'user-123', email: 'test@example.com' },
        organization: { name: 'test-org' },
        connectedAwsAccounts: [
          { name: 'test-account', awsAccountId: '123456789012', connectionMode: 'BASIC' }
        ],
        projects: [{ id: 'proj-1', name: 'test-project' }]
      })),
      awsAccountCredentials: mock(async () => ({
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          sessionToken: 'token123',
          expiration: new Date(Date.now() + 3600000).toISOString()
        }
      })),
      createProject: mock(async ({ name }) => ({
        id: 'new-proj-id',
        name
      }))
    }
  }
}));

mock.module('@cli-config', () => ({
  commandsNotRequiringApiKey: ['help', 'version', 'init']
}));

mock.module('@config', () => ({
  DEFAULT_CLOUDFORMATION_REGISTRY_BUCKET_NAME: 'stp-cf-registry',
  DEFAULT_CLOUDFORMATION_REGISTRY_BUCKET_REGION: 'us-east-1',
  RECORDED_STACKTAPE_COMMANDS: ['deploy', 'delete', 'rollback'],
  configurableGlobalDefaultCliArgs: {},
  configurableGlobalDefaultOtherProps: {}
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: {
    configResolver: {
      rawConfig: {
        serviceName: null
      }
    }
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e501: mock((opts) => new Error(`API key required for ${opts.operation}`)),
    e65: mock(() => new Error('AWS account not found')),
    e66: mock(() => new Error('No connected AWS accounts')),
    e67: mock(() => new Error('Multiple AWS accounts - specify one')),
    e103: mock(() => new Error('Project name required'))
  }
}));

mock.module('@shared/naming/utils', () => ({
  getRoleArnFromSessionArn: mock((arn) => arn.replace(':sts:', ':iam:').replace(':assumed-role/', ':role/'))
}));

mock.module('@shared/utils/hashing', () => ({
  getGloballyUniqueStackHash: mock(({ stackName }) => `hash-${stackName}`)
}));

mock.module('@shared/utils/misc', () => ({
  propertyFromObjectOrNull: mock((obj, prop) => obj?.[prop] || null)
}));

mock.module('@shared/utils/user-prompt', () => ({
  userPrompt: mock(async ({ initial, name }) => ({
    [name]: initial || 'test-value'
  }))
}));

mock.module('@utils/aws-config', () => ({
  listAwsProfiles: mock(async () => [
    { profile: 'default', AWS_ACCESS_KEY_ID: 'AKIATEST', AWS_SECRET_ACCESS_KEY: 'secret123' },
    { profile: 'test-profile', AWS_ACCESS_KEY_ID: 'AKIATEST2', AWS_SECRET_ACCESS_KEY: 'secret456' }
  ]),
  loadAwsConfigFileContent: mock(async () => ({
    default: { region: 'us-east-1' },
    'test-profile': { region: 'eu-west-1' }
  }))
}));

mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    getAssumedRoleCredentials: mock(async () => ({
      accessKeyId: 'AKIAASSUMED',
      secretAccessKey: 'assumedSecret',
      sessionToken: 'assumedToken',
      expiration: new Date(Date.now() + 3600000)
    }))
  }
}));

mock.module('@utils/decorators', () => ({
  memoizeGetters: mock((target) => target)
}));

mock.module('@utils/helper-lambdas', () => ({
  loadHelperLambdaDetails: mock(async () => ({
    stacktapeServiceLambda: { size: 1000 }
  }))
}));

mock.module('@utils/printer', () => ({
  printer: {
    getLink: mock((name, url) => url),
    colorize: mock((color, text) => text),
    prettyConfigProperty: mock((prop) => prop),
    prettyOption: mock((opt) => opt),
    warn: mock(() => {}),
    makeBold: mock((text) => text)
  }
}));

mock.module('@utils/time', () => ({
  getAwsSynchronizedTime: mock(async () => new Date())
}));

mock.module('@utils/uuid', () => ({
  generateShortUuid: mock(() => 'short-uuid'),
  generateUuid: mock(() => 'uuid-12345')
}));

mock.module('@utils/validator', () => ({
  validateArgs: mock(() => {}),
  validateAwsAccountUsability: mock(() => {}),
  validateAwsProfile: mock(() => {}),
  validateCommand: mock(() => {}),
  validateCredentialsWithRespectToAccount: mock(async ({ credentials }) => ({
    ...credentials,
    identity: {
      account: '123456789012',
      arn: 'arn:aws:iam::123456789012:user/test'
    }
  })),
  validateProjectName: mock(() => {})
}));

mock.module('./utils', () => ({
  createTemporaryMixpanelUser: mock(async () => {}),
  loadPersistedState: mock(async () => ({
    systemId: 'persisted-system-id',
    cliArgsDefaults: {},
    otherDefaults: {}
  })),
  savePersistedState: mock(async () => {})
}));

describe('global-state-manager', () => {
  describe('GlobalStateManager', () => {
    test('should initialize with default values', async () => {
      const { GlobalStateManager } = await import('./index');
      const manager = new GlobalStateManager();

      expect(manager.isInitialized).toBe(false);
      expect(manager.initializedDomainServices).toEqual([]);
      expect(manager.credentials).toBeDefined();
      expect(manager.credentials.identity.account).toBe('123456789999');
    });

    test('should initialize with CLI invocation', async () => {
      const { GlobalStateManager } = await import('./index');
      const { loadPersistedState } = await import('./utils');
      const manager = new GlobalStateManager();

      await manager.init({
        commands: ['deploy'],
        args: { region: 'us-west-2', stage: 'production' },
        invokedFrom: 'cli',
        additionalArgs: {}
      });

      expect(manager.isInitialized).toBe(true);
      expect(manager.rawCommands).toEqual(['deploy']);
      expect(manager.invokedFrom).toBe('cli');
      expect(loadPersistedState).toHaveBeenCalled();
    });

    test('should initialize with server invocation', async () => {
      const { GlobalStateManager } = await import('./index');
      const manager = new GlobalStateManager();

      await manager.init({
        commands: ['deploy'],
        args: {},
        invokedFrom: 'server',
        additionalArgs: {}
      });

      expect(manager.targetStack).toBeDefined();
      expect(manager.targetStack.stackName).toBe('project-stage');
      expect(manager.targetStack.projectId).toBe('project-id');
    });

    test('should initialize with preset config', async () => {
      const { GlobalStateManager } = await import('./index');
      const manager = new GlobalStateManager();
      const presetConfig = { serviceName: 'my-service' } as any;

      await manager.init({
        commands: ['deploy'],
        args: {},
        invokedFrom: 'cli',
        additionalArgs: {},
        config: presetConfig
      });

      expect(manager.presetConfig).toBe(presetConfig);
    });

    test('should generate system ID if not persisted', async () => {
      const { GlobalStateManager } = await import('./index');
      const { loadPersistedState, savePersistedState, createTemporaryMixpanelUser } = await import('./utils');

      // Mock no persisted system ID
      loadPersistedState.mockResolvedValueOnce({
        systemId: null,
        cliArgsDefaults: {},
        otherDefaults: {}
      });

      const manager = new GlobalStateManager();
      await manager.init({
        commands: ['deploy'],
        args: {},
        invokedFrom: 'cli',
        additionalArgs: {}
      });

      expect(manager.systemId).toBe('uuid-12345');
      expect(savePersistedState).toHaveBeenCalled();
      expect(createTemporaryMixpanelUser).toHaveBeenCalledWith('uuid-12345');
    });

    test('should use persisted system ID if available', async () => {
      const { GlobalStateManager } = await import('./index');
      const { loadPersistedState } = await import('./utils');

      loadPersistedState.mockResolvedValueOnce({
        systemId: 'persisted-id',
        cliArgsDefaults: {},
        otherDefaults: {}
      });

      const manager = new GlobalStateManager();
      await manager.init({
        commands: ['deploy'],
        args: {},
        invokedFrom: 'cli',
        additionalArgs: {}
      });

      expect(manager.systemId).toBe('persisted-id');
    });

    test('should use API key from environment', async () => {
      const { GlobalStateManager } = await import('./index');
      const originalEnv = process.env.STACKTAPE_API_KEY;
      process.env.STACKTAPE_API_KEY = 'env-api-key';

      try {
        const manager = new GlobalStateManager();
        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        expect(manager.apiKey).toBe('env-api-key');
      } finally {
        if (originalEnv) {
          process.env.STACKTAPE_API_KEY = originalEnv;
        } else {
          delete process.env.STACKTAPE_API_KEY;
        }
      }
    });

    describe('getters', () => {
      test('should return args correctly', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: { region: 'us-west-2', stage: 'prod' },
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        expect(manager.args).toEqual({ region: 'us-west-2', stage: 'prod' });
      });

      test('should return command correctly', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['delete', 'stack'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        expect(manager.command).toBe('delete');
      });

      test('should return workingDir from currentWorkingDirectory', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: { currentWorkingDirectory: '/custom/path' },
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        expect(manager.workingDir).toBe('/custom/path');
      });

      test('should return workingDir from configPath dirname', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        manager.configPath = '/project/stacktape.config.ts';
        expect(manager.workingDir).toBe('/project');
      });

      test('should return workingDir as cwd when no config or custom path', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        expect(manager.workingDir).toBe(process.cwd());
      });

      test('should detect debug mode from environment', async () => {
        const { GlobalStateManager } = await import('./index');
        const originalEnv = process.env.STP_DEBUG;
        process.env.STP_DEBUG = 'true';

        try {
          const manager = new GlobalStateManager();
          await manager.init({
            commands: ['deploy'],
            args: {},
            invokedFrom: 'cli',
            additionalArgs: {}
          });

          expect(manager.isDebugMode).toBe(true);
        } finally {
          if (originalEnv) {
            process.env.STP_DEBUG = originalEnv;
          } else {
            delete process.env.STP_DEBUG;
          }
        }
      });

      test('should detect debug mode from logLevel', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: { logLevel: 'debug' },
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        expect(manager.isDebugMode).toBe(true);
      });

      test('should return json log format for non-cli invocation', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'sdk',
          additionalArgs: {}
        });

        expect(manager.logFormat).toBe('json');
      });

      test('should return region from args', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: { region: 'eu-central-1' },
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        expect(manager.region).toBe('eu-central-1');
      });

      test('should return region from environment variable', async () => {
        const { GlobalStateManager } = await import('./index');
        const originalEnv = process.env.AWS_DEFAULT_REGION;
        process.env.AWS_DEFAULT_REGION = 'ap-southeast-1';

        try {
          const manager = new GlobalStateManager();
          await manager.init({
            commands: ['deploy'],
            args: {},
            invokedFrom: 'cli',
            additionalArgs: {}
          });

          expect(manager.region).toBe('ap-southeast-1');
        } finally {
          if (originalEnv) {
            process.env.AWS_DEFAULT_REGION = originalEnv;
          } else {
            delete process.env.AWS_DEFAULT_REGION;
          }
        }
      });

      test('should return awsProfileName from args', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: { profile: 'custom-profile' },
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        expect(manager.awsProfileName).toBe('custom-profile');
      });

      test('should return default profile when no profile specified', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        expect(manager.awsProfileName).toBe('default');
      });

      test('should detect codebuild execution from environment', async () => {
        const { GlobalStateManager } = await import('./index');
        const originalEnv = process.env.STP_CODEBUILD;
        process.env.STP_CODEBUILD = 'true';

        try {
          const manager = new GlobalStateManager();
          await manager.init({
            commands: ['deploy'],
            args: {},
            invokedFrom: 'cli',
            additionalArgs: {}
          });

          expect(manager.isExecutingInsideCodebuild).toBe(true);
        } finally {
          if (originalEnv) {
            process.env.STP_CODEBUILD = originalEnv;
          } else {
            delete process.env.STP_CODEBUILD;
          }
        }
      });
    });

    describe('markDomainServiceAsInitialized', () => {
      test('should mark domain service as initialized', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        manager.markDomainServiceAsInitialized('configManager');
        manager.markDomainServiceAsInitialized('templateManager');

        expect(manager.initializedDomainServices).toContain('configManager');
        expect(manager.initializedDomainServices).toContain('templateManager');
        expect(manager.initializedDomainServices).toHaveLength(2);
      });
    });

    describe('saveDefaults', () => {
      test('should save CLI args and other defaults', async () => {
        const { GlobalStateManager } = await import('./index');
        const { savePersistedState } = await import('./utils');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        const cliArgsDefaults = { region: 'us-east-1', stage: 'production' } as any;
        const otherDefaults = { apiKey: 'my-key' } as any;

        await manager.saveDefaults({ cliArgsDefaults, otherDefaults });

        expect(manager.persistedState.cliArgsDefaults).toBe(cliArgsDefaults);
        expect(manager.persistedState.otherDefaults).toBe(otherDefaults);
        expect(savePersistedState).toHaveBeenCalledWith(manager.persistedState);
      });
    });

    describe('saveApiKey', () => {
      test('should save API key to persisted state', async () => {
        const { GlobalStateManager } = await import('./index');
        const { savePersistedState } = await import('./utils');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        await manager.saveApiKey({ apiKey: 'new-api-key' });

        expect(savePersistedState).toHaveBeenCalledWith(
          expect.objectContaining({
            otherDefaults: expect.objectContaining({
              apiKey: 'new-api-key'
            })
          })
        );
      });
    });

    describe('loadUserCredentials', () => {
      test('should load user data and AWS credentials', async () => {
        const { GlobalStateManager } = await import('./index');
        const { stacktapeTrpcApiManager } = await import('@application-services/stacktape-trpc-api-manager');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        process.env.STACKTAPE_API_KEY = 'test-key';
        await manager.loadUserCredentials();

        expect(stacktapeTrpcApiManager.init).toHaveBeenCalledWith({ apiKey: 'test-key' });
        expect(manager.userData).toBeDefined();
        expect(manager.organizationData).toBeDefined();
        expect(manager.connectedAwsAccounts).toBeDefined();
      });
    });

    describe('loadUserDataFromTrpcApi', () => {
      test('should load user, organization, and projects', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        await manager.loadUserDataFromTrpcApi();

        expect(manager.userData).toEqual({ id: 'user-123', email: 'test@example.com' });
        expect(manager.organizationData).toEqual({ name: 'test-org' });
        expect(manager.connectedAwsAccounts).toHaveLength(1);
        expect(manager.projects).toHaveLength(1);
      });
    });

    describe('loadValidatedAwsCredentials', () => {
      test('should load credentials from environment variables', async () => {
        const { GlobalStateManager } = await import('./index');
        const originalEnvs = {
          AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY
        };

        process.env.AWS_ACCESS_KEY_ID = 'AKIATEST';
        process.env.AWS_SECRET_ACCESS_KEY = 'secretTest';

        try {
          const manager = new GlobalStateManager();
          await manager.init({
            commands: ['deploy'],
            args: {},
            invokedFrom: 'cli',
            additionalArgs: {}
          });

          manager.connectedAwsAccounts = [
            { name: 'test', awsAccountId: '123456789012', connectionMode: 'BASIC' } as any
          ];
          manager.organizationData = { name: 'test-org' } as any;

          await manager.loadValidatedAwsCredentials();

          expect(manager.credentials.accessKeyId).toBe('AKIATEST');
          expect(manager.credentials.identity).toBeDefined();
        } finally {
          if (originalEnvs.AWS_ACCESS_KEY_ID) {
            process.env.AWS_ACCESS_KEY_ID = originalEnvs.AWS_ACCESS_KEY_ID;
          } else {
            delete process.env.AWS_ACCESS_KEY_ID;
          }
          if (originalEnvs.AWS_SECRET_ACCESS_KEY) {
            process.env.AWS_SECRET_ACCESS_KEY = originalEnvs.AWS_SECRET_ACCESS_KEY;
          } else {
            delete process.env.AWS_SECRET_ACCESS_KEY;
          }
        }
      });

      test('should load credentials from API for privileged connection', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        manager.connectedAwsAccounts = [
          { name: 'test', awsAccountId: '123456789012', connectionMode: 'PRIVILEGED' } as any
        ];
        manager.organizationData = { name: 'test-org' } as any;

        await manager.loadValidatedAwsCredentials();

        expect(manager.credentials.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
        expect(manager.credentials.source).toBe('api');
      });

      test('should load credentials from credentials file for basic connection', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        manager.connectedAwsAccounts = [
          { name: 'test', awsAccountId: '123456789012', connectionMode: 'BASIC' } as any
        ];
        manager.organizationData = { name: 'test-org' } as any;

        await manager.loadValidatedAwsCredentials();

        expect(manager.credentials.accessKeyId).toBe('AKIATEST');
        expect(manager.credentials.source).toBe('credentialsFile');
      });
    });

    describe('getStackOperationLogStreamName', () => {
      test('should return log stream name for recorded commands', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        const logStreamName = manager.getStackOperationLogStreamName({ stackName: 'my-stack' });

        expect(logStreamName).toContain('my-stack');
        expect(logStreamName).toContain('deploy');
      });

      test('should return codebuild log path when executing inside codebuild', async () => {
        const { GlobalStateManager } = await import('./index');
        const originalEnv = process.env.STP_CODEBUILD;
        const originalLogPath = process.env.CODEBUILD_LOG_PATH;
        process.env.STP_CODEBUILD = 'true';
        process.env.CODEBUILD_LOG_PATH = '/codebuild/logs/path';

        try {
          const manager = new GlobalStateManager();
          await manager.init({
            commands: ['deploy'],
            args: {},
            invokedFrom: 'cli',
            additionalArgs: {}
          });

          const logStreamName = manager.getStackOperationLogStreamName({ stackName: 'my-stack' });

          expect(logStreamName).toBe('/codebuild/logs/path');
        } finally {
          if (originalEnv) {
            process.env.STP_CODEBUILD = originalEnv;
          } else {
            delete process.env.STP_CODEBUILD;
          }
          if (originalLogPath) {
            process.env.CODEBUILD_LOG_PATH = originalLogPath;
          } else {
            delete process.env.CODEBUILD_LOG_PATH;
          }
        }
      });

      test('should return undefined for non-recorded commands', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['help'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        const logStreamName = manager.getStackOperationLogStreamName({ stackName: 'my-stack' });

        expect(logStreamName).toBeUndefined();
      });
    });

    describe('setConfigPath', () => {
      test('should set config path', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        manager.setConfigPath('/path/to/stacktape.config.ts');

        expect(manager.configPath).toBe('/path/to/stacktape.config.ts');
      });
    });

    describe('loadTargetStackInfo', () => {
      test('should load target stack info with projectName from args', async () => {
        const { GlobalStateManager } = await import('./index');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: { projectName: 'test-project', stage: 'production' },
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        manager.connectedAwsAccounts = [
          { name: 'test', awsAccountId: '123456789012', connectionMode: 'BASIC' } as any
        ];
        manager.organizationData = { name: 'test-org' } as any;
        manager.projects = [{ id: 'proj-1', name: 'test-project' }] as any;

        await manager.loadTargetStackInfo();

        expect(manager.targetStack.projectName).toBe('test-project');
        expect(manager.targetStack.stage).toBe('production');
        expect(manager.targetStack.stackName).toBe('test-project-production');
        expect(manager.targetStack.globallyUniqueStackHash).toBe('hash-test-project-production');
      });
    });

    describe('reloadPersistedState', () => {
      test('should reload persisted state', async () => {
        const { GlobalStateManager } = await import('./index');
        const { loadPersistedState } = await import('./utils');
        const manager = new GlobalStateManager();

        await manager.init({
          commands: ['deploy'],
          args: {},
          invokedFrom: 'cli',
          additionalArgs: {}
        });

        loadPersistedState.mockResolvedValueOnce({
          systemId: 'new-system-id',
          cliArgsDefaults: { region: 'us-west-2' } as any,
          otherDefaults: {}
        });

        await manager.reloadPersistedState();

        expect(manager.persistedState.systemId).toBe('new-system-id');
      });
    });
  });
});
