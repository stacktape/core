import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('node:path', () => ({
  join: mock((...parts: string[]) => parts.join('/'))
}));

mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: {
    helperLambdasDir: mock(() => '/app/.stacktape/helper-lambdas')
  }
}));

mock.module('fs-extra', () => ({
  default: {
    readdir: mock(async () => [
      'stacktapeServiceLambda-abc123.zip',
      'cdnOriginRequestLambda-def456.zip',
      'cdnOriginResponseLambda-ghi789.zip',
      'batchJobTriggerLambda-jkl012.zip'
    ])
  }
}));

describe('helper-lambdas', () => {
  describe('loadHelperLambdaDetails', () => {
    test('should return dummy data when invoked from server', async () => {
      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const result = await loadHelperLambdaDetails({ invokedFrom: 'server' });

      expect(result.stacktapeServiceLambda).toEqual({
        digest: 'xxx',
        artifactPath: 'xxx',
        handler: 'index.default',
        size: 10
      });
      expect(result.batchJobTriggerLambda).toEqual({
        digest: 'xxx',
        artifactPath: 'xxx',
        handler: 'index.default',
        size: 10
      });
      expect(result.cdnOriginRequestLambda).toEqual({
        digest: 'xxx',
        artifactPath: 'xxx',
        handler: 'index.default',
        size: 10
      });
      expect(result.cdnOriginResponseLambda).toEqual({
        digest: 'xxx',
        artifactPath: 'xxx',
        handler: 'index.default',
        size: 10
      });
    });

    test('should load actual helper lambda details when not invoked from server', async () => {
      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const result = await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(result.stacktapeServiceLambda).toBeDefined();
      expect(result.cdnOriginRequestLambda).toBeDefined();
      expect(result.cdnOriginResponseLambda).toBeDefined();
      expect(result.batchJobTriggerLambda).toBeDefined();
    });

    test('should parse lambda names and digests correctly', async () => {
      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const result = await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(result.stacktapeServiceLambda.digest).toBe('abc123');
      expect(result.cdnOriginRequestLambda.digest).toBe('def456');
      expect(result.cdnOriginResponseLambda.digest).toBe('ghi789');
      expect(result.batchJobTriggerLambda.digest).toBe('jkl012');
    });

    test('should construct correct artifact paths', async () => {
      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const result = await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(result.stacktapeServiceLambda.artifactPath).toBe(
        '/app/.stacktape/helper-lambdas/stacktapeServiceLambda-abc123.zip'
      );
      expect(result.cdnOriginRequestLambda.artifactPath).toBe(
        '/app/.stacktape/helper-lambdas/cdnOriginRequestLambda-def456.zip'
      );
    });

    test('should set handler to index.default for all lambdas', async () => {
      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const result = await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(result.stacktapeServiceLambda.handler).toBe('index.default');
      expect(result.cdnOriginRequestLambda.handler).toBe('index.default');
      expect(result.cdnOriginResponseLambda.handler).toBe('index.default');
      expect(result.batchJobTriggerLambda.handler).toBe('index.default');
    });

    test('should read directory from fsPaths.helperLambdasDir', async () => {
      const fsExtra = await import('fs-extra');
      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(fsExtra.default.readdir).toHaveBeenCalledWith('/app/.stacktape/helper-lambdas');
    });

    test('should handle empty directory', async () => {
      mock.module('fs-extra', () => ({
        default: {
          readdir: mock(async () => [])
        }
      }));

      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const result = await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(typeof result).toBe('object');
      expect(Object.keys(result).length).toBe(0);
    });

    test('should handle additional lambda files', async () => {
      mock.module('fs-extra', () => ({
        default: {
          readdir: mock(async () => [
            'stacktapeServiceLambda-hash1.zip',
            'customLambda-hash2.zip',
            'anotherLambda-hash3.zip'
          ])
        }
      }));

      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const result = await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(result.stacktapeServiceLambda).toBeDefined();
      expect(result.customLambda).toBeDefined();
      expect(result.anotherLambda).toBeDefined();
    });

    test('should correctly parse lambda name with hyphens', async () => {
      mock.module('fs-extra', () => ({
        default: {
          readdir: mock(async () => ['my-custom-lambda-abc123.zip'])
        }
      }));

      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const result = await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(result['my']).toBeDefined();
      expect(result['my'].digest).toBe('custom');
    });

    test('should strip .zip extension from filenames', async () => {
      mock.module('fs-extra', () => ({
        default: {
          readdir: mock(async () => ['testLambda-digest123.zip'])
        }
      }));

      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const result = await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(result.testLambda.digest).toBe('digest123');
      expect(result.testLambda.artifactPath).toContain('.zip');
    });

    test('should handle long digest hashes', async () => {
      mock.module('fs-extra', () => ({
        default: {
          readdir: mock(async () => ['lambda-sha256abcdef1234567890.zip'])
        }
      }));

      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const result = await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(result.lambda.digest).toBe('sha256abcdef1234567890');
    });

    test('should return consistent dummy data structure', async () => {
      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const result1 = await loadHelperLambdaDetails({ invokedFrom: 'server' });
      const result2 = await loadHelperLambdaDetails({ invokedFrom: 'server' });

      expect(result1).toEqual(result2);
    });

    test('should include all required helper lambdas in dummy data', async () => {
      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const result = await loadHelperLambdaDetails({ invokedFrom: 'server' });

      expect(result).toHaveProperty('stacktapeServiceLambda');
      expect(result).toHaveProperty('batchJobTriggerLambda');
      expect(result).toHaveProperty('cdnOriginRequestLambda');
      expect(result).toHaveProperty('cdnOriginResponseLambda');
    });

    test('should set consistent handler for all lambdas', async () => {
      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const serverResult = await loadHelperLambdaDetails({ invokedFrom: 'server' });
      const cliResult = await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(serverResult.stacktapeServiceLambda.handler).toBe('index.default');
      expect(cliResult.stacktapeServiceLambda.handler).toBe('index.default');
    });

    test('should construct paths using fsPaths helper', async () => {
      const { fsPaths } = await import('@shared/naming/fs-paths');
      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(fsPaths.helperLambdasDir).toHaveBeenCalled();
    });

    test('should handle different invokedFrom values', async () => {
      const { loadHelperLambdaDetails } = await import('./helper-lambdas');

      const serverResult = await loadHelperLambdaDetails({ invokedFrom: 'server' });
      const cliResult = await loadHelperLambdaDetails({ invokedFrom: 'cli' });

      expect(serverResult.stacktapeServiceLambda.digest).toBe('xxx');
      expect(cliResult.stacktapeServiceLambda.digest).not.toBe('xxx');
    });
  });
});
