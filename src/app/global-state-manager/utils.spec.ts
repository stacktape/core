import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('node:os', () => ({
  default: {
    hostname: mock(() => 'test-hostname')
  }
}));

mock.module('@config', () => ({
  configurableGlobalDefaultCliArgs: {
    region: { default: 'us-east-1' },
    stage: { default: 'dev' }
  },
  configurableGlobalDefaultOtherProps: {
    autoConfirmOperation: { default: false }
  }
}));

mock.module('@shared/naming/fs-paths', () => ({
  fsPaths: {
    persistedStateFilePath: mock(() => '/home/user/.stacktape/state.json'),
    stacktapeDataFolder: mock(() => '/home/user/.stacktape')
  }
}));

mock.module('@shared/utils/telemetry', () => ({
  upsertUserToMixpanel: mock(async () => {})
}));

mock.module('fs-extra', () => ({
  ensureDir: mock(async () => {}),
  outputJson: mock(async () => {}),
  readJson: mock(async () => ({
    systemId: 'test-system-id',
    cliArgsDefaults: { region: 'us-west-2', stage: 'prod' },
    otherDefaults: { autoConfirmOperation: true }
  }))
}));

describe('global-state-manager/utils', () => {
  beforeEach(() => {
    mock.restore();
  });

  describe('loadPersistedState', () => {
    test('should load persisted state from file', async () => {
      const { loadPersistedState } = await import('./utils');
      const { readJson } = await import('fs-extra');

      const state = await loadPersistedState();

      expect(readJson).toHaveBeenCalled();
      expect(state).toHaveProperty('systemId', 'test-system-id');
      expect(state).toHaveProperty('cliArgsDefaults');
      expect(state).toHaveProperty('otherDefaults');
    });

    test('should return default state when file does not exist', async () => {
      const { readJson } = await import('fs-extra');
      (readJson as any).mockImplementation(async () => {
        throw new Error('ENOENT: no such file or directory');
      });

      const { loadPersistedState } = await import('./utils');

      const state = await loadPersistedState();

      expect(state.systemId).toBeNull();
      expect(state.cliArgsDefaults).toEqual({ region: 'us-east-1', stage: 'dev' });
      expect(state.otherDefaults).toEqual({ autoConfirmOperation: false });
    });

    test('should use configured defaults when initializing', async () => {
      const { readJson } = await import('fs-extra');
      (readJson as any).mockImplementation(async () => {
        throw new Error('File not found');
      });

      const { loadPersistedState } = await import('./utils');

      const state = await loadPersistedState();

      expect(state.cliArgsDefaults.region).toBe('us-east-1');
      expect(state.cliArgsDefaults.stage).toBe('dev');
      expect(state.otherDefaults.autoConfirmOperation).toBe(false);
    });
  });

  describe('savePersistedState', () => {
    test('should save persisted state to file', async () => {
      const { savePersistedState } = await import('./utils');
      const { outputJson, ensureDir } = await import('fs-extra');

      const state = {
        systemId: 'new-system-id',
        cliArgsDefaults: { region: 'eu-west-1', stage: 'staging' },
        otherDefaults: { autoConfirmOperation: true }
      } as any;

      await savePersistedState(state);

      expect(ensureDir).toHaveBeenCalledWith('/home/user/.stacktape');
      expect(outputJson).toHaveBeenCalledWith('/home/user/.stacktape/state.json', state);
    });

    test('should only ensure directory once', async () => {
      const { savePersistedState } = await import('./utils');
      const { ensureDir } = await import('fs-extra');

      const state = {
        systemId: 'test-id',
        cliArgsDefaults: {},
        otherDefaults: {}
      } as any;

      await savePersistedState(state);
      await savePersistedState(state);

      expect(ensureDir).toHaveBeenCalledTimes(1);
    });
  });

  describe('createTemporaryMixpanelUser', () => {
    test('should create Mixpanel user with system info', async () => {
      const { createTemporaryMixpanelUser } = await import('./utils');
      const { upsertUserToMixpanel } = await import('@shared/utils/telemetry');

      await createTemporaryMixpanelUser('system-123');

      expect(upsertUserToMixpanel).toHaveBeenCalledWith('system-123', {
        $name: 'test-hostname',
        locale: expect.any(String),
        timeZone: expect.any(String)
      });
    });

    test('should use system hostname as user name', async () => {
      const { createTemporaryMixpanelUser } = await import('./utils');
      const { upsertUserToMixpanel } = await import('@shared/utils/telemetry');

      await createTemporaryMixpanelUser('system-456');

      const callArgs = (upsertUserToMixpanel as any).mock.calls[0][1];
      expect(callArgs.$name).toBe('test-hostname');
    });

    test('should include locale and timezone information', async () => {
      const { createTemporaryMixpanelUser } = await import('./utils');
      const { upsertUserToMixpanel } = await import('@shared/utils/telemetry');

      await createTemporaryMixpanelUser('system-789');

      const callArgs = (upsertUserToMixpanel as any).mock.calls[0][1];
      expect(callArgs).toHaveProperty('locale');
      expect(callArgs).toHaveProperty('timeZone');
    });
  });
});
