import { describe, expect, mock, test, beforeEach } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    command: 'deploy',
    args: { preserveTempFiles: false },
    invokedFrom: 'cli',
    invocationId: 'test-invocation-id'
  }
}));

mock.module('@config', () => ({
  IS_DEV: false,
  IS_TELEMETRY_DISABLED: false
}));

mock.module('@shared/utils/misc', () => ({
  propertyFromObjectOrNull: mock((obj, prop) => obj?.[prop] || null)
}));

mock.module('@utils/errors', () => {
  class ExpectedError extends Error {
    isExpected = true;
    details = {
      code: 'E001',
      message: 'Expected error',
      sentryEventId: null
    };
  }

  class UnexpectedError extends Error {
    isExpected = false;
    isNewApproachError = true;
    details = {
      code: 'U001',
      message: 'Unexpected error',
      sentryEventId: null
    };
  }

  return {
    ExpectedError,
    UnexpectedError,
    attemptToGetUsefulExpectedError: mock((err) => null),
    getErrorDetails: mock((err) => ({
      code: 'U001',
      message: err.message,
      sentryEventId: null
    })),
    getReturnableError: mock((err) => ({
      message: err.message,
      code: err.details?.code
    }))
  };
});

mock.module('@utils/file-loaders', () => ({
  killPythonBridge: mock(() => {})
}));

mock.module('@utils/printer', () => ({
  printer: {
    stopAllSpinners: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    cleanUpAfterExitSignal: mock(() => {})
  }
}));

mock.module('@utils/sentry', () => ({
  reportErrorToSentry: mock(async () => 'sentry-event-id-123')
}));

mock.module('@utils/telemetry', () => ({
  reportTelemetryEvent: mock(async () => {})
}));

mock.module('@utils/temp-files', () => ({
  deleteTempFolder: mock(async () => {})
}));

mock.module('tree-kill', () => ({
  default: mock((pid, callback) => callback())
}));

