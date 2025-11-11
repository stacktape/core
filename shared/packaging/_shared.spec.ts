import { describe, expect, test } from 'bun:test';
import { EXCLUDE_FROM_CHECKSUM_GLOBS } from './_shared';

describe('_shared', () => {
  describe('EXCLUDE_FROM_CHECKSUM_GLOBS', () => {
    test('should export exclude patterns array', () => {
      expect(EXCLUDE_FROM_CHECKSUM_GLOBS).toBeDefined();
      expect(Array.isArray(EXCLUDE_FROM_CHECKSUM_GLOBS)).toBe(true);
    });

    test('should include node_modules pattern', () => {
      expect(EXCLUDE_FROM_CHECKSUM_GLOBS).toContain('node_modules');
    });

    test('should include test_coverage pattern', () => {
      expect(EXCLUDE_FROM_CHECKSUM_GLOBS).toContain('test_coverage');
    });

    test('should have exactly 2 patterns', () => {
      expect(EXCLUDE_FROM_CHECKSUM_GLOBS).toHaveLength(2);
    });
  });
});
