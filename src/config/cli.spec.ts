import { describe, expect, test } from 'bun:test';

describe('config/cli', () => {
  describe('cliCommands', () => {
    test('should export cliCommands array', async () => {
      const { cliCommands } = await import('./cli');

      expect(Array.isArray(cliCommands)).toBe(true);
      expect(cliCommands.length).toBeGreaterThan(0);
    });

    test('should include deploy command', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands).toContain('deploy');
    });

    test('should include dev command', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands).toContain('dev');
    });

    test('should include delete and rollback commands', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands).toContain('delete');
      expect(cliCommands).toContain('rollback');
    });

    test('should include stack management commands', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands).toContain('stack:info');
      expect(cliCommands).toContain('stack:list');
    });

    test('should include AWS profile commands', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands).toContain('aws-profile:create');
      expect(cliCommands).toContain('aws-profile:update');
      expect(cliCommands).toContain('aws-profile:delete');
      expect(cliCommands).toContain('aws-profile:list');
    });

    test('should include secret management commands', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands).toContain('secret:create');
      expect(cliCommands).toContain('secret:get');
      expect(cliCommands).toContain('secret:delete');
    });

    test('should include utility commands', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands).toContain('init');
      expect(cliCommands).toContain('logs');
      expect(cliCommands).toContain('version');
      expect(cliCommands).toContain('help');
    });

    test('should include codebuild deploy command', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands).toContain('codebuild:deploy');
    });

    test('should include bastion commands', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands).toContain('bastion:session');
      expect(cliCommands).toContain('bastion:tunnel');
    });

    test('should include domain command', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands).toContain('domain:add');
    });

    test('should include defaults commands', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands).toContain('defaults:configure');
      expect(cliCommands).toContain('defaults:list');
    });

    test('should include login and logout commands', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands).toContain('login');
      expect(cliCommands).toContain('logout');
    });

    test('all commands should be strings', async () => {
      const { cliCommands } = await import('./cli');

      cliCommands.forEach((cmd) => {
        expect(typeof cmd).toBe('string');
        expect(cmd.length).toBeGreaterThan(0);
      });
    });

    test('commands should use colon separator for namespaced commands', async () => {
      const { cliCommands } = await import('./cli');

      const namespacedCommands = cliCommands.filter((cmd) => cmd.includes(':'));
      namespacedCommands.forEach((cmd) => {
        expect(cmd.split(':').length).toBe(2);
      });
    });

    test('should not have duplicate commands', async () => {
      const { cliCommands } = await import('./cli');

      const uniqueCommands = [...new Set(cliCommands)];
      expect(cliCommands.length).toBe(uniqueCommands.length);
    });
  });

  describe('sdkCommands', () => {
    test('should export sdkCommands array', async () => {
      const { sdkCommands } = await import('./cli');

      expect(Array.isArray(sdkCommands)).toBe(true);
      expect(sdkCommands.length).toBeGreaterThan(0);
    });

    test('should include deploy command', async () => {
      const { sdkCommands } = await import('./cli');

      expect(sdkCommands).toContain('deploy');
    });

    test('should include dev command', async () => {
      const { sdkCommands } = await import('./cli');

      expect(sdkCommands).toContain('dev');
    });

    test('should include stack management commands', async () => {
      const { sdkCommands } = await import('./cli');

      expect(sdkCommands).toContain('stack:info');
      expect(sdkCommands).toContain('stack:list');
    });

    test('all SDK commands should be strings', async () => {
      const { sdkCommands } = await import('./cli');

      sdkCommands.forEach((cmd) => {
        expect(typeof cmd).toBe('string');
        expect(cmd.length).toBeGreaterThan(0);
      });
    });

    test('should not have duplicate commands', async () => {
      const { sdkCommands } = await import('./cli');

      const uniqueCommands = [...new Set(sdkCommands)];
      expect(sdkCommands.length).toBe(uniqueCommands.length);
    });

    test('SDK commands should be a subset of CLI commands', async () => {
      const { cliCommands, sdkCommands } = await import('./cli');

      sdkCommands.forEach((sdkCmd) => {
        expect(cliCommands).toContain(sdkCmd);
      });
    });

    test('SDK commands should not include help or version', async () => {
      const { sdkCommands } = await import('./cli');

      expect(sdkCommands).not.toContain('help');
      expect(sdkCommands).not.toContain('version');
    });

    test('SDK commands should not include init', async () => {
      const { sdkCommands } = await import('./cli');

      expect(sdkCommands).not.toContain('init');
    });
  });

  describe('command categories', () => {
    test('should have AWS profile management category', async () => {
      const { cliCommands } = await import('./cli');

      const awsProfileCommands = cliCommands.filter((cmd) => cmd.startsWith('aws-profile:'));
      expect(awsProfileCommands.length).toBe(4);
    });

    test('should have secret management category', async () => {
      const { cliCommands } = await import('./cli');

      const secretCommands = cliCommands.filter((cmd) => cmd.startsWith('secret:'));
      expect(secretCommands.length).toBe(3);
    });

    test('should have stack management category', async () => {
      const { cliCommands } = await import('./cli');

      const stackCommands = cliCommands.filter((cmd) => cmd.startsWith('stack:'));
      expect(stackCommands.length).toBe(2);
    });

    test('should have bastion category', async () => {
      const { cliCommands } = await import('./cli');

      const bastionCommands = cliCommands.filter((cmd) => cmd.startsWith('bastion:'));
      expect(bastionCommands.length).toBe(2);
    });

    test('should have defaults category', async () => {
      const { cliCommands } = await import('./cli');

      const defaultsCommands = cliCommands.filter((cmd) => cmd.startsWith('defaults:'));
      expect(defaultsCommands.length).toBe(2);
    });
  });

  describe('command validation', () => {
    test('all commands should be lowercase', async () => {
      const { cliCommands } = await import('./cli');

      cliCommands.forEach((cmd) => {
        expect(cmd).toBe(cmd.toLowerCase());
      });
    });

    test('all commands should use kebab-case or colon separator', async () => {
      const { cliCommands } = await import('./cli');

      cliCommands.forEach((cmd) => {
        expect(/^[a-z]+([:-][a-z]+)*$/.test(cmd)).toBe(true);
      });
    });

    test('should have reasonable command count for CLI', async () => {
      const { cliCommands } = await import('./cli');

      expect(cliCommands.length).toBeGreaterThan(20);
      expect(cliCommands.length).toBeLessThan(100);
    });

    test('SDK should have fewer commands than CLI', async () => {
      const { cliCommands, sdkCommands } = await import('./cli');

      expect(sdkCommands.length).toBeLessThan(cliCommands.length);
    });
  });
});
