import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('node:readline', () => ({
  default: {
    moveCursor: mock(),
    clearLine: mock(),
    clearScreenDown: mock(),
    cursorTo: mock()
  }
}));

mock.module('cli-cursor', () => ({
  default: {
    hide: mock(),
    show: mock()
  }
}));

mock.module('strip-ansi', () => ({
  default: mock((text: string) => text)
}));

describe('Spinnies', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('should create Spinnies instance', async () => {
    const { Spinnies } = await import('./spinnies');

    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    expect(spinnies).toBeDefined();
    expect(spinnies.spinners).toEqual({});
  });

  test('should add spinner with name', async () => {
    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    spinnies.add('test-spinner', { text: 'Loading...' });

    expect(spinnies.spinners['test-spinner']).toBeDefined();
    expect(spinnies.spinners['test-spinner'].text).toBe('Loading...');
    expect(spinnies.spinners['test-spinner'].status).toBe('spinning');
  });

  test('should throw error when adding spinner without name', async () => {
    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    expect(() => {
      spinnies.add(null as any);
    }).toThrow('A spinner reference name must be specified');
  });

  test('should use name as text when text not provided', async () => {
    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    spinnies.add('my-spinner');

    expect(spinnies.spinners['my-spinner'].text).toBe('my-spinner');
  });

  test('should update spinner', async () => {
    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    spinnies.add('test-spinner', { text: 'Initial' });
    spinnies.update('test-spinner', { text: 'Updated' });

    expect(spinnies.spinners['test-spinner'].text).toBe('Updated');
  });

  test('should succeed spinner', async () => {
    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    spinnies.add('test-spinner', { text: 'Loading' });
    spinnies.succeed('test-spinner', { text: 'Complete' });

    expect(spinnies.spinners['test-spinner']).toBeUndefined();
  });

  test('should fail spinner', async () => {
    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    spinnies.add('test-spinner', { text: 'Loading' });
    spinnies.fail('test-spinner', { text: 'Failed' });

    expect(spinnies.spinners['test-spinner'].status).toBe('fail');
  });

  test('should pick spinner by name', async () => {
    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    spinnies.add('test-spinner', { text: 'Loading' });

    const spinner = spinnies.pick('test-spinner');

    expect(spinner).toBeDefined();
    expect(spinner.text).toBe('Loading');
  });

  test('should check if has active spinners', async () => {
    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    expect(spinnies.hasActiveSpinners()).toBe(false);

    spinnies.add('test-spinner', { text: 'Loading' });

    expect(spinnies.hasActiveSpinners()).toBe(true);
  });

  test('should get spinner status', async () => {
    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    spinnies.add('test-spinner', { text: 'Loading' });

    expect(spinnies.getSpinnerStatus('test-spinner')).toBe('spinning');
    expect(spinnies.getSpinnerStatus('unknown')).toBeNull();
  });

  test('should stop all spinners', async () => {
    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    spinnies.add('spinner1', { text: 'Loading 1' });
    spinnies.add('spinner2', { text: 'Loading 2' });

    expect(Object.keys(spinnies.spinners).length).toBe(2);

    spinnies.stopAllSpinners();

    expect(Object.keys(spinnies.spinners).length).toBe(0);
    expect(spinnies.isStopped).toBe(true);
  });

  test('should throw error when updating non-existent spinner', async () => {
    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    expect(() => {
      spinnies.update('non-existent', { text: 'Update' });
    }).toThrow('No spinner initialized with name non-existent');
  });

  test('should hide cursor when adding spinner', async () => {
    const cliCursor = (await import('cli-cursor')).default;

    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    spinnies.add('test-spinner', { text: 'Loading' });

    expect(cliCursor.hide).toHaveBeenCalled();
  });

  test('should use custom succeed prefix', async () => {
    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '✓',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    expect(spinnies.succeedPrefix).toBe('✓');
  });

  test('should clean up after exit signal', async () => {
    const cliCursor = (await import('cli-cursor')).default;

    const { Spinnies } = await import('./spinnies');
    const spinnies = new Spinnies({
      succeedPrefix: '[SUCCESS]',
      colorizeFail: (text) => text,
      colorizeProgress: (text) => text
    });

    spinnies.cleanUpAfterExitSignal();

    expect(cliCursor.show).toHaveBeenCalled();
  });
});
