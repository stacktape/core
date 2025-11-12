import { describe, expect, mock, test } from 'bun:test';

// Mock the CloudFormation resource referenceable params JSON
mock.module('../../@generated/cloudformation-resource-referenceable-params.json', () => ({
  default: {
    'AWS::S3::Bucket': {
      Ref: ['Ref'],
      GetAtt: ['Arn', 'DomainName', 'DualStackDomainName', 'RegionalDomainName', 'WebsiteURL']
    },
    'AWS::Lambda::Function': {
      Ref: ['Ref'],
      GetAtt: ['Arn', 'Name']
    },
    'AWS::DynamoDB::Table': {
      Ref: ['Ref'],
      GetAtt: ['Arn', 'StreamArn']
    },
    'AWS::SNS::Topic': {
      Ref: ['Ref'],
      GetAtt: ['TopicArn', 'TopicName']
    },
    'AWS::SQS::Queue': {
      Ref: ['Ref'],
      GetAtt: ['Arn', 'QueueName', 'QueueUrl']
    },
    'AWS::RDS::DBInstance': {
      Ref: ['Ref'],
      GetAtt: ['Endpoint.Address', 'Endpoint.Port', 'DBInstanceIdentifier']
    }
  }
}));

describe('referenceable-types', () => {
  describe('referenceableTypes', () => {
    test('should include AWS CloudFormation types', async () => {
      const { referenceableTypes } = await import('./referenceable-types');

      expect(referenceableTypes['AWS::S3::Bucket']).toBeDefined();
      expect(referenceableTypes['AWS::Lambda::Function']).toBeDefined();
      expect(referenceableTypes['AWS::DynamoDB::Table']).toBeDefined();
    });

    test('should include private MongoDB types', async () => {
      const { referenceableTypes } = await import('./referenceable-types');

      expect(referenceableTypes['MongoDB::StpAtlasV1::Cluster']).toBeDefined();
      expect(referenceableTypes['MongoDB::StpAtlasV1::DatabaseUser']).toBeDefined();
      expect(referenceableTypes['MongoDB::StpAtlasV1::Project']).toBeDefined();
    });

    test('should include private Stacktape types', async () => {
      const { referenceableTypes } = await import('./referenceable-types');

      expect(referenceableTypes['Stacktape::ECSBlueGreenV1::Service']).toBeDefined();
    });

    test('should have correct structure for MongoDB Cluster', async () => {
      const { referenceableTypes } = await import('./referenceable-types');

      const cluster = referenceableTypes['MongoDB::StpAtlasV1::Cluster'];
      expect(cluster.Ref).toEqual(['ClusterCfnIdentifier']);
      expect(cluster.GetAtt).toEqual(['ConnectionString', 'SrvConnectionString', 'StateName']);
    });

    test('should have correct structure for MongoDB DatabaseUser', async () => {
      const { referenceableTypes } = await import('./referenceable-types');

      const dbUser = referenceableTypes['MongoDB::StpAtlasV1::DatabaseUser'];
      expect(dbUser.Ref).toEqual(['UserCfnIdentifier']);
      expect(dbUser.GetAtt).toEqual([]);
    });

    test('should have correct structure for MongoDB Project', async () => {
      const { referenceableTypes } = await import('./referenceable-types');

      const project = referenceableTypes['MongoDB::StpAtlasV1::Project'];
      expect(project.Ref).toEqual(['Id']);
      expect(project.GetAtt).toEqual([]);
    });

    test('should have correct structure for Stacktape ECS BlueGreen Service', async () => {
      const { referenceableTypes } = await import('./referenceable-types');

      const service = referenceableTypes['Stacktape::ECSBlueGreenV1::Service'];
      expect(service.Ref).toEqual(['Arn']);
      expect(service.GetAtt).toEqual(['Name']);
    });

    test('should have Ref and GetAtt arrays for S3 bucket', async () => {
      const { referenceableTypes } = await import('./referenceable-types');

      const bucket = referenceableTypes['AWS::S3::Bucket'];
      expect(bucket.Ref).toContain('Ref');
      expect(bucket.GetAtt).toContain('Arn');
      expect(bucket.GetAtt).toContain('DomainName');
    });

    test('should have Ref and GetAtt arrays for Lambda function', async () => {
      const { referenceableTypes } = await import('./referenceable-types');

      const lambda = referenceableTypes['AWS::Lambda::Function'];
      expect(lambda.Ref).toContain('Ref');
      expect(lambda.GetAtt).toContain('Arn');
      expect(lambda.GetAtt).toContain('Name');
    });

    test('should merge CloudFormation and private types', async () => {
      const { referenceableTypes } = await import('./referenceable-types');

      // Should have both AWS and private types
      expect(referenceableTypes['AWS::S3::Bucket']).toBeDefined();
      expect(referenceableTypes['MongoDB::StpAtlasV1::Cluster']).toBeDefined();
    });

    test('should have both Ref and GetAtt properties for each type', async () => {
      const { referenceableTypes } = await import('./referenceable-types');

      Object.values(referenceableTypes).forEach((type: any) => {
        expect(type).toHaveProperty('Ref');
        expect(type).toHaveProperty('GetAtt');
        expect(Array.isArray(type.Ref)).toBe(true);
        expect(Array.isArray(type.GetAtt)).toBe(true);
      });
    });
  });

  describe('getAllReferencableParams', () => {
    test('should return all Ref and GetAtt params for S3 bucket', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('AWS::S3::Bucket');

      expect(params).toContain('Ref');
      expect(params).toContain('Arn');
      expect(params).toContain('DomainName');
      expect(params).toContain('DualStackDomainName');
      expect(params).toContain('RegionalDomainName');
      expect(params).toContain('WebsiteURL');
    });

    test('should return all Ref and GetAtt params for Lambda function', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('AWS::Lambda::Function');

      expect(params).toContain('Ref');
      expect(params).toContain('Arn');
      expect(params).toContain('Name');
      expect(params.length).toBe(3);
    });

    test('should return all params for MongoDB Cluster', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('MongoDB::StpAtlasV1::Cluster');

      expect(params).toContain('ClusterCfnIdentifier');
      expect(params).toContain('ConnectionString');
      expect(params).toContain('SrvConnectionString');
      expect(params).toContain('StateName');
      expect(params.length).toBe(4);
    });

    test('should return only Ref params when GetAtt is empty', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('MongoDB::StpAtlasV1::DatabaseUser');

      expect(params).toContain('UserCfnIdentifier');
      expect(params.length).toBe(1);
    });

    test('should return empty array for non-existent type', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('NonExistent::Type');

      expect(params).toEqual([]);
    });

    test('should handle undefined type gracefully', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams(undefined as any);

      expect(params).toEqual([]);
    });

    test('should return all params for SNS topic', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('AWS::SNS::Topic');

      expect(params).toContain('Ref');
      expect(params).toContain('TopicArn');
      expect(params).toContain('TopicName');
    });

    test('should return all params for SQS queue', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('AWS::SQS::Queue');

      expect(params).toContain('Ref');
      expect(params).toContain('Arn');
      expect(params).toContain('QueueName');
      expect(params).toContain('QueueUrl');
    });

    test('should return all params for RDS instance', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('AWS::RDS::DBInstance');

      expect(params).toContain('Ref');
      expect(params).toContain('Endpoint.Address');
      expect(params).toContain('Endpoint.Port');
      expect(params).toContain('DBInstanceIdentifier');
    });

    test('should return params for Stacktape ECS BlueGreen Service', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('Stacktape::ECSBlueGreenV1::Service');

      expect(params).toContain('Arn');
      expect(params).toContain('Name');
      expect(params.length).toBe(2);
    });

    test('should concatenate Ref and GetAtt arrays correctly', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('AWS::DynamoDB::Table');

      // Should include Ref params first, then GetAtt params
      expect(params[0]).toBe('Ref');
      expect(params.slice(1)).toContain('Arn');
      expect(params.slice(1)).toContain('StreamArn');
    });

    test('should handle types with no Ref params', async () => {
      mock.module('../../@generated/cloudformation-resource-referenceable-params.json', () => ({
        default: {
          'Custom::TypeWithoutRef': {
            Ref: [],
            GetAtt: ['Property1', 'Property2']
          }
        }
      }));

      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('Custom::TypeWithoutRef');

      expect(params).toEqual(['Property1', 'Property2']);
    });

    test('should return unique values (no duplicates)', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('AWS::S3::Bucket');

      const uniqueParams = [...new Set(params)];
      expect(params.length).toBe(uniqueParams.length);
    });

    test('should handle types with many GetAtt params', async () => {
      const { getAllReferencableParams } = await import('./referenceable-types');

      const params = getAllReferencableParams('AWS::S3::Bucket');

      expect(params.length).toBeGreaterThan(1);
      expect(params.filter((p) => p !== 'Ref').length).toBeGreaterThan(0);
    });
  });
});
