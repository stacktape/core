import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@domain-services/calculated-stack-overview-manager/resource-resolvers/databases/utils', () => ({
  resolveCloudwatchLogExports: mock(({ resource }) => {
    if (resource.engine.type === 'aurora-mysql-serverless') return ['error', 'slowquery'];
    if (resource.engine.type === 'aurora-postgresql-serverless') return ['postgresql'];
    return ['error'];
  })
}));

mock.module('@errors', () => ({
  stpErrors: {
    e123: mock(({ stpResourceName }) => {
      const error = new Error(`Invalid preferredMaintenanceWindow format for resource: ${stpResourceName}`);
      (error as any).type = 'CONFIG_VALIDATION';
      return error;
    })
  }
}));

mock.module('@shared/aws/rds', () => ({
  normalizeEngineType: mock((engineType: string) => {
    const normalizations: any = {
      'aurora-mysql-serverless': 'aurora-mysql',
      'aurora-postgresql-serverless': 'aurora-postgresql'
    };
    return normalizations[engineType] || engineType;
  })
}));

mock.module('@utils/errors', () => ({
  ExpectedError: class ExpectedError extends Error {
    type: string;
    constructor(type: string, message: string) {
      super(message);
      this.type = type;
      this.name = 'ExpectedError';
    }
  }
}));

mock.module('./resource-references', () => ({
  getPropsOfResourceReferencedInConfig: mock(({ stpResourceReference, stpResourceType }) => ({
    name: stpResourceReference,
    type: stpResourceType
  }))
}));

