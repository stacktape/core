import { describe, expect, test } from 'bun:test';
import { awsResourceNames, codebuildDeploymentBucketResourceName } from './aws-resource-names';

describe('aws-resource-names', () => {
  const stackName = 'test-stack';
  const globallyUniqueStackHash = 'abc123def';
  const region = 'us-east-1';
  const accountId = '123456789012';

  describe('bucket', () => {
    test('should generate bucket name with stack, resource, and hash', () => {
      const name = awsResourceNames.bucket('my-bucket', stackName, globallyUniqueStackHash);
      expect(name).toContain('test-stack');
      expect(name).toContain('my-bucket');
      expect(name).toContain(globallyUniqueStackHash);
    });

    test('should lowercase bucket names', () => {
      const name = awsResourceNames.bucket('MyBucket', stackName, globallyUniqueStackHash);
      expect(name).toBe(name.toLowerCase());
      expect(name).toContain('mybucket');
    });

    test('should respect 63 character limit', () => {
      const longName = 'very-long-bucket-name-that-exceeds-limits';
      const name = awsResourceNames.bucket(longName, stackName, globallyUniqueStackHash);
      expect(name.length).toBeLessThanOrEqual(63);
    });

    test('should be deterministic', () => {
      const name1 = awsResourceNames.bucket('bucket', stackName, globallyUniqueStackHash);
      const name2 = awsResourceNames.bucket('bucket', stackName, globallyUniqueStackHash);
      expect(name1).toBe(name2);
    });
  });

  describe('dynamoGlobalTable', () => {
    test('should generate DynamoDB global table name', () => {
      const name = awsResourceNames.dynamoGlobalTable('my-table', globallyUniqueStackHash, stackName);
      expect(name).toContain('test-stack');
      expect(name).toContain('my-table');
      expect(name).toContain(globallyUniqueStackHash);
    });

    test('should respect 255 character limit', () => {
      const longName = 'a'.repeat(300);
      const name = awsResourceNames.dynamoGlobalTable(longName, globallyUniqueStackHash, stackName);
      expect(name.length).toBeLessThanOrEqual(255);
    });
  });

  describe('dynamoRegionalTable', () => {
    test('should generate DynamoDB regional table name', () => {
      const name = awsResourceNames.dynamoRegionalTable('my-table', stackName);
      expect(name).toContain('test-stack');
      expect(name).toContain('my-table');
    });

    test('should not include globallyUniqueStackHash', () => {
      const name = awsResourceNames.dynamoRegionalTable('table', stackName);
      expect(name).not.toContain(globallyUniqueStackHash);
    });
  });

  describe('redisReplicationGroupId', () => {
    test('should generate Redis replication group ID', () => {
      const name = awsResourceNames.redisReplicationGroupId('my-redis', stackName);
      expect(name).toContain('test-stack');
      expect(name).toContain('my-redis');
    });

    test('should lowercase resource name', () => {
      const name = awsResourceNames.redisReplicationGroupId('MyRedis', stackName);
      expect(name).toBe(name.toLowerCase());
    });

    test('should respect 40 character limit', () => {
      const longName = 'very-long-redis-name-exceeding-limit';
      const name = awsResourceNames.redisReplicationGroupId(longName, stackName);
      expect(name.length).toBeLessThanOrEqual(40);
    });
  });

  describe('lambdaRole', () => {
    test('should generate Lambda role name for regular function', () => {
      const name = awsResourceNames.lambdaRole(stackName, region, 'my-function', 'function');
      expect(name).toContain('test-stack');
      expect(name).toContain('my-function');
      expect(name).toContain(region);
      expect(name).not.toContain('TRIGGER');
    });

    test('should add TRIGGER suffix for batch job functions', () => {
      const name = awsResourceNames.lambdaRole(stackName, region, 'my-function', 'batch-job');
      expect(name).toContain('TRIGGER');
    });

    test('should respect 64 character limit', () => {
      const longFunctionName = 'very-long-function-name-that-might-exceed-limit';
      const name = awsResourceNames.lambdaRole(stackName, region, longFunctionName, 'function');
      expect(name.length).toBeLessThanOrEqual(64);
    });
  });

  describe('lambdaDefaultRole', () => {
    test('should generate default Lambda role name', () => {
      const name = awsResourceNames.lambdaDefaultRole(stackName, region);
      expect(name).toContain('test-stack');
      expect(name).toContain('stpDefLambda');
      expect(name).toContain(region);
    });

    test('should be consistent for same inputs', () => {
      const name1 = awsResourceNames.lambdaDefaultRole(stackName, region);
      const name2 = awsResourceNames.lambdaDefaultRole(stackName, region);
      expect(name1).toBe(name2);
    });
  });

  describe('lambdaStpAlias', () => {
    test('should return stp-live alias', () => {
      const name = awsResourceNames.lambdaStpAlias();
      expect(name).toBe('stp-live');
    });

    test('should always return same value', () => {
      const name1 = awsResourceNames.lambdaStpAlias();
      const name2 = awsResourceNames.lambdaStpAlias();
      expect(name1).toBe(name2);
    });
  });

  describe('eventBus', () => {
    test('should generate EventBridge event bus name', () => {
      const name = awsResourceNames.eventBus(stackName, 'my-bus');
      expect(name).toContain('test-stack');
      expect(name).toContain('my-bus');
    });

    test('should respect 256 character limit', () => {
      const longName = 'a'.repeat(300);
      const name = awsResourceNames.eventBus(stackName, longName);
      expect(name.length).toBeLessThanOrEqual(256);
    });
  });

  describe('deploymentBucket', () => {
    test('should generate deployment bucket name with hash', () => {
      const name = awsResourceNames.deploymentBucket(globallyUniqueStackHash);
      expect(name).toContain('stp-deployment-bucket');
      expect(name).toContain(globallyUniqueStackHash);
    });

    test('should not include stack name', () => {
      const name = awsResourceNames.deploymentBucket(globallyUniqueStackHash);
      expect(name).not.toContain('test-stack');
    });

    test('should respect 63 character limit', () => {
      const name = awsResourceNames.deploymentBucket(globallyUniqueStackHash);
      expect(name.length).toBeLessThanOrEqual(63);
    });
  });

  describe('deploymentEcrRepo', () => {
    test('should generate deployment ECR repository name', () => {
      const name = awsResourceNames.deploymentEcrRepo(globallyUniqueStackHash);
      expect(name).toContain(globallyUniqueStackHash);
      expect(name).toContain('stp-multi-container-workload-repo');
    });

    test('should start with hash', () => {
      const name = awsResourceNames.deploymentEcrRepo(globallyUniqueStackHash);
      expect(name).toStartWith(globallyUniqueStackHash);
    });
  });

  describe('stpServiceDynamoTable', () => {
    test('should generate service DynamoDB table name', () => {
      const name = awsResourceNames.stpServiceDynamoTable(region);
      expect(name).toBe('stp-service-us-east-1');
    });

    test('should include region', () => {
      const name = awsResourceNames.stpServiceDynamoTable('eu-west-1');
      expect(name).toContain('eu-west-1');
    });
  });

  describe('batchComputeEnvironment', () => {
    test('should generate on-demand compute environment name', () => {
      const name = awsResourceNames.batchComputeEnvironment(stackName, false, false);
      expect(name).toContain('test-stack');
      expect(name).toContain('onDemand');
      expect(name).not.toContain('spot');
      expect(name).not.toContain('gpu');
    });

    test('should generate spot compute environment name', () => {
      const name = awsResourceNames.batchComputeEnvironment(stackName, true, false);
      expect(name).toContain('spot');
      expect(name).not.toContain('onDemand');
    });

    test('should include GPU in name when specified', () => {
      const name = awsResourceNames.batchComputeEnvironment(stackName, false, true);
      expect(name).toContain('gpu');
    });

    test('should generate spot GPU environment', () => {
      const name = awsResourceNames.batchComputeEnvironment(stackName, true, true);
      expect(name).toContain('spot');
      expect(name).toContain('gpu');
    });
  });

  describe('batchJobQueue', () => {
    test('should generate on-demand job queue name', () => {
      const name = awsResourceNames.batchJobQueue(stackName, false, false);
      expect(name).toContain('onDemand');
      expect(name).toContain('job-queue');
    });

    test('should generate spot job queue name', () => {
      const name = awsResourceNames.batchJobQueue(stackName, true, false);
      expect(name).toContain('spot');
    });

    test('should include GPU suffix when specified', () => {
      const name = awsResourceNames.batchJobQueue(stackName, false, true);
      expect(name).toContain('gpu');
    });
  });

  describe('dbCluster', () => {
    test('should generate Aurora DB cluster name', () => {
      const name = awsResourceNames.dbCluster(stackName, 'my-cluster');
      expect(name).toContain('test-stack');
      expect(name).toContain('my-cluster');
    });

    test('should lowercase resource name', () => {
      const name = awsResourceNames.dbCluster(stackName, 'MyCluster');
      expect(name).toBe(name.toLowerCase());
    });

    test('should respect 63 character limit', () => {
      const longName = 'a'.repeat(100);
      const name = awsResourceNames.dbCluster(stackName, longName);
      expect(name.length).toBeLessThanOrEqual(63);
    });
  });

  describe('dbInstance', () => {
    test('should generate RDS instance name', () => {
      const name = awsResourceNames.dbInstance('my-database', stackName);
      expect(name).toContain('test-stack');
      expect(name).toContain('my-database');
    });

    test('should lowercase resource name', () => {
      const name = awsResourceNames.dbInstance('MyDatabase', stackName);
      expect(name).toBe(name.toLowerCase());
    });
  });

  describe('dbSecurityGroup', () => {
    test('should generate database security group name', () => {
      const name = awsResourceNames.dbSecurityGroup('my-db', stackName);
      expect(name).toContain('test-stack');
      expect(name).toContain('my-db');
      expect(name).toContain('-sg');
    });

    test('should end with -sg suffix', () => {
      const name = awsResourceNames.dbSecurityGroup('workload', stackName);
      expect(name).toEndWith('-sg');
    });
  });

  describe('codebuildDeploymentBucketResourceName', () => {
    test('should generate CodeBuild deployment bucket name', () => {
      const name = codebuildDeploymentBucketResourceName(region, accountId);
      expect(name).toContain('stp-codebuild-deployment');
      expect(name).toContain(region);
    });

    test('should include short hash of account ID', () => {
      const name = codebuildDeploymentBucketResourceName(region, accountId);
      // Should contain a hashed version of account ID, not the full account ID
      expect(name.length).toBeLessThan(60);
    });

    test('should be consistent for same inputs', () => {
      const name1 = codebuildDeploymentBucketResourceName(region, accountId);
      const name2 = codebuildDeploymentBucketResourceName(region, accountId);
      expect(name1).toBe(name2);
    });
  });

  describe('atlasMongoProject', () => {
    test('should generate Atlas MongoDB project name', () => {
      const name = awsResourceNames.atlasMongoProject(stackName, globallyUniqueStackHash);
      expect(name).toContain('test-stack');
      expect(name).toContain(globallyUniqueStackHash);
    });

    test('should respect 64 character limit', () => {
      const longStackName = 'a'.repeat(100);
      const name = awsResourceNames.atlasMongoProject(longStackName, globallyUniqueStackHash);
      expect(name.length).toBeLessThanOrEqual(64);
    });
  });

  describe('atlasMongoCluster', () => {
    test('should generate Atlas MongoDB cluster name', () => {
      const name = awsResourceNames.atlasMongoCluster('my-cluster');
      expect(name).toContain('my-cluster');
    });

    test('should lowercase cluster name', () => {
      const name = awsResourceNames.atlasMongoCluster('MyCluster');
      expect(name).toBe(name.toLowerCase());
      expect(name).toBe('mycluster');
    });

    test('should respect 64 character limit', () => {
      const longName = 'a'.repeat(100);
      const name = awsResourceNames.atlasMongoCluster(longName);
      expect(name.length).toBeLessThanOrEqual(64);
    });
  });
});
