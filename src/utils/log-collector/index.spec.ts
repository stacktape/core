import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/aws/log-collector', () => ({
  LogCollectorStream: mock(
    class {
      write = mock();
      read = mock();
      clear = mock();
    }
  )
}));

describe('log-collector', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('should export logCollectorStream instance', async () => {
    const { logCollectorStream } = await import('./index');

    expect(logCollectorStream).toBeDefined();
  });

  test('should be instance of LogCollectorStream', async () => {
    const { logCollectorStream } = await import('./index');
    const { LogCollectorStream } = await import('@shared/aws/log-collector');

    expect(logCollectorStream instanceof LogCollectorStream).toBe(true);
  });

  test('should have write method', async () => {
    const { logCollectorStream } = await import('./index');

    expect(typeof logCollectorStream.write).toBe('function');
  });

  test('should have read method', async () => {
    const { logCollectorStream } = await import('./index');

    expect(typeof logCollectorStream.read).toBe('function');
  });

  test('should have clear method', async () => {
    const { logCollectorStream } = await import('./index');

    expect(typeof logCollectorStream.clear).toBe('function');
  });
});
