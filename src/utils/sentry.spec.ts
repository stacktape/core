import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@config', () => ({
  IS_DEV: false,
  SENTRY_DSN: 'https://test@sentry.io/123',
  SENTRY_CAPTURE_EXCEPTION_WAIT_TIME_MS: 100
}));

mock.module('@sentry/integrations', () => ({
  RewriteFrames: mock(function (opts) {
    this.opts = opts;
  })
}));

mock.module('@sentry/node', () => ({
  init: mock(() => {}),
  setTags: mock(() => {}),
  captureException: mock(() => 'event-id-123')
}));

mock.module('@shared/utils/misc', () => ({
  wait: mock(async (ms) => {})
}));

mock.module('strip-ansi', () => ({
  default: mock((str) => str?.replace(/\x1B\[[0-9;]*m/g, '') || str)
}));

mock.module('./versioning', () => ({
  getStacktapeVersion: mock(() => '1.0.0')
}));

describe('sentry', () => {
  describe('initializeSentry', () => {
    test('should initialize Sentry in production', async () => {
      const { init } = await import('@sentry/node');
      const { initializeSentry } = await import('./sentry');

      initializeSentry();

      expect(init).toHaveBeenCalled();
    });

    test('should use correct DSN', async () => {
      const { init } = await import('@sentry/node');
      const { initializeSentry } = await import('./sentry');

      initializeSentry();

      expect(init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123'
        })
      );
    });

    test('should use Stacktape version as release', async () => {
      const { init } = await import('@sentry/node');
      const { initializeSentry } = await import('./sentry');

      initializeSentry();

      expect(init).toHaveBeenCalledWith(
        expect.objectContaining({
          release: '1.0.0'
        })
      );
    });

    test('should set maxValueLength', async () => {
      const { init } = await import('@sentry/node');
      const { initializeSentry } = await import('./sentry');

      initializeSentry();

      expect(init).toHaveBeenCalledWith(
        expect.objectContaining({
          maxValueLength: 10000
        })
      );
    });

    test('should not initialize in development mode', async () => {
      mock.module('@config', () => ({
        IS_DEV: true,
        SENTRY_DSN: 'https://test@sentry.io/123',
        SENTRY_CAPTURE_EXCEPTION_WAIT_TIME_MS: 100
      }));

      const { init } = await import('@sentry/node');
      const { initializeSentry } = await import('./sentry');

      const callCount = init.mock.calls.length;
      initializeSentry();

      expect(init.mock.calls.length).toBe(callCount);
    });

    test('should include RewriteFrames integration', async () => {
      const { init } = await import('@sentry/node');
      const { initializeSentry } = await import('./sentry');

      initializeSentry();

      expect(init).toHaveBeenCalledWith(
        expect.objectContaining({
          integrations: expect.any(Array)
        })
      );
    });

    test('should strip ANSI codes in beforeBreadcrumb', async () => {
      const { init } = await import('@sentry/node');
      const { initializeSentry } = await import('./sentry');

      initializeSentry();

      const initCall = init.mock.calls[init.mock.calls.length - 1][0];
      const breadcrumb = { message: '\x1B[31mError\x1B[0m' };
      const result = initCall.beforeBreadcrumb(breadcrumb);

      expect(result.message).toBe('Error');
    });
  });

  describe('setSentryTags', () => {
    test('should set tags with invocationId and command', async () => {
      const { setTags } = await import('@sentry/node');
      const { setSentryTags } = await import('./sentry');

      setSentryTags({
        invocationId: 'inv-123',
        command: 'deploy'
      });

      expect(setTags).toHaveBeenCalledWith({
        invocationId: 'inv-123',
        command: 'deploy',
        osPlatform: process.platform
      });
    });

    test('should include OS platform', async () => {
      const { setTags } = await import('@sentry/node');
      const { setSentryTags } = await import('./sentry');

      setSentryTags({
        invocationId: 'inv-456',
        command: 'delete'
      });

      expect(setTags).toHaveBeenCalledWith(
        expect.objectContaining({
          osPlatform: process.platform
        })
      );
    });

    test('should handle different commands', async () => {
      const { setTags } = await import('@sentry/node');
      const { setSentryTags } = await import('./sentry');

      setSentryTags({
        invocationId: 'inv-789',
        command: 'rollback'
      });

      expect(setTags).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'rollback'
        })
      );
    });
  });

  describe('reportErrorToSentry', () => {
    test('should capture exception', async () => {
      const { captureException } = await import('@sentry/node');
      const { reportErrorToSentry } = await import('./sentry');

      const error = new Error('Test error') as any;

      await reportErrorToSentry(error);

      expect(captureException).toHaveBeenCalledWith(error);
    });

    test('should wait after capturing exception', async () => {
      const { wait } = await import('@shared/utils/misc');
      const { reportErrorToSentry } = await import('./sentry');

      const error = new Error('Test error') as any;

      await reportErrorToSentry(error);

      expect(wait).toHaveBeenCalledWith(100);
    });

    test('should return event ID', async () => {
      const { reportErrorToSentry } = await import('./sentry');

      const error = new Error('Test error') as any;

      const eventId = await reportErrorToSentry(error);

      expect(eventId).toBe('event-id-123');
    });

    test('should handle ExpectedError', async () => {
      const { captureException } = await import('@sentry/node');
      const { reportErrorToSentry } = await import('./sentry');

      const error = { type: 'EXPECTED', message: 'Expected error' } as any;

      await reportErrorToSentry(error);

      expect(captureException).toHaveBeenCalledWith(error);
    });

    test('should handle UnexpectedError', async () => {
      const { captureException } = await import('@sentry/node');
      const { reportErrorToSentry } = await import('./sentry');

      const error = { type: 'UNEXPECTED', message: 'Unexpected error', stack: 'stack trace' } as any;

      await reportErrorToSentry(error);

      expect(captureException).toHaveBeenCalledWith(error);
    });
  });
});