describe('application-manager', () => {
  describe('ApplicationManager', () => {
    test('should initialize with default values', async () => {
      const { ApplicationManager } = await import('./index');
      const manager = new ApplicationManager();

      expect(manager.isInitialized).toBe(false);
      expect(manager.isErrored).toBeUndefined();
      expect(manager.isInterrupted).toBe(false);
      expect(manager.cleanUpHooks).toEqual([]);
      expect(manager.pendingCancellablePromises).toEqual({});
    });

    test('should initialize and register process listeners', async () => {
      const { ApplicationManager } = await import('./index');
      const manager = new ApplicationManager();

      await manager.init();

      expect(manager.isInitialized).toBe(true);
      expect(manager.isErrored).toBe(false);
      expect(process.env.NODE_NO_WARNINGS).toBe('1');
    });

    test('should not re-initialize if already initialized', async () => {
      const { ApplicationManager } = await import('./index');
      const manager = new ApplicationManager();

      await manager.init();
      manager.isErrored = true;

      await manager.init();

      // isErrored should be reset even if already initialized
      expect(manager.isErrored).toBe(false);
    });

    describe('setUsesStdinWatch', () => {
      test('should set usesStdinWatch flag', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();

        expect(manager.usesStdinWatch).toBe(false);

        manager.setUsesStdinWatch();

        expect(manager.usesStdinWatch).toBe(true);
      });
    });

    describe('registerCleanUpHook', () => {
      test('should register cleanup hook', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();
        const hook = mock(async () => {});

        manager.registerCleanUpHook(hook);

        expect(manager.cleanUpHooks).toContain(hook);
        expect(manager.cleanUpHooks).toHaveLength(1);
      });

      test('should register multiple cleanup hooks', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();
        const hook1 = mock(async () => {});
        const hook2 = mock(async () => {});
        const hook3 = mock(async () => {});

        manager.registerCleanUpHook(hook1);
        manager.registerCleanUpHook(hook2);
        manager.registerCleanUpHook(hook3);

        expect(manager.cleanUpHooks).toHaveLength(3);
      });
    });

    describe('cleanUpAfterSuccess', () => {
      test('should report success and run cleanup', async () => {
        const { ApplicationManager } = await import('./index');
        const { reportTelemetryEvent } = await import('@utils/telemetry');
        const { deleteTempFolder } = await import('@utils/temp-files');
        const { killPythonBridge } = await import('@utils/file-loaders');

        const manager = new ApplicationManager();
        await manager.init();

        await manager.cleanUpAfterSuccess();

        expect(reportTelemetryEvent).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: 'SUCCESS' })
        );
        expect(deleteTempFolder).toHaveBeenCalled();
        expect(killPythonBridge).toHaveBeenCalled();
      });

      test('should execute cleanup hooks on success', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();
        const hook = mock(async ({ success }) => {
          expect(success).toBe(true);
        });

        manager.registerCleanUpHook(hook);
        await manager.init();

        await manager.cleanUpAfterSuccess();

        expect(hook).toHaveBeenCalledWith(
          expect.objectContaining({ success: true })
        );
      });
    });

    describe('gracefullyHandleError', () => {
      test('should stop spinners and print error', async () => {
        const { ApplicationManager } = await import('./index');
        const { printer } = await import('@utils/printer');
        const manager = new ApplicationManager();

        await manager.init();

        const error = new Error('Test error');
        manager.gracefullyHandleError(error);

        expect(printer.stopAllSpinners).toHaveBeenCalled();
        expect(printer.error).toHaveBeenCalled();
      });

      test('should convert regular error to Stacktape error', async () => {
        const { ApplicationManager } = await import('./index');
        const { printer } = await import('@utils/printer');
        const manager = new ApplicationManager();

        await manager.init();

        const error = new Error('Regular error');
        manager.gracefullyHandleError(error);

        expect(printer.error).toHaveBeenCalled();
      });

      test('should cancel pending promises', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();

        await manager.init();

        const rejectFn = mock(() => {});
        manager.pendingCancellablePromises['test-promise'] = {
          rejectFn,
          name: 'test'
        };

        const error = new Error('Test error');
        manager.gracefullyHandleError(error);

        expect(rejectFn).toHaveBeenCalled();
      });
    });

    describe('handleError', () => {
      test('should handle expected error without Sentry', async () => {
        const { ApplicationManager } = await import('./index');
        const { ExpectedError } = await import('@utils/errors');
        const { reportErrorToSentry } = await import('@utils/sentry');
        const { reportTelemetryEvent } = await import('@utils/telemetry');

        const manager = new ApplicationManager();
        await manager.init();

        const error = new ExpectedError('Expected error');
        await manager.handleError(error);

        expect(reportTelemetryEvent).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: error.details.code })
        );
        expect(reportErrorToSentry).not.toHaveBeenCalled();
      });

      test('should handle unexpected error with Sentry', async () => {
        const { ApplicationManager } = await import('./index');
        const { UnexpectedError } = await import('@utils/errors');
        const { reportErrorToSentry } = await import('@utils/sentry');

        const manager = new ApplicationManager();
        await manager.init();

        const error = new UnexpectedError({ error: new Error('Unexpected') });
        await manager.handleError(error);

        expect(reportErrorToSentry).toHaveBeenCalled();
      });

      test('should not cleanup when interrupted', async () => {
        const { ApplicationManager } = await import('./index');
        const { deleteTempFolder } = await import('@utils/temp-files');
        const manager = new ApplicationManager();

        await manager.init();
        manager.isInterrupted = true;

        const error = new Error('Test error');
        await manager.handleError(error);

        expect(deleteTempFolder).not.toHaveBeenCalled();
      });

      test('should skip cleanup if specified', async () => {
        const { ApplicationManager } = await import('./index');
        const { deleteTempFolder } = await import('@utils/temp-files');
        const manager = new ApplicationManager();

        await manager.init();

        const error = new Error('Test error');
        await manager.handleError(error, true);

        expect(deleteTempFolder).not.toHaveBeenCalled();
      });

      test('should execute cleanup hooks with error', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();
        const hook = mock(async ({ success, err }) => {
          expect(success).toBe(false);
          expect(err).toBeDefined();
        });

        manager.registerCleanUpHook(hook);
        await manager.init();

        const error = new Error('Test error');
        await manager.handleError(error);

        expect(hook).toHaveBeenCalled();
      });

      test('should return returnable error', async () => {
        const { ApplicationManager } = await import('./index');
        const { getReturnableError } = await import('@utils/errors');
        const manager = new ApplicationManager();

        await manager.init();

        const error = new Error('Test error');
        const result = await manager.handleError(error);

        expect(result).toBeDefined();
        expect(getReturnableError).toHaveBeenCalled();
      });
    });

    describe('handleExitSignal', () => {
      test('should handle SIGINT signal', async () => {
        const { ApplicationManager } = await import('./index');
        const { printer } = await import('@utils/printer');
        const { reportTelemetryEvent } = await import('@utils/telemetry');
        const kill = (await import('tree-kill')).default;

        const manager = new ApplicationManager();
        await manager.init();

        await manager.handleExitSignal('SIGINT');

        expect(printer.stopAllSpinners).toHaveBeenCalled();
        expect(printer.info).toHaveBeenCalledWith(expect.stringContaining('SIGINT'));
        expect(reportTelemetryEvent).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: 'USER_INTERRUPTION' })
        );
        expect(kill).toHaveBeenCalled();
        expect(manager.isInterrupted).toBe(true);
      });

      test('should handle SIGTERM signal', async () => {
        const { ApplicationManager } = await import('./index');
        const { printer } = await import('@utils/printer');
        const manager = new ApplicationManager();

        await manager.init();

        await manager.handleExitSignal('SIGTERM');

        expect(printer.info).toHaveBeenCalledWith(expect.stringContaining('SIGTERM'));
      });

      test('should not process signal twice if already interrupted', async () => {
        const { ApplicationManager } = await import('./index');
        const { printer } = await import('@utils/printer');
        const manager = new ApplicationManager();

        await manager.init();
        manager.isInterrupted = true;

        const stopSpinnersCalls = (printer.stopAllSpinners as any).mock.calls.length;
        await manager.handleExitSignal('SIGINT');

        // Should not call stopAllSpinners again
        expect((printer.stopAllSpinners as any).mock.calls.length).toBe(stopSpinnersCalls);
      });

      test('should cleanup stdin when usesStdinWatch is true', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();

        await manager.init();
        manager.setUsesStdinWatch();

        const mockDestroy = mock(() => {});
        process.stdin.destroy = mockDestroy;

        await manager.handleExitSignal('SIGINT');

        expect(mockDestroy).toHaveBeenCalled();
      });

      test('should cleanup printer when usesStdinWatch is false', async () => {
        const { ApplicationManager } = await import('./index');
        const { printer } = await import('@utils/printer');
        const manager = new ApplicationManager();

        await manager.init();

        await manager.handleExitSignal('SIGINT');

        expect(printer.cleanUpAfterExitSignal).toHaveBeenCalled();
      });

      test('should execute cleanup hooks with interrupted flag', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();
        const hook = mock(async ({ success, interrupted }) => {
          expect(success).toBe(false);
          expect(interrupted).toBe(true);
        });

        manager.registerCleanUpHook(hook);
        await manager.init();

        await manager.handleExitSignal('SIGQUIT');

        expect(hook).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      test('should handle cleanup hook errors gracefully', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();

        const failingHook = mock(async () => {
          throw new Error('Cleanup hook failed');
        });

        manager.registerCleanUpHook(failingHook);
        await manager.init();

        // Should not throw
        await manager.cleanUpAfterSuccess();

        expect(failingHook).toHaveBeenCalled();
      });

      test('should handle multiple cleanup hook errors', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();

        const failingHook1 = mock(async () => {
          throw new Error('Hook 1 failed');
        });

        const failingHook2 = mock(async () => {
          throw new Error('Hook 2 failed');
        });

        manager.registerCleanUpHook(failingHook1);
        manager.registerCleanUpHook(failingHook2);
        await manager.init();

        await manager.cleanUpAfterSuccess();

        expect(failingHook1).toHaveBeenCalled();
        expect(failingHook2).toHaveBeenCalled();
      });

      test('should not delete temp folder when preserveTempFiles is true', async () => {
        const { ApplicationManager } = await import('./index');
        const { globalStateManager } = await import('@application-services/global-state-manager');
        const { deleteTempFolder } = await import('@utils/temp-files');

        globalStateManager.args = { preserveTempFiles: true };

        const manager = new ApplicationManager();
        await manager.init();

        await manager.cleanUpAfterSuccess();

        expect(deleteTempFolder).not.toHaveBeenCalled();
      });

      test('should not delete temp folder for package-workloads command', async () => {
        const { ApplicationManager } = await import('./index');
        const { globalStateManager } = await import('@application-services/global-state-manager');
        const { deleteTempFolder } = await import('@utils/temp-files');

        globalStateManager.command = 'package-workloads';
        globalStateManager.args = { preserveTempFiles: false };

        const manager = new ApplicationManager();
        await manager.init();

        await manager.cleanUpAfterSuccess();

        expect(deleteTempFolder).not.toHaveBeenCalled();
      });
    });

    describe('pending promises cancellation', () => {
      test('should cancel all pending promises on error', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();

        await manager.init();

        const rejectFn1 = mock(() => {});
        const rejectFn2 = mock(() => {});
        const rejectFn3 = mock(() => {});

        manager.pendingCancellablePromises = {
          promise1: { rejectFn: rejectFn1, name: 'promise1' },
          promise2: { rejectFn: rejectFn2, name: 'promise2' },
          promise3: { rejectFn: rejectFn3, name: 'promise3' }
        };

        const error = new Error('Test error');
        manager.gracefullyHandleError(error);

        expect(rejectFn1).toHaveBeenCalled();
        expect(rejectFn2).toHaveBeenCalled();
        expect(rejectFn3).toHaveBeenCalled();
      });
    });

    describe('telemetry', () => {
      test('should not report telemetry when disabled', async () => {
        const { ApplicationManager } = await import('./index');
        const { reportTelemetryEvent } = await import('@utils/telemetry');

        // Mock IS_TELEMETRY_DISABLED as true
        const config = await import('@config');
        (config as any).IS_TELEMETRY_DISABLED = true;

        const manager = new ApplicationManager();
        await manager.init();

        const initialCallCount = (reportTelemetryEvent as any).mock.calls.length;

        await manager.cleanUpAfterSuccess();

        // Should not increase call count
        expect((reportTelemetryEvent as any).mock.calls.length).toBe(initialCallCount);

        // Reset for other tests
        (config as any).IS_TELEMETRY_DISABLED = false;
      });

      test('should report telemetry on success', async () => {
        const { ApplicationManager } = await import('./index');
        const { reportTelemetryEvent } = await import('@utils/telemetry');

        const manager = new ApplicationManager();
        await manager.init();

        await manager.cleanUpAfterSuccess();

        expect(reportTelemetryEvent).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: 'SUCCESS' })
        );
      });

      test('should report telemetry on error', async () => {
        const { ApplicationManager } = await import('./index');
        const { reportTelemetryEvent } = await import('@utils/telemetry');
        const { UnexpectedError } = await import('@utils/errors');

        const manager = new ApplicationManager();
        await manager.init();

        const error = new UnexpectedError({ error: new Error('Test') });
        await manager.handleError(error);

        expect(reportTelemetryEvent).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: error.details.code })
        );
      });

      test('should report telemetry on user interruption', async () => {
        const { ApplicationManager } = await import('./index');
        const { reportTelemetryEvent } = await import('@utils/telemetry');

        const manager = new ApplicationManager();
        await manager.init();

        await manager.handleExitSignal('SIGINT');

        expect(reportTelemetryEvent).toHaveBeenCalledWith(
          expect.objectContaining({ outcome: 'USER_INTERRUPTION' })
        );
      });
    });

    describe('dev mode behavior', () => {
      test('should show unhandled errors in dev mode', async () => {
        const { ApplicationManager } = await import('./index');
        const { printer } = await import('@utils/printer');
        const config = await import('@config');

        (config as any).IS_DEV = true;

        const manager = new ApplicationManager();
        await manager.init();

        const error = new Error('Unhandled error');
        error.stack = 'Error stack trace';

        // Trigger uncaught exception handler
        process.emit('uncaughtException', error as any);

        expect(printer.warn).toHaveBeenCalledWith(
          expect.stringContaining('UNCAUGHT EXCEPTION')
        );

        // Reset for other tests
        (config as any).IS_DEV = false;
      });

      test('should handle unhandled promise rejection', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();

        await manager.init();

        const error = new Error('Unhandled rejection');

        // Should not throw
        process.emit('unhandledRejection', error as any);

        expect(manager.isErrored).toBe(true);
      });

      test('should not process unhandled errors when already errored', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();

        await manager.init();
        manager.isErrored = true;

        const rejectFn = mock(() => {});
        manager.pendingCancellablePromises['test'] = {
          rejectFn,
          name: 'test'
        };

        const initialCallCount = rejectFn.mock.calls.length;

        process.emit('uncaughtException', new Error('Test') as any);

        // Should not cancel promises again
        expect(rejectFn.mock.calls.length).toBe(initialCallCount);
      });

      test('should handle non-Error unhandled rejections', async () => {
        const { ApplicationManager } = await import('./index');
        const manager = new ApplicationManager();

        await manager.init();

        // Emit non-Error rejection
        process.emit('unhandledRejection', { message: 'Not an error' } as any);

        expect(manager.isErrored).toBe(true);
      });
    });
  });
});
