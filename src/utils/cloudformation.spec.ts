import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@cloudform/dataTypes', () => ({
  IntrinsicFunction: class IntrinsicFunction {
    type: string;
    value: any;
    constructor(type: string, value: any) {
      this.type = type;
      this.value = value;
    }
  },
  Value: class Value {}
}));

mock.module('@cloudform/functions', () => ({
  Sub: mock((str: string, subs?: any) => ({
    'Fn::Sub': subs ? [str, subs] : str
  }))
}));

mock.module('@shared/utils/misc', () => ({
  serialize: mock((obj: any) => {
    if (typeof obj === 'object' && obj !== null) {
      if (obj.Ref) return { Ref: obj.Ref };
      if (obj['Fn::GetAtt']) return { 'Fn::GetAtt': obj['Fn::GetAtt'] };
      return JSON.parse(JSON.stringify(obj));
    }
    return obj;
  })
}));

describe('cloudformation', () => {
  describe('getCfEnvironment', () => {
    test('should convert environment variables to CloudFormation format', async () => {
      const { getCfEnvironment } = await import('./cloudformation');

      const result = getCfEnvironment([
        { name: 'NODE_ENV', value: 'production' },
        { name: 'PORT', value: 3000 }
      ]);

      expect(result).toEqual([
        { Name: 'NODE_ENV', Value: 'production' },
        { Name: 'PORT', Value: '3000' }
      ]);
    });

    test('should handle string values', async () => {
      const { getCfEnvironment } = await import('./cloudformation');

      const result = getCfEnvironment([{ name: 'KEY', value: 'value' }]);

      expect(result[0].Name).toBe('KEY');
      expect(result[0].Value).toBe('value');
    });

    test('should handle numeric values', async () => {
      const { getCfEnvironment } = await import('./cloudformation');

      const result = getCfEnvironment([{ name: 'PORT', value: 8080 }]);

      expect(result[0].Name).toBe('PORT');
      expect(result[0].Value).toBe('8080');
    });

    test('should handle CloudFormation functions', async () => {
      const { getCfEnvironment } = await import('./cloudformation');

      const result = getCfEnvironment([{ name: 'BUCKET', value: { Ref: 'MyBucket' } }]);

      expect(result[0].Name).toBe('BUCKET');
      expect(result[0].Value).toHaveProperty('Ref');
    });

    test('should handle empty array', async () => {
      const { getCfEnvironment } = await import('./cloudformation');

      const result = getCfEnvironment([]);

      expect(result).toEqual([]);
    });

    test('should handle null/undefined input', async () => {
      const { getCfEnvironment } = await import('./cloudformation');

      const result = getCfEnvironment(null);

      expect(result).toEqual([]);
    });
  });

  describe('SubWithoutMapping', () => {
    test('should create Fn::Sub without mapping', async () => {
      const { SubWithoutMapping } = await import('./cloudformation');

      const result = SubWithoutMapping('arn:aws:s3:::${BucketName}');

      expect(result.type).toBe('Fn::Sub');
      expect(result.value).toBe('arn:aws:s3:::${BucketName}');
    });

    test('should handle different string patterns', async () => {
      const { SubWithoutMapping } = await import('./cloudformation');

      const result = SubWithoutMapping('${AWS::Region}-${AWS::AccountId}');

      expect(result.type).toBe('Fn::Sub');
    });
  });

  describe('isCloudformationFunction', () => {
    test('should detect Fn::Sub', async () => {
      const { isCloudformationFunction } = await import('./cloudformation');

      const result = isCloudformationFunction({ 'Fn::Sub': 'value' });

      expect(result).toBe(true);
    });

    test('should detect Fn::GetAtt', async () => {
      const { isCloudformationFunction } = await import('./cloudformation');

      const result = isCloudformationFunction({ 'Fn::GetAtt': ['Resource', 'Arn'] });

      expect(result).toBe(true);
    });

    test('should detect Ref', async () => {
      const { isCloudformationFunction } = await import('./cloudformation');

      const result = isCloudformationFunction({ Ref: 'MyResource' });

      expect(result).toBe(true);
    });

    test('should return false for regular objects', async () => {
      const { isCloudformationFunction } = await import('./cloudformation');

      const result = isCloudformationFunction({ key: 'value' });

      expect(result).toBe(false);
    });

    test('should return false for objects with multiple keys', async () => {
      const { isCloudformationFunction } = await import('./cloudformation');

      const result = isCloudformationFunction({ Ref: 'MyResource', other: 'value' });

      expect(result).toBe(false);
    });

    test('should return false for non-objects', async () => {
      const { isCloudformationFunction } = await import('./cloudformation');

      expect(isCloudformationFunction('string')).toBe(false);
      expect(isCloudformationFunction(123)).toBe(false);
      expect(isCloudformationFunction(null)).toBe(false);
    });
  });

  describe('isCloudformationRefFunction', () => {
    test('should detect Ref function', async () => {
      const { isCloudformationRefFunction } = await import('./cloudformation');

      const result = isCloudformationRefFunction({ Ref: 'MyResource' });

      expect(result).toBe(true);
    });

    test('should return false for non-Ref functions', async () => {
      const { isCloudformationRefFunction } = await import('./cloudformation');

      expect(isCloudformationRefFunction({ 'Fn::GetAtt': ['Resource', 'Arn'] })).toBe(false);
      expect(isCloudformationRefFunction({ 'Fn::Sub': 'value' })).toBe(false);
    });

    test('should return false for non-functions', async () => {
      const { isCloudformationRefFunction } = await import('./cloudformation');

      expect(isCloudformationRefFunction({ key: 'value' })).toBe(false);
      expect(isCloudformationRefFunction('string')).toBe(false);
    });
  });

  describe('isCloudformationGetAttFunction', () => {
    test('should detect Fn::GetAtt function', async () => {
      const { isCloudformationGetAttFunction } = await import('./cloudformation');

      const result = isCloudformationGetAttFunction({ 'Fn::GetAtt': ['MyResource', 'Arn'] });

      expect(result).toBe(true);
    });

    test('should return false for non-GetAtt functions', async () => {
      const { isCloudformationGetAttFunction } = await import('./cloudformation');

      expect(isCloudformationGetAttFunction({ Ref: 'MyResource' })).toBe(false);
      expect(isCloudformationGetAttFunction({ 'Fn::Sub': 'value' })).toBe(false);
    });

    test('should return false for non-functions', async () => {
      const { isCloudformationGetAttFunction } = await import('./cloudformation');

      expect(isCloudformationGetAttFunction({ key: 'value' })).toBe(false);
    });
  });

  describe('getCloudformationReferencedParamOrResource', () => {
    test('should find resource in template', async () => {
      const { getCloudformationReferencedParamOrResource } = await import('./cloudformation');

      const template = {
        Resources: {
          MyBucket: { Type: 'AWS::S3::Bucket' }
        }
      };

      const result = getCloudformationReferencedParamOrResource('MyBucket', template);

      expect(result).toEqual({ Type: 'AWS::S3::Bucket' });
    });

    test('should find parameter in template', async () => {
      const { getCloudformationReferencedParamOrResource } = await import('./cloudformation');

      const template = {
        Parameters: {
          BucketName: { Type: 'String' }
        }
      };

      const result = getCloudformationReferencedParamOrResource('BucketName', template);

      expect(result).toEqual({ Type: 'String' });
    });

    test('should prioritize resources over parameters', async () => {
      const { getCloudformationReferencedParamOrResource } = await import('./cloudformation');

      const template = {
        Resources: {
          MyResource: { Type: 'AWS::Lambda::Function' }
        },
        Parameters: {
          MyResource: { Type: 'String' }
        }
      };

      const result = getCloudformationReferencedParamOrResource('MyResource', template);

      expect(result).toEqual({ Type: 'AWS::Lambda::Function' });
    });

    test('should return undefined for non-existent reference', async () => {
      const { getCloudformationReferencedParamOrResource } = await import('./cloudformation');

      const template = {
        Resources: {},
        Parameters: {}
      };

      const result = getCloudformationReferencedParamOrResource('NonExistent', template);

      expect(result).toBeUndefined();
    });

    test('should handle template without Resources', async () => {
      const { getCloudformationReferencedParamOrResource } = await import('./cloudformation');

      const template = {
        Parameters: {
          MyParam: { Type: 'String' }
        }
      };

      const result = getCloudformationReferencedParamOrResource('MyParam', template);

      expect(result).toEqual({ Type: 'String' });
    });

    test('should handle template without Parameters', async () => {
      const { getCloudformationReferencedParamOrResource } = await import('./cloudformation');

      const template = {
        Resources: {
          MyResource: { Type: 'AWS::S3::Bucket' }
        }
      };

      const result = getCloudformationReferencedParamOrResource('MyResource', template);

      expect(result).toEqual({ Type: 'AWS::S3::Bucket' });
    });
  });

  describe('replaceCloudformationRefFunctionsWithCfPhysicalIds', () => {
    test('should replace Ref with physical ID', async () => {
      const { replaceCloudformationRefFunctionsWithCfPhysicalIds } = await import('./cloudformation');

      const node = { Ref: 'MyBucket' };
      const resources = [
        {
          LogicalResourceId: 'MyBucket',
          PhysicalResourceId: 'my-bucket-12345',
          ResourceType: 'AWS::S3::Bucket',
          ResourceStatus: 'CREATE_COMPLETE',
          LastUpdatedTimestamp: new Date()
        }
      ];

      const result = replaceCloudformationRefFunctionsWithCfPhysicalIds(node, resources);

      expect(result).toBe('my-bucket-12345');
    });

    test('should handle nested objects', async () => {
      const { replaceCloudformationRefFunctionsWithCfPhysicalIds } = await import('./cloudformation');

      const node = {
        BucketName: { Ref: 'MyBucket' },
        Region: 'us-east-1'
      };
      const resources = [
        {
          LogicalResourceId: 'MyBucket',
          PhysicalResourceId: 'my-bucket-12345',
          ResourceType: 'AWS::S3::Bucket',
          ResourceStatus: 'CREATE_COMPLETE',
          LastUpdatedTimestamp: new Date()
        }
      ];

      const result = replaceCloudformationRefFunctionsWithCfPhysicalIds(node, resources);

      expect(result.BucketName).toBe('my-bucket-12345');
      expect(result.Region).toBe('us-east-1');
    });

    test('should handle arrays', async () => {
      const { replaceCloudformationRefFunctionsWithCfPhysicalIds } = await import('./cloudformation');

      const node = [{ Ref: 'Bucket1' }, { Ref: 'Bucket2' }];
      const resources = [
        {
          LogicalResourceId: 'Bucket1',
          PhysicalResourceId: 'bucket-1-id',
          ResourceType: 'AWS::S3::Bucket',
          ResourceStatus: 'CREATE_COMPLETE',
          LastUpdatedTimestamp: new Date()
        },
        {
          LogicalResourceId: 'Bucket2',
          PhysicalResourceId: 'bucket-2-id',
          ResourceType: 'AWS::S3::Bucket',
          ResourceStatus: 'CREATE_COMPLETE',
          LastUpdatedTimestamp: new Date()
        }
      ];

      const result = replaceCloudformationRefFunctionsWithCfPhysicalIds(node, resources);

      expect(result).toEqual(['bucket-1-id', 'bucket-2-id']);
    });

    test('should handle primitives', async () => {
      const { replaceCloudformationRefFunctionsWithCfPhysicalIds } = await import('./cloudformation');

      expect(replaceCloudformationRefFunctionsWithCfPhysicalIds('string', [])).toBe('string');
      expect(replaceCloudformationRefFunctionsWithCfPhysicalIds(123, [])).toBe(123);
      expect(replaceCloudformationRefFunctionsWithCfPhysicalIds(true, [])).toBe(true);
    });
  });
});
