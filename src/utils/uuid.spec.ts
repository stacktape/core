import { describe, expect, test } from 'bun:test';
import { generateShortUuid, generateUuid } from './uuid';

describe('uuid', () => {
  describe('generateUuid', () => {
    test('should generate valid UUID', () => {
      const uuid = generateUuid();
      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expect(uuid.length).toBeGreaterThan(0);
    });

    test('should generate unique UUIDs', () => {
      const uuid1 = generateUuid();
      const uuid2 = generateUuid();
      expect(uuid1).not.toBe(uuid2);
    });

    test('should match UUID v4 format', () => {
      const uuid = generateUuid();
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidV4Regex.test(uuid)).toBe(true);
    });

    test('should generate multiple unique UUIDs', () => {
      const uuids = new Set();
      const count = 100;

      for (let i = 0; i < count; i++) {
        uuids.add(generateUuid());
      }

      expect(uuids.size).toBe(count);
    });
  });

  describe('generateShortUuid', () => {
    test('should generate valid short UUID', () => {
      const shortUuid = generateShortUuid();
      expect(shortUuid).toBeDefined();
      expect(typeof shortUuid).toBe('string');
      expect(shortUuid.length).toBeGreaterThan(0);
    });

    test('should generate unique short UUIDs', () => {
      const shortUuid1 = generateShortUuid();
      const shortUuid2 = generateShortUuid();
      expect(shortUuid1).not.toBe(shortUuid2);
    });

    test('should be shorter than regular UUID', () => {
      const uuid = generateUuid();
      const shortUuid = generateShortUuid();
      expect(shortUuid.length).toBeLessThan(uuid.length);
    });

    test('should generate multiple unique short UUIDs', () => {
      const shortUuids = new Set();
      const count = 100;

      for (let i = 0; i < count; i++) {
        shortUuids.add(generateShortUuid());
      }

      expect(shortUuids.size).toBe(count);
    });

    test('should only contain alphanumeric characters', () => {
      const shortUuid = generateShortUuid();
      const alphanumericRegex = /^[A-Za-z0-9]+$/;
      expect(alphanumericRegex.test(shortUuid)).toBe(true);
    });
  });
});
