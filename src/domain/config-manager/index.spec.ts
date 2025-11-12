import { describe, expect, mock, test, beforeEach } from 'bun:test';

// Mock dependencies
mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mock(async () => {}),
    finishEvent: mock(async () => {})
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    args: { templateId: null },
    presetConfig: null,
    invokedFrom: 'cli',
    configPath: '/project/stacktape.config.ts',
    setConfigPath: mock(() => {}),
    targetStack: {
      stackName: 'test-stack',
      projectName: 'test-project',
      stage: 'production'
    },
    region: 'us-east-1',
    targetAwsAccount: {
      awsAccountId: '123456789012'
    },
    helperLambdaDetails: {
      stacktapeServiceLambda: {
        artifactPath: '/lambda/service.zip',
        size: 1000,
        handler: 'index.handler'
      },
      batchJobTriggerLambda: {
        artifactPath: '/lambda/batch.zip',
        size: 500,
        handler: 'index.handler'
      },
      cdnOriginRequestLambda: {
        artifactPath: '/lambda/cdn-request.zip',
        size: 300,
        handler: 'index.handler'
      },
      cdnOriginResponseLambda: {
        artifactPath: '/lambda/cdn-response.zip',
        size: 300,
        handler: 'index.handler'
      }
    },
    workingDir: '/project'
  }
}));

mock.module('@application-services/stacktape-trpc-api-manager', () => ({
  stacktapeTrpcApiManager: {
    apiClient: {
      globalConfig: mock(async () => ({
        alarms: [
          {
            name: 'global-alarm-1',
            type: 'metric',
            targetProjects: ['test-project'],
            targetStages: ['production']
          }
        ],
        deploymentNotifications: [
          {
            type: 'slack',
            webhookUrl: 'https://hooks.slack.com/test'
          }
        ],
        guardrails: [
          {
            type: 'cost-limit',
            limit: 1000
          }
        ]
      }))
    }
  }
}));

mock.module('@errors', () => ({
  stpErrors: {
    e16: mock(() => new Error('Config file not found'))
  }
}));

mock.module('@utils/file-loaders', () => ({
  getConfigPath: mock(() => '/project/stacktape.config.ts')
}));

mock.module('./config-resolver', () => ({
  ConfigResolver: mock(function (this: any) {
    this.rawConfig = null;
    this.resolvedConfig = null;
    this.results = {};
    this.resultsWithPath = {};

    this.registerBuiltInDirectives = mock(() => {});
    this.loadConfig = mock(async () => {
      this.rawConfig = {
        resources: {
          myFunction: {
            type: 'function',
            properties: {
              packaging: { type: 'stacktape-lambda-buildpack' },
              handler: 'index.handler'
            }
          },
          myBucket: {
            type: 'bucket',
            properties: {}
          }
        }
      };
      this.resolvedConfig = this.rawConfig;
    });
    this.loadRawConfig = mock(async () => {
      this.rawConfig = {
        resources: {
          myFunction: {
            type: 'function',
            properties: {}
          }
        }
      };
    });
    this.reset = mock(() => {
      this.rawConfig = null;
      this.resolvedConfig = null;
      this.results = {};
      this.resultsWithPath = {};
    });
    this.resolveDirectives = mock(async ({ itemToResolve }) => itemToResolve);
  })
}));

mock.module('./utils/validation', () => ({
  runInitialValidations: mock(() => {}),
  validateConfigStructure: mock(async () => {})
}));

mock.module('./utils/misc', () => ({
  cleanConfigForMinimalTemplateCompilerMode: mock((config) => config),
  mergeStacktapeDefaults: mock((resource) => resource)
}));

mock.module('./utils/alarms', () => ({
  isGlobalAlarmEligibleForStack: mock(() => true),
  getAlarmsToBeAppliedToResource: mock(() => [])
}));

