import { exec } from '@shared/utils/exec';
import { logInfo, logSuccess } from '@shared/utils/logging';

export const validateProject = async () => {
  logInfo('Validating project with eslint and typescript...');
  await exec('bun', ['run', 'validate'], {});
  logSuccess('Project validated using eslint and typescript successfully.');
};
