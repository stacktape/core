import { describe, expect, mock, test } from 'bun:test';

// Mock all complex dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    workingDir: '/test/project'
  }
}));

mock.module('@config', () => ({
  lambdaRuntimesForFileExtension: {
    js: ['nodejs16.x', 'nodejs18.x', 'nodejs20.x'],
    ts: ['nodejs16.x', 'nodejs18.x', 'nodejs20.x'],
    py: ['python3.9', 'python3.10', 'python3.11']
  },
  linksMap: {},
  supportedAwsCdkConstructExtensions: ['ts', 'js'],
  supportedWorkloadExtensions: ['js', 'ts', 'py', 'go', 'java']
}));

mock.module('@errors', () => ({
  stpErrors: {
    e42: mock(() => new Error('Validation error'))
  }
}));

mock.module('@schemas/validate-config-schema', () => ({
  default: mock(() => true)
}));

mock.module('@shared/utils/fs-utils', () => ({
  isDirAccessible: mock(() => true),
  isFileAccessible: mock(() => true)
}));

mock.module('@shared/utils/misc', () => ({
  capitalizeFirstLetter: mock((str) => str.charAt(0).toUpperCase() + str.slice(1)),
  getUniqueDuplicates: mock((arr) => []),
  isAlphanumeric: mock((str) => /^[a-zA-Z0-9]+$/.test(str)),
  processAllNodesSync: mock(() => {}),
  replaceAll: mock((str, search, replace) => str.split(search).join(replace)),
  splitStringIntoLines: mock((str) => str.split('\n'))
}));

mock.module('@utils/directives', () => ({
  getIsDirective: mock((val) => typeof val === 'string' && val.startsWith('$'))
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
  },
  UnexpectedError: class UnexpectedError extends Error {
    constructor({ customMessage }: { customMessage: string }) {
      super(customMessage);
      this.name = 'UnexpectedError';
    }
  }
}));

mock.module('@utils/printer', () => ({
  printer: {
    makeBold: mock((text) => text),
    colorize: mock((color, text) => text),
    prettyFilePath: mock((path) => path),
    prettyOption: mock((opt) => opt),
    prettyConfigProperty: mock((prop) => prop)
  }
}));

mock.module('@utils/user-code-processing', () => ({
  parseUserCodeFilepath: mock(({ fullPath }) => ({
    filePath: fullPath,
    handler: 'handler',
    extension: fullPath.split('.').pop(),
    hasExplicitHandler: false
  }))
}));

mock.module('../index', () => ({
  configManager: {
    allLambdasToUpload: [],
    allContainerWorkloads: [],
    batchJobs: [],
    httpApiGateways: []
  }
}));

// Mock validation modules
mock.module('./application-load-balancers', () => ({
  validateApplicationLoadBalancerConfig: mock(() => {})
}));

mock.module('./bastion', () => ({
  resolveReferenceToBastion: mock(() => ({}))
}));

mock.module('./buckets', () => ({
  validateBucketConfig: mock(() => {})
}));

mock.module('./http-api-gateways', () => ({
  validateHttpApiGatewayConfig: mock(() => {})
}));

mock.module('./lambdas', () => ({
  validateLambdaConfig: mock(() => {})
}));

mock.module('./multi-container-workloads', () => ({
  validateMultiContainerWorkloadConfig: mock(() => {})
}));

mock.module('./network-load-balancers', () => ({
  validateNetworkLoadBalancerConfig: mock(() => {})
}));

mock.module('./nextjs-webs', () => ({
  validateNextjsWebConfig: mock(() => {})
}));

mock.module('./relational-databases', () => ({
  validateRelationalDatabaseConfig: mock(() => {})
}));

mock.module('./sns-topics', () => ({
  validateSnsTopicConfig: mock(() => {})
}));

mock.module('./sqs-queues', () => ({
  validateSqsQueueConfig: mock(() => {})
}));

mock.module('./web-services', () => ({
  validateWebServiceConfig: mock(() => {})
}));

mock.module('lodash/get', () => ({
  default: mock((obj, path) => path.split('.').reduce((curr, prop) => curr?.[prop], obj))
}));

mock.module('lodash/isEqual', () => ({
  default: mock((a, b) => JSON.stringify(a) === JSON.stringify(b))
}));

mock.module('lodash/uniqWith', () => ({
  default: mock((arr, comparator) => arr.filter((item, index, self) =>
    self.findIndex((other) => comparator(item, other)) === index
  ))
}));

mock.module('../../../../@generated/schemas/config-schema.json', () => ({
  default: {}
}));

describe('config-manager/utils/validation', () => {
  describe('validatePackagingProps', () => {
    test('should validate stacktape-image-buildpack', async () => {
      const { validatePackagingProps } = await import('./validation');
      const packaging: any = {
        type: 'stacktape-image-buildpack',
        properties: {
          entryfilePath: 'src/index.ts'
        }
      };
      expect(() =>
        validatePackagingProps({
          packaging,
          workloadName: 'myFunction',
          workloadType: 'function'
        })
      ).not.toThrow();
    });

    test('should validate stacktape-lambda-buildpack', async () => {
      const { validatePackagingProps } = await import('./validation');
      const packaging: any = {
        type: 'stacktape-lambda-buildpack',
        properties: {
          entryfilePath: 'handler.py'
        }
      };
      expect(() =>
        validatePackagingProps({
          packaging,
          workloadName: 'myLambda',
          lambdaRuntime: 'python3.9',
          workloadType: 'function'
        })
      ).not.toThrow();
    });

    test('should throw for unsupported file extension', async () => {
      mock.module('@utils/user-code-processing', () => ({
        parseUserCodeFilepath: mock(() => ({
          filePath: 'index.unsupported',
          handler: 'handler',
          extension: 'unsupported',
          hasExplicitHandler: false
        }))
      }));

      const { validatePackagingProps } = await import('./validation');
      const packaging: any = {
        type: 'stacktape-lambda-buildpack',
        properties: {
          entryfilePath: 'index.unsupported'
        }
      };
      expect(() =>
        validatePackagingProps({
          packaging,
          workloadName: 'myFunction',
          workloadType: 'function'
        })
      ).toThrow();
    });

    test('should include workload name in error messages', async () => {
      mock.module('@utils/user-code-processing', () => ({
        parseUserCodeFilepath: mock(() => ({
          filePath: 'index.bad',
          handler: 'handler',
          extension: 'bad',
          hasExplicitHandler: false
        }))
      }));

      const { validatePackagingProps } = await import('./validation');
      const packaging: any = {
        type: 'stacktape-lambda-buildpack',
        properties: {
          entryfilePath: 'index.bad'
        }
      };
      try {
        validatePackagingProps({
          packaging,
          workloadName: 'testFunction',
          workloadType: 'function'
        });
      } catch (error) {
        expect(error.message).toContain('testFunction');
      }
    });

    test('should handle container name for multi-container workloads', async () => {
      const { validatePackagingProps } = await import('./validation');
      const packaging: any = {
        type: 'stacktape-image-buildpack',
        properties: {
          entryfilePath: 'app/index.js'
        }
      };
      expect(() =>
        validatePackagingProps({
          packaging,
          workloadName: 'myWorkload',
          containerName: 'app',
          workloadType: 'multi-container-workload'
        })
      ).not.toThrow();
    });
  });

  // Note: Most other functions in validation.ts are tightly coupled with the config manager
  // and would require extensive mocking of the entire config structure. These tests focus
  // on the more isolated validatePackagingProps function as a representative sample.
  // Full integration tests would be better suited for the complete validation logic.
});
