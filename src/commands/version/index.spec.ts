import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@utils/printer', () => ({
  printer: {
    info: mock(() => {}),
    colorize: mock((color: string, text: string) => text)
  }
}));

mock.module('@utils/versioning', () => ({
  getStacktapeVersion: mock(() => '1.2.3')
}));

describe('version command', () => {
  test('should return and print version', async () => {
    const { commandVersion } = await import('./index');
    const { printer } = await import('@utils/printer');
    const { getStacktapeVersion } = await import('@utils/versioning');

    const result = await commandVersion();

    expect(result).toBe('1.2.3');
    expect(getStacktapeVersion).toHaveBeenCalled();
    expect(printer.info).toHaveBeenCalledWith('Stacktape version 1.2.3.');
  });
});
