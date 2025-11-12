import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Mock dependencies
const mockCapitalizeFirstLetter = mock((str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
});

mock.module('@shared/utils/misc', () => ({
  capitalizeFirstLetter: mockCapitalizeFirstLetter
}));

describe('alarm-notifications/utils', () => {
  let getCauseString: any;
  let getThresholdValue: any;

  beforeEach(async () => {
    mock.restore();

    mockCapitalizeFirstLetter.mockClear();
    mockCapitalizeFirstLetter.mockImplementation((str: string) => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    const module = await import('./utils');
    getCauseString = module.getCauseString;
    getThresholdValue = module.getThresholdValue;
  });

  describe('getThresholdValue', () => {
    test('should return thresholdPercent for lambda-error-rate', () => {
      const alarm = {
        trigger: {
          type: 'lambda-error-rate',
          properties: { thresholdPercent: 5 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(5);
    });

    test('should return thresholdPercent for database-cpu-utilization', () => {
      const alarm = {
        trigger: {
          type: 'database-cpu-utilization',
          properties: { thresholdPercent: 80 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(80);
    });

    test('should return thresholdPercent for http-api-gateway-error-rate', () => {
      const alarm = {
        trigger: {
          type: 'http-api-gateway-error-rate',
          properties: { thresholdPercent: 10 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(10);
    });

    test('should return thresholdPercent for application-load-balancer-error-rate', () => {
      const alarm = {
        trigger: {
          type: 'application-load-balancer-error-rate',
          properties: { thresholdPercent: 15 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(15);
    });

    test('should return thresholdPercent for application-load-balancer-unhealthy-targets', () => {
      const alarm = {
        trigger: {
          type: 'application-load-balancer-unhealthy-targets',
          properties: { thresholdPercent: 20 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(20);
    });

    test('should return thresholdCount for database-connection-count', () => {
      const alarm = {
        trigger: {
          type: 'database-connection-count',
          properties: { thresholdCount: 100 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(100);
    });

    test('should return thresholdCount for sqs-queue-received-messages-count', () => {
      const alarm = {
        trigger: {
          type: 'sqs-queue-received-messages-count',
          properties: { thresholdCount: 1000 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(1000);
    });

    test('should return thresholdMB for database-free-storage', () => {
      const alarm = {
        trigger: {
          type: 'database-free-storage',
          properties: { thresholdMB: 5000 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(5000);
    });

    test('should return thresholdMB for database-free-memory', () => {
      const alarm = {
        trigger: {
          type: 'database-free-memory',
          properties: { thresholdMB: 2048 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(2048);
    });

    test('should return thresholdSeconds for database-read-latency', () => {
      const alarm = {
        trigger: {
          type: 'database-read-latency',
          properties: { thresholdSeconds: 2 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(2);
    });

    test('should return thresholdSeconds for database-write-latency', () => {
      const alarm = {
        trigger: {
          type: 'database-write-latency',
          properties: { thresholdSeconds: 3 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(3);
    });

    test('should return thresholdMilliseconds for lambda-duration', () => {
      const alarm = {
        trigger: {
          type: 'lambda-duration',
          properties: { thresholdMilliseconds: 5000 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(5000);
    });

    test('should return thresholdMilliseconds for http-api-gateway-latency', () => {
      const alarm = {
        trigger: {
          type: 'http-api-gateway-latency',
          properties: { thresholdMilliseconds: 1000 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(1000);
    });

    test('should return empty string for sqs-queue-not-empty', () => {
      const alarm = {
        trigger: {
          type: 'sqs-queue-not-empty',
          properties: {}
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe('');
    });

    test('should return threshold for application-load-balancer-custom', () => {
      const alarm = {
        trigger: {
          type: 'application-load-balancer-custom',
          properties: { threshold: 42 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(42);
    });

    test('should return null for unknown trigger type', () => {
      const alarm = {
        trigger: {
          type: 'unknown-type',
          properties: {}
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBeNull();
    });
  });

  describe('getCauseString', () => {
    test('should format cause with custom metric', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'custom',
            properties: {
              metric: 'CustomMetricName'
            }
          }
        },
        statFunction: 'Average',
        comparisonOperator: 'GreaterThanThreshold',
        measuringUnit: ''
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('Average CustomMetricName');
      expect(result).toContain('>');
    });

    test('should format cause with GreaterThanThreshold comparison', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'lambda-error-rate',
            properties: { thresholdPercent: 5 }
          }
        },
        statFunction: 'Average',
        comparisonOperator: 'GreaterThanThreshold',
        measuringUnit: '%'
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('Lambda error rate');
      expect(result).toContain('> 5%');
    });

    test('should format cause with GreaterThanOrEqualToThreshold comparison', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'database-cpu-utilization',
            properties: { thresholdPercent: 80 }
          }
        },
        statFunction: 'Maximum',
        comparisonOperator: 'GreaterThanOrEqualToThreshold',
        measuringUnit: '%'
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('≥ 80%');
    });

    test('should format cause with LessThanThreshold comparison', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'database-free-storage',
            properties: { thresholdMB: 5000 }
          }
        },
        statFunction: 'Minimum',
        comparisonOperator: 'LessThanThreshold',
        measuringUnit: 'MB'
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('< 5000MB');
    });

    test('should format cause with LessThanOrEqualToThreshold comparison', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'database-free-memory',
            properties: { thresholdMB: 2048 }
          }
        },
        statFunction: 'Average',
        comparisonOperator: 'LessThanOrEqualToThreshold',
        measuringUnit: 'MB'
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('≤ 2048MB');
    });

    test('should format cause without comparison operator for sqs-queue-not-empty', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'sqs-queue-not-empty',
            properties: {}
          }
        },
        statFunction: undefined,
        comparisonOperator: undefined,
        measuringUnit: undefined
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('Sqs queue not empty');
      expect(result).not.toContain('>');
      expect(result).not.toContain('<');
    });

    test('should capitalize and format trigger type with hyphens', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'http-api-gateway-error-rate',
            properties: { thresholdPercent: 10 }
          }
        },
        statFunction: 'Sum',
        comparisonOperator: 'GreaterThanThreshold',
        measuringUnit: '%'
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('Http api gateway error rate');
      expect(mockCapitalizeFirstLetter).toHaveBeenCalled();
    });

    test('should include statFunction when present', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'lambda-duration',
            properties: { thresholdMilliseconds: 5000 }
          }
        },
        statFunction: 'p99',
        comparisonOperator: 'GreaterThanThreshold',
        measuringUnit: 'ms'
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('p99');
      expect(result).toContain('Lambda duration');
    });

    test('should handle missing statFunction', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'lambda-error-rate',
            properties: { thresholdPercent: 5 }
          }
        },
        statFunction: undefined,
        comparisonOperator: 'GreaterThanThreshold',
        measuringUnit: '%'
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('Lambda error rate');
      expect(result).not.toContain('undefined');
    });

    test('should handle missing measuringUnit', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'database-connection-count',
            properties: { thresholdCount: 100 }
          }
        },
        statFunction: 'Average',
        comparisonOperator: 'GreaterThanThreshold',
        measuringUnit: undefined
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('> 100');
      expect(result).not.toContain('undefined');
    });

    test('should handle empty measuringUnit', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'sqs-queue-received-messages-count',
            properties: { thresholdCount: 1000 }
          }
        },
        statFunction: 'Sum',
        comparisonOperator: 'GreaterThanThreshold',
        measuringUnit: ''
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('> 1000');
    });

    test('should handle unknown comparison operator', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'lambda-error-rate',
            properties: { thresholdPercent: 5 }
          }
        },
        statFunction: 'Average',
        comparisonOperator: 'UnknownOperator',
        measuringUnit: '%'
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('Lambda error rate');
      // No comparison symbol should be added for unknown operator
    });
  });

  describe('edge cases', () => {
    test('should handle zero threshold values', () => {
      const alarm = {
        trigger: {
          type: 'lambda-error-rate',
          properties: { thresholdPercent: 0 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(0);
    });

    test('should handle negative threshold values', () => {
      const alarm = {
        trigger: {
          type: 'database-connection-count',
          properties: { thresholdCount: -1 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(-1);
    });

    test('should handle very large threshold values', () => {
      const alarm = {
        trigger: {
          type: 'sqs-queue-received-messages-count',
          properties: { thresholdCount: 1000000 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(1000000);
    });

    test('should handle decimal threshold values', () => {
      const alarm = {
        trigger: {
          type: 'lambda-error-rate',
          properties: { thresholdPercent: 2.5 }
        }
      } as any;

      expect(getThresholdValue({ alarm })).toBe(2.5);
    });

    test('should format cause with all special characters', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'application-load-balancer-error-rate',
            properties: { thresholdPercent: 5 }
          }
        },
        statFunction: 'Average',
        comparisonOperator: 'GreaterThanOrEqualToThreshold',
        measuringUnit: '%'
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('≥');
    });

    test('should handle trigger type with multiple hyphens', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'application-load-balancer-unhealthy-targets',
            properties: { thresholdPercent: 20 }
          }
        },
        statFunction: 'Maximum',
        comparisonOperator: 'GreaterThanThreshold',
        measuringUnit: '%'
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('Application load balancer unhealthy targets');
    });

    test('should handle custom metric with special characters', () => {
      const alarmDetail = {
        alarmConfig: {
          trigger: {
            type: 'custom',
            properties: {
              metric: 'My-Custom_Metric.Name'
            }
          }
        },
        statFunction: 'Average',
        comparisonOperator: 'GreaterThanThreshold',
        measuringUnit: ''
      } as any;

      const result = getCauseString({ alarmDetail });

      expect(result).toContain('My-Custom_Metric.Name');
    });
  });
});