describe('config-manager/utils/relational-databases', () => {
  describe('resolveReferenceToRelationalDatabase', () => {
    test('should resolve database reference', async () => {
      const { resolveReferenceToRelationalDatabase } = await import('./relational-databases');

      const result = resolveReferenceToRelationalDatabase({
        stpResourceReference: 'myDatabase',
        referencedFrom: 'myFunction',
        referencedFromType: 'function'
      });

      expect(result.name).toBe('myDatabase');
      expect(result.type).toBe('relational-database');
    });

    test('should pass correct parameters to resource reference resolver', async () => {
      const { getPropsOfResourceReferencedInConfig } = await import('./resource-references');
      const { resolveReferenceToRelationalDatabase } = await import('./relational-databases');

      resolveReferenceToRelationalDatabase({
        stpResourceReference: 'prodDB',
        referencedFrom: 'apiHandler',
        referencedFromType: 'function'
      });

      expect(getPropsOfResourceReferencedInConfig).toHaveBeenCalledWith({
        stpResourceReference: 'prodDB',
        stpResourceType: 'relational-database',
        referencedFrom: 'apiHandler',
        referencedFromType: 'function'
      });
    });

    test('should handle reference from alarm', async () => {
      const { resolveReferenceToRelationalDatabase } = await import('./relational-databases');

      const result = resolveReferenceToRelationalDatabase({
        stpResourceReference: 'database',
        referencedFrom: 'highConnectionsAlarm',
        referencedFromType: 'alarm'
      });

      expect(result).toBeDefined();
    });
  });

  describe('isValidDayTimeStringRange', () => {
    test('should validate correct day-time range', async () => {
      const { isValidDayTimeStringRange } = await import('./relational-databases');

      expect(isValidDayTimeStringRange('Mon:00:00-Mon:03:00')).toBe(true);
    });

    test('should validate range across different days', async () => {
      const { isValidDayTimeStringRange } = await import('./relational-databases');

      expect(isValidDayTimeStringRange('Fri:22:00-Sat:02:00')).toBe(true);
    });

    test('should accept valid day abbreviations', async () => {
      const { isValidDayTimeStringRange } = await import('./relational-databases');

      expect(isValidDayTimeStringRange('Sun:00:00-Sun:01:00')).toBe(true);
      expect(isValidDayTimeStringRange('Mon:00:00-Mon:01:00')).toBe(true);
      expect(isValidDayTimeStringRange('Tue:00:00-Tue:01:00')).toBe(true);
      expect(isValidDayTimeStringRange('Wed:00:00-Wed:01:00')).toBe(true);
      expect(isValidDayTimeStringRange('Thu:00:00-Thu:01:00')).toBe(true);
      expect(isValidDayTimeStringRange('Fri:00:00-Fri:01:00')).toBe(true);
      expect(isValidDayTimeStringRange('Sat:00:00-Sat:01:00')).toBe(true);
    });

    test('should reject invalid day abbreviation', async () => {
      const { isValidDayTimeStringRange } = await import('./relational-databases');

      expect(isValidDayTimeStringRange('Xyz:00:00-Mon:01:00')).toBe(false);
    });

    test('should reject invalid hour (> 23)', async () => {
      const { isValidDayTimeStringRange } = await import('./relational-databases');

      expect(isValidDayTimeStringRange('Mon:24:00-Mon:01:00')).toBe(false);
    });

    test('should reject invalid minute (> 59)', async () => {
      const { isValidDayTimeStringRange } = await import('./relational-databases');

      expect(isValidDayTimeStringRange('Mon:00:60-Mon:01:00')).toBe(false);
    });

    test('should reject missing hyphen separator', async () => {
      const { isValidDayTimeStringRange } = await import('./relational-databases');

      expect(isValidDayTimeStringRange('Mon:00:00Mon:01:00')).toBe(false);
    });

    test('should reject wrong format', async () => {
      const { isValidDayTimeStringRange } = await import('./relational-databases');

      expect(isValidDayTimeStringRange('Monday:00:00-Monday:01:00')).toBe(false);
    });

    test('should reject missing time parts', async () => {
      const { isValidDayTimeStringRange } = await import('./relational-databases');

      expect(isValidDayTimeStringRange('Mon:00-Mon:01')).toBe(false);
    });

    test('should reject more than two time parts', async () => {
      const { isValidDayTimeStringRange } = await import('./relational-databases');

      expect(isValidDayTimeStringRange('Mon:00:00-Mon:01:00-Mon:02:00')).toBe(false);
    });

    test('should validate midnight time', async () => {
      const { isValidDayTimeStringRange } = await import('./relational-databases');

      expect(isValidDayTimeStringRange('Mon:00:00-Mon:23:59')).toBe(true);
    });

    test('should validate end of day time', async () => {
      const { isValidDayTimeStringRange } = await import('./relational-databases');

      expect(isValidDayTimeStringRange('Mon:23:00-Mon:23:59')).toBe(true);
    });
  });

  describe('validateRelationalDatabaseConfig', () => {
    test('should validate database with valid maintenance window', async () => {
      const { validateRelationalDatabaseConfig } = await import('./relational-databases');

      const resource: any = {
        name: 'myDB',
        type: 'relational-database',
        engine: { type: 'postgres' },
        preferredMaintenanceWindow: 'Mon:00:00-Mon:03:00'
      };

      expect(() => validateRelationalDatabaseConfig({ resource })).not.toThrow();
    });

    test('should throw error for invalid maintenance window', async () => {
      const { validateRelationalDatabaseConfig } = await import('./relational-databases');

      const resource: any = {
        name: 'invalidDB',
        type: 'relational-database',
        engine: { type: 'postgres' },
        preferredMaintenanceWindow: 'Invalid'
      };

      expect(() => validateRelationalDatabaseConfig({ resource })).toThrow();
    });

    test('should validate database without maintenance window', async () => {
      const { validateRelationalDatabaseConfig } = await import('./relational-databases');

      const resource: any = {
        name: 'myDB',
        type: 'relational-database',
        engine: { type: 'mysql' }
      };

      expect(() => validateRelationalDatabaseConfig({ resource })).not.toThrow();
    });

    test('should throw error for aurora-mysql-serverless without error log', async () => {
      mock.module('@domain-services/calculated-stack-overview-manager/resource-resolvers/databases/utils', () => ({
        resolveCloudwatchLogExports: mock(() => ['slowquery']) // No 'error'
      }));

      const { validateRelationalDatabaseConfig } = await import('./relational-databases');

      const resource: any = {
        name: 'serverlessDB',
        type: 'relational-database',
        engine: { type: 'aurora-mysql-serverless' }
      };

      expect(() => validateRelationalDatabaseConfig({ resource })).toThrow();
    });

    test('should throw error for aurora-postgresql-serverless without postgresql log', async () => {
      mock.module('@domain-services/calculated-stack-overview-manager/resource-resolvers/databases/utils', () => ({
        resolveCloudwatchLogExports: mock(() => ['error']) // No 'postgresql'
      }));

      const { validateRelationalDatabaseConfig } = await import('./relational-databases');

      const resource: any = {
        name: 'pgServerless',
        type: 'relational-database',
        engine: { type: 'aurora-postgresql-serverless' }
      };

      expect(() => validateRelationalDatabaseConfig({ resource })).toThrow();
    });

    test('should validate database with valid MySQL logging options', async () => {
      const { validateRelationalDatabaseConfig } = await import('./relational-databases');

      const resource: any = {
        name: 'mysqlDB',
        type: 'relational-database',
        engine: { type: 'mysql' },
        logging: {
          engineSpecificOptions: {
            long_query_time: 2,
            server_audit_events: 'CONNECT'
          }
        }
      };

      expect(() => validateRelationalDatabaseConfig({ resource })).not.toThrow();
    });

    test('should validate database with valid PostgreSQL logging options', async () => {
      const { validateRelationalDatabaseConfig } = await import('./relational-databases');

      const resource: any = {
        name: 'pgDB',
        type: 'relational-database',
        engine: { type: 'postgres' },
        logging: {
          engineSpecificOptions: {
            log_connections: 1,
            log_disconnections: 1
          }
        }
      };

      expect(() => validateRelationalDatabaseConfig({ resource })).not.toThrow();
    });

    test('should throw error for invalid MySQL logging option', async () => {
      const { validateRelationalDatabaseConfig } = await import('./relational-databases');

      const resource: any = {
        name: 'invalidMysql',
        type: 'relational-database',
        engine: { type: 'mysql' },
        logging: {
          engineSpecificOptions: {
            log_connections: 1 // This is a PostgreSQL option
          }
        }
      };

      expect(() => validateRelationalDatabaseConfig({ resource })).toThrow();
    });

    test('should throw error for invalid PostgreSQL logging option', async () => {
      const { validateRelationalDatabaseConfig } = await import('./relational-databases');

      const resource: any = {
        name: 'invalidPg',
        type: 'relational-database',
        engine: { type: 'postgres' },
        logging: {
          engineSpecificOptions: {
            long_query_time: 2 // This is a MySQL option
          }
        }
      };

      expect(() => validateRelationalDatabaseConfig({ resource })).toThrow();
    });

    test('should validate Oracle database with no specific logging options', async () => {
      const { validateRelationalDatabaseConfig } = await import('./relational-databases');

      const resource: any = {
        name: 'oracleDB',
        type: 'relational-database',
        engine: { type: 'oracle-ee' }
      };

      expect(() => validateRelationalDatabaseConfig({ resource })).not.toThrow();
    });

    test('should validate SQL Server database', async () => {
      const { validateRelationalDatabaseConfig } = await import('./relational-databases');

      const resource: any = {
        name: 'sqlServerDB',
        type: 'relational-database',
        engine: { type: 'sqlserver-ee' }
      };

      expect(() => validateRelationalDatabaseConfig({ resource })).not.toThrow();
    });
  });
});
