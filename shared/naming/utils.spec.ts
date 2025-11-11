import { describe, expect, test } from 'bun:test';
import {
  buildLambdaS3Key,
  getBaseS3EndpointForRegion,
  getCfTemplateS3Key,
  getEcrImageTag,
  getEcrImageUrl,
  getEcrRepositoryUrl,
  getJobNameForMultiContainerWorkload,
  getJobNameForSingleContainerWorkload,
  getLocalInvokeContainerName,
  getSimpleServiceDefaultContainerName,
  getStackCfTemplateDescription,
  getStackName,
  getStacktapeStackInfoFromTemplateDescription,
  getStpTemplateS3Key,
  getUserPoolDomainPrefix,
  isStacktapeStackDescription,
  portMappingsPortName
} from './utils';

describe('naming utils', () => {
  describe('getEcrImageTag', () => {
    test('should create ECR image tag from task name, version, and digest', () => {
      const tag = getEcrImageTag('my-task', 'v1.0.0', 'abc123');
      expect(tag).toBe('my-task--abc123--v1.0.0');
    });

    test('should handle different versions', () => {
      const tag = getEcrImageTag('task', 'v2.5.1', 'def456');
      expect(tag).toBe('task--def456--v2.5.1');
    });
  });

  describe('getJobNameForSingleContainerWorkload', () => {
    test('should append -default and lowercase', () => {
      expect(getJobNameForSingleContainerWorkload('MyWorkload')).toBe('myworkload-default');
    });

    test('should handle already lowercase names', () => {
      expect(getJobNameForSingleContainerWorkload('workload')).toBe('workload-default');
    });
  });

  describe('getJobNameForMultiContainerWorkload', () => {
    test('should combine workload and container names', () => {
      expect(getJobNameForMultiContainerWorkload('MyWorkload', 'web')).toBe('myworkload-web');
    });

    test('should lowercase the result', () => {
      expect(getJobNameForMultiContainerWorkload('WorkLoad', 'Container')).toBe('workload-container');
    });
  });

  describe('getEcrImageUrl', () => {
    test('should combine repository URL and image tag', () => {
      const url = getEcrImageUrl('123456789012.dkr.ecr.us-east-1.amazonaws.com/repo', 'v1.0.0');
      expect(url).toBe('123456789012.dkr.ecr.us-east-1.amazonaws.com/repo:v1.0.0');
    });

    test('should handle complex tags', () => {
      const url = getEcrImageUrl('repo.url', 'task--digest--version');
      expect(url).toBe('repo.url:task--digest--version');
    });
  });

  describe('getCfTemplateS3Key', () => {
    test('should create S3 key with version', () => {
      const key = getCfTemplateS3Key('v1.0.0');
      expect(key).toContain('v1.0.0');
      expect(key).toContain('.yml');
    });

    test('should have consistent format', () => {
      const key = getCfTemplateS3Key('v2.0.0');
      expect(key).toMatch(/.*\/v2\.0\.0\.yml$/);
    });
  });

  describe('getStpTemplateS3Key', () => {
    test('should create S3 key with version', () => {
      const key = getStpTemplateS3Key('v1.0.0');
      expect(key).toContain('v1.0.0');
      expect(key).toContain('.yml');
    });

    test('should have consistent format', () => {
      const key = getStpTemplateS3Key('v2.0.0');
      expect(key).toMatch(/.*\/v2\.0\.0\.yml$/);
    });
  });

  describe('getStackName', () => {
    test('should combine project name and stage', () => {
      expect(getStackName('my-project', 'dev')).toBe('my-project-dev');
    });

    test('should handle different stages', () => {
      expect(getStackName('app', 'production')).toBe('app-production');
      expect(getStackName('app', 'staging')).toBe('app-staging');
    });
  });

  describe('getStackCfTemplateDescription', () => {
    test('should create description with all components', () => {
      const desc = getStackCfTemplateDescription('myproject', 'dev', 'abc123');
      expect(desc).toContain('STP-stack');
      expect(desc).toContain('myproject');
      expect(desc).toContain('dev');
      expect(desc).toContain('abc123');
    });

    test('should use underscores as separators', () => {
      const desc = getStackCfTemplateDescription('proj', 'stage', 'hash');
      expect(desc).toMatch(/STP-stack_.*_.*_.*/)
;
    });
  });

  describe('isStacktapeStackDescription', () => {
    test('should return true for valid Stacktape descriptions', () => {
      const desc = getStackCfTemplateDescription('proj', 'dev', 'hash');
      expect(isStacktapeStackDescription(desc)).toBe(true);
    });

    test('should return false for non-Stacktape descriptions', () => {
      expect(isStacktapeStackDescription('Some other description')).toBe(false);
      expect(isStacktapeStackDescription('Random text')).toBe(false);
    });

    test('should return false for undefined or null', () => {
      expect(isStacktapeStackDescription(undefined)).toBe(false);
      expect(isStacktapeStackDescription(null)).toBe(false);
    });

    test('should return false for empty string', () => {
      expect(isStacktapeStackDescription('')).toBe(false);
    });
  });

  describe('getStacktapeStackInfoFromTemplateDescription', () => {
    test('should extract project name, stage, and hash', () => {
      const desc = getStackCfTemplateDescription('myproject', 'production', 'abc123def');
      const info = getStacktapeStackInfoFromTemplateDescription(desc);
      expect(info.projectName).toBe('myproject');
      expect(info.stage).toBe('production');
      expect(info.globallyUniqueStackHash).toBe('abc123def');
    });

    test('should return empty values for non-Stacktape descriptions', () => {
      const info = getStacktapeStackInfoFromTemplateDescription('Not a stacktape stack');
      expect(info.projectName).toBe('');
      expect(info.stage).toBe('');
      expect(info.globallyUniqueStackHash).toBe('');
    });
  });

  describe('getSimpleServiceDefaultContainerName', () => {
    test('should return consistent container name', () => {
      expect(getSimpleServiceDefaultContainerName()).toBe('service-container');
    });

    test('should return same value on multiple calls', () => {
      const name1 = getSimpleServiceDefaultContainerName();
      const name2 = getSimpleServiceDefaultContainerName();
      expect(name1).toBe(name2);
    });
  });

  describe('getEcrRepositoryUrl', () => {
    test('should construct ECR repository URL', () => {
      const url = getEcrRepositoryUrl('123456789012', 'us-east-1', 'my-repo');
      expect(url).toBe('123456789012.dkr.ecr.us-east-1.amazonaws.com/my-repo');
    });

    test('should handle different regions', () => {
      const url = getEcrRepositoryUrl('123456789012', 'eu-west-1', 'repo');
      expect(url).toBe('123456789012.dkr.ecr.eu-west-1.amazonaws.com/repo');
    });
  });

  describe('getBaseS3EndpointForRegion', () => {
    test('should return standard endpoint for regular regions', () => {
      expect(getBaseS3EndpointForRegion('us-east-1')).toBe('s3.us-east-1.amazonaws.com');
      expect(getBaseS3EndpointForRegion('eu-west-1')).toBe('s3.eu-west-1.amazonaws.com');
    });

    test('should handle us-gov regions', () => {
      expect(getBaseS3EndpointForRegion('us-gov-west-1')).toBe('s3-us-gov-west-1.amazonaws.com');
      expect(getBaseS3EndpointForRegion('us-gov-east-1')).toBe('s3-us-gov-east-1.amazonaws.com');
    });

    test('should handle China regions', () => {
      expect(getBaseS3EndpointForRegion('cn-north-1')).toBe('s3.cn-north-1.amazonaws.com.cn');
      expect(getBaseS3EndpointForRegion('cn-northwest-1')).toBe('s3.cn-northwest-1.amazonaws.com.cn');
    });
  });

  describe('getLocalInvokeContainerName', () => {
    test('should prepend invoke-local- to job name', () => {
      expect(getLocalInvokeContainerName('my-job')).toBe('invoke-local-my-job');
    });

    test('should handle different job names', () => {
      expect(getLocalInvokeContainerName('function')).toBe('invoke-local-function');
    });
  });

  describe('getUserPoolDomainPrefix', () => {
    test('should combine stack name and user pool name', () => {
      expect(getUserPoolDomainPrefix('my-stack', 'main-pool')).toBe('my-stack-main-pool');
    });

    test('should lowercase the result', () => {
      expect(getUserPoolDomainPrefix('MyStack', 'MyPool')).toBe('mystack-mypool');
    });
  });

  describe('buildLambdaS3Key', () => {
    test('should create S3 key with function name, version, and digest', () => {
      const key = buildLambdaS3Key('my-function', 'v1.0.0', 'abc123');
      expect(key).toBe('my-function/v1.0.0-abc123.zip');
    });

    test('should handle empty digest', () => {
      const key = buildLambdaS3Key('my-function', 'v1.0.0', '');
      expect(key).toBe('my-function/v1.0.0.zip');
    });

    test('should not include digest separator when digest is empty', () => {
      const key = buildLambdaS3Key('func', 'v1', '');
      expect(key).not.toContain('v1-');
    });
  });

  describe('portMappingsPortName', () => {
    test('should create port name with port number', () => {
      expect(portMappingsPortName(8080)).toBe('port-8080');
      expect(portMappingsPortName(3000)).toBe('port-3000');
    });

    test('should handle different port numbers', () => {
      expect(portMappingsPortName(80)).toBe('port-80');
      expect(portMappingsPortName(443)).toBe('port-443');
    });
  });
});
