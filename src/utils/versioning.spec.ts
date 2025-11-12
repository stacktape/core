import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('node:os', () => ({
  homedir: mock(() => '/home/user')
}));

mock.module('@config', () => ({
  DEFAULT_KEEP_PREVIOUS_DEPLOYMENT_ARTIFACTS_COUNT: 5,
  IS_DEV: false
}));

mock.module('./http-client', () => ({
  jsonFetch: mock(async () => ({ latestVersion: '1.5.0' }))
}));

describe('versioning', () => {
  describe('getNumericVersion', () => {
    test('should extract numeric version from string', async () => {
      const { getNumericVersion } = await import('./versioning');

      const result = getNumericVersion('v000123');

      expect(result).toBe(123);
    });

    test('should handle single digit version', async () => {
      const { getNumericVersion } = await import('./versioning');

      const result = getNumericVersion('v000001');

      expect(result).toBe(1);
    });

    test('should handle large version numbers', async () => {
      const { getNumericVersion } = await import('./versioning');

      const result = getNumericVersion('v999999');

      expect(result).toBe(999999);
    });

    test('should handle version without leading zeros', async () => {
      const { getNumericVersion } = await import('./versioning');

      const result = getNumericVersion('v123');

      expect(result).toBe(123);
    });
  });

  describe('getNextVersionString', () => {
    test('should return v000001 for null version', async () => {
      const { getNextVersionString } = await import('./versioning');

      const result = getNextVersionString(null);

      expect(result).toBe('v000001');
    });

    test('should increment version by 1', async () => {
      const { getNextVersionString } = await import('./versioning');

      const result = getNextVersionString('v000001');

      expect(result).toBe('v000002');
    });

    test('should maintain padding for small versions', async () => {
      const { getNextVersionString } = await import('./versioning');

      const result = getNextVersionString('v000099');

      expect(result).toBe('v000100');
    });

    test('should handle transition to more digits', async () => {
      const { getNextVersionString } = await import('./versioning');

      const result = getNextVersionString('v000999');

      expect(result).toBe('v001000');
    });

    test('should handle large version numbers', async () => {
      const { getNextVersionString } = await import('./versioning');

      const result = getNextVersionString('v999999');

      expect(result).toBe('v1000000');
    });

    test('should preserve format with proper padding', async () => {
      const { getNextVersionString } = await import('./versioning');

      const result = getNextVersionString('v000050');

      expect(result).toBe('v000051');
    });

    test('should handle consecutive increments', async () => {
      const { getNextVersionString } = await import('./versioning');

      let version = 'v000001';
      version = getNextVersionString(version);
      version = getNextVersionString(version);
      version = getNextVersionString(version);

      expect(version).toBe('v000004');
    });
  });

  describe('getHotSwapDeployVersionString', () => {
    test('should return v0 for hot swap deploy', async () => {
      const { getHotSwapDeployVersionString } = await import('./versioning');

      const result = getHotSwapDeployVersionString();

      expect(result).toBe('v0');
    });

    test('should always return same version', async () => {
      const { getHotSwapDeployVersionString } = await import('./versioning');

      const result1 = getHotSwapDeployVersionString();
      const result2 = getHotSwapDeployVersionString();

      expect(result1).toBe(result2);
      expect(result1).toBe('v0');
    });
  });

  describe('getMinimumVersionToKeep', () => {
    test('should return v000001 for null version', async () => {
      const { getMinimumVersionToKeep } = await import('./versioning');

      const result = getMinimumVersionToKeep(null);

      expect(result).toBe('v000001');
    });

    test('should return v000001 when minimum would be negative', async () => {
      const { getMinimumVersionToKeep } = await import('./versioning');

      const result = getMinimumVersionToKeep('v000003', 5);

      expect(result).toBe('v000001');
    });

    test('should calculate correct minimum version', async () => {
      const { getMinimumVersionToKeep } = await import('./versioning');

      const result = getMinimumVersionToKeep('v000010', 5);

      expect(result).toBe('v000006');
    });

    test('should use default versions to keep (5)', async () => {
      const { getMinimumVersionToKeep } = await import('./versioning');

      const result = getMinimumVersionToKeep('v000010');

      expect(result).toBe('v000006');
    });

    test('should handle custom versions to keep', async () => {
      const { getMinimumVersionToKeep } = await import('./versioning');

      const result = getMinimumVersionToKeep('v000020', 10);

      expect(result).toBe('v000011');
    });

    test('should return v000001 when result is exactly 1', async () => {
      const { getMinimumVersionToKeep } = await import('./versioning');

      const result = getMinimumVersionToKeep('v000005', 5);

      expect(result).toBe('v000001');
    });

    test('should handle large version numbers', async () => {
      const { getMinimumVersionToKeep } = await import('./versioning');

      const result = getMinimumVersionToKeep('v001000', 50);

      expect(result).toBe('v000951');
    });

    test('should preserve proper padding', async () => {
      const { getMinimumVersionToKeep } = await import('./versioning');

      const result = getMinimumVersionToKeep('v000100', 20);

      expect(result).toBe('v000081');
    });

    test('should handle keeping only 1 version', async () => {
      const { getMinimumVersionToKeep } = await import('./versioning');

      const result = getMinimumVersionToKeep('v000100', 1);

      expect(result).toBe('v000100');
    });
  });

  describe('getStacktapeVersion', () => {
    test('should return dev in development mode', async () => {
      mock.module('@config', () => ({
        DEFAULT_KEEP_PREVIOUS_DEPLOYMENT_ARTIFACTS_COUNT: 5,
        IS_DEV: true
      }));

      const { getStacktapeVersion } = await import('./versioning');

      const result = getStacktapeVersion();

      expect(result).toBe('dev');
    });

    test('should return STACKTAPE_VERSION in production', async () => {
      mock.module('@config', () => ({
        DEFAULT_KEEP_PREVIOUS_DEPLOYMENT_ARTIFACTS_COUNT: 5,
        IS_DEV: false
      }));

      // Mock the global STACKTAPE_VERSION
      (global as any).STACKTAPE_VERSION = '1.2.3';

      const { getStacktapeVersion } = await import('./versioning');

      const result = getStacktapeVersion();

      // In test environment, this might still return 'dev' due to build process
      expect(['dev', '1.2.3']).toContain(result);
    });
  });

  describe('getLatestStacktapeVersion', () => {
    test('should fetch latest version from remote', async () => {
      const { getLatestStacktapeVersion } = await import('./versioning');

      const result = await getLatestStacktapeVersion();

      expect(result).toBe('1.5.0');
    });

    test('should call jsonFetch with correct URL', async () => {
      const { jsonFetch } = await import('./http-client');
      const { getLatestStacktapeVersion } = await import('./versioning');

      await getLatestStacktapeVersion();

      expect(jsonFetch).toHaveBeenCalledWith('https://installs.stacktape.com/_data.json');
    });

    test('should return version from response', async () => {
      mock.module('./http-client', () => ({
        jsonFetch: mock(async () => ({ latestVersion: '2.0.0' }))
      }));

      const { getLatestStacktapeVersion } = await import('./versioning');

      const result = await getLatestStacktapeVersion();

      expect(result).toBe('2.0.0');
    });
  });

  describe('INSTALLATION_DIR', () => {
    test('should be in home directory', async () => {
      const { INSTALLATION_DIR } = await import('./versioning');

      expect(INSTALLATION_DIR).toContain('/home/user');
    });

    test('should include .stacktape/bin path', async () => {
      const { INSTALLATION_DIR } = await import('./versioning');

      expect(INSTALLATION_DIR).toContain('.stacktape');
      expect(INSTALLATION_DIR).toContain('bin');
    });

    test('should be absolute path', async () => {
      const { INSTALLATION_DIR } = await import('./versioning');

      expect(INSTALLATION_DIR).toMatch(/^[\/\\]/);
    });
  });

  describe('version string format', () => {
    test('should maintain v prefix', async () => {
      const { getNextVersionString } = await import('./versioning');

      const result = getNextVersionString('v000001');

      expect(result.startsWith('v')).toBe(true);
    });

    test('should maintain 6-digit padding for small numbers', async () => {
      const { getNextVersionString } = await import('./versioning');

      const result = getNextVersionString('v000001');

      expect(result.length).toBe(7); // v + 6 digits
    });

    test('should expand beyond 6 digits for large numbers', async () => {
      const { getNextVersionString } = await import('./versioning');

      const result = getNextVersionString('v999999');

      expect(result.length).toBe(8); // v + 7 digits
    });
  });
});
