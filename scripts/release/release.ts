import { join } from 'node:path';
import { CLI_RELEASE_FOLDER_PATH } from '@shared/naming/project-fs-paths';
import { logInfo, logSuccess } from '@shared/utils/logging';
import { config as loadDotenv } from 'dotenv';
import { mkdir, remove } from 'fs-extra';
import { generateSchemas } from '../generate-schemas';
import { generateStarterProjectsMetadata } from '../generate-starter-projects-metadata';
import { publishInstallScripts } from '../publish-install-scripts';
import { publishSchemas } from '../publish-schemas';
import { adjustPackageJsonVersion, getCliArgs, getVersion } from './utils/args';
import {
  archiveCliForRelease,
  buildCliForRelease,
  buildNpmPackageForRelease,
  // buildPlatformPackagesForRelease, // No longer needed - using download-on-install
  cleanUpPlatformArtifacts
} from './utils/build';
import { checkBranch, gitCommitProject } from './utils/git';
import { checkVersionDoesNotExist, createGithubRelease, uploadReleaseAssets } from './utils/github';
import { checkNpmVersionDoesNotExist, publishMainNpmPackage } from './utils/npm';
import { validateProject } from './utils/validation';

loadDotenv();

const getPrereleaseTag = (version: string): string | undefined => {
  const match = version.match(/-(alpha|beta|rc)\.\d+$/);
  return match ? match[1] : undefined;
};

export const release = async () => {
  logInfo('Starting release process...');

  const { isPrerelease } = getCliArgs();
  const version = await getVersion();

  await Promise.all([checkVersionDoesNotExist({ version }), checkNpmVersionDoesNotExist({ version })]);

  if (!isPrerelease) {
    await checkBranch();
    await validateProject();
    await generateStarterProjectsMetadata();
    await generateSchemas();
  }

  const platformPaths = await buildCliForRelease(version);

  // Platform-specific npm packages are no longer needed - we use download-on-install approach
  // await buildPlatformPackagesForRelease(version, platformPaths);

  await buildNpmPackageForRelease(version);

  await cleanUpPlatformArtifacts({ platformPaths });

  await archiveCliForRelease();

  await remove(CLI_RELEASE_FOLDER_PATH);
  await mkdir(CLI_RELEASE_FOLDER_PATH);

  const { uploadUrl, releaseId } = await createGithubRelease({ version, isPrerelease });
  await uploadReleaseAssets({ uploadUrl, releaseId });

  const npmTag = isPrerelease ? getPrereleaseTag(version) : undefined;

  // Platform-specific npm packages are no longer published - download-on-install approach
  // await publishPlatformPackages(npmTag);

  await publishMainNpmPackage(version, npmTag);

  if (isPrerelease) {
    await publishInstallScripts({ version, bucketType: 'preview' });
  } else {
    await publishInstallScripts({ version, bucketType: 'production' });
  }

  await Promise.all([
    adjustPackageJsonVersion({
      path: join(process.cwd(), 'package.json'),
      newVersion: version
    }),
    adjustPackageJsonVersion({
      path: join(process.cwd(), 'src', 'api', 'npm', 'package.json'),
      newVersion: version
    })
  ]);

  await gitCommitProject(version);

  if (!isPrerelease) {
    await publishSchemas();
  }

  logSuccess(`Version ${version} released successfully!
  NPM package: https://www.npmjs.com/package/stacktape/v/${version}
  Github release: https://github.com/stacktape/stacktape/releases/tag/${version}`);
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

  release().catch((error) => {
    console.error('Release failed with error:', error);
    process.exit(1);
  });
}
