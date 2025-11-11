import { describe, expect, test } from 'bun:test';
import { strip } from './strip-it';

describe('bundlers/es/esbuild-decorators/strip-it', () => {
  describe('strip', () => {
    test('should strip block comments', () => {
      const input = `
const x = 1;
/* This is a comment */
const y = 2;
`;
      const result = strip(input);

      expect(result).not.toContain('This is a comment');
      expect(result).toContain('const x = 1');
      expect(result).toContain('const y = 2');
    });

    test('should strip line comments', () => {
      const input = `
const x = 1; // This is a comment
const y = 2;
`;
      const result = strip(input);

      expect(result).not.toContain('This is a comment');
      expect(result).toContain('const x = 1');
      expect(result).toContain('const y = 2');
    });

    test('should preserve code without comments', () => {
      const input = `
const hello = "world";
function test() {
  return 42;
}
`;
      const result = strip(input);

      expect(result).toContain('const hello');
      expect(result).toContain('function test');
      expect(result).toContain('return 42');
    });

    test('should handle empty string', () => {
      const result = strip('');

      expect(result).toBe('');
    });

    test('should preserve strings with comment-like content', () => {
      const input = 'const x = "// not a comment";';
      const result = strip(input);

      expect(result).toBe(input);
    });

    test('should handle multiple comments', () => {
      const input = `
/* Comment 1 */
const x = 1;
// Comment 2
const y = 2;
/* Comment 3 */
`;
      const result = strip(input);

      expect(result).not.toContain('Comment 1');
      expect(result).not.toContain('Comment 2');
      expect(result).not.toContain('Comment 3');
    });

    test('should handle JSDoc comments', () => {
      const input = `
/**
 * This is JSDoc
 * @param x number
 */
function test(x) {
  return x;
}
`;
      const result = strip(input);

      expect(result).not.toContain('This is JSDoc');
      expect(result).not.toContain('@param');
      expect(result).toContain('function test');
    });
  });
});
