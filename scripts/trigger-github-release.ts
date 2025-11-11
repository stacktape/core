import { exec as execAsync } from 'node:child_process';
import { promisify } from 'node:util';
import { octokit } from '@shared/utils/github-api';
import { logInfo, logSuccess } from '@shared/utils/logging';
import { readJsonSync } from 'fs-extra';
import { join } from 'node:path';
import yargsParser from 'yargs-parser';

const exec = promisify(execAsync);

const getIncrementType = (argv: ReturnType<typeof yargsParser>): string => {
  if (argv.major) return 'major';
  if (argv.minor) return 'minor';
  if (argv.patch) return 'patch';
  return 'none';
};

const getCurrentBranch = async (): Promise<string> => {
  const { stdout } = await exec('git branch --show-current');
  return stdout.trim();
};

const main = async () => {
  const argv = yargsParser(process.argv.slice(2));

  const version = argv.version || argv.v;
  const increment = getIncrementType(argv);
  const prerelease = Boolean(argv.prerelease || argv.pre);

  if (!version && increment === 'none') {
    console.error('Error: You must specify either --version or one of --major, --minor, --patch');
    console.error('');
    console.error('Usage:');
    console.error('  bun run release:gh --version 2.23.0');
    console.error('  bun run release:gh --minor');
    console.error('  bun run release:gh --patch --prerelease');
    process.exit(1);
  }

  const currentBranch = await getCurrentBranch();
  const packageJson = readJsonSync(join(process.cwd(), 'package.json'));
  const currentVersion = packageJson.version;

  logInfo(`Current branch: ${currentBranch}`);
  logInfo(`Current version: ${currentVersion}`);

  if (version) {
    logInfo(`Triggering release workflow with explicit version: ${version}`);
  } else {
    logInfo(`Triggering release workflow with ${increment} increment`);
  }

  if (prerelease) {
    logInfo('This will be a prerelease');
  }

  try {
    const response = await octokit.actions.createWorkflowDispatch({
      owner: 'stacktape',
      repo: 'stacktape',
      workflow_id: 'release.yml',
      ref: currentBranch,
      inputs: {
        version: version || '',
        increment,
        prerelease: String(prerelease)
      }
    });

    if (response.status === 204) {
      logSuccess('Release workflow triggered successfully!');
      logInfo('');
      logInfo('View workflow runs at: https://github.com/stacktape/stacktape/actions/workflows/release.yml');
    } else {
      throw new Error(`Unexpected response status: ${response.status}`);
    }
  } catch (error: any) {
    console.error('Failed to trigger release workflow:', error.message);
    if (error.status === 404) {
      console.error('');
      console.error('Possible causes:');
      console.error('  - The release.yml workflow file does not exist');
      console.error('  - The current branch does not have the workflow file');
      console.error('  - GitHub token does not have sufficient permissions');
    }
    process.exit(1);
  }
};

if (import.meta.main) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
