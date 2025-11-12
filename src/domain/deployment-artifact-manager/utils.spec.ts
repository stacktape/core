import { describe, expect, mock, test } from 'bun:test';

// Mock the config module
mock.module('@config', () => ({
  CF_TEMPLATE_FILE_NAME_WITHOUT_EXT: 'cf-template',
  STP_TEMPLATE_FILE_NAME_WITHOUT_EXT: 'stp-template',
  HELPER_LAMBDAS: ['stacktapeServiceLambda', 'cdnOriginRequestLambda', 'cdnOriginResponseLambda', 'batchJobTriggerLambda']
}));

describe('deployment-artifact-manager/utils', () => {
  describe('getDeploymentBucketObjectType', () => {
    test('should return cf-template for CloudFormation template name', async () => {
      const { getDeploymentBucketObjectType } = await import('./utils');

      const result = getDeploymentBucketObjectType('cf-template');

      expect(result).toBe('cf-template');
    });

    test('should return stp-template for Stacktape template name', async () => {
      const { getDeploymentBucketObjectType } = await import('./utils');

      const result = getDeploymentBucketObjectType('stp-template');

      expect(result).toBe('stp-template');
    });

    test('should return helper-lambda for stacktapeServiceLambda', async () => {
      const { getDeploymentBucketObjectType } = await import('./utils');

      const result = getDeploymentBucketObjectType('stacktapeServiceLambda');

      expect(result).toBe('helper-lambda');
    });

    test('should return helper-lambda for cdnOriginRequestLambda', async () => {
      const { getDeploymentBucketObjectType } = await import('./utils');

      const result = getDeploymentBucketObjectType('cdnOriginRequestLambda');

      expect(result).toBe('helper-lambda');
    });

    test('should return helper-lambda for cdnOriginResponseLambda', async () => {
      const { getDeploymentBucketObjectType } = await import('./utils');

      const result = getDeploymentBucketObjectType('cdnOriginResponseLambda');

      expect(result).toBe('helper-lambda');
    });

    test('should return helper-lambda for batchJobTriggerLambda', async () => {
      const { getDeploymentBucketObjectType } = await import('./utils');

      const result = getDeploymentBucketObjectType('batchJobTriggerLambda');

      expect(result).toBe('helper-lambda');
    });

    test('should return user-lambda for custom lambda name', async () => {
      const { getDeploymentBucketObjectType } = await import('./utils');

      const result = getDeploymentBucketObjectType('myCustomLambda');

      expect(result).toBe('user-lambda');
    });

    test('should return user-lambda for any non-special name', async () => {
      const { getDeploymentBucketObjectType } = await import('./utils');

      const result = getDeploymentBucketObjectType('processPayment');

      expect(result).toBe('user-lambda');
    });

    test('should handle empty string as user-lambda', async () => {
      const { getDeploymentBucketObjectType } = await import('./utils');

      const result = getDeploymentBucketObjectType('');

      expect(result).toBe('user-lambda');
    });

    test('should prioritize template names over helper lambdas', async () => {
      const { getDeploymentBucketObjectType } = await import('./utils');

      // Template names should be checked first
      expect(getDeploymentBucketObjectType('cf-template')).toBe('cf-template');
      expect(getDeploymentBucketObjectType('stp-template')).toBe('stp-template');
    });

    test('should handle names with similar prefixes', async () => {
      const { getDeploymentBucketObjectType } = await import('./utils');

      // Names that start with template names but aren't exact matches
      expect(getDeploymentBucketObjectType('cf-template-custom')).toBe('user-lambda');
      expect(getDeploymentBucketObjectType('stp-template-v2')).toBe('user-lambda');
    });
  });

  describe('parseBucketObjectS3Key', () => {
    test('should parse S3 key with digest format', async () => {
      const { parseBucketObjectS3Key } = await import('./utils');

      const result = parseBucketObjectS3Key('myLambda/1.0.0-abc123.zip');

      expect(result.name).toBe('myLambda');
      expect(result.version).toBe('1.0.0');
      expect(result.digest).toBe('abc123');
      expect(result.extension).toBe('zip');
    });

    test('should parse S3 key without digest format', async () => {
      const { parseBucketObjectS3Key } = await import('./utils');

      const result = parseBucketObjectS3Key('myLambda/1.0.0.zip');

      expect(result.name).toBe('myLambda');
      expect(result.version).toBe('1.0.0');
      expect(result.digest).toBeNull();
      expect(result.extension).toBe('zip');
    });

    test('should parse S3 key with version containing dots', async () => {
      const { parseBucketObjectS3Key } = await import('./utils');

      const result = parseBucketObjectS3Key('function/2.1.0-hash456.js');

      expect(result.name).toBe('function');
      expect(result.version).toBe('2.1.0');
      expect(result.digest).toBe('hash456');
      expect(result.extension).toBe('js');
    });

    test('should parse S3 key with simple version', async () => {
      const { parseBucketObjectS3Key } = await import('./utils');

      const result = parseBucketObjectS3Key('processor/v1.json');

      expect(result.name).toBe('processor');
      expect(result.version).toBe('v1');
      expect(result.digest).toBeNull();
      expect(result.extension).toBe('json');
    });

    test('should parse S3 key with hash digest', async () => {
      const { parseBucketObjectS3Key } = await import('./utils');

      const result = parseBucketObjectS3Key('api/1.0.0-sha256hash.tar.gz');

      expect(result.name).toBe('api');
      expect(result.version).toBe('1.0.0');
      expect(result.digest).toBe('sha256hash');
      expect(result.extension).toBe('tar.gz');
    });

    test('should handle numeric versions', async () => {
      const { parseBucketObjectS3Key } = await import('./utils');

      const result = parseBucketObjectS3Key('service/123.zip');

      expect(result.name).toBe('service');
      expect(result.version).toBe('123');
      expect(result.digest).toBeNull();
      expect(result.extension).toBe('zip');
    });

    test('should handle long digest hashes', async () => {
      const { parseBucketObjectS3Key } = await import('./utils');

      const result = parseBucketObjectS3Key('worker/2.0.0-abcdef1234567890.zip');

      expect(result.name).toBe('worker');
      expect(result.version).toBe('2.0.0');
      expect(result.digest).toBe('abcdef1234567890');
      expect(result.extension).toBe('zip');
    });

    test('should parse key with template name', async () => {
      const { parseBucketObjectS3Key } = await import('./utils');

      const result = parseBucketObjectS3Key('cf-template/1.0.0.json');

      expect(result.name).toBe('cf-template');
      expect(result.version).toBe('1.0.0');
      expect(result.digest).toBeNull();
      expect(result.extension).toBe('json');
    });

    test('should parse key with helper lambda name', async () => {
      const { parseBucketObjectS3Key } = await import('./utils');

      const result = parseBucketObjectS3Key('stacktapeServiceLambda/1.5.0-hash.zip');

      expect(result.name).toBe('stacktapeServiceLambda');
      expect(result.version).toBe('1.5.0');
      expect(result.digest).toBe('hash');
      expect(result.extension).toBe('zip');
    });

    test('should handle version with multiple dashes when digest present', async () => {
      const { parseBucketObjectS3Key } = await import('./utils');

      const result = parseBucketObjectS3Key('lambda/1-2-3-digest123.zip');

      expect(result.name).toBe('lambda');
      expect(result.version).toBe('1');
      expect(result.digest).toBe('2');
      expect(result.extension).toBe('3-digest123.zip');
    });

    test('should handle different file extensions', async () => {
      const { parseBucketObjectS3Key } = await import('./utils');

      const result1 = parseBucketObjectS3Key('fn/1.0.0.tar');
      const result2 = parseBucketObjectS3Key('fn/1.0.0.gz');
      const result3 = parseBucketObjectS3Key('fn/1.0.0.js');

      expect(result1.extension).toBe('tar');
      expect(result2.extension).toBe('gz');
      expect(result3.extension).toBe('js');
    });
  });

  describe('parseImageTag', () => {
    test('should parse image tag with all components', async () => {
      const { parseImageTag } = await import('./utils');

      const result = parseImageTag('myJob--sha256abc123--1.0.0');

      expect(result.jobName).toBe('myJob');
      expect(result.digest).toBe('sha256abc123');
      expect(result.version).toBe('1.0.0');
    });

    test('should parse image tag with simple names', async () => {
      const { parseImageTag } = await import('./utils');

      const result = parseImageTag('processor--hash456--2.1.0');

      expect(result.jobName).toBe('processor');
      expect(result.digest).toBe('hash456');
      expect(result.version).toBe('2.1.0');
    });

    test('should parse image tag with numeric version', async () => {
      const { parseImageTag } = await import('./utils');

      const result = parseImageTag('worker--digest789--1');

      expect(result.jobName).toBe('worker');
      expect(result.digest).toBe('digest789');
      expect(result.version).toBe('1');
    });

    test('should parse image tag with long digest', async () => {
      const { parseImageTag } = await import('./utils');

      const result = parseImageTag('api--sha256abcdef1234567890--3.0.0');

      expect(result.jobName).toBe('api');
      expect(result.digest).toBe('sha256abcdef1234567890');
      expect(result.version).toBe('3.0.0');
    });

    test('should parse image tag with version containing dots', async () => {
      const { parseImageTag } = await import('./utils');

      const result = parseImageTag('service--hash--2.1.3');

      expect(result.jobName).toBe('service');
      expect(result.digest).toBe('hash');
      expect(result.version).toBe('2.1.3');
    });

    test('should handle job name with hyphens', async () => {
      const { parseImageTag } = await import('./utils');

      const result = parseImageTag('my-job-name--digest--1.0.0');

      expect(result.jobName).toBe('my-job-name');
      expect(result.digest).toBe('digest');
      expect(result.version).toBe('1.0.0');
    });

    test('should parse tag with short digest', async () => {
      const { parseImageTag } = await import('./utils');

      const result = parseImageTag('job--abc--1.0');

      expect(result.jobName).toBe('job');
      expect(result.digest).toBe('abc');
      expect(result.version).toBe('1.0');
    });

    test('should handle semantic versions', async () => {
      const { parseImageTag } = await import('./utils');

      const result1 = parseImageTag('app--hash--1.0.0');
      const result2 = parseImageTag('app--hash--2.1.3');
      const result3 = parseImageTag('app--hash--0.0.1');

      expect(result1.version).toBe('1.0.0');
      expect(result2.version).toBe('2.1.3');
      expect(result3.version).toBe('0.0.1');
    });

    test('should parse tag with hex digest', async () => {
      const { parseImageTag } = await import('./utils');

      const result = parseImageTag('container--0a1b2c3d--1.5.0');

      expect(result.jobName).toBe('container');
      expect(result.digest).toBe('0a1b2c3d');
      expect(result.version).toBe('1.5.0');
    });

    test('should handle version with pre-release tag', async () => {
      const { parseImageTag } = await import('./utils');

      const result = parseImageTag('beta--hash--1.0.0-beta.1');

      expect(result.jobName).toBe('beta');
      expect(result.digest).toBe('hash');
      expect(result.version).toBe('1.0.0-beta.1');
    });

    test('should handle single character components', async () => {
      const { parseImageTag } = await import('./utils');

      const result = parseImageTag('a--b--c');

      expect(result.jobName).toBe('a');
      expect(result.digest).toBe('b');
      expect(result.version).toBe('c');
    });

    test('should parse tag with uppercase characters', async () => {
      const { parseImageTag } = await import('./utils');

      const result = parseImageTag('MyJob--SHA256--1.0.0');

      expect(result.jobName).toBe('MyJob');
      expect(result.digest).toBe('SHA256');
      expect(result.version).toBe('1.0.0');
    });
  });
});
