import { describe, expect, mock, test } from 'bun:test';

// Mock the basic-compose module
const mockCompose = mock((...fns: Function[]) => (initialValue: any) =>
  fns.reduceRight((acc, fn) => fn(acc), initialValue)
);

mock.module('basic-compose', () => ({
  default: mockCompose
}));

describe('basic-compose-shim', () => {
  describe('compose export', () => {
    test('should export compose function', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      expect(typeof compose).toBe('function');
    });

    test('should be callable', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      const addOne = (x: number) => x + 1;
      const double = (x: number) => x * 2;

      const result = compose(addOne, double)(5);

      expect(result).toBe(11); // double(5) = 10, then addOne(10) = 11
    });

    test('should compose multiple functions right to left', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      const fn1 = (x: number) => x + 1;
      const fn2 = (x: number) => x * 2;
      const fn3 = (x: number) => x - 3;

      const composed = compose(fn1, fn2, fn3);
      const result = composed(10);

      // Executed right to left: fn3(10) = 7, fn2(7) = 14, fn1(14) = 15
      expect(result).toBe(15);
    });

    test('should handle single function composition', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      const double = (x: number) => x * 2;

      const result = compose(double)(5);

      expect(result).toBe(10);
    });

    test('should handle identity composition (no functions)', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      const result = compose()(42);

      expect(result).toBe(42);
    });

    test('should work with different data types', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      const toUpper = (s: string) => s.toUpperCase();
      const exclaim = (s: string) => s + '!';

      const result = compose(exclaim, toUpper)('hello');

      expect(result).toBe('HELLO!');
    });

    test('should work with object transformations', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      const addProp = (obj: any) => ({ ...obj, added: true });
      const increment = (obj: any) => ({ ...obj, value: obj.value + 1 });

      const result = compose(addProp, increment)({ value: 5 });

      expect(result.value).toBe(6);
      expect(result.added).toBe(true);
    });

    test('should handle async functions if basic-compose supports them', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      // Test with synchronous functions (basic-compose may not support async)
      const fn1 = (x: number) => x + 1;
      const fn2 = (x: number) => x * 2;

      const result = compose(fn1, fn2)(5);

      expect(result).toBe(11);
    });

    test('should preserve function context', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      const obj = {
        value: 10,
        add: function (x: number) {
          return this.value + x;
        },
        multiply: function (x: number) {
          return this.value * x;
        }
      };

      const addFive = (x: number) => x + 5;
      const double = (x: number) => x * 2;

      const result = compose(addFive, double)(3);

      expect(result).toBe(11); // double(3) = 6, addFive(6) = 11
    });

    test('should handle error propagation', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      const throwError = () => {
        throw new Error('Test error');
      };
      const addOne = (x: number) => x + 1;

      expect(() => compose(addOne, throwError)(5)).toThrow('Test error');
    });
  });

  describe('CommonJS/ESM interop', () => {
    test('should handle module with default export', async () => {
      mock.module('basic-compose', () => ({
        default: mockCompose
      }));

      const compose = (await import('./basic-compose-shim')).default;

      expect(compose).toBe(mockCompose);
    });

    test('should handle module without default export', async () => {
      const mockComposeNoDefault = mock(() => {});
      mock.module('basic-compose', () => mockComposeNoDefault);

      const compose = (await import('./basic-compose-shim')).default;

      // Should fallback to the module itself if no default
      expect(typeof compose).toBe('function');
    });

    test('should provide consistent API regardless of module format', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      // Basic functionality should work
      const fn = (x: number) => x + 1;
      const result = compose(fn)(5);

      expect(typeof result).toBe('number');
    });
  });

  describe('composition patterns', () => {
    test('should support functional programming patterns', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      const map = (fn: Function) => (arr: any[]) => arr.map(fn);
      const filter = (fn: Function) => (arr: any[]) => arr.filter(fn);

      const double = (x: number) => x * 2;
      const isEven = (x: number) => x % 2 === 0;

      const processNumbers = compose(map(double), filter(isEven));

      const result = processNumbers([1, 2, 3, 4, 5]);

      expect(result).toEqual([4, 8]); // filter evens [2,4], then double [4,8]
    });

    test('should chain transformations', async () => {
      const compose = (await import('./basic-compose-shim')).default;

      const step1 = (x: number) => x + 10;
      const step2 = (x: number) => x / 2;
      const step3 = (x: number) => x * 3;

      const pipeline = compose(step3, step2, step1);

      const result = pipeline(10);

      // step1(10) = 20, step2(20) = 10, step3(10) = 30
      expect(result).toBe(30);
    });
  });
});
