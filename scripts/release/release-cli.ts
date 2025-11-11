import { join } from 'node:path';
import { CLI_RELEASE_FOLDER_PATH } from '@shared/naming/project-fs-paths';
import { logInfo, logSuccess } from '@shared/utils/logging';
import { config as loadDotenv } from 'dotenv';
import { mkdir, remove } from 'fs-extra';
import { generateStarterProjectsMetadata } from '../generate-starter-projects-metadata';
import { publishInstallScripts } from '../publish-install-scripts';
import { adjustPackageJsonVersion, getCliArgs, getVersion } from './utils/args';
import { archiveCliForRelease, buildCliForRelease } from './utils/build';
import { checkBranch, gitCommitProject } from './utils/git';
import { checkVersionDoesNotExist, createGithubRelease, uploadReleaseAssets } from './utils/github';
import { validateProject } from './utils/validation';

loadDotenv();

export const releaseCli = async () => {
  logInfo('Starting CLI release process...');

  const { isPrerelease } = getCliArgs();
  const version = await getVersion();

  await checkVersionDoesNotExist({ version });

  if (!isPrerelease) {
    await checkBranch();
    await validateProject();
    await generateStarterProjectsMetadata();
  }

  await buildCliForRelease(version);

  await archiveCliForRelease();

  await remove(CLI_RELEASE_FOLDER_PATH);
  await mkdir(CLI_RELEASE_FOLDER_PATH);

  const { uploadUrl, releaseId } = await createGithubRelease({ version, isPrerelease });
  await uploadReleaseAssets({ uploadUrl, releaseId });

  if (isPrerelease) {
    await publishInstallScripts({ version, bucketType: 'preview' });
  } else {
    await publishInstallScripts({ version, bucketType: 'production' });
  }

  await adjustPackageJsonVersion({
    path: join(process.cwd(), 'package.json'),
    newVersion: version
  });
  await adjustPackageJsonVersion({
    path: join(process.cwd(), 'src', 'api', 'npm', 'package.json'),
    newVersion: version
  });
  await gitCommitProject(version);

  logSuccess(`CLI version ${version} released successfully!`);
};

if (import.meta.main) {
  // Add global error handlers to catch unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  releaseCli().catch((error) => {
    console.error('CLI release failed with error:', error);
    process.exit(1);
  });
}
