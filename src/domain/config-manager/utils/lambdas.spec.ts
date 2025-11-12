import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    region: 'us-east-1',
    targetStack: {
      stage: 'dev',
      stackName: 'my-stack-dev'
    },
    targetAwsAccount: {
      awsAccountId: '123456789012'
    }
  }
}));

mock.module('@cloudform/functions', () => ({
  GetAtt: mock((logicalId, attr) => ({
    'Fn::GetAtt': [logicalId, attr],
    toJSON: function() {
      return this;
    }
  })),
  Ref: mock((logicalId) => ({
    Ref: logicalId,
    toJSON: function() {
      return this;
    }
  })),
  Sub: mock((template, variables) => ({
    'Fn::Sub': [template, variables],
    toJSON: function() {
      return this;
    }
  }))
}));

mock.module('@config', () => ({
  IS_DEV: false,
  STACKTAPE_TRPC_API_ENDPOINT: 'https://api.stacktape.com'
}));

mock.module('@domain-services/ses-manager', () => ({
  sesManager: {}
}));

mock.module('@domain-services/vpc-manager', () => ({
  vpcManager: {
    getVpcId: mock(() => 'vpc-12345')
  }
}));

mock.module('@shared/naming/arns', () => ({
  arns: {
    iamRole: mock(({ accountId, roleAwsName }) => `arn:aws:iam::${accountId}:role/${roleAwsName}`),
    lambdaFromFullName: mock(({ accountId, lambdaAwsName, region }) =>
      `arn:aws:lambda:${region}:${accountId}:function:${lambdaAwsName}`
    )
  }
}));

mock.module('@shared/naming/aws-resource-names', () => ({
  awsResourceNames: {
    batchStateMachine: mock((batchJobName, stackName) => `${stackName}-${batchJobName}-state-machine`),
    deploymentBucket: mock((hash) => `stacktape-deployment-${hash}`),
    stpServiceLambda: mock((stackName) => `${stackName}-stp-service`),
    dbCluster: mock((stackName, name) => `${stackName}-${name}-cluster`),
    dbInstance: mock((name, stackName) => `${stackName}-${name}-instance`),
    auroraDbInstance: mock((name, stackName, index) => `${stackName}-${name}-instance-${index}`)
  }
}));

mock.module('@shared/naming/helper-lambdas-resource-names', () => ({
  helperLambdaAwsResourceNames: {
    edgeDeploymentBucket: mock((hash) => `stacktape-edge-deployment-${hash}`)
  }
}));

mock.module('@shared/naming/logical-names', () => ({
  cfLogicalNames: {
    batchStateMachine: mock((batchJobName) => `${batchJobName}StateMachine`),
    lambdaLogGroup: mock((lambdaName) => `${lambdaName}LogGroup`)
  }
}));

mock.module('@shared/naming/ssm-secret-parameters', () => ({
  getLegacySsmParameterStoreStackPrefix: mock(({ stackName }) => `/stacktape/legacy/${stackName}`),
  getSsmParameterStoreStackPrefix: mock(({ stackName, region }) => `/stacktape/${region}/${stackName}`)
}));

mock.module('@shared/naming/tag-names', () => ({
  tagNames: {
    stackName: mock(() => 'stacktape:stack-name')
  }
}));

mock.module('@shared/utils/fs-utils', () => ({
  getContainingFolderName: mock((path) => 'folder'),
  getFileExtension: mock((path) => 'ts'),
  getFileNameWithoutExtension: mock((path) => 'handler')
}));

mock.module('@shared/utils/hashing', () => ({
  getGloballyUniqueStackHash: mock(({ region, stackName, accountId }) => 'abc123def456')
}));

mock.module('@shared/utils/runtimes', () => ({
  getDefaultRuntimeForExtension: mock((ext) => 'nodejs20.x')
}));

mock.module('@utils/cloudformation', () => ({
  SubWithoutMapping: mock((template) => ({
    'Fn::Sub': template,
    toJSON: function() {
      return this;
    }
  }))
}));

