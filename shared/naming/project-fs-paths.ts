import { join } from 'node:path';

const DIST_FOLDER_NAME = '__stacktape-dist';
const PUBLISH_FOLDER_NAME = '__publish-folder';
const SOURCE_MAPS_FOLDER_NAME = '__source-maps';
const SOURCE_FOLDER_NAME = 'src';
export const BRIDGE_FILES_FOLDER_NAME = 'bridge-files';
export const HELPER_LAMBDAS_FOLDER_NAME = 'helper-lambdas';
const JSON_SCHEMAS_FOLDER_NAME = 'schemas';
const SOURCE_MAP_INSTALL_FILENAME = 'source-map-install.js';
const BINARY_DIST_FOLDER_NAME = '__binary-dist';
const CLI_RELEASE_FOLDER_NAME = '__release';
const SDK_RELEASE_FOLDER_NAME = '__release-npm';
const PLATFORM_PACKAGES_FOLDER_NAME = '__platform-packages';

export const DIST_FOLDER_PATH = join(process.cwd(), DIST_FOLDER_NAME);
export const CLI_BUILD_DIST_FOLDER_PATH = join(process.cwd(), '__cli-dist', 'stacktape');
export const BIN_DIST_FOLDER_PATH = join(process.cwd(), BINARY_DIST_FOLDER_NAME);
export const CLI_RELEASE_FOLDER_PATH = join(process.cwd(), CLI_RELEASE_FOLDER_NAME);
export const NPM_RELEASE_FOLDER_PATH = join(process.cwd(), SDK_RELEASE_FOLDER_NAME);
export const PUBLISH_GITHUB_REPO_DIR_PATH = join(process.cwd(), '__publish-gh-repo-dir');
export const PUBLISH_STARTER_PROJECTS_DIR_PATH = join(process.cwd(), '__publish-starters-repo-dir');
export const SOURCE_FOLDER_PATH = join(process.cwd(), 'src');
export const NPM_PACKAGE_JSON_SOURCE_PATH = join(SOURCE_FOLDER_PATH, 'api', 'npm', 'package.json');
export const SOURCE_MAP_INSTALL_DIST_PATH = join(DIST_FOLDER_PATH, SOURCE_MAP_INSTALL_FILENAME);
export const GITHUB_REPO_README_PATH = join(process.cwd(), 'README_GITHUB.md');
export const STARTER_PROJECTS_SOURCE_PATH = join(process.cwd(), 'starter-projects');
export const GENERATED_STARTER_PROJECTS_DIR_PATH = join(process.cwd(), '__starter-projects');
export const STARTER_PROJECTS_METADATA_DIST_PATH = join(process.cwd(), '.starter-project.json');
export const RESOURCES_DESCRIPTION_DIST_PATH = join(process.cwd(), '.resource-descriptions.json');
export const BRIDGE_FILES_SOURCE_FOLDER_PATH = join(SOURCE_FOLDER_NAME, 'utils', BRIDGE_FILES_FOLDER_NAME);
export const HELPER_LAMBDAS_DIST_FOLDER_PATH = join(DIST_FOLDER_PATH, HELPER_LAMBDAS_FOLDER_NAME);
export const HELPER_LAMBDAS_SOURCE_FOLDER_PATH = join(process.cwd(), HELPER_LAMBDAS_FOLDER_NAME);
export const CLI_DIST_PATH = join(DIST_FOLDER_PATH, 'cli.js');
export const GENERATED_FILES_FOLDER_PATH = join(process.cwd(), '@generated');
export const JSON_SCHEMAS_FOLDER_PATH = join(process.cwd(), '@generated', JSON_SCHEMAS_FOLDER_NAME);
export const PACK_GENERATED_FOLDER_PATH = join(process.cwd(), '@generated', 'pack');
export const AWS_PRICE_INFO_GENERATED_FOLDER_PATH = join(process.cwd(), '@generated', 'aws-price');
export const DB_ENGINE_VERSIONS_FOLDER = join(process.cwd(), '@generated', 'db-engine-versions');

export const CLOUDFORM_FOLDER_PATH = join(process.cwd(), '@generated', 'cloudform');
export const CLOUDFORM_ROOT_HELPER_FOLDER_PATH = join(process.cwd(), 'scripts', 'cloudform-root-helpers');

export const CONFIG_SCHEMA_PATH = join(JSON_SCHEMAS_FOLDER_PATH, 'config-schema.json');
export const CLI_SCHEMA_PATH = join(JSON_SCHEMAS_FOLDER_PATH, 'cli-schema.json');
export const SDK_SCHEMA_PATH = join(JSON_SCHEMAS_FOLDER_PATH, 'sdk-schema.json');
export const AJV_VALIDATION_CODE_PATH = join(JSON_SCHEMAS_FOLDER_PATH, 'validate-config-schema.js');

export const INSTALL_SCRIPTS_PATH = join(process.cwd(), 'scripts', 'install-scripts');
export const COMPLETIONS_SCRIPTS_PATH = join(process.cwd(), 'scripts', 'completions');
export const SCRIPTS_ASSETS_PATH = join(process.cwd(), 'scripts', 'assets');

export const CLI_SOURCE_PATH = join(SOURCE_FOLDER_PATH, 'api', 'cli', 'index.ts');
export const SDK_SOURCE_PATH = join(SOURCE_FOLDER_PATH, 'api', 'npm', 'sdk', 'index.ts');
