import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    systemId: 'test-system-id-123'
  }
}));

mock.module('@shared/utils/misc', () => ({
  getTimeSinceProcessStart: mock(() => 1234)
}));

mock.module('@shared/utils/telemetry', () => ({
  trackEventToMixpanel: mock(async (event, data) => {})
}));

mock.module('@utils/versioning', () => ({
  getStacktapeVersion: mock(() => '2.5.0')
}));

describe('telemetry', () => {
  describe('reportTelemetryEvent', () => {
    test('should call trackEventToMixpanel with correct event name', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: { stage: 'dev' } as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-123'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.any(Object)
      );
    });

    test('should include systemId in telemetry data', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-123'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          distinct_id: 'test-system-id-123'
        })
      );
    });

    test('should include command in telemetry data', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'delete',
        invokedFrom: 'cli',
        invocationId: 'inv-456'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          command: 'delete'
        })
      );
    });

    test('should extract CLI args keys', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: { stage: 'dev', region: 'us-east-1' } as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-789'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          cliArgs: ['stage', 'region']
        })
      );
    });

    test('should handle null args', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: null as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-null'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          cliArgs: null
        })
      );
    });

    test('should include duration from process start', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-123'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          duration: 1234
        })
      );
    });

    test('should include outcome in telemetry data', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'error',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-error'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          outcome: 'error'
        })
      );
    });

    test('should include locale in telemetry data', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-123'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          locale: expect.any(String)
        })
      );
    });

    test('should include timeZone in telemetry data', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-123'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          timeZone: expect.any(String)
        })
      );
    });

    test('should include Stacktape version', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-123'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          version: '2.5.0'
        })
      );
    });

    test('should include platform', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-123'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          platform: process.platform
        })
      );
    });

    test('should include invokedFrom', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'sdk',
        invocationId: 'inv-sdk'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          invokedFrom: 'sdk'
        })
      );
    });

    test('should include invocationId', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'unique-inv-id-789'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          invocationId: 'unique-inv-id-789'
        })
      );
    });

    test('should handle different commands', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'rollback',
        invokedFrom: 'cli',
        invocationId: 'inv-rollback'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          command: 'rollback'
        })
      );
    });

    test('should handle server invocation', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'server',
        invocationId: 'inv-server'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          invokedFrom: 'server'
        })
      );
    });

    test('should handle empty args object', async () => {
      const { trackEventToMixpanel } = await import('@shared/utils/telemetry');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-empty'
      });

      expect(trackEventToMixpanel).toHaveBeenCalledWith(
        'execute command',
        expect.objectContaining({
          cliArgs: []
        })
      );
    });

    test('should call getTimeSinceProcessStart', async () => {
      const { getTimeSinceProcessStart } = await import('@shared/utils/misc');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-123'
      });

      expect(getTimeSinceProcessStart).toHaveBeenCalled();
    });

    test('should call getStacktapeVersion', async () => {
      const { getStacktapeVersion } = await import('@utils/versioning');
      const { reportTelemetryEvent } = await import('./telemetry');

      await reportTelemetryEvent({
        outcome: 'success',
        args: {} as any,
        command: 'deploy',
        invokedFrom: 'cli',
        invocationId: 'inv-123'
      });

      expect(getStacktapeVersion).toHaveBeenCalled();
    });
  });
});