mock.module('change-case', () => ({
  kebabCase: mock((str) => str.toLowerCase().replace(/\s+/g, '-'))
}));

mock.module('../index', () => ({
  configManager: {
    allLambdasToUpload: [],
    allContainerWorkloads: [],
    batchJobs: [],
    allAuroraDatabases: [],
    allDatabasesWithInstancies: [],
    allResourcesRequiringVpc: [],
    deploymentScripts: []
  }
}));

mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(() => ({}))
}));

describe('lambdas utilities', () => {
  describe('getBatchJobTriggerLambdaEnvironment', () => {
    test('should return environment variables for batch job trigger lambda', async () => {
      const { getBatchJobTriggerLambdaEnvironment } = await import('./lambdas');

      const result = getBatchJobTriggerLambdaEnvironment({
        batchJobName: 'myBatchJob',
        stackName: 'my-stack-dev'
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);

      const stateNameVar = result.find(v => v.name === 'STATE_MACHINE_NAME');
      expect(stateNameVar).toBeDefined();
      expect(stateNameVar.value).toContain('myBatchJob');

      const arnVar = result.find(v => v.name === 'STATE_MACHINE_ARN');
      expect(arnVar).toBeDefined();

      const nameBaseVar = result.find(v => v.name === 'BATCH_JOB_NAME_BASE');
      expect(nameBaseVar).toBeDefined();
    });

    test('should kebab-case the batch job name base', async () => {
      const { getBatchJobTriggerLambdaEnvironment } = await import('./lambdas');

      const result = getBatchJobTriggerLambdaEnvironment({
        batchJobName: 'My Batch Job',
        stackName: 'my-stack'
      });

      const nameBaseVar = result.find(v => v.name === 'BATCH_JOB_NAME_BASE');
      expect(nameBaseVar.value).toBe('my batch job-my-stack');
    });
  });

  describe('getBatchJobTriggerLambdaAccessControl', () => {
    test('should return IAM statements for batch job trigger', async () => {
      const { getBatchJobTriggerLambdaAccessControl } = await import('./lambdas');

      const result = getBatchJobTriggerLambdaAccessControl({
        batchJobName: 'myBatchJob'
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);

      const statement = result[0];
      expect(statement.Effect).toBe('Allow');
      expect(statement.Action).toContain('states:StartExecution');
      expect(Array.isArray(statement.Resource)).toBe(true);
    });
  });

  describe('getStacktapeServiceLambdaEnvironment', () => {
    test('should return standard environment variables', async () => {
      const { getStacktapeServiceLambdaEnvironment } = await import('./lambdas');

      const result = getStacktapeServiceLambdaEnvironment({
        projectName: 'my-project',
        stackName: 'my-stack-dev',
        globallyUniqueStackHash: 'abc123'
      });

      expect(Array.isArray(result)).toBe(true);

      const awsPartitionVar = result.find(v => v.name === 'AWS_PARTITION');
      expect(awsPartitionVar).toBeDefined();

      const awsAccountVar = result.find(v => v.name === 'AWS_ACCOUNT_ID');
      expect(awsAccountVar).toBeDefined();

      const stackNameVar = result.find(v => v.name === 'STACK_NAME');
      expect(stackNameVar.value).toBe('my-stack-dev');

      const projectNameVar = result.find(v => v.name === 'PROJECT_NAME');
      expect(projectNameVar.value).toBe('my-project');

      const stageVar = result.find(v => v.name === 'STAGE');
      expect(stageVar.value).toBe('dev');

      const hashVar = result.find(v => v.name === 'GLOBALLY_UNIQUE_STACK_HASH');
      expect(hashVar.value).toBe('abc123');

      const apiEndpointVar = result.find(v => v.name === 'STACKTAPE_TRPC_API_ENDPOINT');
      expect(apiEndpointVar.value).toBe('https://api.stacktape.com');
    });

    test('should include DEV_MODE when IS_DEV is true', async () => {
      const config = await import('@config');
      const originalIsDev = config.IS_DEV;

      // Mock IS_DEV to true
      mock.module('@config', () => ({
        IS_DEV: true,
        STACKTAPE_TRPC_API_ENDPOINT: 'https://api.stacktape.com'
      }));

      // Reimport to get updated config
      const { getStacktapeServiceLambdaEnvironment } = await import('./lambdas');

      const result = getStacktapeServiceLambdaEnvironment({
        projectName: 'my-project',
        stackName: 'my-stack-dev',
        globallyUniqueStackHash: 'abc123'
      });

      const devModeVar = result.find(v => v.name === 'DEV_MODE');
      expect(devModeVar).toBeDefined();
      expect(devModeVar.value).toBe(true);
    });
  });

  describe('getLambdaFunctionEnvironment', () => {
    test('should add NODE_OPTIONS with source maps when no user NODE_OPTIONS', async () => {
      const { getLambdaFunctionEnvironment } = await import('./lambdas');

      const userEnvironment = [
        { name: 'MY_VAR', value: 'myValue' }
      ];

      const result = getLambdaFunctionEnvironment(userEnvironment);

      expect(Array.isArray(result)).toBe(true);

      const myVarVar = result.find(v => v.name === 'MY_VAR');
      expect(myVarVar.value).toBe('myValue');

      const nodeOptionsVar = result.find(v => v.name === 'NODE_OPTIONS');
      expect(nodeOptionsVar).toBeDefined();
      expect(nodeOptionsVar.value).toBe('--enable-source-maps');
    });

    test('should append to existing NODE_OPTIONS', async () => {
      const { getLambdaFunctionEnvironment } = await import('./lambdas');

      const userEnvironment = [
        { name: 'NODE_OPTIONS', value: '--max-old-space-size=4096' }
      ];

      const result = getLambdaFunctionEnvironment(userEnvironment);

      const nodeOptionsVar = result.find(v => v.name === 'NODE_OPTIONS');
      expect(nodeOptionsVar).toBeDefined();
      expect(nodeOptionsVar.value).toBe('--max-old-space-size=4096,--enable-source-maps');
    });

    test('should handle empty environment', async () => {
      const { getLambdaFunctionEnvironment } = await import('./lambdas');

      const result = getLambdaFunctionEnvironment([]);

      expect(Array.isArray(result)).toBe(true);

      const nodeOptionsVar = result.find(v => v.name === 'NODE_OPTIONS');
      expect(nodeOptionsVar).toBeDefined();
      expect(nodeOptionsVar.value).toBe('--enable-source-maps');
    });

    test('should handle undefined environment', async () => {
      const { getLambdaFunctionEnvironment } = await import('./lambdas');

      const result = getLambdaFunctionEnvironment();

      expect(Array.isArray(result)).toBe(true);

      const nodeOptionsVar = result.find(v => v.name === 'NODE_OPTIONS');
      expect(nodeOptionsVar).toBeDefined();
      expect(nodeOptionsVar.value).toBe('--enable-source-maps');
    });

    test('should preserve all user environment variables', async () => {
      const { getLambdaFunctionEnvironment } = await import('./lambdas');

      const userEnvironment = [
        { name: 'VAR1', value: 'value1' },
        { name: 'VAR2', value: 'value2' },
        { name: 'VAR3', value: 'value3' }
      ];

      const result = getLambdaFunctionEnvironment(userEnvironment);

      expect(result.some(v => v.name === 'VAR1' && v.value === 'value1')).toBe(true);
      expect(result.some(v => v.name === 'VAR2' && v.value === 'value2')).toBe(true);
      expect(result.some(v => v.name === 'VAR3' && v.value === 'value3')).toBe(true);
    });
  });

  describe('getStacktapeServiceLambdaCustomResourceInducedStatements', () => {
    test('should return IAM statements array', async () => {
      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test('should include WAF statements', async () => {
      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const wafStatement = result.find(s => s.Action?.includes('wafv2:CreateWebACL'));
      expect(wafStatement).toBeDefined();
      expect(wafStatement.Effect).toBe('Allow');
    });

    test('should include S3 events statements', async () => {
      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const s3Statement = result.find(s => s.Action?.includes('s3:PutBucketNotification'));
      expect(s3Statement).toBeDefined();
      expect(s3Statement.Effect).toBe('Allow');
    });

    test('should include VPC peering statements when resources require VPC', async () => {
      const { configManager } = await import('../index');
      configManager.allResourcesRequiringVpc = [{ name: 'myService' } as any];

      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const vpcPeeringStatement = result.find(s => s.Action?.includes('ec2:AcceptVpcPeeringConnection'));
      expect(vpcPeeringStatement).toBeDefined();
    });

    test('should include edge function statements', async () => {
      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const iamRoleStatement = result.find(s =>
        s.Action?.includes('iam:CreateRole') &&
        s.Action?.includes('iam:DeleteRole')
      );
      expect(iamRoleStatement).toBeDefined();

      const lambdaStatement = result.find(s =>
        s.Action?.includes('lambda:CreateFunction') &&
        s.Action?.includes('lambda:UpdateFunctionCode')
      );
      expect(lambdaStatement).toBeDefined();
    });

    test('should include deployment bucket access', async () => {
      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const s3Statement = result.find(s =>
        s.Action?.includes('s3:GetObject') &&
        s.Action?.includes('s3:PutObject') &&
        s.Resource?.some((r: string) => r.includes('stacktape-deployment'))
      );
      expect(s3Statement).toBeDefined();
    });

    test('should include SSM parameter statements', async () => {
      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const ssmStatement = result.find(s => s.Action?.includes('ssm:PutParameter'));
      expect(ssmStatement).toBeDefined();
      expect(ssmStatement.Action).toContain('ssm:DeleteParameter');
      expect(ssmStatement.Action).toContain('ssm:GetParameters');
    });

    test('should include database deletion protection statements when databases exist', async () => {
      const { configManager } = await import('../index');
      configManager.allAuroraDatabases = [
        { name: 'myAuroraDB', engine: { type: 'aurora-mysql' } } as any
      ];

      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const rdsStatement = result.find(s => s.Action?.includes('rds:ModifyDBCluster'));
      expect(rdsStatement).toBeDefined();
    });

    test('should include script function invocation when deployment scripts exist', async () => {
      const { configManager } = await import('../index');
      configManager.deploymentScripts = [
        {
          _nestedResources: {
            scriptFunction: { resourceName: 'my-script-function' }
          }
        } as any
      ];

      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const lambdaInvokeStatement = result.find(s =>
        s.Action?.includes('lambda:InvokeFunction') &&
        s.Resource?.some((r: string) => r.includes('my-script-function'))
      );
      expect(lambdaInvokeStatement).toBeDefined();
    });

    test('should include CloudFormation describe stacks permission', async () => {
      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const cfStatement = result.find(s => s.Action?.includes('cloudformation:DescribeStacks'));
      expect(cfStatement).toBeDefined();
      expect(cfStatement.Effect).toBe('Allow');
    });

    test('should include ASG force delete statements', async () => {
      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const asgStatement = result.find(s => s.Action?.includes('autoscaling:SetInstanceProtection'));
      expect(asgStatement).toBeDefined();
      expect(asgStatement.Condition).toBeDefined();
    });

    test('should include ECS managed termination protection statements', async () => {
      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const ecsStatement = result.find(s => s.Action?.includes('ecs:UpdateCapacityProvider'));
      expect(ecsStatement).toBeDefined();
      expect(ecsStatement.Condition).toBeDefined();
    });

    test('should include ACM certificate statements', async () => {
      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const acmStatement = result.find(s => s.Action?.includes('acm:RequestCertificate'));
      expect(acmStatement).toBeDefined();
      expect(acmStatement.Action).toContain('acm:DescribeCertificate');
    });

    test('should include Cognito user pool statements', async () => {
      const { getStacktapeServiceLambdaCustomResourceInducedStatements } = await import('./lambdas');

      const result = getStacktapeServiceLambdaCustomResourceInducedStatements();

      const cognitoStatement = result.find(s => s.Action?.includes('cognito-idp:DescribeUserPoolClient'));
      expect(cognitoStatement).toBeDefined();
    });
  });
});
