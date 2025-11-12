import { describe, expect, mock, test } from 'bun:test';

// Mock constants
mock.module('@shared/utils/constants', () => ({
  CF_ESCAPED_DYNAMIC_REFERENCE_START: '<<<STP_ESCAPED_START>>>',
  CF_ESCAPED_DYNAMIC_REFERENCE_END: '<<<STP_ESCAPED_END>>>'
}));

// Mock global state manager
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    logLevel: 'info'
  }
}));

// Mock AWS SDK manager
mock.module('@utils/aws-sdk-manager', () => ({
  awsSdkManager: {
    getSsmParameterValue: mock(async ({ ssmParameterName }) => {
      if (ssmParameterName === '/test/param') {
        return { Parameter: { Value: 'test-value' } };
      }
      if (ssmParameterName === '/nested/param') {
        return { Parameter: { Value: 'nested-value' } };
      }
      throw new Error('Parameter not found');
    }),
    getSecretValue: mock(async ({ secretId, jsonKey }) => {
      if (secretId === 'my-secret') {
        if (jsonKey) {
          return { SecretString: JSON.stringify({ password: 'secret-pass', apiKey: 'api-123' }) };
        }
        return { SecretString: 'plain-secret-value' };
      }
      throw new Error('Secret not found');
    })
  }
}));

// Mock printer
mock.module('@utils/printer', () => ({
  printer: {
    debug: mock((msg) => {})
  }
}));

