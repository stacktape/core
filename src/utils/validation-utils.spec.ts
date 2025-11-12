import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@schemas/cli-schema.json', () => ({
  default: {
    deploy: { description: '--- Deploy stack to AWS' },
    delete: { description: '--- Delete stack from AWS' },
    'stack-info': { description: '--- Show stack information' }
  }
}));

mock.module('./printer', () => ({
  printer: {
    colorize: mock((color: string, text: string) => `<${color}>${text}</${color}>`)
  }
}));

mock.module('./errors', () => ({
  ExpectedError: class ExpectedError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'ExpectedError';
    }
  }
}));

describe('validation-utils', () => {
  describe('validatePrimitiveFunctionParams', () => {
    test('should validate correct string parameter', async () => {
      const { validatePrimitiveFunctionParams } = await import('./validation-utils');
      expect(() => {
        validatePrimitiveFunctionParams(['test'], { name: 'string' }, 'TestFunction');
      }).not.toThrow();
    });

    test('should validate correct number parameter', async () => {
      const { validatePrimitiveFunctionParams } = await import('./validation-utils');
      expect(() => {
        validatePrimitiveFunctionParams([42], { count: 'number' }, 'TestFunction');
      }).not.toThrow();
    });

    test('should validate correct boolean parameter', async () => {
      const { validatePrimitiveFunctionParams } = await import('./validation-utils');
      expect(() => {
        validatePrimitiveFunctionParams([true], { flag: 'boolean' }, 'TestFunction');
      }).not.toThrow();
    });

    test('should validate multiple parameters', async () => {
      const { validatePrimitiveFunctionParams } = await import('./validation-utils');
      expect(() => {
        validatePrimitiveFunctionParams(
          ['test', 42, true],
          { name: 'string', count: 'number', flag: 'boolean' },
          'TestFunction'
        );
      }).not.toThrow();
    });

    test('should throw when parameter is missing', async () => {
      const { validatePrimitiveFunctionParams } = await import('./validation-utils');
      expect(() => {
        validatePrimitiveFunctionParams([], { name: 'string' }, 'TestFunction');
      }).toThrow('TestFunction requires parameter name of type string on position 1');
    });

    test('should throw when parameter type is wrong', async () => {
      const { validatePrimitiveFunctionParams } = await import('./validation-utils');
      expect(() => {
        validatePrimitiveFunctionParams([42], { name: 'string' }, 'TestFunction');
      }).toThrow('TestFunction: Parameter on position 1 must be of type string but got number');
    });

    test('should throw when second parameter is missing', async () => {
      const { validatePrimitiveFunctionParams } = await import('./validation-utils');
      expect(() => {
        validatePrimitiveFunctionParams(['test'], { name: 'string', age: 'number' }, 'TestFunction');
      }).toThrow('TestFunction requires parameter age of type number on position 2');
    });

    test('should throw when second parameter type is wrong', async () => {
      const { validatePrimitiveFunctionParams } = await import('./validation-utils');
      expect(() => {
        validatePrimitiveFunctionParams(['test', 'invalid'], { name: 'string', age: 'number' }, 'TestFunction');
      }).toThrow('TestFunction: Parameter on position 2 must be of type number but got string');
    });

    test('should handle empty required params', async () => {
      const { validatePrimitiveFunctionParams } = await import('./validation-utils');
      expect(() => {
        validatePrimitiveFunctionParams([], {}, 'TestFunction');
      }).not.toThrow();
    });

    test('should validate with undefined actual parameter', async () => {
      const { validatePrimitiveFunctionParams } = await import('./validation-utils');
      expect(() => {
        validatePrimitiveFunctionParams([undefined], { name: 'string' }, 'TestFunction');
      }).toThrow();
    });

    test('should validate with null actual parameter', async () => {
      const { validatePrimitiveFunctionParams } = await import('./validation-utils');
      expect(() => {
        validatePrimitiveFunctionParams([null], { name: 'string' }, 'TestFunction');
      }).toThrow();
    });
  });

  describe('getPrettyCommand', () => {
    test('should format command with color and quotes', async () => {
      const { getPrettyCommand } = await import('./validation-utils');
      const result = getPrettyCommand('deploy');
      expect(result).toBe("'<yellow>deploy</yellow>'");
    });

    test('should handle different commands', async () => {
      const { getPrettyCommand } = await import('./validation-utils');
      expect(getPrettyCommand('delete')).toBe("'<yellow>delete</yellow>'");
      expect(getPrettyCommand('stack-info')).toBe("'<yellow>stack-info</yellow>'");
    });

    test('should handle empty string', async () => {
      const { getPrettyCommand } = await import('./validation-utils');
      const result = getPrettyCommand('');
      expect(result).toBe("'<yellow></yellow>'");
    });
  });

  describe('getCommandShortDescription', () => {
    test('should extract short description from deploy command', async () => {
      const { getCommandShortDescription } = await import('./validation-utils');
      const result = getCommandShortDescription('deploy');
      expect(result).toBe('Deploy stack to AWS');
    });

    test('should extract short description from delete command', async () => {
      const { getCommandShortDescription } = await import('./validation-utils');
      const result = getCommandShortDescription('delete');
      expect(result).toBe('Delete stack from AWS');
    });

    test('should extract short description from stack-info command', async () => {
      const { getCommandShortDescription } = await import('./validation-utils');
      const result = getCommandShortDescription('stack-info');
      expect(result).toBe('Show stack information');
    });

    test('should trim whitespace', async () => {
      const { getCommandShortDescription } = await import('./validation-utils');
      const result = getCommandShortDescription('deploy');
      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });
  });
});
