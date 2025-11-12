import { describe, expect, mock, test } from 'bun:test';

// Mock all dependencies
mock.module('@errors', () => ({
  stpErrors: {
    e60: mock(({ alarmReference, referencedFrom, referencedFromType }) => {
      const error = new Error(
        `Alarm ${alarmReference} referenced from ${referencedFromType || 'resource'} ${referencedFrom} not found`
      );
      (error as any).type = 'CONFIG_VALIDATION';
      return error;
    })
  }
}));

mock.module('@shared/naming/utils', () => ({
  getStpNameForAlarm: mock(({ nameChain, alarmTriggerType, alarmIndexOrGlobalAlarmName }) => {
    return `${nameChain.join('.')}.alarm.${alarmTriggerType}.${alarmIndexOrGlobalAlarmName}`;
  })
}));

mock.module('lodash/isEqual', () => ({
  default: mock((a, b) => JSON.stringify(a) === JSON.stringify(b))
}));

mock.module('../index', () => ({
  configManager: {
    allAlarms: [
      {
        name: 'highCpu',
        nameChain: ['highCpu'],
        trigger: { type: 'lambda-error-rate' },
        forServices: ['*'],
        forStages: ['*']
      },
      {
        name: 'dbConnections',
        nameChain: ['dbConnections'],
        trigger: { type: 'database-connection-count' },
        forServices: ['myService'],
        forStages: ['prod']
      },
      {
        name: 'nested.alarm',
        nameChain: ['nested', 'alarm'],
        trigger: { type: 'http-api-gateway-error-rate' },
        forServices: ['*'],
        forStages: ['*']
      }
    ]
  }
}));

