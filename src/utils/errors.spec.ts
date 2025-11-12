import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/event-manager', () => ({
  eventManager: {
    lastEvent: { eventType: 'TEST_EVENT' }
  }
}));

mock.module('@config', () => ({
  IS_DEV: true
}));

mock.module('@shared/utils/fs-utils', () => ({
  getRelativePath: mock((path) => path.replace('/home/user/project/', '')),
  isFileAccessible: mock(() => true)
}));

mock.module('stack-trace', () => ({
  default: {
    parse: mock((error) => [
      {
        fileName: '/home/user/project/src/index.ts',
        lineNumber: 10,
        columnNumber: 5,
        functionName: 'myFunction',
        native: false
      },
      {
        fileName: '/home/user/project/node_modules/lodash/index.js',
        lineNumber: 100,
        columnNumber: 20,
        functionName: 'lodashFunc',
        native: false
      },
      {
        fileName: 'internal/process.js',
        lineNumber: 50,
        functionName: null,
        native: true
      }
    ])
  }
}));

mock.module('strip-ansi', () => ({
  default: mock((str) => str.replace(/\x1b\[[0-9;]*m/g, ''))
}));

mock.module('./printer', () => ({
  printer: {
    colorize: mock((color, text) => text),
    makeBold: mock((text) => text)
  }
}));

describe('errors', () => {
  describe('ExpectedError', () => {
    test('should create expected error with message', async () => {
      const { ExpectedError } = await import('./errors');
      const error = new ExpectedError('CONFIG', 'Test error message');
      expect(error.message).toBe('Test error message');
      expect(error.type).toBe('CONFIG');
      expect(error.isExpected).toBe(true);
    });

    test('should create expected error with hint', async () => {
      const { ExpectedError } = await import('./errors');
      const error = new ExpectedError('CONFIG', 'Test error', 'This is a hint');
      expect(error.hint).toBe('This is a hint');
    });

    test('should create expected error with array of hints', async () => {
      const { ExpectedError } = await import('./errors');
      const error = new ExpectedError('CONFIG', 'Test error', ['Hint 1', 'Hint 2']);
      expect(error.hint).toEqual(['Hint 1', 'Hint 2']);
    });

    test('should create expected error with metadata', async () => {
      const { ExpectedError } = await import('./errors');
      const error = new ExpectedError('CONFIG', 'Test error', null, { key: 'value' });
      expect(error.metadata).toEqual({ key: 'value' });
    });

    test('should have error details', async () => {
      const { ExpectedError } = await import('./errors');
      const error = new ExpectedError('CONFIG', 'Test error');
      expect(error.details).toBeDefined();
      expect(error.details.errorType).toBe('CONFIG_ERROR');
    });

    test('should set name to error type', async () => {
      const { ExpectedError } = await import('./errors');
      const error = new ExpectedError('VALIDATION', 'Test error');
      expect(error.name).toBe('VALIDATION');
    });
  });

  describe('UnexpectedError', () => {
    test('should create unexpected error from Error', async () => {
      const { UnexpectedError } = await import('./errors');
      const originalError = new Error('Original error');
      const error = new UnexpectedError({ error: originalError });
      expect(error.message).toContain('Original error');
      expect(error.isExpected).toBe(false);
    });

    test('should create unexpected error with custom message', async () => {
      const { UnexpectedError } = await import('./errors');
      const error = new UnexpectedError({ customMessage: 'Custom message' });
      expect(error.message).toContain('Custom message');
    });

    test('should include last captured event', async () => {
      const { UnexpectedError } = await import('./errors');
      const error = new UnexpectedError({ customMessage: 'Test' });
      expect(error.message).toContain('Last captured event: TEST_EVENT');
    });

    test('should preserve stack from original error', async () => {
      const { UnexpectedError } = await import('./errors');
      const originalError = new Error('Test');
      originalError.stack = 'custom stack trace';
      const error = new UnexpectedError({ error: originalError });
      expect(error.stack).toBe('custom stack trace');
    });

    test('should have error details', async () => {
      const { UnexpectedError } = await import('./errors');
      const error = new UnexpectedError({ customMessage: 'Test' });
      expect(error.details).toBeDefined();
      expect(error.details.errorType).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('UserCodeError', () => {
    test('should create user code error', async () => {
      const { UserCodeError } = await import('./errors');
      const originalError = new Error('User code failed');
      const error = new UserCodeError('Error in user code', originalError);
      expect(error.message).toContain('Error in user code');
      expect(error.message).toContain('User code failed');
      expect(error.type).toBe('SOURCE_CODE');
    });

    test('should preserve original error stack', async () => {
      const { UserCodeError } = await import('./errors');
      const originalError = new Error('Test');
      originalError.stack = 'original stack';
      const error = new UserCodeError('Wrapper message', originalError);
      expect(error.stack).toBe('original stack');
    });

    test('should combine hints', async () => {
      const { UserCodeError, ExpectedError } = await import('./errors');
      const originalError = new ExpectedError('SOURCE_CODE', 'Original', 'Original hint');
      const error = new UserCodeError('Wrapper', originalError, 'Wrapper hint');
      expect(error.hint).toContain('Wrapper hint');
      expect(error.hint).toContain('Original hint');
    });

    test('should handle array hints', async () => {
      const { UserCodeError } = await import('./errors');
      const originalError = new Error('Test');
      const error = new UserCodeError('Wrapper', originalError, ['Hint 1', 'Hint 2']);
      expect(error.hint).toEqual(['Hint 1', 'Hint 2']);
    });
  });

  describe('getErrorDetails', () => {
    test('should get details for expected error', async () => {
      const { ExpectedError, getErrorDetails } = await import('./errors');
      const error = new ExpectedError('CONFIG', 'Test error');
      const details = getErrorDetails(error);
      expect(details.errorType).toBe('CONFIG_ERROR');
      expect(details.prettyStackTrace).toBeDefined();
    });

    test('should get details for unexpected error', async () => {
      const { UnexpectedError, getErrorDetails } = await import('./errors');
      const error = new UnexpectedError({ customMessage: 'Test' });
      const details = getErrorDetails(error);
      expect(details.errorType).toBe('UNEXPECTED_ERROR');
    });

    test('should include code for expected errors', async () => {
      const { ExpectedError, getErrorDetails } = await import('./errors');
      const error = new ExpectedError('VALIDATION', 'Test');
      const details = getErrorDetails(error);
      expect(details.code).toContain('VALIDATION_ERROR');
    });
  });

  describe('getReturnableError', () => {
    test('should create returnable error from expected error', async () => {
      const { ExpectedError, getReturnableError } = await import('./errors');
      const error = new ExpectedError('CONFIG', 'Test error', 'Hint text');
      const returnable = getReturnableError(error);
      expect(returnable.message).toBe('Test error');
      expect((returnable as any).details.hints).toEqual(['Hint text']);
    });

    test('should strip ANSI codes from message', async () => {
      const { ExpectedError, getReturnableError } = await import('./errors');
      const error = new ExpectedError('CONFIG', '\x1b[31mRed text\x1b[0m');
      const returnable = getReturnableError(error);
      expect(returnable.message).toBe('Red text');
    });

    test('should include error type in details', async () => {
      const { ExpectedError, getReturnableError } = await import('./errors');
      const error = new ExpectedError('VALIDATION', 'Test');
      const returnable = getReturnableError(error);
      expect((returnable as any).details.errorType).toBe('VALIDATION_ERROR');
    });

    test('should handle array of hints', async () => {
      const { ExpectedError, getReturnableError } = await import('./errors');
      const error = new ExpectedError('CONFIG', 'Test', ['Hint 1', 'Hint 2']);
      const returnable = getReturnableError(error);
      expect((returnable as any).details.hints).toEqual(['Hint 1', 'Hint 2']);
    });
  });

  describe('getPrettyStacktrace', () => {
    test('should generate pretty stack trace', async () => {
      const { ExpectedError, getPrettyStacktrace } = await import('./errors');
      const error = new ExpectedError('CONFIG', 'Test');
      const stack = getPrettyStacktrace(error);
      expect(stack).toBeDefined();
      expect(typeof stack).toBe('string');
    });

    test('should colorize own code', async () => {
      const { ExpectedError, getPrettyStacktrace } = await import('./errors');
      const error = new ExpectedError('CONFIG', 'Test');
      const colorize = mock((text) => `<cyan>${text}</cyan>`);
      const stack = getPrettyStacktrace(error, colorize);
      expect(colorize).toHaveBeenCalled();
    });

    test('should filter out internal frames', async () => {
      const { ExpectedError, getPrettyStacktrace } = await import('./errors');
      const error = new ExpectedError('CONFIG', 'Test');
      const stack = getPrettyStacktrace(error);
      expect(stack).not.toContain('internal/');
    });

    test('should show user code differently than dependencies', async () => {
      const { ExpectedError, getPrettyStacktrace } = await import('./errors');
      const error = new ExpectedError('CONFIG', 'Test');
      const ownColorize = mock((text) => `<cyan>${text}</cyan>`);
      const depColorize = mock((text) => `<gray>${text}</gray>`);
      getPrettyStacktrace(error, ownColorize, depColorize);
      expect(ownColorize).toHaveBeenCalled();
    });
  });

  describe('attemptToGetUsefulExpectedError', () => {
    test('should detect ENOSPC error', async () => {
      const { attemptToGetUsefulExpectedError } = await import('./errors');
      const error = new Error('ENOSPC: no space left on device');
      const result = attemptToGetUsefulExpectedError(error);
      expect(result).toBeDefined();
      expect(result.type).toBe('DEVICE');
    });

    test('should return null for non-ENOSPC errors', async () => {
      const { attemptToGetUsefulExpectedError } = await import('./errors');
      const error = new Error('Some other error');
      const result = attemptToGetUsefulExpectedError(error);
      expect(result).toBeNull();
    });

    test('should provide helpful hint for ENOSPC', async () => {
      const { attemptToGetUsefulExpectedError } = await import('./errors');
      const error = new Error('ENOSPC: disk full');
      const result = attemptToGetUsefulExpectedError(error);
      expect(result.hint).toContain('free up some space');
    });
  });

  describe('getErrorFromString', () => {
    test('should parse error from string', async () => {
      const { getErrorFromString } = await import('./errors');
      const errorString = 'Error: Test error\n    at myFunction (file.ts:10:5)';
      const result = getErrorFromString(errorString);
      expect(result).toContain('Test error');
    });

    test('should handle multi-line errors', async () => {
      const { getErrorFromString } = await import('./errors');
      const errorString = 'Error: First line\nSecond line\n    at func (file.ts:1:1)';
      const result = getErrorFromString(errorString);
      expect(result).toBeDefined();
    });

    test('should format with bold message', async () => {
      const { getErrorFromString } = await import('./errors');
      const errorString = 'Error: Test\n    at func (file.ts:1:1)';
      const result = getErrorFromString(errorString);
      expect(result).toContain('Test');
    });

    test('should handle stacktape-built image errors', async () => {
      const { getErrorFromString } = await import('./errors');
      const errorString = 'Something\n\nActual error message\n    at func (/app/index.js:1:1)';
      const result = getErrorFromString(errorString);
      expect(result).toContain('Actual error message');
    });
  });
});
