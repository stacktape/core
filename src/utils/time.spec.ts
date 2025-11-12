import { describe, expect, mock, test } from 'bun:test';

// Mock NtpTimeSync
mock.module('ntp-time-sync', () => {
  const mockInstance = {
    now: mock(async () => new Date('2024-01-01T12:00:00Z'))
  };

  return {
    NtpTimeSync: {
      getInstance: mock(() => mockInstance)
    }
  };
});

// Mock printer
mock.module('./printer', () => ({
  printer: {
    debug: mock(() => {})
  }
}));

describe('time', () => {
  describe('getAwsSynchronizedTime', () => {
    test('should return synchronized time from AWS', async () => {
      const { getAwsSynchronizedTime } = await import('./time');
      const result = await getAwsSynchronizedTime();
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2024-01-01T12:00:00.000Z');
    });

    test('should handle NTP sync errors gracefully', async () => {
      // Re-mock with error
      mock.module('ntp-time-sync', () => {
        const mockInstance = {
          now: mock(async () => {
            throw new Error('NTP server unreachable');
          })
        };

        return {
          NtpTimeSync: {
            getInstance: mock(() => mockInstance)
          }
        };
      });

      const { getAwsSynchronizedTime } = await import('./time');
      const result = await getAwsSynchronizedTime();
      expect(result).toBeInstanceOf(Date);
    });

    test('should fall back to local time on error', async () => {
      // Re-mock with error
      mock.module('ntp-time-sync', () => {
        const mockInstance = {
          now: mock(async () => {
            throw new Error('Network error');
          })
        };

        return {
          NtpTimeSync: {
            getInstance: mock(() => mockInstance)
          }
        };
      });

      const beforeCall = new Date();
      const { getAwsSynchronizedTime } = await import('./time');
      const result = await getAwsSynchronizedTime();
      const afterCall = new Date();

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });
  });
});
