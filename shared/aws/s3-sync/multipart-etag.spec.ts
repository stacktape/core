import { describe, expect, test } from 'bun:test';
import { Readable } from 'node:stream';
import { MultipartETag } from './multipart-etag';

describe('multipart-etag', () => {
  describe('MultipartETag', () => {
    test('should create MultipartETag transform stream', () => {
      const etag = new MultipartETag();
      expect(etag).toBeDefined();
      expect(etag.sums).toBeDefined();
      expect(etag.bytes).toBe(0);
      expect(etag.done).toBe(false);
    });

    test('should initialize with default sizes', () => {
      const etag = new MultipartETag();
      expect(etag.sums.length).toBeGreaterThan(0);
      // Should have at least 4 default sizes
      expect(etag.sums.length).toBeGreaterThanOrEqual(4);
    });

    test('should initialize with custom size and count', () => {
      const etag = new MultipartETag({ size: 100 * 1024 * 1024, count: 10 });
      expect(etag.sums.length).toBeGreaterThan(0);
    });

    test('should handle single part upload (count === 1)', () => {
      const etag = new MultipartETag({ size: 1024 * 1024, count: 1 });
      // For single part, should only have maximumUploadSize
      expect(etag.sums.length).toBe(1);
    });

    test('should process small data and calculate ETag', async () => {
      const etag = new MultipartETag();
      const data = Buffer.from('test data');

      const readable = Readable.from([data]);
      await new Promise((resolve, reject) => {
        readable.pipe(etag).on('finish', resolve).on('error', reject);
      });

      expect(etag.done).toBe(true);
      expect(etag.bytes).toBe(data.length);
      expect(etag.digest).toBeDefined();
    });

    test('should track bytes processed', async () => {
      const etag = new MultipartETag();
      const data1 = Buffer.from('part1');
      const data2 = Buffer.from('part2');

      const readable = Readable.from([data1, data2]);
      await new Promise((resolve) => {
        readable.pipe(etag).on('finish', resolve);
      });

      expect(etag.bytes).toBe(data1.length + data2.length);
    });

    test('should calculate digest for single part upload', async () => {
      const etag = new MultipartETag();
      const data = Buffer.from('small test data');

      const readable = Readable.from([data]);
      await new Promise((resolve) => {
        readable.pipe(etag).on('finish', resolve);
      });

      expect(etag.digest).toBeDefined();
      expect(etag.digest).toBeInstanceOf(Buffer);
    });

    test('should generate eTags for each sum object', async () => {
      const etag = new MultipartETag();
      const data = Buffer.from('test');

      const readable = Readable.from([data]);
      await new Promise((resolve) => {
        readable.pipe(etag).on('finish', resolve);
      });

      etag.sums.forEach((sumObj) => {
        expect(sumObj.eTag).toBeDefined();
        expect(typeof sumObj.eTag).toBe('string');
        expect(sumObj.eTag).toContain('-');
      });
    });

    test('anyMatch should return true for matching digest', async () => {
      const etag = new MultipartETag();
      const data = Buffer.from('test data');

      const readable = Readable.from([data]);
      await new Promise((resolve) => {
        readable.pipe(etag).on('finish', resolve);
      });

      const hexDigest = etag.digest.toString('hex');
      expect(etag.anyMatch(hexDigest)).toBe(true);
    });

    test('anyMatch should return false for non-matching ETag', async () => {
      const etag = new MultipartETag();
      const data = Buffer.from('test');

      const readable = Readable.from([data]);
      await new Promise((resolve) => {
        readable.pipe(etag).on('finish', resolve);
      });

      expect(etag.anyMatch('invalid-etag')).toBe(false);
    });

    test('anyMatch should check all sum objects', async () => {
      const etag = new MultipartETag();
      const data = Buffer.from('data');

      const readable = Readable.from([data]);
      await new Promise((resolve) => {
        readable.pipe(etag).on('finish', resolve);
      });

      // At least one sum object should match
      const firstSumETag = etag.sums[0].eTag;
      expect(etag.anyMatch(firstSumETag)).toBe(true);
    });

    test('should emit progress events', async () => {
      const etag = new MultipartETag();
      let progressEmitted = false;

      etag.on('progress', () => {
        progressEmitted = true;
      });

      const data = Buffer.from('test data');
      const readable = Readable.from([data]);
      await new Promise((resolve) => {
        readable.pipe(etag).on('finish', resolve);
      });

      expect(progressEmitted).toBe(true);
    });

    test('should handle empty data', async () => {
      const etag = new MultipartETag();
      const data = Buffer.from('');

      const readable = Readable.from([data]);
      await new Promise((resolve) => {
        readable.pipe(etag).on('finish', resolve);
      });

      expect(etag.done).toBe(true);
      expect(etag.bytes).toBe(0);
    });

    test('should process multiple chunks', async () => {
      const etag = new MultipartETag();
      const chunks = [Buffer.from('chunk1'), Buffer.from('chunk2'), Buffer.from('chunk3')];

      const readable = Readable.from(chunks);
      await new Promise((resolve) => {
        readable.pipe(etag).on('finish', resolve);
      });

      expect(etag.bytes).toBe(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
      expect(etag.done).toBe(true);
    });

    test('sums should have required properties', () => {
      const etag = new MultipartETag();
      etag.sums.forEach((sumObj) => {
        expect(sumObj).toHaveProperty('size');
        expect(sumObj).toHaveProperty('hash');
        expect(sumObj).toHaveProperty('amtWritten');
        expect(sumObj).toHaveProperty('digests');
        expect(sumObj).toHaveProperty('eTag');
        expect(sumObj.amtWritten).toBe(0);
        expect(sumObj.digests).toEqual([]);
        expect(sumObj.eTag).toBeNull();
      });
    });
  });
});
