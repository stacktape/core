import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock dependencies
const mockGetExecutableScriptFunction = mock((args) => mock(() => {}));
const mockCamelCase = mock((str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase()));
const mockIsCI = false;

const mockGlobalStateManager = {
  command: 'deploy',
  args: ['--stage', 'dev']
};

const mockConfigManager = {
  scripts: {
    'test-script': {
      executeCommand: 'echo test',
      workingDirectory: './'
    }
  },
  invalidatePotentiallyChangedDirectiveResults: mock(() => {})
};

const mockPrinterProgress = mock(() => {});
const mockPrinterGetEventStatus = mock((id) => null);
const mockPrinterRemoveAllFinishedEvents = mock(() => {});

const mockPrinter = {
  progress: mockPrinterProgress,
  getEventStatus: mockPrinterGetEventStatus,
  removeAllFinishedEvents: mockPrinterRemoveAllFinishedEvents
};

const mockStpErrors = {
  e17: mock(({ scriptName }) => new Error(`Script ${scriptName} not found`))
};

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: mockGlobalStateManager
}));

mock.module('@domain-services/config-manager', () => ({
  configManager: mockConfigManager
}));

mock.module('@utils/printer', () => ({
  printer: mockPrinter
}));

mock.module('@errors', () => ({
  stpErrors: mockStpErrors
}));

mock.module('src/commands/script-run/utils', () => ({
  getExecutableScriptFunction: mockGetExecutableScriptFunction
}));

mock.module('change-case', () => ({
  camelCase: mockCamelCase
}));

mock.module('ci-info', () => ({
  default: { isCI: mockIsCI }
}));

