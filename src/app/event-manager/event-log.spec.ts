import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@shared/utils/misc', () => ({
  getFirstAndLastItem: mock((arr: any[]) => ({ first: arr[0], last: arr[arr.length - 1] })),
  groupBy: mock((arr: any[], fn: (item: any) => string) => {
    const result: Record<string, any[]> = {};
    arr.forEach((item) => {
      const key = fn(item);
      if (!result[key]) result[key] = [];
      result[key].push(item);
    });
    return result;
  }),
  orderPropertiesOfObjectAccordingToKeys: mock((obj: any) => obj)
}));

mock.module('@utils/printer', () => ({
  printer: {
    getTime: mock((ms: number) => `${ms}ms`),
    colorize: mock((color: string, text: string) => text)
  }
}));

mock.module('./utils', () => ({
  getGroupedEventsWithDetails: mock((events: any[]) => {
    return events.map((e) => ({
      eventType: e.eventType,
      started: e.timestamp,
      finished: e.captureType === 'finish' ? e.timestamp : undefined,
      duration: e.captureType === 'finish' ? 1000 : undefined,
      message: e.description,
      additionalMessage: e.additionalMessage,
      finalMessage: e.finalMessage,
      data: e.data,
      printableText: ''
    }));
  })
}));

describe('EventLog', () => {
  beforeEach(() => {
    mock.restore();
  });

  test('should initialize with empty event arrays', async () => {
    const { EventLog } = await import('./event-log');
    const eventLog = new EventLog();

    expect(eventLog.rawEvents).toEqual([]);
    expect(eventLog.rawNamespacedEvents).toEqual([]);
  });

  test('should capture root-level events', async () => {
    const { EventLog } = await import('./event-log');
    const eventLog = new EventLog();

    eventLog.captureEvent({
      eventType: 'DEPLOY',
      description: 'Deploying stack',
      timestamp: Date.now(),
      namespace: null,
      captureType: 'start',
      additionalMessage: '',
      data: {}
    });

    expect(eventLog.rawEvents).toHaveLength(1);
    expect(eventLog.rawEvents[0].eventType).toBe('DEPLOY');
    expect(eventLog.rawNamespacedEvents).toHaveLength(0);
  });

  test('should capture namespaced child events', async () => {
    const { EventLog } = await import('./event-log');
    const eventLog = new EventLog();

    eventLog.captureEvent({
      eventType: 'PACKAGE_WORKLOAD',
      description: 'Packaging function',
      timestamp: Date.now(),
      namespace: { identifier: 'myFunction', eventType: 'PACKAGE_WORKLOAD' },
      captureType: 'start',
      additionalMessage: '',
      data: {}
    });

    expect(eventLog.rawEvents).toHaveLength(0);
    expect(eventLog.rawNamespacedEvents).toHaveLength(1);
    expect(eventLog.rawNamespacedEvents[0].identifier).toBe('myFunction');
  });

  test('should reset event log', async () => {
    const { EventLog } = await import('./event-log');
    const eventLog = new EventLog();

    eventLog.captureEvent({
      eventType: 'DEPLOY',
      description: 'Deploying',
      timestamp: Date.now(),
      namespace: null,
      captureType: 'start',
      additionalMessage: '',
      data: {}
    });

    expect(eventLog.rawEvents).toHaveLength(1);

    eventLog.reset();

    expect(eventLog.rawEvents).toEqual([]);
    expect(eventLog.rawNamespacedEvents).toEqual([]);
  });

  test('should format events with duration', async () => {
    const { EventLog } = await import('./event-log');
    const { getGroupedEventsWithDetails } = await import('./utils');

    (getGroupedEventsWithDetails as any).mockImplementation((events: any[]) => {
      return events.map((e) => ({
        eventType: e.eventType,
        started: 1000,
        finished: 2000,
        duration: 1000,
        message: e.description || 'Event',
        additionalMessage: e.additionalMessage || '',
        finalMessage: e.finalMessage,
        data: e.data,
        printableText: ''
      }));
    });

    const eventLog = new EventLog();

    eventLog.captureEvent({
      eventType: 'DEPLOY',
      description: 'Deploying stack',
      timestamp: 1000,
      namespace: null,
      captureType: 'start',
      additionalMessage: 'in progress',
      data: {}
    });

    const formatted = eventLog.formattedData;

    expect(formatted).toHaveLength(1);
    expect(formatted[0].printableText).toContain('Deploying stack');
    expect(formatted[0].printableText).toContain('1000ms');
  });

  test('should group child events by identifier', async () => {
    const { EventLog } = await import('./event-log');
    const eventLog = new EventLog();

    eventLog.captureEvent({
      eventType: 'PACKAGE_WORKLOAD',
      description: 'Packaging',
      timestamp: 1000,
      namespace: null,
      captureType: 'start',
      additionalMessage: '',
      data: {}
    });

    eventLog.captureEvent({
      eventType: 'PACKAGE_WORKLOAD',
      description: 'Building function',
      timestamp: 1100,
      namespace: { identifier: 'function1', eventType: 'PACKAGE_WORKLOAD' },
      captureType: 'start',
      additionalMessage: '',
      data: {}
    });

    eventLog.captureEvent({
      eventType: 'PACKAGE_WORKLOAD',
      description: 'Building function',
      timestamp: 1200,
      namespace: { identifier: 'function2', eventType: 'PACKAGE_WORKLOAD' },
      captureType: 'start',
      additionalMessage: '',
      data: {}
    });

    const formatted = eventLog.formattedData;

    expect(formatted[0].childEvents).toHaveLength(2);
    expect(formatted[0].childEvents[0].id).toBe('function1');
    expect(formatted[0].childEvents[1].id).toBe('function2');
  });

  test('should include final message in formatted output', async () => {
    const { EventLog } = await import('./event-log');
    const { getGroupedEventsWithDetails } = await import('./utils');

    (getGroupedEventsWithDetails as any).mockImplementation((events: any[]) => {
      return events.map((e) => ({
        eventType: e.eventType,
        started: 1000,
        finished: 2000,
        duration: 1000,
        message: e.description || 'Event',
        additionalMessage: e.additionalMessage || '',
        finalMessage: e.finalMessage || 'Success',
        data: e.data,
        printableText: ''
      }));
    });

    const eventLog = new EventLog();

    eventLog.captureEvent({
      eventType: 'DEPLOY',
      description: 'Deploying stack',
      timestamp: 1000,
      namespace: null,
      captureType: 'finish',
      additionalMessage: '',
      finalMessage: 'Deployment completed',
      data: {}
    });

    const formatted = eventLog.formattedData;

    expect(formatted[0].printableText).toContain('Deployment completed');
  });

  test('should handle events with custom data', async () => {
    const { EventLog } = await import('./event-log');
    const eventLog = new EventLog();

    const customData = { resourceCount: 5, region: 'us-east-1' };

    eventLog.captureEvent({
      eventType: 'DEPLOY',
      description: 'Deploying',
      timestamp: Date.now(),
      namespace: null,
      captureType: 'start',
      additionalMessage: '',
      data: customData
    });

    expect(eventLog.rawEvents[0].data).toEqual(customData);
  });

  test('should format nested child events with proper indentation', async () => {
    const { EventLog } = await import('./event-log');
    const { getGroupedEventsWithDetails } = await import('./utils');

    (getGroupedEventsWithDetails as any).mockImplementation((events: any[]) => {
      return events.map((e) => ({
        eventType: e.eventType,
        started: 1000,
        finished: 2000,
        duration: 1000,
        message: e.description || 'Event',
        additionalMessage: e.additionalMessage || '',
        finalMessage: e.finalMessage,
        data: e.data,
        printableText: ''
      }));
    });

    const eventLog = new EventLog();

    eventLog.captureEvent({
      eventType: 'PACKAGE_WORKLOAD',
      description: 'Packaging',
      timestamp: 1000,
      namespace: null,
      captureType: 'start',
      additionalMessage: '',
      data: {}
    });

    eventLog.captureEvent({
      eventType: 'PACKAGE_WORKLOAD',
      description: 'Building',
      timestamp: 1100,
      namespace: { identifier: 'parent.child', eventType: 'PACKAGE_WORKLOAD' },
      captureType: 'finish',
      additionalMessage: '',
      finalMessage: 'Built successfully',
      data: {}
    });

    const formatted = eventLog.formattedData;

    expect(formatted[0].printableText).toContain('child');
  });
});