describe('config-manager/utils/alarms', () => {
  describe('resolveReferenceToAlarm', () => {
    test('should resolve simple alarm reference', async () => {
      const { resolveReferenceToAlarm } = await import('./alarms');

      const result = resolveReferenceToAlarm({
        stpAlarmReference: 'highCpu',
        referencedFrom: 'myFunction',
        referencedFromType: 'function'
      });

      expect(result.name).toBe('highCpu');
      expect(result.trigger.type).toBe('lambda-error-rate');
    });

    test('should resolve nested alarm reference', async () => {
      const { resolveReferenceToAlarm } = await import('./alarms');

      const result = resolveReferenceToAlarm({
        stpAlarmReference: 'nested.alarm',
        referencedFrom: 'myApi',
        referencedFromType: 'http-api-gateway'
      });

      expect(result.name).toBe('nested.alarm');
      expect(result.nameChain).toEqual(['nested', 'alarm']);
    });

    test('should throw error for non-existent alarm', async () => {
      const { resolveReferenceToAlarm } = await import('./alarms');

      expect(() =>
        resolveReferenceToAlarm({
          stpAlarmReference: 'nonExistent',
          referencedFrom: 'myResource',
          referencedFromType: 'function'
        })
      ).toThrow();
    });

    test('should include reference details in error message', async () => {
      const { resolveReferenceToAlarm } = await import('./alarms');

      try {
        resolveReferenceToAlarm({
          stpAlarmReference: 'missingAlarm',
          referencedFrom: 'testFunction',
          referencedFromType: 'function'
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('missingAlarm');
        expect(error.message).toContain('testFunction');
      }
    });

    test('should resolve alarm without referencedFromType', async () => {
      const { resolveReferenceToAlarm } = await import('./alarms');

      const result = resolveReferenceToAlarm({
        stpAlarmReference: 'highCpu',
        referencedFrom: 'myFunction'
      });

      expect(result).toBeDefined();
    });
  });

  describe('isGlobalAlarmEligibleForStack', () => {
    test('should return true for wildcard service and stage', async () => {
      const { isGlobalAlarmEligibleForStack } = await import('./alarms');

      const alarm: any = {
        name: 'globalAlarm',
        forServices: ['*'],
        forStages: ['*']
      };

      const result = isGlobalAlarmEligibleForStack({
        alarm,
        projectName: 'anyProject',
        stage: 'anyStage'
      });

      expect(result).toBe(true);
    });

    test('should return true for specific matching service and wildcard stage', async () => {
      const { isGlobalAlarmEligibleForStack } = await import('./alarms');

      const alarm: any = {
        name: 'serviceAlarm',
        forServices: ['myService'],
        forStages: ['*']
      };

      const result = isGlobalAlarmEligibleForStack({
        alarm,
        projectName: 'myService',
        stage: 'dev'
      });

      expect(result).toBe(true);
    });

    test('should return true for wildcard service and specific matching stage', async () => {
      const { isGlobalAlarmEligibleForStack } = await import('./alarms');

      const alarm: any = {
        name: 'stageAlarm',
        forServices: ['*'],
        forStages: ['prod']
      };

      const result = isGlobalAlarmEligibleForStack({
        alarm,
        projectName: 'anyProject',
        stage: 'prod'
      });

      expect(result).toBe(true);
    });

    test('should return true for specific matching service and stage', async () => {
      const { isGlobalAlarmEligibleForStack } = await import('./alarms');

      const alarm: any = {
        name: 'specificAlarm',
        forServices: ['myService'],
        forStages: ['prod']
      };

      const result = isGlobalAlarmEligibleForStack({
        alarm,
        projectName: 'myService',
        stage: 'prod'
      });

      expect(result).toBe(true);
    });

    test('should return false for non-matching service', async () => {
      const { isGlobalAlarmEligibleForStack } = await import('./alarms');

      const alarm: any = {
        name: 'serviceAlarm',
        forServices: ['otherService'],
        forStages: ['*']
      };

      const result = isGlobalAlarmEligibleForStack({
        alarm,
        projectName: 'myService',
        stage: 'dev'
      });

      expect(result).toBe(false);
    });

    test('should return false for non-matching stage', async () => {
      const { isGlobalAlarmEligibleForStack } = await import('./alarms');

      const alarm: any = {
        name: 'stageAlarm',
        forServices: ['*'],
        forStages: ['prod']
      };

      const result = isGlobalAlarmEligibleForStack({
        alarm,
        projectName: 'myService',
        stage: 'dev'
      });

      expect(result).toBe(false);
    });

    test('should return true when service is in list of multiple services', async () => {
      const { isGlobalAlarmEligibleForStack } = await import('./alarms');

      const alarm: any = {
        name: 'multiServiceAlarm',
        forServices: ['service1', 'service2', 'myService'],
        forStages: ['*']
      };

      const result = isGlobalAlarmEligibleForStack({
        alarm,
        projectName: 'myService',
        stage: 'dev'
      });

      expect(result).toBe(true);
    });
  });

  describe('isAlarmEligibleForResource', () => {
    test('should return true for eligible alarm', async () => {
      const { isAlarmEligibleForResource, resourceTypesForAlarmType } = await import('./alarms');

      const alarm: any = {
        name: 'lambdaAlarm',
        trigger: { type: 'lambda-error-rate' }
      };

      const resource: any = {
        type: 'function',
        name: 'myFunction'
      };

      const result = isAlarmEligibleForResource({ alarm, resource });

      expect(result).toBe(true);
    });

    test('should return false when alarm is disabled for resource', async () => {
      const { isAlarmEligibleForResource } = await import('./alarms');

      const alarm: any = {
        name: 'disabledAlarm',
        trigger: { type: 'lambda-error-rate' }
      };

      const resource: any = {
        type: 'function',
        name: 'myFunction',
        disabledGlobalAlarms: ['disabledAlarm']
      };

      const result = isAlarmEligibleForResource({ alarm, resource });

      expect(result).toBe(false);
    });

    test('should return false when resource type does not match alarm type', async () => {
      const { isAlarmEligibleForResource } = await import('./alarms');

      const alarm: any = {
        name: 'dbAlarm',
        trigger: { type: 'database-connection-count' }
      };

      const resource: any = {
        type: 'function',
        name: 'myFunction'
      };

      const result = isAlarmEligibleForResource({ alarm, resource });

      expect(result).toBe(false);
    });

    test('should return true for ALB error rate alarm on ALB resource', async () => {
      const { isAlarmEligibleForResource } = await import('./alarms');

      const alarm: any = {
        name: 'albAlarm',
        trigger: { type: 'application-load-balancer-error-rate' }
      };

      const resource: any = {
        type: 'application-load-balancer',
        name: 'myALB'
      };

      const result = isAlarmEligibleForResource({ alarm, resource });

      expect(result).toBe(true);
    });
  });

  describe('resourceTypesForAlarmType', () => {
    test('should map lambda alarms to function type', async () => {
      const { resourceTypesForAlarmType } = await import('./alarms');

      expect(resourceTypesForAlarmType['lambda-error-rate']).toContain('function');
      expect(resourceTypesForAlarmType['lambda-duration']).toContain('function');
    });

    test('should map database alarms to relational-database type', async () => {
      const { resourceTypesForAlarmType } = await import('./alarms');

      expect(resourceTypesForAlarmType['database-connection-count']).toContain('relational-database');
      expect(resourceTypesForAlarmType['database-cpu-utilization']).toContain('relational-database');
    });

    test('should map ALB alarms to application-load-balancer type', async () => {
      const { resourceTypesForAlarmType } = await import('./alarms');

      expect(resourceTypesForAlarmType['application-load-balancer-error-rate']).toContain('application-load-balancer');
      expect(resourceTypesForAlarmType['application-load-balancer-unhealthy-targets']).toContain(
        'application-load-balancer'
      );
    });

    test('should map SQS alarms to sqs-queue type', async () => {
      const { resourceTypesForAlarmType } = await import('./alarms');

      expect(resourceTypesForAlarmType['sqs-queue-not-empty']).toContain('sqs-queue');
      expect(resourceTypesForAlarmType['sqs-queue-received-messages-count']).toContain('sqs-queue');
    });

    test('should map HTTP API Gateway alarms correctly', async () => {
      const { resourceTypesForAlarmType } = await import('./alarms');

      expect(resourceTypesForAlarmType['http-api-gateway-error-rate']).toContain('http-api-gateway');
      expect(resourceTypesForAlarmType['http-api-gateway-latency']).toContain('http-api-gateway');
    });
  });

  describe('getAlarmsToBeAppliedToResource', () => {
    test('should combine global and resource-specific alarms', async () => {
      const { getAlarmsToBeAppliedToResource } = await import('./alarms');

      const globalAlarms: any = [
        {
          name: 'globalAlarm',
          trigger: { type: 'lambda-error-rate' },
          forServices: ['*'],
          forStages: ['*']
        }
      ];

      const resource: any = {
        type: 'function',
        name: 'myFunction',
        nameChain: ['myFunction'],
        alarms: [
          {
            trigger: { type: 'lambda-duration' }
          }
        ]
      };

      const result = getAlarmsToBeAppliedToResource({ resource, globalAlarms });

      expect(result.length).toBe(2);
    });

    test('should filter out disabled global alarms', async () => {
      const { getAlarmsToBeAppliedToResource } = await import('./alarms');

      const globalAlarms: any = [
        {
          name: 'disabledAlarm',
          trigger: { type: 'lambda-error-rate' },
          forServices: ['*'],
          forStages: ['*']
        }
      ];

      const resource: any = {
        type: 'function',
        name: 'myFunction',
        nameChain: ['myFunction'],
        disabledGlobalAlarms: ['disabledAlarm']
      };

      const result = getAlarmsToBeAppliedToResource({ resource, globalAlarms });

      expect(result.length).toBe(0);
    });

    test('should set correct nameChain for global alarms', async () => {
      const { getAlarmsToBeAppliedToResource } = await import('./alarms');

      const globalAlarms: any = [
        {
          name: 'globalAlarm',
          trigger: { type: 'lambda-error-rate' },
          forServices: ['*'],
          forStages: ['*']
        }
      ];

      const resource: any = {
        type: 'function',
        name: 'myFunction',
        nameChain: ['parent', 'myFunction']
      };

      const result = getAlarmsToBeAppliedToResource({ resource, globalAlarms });

      expect(result[0].nameChain).toEqual(['parent', 'myFunction', 'alarms', 'globalAlarm']);
    });

    test('should set correct nameChain for resource-specific alarms', async () => {
      const { getAlarmsToBeAppliedToResource } = await import('./alarms');

      const resource: any = {
        type: 'function',
        name: 'myFunction',
        nameChain: ['myFunction'],
        alarms: [
          {
            trigger: { type: 'lambda-duration' }
          }
        ]
      };

      const result = getAlarmsToBeAppliedToResource({ resource, globalAlarms: [] });

      expect(result[0].nameChain).toEqual(['myFunction', 'alarms', '0']);
    });

    test('should filter alarms by resource type eligibility', async () => {
      const { getAlarmsToBeAppliedToResource } = await import('./alarms');

      const globalAlarms: any = [
        {
          name: 'dbAlarm',
          trigger: { type: 'database-connection-count' },
          forServices: ['*'],
          forStages: ['*']
        }
      ];

      const resource: any = {
        type: 'function',
        name: 'myFunction',
        nameChain: ['myFunction']
      };

      const result = getAlarmsToBeAppliedToResource({ resource, globalAlarms });

      expect(result.length).toBe(0);
    });

    test('should handle resource without alarms property', async () => {
      const { getAlarmsToBeAppliedToResource } = await import('./alarms');

      const globalAlarms: any = [
        {
          name: 'globalAlarm',
          trigger: { type: 'lambda-error-rate' },
          forServices: ['*'],
          forStages: ['*']
        }
      ];

      const resource: any = {
        type: 'function',
        name: 'myFunction',
        nameChain: ['myFunction']
      };

      const result = getAlarmsToBeAppliedToResource({ resource, globalAlarms });

      expect(result.length).toBe(1);
      expect(result[0].name).toContain('globalAlarm');
    });

    test('should handle multiple resource-specific alarms with correct indices', async () => {
      const { getAlarmsToBeAppliedToResource } = await import('./alarms');

      const resource: any = {
        type: 'function',
        name: 'myFunction',
        nameChain: ['myFunction'],
        alarms: [
          { trigger: { type: 'lambda-error-rate' } },
          { trigger: { type: 'lambda-duration' } },
          { trigger: { type: 'lambda-error-rate' } }
        ]
      };

      const result = getAlarmsToBeAppliedToResource({ resource, globalAlarms: [] });

      expect(result.length).toBe(3);
      expect(result[0].nameChain).toEqual(['myFunction', 'alarms', '0']);
      expect(result[1].nameChain).toEqual(['myFunction', 'alarms', '1']);
      expect(result[2].nameChain).toEqual(['myFunction', 'alarms', '2']);
    });
  });
});
