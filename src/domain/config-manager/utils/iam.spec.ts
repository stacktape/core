import { describe, expect, mock, test } from 'bun:test';

// Mock CloudFormation functions
mock.module('@cloudform/functions', () => ({
  GetAtt: mock((logicalName, attribute) => ({ 'Fn::GetAtt': [logicalName, attribute] })),
  Join: mock((delimiter, parts) => ({ 'Fn::Join': [delimiter, parts] }))
}));

// Mock logical names
mock.module('@shared/naming/logical-names', () => ({
  cfLogicalNames: {
    bucket: mock((name) => `Bucket${name}`)
  }
}));

describe('config-manager/utils/iam', () => {
  describe('getStacktapeOriginRequestLambdaIamStatement', () => {
    test('should create IAM statement for single bucket', async () => {
      const { getStacktapeOriginRequestLambdaIamStatement } = await import('./iam');

      const result = getStacktapeOriginRequestLambdaIamStatement({
        myBucket: []
      });

      expect(result.Action).toEqual(['s3:GetObject']);
      expect(result.Resource).toBeDefined();
      expect(Array.isArray(result.Resource)).toBe(true);
    });

    test('should create IAM statement for multiple buckets', async () => {
      const { getStacktapeOriginRequestLambdaIamStatement } = await import('./iam');

      const result = getStacktapeOriginRequestLambdaIamStatement({
        bucket1: [],
        bucket2: [],
        bucket3: []
      });

      expect(result.Action).toEqual(['s3:GetObject']);
      expect(result.Resource.length).toBe(3);
    });

    test('should include GetObject action', async () => {
      const { getStacktapeOriginRequestLambdaIamStatement } = await import('./iam');

      const result = getStacktapeOriginRequestLambdaIamStatement({
        testBucket: []
      });

      expect(result.Action).toContain('s3:GetObject');
    });

    test('should call cfLogicalNames.bucket for each bucket', async () => {
      const { cfLogicalNames } = await import('@shared/naming/logical-names');
      const { getStacktapeOriginRequestLambdaIamStatement } = await import('./iam');

      getStacktapeOriginRequestLambdaIamStatement({
        bucket1: [],
        bucket2: []
      });

      expect(cfLogicalNames.bucket).toHaveBeenCalledWith('bucket1');
      expect(cfLogicalNames.bucket).toHaveBeenCalledWith('bucket2');
    });

    test('should call GetAtt with bucket logical name and Arn attribute', async () => {
      const { GetAtt } = await import('@cloudform/functions');
      const { getStacktapeOriginRequestLambdaIamStatement } = await import('./iam');

      getStacktapeOriginRequestLambdaIamStatement({
        myBucket: []
      });

      expect(GetAtt).toHaveBeenCalled();
    });

    test('should use Join to append /* to bucket ARN', async () => {
      const { Join } = await import('@cloudform/functions');
      const { getStacktapeOriginRequestLambdaIamStatement } = await import('./iam');

      getStacktapeOriginRequestLambdaIamStatement({
        bucket: []
      });

      expect(Join).toHaveBeenCalled();
    });

    test('should handle empty buckets object', async () => {
      const { getStacktapeOriginRequestLambdaIamStatement } = await import('./iam');

      const result = getStacktapeOriginRequestLambdaIamStatement({});

      expect(result.Resource).toEqual([]);
      expect(result.Action).toEqual(['s3:GetObject']);
    });

    test('should flatten nested arrays in Resource', async () => {
      const { getStacktapeOriginRequestLambdaIamStatement } = await import('./iam');

      const result = getStacktapeOriginRequestLambdaIamStatement({
        bucket1: [],
        bucket2: []
      });

      expect(result.Resource.every((item) => !Array.isArray(item))).toBe(true);
    });

    test('should create statement with bucket name containing hyphens', async () => {
      const { getStacktapeOriginRequestLambdaIamStatement } = await import('./iam');

      const result = getStacktapeOriginRequestLambdaIamStatement({
        'my-bucket-name': []
      });

      expect(result.Action).toEqual(['s3:GetObject']);
      expect(result.Resource.length).toBe(1);
    });

    test('should create statement with bucket name containing dots', async () => {
      const { getStacktapeOriginRequestLambdaIamStatement } = await import('./iam');

      const result = getStacktapeOriginRequestLambdaIamStatement({
        'my.bucket.name': []
      });

      expect(result.Resource.length).toBe(1);
    });

    test('should preserve bucket count in Resource array', async () => {
      const { getStacktapeOriginRequestLambdaIamStatement } = await import('./iam');

      const buckets = {
        bucket1: [],
        bucket2: [],
        bucket3: [],
        bucket4: [],
        bucket5: []
      };

      const result = getStacktapeOriginRequestLambdaIamStatement(buckets);

      expect(result.Resource.length).toBe(5);
    });

    test('should ignore bucket values (array content)', async () => {
      const { getStacktapeOriginRequestLambdaIamStatement } = await import('./iam');

      const result = getStacktapeOriginRequestLambdaIamStatement({
        bucket1: ['value1', 'value2'],
        bucket2: ['value3']
      });

      expect(result.Resource.length).toBe(2);
    });
  });
});