describe('stack-info-map-sensitive-values', () => {
  describe('escapeCloudformationSecretDynamicReference', () => {
    test('should escape SSM secure parameter reference', async () => {
      const { escapeCloudformationSecretDynamicReference } = await import('./stack-info-map-sensitive-values');

      const result = escapeCloudformationSecretDynamicReference('{{resolve:ssm-secure:/my/param}}');

      expect(result).toBe('<<<STP_ESCAPED_START>>>resolve:ssm-secure:/my/param<<<STP_ESCAPED_END>>>');
    });

    test('should escape Secrets Manager reference', async () => {
      const { escapeCloudformationSecretDynamicReference } = await import('./stack-info-map-sensitive-values');

      const result = escapeCloudformationSecretDynamicReference('{{resolve:secretsmanager:my-secret}}');

      expect(result).toBe('<<<STP_ESCAPED_START>>>resolve:secretsmanager:my-secret<<<STP_ESCAPED_END>>>');
    });

    test('should not escape regular strings', async () => {
      const { escapeCloudformationSecretDynamicReference } = await import('./stack-info-map-sensitive-values');

      const result = escapeCloudformationSecretDynamicReference('regular-string');

      expect(result).toBe('regular-string');
    });

    test('should not escape strings without proper ending', async () => {
      const { escapeCloudformationSecretDynamicReference } = await import('./stack-info-map-sensitive-values');

      const result = escapeCloudformationSecretDynamicReference('{{resolve:ssm-secure:/my/param');

      expect(result).toBe('{{resolve:ssm-secure:/my/param');
    });

    test('should not escape strings without proper start', async () => {
      const { escapeCloudformationSecretDynamicReference } = await import('./stack-info-map-sensitive-values');

      const result = escapeCloudformationSecretDynamicReference('resolve:ssm-secure:/my/param}}');

      expect(result).toBe('resolve:ssm-secure:/my/param}}');
    });

    test('should handle non-string values', async () => {
      const { escapeCloudformationSecretDynamicReference } = await import('./stack-info-map-sensitive-values');

      expect(escapeCloudformationSecretDynamicReference(123)).toBe(123);
      expect(escapeCloudformationSecretDynamicReference(null)).toBe(null);
      expect(escapeCloudformationSecretDynamicReference(undefined)).toBe(undefined);
    });

    test('should escape complex SSM reference', async () => {
      const { escapeCloudformationSecretDynamicReference } = await import('./stack-info-map-sensitive-values');

      const result = escapeCloudformationSecretDynamicReference('{{resolve:ssm-secure:/prod/db/password:1}}');

      expect(result).toBe('<<<STP_ESCAPED_START>>>resolve:ssm-secure:/prod/db/password:1<<<STP_ESCAPED_END>>>');
    });

    test('should escape Secrets Manager reference with JSON key', async () => {
      const { escapeCloudformationSecretDynamicReference } = await import('./stack-info-map-sensitive-values');

      const result = escapeCloudformationSecretDynamicReference('{{resolve:secretsmanager:my-secret:SecretString:password}}');

      expect(result).toBe('<<<STP_ESCAPED_START>>>resolve:secretsmanager:my-secret:SecretString:password<<<STP_ESCAPED_END>>>');
    });
  });

  describe('locallyResolveSensitiveValue', () => {
    test('should resolve SSM parameter value', async () => {
      const { locallyResolveSensitiveValue } = await import('./stack-info-map-sensitive-values');

      const result = await locallyResolveSensitiveValue({ ssmParameterName: '/test/param' });

      expect(result).toBe('test-value');
    });

    test('should resolve SSM parameter with nested secret reference', async () => {
      const { awsSdkManager } = await import('@utils/aws-sdk-manager');
      const { locallyResolveSensitiveValue } = await import('./stack-info-map-sensitive-values');

      awsSdkManager.getSsmParameterValue.mockImplementationOnce(async () => ({
        Parameter: { Value: 'prefix-<<<STP_ESCAPED_START>>>resolve:ssm-secure:/nested/param<<<STP_ESCAPED_END>>>-suffix' }
      }));

      const result = await locallyResolveSensitiveValue({ ssmParameterName: '/test/param' });

      expect(result).toBe('prefix-nested-value-suffix');
    });

    test('should resolve SSM parameter with nested Secrets Manager reference', async () => {
      const { awsSdkManager } = await import('@utils/aws-sdk-manager');
      const { locallyResolveSensitiveValue } = await import('./stack-info-map-sensitive-values');

      awsSdkManager.getSsmParameterValue.mockImplementationOnce(async () => ({
        Parameter: { Value: '<<<STP_ESCAPED_START>>>resolve:secretsmanager:my-secret<<<STP_ESCAPED_END>>>' }
      }));

      const result = await locallyResolveSensitiveValue({ ssmParameterName: '/test/param' });

      expect(result).toBe('plain-secret-value');
    });

    test('should resolve SSM parameter with Secrets Manager JSON key reference', async () => {
      const { awsSdkManager } = await import('@utils/aws-sdk-manager');
      const { locallyResolveSensitiveValue } = await import('./stack-info-map-sensitive-values');

      awsSdkManager.getSsmParameterValue.mockImplementationOnce(async () => ({
        Parameter: { Value: '<<<STP_ESCAPED_START>>>resolve:secretsmanager:my-secret:SecretString:password<<<STP_ESCAPED_END>>>' }
      }));

      const result = await locallyResolveSensitiveValue({ ssmParameterName: '/test/param' });

      expect(result).toBe('secret-pass');
    });

    test('should handle SSM parameter not found', async () => {
      const { locallyResolveSensitiveValue } = await import('./stack-info-map-sensitive-values');

      const result = await locallyResolveSensitiveValue({ ssmParameterName: '/non/existent' });

      expect(result).toBe('<<UNABLE_TO_RESOLVE>>');
    });

    test('should handle multiple nested references', async () => {
      const { awsSdkManager } = await import('@utils/aws-sdk-manager');
      const { locallyResolveSensitiveValue } = await import('./stack-info-map-sensitive-values');

      awsSdkManager.getSsmParameterValue.mockImplementationOnce(async () => ({
        Parameter: {
          Value: '<<<STP_ESCAPED_START>>>resolve:ssm-secure:/nested/param<<<STP_ESCAPED_END>>>:<<<STP_ESCAPED_START>>>resolve:secretsmanager:my-secret<<<STP_ESCAPED_END>>>'
        }
      }));

      const result = await locallyResolveSensitiveValue({ ssmParameterName: '/test/param' });

      expect(result).toBe('nested-value:plain-secret-value');
    });

    test('should call getSsmParameterValue', async () => {
      const { awsSdkManager } = await import('@utils/aws-sdk-manager');
      const { locallyResolveSensitiveValue } = await import('./stack-info-map-sensitive-values');

      await locallyResolveSensitiveValue({ ssmParameterName: '/test/param' });

      expect(awsSdkManager.getSsmParameterValue).toHaveBeenCalledWith({
        ssmParameterName: '/test/param'
      });
    });

    test('should handle secret resolution failure', async () => {
      const { awsSdkManager } = await import('@utils/aws-sdk-manager');
      const { locallyResolveSensitiveValue } = await import('./stack-info-map-sensitive-values');

      awsSdkManager.getSsmParameterValue.mockImplementationOnce(async () => ({
        Parameter: { Value: '<<<STP_ESCAPED_START>>>resolve:secretsmanager:non-existent<<<STP_ESCAPED_END>>>' }
      }));

      const result = await locallyResolveSensitiveValue({ ssmParameterName: '/test/param' });

      expect(result).toBe('<<UNABLE_TO_RESOLVE>>');
    });

    test('should debug log when parameter not found', async () => {
      const { globalStateManager } = await import('@application-services/global-state-manager');
      const { printer } = await import('@utils/printer');
      const { locallyResolveSensitiveValue } = await import('./stack-info-map-sensitive-values');

      globalStateManager.logLevel = 'debug';

      await locallyResolveSensitiveValue({ ssmParameterName: '/non/existent' });

      expect(printer.debug).toHaveBeenCalled();
    });

    test('should not debug log when log level is not debug', async () => {
      const { globalStateManager } = await import('@application-services/global-state-manager');
      const { printer } = await import('@utils/printer');
      const { locallyResolveSensitiveValue } = await import('./stack-info-map-sensitive-values');

      globalStateManager.logLevel = 'info';
      printer.debug.mockClear();

      await locallyResolveSensitiveValue({ ssmParameterName: '/non/existent' });

      expect(printer.debug).not.toHaveBeenCalled();
    });

    test('should resolve Secrets Manager with version ID', async () => {
      const { awsSdkManager } = await import('@utils/aws-sdk-manager');
      const { locallyResolveSensitiveValue } = await import('./stack-info-map-sensitive-values');

      awsSdkManager.getSsmParameterValue.mockImplementationOnce(async () => ({
        Parameter: { Value: '<<<STP_ESCAPED_START>>>resolve:secretsmanager:my-secret:SecretString::version-123<<<STP_ESCAPED_END>>>' }
      }));

      await locallyResolveSensitiveValue({ ssmParameterName: '/test/param' });

      expect(awsSdkManager.getSecretValue).toHaveBeenCalledWith({
        secretId: 'my-secret',
        jsonKey: undefined,
        versionStage: undefined,
        versionId: 'version-123'
      });
    });

    test('should resolve Secrets Manager with version stage', async () => {
      const { awsSdkManager } = await import('@utils/aws-sdk-manager');
      const { locallyResolveSensitiveValue } = await import('./stack-info-map-sensitive-values');

      awsSdkManager.getSsmParameterValue.mockImplementationOnce(async () => ({
        Parameter: { Value: '<<<STP_ESCAPED_START>>>resolve:secretsmanager:my-secret:SecretString::AWSCURRENT:<<<STP_ESCAPED_END>>>' }
      }));

      await locallyResolveSensitiveValue({ ssmParameterName: '/test/param' });

      expect(awsSdkManager.getSecretValue).toHaveBeenCalledWith({
        secretId: 'my-secret',
        jsonKey: undefined,
        versionStage: 'AWSCURRENT',
        versionId: undefined
      });
    });
  });
});