describe('EventManager', () => {
  let EventManager: any;
  let EventLog: any;
  let manager: any;

  beforeEach(async () => {
    mock.restore();

    // Clear all mocks
    mockGetExecutableScriptFunction.mockClear();
    mockCamelCase.mockClear();
    mockConfigManager.invalidatePotentiallyChangedDirectiveResults.mockClear();
    mockPrinterProgress.mockClear();
    mockPrinterGetEventStatus.mockClear();
    mockPrinterRemoveAllFinishedEvents.mockClear();
    mockStpErrors.e17.mockClear();

    // Set up default implementations
    mockCamelCase.mockImplementation((str: string) =>
      str.replace(/-([a-z])/g, (g) => g[1].toUpperCase())
    );
    mockGetExecutableScriptFunction.mockImplementation((args) => mock(() => {}));
    mockPrinterGetEventStatus.mockReturnValue(null);

    const module = await import('./index');
    EventManager = module.EventManager;
    const eventLogModule = await import('./event-log');
    EventLog = eventLogModule.EventLog;

    const eventLog = new EventLog();
    manager = new EventManager({
      eventLog,
      hookMap: {},
      namespace: null
    });
    await manager.init();
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      const eventLog = new EventLog();
      const instance = new EventManager({
        eventLog,
        hookMap: {},
        namespace: null
      });
      await instance.init();

      expect(instance).toBeDefined();
      expect(instance.eventLog).toBeDefined();
      expect(instance.hookMap).toEqual({});
      expect(instance.namespace).toBeNull();
    });

    test('should initialize with namespace', async () => {
      const eventLog = new EventLog();
      const namespace = { identifier: 'test-namespace', eventType: 'DEPLOY' as any };
      const instance = new EventManager({
        eventLog,
        hookMap: {},
        namespace
      });

      expect(instance.namespace).toEqual(namespace);
    });

    test('should initialize with existing hookMap', async () => {
      const eventLog = new EventLog();
      const existingHookMap = {
        'beforeDeploy': [mock(() => {})]
      };
      const instance = new EventManager({
        eventLog,
        hookMap: existingHookMap,
        namespace: null
      });

      expect(instance.hookMap).toBe(existingHookMap);
    });

    test('should initialize finalActions as empty array', async () => {
      const eventLog = new EventLog();
      const instance = new EventManager({
        eventLog,
        hookMap: {},
        namespace: null
      });

      expect(instance.finalActions).toEqual([]);
    });
  });

  describe('event lifecycle', () => {
    test('should start event', async () => {
      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack'
      });

      const events = manager.formattedEventLogData;
      expect(events.length).toBeGreaterThan(0);
      expect(mockPrinterProgress).toHaveBeenCalled();
    });

    test('should update event', async () => {
      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack'
      });

      await manager.updateEvent({
        eventType: 'DEPLOY',
        data: { progress: 50 }
      });

      expect(mockPrinterProgress).toHaveBeenCalledTimes(2);
    });

    test('should finish event', async () => {
      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack'
      });

      await manager.finishEvent({
        eventType: 'DEPLOY',
        finalMessage: 'Deployment complete'
      });

      expect(mockPrinterProgress).toHaveBeenCalledTimes(2);
    });

    test('should handle event with data', async () => {
      const eventData = { resourcesCreated: 5, resourcesUpdated: 2 };

      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack',
        data: eventData
      });

      const lastEvent = manager.lastEvent;
      expect(lastEvent).toBeDefined();
      expect(lastEvent.eventType).toBe('DEPLOY');
    });

    test('should handle event with additionalMessage', async () => {
      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack',
        additionalMessage: 'Processing Lambda functions'
      });

      expect(mockPrinterProgress).toHaveBeenCalled();
    });
  });

  describe('hook registration and processing', () => {
    test('should get eligible hook scripts for before hook', () => {
      mockGlobalStateManager.command = 'deploy';

      const hooks = {
        beforeDeploy: [
          { scriptName: 'test-script', skipOnCI: false, skipOnLocal: false }
        ]
      } as any;

      const eligibleScripts = manager.getEligibleHookScripts(hooks);

      expect(eligibleScripts.length).toBe(1);
      expect(eligibleScripts[0].hookTrigger).toBe('beforeDeploy');
      expect(eligibleScripts[0].executeCommand).toBe('echo test');
    });

    test('should get eligible hook scripts for after hook', () => {
      mockGlobalStateManager.command = 'deploy';

      const hooks = {
        afterDeploy: [
          { scriptName: 'test-script', skipOnCI: false, skipOnLocal: false }
        ]
      } as any;

      const eligibleScripts = manager.getEligibleHookScripts(hooks);

      expect(eligibleScripts.length).toBe(1);
      expect(eligibleScripts[0].hookTrigger).toBe('afterDeploy');
    });

    test('should filter scripts based on skipOnLocal', () => {
      mockGlobalStateManager.command = 'deploy';

      const hooks = {
        beforeDeploy: [
          { scriptName: 'test-script', skipOnCI: false, skipOnLocal: true }
        ]
      } as any;

      const eligibleScripts = manager.getEligibleHookScripts(hooks);

      expect(eligibleScripts.length).toBe(0);
    });

    test('should throw error when script not found in configManager', () => {
      mockGlobalStateManager.command = 'deploy';

      const hooks = {
        beforeDeploy: [
          { scriptName: 'non-existent-script', skipOnCI: false, skipOnLocal: false }
        ]
      } as any;

      expect(() => {
        manager.getEligibleHookScripts(hooks);
      }).toThrow();

      expect(mockStpErrors.e17).toHaveBeenCalledWith({
        scriptName: 'non-existent-script'
      });
    });

    test('should register hooks', async () => {
      mockGlobalStateManager.command = 'deploy';

      const hooks = {
        beforeDeploy: [
          { scriptName: 'test-script', skipOnCI: false, skipOnLocal: false }
        ]
      } as any;

      await manager.registerHooks(hooks);

      expect(manager.hookMap.beforeDeploy).toBeDefined();
      expect(manager.hookMap.beforeDeploy.length).toBe(1);
      expect(mockGetExecutableScriptFunction).toHaveBeenCalled();
    });

    test('should register multiple hooks for same trigger', async () => {
      mockGlobalStateManager.command = 'deploy';
      mockConfigManager.scripts['test-script-2'] = {
        executeCommand: 'echo test2',
        workingDirectory: './'
      };

      const hooks = {
        beforeDeploy: [
          { scriptName: 'test-script', skipOnCI: false, skipOnLocal: false },
          { scriptName: 'test-script-2', skipOnCI: false, skipOnLocal: false }
        ]
      } as any;

      await manager.registerHooks(hooks);

      expect(manager.hookMap.beforeDeploy.length).toBe(2);
    });

    test('should process before hooks', async () => {
      mockGlobalStateManager.command = 'deploy';
      const mockHook = mock(async () => {});

      manager.hookMap.beforeDeploy = [mockHook];

      await manager.processHooks({ captureType: 'START' });

      expect(mockHook).toHaveBeenCalledWith({ hookType: 'before' });
    });

    test('should process after hooks', async () => {
      mockGlobalStateManager.command = 'deploy';
      const mockHook = mock(async () => {});

      manager.hookMap.afterDeploy = [mockHook];

      await manager.processHooks({ captureType: 'FINISH' });

      expect(mockHook).toHaveBeenCalledWith({ hookType: 'after' });
    });

    test('should invalidate directive results for afterDeploy hooks', async () => {
      mockGlobalStateManager.command = 'deploy';
      const mockHook = mock(async () => {});

      manager.hookMap.afterDeploy = [mockHook];

      await manager.processHooks({ captureType: 'FINISH' });

      expect(mockConfigManager.invalidatePotentiallyChangedDirectiveResults).toHaveBeenCalled();
    });

    test('should invalidate directive results after beforeDeploy hooks', async () => {
      mockGlobalStateManager.command = 'deploy';
      const mockHook = mock(async () => {});

      manager.hookMap.beforeDeploy = [mockHook];

      await manager.processHooks({ captureType: 'START' });

      expect(mockConfigManager.invalidatePotentiallyChangedDirectiveResults).toHaveBeenCalled();
    });
  });

  describe('getters and utilities', () => {
    test('should get formattedEventLogData', async () => {
      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack'
      });

      const formattedData = manager.formattedEventLogData;

      expect(Array.isArray(formattedData)).toBe(true);
      expect(formattedData.length).toBeGreaterThan(0);
    });

    test('should get lastEvent', async () => {
      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack'
      });

      const lastEvent = manager.lastEvent;

      expect(lastEvent).toBeDefined();
      expect(lastEvent.eventType).toBe('DEPLOY');
    });

    test('should return null for lastEvent when no events', () => {
      const eventLog = new EventLog();
      const newManager = new EventManager({
        eventLog,
        hookMap: {},
        namespace: null
      });

      expect(newManager.lastEvent).toBeNull();
    });

    test('should get event details by eventType', async () => {
      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack'
      });

      const details = manager.getEventDetails('DEPLOY');

      expect(details).toBeDefined();
      expect(details.eventType).toBe('DEPLOY');
    });

    test('should return undefined for non-existent event', () => {
      const details = manager.getEventDetails('NON_EXISTENT' as any);

      expect(details).toBeUndefined();
    });
  });

  describe('namespaced instances', () => {
    test('should create namespaced instance', () => {
      const namespace = {
        identifier: 'resource-resolver',
        eventType: 'RESOLVE_FUNCTIONS' as any
      };

      const namespacedManager = manager.getNamespacedInstance(namespace);

      expect(namespacedManager).toBeDefined();
      expect(namespacedManager.namespace).toEqual(namespace);
      expect(namespacedManager.eventLog).toBe(manager.eventLog);
      expect(namespacedManager.hookMap).toBe(manager.hookMap);
    });

    test('should share event log with parent', async () => {
      const namespace = {
        identifier: 'resource-resolver',
        eventType: 'RESOLVE_FUNCTIONS' as any
      };

      const namespacedManager = manager.getNamespacedInstance(namespace);

      await namespacedManager.startEvent({
        eventType: 'RESOLVE_FUNCTIONS',
        description: 'Resolving functions'
      });

      expect(manager.formattedEventLogData.length).toBeGreaterThan(0);
    });
  });

  describe('final actions', () => {
    test('should add final action', () => {
      const mockAction = mock(() => {});

      manager.addFinalAction(mockAction);

      expect(manager.finalActions.length).toBe(1);
      expect(manager.finalActions[0]).toBe(mockAction);
    });

    test('should add multiple final actions', () => {
      const mockAction1 = mock(() => {});
      const mockAction2 = mock(() => {});

      manager.addFinalAction(mockAction1);
      manager.addFinalAction(mockAction2);

      expect(manager.finalActions.length).toBe(2);
    });

    test('should process final actions', async () => {
      const mockAction1 = mock(async () => {});
      const mockAction2 = mock(async () => {});

      manager.addFinalAction(mockAction1);
      manager.addFinalAction(mockAction2);

      await manager.processFinalActions();

      expect(mockAction1).toHaveBeenCalled();
      expect(mockAction2).toHaveBeenCalled();
    });

    test('should process final actions in parallel', async () => {
      const results: number[] = [];
      const mockAction1 = mock(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        results.push(1);
      });
      const mockAction2 = mock(async () => {
        results.push(2);
      });

      manager.addFinalAction(mockAction1);
      manager.addFinalAction(mockAction2);

      await manager.processFinalActions();

      // Action 2 should complete before action 1 due to parallel execution
      expect(results[0]).toBe(2);
      expect(results[1]).toBe(1);
    });
  });

  describe('progress printing', () => {
    test('should print progress for started events', async () => {
      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack'
      });

      expect(mockPrinterProgress).toHaveBeenCalled();
    });

    test('should skip printing for finished events', async () => {
      mockPrinterGetEventStatus.mockReturnValue('finished');

      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack'
      });

      manager.printProgress();

      // Should be called once during startEvent, but not again during printProgress
      expect(mockPrinterProgress).toHaveBeenCalledTimes(1);
    });

    test('should print progress as UPDATE for ongoing events', async () => {
      let callCount = 0;
      mockPrinterGetEventStatus.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? null : 'in-progress';
      });

      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack'
      });

      await manager.updateEvent({
        eventType: 'DEPLOY',
        data: { progress: 50 }
      });

      expect(mockPrinterProgress).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    test('should reset event log', async () => {
      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack'
      });

      manager.reset();

      expect(manager.formattedEventLogData.length).toBe(0);
    });

    test('should remove all finished events from printer', () => {
      manager.reset();

      expect(mockPrinterRemoveAllFinishedEvents).toHaveBeenCalled();
    });

    test('should clear all events', async () => {
      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Deploying stack'
      });
      await manager.finishEvent({
        eventType: 'DEPLOY'
      });

      expect(manager.formattedEventLogData.length).toBeGreaterThan(0);

      manager.reset();

      expect(manager.formattedEventLogData.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    test('should handle empty hooks object', async () => {
      const hooks = {} as any;

      await manager.registerHooks(hooks);

      expect(Object.keys(manager.hookMap).length).toBe(0);
    });

    test('should handle hooks for non-matching commands', () => {
      mockGlobalStateManager.command = 'delete';

      const hooks = {
        beforeDeploy: [
          { scriptName: 'test-script', skipOnCI: false, skipOnLocal: false }
        ]
      } as any;

      const eligibleScripts = manager.getEligibleHookScripts(hooks);

      expect(eligibleScripts.length).toBe(0);
    });

    test('should handle process hooks with no registered hooks', async () => {
      mockGlobalStateManager.command = 'deploy';

      await manager.processHooks({ captureType: 'START' });

      // Should not throw error
      expect(true).toBe(true);
    });

    test('should handle multiple events of same type', async () => {
      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'First deploy'
      });
      await manager.finishEvent({
        eventType: 'DEPLOY'
      });
      await manager.startEvent({
        eventType: 'DEPLOY',
        description: 'Second deploy'
      });

      const events = manager.formattedEventLogData;
      expect(events.length).toBeGreaterThan(1);
    });

    test('should handle hook execution errors', async () => {
      mockGlobalStateManager.command = 'deploy';
      const errorHook = mock(async () => {
        throw new Error('Hook failed');
      });

      manager.hookMap.beforeDeploy = [errorHook];

      await expect(
        manager.processHooks({ captureType: 'START' })
      ).rejects.toThrow('Hook failed');
    });
  });
});
