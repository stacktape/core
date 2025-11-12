import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@cli-config', () => ({
  cliArgsAliases: {
    region: 'r',
    stage: 's',
    'config-path': 'c',
    profile: 'p'
  }
}));

mock.module('yargs-parser', () => ({
  default: mock((args: string[]) => {
    const result: any = { _: [] };
    let i = 0;
    while (i < args.length) {
      if (args[i].startsWith('--')) {
        const key = args[i].substring(2);
        if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          result[key] = args[i + 1];
          i += 2;
        } else {
          result[key] = true;
          i += 1;
        }
      } else {
        result._.push(args[i]);
        i += 1;
      }
    }
    return result;
  })
}));

describe('cli', () => {
  describe('transformToCliArgs', () => {
    test('should transform boolean true to flag', async () => {
      const { transformToCliArgs } = await import('./cli');

      const result = transformToCliArgs({ verbose: true });

      expect(result).toEqual(['--verbose']);
    });

    test('should skip boolean false', async () => {
      const { transformToCliArgs } = await import('./cli');

      const result = transformToCliArgs({ verbose: false });

      expect(result).toEqual([]);
    });

    test('should transform string value to key-value pair', async () => {
      const { transformToCliArgs } = await import('./cli');

      const result = transformToCliArgs({ region: 'us-east-1' });

      expect(result).toEqual(['--region', 'us-east-1']);
    });

    test('should handle multiple arguments', async () => {
      const { transformToCliArgs } = await import('./cli');

      const result = transformToCliArgs({
        region: 'us-east-1',
        stage: 'prod',
        verbose: true
      });

      expect(result).toContain('--region');
      expect(result).toContain('us-east-1');
      expect(result).toContain('--stage');
      expect(result).toContain('prod');
      expect(result).toContain('--verbose');
    });

    test('should handle numeric values', async () => {
      const { transformToCliArgs } = await import('./cli');

      const result = transformToCliArgs({ timeout: 300 });

      expect(result).toEqual(['--timeout', 300]);
    });

    test('should handle empty object', async () => {
      const { transformToCliArgs } = await import('./cli');

      const result = transformToCliArgs({});

      expect(result).toEqual([]);
    });

    test('should preserve argument order', async () => {
      const { transformToCliArgs } = await import('./cli');

      const result = transformToCliArgs({
        first: 'value1',
        second: 'value2',
        third: true
      });

      const firstIndex = result.indexOf('--first');
      const secondIndex = result.indexOf('--second');
      const thirdIndex = result.indexOf('--third');

      expect(firstIndex).toBeLessThan(secondIndex);
      expect(secondIndex).toBeLessThan(thirdIndex);
    });

    test('should handle kebab-case arguments', async () => {
      const { transformToCliArgs } = await import('./cli');

      const result = transformToCliArgs({ 'config-path': './config.yaml' });

      expect(result).toEqual(['--config-path', './config.yaml']);
    });
  });

  describe('getCliInput', () => {
    test('should parse simple command', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', 'deploy'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.commands).toEqual(['deploy']);
      expect(typeof result.options).toBe('object');

      process.argv = originalArgv;
    });

    test('should parse command with options', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', 'deploy', '--region', 'us-east-1', '--stage', 'prod'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.commands).toEqual(['deploy']);
      expect(result.options.region).toBe('us-east-1');
      expect(result.options.stage).toBe('prod');

      process.argv = originalArgv;
    });

    test('should handle --help flag', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', 'deploy', '--help'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.commands).toEqual(['help']);

      process.argv = originalArgv;
    });

    test('should handle -h shorthand for help', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', '-h'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.commands).toEqual(['help']);

      process.argv = originalArgv;
    });

    test('should handle --version flag', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', '--version'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.commands).toEqual(['version']);

      process.argv = originalArgv;
    });

    test('should handle -version shorthand', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', '-version'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.commands).toEqual(['version']);

      process.argv = originalArgv;
    });

    test('should parse additional args after double dash', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', 'deploy', '--stage', 'prod', '--', '--custom-arg', 'value'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.commands).toEqual(['deploy']);
      expect(result.options.stage).toBe('prod');
      expect(result.additionalArgs).toBeDefined();
      expect(result.additionalArgs['custom-arg']).toBe('value');

      process.argv = originalArgv;
    });

    test('should handle additional args with boolean flags', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', 'deploy', '--', '--flag1', '--flag2'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.additionalArgs.flag1).toBe(true);
      expect(result.additionalArgs.flag2).toBe(true);

      process.argv = originalArgv;
    });

    test('should handle aliases', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', 'deploy', '-r', 'us-west-2'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.options.region).toBe('us-west-2');

      process.argv = originalArgv;
    });

    test('should handle multiple commands', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', 'stack:info'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.commands).toEqual(['stack:info']);

      process.argv = originalArgv;
    });

    test('should handle help with command context', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', 'deploy', '--help'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.commands).toEqual(['help']);
      expect(result.options.command).toBe('deploy');

      process.argv = originalArgv;
    });

    test('should handle no arguments', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.commands).toEqual([]);
      expect(typeof result.options).toBe('object');

      process.argv = originalArgv;
    });

    test('should handle boolean options', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', 'deploy', '--verbose'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.options.verbose).toBe(true);

      process.argv = originalArgv;
    });

    test('should handle camelCase conversion for options', async () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'stacktape', 'deploy', '--config-path', './config.yaml'];

      const { getCliInput } = await import('./cli');
      const result = getCliInput();

      expect(result.options['config-path']).toBe('./config.yaml');

      process.argv = originalArgv;
    });
  });
});
