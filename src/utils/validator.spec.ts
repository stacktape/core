import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    command: 'deploy',
    invokedFrom: 'cli',
    maxAllowedResources: 100,
    targetStack: { stage: 'dev' }
  }
}));

mock.module('@config', () => ({
  SUPPORTED_AWS_REGIONS: ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1']
}));

mock.module('@errors', () => ({
  stpErrors: {
    e14: mock(() => new Error('Config not found')),
    e15: mock(() => new Error('Multiple configs found')),
    e68: mock(() => new Error('Account not active')),
    e69: mock(() => new Error('Credentials mismatch'))
  }
}));

mock.module('@shared/utils/misc', () => ({
  getError: mock(({ type, message, hint }) => {
    const err = new Error(message);
    (err as any).type = type;
    (err as any).hint = hint;
    return err;
  }),
  isAlphanumeric: mock((str) => /^[a-zA-Z0-9]+$/.test(str)),
  isSmallAlphanumericDashCase: mock((str) => /^[a-z0-9-]+$/.test(str))
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
  }
}));

mock.module('@utils/pretty-json', () => ({
  renderPrettyJson: mock((obj) => JSON.stringify(obj, null, 2))
}));

mock.module('change-case', () => ({
  camelCase: mock((str) => str.replace(/[-:]/g, ''))
}));

mock.module('../../@generated/schemas/cli-schema.json', () => ({
  default: {
    deploy: {
      args: {
        stage: { allowedTypes: ['string'], required: true },
        region: { allowedTypes: ['string'], required: true },
        verbose: { allowedTypes: ['boolean'], required: false }
      }
    }
  }
}));

mock.module('../../@generated/schemas/sdk-schema.json', () => ({
  default: {
    deploy: {
      args: {
        stage: { allowedTypes: ['string'], required: true }
      }
    }
  }
}));

mock.module('../config/cli', () => ({
  allowedCliArgs: {
    deploy: ['--stage', '--region', '--verbose'],
    delete: ['--stage', '--region']
  },
  cliArgsAliases: {
    s: 'stage',
    r: 'region',
    v: 'verbose'
  },
  cliCommands: ['deploy', 'delete', 'stack:info', 'help']
}));

mock.module('./aws-sdk-manager/utils', () => ({
  getAwsCredentialsIdentity: mock(async () => ({
    Account: '123456789012',
    Arn: 'arn:aws:iam::123456789012:user/test'
  }))
}));

mock.module('./printer', () => ({
  printer: {
    makeBold: mock((text) => text),
    prettyConfigProperty: mock((text) => text),
    prettyCommand: mock((text) => text),
    prettyOption: mock((text) => text),
    terminalLink: mock((url, text) => text),
    getLink: mock((key, text) => text),
    warn: mock(() => {}),
    hint: mock(() => {})
  }
}));

mock.module('./validation-utils', () => ({
  getCommandShortDescription: mock((cmd) => `Description for ${cmd}`),
  getPrettyCommand: mock((cmd) => cmd)
}));

