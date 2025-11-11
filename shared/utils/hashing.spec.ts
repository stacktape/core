import { beforeEach, describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDirectoryChecksum, getGloballyUniqueStackHash, mergeHashes } from './hashing';

describe('hashing utilities', () => {
  describe('mergeHashes', () => {
    test('should merge multiple hashes into one', () => {
      const hash1 = 'abc123';
      const hash2 = 'def456';
      const merged = mergeHashes(hash1, hash2);
      expect(typeof merged).toBe('string');
      expect(merged.length).toBeGreaterThan(0);
    });

    test('should produce consistent output for same inputs', () => {
      const hash1 = 'abc123';
      const hash2 = 'def456';
      const merged1 = mergeHashes(hash1, hash2);
      const merged2 = mergeHashes(hash1, hash2);
      expect(merged1).toBe(merged2);
    });

    test('should produce different hash for different inputs', () => {
      const merged1 = mergeHashes('abc', 'def');
      const merged2 = mergeHashes('ghi', 'jkl');
      expect(merged1).not.toBe(merged2);
    });

    test('should handle single hash', () => {
      const hash = 'abc123';
      const merged = mergeHashes(hash);
      expect(typeof merged).toBe('string');
      expect(merged.length).toBeGreaterThan(0);
    });

    test('should handle three or more hashes', () => {
      const hash1 = 'abc';
      const hash2 = 'def';
      const hash3 = 'ghi';
      const hash4 = 'jkl';
      const merged = mergeHashes(hash1, hash2, hash3, hash4);
      expect(typeof merged).toBe('string');
      expect(merged.length).toBeGreaterThan(0);
    });

    test('should return hex string', () => {
      const merged = mergeHashes('abc', 'def');
      expect(merged).toMatch(/^[a-f0-9]+$/);
    });

    test('order should matter', () => {
      const merged1 = mergeHashes('abc', 'def');
      const merged2 = mergeHashes('def', 'abc');
      expect(merged1).not.toBe(merged2);
    });
  });

  describe('getGloballyUniqueStackHash', () => {
    test('should generate hash from region, stackName and accountId', () => {
      const hash = getGloballyUniqueStackHash({
        region: 'us-east-1',
        stackName: 'my-stack',
        accountId: '123456789012'
      });
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    test('should produce consistent output for same inputs', () => {
      const params = {
        region: 'us-east-1',
        stackName: 'my-stack',
        accountId: '123456789012'
      };
      const hash1 = getGloballyUniqueStackHash(params);
      const hash2 = getGloballyUniqueStackHash(params);
      expect(hash1).toBe(hash2);
    });

    test('should produce different hash for different regions', () => {
      const hash1 = getGloballyUniqueStackHash({
        region: 'us-east-1',
        stackName: 'my-stack',
        accountId: '123456789012'
      });
      const hash2 = getGloballyUniqueStackHash({
        region: 'eu-west-1',
        stackName: 'my-stack',
        accountId: '123456789012'
      });
      expect(hash1).not.toBe(hash2);
    });

    test('should produce different hash for different stack names', () => {
      const hash1 = getGloballyUniqueStackHash({
        region: 'us-east-1',
        stackName: 'stack-1',
        accountId: '123456789012'
      });
      const hash2 = getGloballyUniqueStackHash({
        region: 'us-east-1',
        stackName: 'stack-2',
        accountId: '123456789012'
      });
      expect(hash1).not.toBe(hash2);
    });

    test('should produce different hash for different account IDs', () => {
      const hash1 = getGloballyUniqueStackHash({
        region: 'us-east-1',
        stackName: 'my-stack',
        accountId: '111111111111'
      });
      const hash2 = getGloballyUniqueStackHash({
        region: 'us-east-1',
        stackName: 'my-stack',
        accountId: '222222222222'
      });
      expect(hash1).not.toBe(hash2);
    });

    test('should return hex string', () => {
      const hash = getGloballyUniqueStackHash({
        region: 'us-east-1',
        stackName: 'my-stack',
        accountId: '123456789012'
      });
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('getDirectoryChecksum', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = join(tmpdir(), `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await fs.mkdir(tempDir, { recursive: true });
    });

    test('should generate checksum for empty directory', async () => {
      const checksum = await getDirectoryChecksum({
        absoluteDirectoryPath: tempDir
      });
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBeGreaterThan(0);
    });

    test('should generate checksum for directory with files', async () => {
      await fs.writeFile(join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(join(tempDir, 'file2.txt'), 'content2');

      const checksum = await getDirectoryChecksum({
        absoluteDirectoryPath: tempDir
      });
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBeGreaterThan(0);
    });

    test('should produce same checksum for same directory content', async () => {
      await fs.writeFile(join(tempDir, 'file1.txt'), 'content');

      const checksum1 = await getDirectoryChecksum({
        absoluteDirectoryPath: tempDir
      });
      const checksum2 = await getDirectoryChecksum({
        absoluteDirectoryPath: tempDir
      });
      expect(checksum1).toBe(checksum2);
    });

    test('should produce different checksum when file content changes', async () => {
      await fs.writeFile(join(tempDir, 'file1.txt'), 'content1');
      const checksum1 = await getDirectoryChecksum({
        absoluteDirectoryPath: tempDir
      });

      await fs.writeFile(join(tempDir, 'file1.txt'), 'content2');
      const checksum2 = await getDirectoryChecksum({
        absoluteDirectoryPath: tempDir
      });

      expect(checksum1).not.toBe(checksum2);
    });

    test('should handle nested directories', async () => {
      const nestedDir = join(tempDir, 'nested');
      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(join(nestedDir, 'file.txt'), 'nested content');

      const checksum = await getDirectoryChecksum({
        absoluteDirectoryPath: tempDir
      });
      expect(typeof checksum).toBe('string');
      expect(checksum.length).toBeGreaterThan(0);
    });
  });
});