mock.module('./built-in-directives', () => ({
  builtInDirectives: [
    { name: 'Secret', isRuntime: true },
    { name: 'EnvVar', isRuntime: true },
    { name: 'Param', isRuntime: false }
  ]
}));

mock.module('@shared/utils/misc', () => ({
  processAllNodesSync: mock((obj, fn) => fn(obj)),
  traverseToMaximalExtent: mock((obj, path) => ({
    resultValue: { name: 'myFunction', type: 'function' },
    validPath: 'myFunction',
    restPath: null
  }))
}));

mock.module('@shared/naming/utils', () => ({
  getStpNameForResource: mock(({ nameChain }) => nameChain.join('.')),
  getJobName: mock((name) => `job-${name}`),
  getSimpleServiceDefaultContainerName: mock((name) => `container-${name}`)
}));

mock.module('@shared/naming/aws-resource-names', () => ({
  awsResourceNames: {
    lambda: mock((name) => `stp-lambda-${name}`),
    bucket: mock((name) => `stp-bucket-${name}`),
    edgeLambda: mock((name) => `stp-edge-${name}`)
  }
}));

mock.module('@shared/naming/logical-names', () => ({
  cfLogicalNames: {
    lambda: mock((name) => `Lambda${name}`),
    lambdaStpAlias: mock((name) => `LambdaAlias${name}`),
    edgeLambdaVersion: mock((name) => `EdgeLambdaVersion${name}`)
  }
}));

mock.module('@shared/naming/helper-lambdas-resource-names', () => ({
  helperLambdaAwsResourceNames: {
    stacktapeServiceLambda: mock(() => 'stp-service-lambda'),
    cdnOriginRequestLambda: mock(() => 'stp-cdn-request-lambda'),
    cdnOriginResponseLambda: mock(() => 'stp-cdn-response-lambda')
  }
}));

mock.module('@shared/utils/hashing', () => ({
  getGloballyUniqueStackHash: mock(() => 'hash123')
}));

mock.module('@shared/aws/buckets', () => ({
  isTransferAccelerationEnabledInRegion: mock(() => true)
}));

mock.module('./utils/lambdas', () => ({
  getLambdaHandler: mock(({ name }) => `${name}.handler`),
  getBatchJobTriggerLambdaEnvironment: mock(() => ({})),
  getBatchJobTriggerLambdaAccessControl: mock(() => []),
  getStacktapeServiceLambdaEnvironment: mock(() => ({})),
  getStacktapeServiceLambdaAlarmNotificationInducedStatements: mock(() => []),
  getStacktapeServiceLambdaCustomResourceInducedStatements: mock(() => []),
  getStacktapeServiceLambdaCustomTaggingInducedStatement: mock(() => []),
  getStacktapeServiceLambdaEcsRedeployInducedStatements: mock(() => [])
}));

