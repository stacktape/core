import { join } from 'node:path';
import { INSTALL_SCRIPTS_PREVIEW_BUCKET_NAME } from '@config';
import { CLI_RELEASE_FOLDER_PATH } from '@shared/naming/project-fs-paths';
import { logInfo, logSuccess } from '@shared/utils/logging';
import { prepareInstallScripts } from './publish-install-scripts';
import { syncBucket } from './publish-schemas';
import { getVersion } from './release/utils/version';

const DIST_FOLDER = join(CLI_RELEASE_FOLDER_PATH, 'install-scripts');

export const publishInstallScriptsPreview = async ({ version }: { version?: string | null }) => {
  let versionToUse = version;
  if (!versionToUse) {
    versionToUse = await getVersion();
  }

  await prepareInstallScripts({ version: versionToUse });

  logInfo(
    `Publishing preview install scripts with default version ${versionToUse} to preview install scripts hosting bucket...`
  );
  await syncBucket({
    bucketName: INSTALL_SCRIPTS_PREVIEW_BUCKET_NAME,
    sourcePath: DIST_FOLDER
  });
  logSuccess(`Preview install scripts with default version ${versionToUse} published successfully.`);
};

if (import.meta.main) {
  publishInstallScriptsPreview({ version: null });
}