describe('validator', () => {
  describe('validateDomain', () => {
    test('should validate valid domain', async () => {
      const { validateDomain } = await import('./validator');
      expect(() => validateDomain('example.com')).not.toThrow();
      expect(() => validateDomain('subdomain.example.com')).not.toThrow();
      expect(() => validateDomain('api.v2.example.io')).not.toThrow();
    });

    test('should throw for invalid domain', async () => {
      const { validateDomain } = await import('./validator');
      expect(() => validateDomain('invalid domain')).toThrow();
      expect(() => validateDomain('example')).toThrow();
      expect(() => validateDomain('.example.com')).toThrow();
    });
  });

  describe('validateUniqueness', () => {
    test('should not throw for unique resources', async () => {
      const { validateUniqueness } = await import('./validator');
      const resources = {
        Bucket1: { Type: 'AWS::S3::Bucket' }
      };
      expect(() => validateUniqueness('Bucket2', 'AWS::S3::Bucket', resources as any)).not.toThrow();
    });

    test('should throw for duplicate logical names', async () => {
      const { validateUniqueness } = await import('./validator');
      const resources = {
        MyBucket: { Type: 'AWS::S3::Bucket' }
      };
      expect(() => validateUniqueness('MyBucket', 'AWS::S3::Bucket', resources as any)).toThrow();
    });
  });

  describe('validateStackDrift', () => {
    test('should not throw when no drift', async () => {
      const { validateStackDrift } = await import('./validator');
      expect(() => validateStackDrift([])).not.toThrow();
      expect(() => validateStackDrift(null)).not.toThrow();
    });

    test('should throw when drift detected on deploy', async () => {
      const { validateStackDrift } = await import('./validator');
      const drift = [
        {
          resourceLogicalName: 'MyBucket',
          resourceType: 'AWS::S3::Bucket',
          differences: { BucketName: { old: 'old-name', new: 'new-name' } }
        }
      ];
      expect(() => validateStackDrift(drift as any)).toThrow();
    });
  });

  describe('validateScript', () => {
    test('should validate script with executeCommand', async () => {
      const { validateScript } = await import('./validator');
      const script: any = {
        type: 'deployment-script',
        properties: { executeCommand: 'echo test' },
        scriptName: 'test-script'
      };
      expect(() => validateScript(script)).not.toThrow();
    });

    test('should validate script with executeScript', async () => {
      const { validateScript } = await import('./validator');
      const script: any = {
        type: 'deployment-script',
        properties: { executeScript: 'path/to/script.sh' },
        scriptName: 'test-script'
      };
      expect(() => validateScript(script)).not.toThrow();
    });

    test('should throw when no execute property defined', async () => {
      const { validateScript } = await import('./validator');
      const script: any = {
        type: 'deployment-script',
        properties: {},
        scriptName: 'test-script'
      };
      expect(() => validateScript(script)).toThrow();
    });

    test('should throw when multiple execute properties defined', async () => {
      const { validateScript } = await import('./validator');
      const script: any = {
        type: 'deployment-script',
        properties: {
          executeCommand: 'echo test',
          executeScript: 'script.sh'
        },
        scriptName: 'test-script'
      };
      expect(() => validateScript(script)).toThrow();
    });
  });

  describe('validateCommand', () => {
    test('should validate valid command', async () => {
      const { validateCommand } = await import('./validator');
      expect(() => validateCommand({ rawCommands: ['deploy'] })).not.toThrow();
    });

    test('should throw for invalid command', async () => {
      const { validateCommand } = await import('./validator');
      expect(() => validateCommand({ rawCommands: ['invalid'] })).toThrow();
    });

    test('should throw for multiple commands', async () => {
      const { validateCommand } = await import('./validator');
      expect(() => validateCommand({ rawCommands: ['deploy', 'extra'] })).toThrow();
    });

    test('should throw when no command specified', async () => {
      const { validateCommand } = await import('./validator');
      expect(() => validateCommand({ rawCommands: [] })).toThrow();
    });
  });

  describe('validateProjectName', () => {
    test('should validate valid project name', async () => {
      const { validateProjectName } = await import('./validator');
      expect(() => validateProjectName('my-project')).not.toThrow();
      expect(() => validateProjectName('test123')).not.toThrow();
      expect(() => validateProjectName('my-app-v2')).not.toThrow();
    });

    test('should throw for invalid project name', async () => {
      const { validateProjectName } = await import('./validator');
      expect(() => validateProjectName('MyProject')).toThrow();
      expect(() => validateProjectName('my_project')).toThrow();
      expect(() => validateProjectName('my project')).toThrow();
    });
  });

  describe('validateRegion', () => {
    test('should validate valid region', async () => {
      const { validateRegion } = await import('./validator');
      expect(() => validateRegion('us-east-1')).not.toThrow();
      expect(() => validateRegion('eu-west-1')).not.toThrow();
    });

    test('should throw for invalid region', async () => {
      const { validateRegion } = await import('./validator');
      expect(() => validateRegion('invalid-region')).toThrow();
    });

    test('should throw for null/undefined region', async () => {
      const { validateRegion } = await import('./validator');
      expect(() => validateRegion(null)).toThrow();
      expect(() => validateRegion(undefined)).toThrow();
    });
  });

  describe('validateFormatDirectiveParams', () => {
    test('should validate matching interpolations and values', async () => {
      const { validateFormatDirectiveParams } = await import('./validator');
      expect(() => validateFormatDirectiveParams('Hello {} {}', 'Format', ['World', '!'])).not.toThrow();
    });

    test('should throw for mismatched interpolations', async () => {
      const { validateFormatDirectiveParams } = await import('./validator');
      expect(() => validateFormatDirectiveParams('Hello {}', 'Format', ['World', 'Extra'])).toThrow();
    });

    test('should handle no interpolations', async () => {
      const { validateFormatDirectiveParams } = await import('./validator');
      expect(() => validateFormatDirectiveParams('Hello World', 'Format', [])).not.toThrow();
    });
  });

  describe('validateStackOutput', () => {
    test('should validate new stack output', async () => {
      const { validateStackOutput } = await import('./validator');
      const template: any = { Outputs: {} };
      expect(() => validateStackOutput('MyOutput', template, 'value')).not.toThrow();
    });

    test('should allow duplicate output with same value', async () => {
      const { validateStackOutput } = await import('./validator');
      const template: any = {
        Outputs: {
          MyOutput: { Value: 'value' }
        }
      };
      expect(() => validateStackOutput('MyOutput', template, 'value')).not.toThrow();
    });

    test('should throw for duplicate output with different value', async () => {
      const { validateStackOutput } = await import('./validator');
      const template: any = {
        Outputs: {
          MyOutput: { Value: 'old-value' }
        }
      };
      expect(() => validateStackOutput('MyOutput', template, 'new-value')).toThrow();
    });
  });

  describe('validateStackOutputName', () => {
    test('should validate alphanumeric names', async () => {
      const { validateStackOutputName } = await import('./validator');
      expect(() => validateStackOutputName('MyOutput123')).not.toThrow();
      expect(() => validateStackOutputName('output')).not.toThrow();
    });

    test('should throw for non-alphanumeric names', async () => {
      const { validateStackOutputName } = await import('./validator');
      expect(() => validateStackOutputName('my-output')).toThrow();
      expect(() => validateStackOutputName('my_output')).toThrow();
      expect(() => validateStackOutputName('my.output')).toThrow();
    });
  });

  describe('validateMaxResourcesLimit', () => {
    test('should not throw when under limit', async () => {
      const { validateMaxResourcesLimit } = await import('./validator');
      expect(() => validateMaxResourcesLimit(50)).not.toThrow();
    });

    test('should throw when over limit', async () => {
      const { validateMaxResourcesLimit } = await import('./validator');
      expect(() => validateMaxResourcesLimit(150)).toThrow();
    });

    test('should allow exactly at limit', async () => {
      const { validateMaxResourcesLimit } = await import('./validator');
      expect(() => validateMaxResourcesLimit(100)).not.toThrow();
    });
  });

  describe('validateS3BucketName', () => {
    test('should throw for short names', async () => {
      const { validateS3BucketName } = await import('./validator');
      expect(() => validateS3BucketName('ab')).toThrow();
    });

    test('should throw for long names', async () => {
      const { validateS3BucketName } = await import('./validator');
      const longName = 'a'.repeat(64);
      expect(() => validateS3BucketName(longName)).toThrow();
    });

    test('should throw for uppercase letters', async () => {
      const { validateS3BucketName } = await import('./validator');
      expect(() => validateS3BucketName('MyBucket')).toThrow();
    });

    test('should throw for names starting with non-alphanumeric', async () => {
      const { validateS3BucketName } = await import('./validator');
      expect(() => validateS3BucketName('-mybucket')).toThrow();
      expect(() => validateS3BucketName('.mybucket')).toThrow();
    });

    test('should throw for names ending with non-alphanumeric', async () => {
      const { validateS3BucketName } = await import('./validator');
      expect(() => validateS3BucketName('mybucket-')).toThrow();
      expect(() => validateS3BucketName('mybucket.')).toThrow();
    });

    test('should throw for consecutive periods', async () => {
      const { validateS3BucketName } = await import('./validator');
      expect(() => validateS3BucketName('my..bucket')).toThrow();
    });

    test('should throw for IP address format', async () => {
      const { validateS3BucketName } = await import('./validator');
      expect(() => validateS3BucketName('192.168.1.1')).toThrow();
    });
  });

  describe('validateAwsProfile', () => {
    test('should validate existing profile', async () => {
      const { validateAwsProfile } = await import('./validator');
      const availableProfiles = [{ profile: 'default' }, { profile: 'production' }];
      expect(() => validateAwsProfile({ availableAwsProfiles: availableProfiles as any, profile: 'default' })).not.toThrow();
    });

    test('should throw for non-existent profile', async () => {
      const { validateAwsProfile } = await import('./validator');
      const availableProfiles = [{ profile: 'default' }];
      expect(() => validateAwsProfile({ availableAwsProfiles: availableProfiles as any, profile: 'missing' })).toThrow();
    });
  });

  describe('validateAwsAccountUsability', () => {
    test('should validate active account', async () => {
      const { validateAwsAccountUsability } = await import('./validator');
      const account: any = { state: 'ACTIVE', awsAccountId: '123456789012' };
      const organization: any = { name: 'MyOrg' };
      expect(() => validateAwsAccountUsability({ account, organization })).not.toThrow();
    });

    test('should throw for inactive account', async () => {
      const { validateAwsAccountUsability } = await import('./validator');
      const account: any = { state: 'INACTIVE', awsAccountId: '123456789012' };
      const organization: any = { name: 'MyOrg' };
      expect(() => validateAwsAccountUsability({ account, organization })).toThrow();
    });

    test('should throw for account without ID', async () => {
      const { validateAwsAccountUsability } = await import('./validator');
      const account: any = { state: 'ACTIVE', awsAccountId: null };
      const organization: any = { name: 'MyOrg' };
      expect(() => validateAwsAccountUsability({ account, organization })).toThrow();
    });
  });

  describe('validateCredentialsWithRespectToAccount', () => {
    test('should validate matching credentials', async () => {
      const { validateCredentialsWithRespectToAccount } = await import('./validator');
      const targetAccount: any = { awsAccountId: '123456789012' };
      const credentials: any = { accessKeyId: 'AKIATEST', secretAccessKey: 'secret' };
      const result = await validateCredentialsWithRespectToAccount({
        targetAccount,
        credentials,
        profile: 'default'
      });
      expect(result).toBeDefined();
      expect(result.identity.account).toBe('123456789012');
    });

    test('should throw for mismatched account', async () => {
      mock.module('./aws-sdk-manager/utils', () => ({
        getAwsCredentialsIdentity: mock(async () => ({
          Account: '999999999999',
          Arn: 'arn:aws:iam::999999999999:user/test'
        }))
      }));

      const { validateCredentialsWithRespectToAccount } = await import('./validator');
      const targetAccount: any = { awsAccountId: '123456789012' };
      const credentials: any = { accessKeyId: 'AKIATEST', secretAccessKey: 'secret' };
      await expect(
        validateCredentialsWithRespectToAccount({
          targetAccount,
          credentials
        })
      ).rejects.toThrow();
    });
  });
});
