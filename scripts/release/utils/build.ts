import { BIN_DIST_FOLDER_PATH, PLATFORM_PACKAGES_FOLDER_PATH } from '@shared/naming/project-fs-paths';
import { logInfo } from '@shared/utils/logging';
import { mkdir, remove } from 'fs-extra';
import { buildPlatformSpecificNpmPackages } from '../../build-cli-platform-packages';
import { archiveCliBinaries, buildCliSources, getPlatformsToBuildFor } from '../../build-cli-sources';
import { buildNpm } from '../../build-npm';
import { getCliArgs } from './args';

export const buildCliForRelease = async (version: string) => {
  const { debug, platforms } = getCliArgs();

  logInfo('Building CLI binaries...');
  const [platformPaths] = await Promise.all([
    await buildCliSources({
      distFolderPath: BIN_DIST_FOLDER_PATH,
      version,
      debug: debug || false,
      keepUnarchived: true,
      presetPlatforms: platforms,
      skipArchiving: true
    })
  ]);

  return platformPaths;
};

export const buildPlatformPackagesForRelease = async (
  version: string,
  platformPaths: Record<SupportedPlatform, string>
) => {
  logInfo('Building platform-specific NPM packages...');
  await remove(PLATFORM_PACKAGES_FOLDER_PATH);
  await mkdir(PLATFORM_PACKAGES_FOLDER_PATH);

  // Extract the platforms that were actually built
  const platforms = Object.keys(platformPaths) as SupportedPlatform[];

  await buildPlatformSpecificNpmPackages({
    version,
    binariesDistPath: BIN_DIST_FOLDER_PATH,
    platformPackagesDistPath: PLATFORM_PACKAGES_FOLDER_PATH,
    platforms,
    platformPaths
  });

  // Note: Don't clean up unarchived platform directories yet
  // They contain sourcemaps that need to be uploaded to Sentry first
  // Cleanup will happen in cleanupAfterSourcemapUpload()
};

export const buildNpmPackageForRelease = async (version: string) => {
  logInfo('Building main NPM package...');
  await buildNpm({ version });
};

export const archiveCliForRelease = async () => {
  const { platforms: presetPlatforms } = getCliArgs();

  const platforms = getPlatformsToBuildFor({ presetPlatforms });

  // Archive binaries for GitHub releases (after sourcemaps have been removed)
  await archiveCliBinaries({
    distFolderPath: BIN_DIST_FOLDER_PATH,
    platforms
  });
};

export const cleanUpPlatformArtifacts = async ({
  platformPaths
}: {
  platformPaths: Record<SupportedPlatform, string>;
}) => {
  await Promise.all(Object.values(platformPaths).map(async (platformPath) => remove(platformPath)));
};
