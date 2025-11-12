import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/misc', () => ({
  getFirstAndLastItem: mock((arr) => ({
    first: arr[0],
    last: arr[arr.length - 1]
  }))
}));

describe('event-manager/utils', () => {
  describe('groupByEventType', () => {
    test('should group events by event type', async () => {
      const { groupByEventType } = await import('./utils');

      const events = [
        { eventType: 'DEPLOY', data: 'deploy1' },
        { eventType: 'BUILD', data: 'build1' },
        { eventType: 'DEPLOY', data: 'deploy2' },
        { eventType: 'TEST', data: 'test1' },
        { eventType: 'BUILD', data: 'build2' }
      ];

      const result = groupByEventType(events);

      expect(result['DEPLOY']).toHaveLength(2);
      expect(result['BUILD']).toHaveLength(2);
      expect(result['TEST']).toHaveLength(1);
    });

    test('should handle empty array', async () => {
      const { groupByEventType } = await import('./utils');

      const result = groupByEventType([]);

      expect(result).toEqual({});
    });

    test('should handle single event', async () => {
      const { groupByEventType } = await import('./utils');

      const events = [{ eventType: 'DEPLOY', data: 'deploy1' }];

      const result = groupByEventType(events);

      expect(result['DEPLOY']).toHaveLength(1);
      expect(result['DEPLOY'][0].data).toBe('deploy1');
    });

    test('should preserve event data within groups', async () => {
      const { groupByEventType } = await import('./utils');

      const events = [
        { eventType: 'DEPLOY', timestamp: 100, status: 'start' },
        { eventType: 'DEPLOY', timestamp: 200, status: 'finish' }
      ];

      const result = groupByEventType(events);

      expect(result['DEPLOY'][0].timestamp).toBe(100);
      expect(result['DEPLOY'][1].timestamp).toBe(200);
    });

    test('should handle multiple unique event types', async () => {
      const { groupByEventType } = await import('./utils');

      const events = [
        { eventType: 'TYPE_A', data: 'a' },
        { eventType: 'TYPE_B', data: 'b' },
        { eventType: 'TYPE_C', data: 'c' },
        { eventType: 'TYPE_D', data: 'd' }
      ];

      const result = groupByEventType(events);

      expect(Object.keys(result)).toHaveLength(4);
      expect(result['TYPE_A']).toBeDefined();
      expect(result['TYPE_B']).toBeDefined();
      expect(result['TYPE_C']).toBeDefined();
      expect(result['TYPE_D']).toBeDefined();
    });

    test('should maintain order of events within groups', async () => {
      const { groupByEventType } = await import('./utils');

      const events = [
        { eventType: 'DEPLOY', id: 1 },
        { eventType: 'DEPLOY', id: 2 },
        { eventType: 'DEPLOY', id: 3 }
      ];

      const result = groupByEventType(events);

      expect(result['DEPLOY'][0].id).toBe(1);
      expect(result['DEPLOY'][1].id).toBe(2);
      expect(result['DEPLOY'][2].id).toBe(3);
    });
  });

  describe('getGroupedEventsWithDetails', () => {
    test('should create event details with duration for finished events', async () => {
      const { getGroupedEventsWithDetails } = await import('./utils');

      const events: any[] = [
        {
          eventType: 'DEPLOY',
          captureType: 'START',
          timestamp: 1000,
          description: 'Starting deployment'
        },
        {
          eventType: 'DEPLOY',
          captureType: 'FINISH',
          timestamp: 5000,
          additionalMessage: 'Success'
        }
      ];

      const result = getGroupedEventsWithDetails(events);

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe('DEPLOY');
      expect(result[0].duration).toBe(4000);
      expect(result[0].started).toBe(1000);
      expect(result[0].finished).toBe(5000);
      expect(result[0].message).toBe('Starting deployment');
      expect(result[0].additionalMessage).toBe('Success');
    });

    test('should handle events without finish capture type', async () => {
      const { getGroupedEventsWithDetails } = await import('./utils');

      const events: any[] = [
        {
          eventType: 'BUILD',
          captureType: 'START',
          timestamp: 2000,
          description: 'Building'
        },
        {
          eventType: 'BUILD',
          captureType: 'PROGRESS',
          timestamp: 3000
        }
      ];

      const result = getGroupedEventsWithDetails(events);

      expect(result[0].duration).toBeNull();
      expect(result[0].finished).toBeNull();
      expect(result[0].started).toBe(2000);
    });

    test('should extract data from events', async () => {
      const { getGroupedEventsWithDetails } = await import('./utils');

      const events: any[] = [
        {
          eventType: 'DEPLOY',
          captureType: 'START',
          timestamp: 1000,
          data: { artifact: 'v1.0.0' }
        },
        {
          eventType: 'DEPLOY',
          captureType: 'FINISH',
          timestamp: 2000,
          data: { result: 'success' }
        }
      ];

      const result = getGroupedEventsWithDetails(events);

      expect(result[0].data).toHaveLength(2);
      expect(result[0].data[0]).toEqual({ on: 'START', data: { artifact: 'v1.0.0' } });
      expect(result[0].data[1]).toEqual({ on: 'FINISH', data: { result: 'success' } });
    });

    test('should filter out events without data', async () => {
      const { getGroupedEventsWithDetails } = await import('./utils');

      const events: any[] = [
        {
          eventType: 'TEST',
          captureType: 'START',
          timestamp: 1000,
          data: { test: 'data' }
        },
        {
          eventType: 'TEST',
          captureType: 'PROGRESS',
          timestamp: 1500
          // no data field
        },
        {
          eventType: 'TEST',
          captureType: 'FINISH',
          timestamp: 2000
          // no data field
        }
      ];

      const result = getGroupedEventsWithDetails(events);

      expect(result[0].data).toHaveLength(1);
      expect(result[0].data[0].data).toEqual({ test: 'data' });
    });

    test('should include finalMessage when present', async () => {
      const { getGroupedEventsWithDetails } = await import('./utils');

      const events: any[] = [
        {
          eventType: 'DEPLOY',
          captureType: 'START',
          timestamp: 1000
        },
        {
          eventType: 'DEPLOY',
          captureType: 'FINISH',
          timestamp: 2000,
          finalMessage: 'Deployment completed successfully'
        }
      ];

      const result = getGroupedEventsWithDetails(events);

      expect(result[0].finalMessage).toBe('Deployment completed successfully');
    });

    test('should not include finalMessage when not present', async () => {
      const { getGroupedEventsWithDetails } = await import('./utils');

      const events: any[] = [
        {
          eventType: 'BUILD',
          captureType: 'START',
          timestamp: 1000
        },
        {
          eventType: 'BUILD',
          captureType: 'FINISH',
          timestamp: 2000
        }
      ];

      const result = getGroupedEventsWithDetails(events);

      expect(result[0]).not.toHaveProperty('finalMessage');
    });

    test('should handle multiple event types', async () => {
      const { getGroupedEventsWithDetails } = await import('./utils');

      const events: any[] = [
        {
          eventType: 'BUILD',
          captureType: 'START',
          timestamp: 1000,
          description: 'Building'
        },
        {
          eventType: 'BUILD',
          captureType: 'FINISH',
          timestamp: 2000
        },
        {
          eventType: 'DEPLOY',
          captureType: 'START',
          timestamp: 3000,
          description: 'Deploying'
        },
        {
          eventType: 'DEPLOY',
          captureType: 'FINISH',
          timestamp: 5000
        }
      ];

      const result = getGroupedEventsWithDetails(events);

      expect(result).toHaveLength(2);
      expect(result.find(e => e.eventType === 'BUILD')).toBeDefined();
      expect(result.find(e => e.eventType === 'DEPLOY')).toBeDefined();
    });

    test('should handle empty array', async () => {
      const { getGroupedEventsWithDetails } = await import('./utils');

      const result = getGroupedEventsWithDetails([]);

      expect(result).toEqual([]);
    });

    test('should calculate duration correctly for multi-step events', async () => {
      const { getGroupedEventsWithDetails } = await import('./utils');

      const events: any[] = [
        {
          eventType: 'COMPLEX_TASK',
          captureType: 'START',
          timestamp: 1000
        },
        {
          eventType: 'COMPLEX_TASK',
          captureType: 'PROGRESS',
          timestamp: 2000
        },
        {
          eventType: 'COMPLEX_TASK',
          captureType: 'PROGRESS',
          timestamp: 3000
        },
        {
          eventType: 'COMPLEX_TASK',
          captureType: 'FINISH',
          timestamp: 4000
        }
      ];

      const result = getGroupedEventsWithDetails(events);

      expect(result[0].duration).toBe(3000); // 4000 - 1000
      expect(result[0].started).toBe(1000);
      expect(result[0].finished).toBe(4000);
    });

    test('should handle null timestamps gracefully', async () => {
      const { getGroupedEventsWithDetails } = await import('./utils');

      const events: any[] = [
        {
          eventType: 'TASK',
          captureType: 'START',
          timestamp: null
        },
        {
          eventType: 'TASK',
          captureType: 'FINISH',
          timestamp: 2000
        }
      ];

      const result = getGroupedEventsWithDetails(events);

      expect(result[0].started).toBeNull();
    });
  });
});
