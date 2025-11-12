import { describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('node:os', () => ({
  default: {
    EOL: '\n'
  }
}));

mock.module('@shared/utils/exec', () => ({
  executeGit: mock(async (command: string) => {
    if (command === 'describe --always') return { stdout: 'v1.0.0-5-abc123' };
    if (command === 'rev-parse --short HEAD') return { stdout: 'abc123' };
    if (command === 'rev-parse HEAD') return { stdout: 'abc123def456ghi789' };
    if (command === 'rev-parse --abbrev-ref HEAD') return { stdout: 'main' };
    if (command === 'log -1 --pretty=%B') return { stdout: 'Fix: resolve bug' };
    if (command === 'config user.name') return { stdout: 'John Doe' };
    if (command === 'config user.email') return { stdout: 'john@example.com' };
    if (command === 'write-tree') return { stdout: 'tree123' };
    if (command === 'diff-index tree123 --') return { stdout: 'M file.ts' };
    if (command === 'rev-parse --show-toplevel') return { stdout: '/home/user/project' };
    if (command === 'tag --points-at HEAD') return { stdout: 'v1.0.0\nv1.0.1' };
    if (command === 'config --get remote.origin.url') return { stdout: 'https://github.com/user/repo.git' };
    return { stdout: '' };
  })
}));

mock.module('@shared/utils/fs-utils', () => ({
  getBaseName: mock((path: string) => path.split('/').pop())
}));

describe('git', () => {
  describe('getGitVariable', () => {
    test('should get describe variable', async () => {
      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('describe');

      expect(result).toBe('v1.0.0-5-abc123');
    });

    test('should get sha1 variable', async () => {
      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('sha1');

      expect(result).toBe('abc123');
    });

    test('should get commit variable', async () => {
      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('commit');

      expect(result).toBe('abc123def456ghi789');
    });

    test('should get branch variable', async () => {
      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('branch');

      expect(result).toBe('main');
    });

    test('should get message variable', async () => {
      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('message');

      expect(result).toBe('Fix: resolve bug');
    });

    test('should get user variable', async () => {
      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('user');

      expect(result).toBe('John Doe');
    });

    test('should get email variable', async () => {
      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('email');

      expect(result).toBe('john@example.com');
    });

    test('should get changes variable', async () => {
      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('changes');

      expect(result).toBe('M file.ts');
    });

    test('should get repository variable', async () => {
      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('repository');

      expect(result).toBe('project');
    });

    test('should get tags variable', async () => {
      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('tags');

      expect(result).toBe('v1.0.0::v1.0.1');
    });

    test('should get repositoryUrl variable with HTTPS URL', async () => {
      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('repositoryUrl');

      expect(result).toBe('https://github.com/user/repo.git');
    });

    test('should convert SSH URL to HTTPS for repositoryUrl', async () => {
      mock.module('@shared/utils/exec', () => ({
        executeGit: mock(async (command: string) => {
          if (command === 'config --get remote.origin.url') return { stdout: 'git@github.com:user/repo.git' };
          return { stdout: '' };
        })
      }));

      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('repositoryUrl');

      expect(result).toContain('https://');
      expect(result).toContain('github.com');
    });

    test('should handle tags with fallback to sha1', async () => {
      mock.module('@shared/utils/exec', () => ({
        executeGit: mock(async (command: string) => {
          if (command === 'tag --points-at HEAD') return { stdout: '' };
          if (command === 'rev-parse --short HEAD') return { stdout: 'fallback123' };
          return { stdout: '' };
        })
      }));

      const { getGitVariable } = await import('./git');

      const result = await getGitVariable('tags');

      expect(result).toBe('fallback123');
    });

    test('should call executeGit with correct command for describe', async () => {
      const { executeGit } = await import('@shared/utils/exec');
      const { getGitVariable } = await import('./git');

      await getGitVariable('describe');

      expect(executeGit).toHaveBeenCalledWith('describe --always');
    });

    test('should call executeGit with correct command for branch', async () => {
      const { executeGit } = await import('@shared/utils/exec');
      const { getGitVariable } = await import('./git');

      await getGitVariable('branch');

      expect(executeGit).toHaveBeenCalledWith('rev-parse --abbrev-ref HEAD');
    });

    test('should use getBaseName for repository name', async () => {
      const { getBaseName } = await import('@shared/utils/fs-utils');
      const { getGitVariable } = await import('./git');

      await getGitVariable('repository');

      expect(getBaseName).toHaveBeenCalled();
    });
  });
});
