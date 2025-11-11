import { describe, expect, test } from 'bun:test';
import { parseYaml, stringifyToYaml } from './yaml';

describe('yaml utilities', () => {
  describe('parseYaml', () => {
    test('should parse valid YAML string', () => {
      const yamlString = 'name: John\nage: 30';
      const result = parseYaml(yamlString);
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    test('should parse nested YAML structures', () => {
      const yamlString = `
person:
  name: Alice
  details:
    age: 25
    city: Paris
`;
      const result = parseYaml(yamlString);
      expect(result.person.name).toBe('Alice');
      expect(result.person.details.age).toBe(25);
      expect(result.person.details.city).toBe('Paris');
    });

    test('should parse arrays', () => {
      const yamlString = `
items:
  - apple
  - banana
  - cherry
`;
      const result = parseYaml(yamlString);
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items).toEqual(['apple', 'banana', 'cherry']);
    });

    test('should parse numbers correctly', () => {
      const yamlString = 'count: 42\nprice: 19.99';
      const result = parseYaml(yamlString);
      expect(result.count).toBe(42);
      expect(result.price).toBe(19.99);
    });

    test('should parse booleans', () => {
      const yamlString = 'enabled: true\ndisabled: false';
      const result = parseYaml(yamlString);
      expect(result.enabled).toBe(true);
      expect(result.disabled).toBe(false);
    });

    test('should handle null values', () => {
      const yamlString = 'value: null';
      const result = parseYaml(yamlString);
      expect(result.value).toBe(null);
    });

    test('should parse empty YAML', () => {
      const result = parseYaml('');
      expect(result).toBe(null);
    });
  });

  describe('stringifyToYaml', () => {
    test('should stringify simple objects', () => {
      const obj = { name: 'John', age: 30 };
      const yaml = stringifyToYaml(obj);
      expect(yaml).toContain('name: John');
      expect(yaml).toContain('age: 30');
    });

    test('should stringify nested objects', () => {
      const obj = {
        person: {
          name: 'Alice',
          address: {
            city: 'Paris'
          }
        }
      };
      const yaml = stringifyToYaml(obj);
      expect(yaml).toContain('person:');
      expect(yaml).toContain('name: Alice');
      expect(yaml).toContain('city: Paris');
    });

    test('should stringify arrays', () => {
      const obj = { items: ['apple', 'banana'] };
      const yaml = stringifyToYaml(obj);
      expect(yaml).toContain('items:');
      expect(yaml).toContain('- apple');
      expect(yaml).toContain('- banana');
    });

    test('should quote "no" values to prevent boolean interpretation', () => {
      const obj = { value: 'no' };
      const yaml = stringifyToYaml(obj);
      expect(yaml).toContain('"no"');
    });

    test('should quote "yes" values to prevent boolean interpretation', () => {
      const obj = { value: 'yes' };
      const yaml = stringifyToYaml(obj);
      expect(yaml).toContain('"yes"');
    });

    test('should quote "on" values to prevent boolean interpretation', () => {
      const obj = { value: 'on' };
      const yaml = stringifyToYaml(obj);
      expect(yaml).toContain('"on"');
    });

    test('should quote "off" values to prevent boolean interpretation', () => {
      const obj = { value: 'off' };
      const yaml = stringifyToYaml(obj);
      expect(yaml).toContain('"off"');
    });

    test('should quote boolean-like values (YES becomes yes)', () => {
      const obj = { a: 'NO', b: 'YES', c: 'ON', d: 'OFF' };
      const yaml = stringifyToYaml(obj);
      expect(yaml).toContain('"NO"');
      expect(yaml).toContain('"yes"'); // YES is converted to lowercase yes
      expect(yaml).toContain('"ON"');
      expect(yaml).toContain('"OFF"');
    });

    test('should handle mixed case where YES becomes yes', () => {
      const obj = { value: 'YES' };
      const yaml = stringifyToYaml(obj);
      expect(yaml).toContain('"yes"');
    });

    test('should handle actual boolean values', () => {
      const obj = { enabled: true, disabled: false };
      const yaml = stringifyToYaml(obj);
      expect(yaml).toContain('enabled: true');
      expect(yaml).toContain('disabled: false');
    });

    test('should round-trip parse and stringify', () => {
      const original = { name: 'test', items: [1, 2, 3], config: { enabled: true } };
      const yaml = stringifyToYaml(original);
      const parsed = parseYaml(yaml);
      expect(parsed).toEqual(original);
    });

    test('should preserve CloudFormation-safe formatting', () => {
      const obj = {
        Resources: {
          MyResource: {
            Type: 'AWS::S3::Bucket',
            Properties: {
              BucketName: 'no',
              Versioning: 'yes'
            }
          }
        }
      };
      const yaml = stringifyToYaml(obj);
      // Ensure no/yes are quoted for CloudFormation compatibility
      expect(yaml).toContain('"no"');
      expect(yaml).toContain('"yes"');
    });
  });
});