describe('config-manager', () => {
  describe('ConfigManager', () => {
    test('should initialize with default values', async () => {
      const { ConfigManager } = await import('./index');
      const manager = new ConfigManager();

      expect(manager.config).toBeUndefined();
      expect(manager.rawConfig).toBeUndefined();
      expect(manager.globalConfigGuardrails).toEqual([]);
      expect(manager.globalConfigDeploymentNotifications).toEqual([]);
      expect(manager.globalConfigAlarms).toEqual([]);
    });

    test('should initialize and load config when required', async () => {
      const { ConfigManager } = await import('./index');
      const { eventManager } = await import('@application-services/event-manager');
      const manager = new ConfigManager();

      await manager.init({ configRequired: true });

      expect(eventManager.startEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'LOAD_CONFIG_FILE' })
      );
      expect(eventManager.finishEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'LOAD_CONFIG_FILE' })
      );
      expect(manager.config).toBeDefined();
      expect(manager.rawConfig).toBeDefined();
    });

    test('should skip config loading when not required and no config path', async () => {
      const { ConfigManager } = await import('./index');
      const { getConfigPath } = await import('@utils/file-loaders');
      const manager = new ConfigManager();

      getConfigPath.mockReturnValueOnce(null);

      await manager.init({ configRequired: false });

      expect(manager.config).toBeUndefined();
    });

    test('should throw error when config required but not found', async () => {
      const { ConfigManager } = await import('./index');
      const { getConfigPath } = await import('@utils/file-loaders');
      const { stpErrors } = await import('@errors');
      const manager = new ConfigManager();

      getConfigPath.mockReturnValueOnce(null);

      await expect(manager.init({ configRequired: true })).rejects.toThrow();
      expect(stpErrors.e16).toHaveBeenCalled();
    });

    test('should load config from preset when available', async () => {
      const { ConfigManager } = await import('./index');
      const { globalStateManager } = await import('@application-services/global-state-manager');
      const manager = new ConfigManager();

      const presetConfig = {
        resources: {
          presetFunction: {
            type: 'function',
            properties: {}
          }
        }
      };
      globalStateManager.presetConfig = presetConfig as any;

      await manager.init({ configRequired: true });

      expect(manager.config).toBeDefined();

      // Cleanup
      globalStateManager.presetConfig = null;
    });

    test('should clean config for server invocation', async () => {
      const { ConfigManager } = await import('./index');
      const { globalStateManager } = await import('@application-services/global-state-manager');
      const { cleanConfigForMinimalTemplateCompilerMode } = await import('./utils/misc');
      const manager = new ConfigManager();

      globalStateManager.invokedFrom = 'server';

      await manager.init({ configRequired: true });

      expect(cleanConfigForMinimalTemplateCompilerMode).toHaveBeenCalled();

      // Cleanup
      globalStateManager.invokedFrom = 'cli';
    });

    test('should validate config structure after loading', async () => {
      const { ConfigManager } = await import('./index');
      const { validateConfigStructure } = await import('./utils/validation');
      const manager = new ConfigManager();

      await manager.init({ configRequired: true });

      expect(validateConfigStructure).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.any(Object),
          configPath: expect.any(String)
        })
      );
    });

    test('should run initial validations for non-server invocation', async () => {
      const { ConfigManager } = await import('./index');
      const { runInitialValidations } = await import('./utils/validation');
      const manager = new ConfigManager();

      await manager.init({ configRequired: true });

      expect(runInitialValidations).toHaveBeenCalled();
    });

    test('should skip initial validations for server invocation', async () => {
      const { ConfigManager } = await import('./index');
      const { globalStateManager } = await import('@application-services/global-state-manager');
      const { runInitialValidations } = await import('./utils/validation');
      const manager = new ConfigManager();

      globalStateManager.invokedFrom = 'server';
      const callCount = (runInitialValidations as any).mock.calls.length;

      await manager.init({ configRequired: true });

      // Should not add new calls
      expect((runInitialValidations as any).mock.calls.length).toBe(callCount);

      // Cleanup
      globalStateManager.invokedFrom = 'cli';
    });

    describe('reset', () => {
      test('should reset all state', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });
        manager.globalConfigGuardrails = [{ type: 'cost-limit' } as any];
        manager.globalConfigAlarms = [{ name: 'test-alarm' } as any];

        manager.reset();

        expect(manager.config).toBeNull();
        expect(manager.rawConfig).toBeNull();
        expect(manager.globalConfigGuardrails).toEqual([]);
        expect(manager.globalConfigDeploymentNotifications).toEqual([]);
        expect(manager.globalConfigAlarms).toEqual([]);
      });
    });

    describe('temporaryPreloadConfigForServiceNameDeprecationValidation', () => {
      test('should load raw config only', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.temporaryPreloadConfigForServiceNameDeprecationValidation({
          configRequired: true
        });

        expect(manager.configResolver.loadRawConfig).toHaveBeenCalled();
      });

      test('should handle missing config when not required', async () => {
        const { ConfigManager } = await import('./index');
        const { getConfigPath } = await import('@utils/file-loaders');
        const manager = new ConfigManager();

        getConfigPath.mockReturnValueOnce(null);

        await manager.temporaryPreloadConfigForServiceNameDeprecationValidation({
          configRequired: false
        });

        // Should not throw
        expect(manager.configResolver.rawConfig).toBeNull();
      });
    });

    describe('loadGlobalConfig', () => {
      test('should load global config from API', async () => {
        const { ConfigManager } = await import('./index');
        const { stacktapeTrpcApiManager } = await import('@application-services/stacktape-trpc-api-manager');
        const manager = new ConfigManager();

        await manager.loadGlobalConfig();

        expect(stacktapeTrpcApiManager.apiClient.globalConfig).toHaveBeenCalled();
        expect(manager.globalConfigAlarms).toHaveLength(1);
        expect(manager.globalConfigDeploymentNotifications).toHaveLength(1);
        expect(manager.globalConfigGuardrails).toHaveLength(1);
      });

      test('should filter alarms by eligibility', async () => {
        const { ConfigManager } = await import('./index');
        const { isGlobalAlarmEligibleForStack } = await import('./utils/alarms');
        const manager = new ConfigManager();

        await manager.loadGlobalConfig();

        expect(isGlobalAlarmEligibleForStack).toHaveBeenCalledWith(
          expect.objectContaining({
            alarm: expect.any(Object),
            projectName: 'test-project',
            stage: 'production'
          })
        );
      });

      test('should handle empty global config', async () => {
        const { ConfigManager } = await import('./index');
        const { stacktapeTrpcApiManager } = await import('@application-services/stacktape-trpc-api-manager');
        const manager = new ConfigManager();

        stacktapeTrpcApiManager.apiClient.globalConfig.mockResolvedValueOnce({
          alarms: null,
          deploymentNotifications: null,
          guardrails: null
        });

        await manager.loadGlobalConfig();

        expect(manager.globalConfigAlarms).toEqual([]);
        expect(manager.globalConfigDeploymentNotifications).toEqual([]);
        expect(manager.globalConfigGuardrails).toEqual([]);
      });
    });

    describe('resolveDirectives', () => {
      test('should resolve directives twice for nested resolution', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });

        const result = await manager.resolveDirectives({
          itemToResolve: { key: 'value' },
          resolveRuntime: true
        });

        expect(manager.configResolver.resolveDirectives).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ key: 'value' });
      });

      test('should pass useLocalResolve option', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });

        await manager.resolveDirectives({
          itemToResolve: { key: 'value' },
          resolveRuntime: false,
          useLocalResolve: true
        });

        expect(manager.configResolver.resolveDirectives).toHaveBeenCalledWith(
          expect.objectContaining({ useLocalResolve: true })
        );
      });
    });

    describe('invalidatePotentiallyChangedDirectiveResults', () => {
      test('should invalidate runtime directive results', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });

        manager.configResolver.results = {
          '$Secret(apiKey)': 'secret-value',
          '$EnvVar(NODE_ENV)': 'production',
          '$Param(someParam)': 'param-value'
        };
        manager.configResolver.resultsWithPath = {
          'path1': 'value1'
        };

        manager.invalidatePotentiallyChangedDirectiveResults();

        // Runtime directives should be deleted
        expect(manager.configResolver.results['$Secret(apiKey)']).toBeUndefined();
        expect(manager.configResolver.results['$EnvVar(NODE_ENV)']).toBeUndefined();
        // Non-runtime directive should remain
        expect(manager.configResolver.results['$Param(someParam)']).toBe('param-value');
        // resultsWithPath should be cleared
        expect(manager.configResolver.resultsWithPath).toEqual({});
      });
    });

    describe('findResourceInConfig', () => {
      test('should find resource by name chain string', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });

        const result = manager.findResourceInConfig({ nameChain: 'myFunction' });

        expect(result.resource).toBeDefined();
        expect(result.fullyResolved).toBe(true);
      });

      test('should find resource by name chain array', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });

        const result = manager.findResourceInConfig({ nameChain: ['myFunction'] });

        expect(result.resource).toBeDefined();
        expect(result.validPath).toBeDefined();
      });

      test('should handle nested resource paths', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });

        const result = manager.findResourceInConfig({ nameChain: 'myFunction.nested' });

        expect(result.resource).toBeDefined();
      });
    });

    describe('findImmediateParent', () => {
      test('should find parent resource', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });

        const result = manager.findImmediateParent({ nameChain: ['myFunction', 'nested'] });

        expect(result).toBeDefined();
      });

      test('should handle string name chain', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });

        const result = manager.findImmediateParent({ nameChain: 'myFunction.nested' });

        expect(result).toBeDefined();
      });
    });

    describe('resource getters', () => {
      test('should get functions from config', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });

        const functions = manager.functions;

        expect(Array.isArray(functions)).toBe(true);
        expect(functions.length).toBeGreaterThan(0);
        expect(functions[0].type).toBe('function');
        expect(functions[0].name).toBeDefined();
        expect(functions[0].artifactName).toBeDefined();
      });

      test('should get buckets from config', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });

        const buckets = manager.buckets;

        expect(Array.isArray(buckets)).toBe(true);
      });

      test('should get batch jobs with trigger functions', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        manager.configResolver.resolvedConfig = {
          resources: {
            myBatchJob: {
              type: 'batch-job',
              properties: {
                events: []
              }
            }
          }
        };
        manager.config = manager.configResolver.resolvedConfig as any;

        const batchJobs = manager.batchJobs;

        expect(Array.isArray(batchJobs)).toBe(true);
        if (batchJobs.length > 0) {
          expect(batchJobs[0]._nestedResources).toBeDefined();
          expect(batchJobs[0]._nestedResources.triggerFunction).toBeDefined();
        }
      });

      test('should get hosting buckets with nested bucket resource', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        manager.configResolver.resolvedConfig = {
          resources: {
            myHostingBucket: {
              type: 'hosting-bucket',
              properties: {
                uploadDirectoryPath: './dist',
                hostingContentType: 'static-website'
              }
            }
          }
        };
        manager.config = manager.configResolver.resolvedConfig as any;

        const hostingBuckets = manager.hostingBuckets;

        expect(Array.isArray(hostingBuckets)).toBe(true);
        if (hostingBuckets.length > 0) {
          expect(hostingBuckets[0]._nestedResources).toBeDefined();
          expect(hostingBuckets[0]._nestedResources.bucket).toBeDefined();
          expect(hostingBuckets[0]._nestedResources.bucket.type).toBe('bucket');
        }
      });
    });

    describe('provider config', () => {
      test('should get mongoDbAtlasProvider config', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        manager.config = {
          providerConfig: {
            mongoDbAtlas: {
              privateKey: 'test-key',
              publicKey: 'test-public-key'
            }
          }
        } as any;

        expect(manager.mongoDbAtlasProvider).toBeDefined();
        expect(manager.mongoDbAtlasProvider.privateKey).toBe('test-key');
      });

      test('should detect when atlas credentials parameter is required', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        manager.config = {
          providerConfig: {
            mongoDbAtlas: {
              publicKey: 'test-public-key'
              // no privateKey
            }
          },
          resources: {
            myCluster: {
              type: 'mongo-db-atlas-cluster',
              properties: {}
            }
          }
        } as any;

        expect(manager.requireAtlasCredentialsParameter).toBe(true);
      });

      test('should get upstashProvider config', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        manager.config = {
          providerConfig: {
            upstash: {
              apiKey: 'test-api-key',
              email: 'test@example.com'
            }
          }
        } as any;

        expect(manager.upstashProvider).toBeDefined();
        expect(manager.upstashProvider.apiKey).toBe('test-api-key');
      });

      test('should detect when upstash credentials parameter is required', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        manager.config = {
          providerConfig: {
            upstash: {
              email: 'test@example.com'
              // no apiKey
            }
          },
          resources: {
            myRedis: {
              type: 'upstash-redis',
              properties: {}
            }
          }
        } as any;

        expect(manager.requireUpstashCredentialsParameter).toBe(true);
      });
    });

    describe('deployment config', () => {
      test('should get deployment config with S3 transfer acceleration', async () => {
        const { ConfigManager } = await import('./index');
        const { isTransferAccelerationEnabledInRegion } = await import('@shared/aws/buckets');
        const manager = new ConfigManager();

        manager.config = {
          deploymentConfig: {
            artifactsPurgeAfterDays: 30
          }
        } as any;

        const deploymentConfig = manager.deploymentConfig;

        expect(deploymentConfig).toBeDefined();
        expect(deploymentConfig.disableS3TransferAcceleration).toBe(false);
        expect(isTransferAccelerationEnabledInRegion).toHaveBeenCalled();
      });

      test('should get budget config', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        manager.config = {
          budgetControl: {
            monthlyLimit: 100,
            emailAddresses: ['admin@example.com']
          }
        } as any;

        expect(manager.budgetConfig).toBeDefined();
        expect(manager.budgetConfig.monthlyLimit).toBe(100);
      });
    });

    describe('complex resource getters', () => {
      test('should get custom resource definitions with backing function', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        manager.configResolver.resolvedConfig = {
          resources: {
            myCustomResource: {
              type: 'custom-resource-definition',
              properties: {
                packaging: { type: 'stacktape-lambda-buildpack' },
                handler: 'index.handler'
              }
            }
          }
        };
        manager.config = manager.configResolver.resolvedConfig as any;

        const customResourceDefinitions = manager.customResourceDefinitions;

        expect(Array.isArray(customResourceDefinitions)).toBe(true);
        if (customResourceDefinitions.length > 0) {
          expect(customResourceDefinitions[0]._nestedResources).toBeDefined();
          expect(customResourceDefinitions[0]._nestedResources.backingFunction).toBeDefined();
          expect(customResourceDefinitions[0]._nestedResources.backingFunction.type).toBe('function');
        }
      });

      test('should get deployment scripts with script function', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        manager.configResolver.resolvedConfig = {
          resources: {
            myScript: {
              type: 'deployment-script',
              properties: {
                packaging: { type: 'stacktape-lambda-buildpack' },
                handler: 'index.handler',
                executeOn: 'POST_DEPLOY'
              }
            }
          }
        };
        manager.config = manager.configResolver.resolvedConfig as any;

        const deploymentScripts = manager.deploymentScripts;

        expect(Array.isArray(deploymentScripts)).toBe(true);
        if (deploymentScripts.length > 0) {
          expect(deploymentScripts[0]._nestedResources).toBeDefined();
          expect(deploymentScripts[0]._nestedResources.scriptFunction).toBeDefined();
          expect(deploymentScripts[0]._nestedResources.scriptFunction.type).toBe('function');
        }
      });
    });

    describe('allConfigResources', () => {
      test('should get all resources from config', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });

        const allResources = manager.allConfigResources;

        expect(Array.isArray(allResources)).toBe(true);
        expect(allResources.length).toBeGreaterThan(0);
      });
    });

    describe('edge cases', () => {
      test('should handle config with no resources', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        manager.configResolver.resolvedConfig = {
          resources: {}
        };
        manager.config = manager.configResolver.resolvedConfig as any;

        expect(manager.functions).toEqual([]);
        expect(manager.buckets).toEqual([]);
      });

      test('should handle undefined config gracefully', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        expect(() => {
          const _ = manager.mongoDbAtlasProvider;
        }).not.toThrow();
      });

      test('should register built-in directives during init', async () => {
        const { ConfigManager } = await import('./index');
        const manager = new ConfigManager();

        await manager.init({ configRequired: true });

        expect(manager.configResolver.registerBuiltInDirectives).toHaveBeenCalled();
      });
    });
  });
});
