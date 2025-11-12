import { describe, expect, test } from 'bun:test';
import { parseDotenv } from './dotenv';

describe('dotenv', () => {
  describe('parseDotenv', () => {
    test('should parse simple key-value pairs', () => {
      const content = 'KEY1=value1\nKEY2=value2';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY1: 'value1', KEY2: 'value2' });
    });

    test('should handle empty values', () => {
      const content = 'KEY1=\nKEY2=value2';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY1: '', KEY2: 'value2' });
    });

    test('should handle double-quoted values', () => {
      const content = 'KEY="double quoted value"';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY: 'double quoted value' });
    });

    test('should handle single-quoted values', () => {
      const content = "KEY='single quoted value'";
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY: 'single quoted value' });
    });

    test('should expand newlines in double-quoted values', () => {
      const content = 'KEY="line1\\nline2\\nline3"';
      const result = parseDotenv(content);
      expect(result.KEY).toBe('line1\nline2\nline3');
    });

    test('should not expand newlines in single-quoted values', () => {
      const content = "KEY='line1\\nline2'";
      const result = parseDotenv(content);
      expect(result.KEY).toBe('line1\\nline2');
    });

    test('should handle values with spaces', () => {
      const content = 'KEY=value with spaces';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY: 'value with spaces' });
    });

    test('should trim unquoted values', () => {
      const content = 'KEY=  value with spaces  ';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY: 'value with spaces' });
    });

    test('should handle keys with dots', () => {
      const content = 'my.dotted.key=value';
      const result = parseDotenv(content);
      expect(result).toEqual({ 'my.dotted.key': 'value' });
    });

    test('should handle keys with hyphens', () => {
      const content = 'my-hyphenated-key=value';
      const result = parseDotenv(content);
      expect(result).toEqual({ 'my-hyphenated-key': 'value' });
    });

    test('should handle keys with underscores', () => {
      const content = 'MY_SNAKE_CASE_KEY=value';
      const result = parseDotenv(content);
      expect(result).toEqual({ MY_SNAKE_CASE_KEY: 'value' });
    });

    test('should ignore lines without equals sign', () => {
      const content = 'KEY1=value1\ninvalid line\nKEY2=value2';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY1: 'value1', KEY2: 'value2' });
    });

    test('should handle empty lines', () => {
      const content = 'KEY1=value1\n\nKEY2=value2\n\n';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY1: 'value1', KEY2: 'value2' });
    });

    test('should handle Windows line endings (CRLF)', () => {
      const content = 'KEY1=value1\r\nKEY2=value2\r\n';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY1: 'value1', KEY2: 'value2' });
    });

    test('should handle Mac line endings (CR)', () => {
      const content = 'KEY1=value1\rKEY2=value2\r';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY1: 'value1', KEY2: 'value2' });
    });

    test('should handle values with equals signs', () => {
      const content = 'KEY=value=with=equals';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY: 'value=with=equals' });
    });

    test('should handle quoted values with equals signs', () => {
      const content = 'KEY="value=with=equals"';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY: 'value=with=equals' });
    });

    test('should handle spaces around equals sign', () => {
      const content = 'KEY = value';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY: 'value' });
    });

    test('should handle multiple spaces around equals sign', () => {
      const content = 'KEY   =   value';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY: 'value' });
    });

    test('should handle empty file', () => {
      const content = '';
      const result = parseDotenv(content);
      expect(result).toEqual({});
    });

    test('should handle file with only newlines', () => {
      const content = '\n\n\n';
      const result = parseDotenv(content);
      expect(result).toEqual({});
    });

    test('should handle mixed quote types', () => {
      const content = 'KEY1="double"\nKEY2=\'single\'\nKEY3=unquoted';
      const result = parseDotenv(content);
      expect(result).toEqual({
        KEY1: 'double',
        KEY2: 'single',
        KEY3: 'unquoted'
      });
    });

    test('should handle special characters in values', () => {
      const content = 'KEY=!@#$%^&*()';
      const result = parseDotenv(content);
      expect(result).toEqual({ KEY: '!@#$%^&*()' });
    });

    test('should handle numeric-looking values as strings', () => {
      const content = 'PORT=3000\nCOUNT=42\nRATE=3.14';
      const result = parseDotenv(content);
      expect(result).toEqual({ PORT: '3000', COUNT: '42', RATE: '3.14' });
    });

    test('should handle boolean-looking values as strings', () => {
      const content = 'ENABLED=true\nDISABLED=false';
      const result = parseDotenv(content);
      expect(result).toEqual({ ENABLED: 'true', DISABLED: 'false' });
    });

    test('should handle values with leading/trailing quotes inside', () => {
      const content = 'KEY="value with "inner" quotes"';
      const result = parseDotenv(content);
      expect(result.KEY).toContain('inner');
    });

    test('should handle complex real-world example', () => {
      const content = `
DATABASE_URL=postgresql://user:pass@localhost:5432/db
API_KEY="abc-123-def-456"
DEBUG=false
PORT=3000
NODE_ENV=production
MESSAGE="Hello\\nWorld"
EMPTY=
SPACED=  some value
`.trim();
      const result = parseDotenv(content);
      expect(result.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db');
      expect(result.API_KEY).toBe('abc-123-def-456');
      expect(result.DEBUG).toBe('false');
      expect(result.PORT).toBe('3000');
      expect(result.NODE_ENV).toBe('production');
      expect(result.MESSAGE).toBe('Hello\nWorld');
      expect(result.EMPTY).toBe('');
      expect(result.SPACED).toBe('some value');
    });
  });
});
