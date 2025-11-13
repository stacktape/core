import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Mock dependencies
mock.module('@utils/decorators', () => ({
  memoizeGetters: (target: any) => target
}));

mock.module('@utils/git', () => ({
  getGitVariable: mock(async (variable: string) => {
    const mockData: Record<string, string> = {
      user: 'test-user',
      branch: 'main',
      commit: 'abc123def456',
      repositoryUrl: 'https://github.com/test/repo',
      changes: ''
    };
    return mockData[variable] || '';
  })
}));

mock.module('@utils/printer', () => ({
  printer: {
    debug: mock()
  }
}));

describe('GitInfoManager', () => {
  beforeEach(() => {
    mock.restore();
    delete process.env.STP_GIT_USER_NAME;
    delete process.env.GITHUB_TRIGGERING_ACTOR;
    delete process.env.STP_GIT_BRANCH_NAME;
    delete process.env.GITHUB_REF_NAME;
    delete process.env.STP_GIT_COMMIT_SHA;
    delete process.env.GITHUB_SHA;
    delete process.env.STP_GIT_URL;
    delete process.env.GITHUB_REPOSITORY;
  });

  test('should get git info from git commands', async () => {
    const { gitInfoManager } = await import('./index');

    const info = await gitInfoManager.gitInfo;

    expect(info.username).toBe('test-user');
    expect(info.branch).toBe('main');
    expect(info.commit).toBe('abc123def456');
    expect(info.gitUrl).toBe('https://github.com/test/repo');
    expect(info.hasUncommitedChanges).toBe(false);
  });

  test('should detect uncommitted changes', async () => {
    const { getGitVariable } = await import('@utils/git');
    (getGitVariable as any).mockImplementation(async (variable: string) => {
      if (variable === 'changes') return 'M  src/file.ts';
      const mockData: Record<string, string> = {
        user: 'test-user',
        branch: 'main',
        commit: 'abc123',
        repositoryUrl: 'https://github.com/test/repo'
      };
      return mockData[variable] || '';
    });

    const { GitInfoManager } = await import('./index');
    const manager = new GitInfoManager();

    const info = await manager.gitInfo;

    expect(info.hasUncommitedChanges).toBe(true);
  });

  test('should fallback to environment variables when git commands fail', async () => {
    const { getGitVariable } = await import('@utils/git');
    (getGitVariable as any).mockImplementation(async () => {
      throw new Error('Git command failed');
    });

    process.env.STP_GIT_USER_NAME = 'env-user';
    process.env.STP_GIT_BRANCH_NAME = 'env-branch';
    process.env.STP_GIT_COMMIT_SHA = 'env-commit-123';
    process.env.STP_GIT_URL = 'https://github.com/env/repo';

    const { GitInfoManager } = await import('./index');
    const manager = new GitInfoManager();

    const info = await manager.gitInfo;

    expect(info.username).toBe('env-user');
    expect(info.branch).toBe('env-branch');
    expect(info.commit).toBe('env-commit-123');
    expect(info.gitUrl).toBe('https://github.com/env/repo');
  });

  test('should use GitHub Actions environment variables', async () => {
    const { getGitVariable } = await import('@utils/git');
    (getGitVariable as any).mockImplementation(async () => {
      throw new Error('Git command failed');
    });

    process.env.GITHUB_TRIGGERING_ACTOR = 'github-user';
    process.env.GITHUB_REF_NAME = 'feature/test';
    process.env.GITHUB_SHA = 'github-commit-123';
    process.env.GITHUB_REPOSITORY = 'org/repo';

    const { GitInfoManager } = await import('./index');
    const manager = new GitInfoManager();

    const info = await manager.gitInfo;

    expect(info.username).toBe('github-user');
    expect(info.branch).toBe('feature/test');
    expect(info.commit).toBe('github-commit-123');
    expect(info.gitUrl).toBe('https://github.com/org/repo');
  });

  test('should use GitLab CI environment variables', async () => {
    const { getGitVariable } = await import('@utils/git');
    (getGitVariable as any).mockImplementation(async () => {
      throw new Error('Git command failed');
    });

    process.env.GITLAB_USER_NAME = 'gitlab-user';
    process.env.CI_COMMIT_REF_NAME = 'develop';
    process.env.CI_COMMIT_SHA = 'gitlab-commit-123';
    process.env.CI_PROJECT_URL = 'https://gitlab.com/project/repo';

    const { GitInfoManager } = await import('./index');
    const manager = new GitInfoManager();

    const info = await manager.gitInfo;

    expect(info.username).toBe('gitlab-user');
    expect(info.branch).toBe('develop');
    expect(info.commit).toBe('gitlab-commit-123');
    expect(info.gitUrl).toBe('https://gitlab.com/project/repo');
  });

  test('should use Bitbucket environment variables', async () => {
    const { getGitVariable } = await import('@utils/git');
    (getGitVariable as any).mockImplementation(async () => {
      throw new Error('Git command failed');
    });

    process.env.BITBUCKET_STEP_TRIGGERER_UUID = 'bitbucket-user';
    process.env.BITBUCKET_BRANCH = 'master';
    process.env.BITBUCKET_COMMIT = 'bitbucket-commit-123';
    process.env.BITBUCKET_GIT_HTTP_ORIGIN = 'https://bitbucket.org/project/repo';

    const { GitInfoManager } = await import('./index');
    const manager = new GitInfoManager();

    const info = await manager.gitInfo;

    expect(info.username).toBe('bitbucket-user');
    expect(info.branch).toBe('master');
    expect(info.commit).toBe('bitbucket-commit-123');
    expect(info.gitUrl).toBe('https://bitbucket.org/project/repo');
  });

  test('should handle null values when git fails and no env vars', async () => {
    const { getGitVariable } = await import('@utils/git');
    (getGitVariable as any).mockImplementation(async () => {
      throw new Error('Git command failed');
    });

    const { GitInfoManager } = await import('./index');
    const manager = new GitInfoManager();

    const info = await manager.gitInfo;

    expect(info.username).toBeNull();
    expect(info.branch).toBeNull();
    expect(info.commit).toBeNull();
    expect(info.gitUrl).toBeNull();
    expect(info.hasUncommitedChanges).toBe(false);
  });

  test('should log debug messages', async () => {
    const { printer } = await import('@utils/printer');
    const { GitInfoManager } = await import('./index');
    const manager = new GitInfoManager();

    await manager.gitInfo;

    expect(printer.debug).toHaveBeenCalledWith('Getting git info');
    expect(printer.debug).toHaveBeenCalledWith(expect.stringContaining('Getting git info done'));
  });

  test('should prioritize STP env vars over CI env vars', async () => {
    const { getGitVariable } = await import('@utils/git');
    (getGitVariable as any).mockImplementation(async () => {
      throw new Error('Git command failed');
    });

    process.env.STP_GIT_USER_NAME = 'stp-user';
    process.env.GITHUB_TRIGGERING_ACTOR = 'github-user';
    process.env.STP_GIT_BRANCH_NAME = 'stp-branch';
    process.env.GITHUB_REF_NAME = 'github-branch';

    const { GitInfoManager } = await import('./index');
    const manager = new GitInfoManager();

    const info = await manager.gitInfo;

    expect(info.username).toBe('stp-user');
    expect(info.branch).toBe('stp-branch');
  });
});
