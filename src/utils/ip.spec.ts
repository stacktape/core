import { describe, expect, mock, test } from 'bun:test';

// Mock http-client
mock.module('./http-client', () => ({
  jsonFetch: mock(async (url: string) => {
    if (url === 'https://api.ipify.org?format=json') {
      return { ip: '203.0.113.42' };
    }
    throw new Error('Network error');
  })
}));

describe('ip', () => {
  describe('getIpAddress', () => {
    test('should fetch IP address from ipify API', async () => {
      const { getIpAddress } = await import('./ip');
      const ip = await getIpAddress();
      expect(ip).toBe('203.0.113.42');
    });

    test('should return string IP address', async () => {
      const { getIpAddress } = await import('./ip');
      const ip = await getIpAddress();
      expect(typeof ip).toBe('string');
    });

    test('should return valid IP format', async () => {
      const { getIpAddress } = await import('./ip');
      const ip = await getIpAddress();
      const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
      expect(ipRegex.test(ip)).toBe(true);
    });

    test('should call jsonFetch with correct URL', async () => {
      const { jsonFetch } = await import('./http-client');
      const { getIpAddress } = await import('./ip');

      await getIpAddress();

      expect(jsonFetch).toHaveBeenCalledWith('https://api.ipify.org?format=json');
    });

    test('should handle different IP addresses', async () => {
      // Re-mock with different IP
      mock.module('./http-client', () => ({
        jsonFetch: mock(async () => ({ ip: '192.168.1.1' }))
      }));

      const { getIpAddress } = await import('./ip');
      const ip = await getIpAddress();
      expect(ip).toBe('192.168.1.1');
    });
  });
});
