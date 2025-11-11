const { join, dirname } = require('node:path');
const esbuild = require('esbuild');
const { readJson } = require('fs-extra');
const yargsParser = require('yargs-parser');

const run = async () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _: commands, ...processArgs } = yargsParser(process.argv);
  const entryPoint = join(process.cwd(), processArgs.scriptPath);
  const originalCwd = process.cwd().split('\\').join('\\\\');
  const packageJsonPath = join(process.cwd(), 'package.json');
  const packageJson = await readJson(join(process.cwd(), 'package.json'));
  process.argv = process.argv.filter(
    (arg, index, arr) => arg !== '--scriptPath' && index !== arr.indexOf('--scriptPath') + 1
  );
  process.chdir(dirname(packageJsonPath));
  const distPath = join(dirname(packageJsonPath), 'node_modules', '__script-dist', 'script.js');
  await esbuild.build({
    banner: {
      js: `require('source-map-support').install({ environment: 'node', handleUncaughtExceptions: false });
Error.stackTraceLimit = 25;
process.env.ESBUILD_WORKER_THREADS = true;
process.env.BUILD_MODE = 'true';
require('events').defaultMaxListeners = 30;
const { logError: __le } = require(require('path').join('${originalCwd}', 'shared', 'utils', 'logging.js'));
// process.on('uncaughtException', err => __le(err));
// process.on('unhandledRejection', err => __le(err));
`
    },
    bundle: true,
    external: ['pnpapi', 'fsevents', 'prettier', ...Object.keys(packageJson.dependencies)],
    sourcemap: true,
    platform: 'node',
    target: `node${process.versions.node}`,
    outfile: distPath,
    entryPoints: [entryPoint],
    logLevel: 'error'
  });
  process.env.INVOKED_SCRIPT = processArgs.scriptPath.replace('scripts/', '').replace('.ts', '');
  // eslint-disable-next-line import/no-dynamic-require
  require(distPath);
};

if (require.main.filename === module.filename) {
  run().catch(console.error);
}
