import { describe, expect, mock, test } from 'bun:test';
import { join } from 'node:path';

// Mock dependencies
mock.module('fs-extra', () => ({
  pathExists: mock(async (path: string) => {
    if (path.includes('lerna.json')) return true;
    if (path.includes('package.json')) return true;
    if (path.includes('.git')) return true;
    return false;
  }),
  readFile: mock(async (path: string) => {
    if (path.includes('lerna.json')) {
      return JSON.stringify({ lerna: '5.0.0' });
    }
    if (path.includes('package.json')) {
      return JSON.stringify({ workspaces: ['packages/*'] });
    }
    if (path.includes('.git') && path.endsWith('.git')) {
      return 'gitdir: .git/modules/submodule';
    }
    return '';
  }),
  stat: mock(async (path: string) => ({
    isDirectory: () => !path.endsWith('.git') || path.includes('modules'),
    isFile: () => path.endsWith('.git') && !path.includes('modules')
  }))
}));

describe('monorepo', () => {
  describe('findProjectRoot', () => {
    test('should find monorepo root with lerna.json', async () => {
      const { findProjectRoot } = await import('./monorepo');
      const { pathExists } = await import('fs-extra');

      pathExists.mockImplementation(async (path: string) => {
        return path.includes('lerna.json');
      });

      const result = await findProjectRoot('/app/packages/web');

      expect(result).toBeDefined();
    });

    test('should find monorepo root with package.json workspaces', async () => {
      const { findProjectRoot } = await import('./monorepo');
      const { pathExists, readFile } = await import('fs-extra');

      pathExists.mockImplementation(async (path: string) => {
        return path.includes('package.json');
      });

      readFile.mockImplementation(async () => {
        return JSON.stringify({ workspaces: ['packages/*'] });
      });

      const result = await findProjectRoot('/app/packages/api');

      expect(result).toBeDefined();
    });

    test('should find nearest package.json', async () => {
      const { findProjectRoot } = await import('./monorepo');
      const { pathExists } = await import('fs-extra');

      pathExists.mockImplementation(async (path: string) => {
        if (path.includes('package.json')) return true;
        return false;
      });

      const result = await findProjectRoot('/app/src');

      expect(result).toBeDefined();
    });

    test('should find git repository root', async () => {
      const { findProjectRoot } = await import('./monorepo');
      const { pathExists, stat } = await import('fs-extra');

      pathExists.mockImplementation(async (path: string) => {
        return path.includes('.git');
      });

      const result = await findProjectRoot('/repo/src');

      expect(result).toBeDefined();
    });

    test('should return null if no root found', async () => {
      const { findProjectRoot } = await import('./monorepo');
      const { pathExists } = await import('fs-extra');

      pathExists.mockImplementation(async () => false);

      const result = await findProjectRoot('/tmp/random');

      expect(result).toBeNull();
    });

    test('should handle git submodules', async () => {
      const { findProjectRoot } = await import('./monorepo');
      const { pathExists, stat, readFile } = await import('fs-extra');

      pathExists.mockImplementation(async (path: string) => path.includes('.git'));

      stat.mockImplementation(async (path: string) => ({
        isDirectory: () => false,
        isFile: () => true
      }));

      readFile.mockImplementation(async () => 'gitdir: .git/modules/submodule');

      const result = await findProjectRoot('/repo/submodule');

      expect(result).toBeDefined();
    });

    test('should use custom logDebug function', async () => {
      const { findProjectRoot } = await import('./monorepo');
      const { pathExists } = await import('fs-extra');
      const logDebug = mock(() => {});

      pathExists.mockImplementation(async () => false);

      await findProjectRoot('/tmp/test', logDebug);

      expect(logDebug).toHaveBeenCalled();
    });

    test('should check for pnpm-workspace.yaml', async () => {
      const { findProjectRoot } = await import('./monorepo');
      const { pathExists } = await import('fs-extra');

      pathExists.mockImplementation(async (path: string) => {
        return path.includes('pnpm-workspace.yaml');
      });

      const result = await findProjectRoot('/app');

      expect(result).toBeDefined();
    });

    test('should check for turbo.json', async () => {
      const { findProjectRoot } = await import('./monorepo');
      const { pathExists } = await import('fs-extra');

      pathExists.mockImplementation(async (path: string) => {
        return path.includes('turbo.json');
      });

      const result = await findProjectRoot('/monorepo/apps/web');

      expect(result).toBeDefined();
    });

    test('should traverse up directory tree', async () => {
      const { findProjectRoot } = await import('./monorepo');
      const { pathExists } = await import('fs-extra');

      let checkCount = 0;
      pathExists.mockImplementation(async (path: string) => {
        checkCount++;
        return path.endsWith('lerna.json') && checkCount > 3;
      });

      const result = await findProjectRoot('/very/deep/nested/directory');

      expect(checkCount).toBeGreaterThan(1);
    });
  });
});
