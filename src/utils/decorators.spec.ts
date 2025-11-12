import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@application-services/application-manager', () => ({
  applicationManager: {
    pendingCancellablePromises: {}
  }
}));

mock.module('@application-services/global-state-manager', () => ({
  globalStateManager: {
    initializedDomainServices: [],
    markDomainServiceAsInitialized: mock((name) => {
      const { globalStateManager } = require('@application-services/global-state-manager');
      globalStateManager.initializedDomainServices.push(name);
    })
  }
}));

mock.module('@shared/utils/misc', () => ({
  isPromise: mock((value) => value instanceof Promise)
}));

mock.module('./uuid', () => ({
  generateUuid: mock(() => 'test-uuid-123')
}));

describe('decorators', () => {
  describe('memoizeGetters', () => {
    test('should memoize getter values', async () => {
      const { memoizeGetters } = await import('./decorators');

      let callCount = 0;

      class TestClass {
        get value() {
          callCount++;
          return 'computed-value';
        }
      }

      memoizeGetters(TestClass);
      const instance = new TestClass();

      expect(instance.value).toBe('computed-value');
      expect(instance.value).toBe('computed-value');
      expect(callCount).toBe(1);
    });

    test('should cache different values for different instances', async () => {
      const { memoizeGetters } = await import('./decorators');

      let counter = 0;

      class TestClass {
        get value() {
          return ++counter;
        }
      }

      memoizeGetters(TestClass);
      const instance1 = new TestClass();
      const instance2 = new TestClass();

      expect(instance1.value).toBe(1);
      expect(instance2.value).toBe(2);
      expect(instance1.value).toBe(1);
      expect(instance2.value).toBe(2);
    });

    test('should handle getters that return objects', async () => {
      const { memoizeGetters } = await import('./decorators');

      class TestClass {
        get config() {
          return { setting: 'value' };
        }
      }

      memoizeGetters(TestClass);
      const instance = new TestClass();

      const first = instance.config;
      const second = instance.config;

      expect(first).toBe(second);
    });

    test('should handle multiple getters', async () => {
      const { memoizeGetters } = await import('./decorators');

      let count1 = 0;
      let count2 = 0;

      class TestClass {
        get value1() {
          count1++;
          return 'value1';
        }

        get value2() {
          count2++;
          return 'value2';
        }
      }

      memoizeGetters(TestClass);
      const instance = new TestClass();

      instance.value1;
      instance.value1;
      instance.value2;
      instance.value2;

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    test('should not affect regular methods', async () => {
      const { memoizeGetters } = await import('./decorators');

      let methodCallCount = 0;

      class TestClass {
        get value() {
          return 'getter-value';
        }

        method() {
          methodCallCount++;
          return 'method-value';
        }
      }

      memoizeGetters(TestClass);
      const instance = new TestClass();

      instance.method();
      instance.method();

      expect(methodCallCount).toBe(2);
    });

    test('should handle getters in inheritance chain', async () => {
      const { memoizeGetters } = await import('./decorators');

      class BaseClass {
        get baseValue() {
          return 'base';
        }
      }

      class ChildClass extends BaseClass {
        get childValue() {
          return 'child';
        }
      }

      memoizeGetters(ChildClass);
      const instance = new ChildClass();

      expect(instance.baseValue).toBe('base');
      expect(instance.childValue).toBe('child');
    });
  });

  describe('skipInitIfInitialized', () => {
    test('should call init on first invocation', async () => {
      const { globalStateManager } = await import('@application-services/global-state-manager');
      const { skipInitIfInitialized } = await import('./decorators');

      globalStateManager.initializedDomainServices = [];

      let initCalled = 0;

      class TestService {
        async init() {
          initCalled++;
        }
      }

      const instance = skipInitIfInitialized(new TestService());
      await instance.init();

      expect(initCalled).toBe(1);
    });

    test('should skip init on subsequent invocations', async () => {
      const { globalStateManager } = await import('@application-services/global-state-manager');
      const { skipInitIfInitialized } = await import('./decorators');

      globalStateManager.initializedDomainServices = [];

      let initCalled = 0;

      class TestService {
        async init() {
          initCalled++;
        }
      }

      const instance = skipInitIfInitialized(new TestService());
      await instance.init();
      await instance.init();
      await instance.init();

      expect(initCalled).toBe(1);
    });

    test('should mark service as initialized', async () => {
      const { globalStateManager } = await import('@application-services/global-state-manager');
      const { skipInitIfInitialized } = await import('./decorators');

      globalStateManager.initializedDomainServices = [];

      class TestService {
        async init() {}
      }

      const instance = skipInitIfInitialized(new TestService());
      await instance.init();

      expect(globalStateManager.markDomainServiceAsInitialized).toHaveBeenCalledWith('TestService');
    });

    test('should handle init with arguments', async () => {
      const { globalStateManager } = await import('@application-services/global-state-manager');
      const { skipInitIfInitialized } = await import('./decorators');

      globalStateManager.initializedDomainServices = [];

      let receivedArgs;

      class TestService {
        async init(...args: any[]) {
          receivedArgs = args;
        }
      }

      const instance = skipInitIfInitialized(new TestService());
      await instance.init('arg1', 'arg2');

      expect(receivedArgs).toEqual(['arg1', 'arg2']);
    });

    test('should skip when STP_INVOKED_FROM is server', async () => {
      const { skipInitIfInitialized } = await import('./decorators');

      const originalEnv = process.env.STP_INVOKED_FROM;
      process.env.STP_INVOKED_FROM = 'server';

      let initCalled = 0;

      class TestService {
        async init() {
          initCalled++;
        }
      }

      const instance = skipInitIfInitialized(new TestService());
      await instance.init();
      await instance.init();

      expect(initCalled).toBe(2);

      process.env.STP_INVOKED_FROM = originalEnv;
    });

    test('should return promise from init', async () => {
      const { globalStateManager } = await import('@application-services/global-state-manager');
      const { skipInitIfInitialized } = await import('./decorators');

      globalStateManager.initializedDomainServices = [];

      class TestService {
        async init() {
          return 'result';
        }
      }

      const instance = skipInitIfInitialized(new TestService());
      const result = await instance.init();

      expect(result).toBe('result');
    });
  });

  describe('cancelablePublicMethods', () => {
    test('should track promise in applicationManager', async () => {
      const { applicationManager } = await import('@application-services/application-manager');
      const { cancelablePublicMethods } = await import('./decorators');

      applicationManager.pendingCancellablePromises = {};

      class TestService {
        async asyncMethod() {
          return 'result';
        }
      }

      const instance = cancelablePublicMethods(new TestService());
      const promise = instance.asyncMethod();

      expect(Object.keys(applicationManager.pendingCancellablePromises).length).toBe(1);

      await promise;
    });

    test('should remove promise from tracking after resolution', async () => {
      const { applicationManager } = await import('@application-services/application-manager');
      const { cancelablePublicMethods } = await import('./decorators');

      applicationManager.pendingCancellablePromises = {};

      class TestService {
        async asyncMethod() {
          return 'result';
        }
      }

      const instance = cancelablePublicMethods(new TestService());
      await instance.asyncMethod();

      expect(Object.keys(applicationManager.pendingCancellablePromises).length).toBe(0);
    });

    test('should store reject function for promise', async () => {
      const { applicationManager } = await import('@application-services/application-manager');
      const { cancelablePublicMethods } = await import('./decorators');

      applicationManager.pendingCancellablePromises = {};

      class TestService {
        async asyncMethod() {
          return 'result';
        }
      }

      const instance = cancelablePublicMethods(new TestService());
      const promise = instance.asyncMethod();

      const promiseId = Object.keys(applicationManager.pendingCancellablePromises)[0];
      expect(applicationManager.pendingCancellablePromises[promiseId].rejectFn).toBeFunction();

      await promise;
    });

    test('should store method name in promise tracking', async () => {
      const { applicationManager } = await import('@application-services/application-manager');
      const { cancelablePublicMethods } = await import('./decorators');

      applicationManager.pendingCancellablePromises = {};

      class TestService {
        async myMethod() {
          return 'result';
        }
      }

      const instance = cancelablePublicMethods(new TestService());
      const promise = instance.myMethod();

      const promiseId = Object.keys(applicationManager.pendingCancellablePromises)[0];
      expect(applicationManager.pendingCancellablePromises[promiseId].name).toBe('TestService.myMethod');

      await promise;
    });

    test('should not affect synchronous methods', async () => {
      const { applicationManager } = await import('@application-services/application-manager');
      const { cancelablePublicMethods } = await import('./decorators');

      applicationManager.pendingCancellablePromises = {};

      class TestService {
        syncMethod() {
          return 'sync-result';
        }
      }

      const instance = cancelablePublicMethods(new TestService());
      const result = instance.syncMethod();

      expect(result).toBe('sync-result');
      expect(Object.keys(applicationManager.pendingCancellablePromises).length).toBe(0);
    });

    test('should return original promise result', async () => {
      const { cancelablePublicMethods } = await import('./decorators');

      class TestService {
        async asyncMethod() {
          return 'expected-result';
        }
      }

      const instance = cancelablePublicMethods(new TestService());
      const result = await instance.asyncMethod();

      expect(result).toBe('expected-result');
    });

    test('should handle promise rejection', async () => {
      const { applicationManager } = await import('@application-services/application-manager');
      const { cancelablePublicMethods } = await import('./decorators');

      applicationManager.pendingCancellablePromises = {};

      class TestService {
        async asyncMethod() {
          throw new Error('test error');
        }
      }

      const instance = cancelablePublicMethods(new TestService());

      try {
        await instance.asyncMethod();
      } catch (err) {
        expect(err.message).toBe('test error');
      }
    });

    test('should generate UUID for each promise', async () => {
      const { generateUuid } = await import('./uuid');
      const { cancelablePublicMethods } = await import('./decorators');

      class TestService {
        async method1() {
          return 'result1';
        }

        async method2() {
          return 'result2';
        }
      }

      const instance = cancelablePublicMethods(new TestService());
      instance.method1();
      instance.method2();

      expect(generateUuid).toHaveBeenCalledTimes(2);
    });

    test('should handle multiple concurrent promises', async () => {
      const { applicationManager } = await import('@application-services/application-manager');
      const { cancelablePublicMethods } = await import('./decorators');

      applicationManager.pendingCancellablePromises = {};

      class TestService {
        async asyncMethod(delay: number) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return delay;
        }
      }

      const instance = cancelablePublicMethods(new TestService());
      const promise1 = instance.asyncMethod(10);
      const promise2 = instance.asyncMethod(20);

      expect(Object.keys(applicationManager.pendingCancellablePromises).length).toBe(2);

      await Promise.all([promise1, promise2]);

      expect(Object.keys(applicationManager.pendingCancellablePromises).length).toBe(0);
    });
  });
});
