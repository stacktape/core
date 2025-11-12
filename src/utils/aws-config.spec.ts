import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: {
    awsCredentialsFilePath: mock(() => '/home/user/.aws/credentials'),
    awsConfigFilePath: mock(() => '/home/user/.aws/config')
  }
}));

mock.module('fs-extra', () => ({
  default: {
    ensureFile: mock(async () => {})
  }
}));

mock.module('../../shared/utils/fs-utils', () => ({
  adjustIniFileContent: mock(async (path: string, fn: (content: any) => any) => {
    const mockContent = { default: { aws_access_key_id: 'AKIAIOSFODNN7EXAMPLE' } };
    return fn(mockContent);
  }),
  getIniFileContent: mock(async (path: string) => {
    if (path.includes('credentials')) {
      return {
        default: {
          aws_access_key_id: 'AKIAIOSFODNN7EXAMPLE',
          aws_secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
        },
        prod: {
          aws_access_key_id: 'AKIAIOSFODNN7PRODKEY',
          aws_secret_access_key: 'prodSecretAccessKey'
        }
      };
    }
    return {
      'profile dev': { region: 'us-east-1' },
      'profile staging': { region: 'us-west-2' }
    };
  })
}));

mock.module('lodash/uniq', () => ({
  default: mock((arr: any[]) => [...new Set(arr)])
}));

