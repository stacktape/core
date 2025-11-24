import { CLI_DIST_PATH, CLI_SOURCE_PATH, DIST_FOLDER_PATH } from '@shared/naming/project-fs-paths';
import { dynamicRequire } from '@shared/utils/fs-utils';
import { logError, logInfo, logWarn } from '@shared/utils/logging';
import packageJson from '../package.json';
import { generateSourceMapInstall } from './build-cli-sources';
import { packageHelperLambdas } from './package-helper-lambdas';

const buildSource = async () => {
  const result = await Bun.build({
    entrypoints: [CLI_SOURCE_PATH],
    outdir: CLI_DIST_PATH,
    target: 'bun',
    minify: false,
    sourcemap: 'inline',
    bytecode: false,
    define: {
      STACKTAPE_VERSION: `"dev-${packageJson.version}"`
    }
  });
  if (!result.success) {
    throw new Error(`Failed to build source: ${result.logs.map((log) => log.message).join('\n')}`);
  }
};

export const runDev = async () => {
  await Promise.all([
    buildSource(),
    packageHelperLambdas({ isDev: true, distFolderPath: DIST_FOLDER_PATH }),
    generateSourceMapInstall({ distFolderPath: DIST_FOLDER_PATH })
  ]);

  logInfo('----- RUN -----');
  try {
    process.env.STP_DEV_MODE = 'true';
    const { runUsingCli } = dynamicRequire({
      filePath: CLI_DIST_PATH
    }) as typeof import('../src/api/cli');
    await runUsingCli();
    logInfo('----- FINISHED -----');
  } catch (err) {
    // if for some reason, the error doesn't get properly handled, print
    if (err.details === undefined) {
      logError(err, '- UNHANDLED ERROR -');
    }
    logWarn('----- FINISHED WITH ERROR -----');
  }
};

if (import.meta.main) {
  runDev();
}
