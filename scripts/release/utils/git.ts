import { executeGit } from '@shared/utils/exec';
import { logInfo, logSuccess, logWarn } from '@shared/utils/logging';
import inquirer from 'inquirer';
import { getCliArgs } from './args';

export const checkBranch = async () => {
  const { skipProjectCheck } = getCliArgs();
  const { stdout: currentBranch } = await executeGit('branch --show-current');
  if (currentBranch !== 'master') {
    const message = `Releasing should be done only from master branch. Current branch: ${currentBranch}.`;
    if (skipProjectCheck) {
      logWarn(message);
    } else {
      const { proceed } = await inquirer.prompt({
        type: 'confirm',
        name: 'proceed',
        message: `${message} Proceed anyway?`
      });
      if (!proceed) {
        throw new Error(message);
      }
    }
  }
};

export const gitCommitProject = async (newVersion: string) => {
  logInfo('Committing new release...');
  await executeGit('add .');
  await executeGit(`commit -m "release ${newVersion}"`);
  logSuccess('New release successfully committed.');
};
