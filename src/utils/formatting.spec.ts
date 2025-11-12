import { describe, expect, mock, test } from 'bun:test';

// Mock printer
mock.module('./printer', () => ({
  printer: {
    makeBold: mock((text: string) => `**${text}**`)
  }
}));

describe('formatting', () => {
  describe('getPrettyTime', () => {
    test('should format seconds', async () => {
      const { getPrettyTime } = await import('./formatting');
      expect(getPrettyTime(1000)).toBe('1 sec');
      expect(getPrettyTime(5000)).toBe('5 sec');
      expect(getPrettyTime(59000)).toBe('59 sec');
    });

    test('should format milliseconds as seconds', async () => {
      const { getPrettyTime } = await import('./formatting');
      expect(getPrettyTime(500)).toBe('0.5 sec');
      expect(getPrettyTime(1500)).toBe('1.5 sec');
    });

    test('should format minutes', async () => {
      const { getPrettyTime } = await import('./formatting');
      expect(getPrettyTime(60000)).toBe('1 min');
      expect(getPrettyTime(120000)).toBe('2 min');
      expect(getPrettyTime(1800000)).toBe('30 min');
      expect(getPrettyTime(3599000)).toBe('59.98 min');
    });

    test('should format hours', async () => {
      const { getPrettyTime } = await import('./formatting');
      expect(getPrettyTime(3600000)).toBe('1 hrs');
      expect(getPrettyTime(7200000)).toBe('2 hrs');
      expect(getPrettyTime(43200000)).toBe('12 hrs');
      expect(getPrettyTime(86399000)).toBe('24 hrs');
    });

    test('should format days', async () => {
      const { getPrettyTime } = await import('./formatting');
      expect(getPrettyTime(86400000)).toBe('1 days');
      expect(getPrettyTime(172800000)).toBe('2 days');
      expect(getPrettyTime(604800000)).toBe('7 days');
    });

    test('should round to 2 decimal places', async () => {
      const { getPrettyTime } = await import('./formatting');
      expect(getPrettyTime(1234)).toBe('1.23 sec');
      expect(getPrettyTime(61234)).toBe('1.02 min');
    });

    test('should handle edge case at boundaries', async () => {
      const { getPrettyTime } = await import('./formatting');
      expect(getPrettyTime(59999)).toBe('60 sec');
      expect(getPrettyTime(60001)).toBe('1 min');
    });
  });

  describe('getPrettyPrintedFlatObject', () => {
    test('should format object with string values', async () => {
      const { getPrettyPrintedFlatObject } = await import('./formatting');
      const result = getPrettyPrintedFlatObject({
        name: 'John',
        role: 'Developer'
      });
      expect(result).toContain('**name**');
      expect(result).toContain('John');
      expect(result).toContain('**role**');
      expect(result).toContain('Developer');
    });

    test('should format object with number values', async () => {
      const { getPrettyPrintedFlatObject } = await import('./formatting');
      const result = getPrettyPrintedFlatObject({
        age: 30,
        count: 42
      });
      expect(result).toContain('**age**');
      expect(result).toContain('30');
      expect(result).toContain('**count**');
      expect(result).toContain('42');
    });

    test('should format object with boolean values', async () => {
      const { getPrettyPrintedFlatObject } = await import('./formatting');
      const result = getPrettyPrintedFlatObject({
        active: true,
        deleted: false
      });
      expect(result).toContain('**active**');
      expect(result).toContain('true');
      expect(result).toContain('**deleted**');
      expect(result).toContain('false');
    });

    test('should format object with mixed value types', async () => {
      const { getPrettyPrintedFlatObject } = await import('./formatting');
      const result = getPrettyPrintedFlatObject({
        name: 'Alice',
        age: 25,
        active: true
      });
      expect(result).toContain('**name**');
      expect(result).toContain('Alice');
      expect(result).toContain('**age**');
      expect(result).toContain('25');
      expect(result).toContain('**active**');
      expect(result).toContain('true');
    });

    test('should separate entries with newlines', async () => {
      const { getPrettyPrintedFlatObject } = await import('./formatting');
      const result = getPrettyPrintedFlatObject({
        key1: 'value1',
        key2: 'value2'
      });
      const lines = result.split('\n');
      expect(lines.length).toBe(2);
    });

    test('should handle empty object', async () => {
      const { getPrettyPrintedFlatObject } = await import('./formatting');
      const result = getPrettyPrintedFlatObject({});
      expect(result).toBe('');
    });

    test('should prefix each line with bullet point', async () => {
      const { getPrettyPrintedFlatObject } = await import('./formatting');
      const result = getPrettyPrintedFlatObject({ key: 'value' });
      expect(result).toMatch(/^ ○ /);
    });
  });

  describe('normalizePathForLink', () => {
    test('should convert * to /*', async () => {
      const { normalizePathForLink } = await import('./formatting');
      expect(normalizePathForLink('*')).toBe('/*');
    });

    test('should leave regular paths unchanged', async () => {
      const { normalizePathForLink } = await import('./formatting');
      expect(normalizePathForLink('/api')).toBe('/api');
      expect(normalizePathForLink('/users')).toBe('/users');
      expect(normalizePathForLink('/api/v1/users')).toBe('/api/v1/users');
    });

    test('should leave paths with wildcards unchanged', async () => {
      const { normalizePathForLink } = await import('./formatting');
      expect(normalizePathForLink('/api/*')).toBe('/api/*');
      expect(normalizePathForLink('/users/*/posts')).toBe('/users/*/posts');
    });

    test('should handle root path', async () => {
      const { normalizePathForLink } = await import('./formatting');
      expect(normalizePathForLink('/')).toBe('/');
    });

    test('should handle empty string', async () => {
      const { normalizePathForLink } = await import('./formatting');
      expect(normalizePathForLink('')).toBe('');
    });
  });
});
