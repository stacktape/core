import { join } from 'node:path';
import { NPM_RELEASE_FOLDER_PATH, PLATFORM_PACKAGES_FOLDER_PATH } from '@shared/naming/project-fs-paths';
import { exec } from '@shared/utils/exec';
import { logInfo, logSuccess } from '@shared/utils/logging';
import { readdir } from 'fs-extra';

export const checkNpmVersionDoesNotExist = async ({
  version,
  packageName
}: {
  version: string;
  packageName?: string;
}) => {
  const pkg = packageName || 'stacktape';
  logInfo(`Checking if version ${version} already exists on NPM for package "${pkg}"...`);

  try {
    const response = await fetch(`https://registry.npmjs.org/${pkg}/${version}`);
    if (response.status === 404) {
      logSuccess(`Version ${version} does not exist on NPM - proceeding with release.`);
      return;
    }
    if (response.ok) {
      throw new Error(`Version ${version} already exists on NPM for package "${pkg}". Please use a different version.`);
    }
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      throw error;
    }
    // If it's a network error or other issue, log it but continue
    logInfo(`Could not verify NPM version (network issue): ${error.message}`);
  }
};

export const publishMainNpmPackage = async (newVersion: string, tag?: string) => {
  logInfo('Publishing main NPM package...');
  await exec('bun', ['publish', '--access', 'public'].concat(tag ? ['--tag', tag] : []), {
    rawOptions: { shell: true },
    cwd: NPM_RELEASE_FOLDER_PATH
  });
  logSuccess('Main NPM package published successfully.');
};

export const publishPlatformPackages = async (tag?: string): Promise<string[]> => {
  logInfo('Publishing platform-specific NPM packages...');

  const packageDirs = await readdir(PLATFORM_PACKAGES_FOLDER_PATH);
  const publishedPackages: string[] = [];

  for (const packageDir of packageDirs) {
    if (packageDir.startsWith('__')) continue; // Skip temp directories

    const packagePath = join(PLATFORM_PACKAGES_FOLDER_PATH, packageDir);
    logInfo(`Publishing ${packageDir}...`);

    await exec('bun', ['publish', '--access', 'public'].concat(tag ? ['--tag', tag] : []), {
      rawOptions: { shell: true },
      cwd: packagePath
    });

    publishedPackages.push(packageDir);
    logSuccess(`Package ${packageDir} published successfully.`);
  }

  logSuccess('All platform packages published successfully.');
  return publishedPackages;
};
