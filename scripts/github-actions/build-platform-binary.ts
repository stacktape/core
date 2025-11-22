import { join } from 'node:path';
import {
  BIN_DIST_FOLDER_PATH,
  BRIDGE_FILES_FOLDER_NAME,
  DIST_FOLDER_PATH,
  HELPER_LAMBDAS_FOLDER_NAME
} from '@shared/naming/project-fs-paths';
import { logInfo, logSuccess } from '@shared/utils/logging';
import { archiveItem } from '@shared/utils/zip';
import { copy, remove } from 'fs-extra';
import yargsParser from 'yargs-parser';
import {
  buildBinaryFile,
  buildEsbuildRegister,
  copyConfigSchema,
  copyEsbuildBinary,
  copyHelperLambdas,
  copyNixpacksBinary,
  copyPackBinary,
  copySessionsManagerPluginBinary,
  createReleaseDataFile,
  EXECUTABLE_FILE_PATTERNS
} from '../build-cli-sources';
import { generateStarterProjectsMetadata } from '../generate-starter-projects-metadata';
import { packageHelperLambdas } from '../package-helper-lambdas';

const main = async () => {
  const argv = yargsParser(process.argv.slice(2));
  const platform = argv.platform as SupportedPlatform;
  const version = argv.version as string;

  if (!platform || !version) {
    throw new Error('Platform and version are required. Usage: --platform <platform> --version <version>');
  }

  logInfo(`Building binary for platform: ${platform}, version: ${version}`);

  const distFolderPath = BIN_DIST_FOLDER_PATH;
  await remove(distFolderPath);

  // Prepare shared resources
  await Promise.all([
    packageHelperLambdas({ isDev: false, distFolderPath: DIST_FOLDER_PATH })
    // Note: copyBridgeFiles is not needed per-platform
  ]);

  const starterProjectsMetadataFilePath = await generateStarterProjectsMetadata();

  // Build binary for the specific platform
  const platformDistFolderPath = await buildBinaryFile({
    sourceFolderPath: process.cwd(),
    distFolderPath,
    platform,
    debug: false,
    version
  });

  // Copy all required binaries and files
  await copyPackBinary({ distFolderPath, platform });
  await copyNixpacksBinary({ distFolderPath, platform });
  await copySessionsManagerPluginBinary({ distFolderPath, platform });
  await copyEsbuildBinary({ distFolderPath, platform });
  await buildEsbuildRegister({ distFolderPath: platformDistFolderPath });
  await copyConfigSchema({ distFolderPath: platformDistFolderPath });
  await copyHelperLambdas({ distFolderPath: platformDistFolderPath });
  await createReleaseDataFile({ distFolderPath: platformDistFolderPath, version });
  await copy(starterProjectsMetadataFilePath, join(platformDistFolderPath, 'starter-projects.json'));

  // Archive the binary
  const archivePath = await archiveItem({
    absoluteSourcePath: platformDistFolderPath,
    format: platform === 'win' ? 'zip' : 'tgz',
    executablePatterns: EXECUTABLE_FILE_PATTERNS
  });

  logInfo('Cleaning up temporary files...');
  await Promise.all([
    remove(join(distFolderPath, 'downloaded')),
    remove(DIST_FOLDER_PATH),
    remove(join(distFolderPath, HELPER_LAMBDAS_FOLDER_NAME)),
    remove(join(distFolderPath, BRIDGE_FILES_FOLDER_NAME)),
    remove(platformDistFolderPath) // Remove unarchived folder
  ]);
  logSuccess('Temporary files cleaned up successfully.');

  logSuccess(`Binary for platform ${platform} built successfully: ${archivePath}`);
};

if (import.meta.main) {
  main().catch((error) => {
    console.error('Error building platform binary:', error);
    process.exit(1);
  });
}
