import { describe, expect, test } from 'bun:test';

describe('template-manager/utils', () => {
  describe('getInitialCfTemplate', () => {
    test('should return CloudFormation template with correct version', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template = getInitialCfTemplate();

      expect(template.AWSTemplateFormatVersion).toBe('2010-09-09');
    });

    test('should return template with empty Resources object', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template = getInitialCfTemplate();

      expect(template.Resources).toEqual({});
      expect(Object.keys(template.Resources).length).toBe(0);
    });

    test('should return template with empty Outputs object', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template = getInitialCfTemplate();

      expect(template.Outputs).toEqual({});
      expect(Object.keys(template.Outputs).length).toBe(0);
    });

    test('should return template with empty Parameters object', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template = getInitialCfTemplate();

      expect(template.Parameters).toEqual({});
      expect(Object.keys(template.Parameters).length).toBe(0);
    });

    test('should return all required CloudFormation template properties', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template = getInitialCfTemplate();

      expect(template).toHaveProperty('AWSTemplateFormatVersion');
      expect(template).toHaveProperty('Resources');
      expect(template).toHaveProperty('Outputs');
      expect(template).toHaveProperty('Parameters');
    });

    test('should return a new object on each call', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template1 = getInitialCfTemplate();
      const template2 = getInitialCfTemplate();

      expect(template1).not.toBe(template2);
      expect(template1.Resources).not.toBe(template2.Resources);
      expect(template1.Outputs).not.toBe(template2.Outputs);
      expect(template1.Parameters).not.toBe(template2.Parameters);
    });

    test('should allow modification of Resources without affecting original', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template1 = getInitialCfTemplate();
      const template2 = getInitialCfTemplate();

      template1.Resources['MyBucket'] = { Type: 'AWS::S3::Bucket' };

      expect(template2.Resources).toEqual({});
      expect(Object.keys(template1.Resources).length).toBe(1);
      expect(Object.keys(template2.Resources).length).toBe(0);
    });

    test('should allow modification of Outputs without affecting original', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template1 = getInitialCfTemplate();
      const template2 = getInitialCfTemplate();

      template1.Outputs['BucketName'] = { Value: 'my-bucket' };

      expect(template2.Outputs).toEqual({});
    });

    test('should allow modification of Parameters without affecting original', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template1 = getInitialCfTemplate();
      const template2 = getInitialCfTemplate();

      template1.Parameters['Stage'] = { Type: 'String' };

      expect(template2.Parameters).toEqual({});
    });

    test('should have correct structure for CloudFormation template', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template = getInitialCfTemplate();

      expect(typeof template.AWSTemplateFormatVersion).toBe('string');
      expect(typeof template.Resources).toBe('object');
      expect(typeof template.Outputs).toBe('object');
      expect(typeof template.Parameters).toBe('object');
    });

    test('should use standard CloudFormation template version', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template = getInitialCfTemplate();

      // CloudFormation only supports one template version: 2010-09-09
      expect(template.AWSTemplateFormatVersion).toBe('2010-09-09');
    });

    test('should be suitable as base for CloudFormation template', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template = getInitialCfTemplate();

      // Add some resources to verify it's a valid base
      template.Resources['MyBucket'] = {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: 'my-test-bucket'
        }
      };

      template.Outputs['BucketArn'] = {
        Value: { 'Fn::GetAtt': ['MyBucket', 'Arn'] }
      };

      template.Parameters['Environment'] = {
        Type: 'String',
        Default: 'dev'
      };

      expect(template.Resources['MyBucket']).toBeDefined();
      expect(template.Outputs['BucketArn']).toBeDefined();
      expect(template.Parameters['Environment']).toBeDefined();
      expect(template.AWSTemplateFormatVersion).toBe('2010-09-09');
    });

    test('should return only the four standard template sections', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template = getInitialCfTemplate();
      const keys = Object.keys(template);

      expect(keys.length).toBe(4);
      expect(keys).toContain('AWSTemplateFormatVersion');
      expect(keys).toContain('Resources');
      expect(keys).toContain('Outputs');
      expect(keys).toContain('Parameters');
    });

    test('should initialize with objects that can be populated', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template = getInitialCfTemplate();

      // Verify we can add multiple resources
      template.Resources['Resource1'] = { Type: 'AWS::S3::Bucket' };
      template.Resources['Resource2'] = { Type: 'AWS::Lambda::Function' };

      expect(Object.keys(template.Resources).length).toBe(2);
    });

    test('should not include optional CloudFormation sections', async () => {
      const { getInitialCfTemplate } = await import('./utils');

      const template = getInitialCfTemplate();

      // Optional sections like Metadata, Conditions, Mappings should not be present
      expect(template).not.toHaveProperty('Metadata');
      expect(template).not.toHaveProperty('Conditions');
      expect(template).not.toHaveProperty('Mappings');
      expect(template).not.toHaveProperty('Transform');
      expect(template).not.toHaveProperty('Description');
    });
  });
});