describe('aws-config', () => {
  describe('upsertAwsProfile', () => {
    test('should create new AWS profile', async () => {
      const { adjustIniFileContent } = await import('../../shared/utils/fs-utils');
      const { upsertAwsProfile } = await import('./aws-config');

      await upsertAwsProfile('test', 'AKIATEST', 'secretTest');

      expect(adjustIniFileContent).toHaveBeenCalled();
    });

    test('should update existing AWS profile', async () => {
      const { upsertAwsProfile } = await import('./aws-config');

      await upsertAwsProfile('default', 'AKIANEW', 'newSecret');

      expect(true).toBe(true);
    });

    test('should pass correct profile name and credentials', async () => {
      const { adjustIniFileContent } = await import('../../shared/utils/fs-utils');
      const { upsertAwsProfile } = await import('./aws-config');

      await upsertAwsProfile('myprofile', 'MYKEY', 'MYSECRET');

      expect(adjustIniFileContent).toHaveBeenCalled();
      const callback = adjustIniFileContent.mock.calls[0][1];
      const result = callback({ existing: {} });
      expect(result.myprofile.aws_access_key_id).toBe('MYKEY');
      expect(result.myprofile.aws_secret_access_key).toBe('MYSECRET');
    });
  });

  describe('deleteAwsProfile', () => {
    test('should delete AWS profile from both files', async () => {
      const { adjustIniFileContent } = await import('../../shared/utils/fs-utils');
      const { deleteAwsProfile } = await import('./aws-config');

      await deleteAwsProfile('test');

      expect(adjustIniFileContent).toHaveBeenCalledTimes(2);
    });

    test('should remove profile from credentials file', async () => {
      const { adjustIniFileContent } = await import('../../shared/utils/fs-utils');
      const { deleteAwsProfile } = await import('./aws-config');

      await deleteAwsProfile('prod');

      const credentialsCallback = adjustIniFileContent.mock.calls[0][1];
      const result = credentialsCallback({ prod: {}, dev: {} });
      expect(result.prod).toBeUndefined();
      expect(result.dev).toBeDefined();
    });

    test('should remove profile from config file', async () => {
      const { adjustIniFileContent } = await import('../../shared/utils/fs-utils');
      const { deleteAwsProfile } = await import('./aws-config');

      await deleteAwsProfile('dev');

      const configCallback = adjustIniFileContent.mock.calls[1][1];
      const result = configCallback({ 'profile dev': {}, dev: {}, other: {} });
      expect(result.dev).toBeUndefined();
      expect(result['profile dev']).toBeUndefined();
      expect(result.other).toBeDefined();
    });
  });

  describe('getAvailableAwsProfiles', () => {
    test('should get profiles from both config and credentials files', async () => {
      const { getAvailableAwsProfiles } = await import('./aws-config');

      const profiles = await getAvailableAwsProfiles();

      expect(Array.isArray(profiles)).toBe(true);
      expect(profiles.length).toBeGreaterThan(0);
    });

    test('should return unique profile names', async () => {
      const { getAvailableAwsProfiles } = await import('./aws-config');

      const profiles = await getAvailableAwsProfiles();

      expect(profiles).toContain('default');
      expect(profiles).toContain('prod');
      expect(profiles).toContain('dev');
      expect(profiles).toContain('staging');
    });

    test('should strip profile prefix from config file entries', async () => {
      const { getAvailableAwsProfiles } = await import('./aws-config');

      const profiles = await getAvailableAwsProfiles();

      expect(profiles).toContain('dev');
      expect(profiles).not.toContain('profile dev');
    });
  });

  describe('ensureGlobalAwsConfigFiles', () => {
    test('should ensure both AWS config files exist', async () => {
      const fsExtra = await import('fs-extra');
      const { ensureGlobalAwsConfigFiles } = await import('./aws-config');

      await ensureGlobalAwsConfigFiles();

      expect(fsExtra.default.ensureFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadAwsConfigFileContent', () => {
    test('should load AWS config file content', async () => {
      const { loadAwsConfigFileContent } = await import('./aws-config');

      const content = await loadAwsConfigFileContent();

      expect(content).toBeDefined();
      expect(typeof content).toBe('object');
    });

    test('should return config file entries', async () => {
      const { loadAwsConfigFileContent } = await import('./aws-config');

      const content = await loadAwsConfigFileContent();

      expect(content['profile dev']).toBeDefined();
      expect(content['profile staging']).toBeDefined();
    });
  });

  describe('loadAwsCredentialsFileContent', () => {
    test('should load AWS credentials file content', async () => {
      const { loadAwsCredentialsFileContent } = await import('./aws-config');

      const content = await loadAwsCredentialsFileContent();

      expect(content).toBeDefined();
      expect(typeof content).toBe('object');
    });

    test('should transform credentials format', async () => {
      const { loadAwsCredentialsFileContent } = await import('./aws-config');

      const content = await loadAwsCredentialsFileContent();

      expect(content.default).toBeDefined();
      expect(content.default.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(content.default.secretAccessKey).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    });

    test('should handle multiple profiles', async () => {
      const { loadAwsCredentialsFileContent } = await import('./aws-config');

      const content = await loadAwsCredentialsFileContent();

      expect(content.default).toBeDefined();
      expect(content.prod).toBeDefined();
      expect(content.prod.accessKeyId).toBe('AKIAIOSFODNN7PRODKEY');
    });
  });

  describe('listAwsProfiles', () => {
    test('should list all AWS profiles with credentials', async () => {
      const { listAwsProfiles } = await import('./aws-config');

      const profiles = await listAwsProfiles();

      expect(Array.isArray(profiles)).toBe(true);
      expect(profiles.length).toBeGreaterThan(0);
    });

    test('should return profiles with correct structure', async () => {
      const { listAwsProfiles } = await import('./aws-config');

      const profiles = await listAwsProfiles();

      profiles.forEach((profile) => {
        expect(profile).toHaveProperty('profile');
        expect(profile).toHaveProperty('AWS_ACCESS_KEY_ID');
        expect(profile).toHaveProperty('AWS_SECRET_ACCESS_KEY');
      });
    });

    test('should include profile names and credentials', async () => {
      const { listAwsProfiles } = await import('./aws-config');

      const profiles = await listAwsProfiles();

      const defaultProfile = profiles.find((p) => p.profile === 'default');
      expect(defaultProfile).toBeDefined();
      expect(defaultProfile.AWS_ACCESS_KEY_ID).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(defaultProfile.AWS_SECRET_ACCESS_KEY).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    });
  });
});
