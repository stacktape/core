import { exec } from '@shared/utils/exec';
import { deleteRelease } from '@shared/utils/github-api';
import { logError, logInfo, logSuccess, logWarn } from '@shared/utils/logging';

export type ReleaseState = {
  githubReleaseId?: number;
  githubReleaseTag?: string;
  npmMainPackagePublished?: boolean;
  npmPlatformPackagesPublished?: string[];
  version: string;
};

const unpublishNpmPackage = async (packageName: string, version: string): Promise<void> => {
  try {
    logInfo(`Unpublishing ${packageName}@${version} from NPM...`);
    await exec('npm', ['unpublish', `${packageName}@${version}`, '--force'], {});
    logSuccess(`Successfully unpublished ${packageName}@${version}`);
  } catch (error) {
    logError(
      new Error(
        `Failed to unpublish ${packageName}@${version} ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
  }
};

const deleteGithubRelease = async (releaseId: number, tag: string): Promise<void> => {
  try {
    logInfo(`Deleting GitHub release ${tag} (ID: ${releaseId})...`);
    await deleteRelease({ releaseId });
    logSuccess(`Successfully deleted GitHub release ${tag}`);
  } catch (error) {
    logError(
      new Error(`Failed to delete GitHub release ${tag}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    );
  }
};

export const rollbackRelease = async (state: ReleaseState, error: Error): Promise<void> => {
  logWarn(`RELEASE FAILED - Starting automatic rollback. Error:\n${error}`);

  const rollbackPromises: Promise<void>[] = [];

  // Delete GitHub release if it was created
  if (state.githubReleaseId && state.githubReleaseTag) {
    rollbackPromises.push(deleteGithubRelease(state.githubReleaseId, state.githubReleaseTag));
  }

  // Unpublish main NPM package if it was published
  if (state.npmMainPackagePublished) {
    rollbackPromises.push(unpublishNpmPackage('stacktape', state.version));
  }

  // Unpublish platform packages if they were published
  for (const packageName of state.npmPlatformPackagesPublished || []) {
    rollbackPromises.push(unpublishNpmPackage(packageName, state.version));
  }

  // Wait for all rollback operations to complete
  await Promise.allSettled(rollbackPromises);

  logWarn('Rollback complete. The release was not successful.');
};
