import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import * as paths from './project-fs-paths';

describe('project-fs-paths', () => {
  describe('folder name constants', () => {
    test('should define dist folder name', () => {
      expect(paths.DIST_FOLDER_NAME).toBe('__stacktape-dist');
    });

    test('should define publish folder name', () => {
      expect(paths.PUBLISH_FOLDER_NAME).toBe('__publish-folder');
    });

    test('should define source maps folder name', () => {
      expect(paths.SOURCE_MAPS_FOLDER_NAME).toBe('__source-maps');
    });

    test('should define source code dist folder name', () => {
      expect(paths.SOURCE_CODE_DIST_FOLDER_NAME).toBe('src');
    });

    test('should define source folder name', () => {
      expect(paths.SOURCE_FOLDER_NAME).toBe('src');
    });

    test('should define bridge files folder name', () => {
      expect(paths.BRIDGE_FILES_FOLDER_NAME).toBe('bridge-files');
    });

    test('should define helper lambdas folder name', () => {
      expect(paths.HELPER_LAMBDAS_FOLDER_NAME).toBe('helper-lambdas');
    });

    test('should define JSON schemas folder name', () => {
      expect(paths.JSON_SCHEMAS_FOLDER_NAME).toBe('schemas');
    });

    test('should define source map install filename', () => {
      expect(paths.SOURCE_MAP_INSTALL_FILENAME).toBe('source-map-install.js');
    });

    test('should define binary dist folder name', () => {
      expect(paths.BINARY_DIST_FOLDER_NAME).toBe('__binary-dist');
    });

    test('should define CLI release folder name', () => {
      expect(paths.CLI_RELEASE_FOLDER_NAME).toBe('__release');
    });

    test('should define SDK release folder name', () => {
      expect(paths.SDK_RELEASE_FOLDER_NAME).toBe('__release-npm');
    });

    test('should define platform packages folder name', () => {
      expect(paths.PLATFORM_PACKAGES_FOLDER_NAME).toBe('__platform-packages');
    });
  });

  describe('folder paths', () => {
    test('DIST_FOLDER_PATH should join cwd with dist folder name', () => {
      expect(paths.DIST_FOLDER_PATH).toBe(join(process.cwd(), paths.DIST_FOLDER_NAME));
    });

    test('CLI_BUILD_DIST_FOLDER_PATH should be in __cli-dist', () => {
      expect(paths.CLI_BUILD_DIST_FOLDER_PATH).toBe(join(process.cwd(), '__cli-dist', 'stacktape'));
    });

    test('SDK_BUILD_DIST_FOLDER_PATH should be in __sdk-dist', () => {
      expect(paths.SDK_BUILD_DIST_FOLDER_PATH).toBe(join(process.cwd(), '__sdk-dist'));
    });

    test('BIN_DIST_FOLDER_PATH should join cwd with binary dist folder name', () => {
      expect(paths.BIN_DIST_FOLDER_PATH).toBe(join(process.cwd(), paths.BINARY_DIST_FOLDER_NAME));
    });

    test('CLI_RELEASE_FOLDER_PATH should join cwd with CLI release folder name', () => {
      expect(paths.CLI_RELEASE_FOLDER_PATH).toBe(join(process.cwd(), paths.CLI_RELEASE_FOLDER_NAME));
    });

    test('NPM_RELEASE_FOLDER_PATH should join cwd with SDK release folder name', () => {
      expect(paths.NPM_RELEASE_FOLDER_PATH).toBe(join(process.cwd(), paths.SDK_RELEASE_FOLDER_NAME));
    });

    test('PLATFORM_PACKAGES_FOLDER_PATH should be correct', () => {
      expect(paths.PLATFORM_PACKAGES_FOLDER_PATH).toBe(join(process.cwd(), paths.PLATFORM_PACKAGES_FOLDER_NAME));
    });

    test('PUBLISH_FOLDER_PATH should be correct', () => {
      expect(paths.PUBLISH_FOLDER_PATH).toBe(join(process.cwd(), paths.PUBLISH_FOLDER_NAME));
    });

    test('SOURCE_MAPS_FOLDER_PATH should be correct', () => {
      expect(paths.SOURCE_MAPS_FOLDER_PATH).toBe(join(process.cwd(), paths.SOURCE_MAPS_FOLDER_NAME));
    });

    test('PUBLISH_GITHUB_REPO_DIR_PATH should be correct', () => {
      expect(paths.PUBLISH_GITHUB_REPO_DIR_PATH).toBe(join(process.cwd(), '__publish-gh-repo-dir'));
    });

    test('PUBLISH_STARTER_PROJECTS_DIR_PATH should be correct', () => {
      expect(paths.PUBLISH_STARTER_PROJECTS_DIR_PATH).toBe(join(process.cwd(), '__publish-starters-repo-dir'));
    });

    test('SOURCE_FOLDER_PATH should be src directory', () => {
      expect(paths.SOURCE_FOLDER_PATH).toBe(join(process.cwd(), 'src'));
    });

    test('NPM_PACKAGE_JSON_SOURCE_PATH should be in src/api/npm', () => {
      expect(paths.NPM_PACKAGE_JSON_SOURCE_PATH).toBe(join(paths.SOURCE_FOLDER_PATH, 'api', 'npm', 'package.json'));
    });
  });

  describe('generated paths', () => {
    test('GENERATED_FILES_FOLDER_PATH should be @generated', () => {
      expect(paths.GENERATED_FILES_FOLDER_PATH).toBe(join(process.cwd(), '@generated'));
    });

    test('JSON_SCHEMAS_FOLDER_PATH should be in @generated/schemas', () => {
      expect(paths.JSON_SCHEMAS_FOLDER_PATH).toBe(join(process.cwd(), '@generated', paths.JSON_SCHEMAS_FOLDER_NAME));
    });

    test('PACK_GENERATED_FOLDER_PATH should be @generated/pack', () => {
      expect(paths.PACK_GENERATED_FOLDER_PATH).toBe(join(process.cwd(), '@generated', 'pack'));
    });

    test('AWS_PRICE_INFO_GENERATED_FOLDER_PATH should be correct', () => {
      expect(paths.AWS_PRICE_INFO_GENERATED_FOLDER_PATH).toBe(join(process.cwd(), '@generated', 'aws-price'));
    });

    test('DB_ENGINE_VERSIONS_FOLDER should be correct', () => {
      expect(paths.DB_ENGINE_VERSIONS_FOLDER).toBe(join(process.cwd(), '@generated', 'db-engine-versions'));
    });

    test('CLOUDFORM_FOLDER_PATH should be @generated/cloudform', () => {
      expect(paths.CLOUDFORM_FOLDER_PATH).toBe(join(process.cwd(), '@generated', 'cloudform'));
    });

    test('CLOUDFORM_ROOT_HELPER_FOLDER_PATH should be in scripts', () => {
      expect(paths.CLOUDFORM_ROOT_HELPER_FOLDER_PATH).toBe(join(process.cwd(), 'scripts', 'cloudform-root-helpers'));
    });

    test('SDK_TYPINGS_PATH should be index.d.ts in @generated/sdk-typings', () => {
      expect(paths.SDK_TYPINGS_PATH).toBe(join(process.cwd(), '@generated', 'sdk-typings', 'index.d.ts'));
    });
  });

  describe('schema paths', () => {
    test('CONFIG_SCHEMA_PATH should be in schemas folder', () => {
      expect(paths.CONFIG_SCHEMA_PATH).toBe(join(paths.JSON_SCHEMAS_FOLDER_PATH, 'config-schema.json'));
    });

    test('CLI_SCHEMA_PATH should be in schemas folder', () => {
      expect(paths.CLI_SCHEMA_PATH).toBe(join(paths.JSON_SCHEMAS_FOLDER_PATH, 'cli-schema.json'));
    });

    test('SDK_SCHEMA_PATH should be in schemas folder', () => {
      expect(paths.SDK_SCHEMA_PATH).toBe(join(paths.JSON_SCHEMAS_FOLDER_PATH, 'sdk-schema.json'));
    });

    test('AJV_VALIDATION_CODE_PATH should be in schemas folder', () => {
      expect(paths.AJV_VALIDATION_CODE_PATH).toBe(
        join(paths.JSON_SCHEMAS_FOLDER_PATH, 'validate-config-schema.js')
      );
    });
  });

  describe('source paths', () => {
    test('CLI_ENTRYFILE_SOURCE_PATH should be index.js in src/api/cli', () => {
      expect(paths.CLI_ENTRYFILE_SOURCE_PATH).toBe(join(process.cwd(), 'src', 'api', 'cli', 'index.js'));
    });

    test('CLI_SOURCE_PATH should be index.ts in src/api/cli', () => {
      expect(paths.CLI_SOURCE_PATH).toBe(join(paths.SOURCE_FOLDER_PATH, 'api', 'cli', 'index.ts'));
    });

    test('SDK_SOURCE_PATH should be in src/api/npm/sdk', () => {
      expect(paths.SDK_SOURCE_PATH).toBe(join(paths.SOURCE_FOLDER_PATH, 'api', 'npm', 'sdk', 'index.ts'));
    });

    test('SRC_INDEX_SOURCE_PATH should be index.ts in src', () => {
      expect(paths.SRC_INDEX_SOURCE_PATH).toBe(join(paths.SOURCE_FOLDER_PATH, 'index.ts'));
    });
  });

  describe('dist paths', () => {
    test('SOURCE_MAP_INSTALL_DIST_PATH should be in dist folder', () => {
      expect(paths.SOURCE_MAP_INSTALL_DIST_PATH).toBe(join(paths.DIST_FOLDER_PATH, paths.SOURCE_MAP_INSTALL_FILENAME));
    });

    test('CONFIG_SCHEMA_DEST_FOLDER_PATH should be in dist folder', () => {
      expect(paths.CONFIG_SCHEMA_DEST_FOLDER_PATH).toBe(join(paths.DIST_FOLDER_PATH, 'config-schema.json'));
    });

    test('CLI_DIST_PATH should be cli.js in dist folder', () => {
      expect(paths.CLI_DIST_PATH).toBe(join(paths.DIST_FOLDER_PATH, 'cli.js'));
    });

    test('SDK_DIST_PATH should be sdk.js in dist folder', () => {
      expect(paths.SDK_DIST_PATH).toBe(join(paths.DIST_FOLDER_PATH, 'sdk.js'));
    });
  });

  describe('helper lambdas paths', () => {
    test('HELPER_LAMBDAS_DIST_FOLDER_PATH should be in dist', () => {
      expect(paths.HELPER_LAMBDAS_DIST_FOLDER_PATH).toBe(join(paths.DIST_FOLDER_PATH, paths.HELPER_LAMBDAS_FOLDER_NAME));
    });

    test('HELPER_LAMBDAS_SOURCE_FOLDER_PATH should be at root', () => {
      expect(paths.HELPER_LAMBDAS_SOURCE_FOLDER_PATH).toBe(join(process.cwd(), paths.HELPER_LAMBDAS_FOLDER_NAME));
    });

    test('RELATIVE_HELPER_LAMBDAS_DIST_FOLDER_PATH should use dist folder name', () => {
      expect(paths.RELATIVE_HELPER_LAMBDAS_DIST_FOLDER_PATH).toBe(
        join(paths.DIST_FOLDER_NAME, paths.HELPER_LAMBDAS_FOLDER_NAME)
      );
    });
  });

  describe('bridge files paths', () => {
    test('BRIDGE_FILES_SOURCE_FOLDER_PATH should be in src/utils', () => {
      expect(paths.BRIDGE_FILES_SOURCE_FOLDER_PATH).toBe(
        join(paths.SOURCE_FOLDER_NAME, 'utils', paths.BRIDGE_FILES_FOLDER_NAME)
      );
    });

    test('BRIDGE_FILES_DEST_FOLDER_PATH should be in dist', () => {
      expect(paths.BRIDGE_FILES_DEST_FOLDER_PATH).toBe(join(paths.DIST_FOLDER_PATH, paths.BRIDGE_FILES_FOLDER_NAME));
    });
  });

  describe('scripts and assets paths', () => {
    test('RELEASE_NOTES_TEMPLATE_PATH should be in scripts', () => {
      expect(paths.RELEASE_NOTES_TEMPLATE_PATH).toBe(join(process.cwd(), 'scripts', './release-template.md'));
    });

    test('INSTALL_SCRIPTS_PATH should be in scripts', () => {
      expect(paths.INSTALL_SCRIPTS_PATH).toBe(join(process.cwd(), 'scripts', 'install-scripts'));
    });

    test('COMPLETIONS_SCRIPTS_PATH should be in scripts', () => {
      expect(paths.COMPLETIONS_SCRIPTS_PATH).toBe(join(process.cwd(), 'scripts', 'completions'));
    });

    test('SCRIPTS_ASSETS_PATH should be in scripts', () => {
      expect(paths.SCRIPTS_ASSETS_PATH).toBe(join(process.cwd(), 'scripts', 'assets'));
    });

    test('GENERATED_RELEASE_NOTES_PATH should be at root', () => {
      expect(paths.GENERATED_RELEASE_NOTES_PATH).toBe(join(process.cwd(), '__RELEASE-NOTES-TEMPLATE__.md'));
    });
  });

  describe('project paths', () => {
    test('STARTER_PROJECTS_SOURCE_PATH should be at root', () => {
      expect(paths.STARTER_PROJECTS_SOURCE_PATH).toBe(join(process.cwd(), 'starter-projects'));
    });

    test('GENERATED_STARTER_PROJECTS_DIR_PATH should be __starter-projects', () => {
      expect(paths.GENERATED_STARTER_PROJECTS_DIR_PATH).toBe(join(process.cwd(), '__starter-projects'));
    });

    test('STARTER_PROJECTS_METADATA_DIST_PATH should be .starter-project.json', () => {
      expect(paths.STARTER_PROJECTS_METADATA_DIST_PATH).toBe(join(process.cwd(), '.starter-project.json'));
    });

    test('RESOURCES_DESCRIPTION_DIST_PATH should be .resource-descriptions.json', () => {
      expect(paths.RESOURCES_DESCRIPTION_DIST_PATH).toBe(join(process.cwd(), '.resource-descriptions.json'));
    });

    test('USER_PROJECTS_PATH should be at root', () => {
      expect(paths.USER_PROJECTS_PATH).toBe(join(process.cwd(), 'user-projects'));
    });
  });

  describe('path consistency', () => {
    test('all folder paths should start with cwd', () => {
      const cwd = process.cwd();
      expect(paths.DIST_FOLDER_PATH).toStartWith(cwd);
      expect(paths.SOURCE_FOLDER_PATH).toStartWith(cwd);
      expect(paths.GENERATED_FILES_FOLDER_PATH).toStartWith(cwd);
    });

    test('dist paths should be under DIST_FOLDER_PATH', () => {
      expect(paths.CLI_DIST_PATH).toStartWith(paths.DIST_FOLDER_PATH);
      expect(paths.SDK_DIST_PATH).toStartWith(paths.DIST_FOLDER_PATH);
      expect(paths.SOURCE_MAP_INSTALL_DIST_PATH).toStartWith(paths.DIST_FOLDER_PATH);
    });

    test('source paths should be under SOURCE_FOLDER_PATH', () => {
      expect(paths.CLI_SOURCE_PATH).toStartWith(paths.SOURCE_FOLDER_PATH);
      expect(paths.SDK_SOURCE_PATH).toStartWith(paths.SOURCE_FOLDER_PATH);
      expect(paths.SRC_INDEX_SOURCE_PATH).toStartWith(paths.SOURCE_FOLDER_PATH);
    });

    test('schema paths should be under JSON_SCHEMAS_FOLDER_PATH', () => {
      expect(paths.CONFIG_SCHEMA_PATH).toStartWith(paths.JSON_SCHEMAS_FOLDER_PATH);
      expect(paths.CLI_SCHEMA_PATH).toStartWith(paths.JSON_SCHEMAS_FOLDER_PATH);
      expect(paths.SDK_SCHEMA_PATH).toStartWith(paths.JSON_SCHEMAS_FOLDER_PATH);
    });
  });
});
