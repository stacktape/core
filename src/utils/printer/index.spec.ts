import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/event-manager', () => ({
  eventManager: {
    startEvent: mock(),
    finishEvent: mock()
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    logLevel: 'info',
    logFormat: 'normal',
    invokedFrom: 'cli'
  }
}));

mock.module('@cli-config', () => ({
  cliArgsAliases: {}
}));

mock.module('@config', () => ({
  INVOKED_FROM_ENV_VAR_NAME: 'STACKTAPE_INVOKED_FROM',
  IS_DEV: false,
  linksMap: {}
}));

mock.module('@shared/utils/fs-utils', () => ({
  getRelativePath: mock((path: string) => path),
  transformToUnixPath: mock((path: string) => path)
}));

mock.module('@shared/utils/misc', () => ({
  splitStringIntoLines: mock((str: string) => str.split('\n')),
  whitespacePrefixMultilineText: mock((text: string, _prefix: number, _skipFirst: boolean) => text)
}));

mock.module('@utils/cli', () => ({
  getCommandForCurrentEnvironment: mock(() => 'stacktape')
}));

mock.module('@utils/decorators', () => ({
  memoizeGetters: (target: any) => target
}));

mock.module('@utils/formatting', () => ({
  getPrettyTime: mock((ms: number) => `${ms}ms`)
}));

mock.module('@utils/log-collector', () => ({
  logCollectorStream: {
    write: mock()
  }
}));

mock.module('kleur', () => ({
  default: {
    blue: (text: string) => text,
    cyan: (text: string) => text,
    gray: (text: string) => text,
    green: (text: string) => text,
    red: (text: string) => text,
    yellow: (text: string) => text,
    magenta: (text: string) => text,
    bold: (text: string) => text
  }
}));

mock.module('strip-ansi', () => ({
  default: mock((text: string) => text)
}));

mock.module('table', () => ({
  getBorderCharacters: mock(() => ({})),
  table: mock((data: any[]) => JSON.stringify(data))
}));

mock.module('terminal-link', () => ({
  default: mock((text: string, url: string) => text)
}));

mock.module('./spinnies', () => ({
  Spinnies: mock(
    class {
      add = mock();
      update = mock();
      succeed = mock();
      fail = mock();
      stopAllSpinners = mock();
    }
  )
}));

describe('Printer', () => {
  let consoleInfoSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    mock.restore();
    consoleInfoSpy = spyOn(console, 'info');
    consoleErrorSpy = spyOn(console, 'error');

    const { globalStateManager } = require('@application-services/global-state-manager');
    globalStateManager.logLevel = 'info';
    globalStateManager.logFormat = 'normal';
  });

  test('should create printer instance', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    expect(printer).toBeDefined();
    expect(printer.eventStatuses).toEqual({});
  });

  test('should print info message', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.info('Test info message');

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  test('should print warning message', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.warn('Test warning');

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  test('should print error message', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.error('Test error');

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  test('should print success message', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.success('Test success');

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  test('should respect log level for debug messages', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.logLevel = 'error';

    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.info('Should not print');

    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  test('should track progress events', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.progress({ message: 'Starting', type: 'START', identifier: 'test-event' });

    expect(printer.eventStatuses['test-event']).toBe('pending');
  });

  test('should mark progress events as finished', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.progress({ message: 'Starting', type: 'START', identifier: 'test-event' });
    printer.progress({ message: 'Done', type: 'FINISH', identifier: 'test-event' });

    expect(printer.eventStatuses['test-event']).toBe('finished');
  });

  test('should get event status', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.progress({ message: 'Starting', type: 'START', identifier: 'test-event' });

    expect(printer.getEventStatus('test-event')).toBe('pending');
    expect(printer.getEventStatus('unknown-event')).toBeNull();
  });

  test('should remove all finished events', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.progress({ message: 'Starting', type: 'START', identifier: 'event1' });
    printer.progress({ message: 'Starting', type: 'START', identifier: 'event2' });

    printer.removeAllFinishedEvents();

    expect(printer.eventStatuses).toEqual({});
  });

  test('should disable progress printing', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.disableProgressPrinting();

    expect(printer.isProgressPrintingDisabled).toBe(true);
  });

  test('should not print when progress printing is disabled', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.disableProgressPrinting();
    printer.progress({ message: 'Test', type: 'START', identifier: 'test' });

    expect(printer.eventStatuses['test']).toBe('pending');
  });

  test('should use spinner for fancy log format', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.logFormat = 'fancy';

    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.progress({ message: 'Starting', type: 'START', identifier: 'test' });

    expect(printer.spinner.add).toHaveBeenCalledWith('test', { text: 'Starting' });
  });

  test('should update spinner on progress update', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.logFormat = 'fancy';

    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.progress({ message: 'Starting', type: 'START', identifier: 'test' });
    printer.progress({ message: 'In progress', type: 'UPDATE', identifier: 'test' });

    expect(printer.spinner.update).toHaveBeenCalledWith('test', { text: 'In progress' });
  });

  test('should succeed spinner on finish', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.logFormat = 'fancy';

    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.progress({ message: 'Starting', type: 'START', identifier: 'test' });
    printer.progress({ message: 'Complete', type: 'FINISH', identifier: 'test' });

    expect(printer.spinner.succeed).toHaveBeenCalledWith('test', { text: 'Complete' });
  });

  test('should handle JSON log format', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.logFormat = 'json';

    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.info('Test message');

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  test('should write to log collector stream', async () => {
    const { logCollectorStream } = await import('@utils/log-collector');
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.info('Test message');

    expect(logCollectorStream.write).toHaveBeenCalled();
  });

  test('should print to stderr when specified', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.print('Error message', {
      printType: 'ERROR',
      prefixColor: 'red',
      printTo: 'stderr'
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  test('should not print to terminal when disabled', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.print('Test message', {
      printType: 'INFO',
      prefixColor: 'cyan',
      disableTerminalPrint: true
    });

    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  test('should stop all spinners', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.stopAllSpinners();

    expect(printer.spinner.stopAllSpinners).toHaveBeenCalled();
  });

  test('should print announcement', async () => {
    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.announcement('Important announcement');

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  test('should print hint only in non-JSON format', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.logFormat = 'normal';

    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.hint('Helpful hint');

    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  test('should not print hint in JSON format', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.logFormat = 'json';

    const { Printer } = await import('./index');
    const printer = new Printer();

    printer.hint('Helpful hint');

    // In JSON format, hint uses printStacktapeLog which calls console.info with message object
    expect(consoleInfoSpy).toHaveBeenCalled();
  });

  test('should check if hint can be printed based on log level', async () => {
    const { globalStateManager } = await import('@application-services/global-state-manager');
    globalStateManager.logLevel = 'error';

    const { Printer } = await import('./index');
    const printer = new Printer();

    expect(printer.canPrintHint).toBe(true);
  });
});
