import { describe, expect, test } from 'bun:test';
import { renderPrettyJson } from './pretty-json';

describe('pretty-json', () => {
  describe('renderPrettyJson', () => {
    test('should render simple object', () => {
      const result = renderPrettyJson({ name: 'John', age: 30 });
      expect(result).toContain('name:');
      expect(result).toContain('John');
      expect(result).toContain('age:');
      expect(result).toContain('30');
    });

    test('should render nested object', () => {
      const result = renderPrettyJson({
        user: {
          name: 'Alice',
          age: 25
        }
      });
      expect(result).toContain('user:');
      expect(result).toContain('name:');
      expect(result).toContain('Alice');
    });

    test('should render array', () => {
      const result = renderPrettyJson({ items: [1, 2, 3] });
      expect(result).toContain('items:');
      expect(result).toContain('- 1');
      expect(result).toContain('- 2');
      expect(result).toContain('- 3');
    });

    test('should render empty array with empty message', () => {
      const result = renderPrettyJson({ items: [] });
      expect(result).toContain('(empty array)');
    });

    test('should render array of objects', () => {
      const result = renderPrettyJson({
        users: [
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 30 }
        ]
      });
      expect(result).toContain('users:');
      expect(result).toContain('- ');
      expect(result).toContain('name:');
      expect(result).toContain('Alice');
      expect(result).toContain('Bob');
    });

    test('should handle boolean values', () => {
      const result = renderPrettyJson({ active: true, deleted: false });
      expect(result).toContain('active:');
      expect(result).toContain('true');
      expect(result).toContain('deleted:');
      expect(result).toContain('false');
    });

    test('should handle null values', () => {
      const result = renderPrettyJson({ value: null });
      expect(result).toContain('value:');
      expect(result).toContain('null');
    });

    test('should skip undefined values', () => {
      const result = renderPrettyJson({ value: undefined, other: 'test' });
      expect(result).not.toContain('value:');
      expect(result).toContain('other:');
    });

    test('should handle Date objects', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const result = renderPrettyJson({ timestamp: date });
      expect(result).toContain('timestamp:');
    });

    test('should render function as function() {}', () => {
      const result = renderPrettyJson({ fn: () => {} });
      expect(result).toContain('function() {}');
    });

    test('should handle multiline strings', () => {
      const result = renderPrettyJson({ text: 'line1\nline2\nline3' });
      expect(result).toContain('text:');
      expect(result).toContain('"""');
    });

    test('should indent nested structures', () => {
      const result = renderPrettyJson({
        level1: {
          level2: {
            level3: 'value'
          }
        }
      });
      const lines = result.split('\n');
      expect(lines.length).toBeGreaterThan(3);
    });

    test('should handle deeply nested objects', () => {
      const result = renderPrettyJson({
        a: {
          b: {
            c: {
              d: 'deep'
            }
          }
        }
      });
      expect(result).toContain('a:');
      expect(result).toContain('b:');
      expect(result).toContain('c:');
      expect(result).toContain('d:');
      expect(result).toContain('deep');
    });

    test('should handle mixed types', () => {
      const result = renderPrettyJson({
        string: 'text',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { key: 'value' },
        null_value: null
      });
      expect(result).toContain('string:');
      expect(result).toContain('number:');
      expect(result).toContain('boolean:');
      expect(result).toContain('array:');
      expect(result).toContain('object:');
      expect(result).toContain('null_value:');
    });

    test('should handle Error objects', () => {
      const error = new Error('Test error');
      const result = renderPrettyJson({ error });
      expect(result).toContain('message:');
      expect(result).toContain('Test error');
      expect(result).toContain('stack:');
    });

    test('should handle empty object', () => {
      const result = renderPrettyJson({});
      expect(result).toBe('');
    });

    test('should align values when keys have different lengths', () => {
      const result = renderPrettyJson({
        a: 1,
        longer_key: 2,
        b: 3
      });
      const lines = result.split('\n');
      expect(lines.length).toBe(3);
    });

    test('should handle array with nested arrays', () => {
      const result = renderPrettyJson({
        matrix: [
          [1, 2],
          [3, 4]
        ]
      });
      expect(result).toContain('matrix:');
      expect(result).toContain('- ');
      expect(result).toContain('- ');
    });

    test('should handle complex nested structure', () => {
      const result = renderPrettyJson({
        users: [
          {
            name: 'Alice',
            roles: ['admin', 'user'],
            metadata: {
              created: '2024-01-01',
              active: true
            }
          }
        ]
      });
      expect(result).toContain('users:');
      expect(result).toContain('name:');
      expect(result).toContain('Alice');
      expect(result).toContain('roles:');
      expect(result).toContain('admin');
      expect(result).toContain('metadata:');
      expect(result).toContain('created:');
      expect(result).toContain('active:');
    });

    test('should render numbers correctly', () => {
      const result = renderPrettyJson({
        int: 42,
        float: 3.14,
        negative: -100,
        zero: 0
      });
      expect(result).toContain('42');
      expect(result).toContain('3.14');
      expect(result).toContain('-100');
      expect(result).toContain('0');
    });
  });
});
