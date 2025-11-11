import type { ReleaseState } from './utils/rollback';
import { join } from 'node:path';
import { createRelease } from '@shared/utils/github-api';
import { logInfo, logSuccess } from '@shared/utils/logging';
import { config as loadDotenv } from 'dotenv';
import { generateStarterProjectsMetadata } from '../generate-starter-projects-metadata';
import { adjustPackageJsonVersion, getCliArgs, getVersion } from './utils/args';
import {
  archiveCliForRelease,
  buildCliForRelease,
  buildNpmPackageForRelease,
  // buildPlatformPackagesForRelease, // No longer needed - using download-on-install
  cleanUpPlatformArtifacts
} from './utils/build';
import { checkBranch, gitCommitProject } from './utils/git';
import { checkNpmVersionDoesNotExist, publishMainNpmPackage } from './utils/npm';
import { rollbackRelease } from './utils/rollback';
import { validateProject } from './utils/validation';

loadDotenv();

const getPrereleaseTag = (version: string): string | undefined => {
  const match = version.match(/-(alpha|beta|rc)\.\d+$/);
  return match ? match[1] : undefined;
};

export const releaseNpm = async () => {
  logInfo('Starting NPM release process...');

  const { isPrerelease } = getCliArgs();
  const version = await getVersion();

  const releaseState: ReleaseState = {
    version
  };

  try {
    await checkNpmVersionDoesNotExist({ version });

    if (!isPrerelease) {
      await checkBranch();
      await validateProject();
      await generateStarterProjectsMetadata();
    }

    const platformPaths = await buildCliForRelease(version);

    // Platform-specific npm packages are no longer needed - we use download-on-install approach
    // await buildPlatformPackagesForRelease(version, platformPaths);

    await buildNpmPackageForRelease(version);

    await cleanUpPlatformArtifacts({ platformPaths });

    await archiveCliForRelease();

    const npmTag = isPrerelease ? getPrereleaseTag(version) : undefined;

    // Platform-specific npm packages are no longer published - download-on-install approach
    // const publishedPlatformPackages = await publishPlatformPackages(npmTag);
    // releaseState.npmPlatformPackagesPublished = publishedPlatformPackages;

    await publishMainNpmPackage(version, npmTag);
    releaseState.npmMainPackagePublished = true;

    const tag = `v${version}`;
    const githubRelease = await createRelease({
      tag,
      body: `Release ${version}`,
      prerelease: isPrerelease
    });
    releaseState.githubReleaseId = githubRelease.data.id;
    releaseState.githubReleaseTag = tag;

    await adjustPackageJsonVersion({
      path: join(process.cwd(), 'package.json'),
      newVersion: version
    });
    await adjustPackageJsonVersion({
      path: join(process.cwd(), 'src', 'api', 'npm', 'package.json'),
      newVersion: version
    });
    await gitCommitProject(version);

    logSuccess(`NPM version ${version} released successfully!`);
  } catch (error) {
    await rollbackRelease(releaseState, error as Error);
    throw error;
  }
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

  releaseNpm().catch((error) => {
    console.error('NPM release failed with error:', error);
    process.exit(1);
  });
}
