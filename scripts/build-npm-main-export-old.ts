/* eslint-disable ts/no-require-imports */
import { join } from 'node:path';
import { getResourcesWithAugmentedProps, RESOURCES } from '@api/npm/ts/resource-metadata';
import { NPM_RELEASE_FOLDER_PATH, SOURCE_FOLDER_PATH } from '@shared/naming/project-fs-paths';
import { logInfo, logSuccess } from '@shared/utils/logging';
import { prettifyFile } from '@shared/utils/prettier';
import { build } from 'esbuild';
import { outputFile } from 'fs-extra';
import * as ts from 'typescript';
import { generateAugmentedPropsTypes, generateSdkPropsImports } from './code-generation/generate-augmented-props';
import { generatePropertiesInterfaces } from './code-generation/generate-cf-properties';
import { generateOverrideTypes } from './code-generation/generate-overrides';
import { generateResourceClassDeclarations } from './code-generation/generate-resource-classes';
import {
  generateTypePropertiesClassDeclarations,
  getTypePropertiesImports
} from './code-generation/generate-type-properties';

const TS_CONFIG_SOURCE_PATH = join(SOURCE_FOLDER_PATH, 'api', 'npm', 'ts', 'index.ts');
const TS_CONFIG_DIST_PATH = join(NPM_RELEASE_FOLDER_PATH, 'index.js');
const TS_CONFIG_TYPES_PATH = join(NPM_RELEASE_FOLDER_PATH, 'index.d.ts');

const buildNpmMainJsFileExport = async () => {
  logInfo('Bundling TypeScript config source code...');

  await build({
    entryPoints: [TS_CONFIG_SOURCE_PATH],
    bundle: true,
    outfile: TS_CONFIG_DIST_PATH,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    external: ['fs', 'path', 'util', 'stream', 'events', 'crypto'],
    minify: false,
    sourcemap: false,
    treeShaking: true
  });

  logSuccess(`TypeScript config bundled to ${TS_CONFIG_DIST_PATH}`);
};

/**
 * Essential base class and function declarations
 */
const ESSENTIAL_DECLARATIONS = `
declare const getParamReferenceSymbol: unique symbol;
declare const getTypeSymbol: unique symbol;
declare const getPropertiesSymbol: unique symbol;
declare const getOverridesSymbol: unique symbol;

/**
 * A reference to a resource parameter that will be resolved at runtime
 */
export declare class ResourceParamReference {
  private __resourceName: string;
  private __param: string;
  constructor(resourceName: string, param: string);
  toString(): string;
  toJSON(): string;
  valueOf(): string;
}

/**
 * Base class for type/properties structures (engines, packaging, events, etc.)
 */
export declare class BaseTypeProperties {
  readonly type: string;
  readonly properties: any;
  constructor(type: string, properties: any);
}

/**
 * Base resource class that provides common functionality
 */
export declare class BaseResource {
  private readonly _type: string;
  private readonly _properties: any;
  private readonly _overrides?: any;
  private readonly _resourceName: string;
  constructor(name: string, type: string, properties: any, overrides?: any);
  get resourceName(): string;
  [getParamReferenceSymbol](paramName: string): ResourceParamReference;
  [getTypeSymbol](): string;
  [getPropertiesSymbol](): any;
  [getOverridesSymbol](): any | undefined;
}

export type GetConfigParams = {
  /**
   * Stage ("environment") used for this operation
   */
  stage: string;
  /**
   * AWS region used for this operation
   * The list of available regions is available at https://www.aws-services.info/regions.html
   */
  region: string;
  /**
   * List of arguments passed to the operation
   */
  cliArgs: Record<string, boolean | number | string | string[]>;
  /**
   * Stacktape command used to perform this operation (can be either deploy, codebuild:deploy, delete, etc.)
   */
  command: string;
  /**
   * Locally-configured AWS profile used to execute the operation.
   * Doesn't apply if you have your AWS account connected in "automatic" mode.
   */
  awsProfile: string;
  /**
   * Information about the user performing the stack operation
   */
  user: {
    id: string;
    name: string;
    email: string;
  };
};
`;

/**
 * Remove duplicate declarations from config.ts that are in essentialDeclarations
 */
function removeDuplicateDeclarations(content: string): string {
  const linesToSkip = new Set<number>();
  const lines = content.split('\n');
  let inBlockToSkip = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we're starting a block to skip
    if (
      !inBlockToSkip &&
      (line.includes('declare const getParamReferenceSymbol:') ||
        line.includes('declare const getTypeSymbol:') ||
        line.includes('declare const getPropertiesSymbol:') ||
        line.includes('declare const getOverridesSymbol:') ||
        line.includes('export declare class BaseResource') ||
        line.includes('export declare class ResourceParamReference') ||
        line.includes('export declare class BaseTypeProperties') ||
        line.includes('export type GetConfigParams'))
    ) {
      inBlockToSkip = true;
      braceDepth = 0;
    }

    if (inBlockToSkip) {
      linesToSkip.add(i);
      braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

      // End of block
      if (braceDepth <= 0 && (line.includes('}') || line.includes(';'))) {
        inBlockToSkip = false;
      }
    }
  }

  return lines
    .map((line, i) => (linesToSkip.has(i) ? '' : line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // Remove multiple consecutive empty lines
    .trim();
}

/**
 * Filter out resource and type properties class declarations that we'll generate manually
 */
function filterDuplicateClassDeclarations(content: string): string {
  const resourceClassNames = RESOURCES.map((r) => r.className);
  const lines = content.split('\n');

  const filtered = lines.filter((line) => {
    // Remove resource class declarations like: export declare const LambdaFunction: any;
    for (const className of resourceClassNames) {
      if (line.includes(`export declare const ${className}:`)) {
        return false;
      }
    }

    // Remove type properties class declarations (engines, packaging, events, etc.)
    if (
      line.includes('export declare const') &&
      (line.includes('Engine') ||
        line.includes('Packaging') ||
        line.includes('Integration') ||
        line.includes('Route') ||
        line.includes('Rule') ||
        line.includes('Script') ||
        line.includes('LogForwarding') ||
        line.includes('LifecycleRule') ||
        line.includes('Mount'))
    ) {
      return false;
    }

    return true;
  });

  return filtered.join('\n');
}

export const generateNpmMainExportDeclarations = async () => {
  logInfo('Generating TypeScript declarations for config...');

  // Load child resources and referenceable params
  const childResourcesPath = join(SOURCE_FOLDER_PATH, 'api', 'npm', 'ts', 'child-resources.ts');
  const referenceableParamsPath = join(SOURCE_FOLDER_PATH, 'api', 'npm', 'ts', 'referenceable-params.ts');
  const CHILD_RESOURCES = require(childResourcesPath).CHILD_RESOURCES;
  const REFERENCEABLE_PARAMS = require(referenceableParamsPath).REFERENCEABLE_PARAMS;

  // Generate CloudFormation properties interfaces
  logInfo('Extracting Properties interfaces from cloudform files...');
  const propertiesInterfaces = generatePropertiesInterfaces(CHILD_RESOURCES);

  // Generate override types
  const overridesTypes = generateOverrideTypes(CHILD_RESOURCES);

  // Use TypeScript compiler API to generate declarations from source
  const compilerOptions: ts.CompilerOptions = {
    declaration: true,
    emitDeclarationOnly: true,
    skipLibCheck: true,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    strict: false,
    types: ['node'],
    baseUrl: process.cwd()
  };

  // All source files to include in compilation
  const sourceFiles = [
    join(SOURCE_FOLDER_PATH, 'api', 'npm', 'ts', 'config.ts'),
    join(SOURCE_FOLDER_PATH, 'api', 'npm', 'ts', 'resources.ts'),
    join(SOURCE_FOLDER_PATH, 'api', 'npm', 'ts', 'type-properties.ts'),
    join(SOURCE_FOLDER_PATH, 'api', 'npm', 'ts', 'global-aws-services.ts'),
    join(SOURCE_FOLDER_PATH, 'api', 'npm', 'ts', 'directives.ts'),
    join(SOURCE_FOLDER_PATH, 'api', 'npm', 'ts', 'connect-to-config.ts'),
    join(SOURCE_FOLDER_PATH, 'api', 'npm', 'ts', 'referenceable-params.ts')
  ];

  // Create program and emit declarations
  const program = ts.createProgram(sourceFiles, compilerOptions);
  const declarations = new Map<string, string>();

  program.emit(
    undefined,
    (fileName, data) => {
      if (fileName.endsWith('.d.ts')) {
        const baseName = fileName.split(/[/\\]/).pop()!.replace('.d.ts', '');
        declarations.set(baseName, data);
      }
    },
    undefined,
    true
  );

  if (declarations.size === 0) {
    throw new Error('Failed to generate declarations');
  }

  // Extract and clean declarations
  const configDts = declarations.get('config') || '';
  let resourcesDts = declarations.get('resources') || '';
  let typePropertiesDts = declarations.get('type-properties') || '';
  const awsServicesDts = declarations.get('global-aws-services') || '';
  const directivesDts = declarations.get('directives') || '';
  const connectToConfigDts = declarations.get('connect-to-config') || '';

  // Clean and process config declarations
  const configWithoutDuplicates = removeDuplicateDeclarations(configDts);

  // Filter out duplicate class declarations
  resourcesDts = filterDuplicateClassDeclarations(resourcesDts);
  typePropertiesDts = filterDuplicateClassDeclarations(typePropertiesDts);

  // Generate augmented props types
  const augmentedPropsTypes = generateAugmentedPropsTypes();

  // Generate resource class declarations
  const resourceClassDeclarations = generateResourceClassDeclarations(REFERENCEABLE_PARAMS);

  // Generate type properties class declarations
  const typePropertiesClassDeclarations = generateTypePropertiesClassDeclarations();

  // Generate SDK props imports
  const sdkPropsImports = generateSdkPropsImports();

  // Get type properties imports
  const resourcesWithAugmented = getResourcesWithAugmentedProps();
  const sdkPropsWithAugmentation = [
    ...resourcesWithAugmented.map((r) => r.propsType),
    'LocalScriptProps',
    'BastionScriptProps',
    'LocalScriptWithBastionTunnelingProps'
  ];
  const typePropertiesImports = getTypePropertiesImports(sdkPropsWithAugmentation);

  // Bundle all declarations into a single file
  const bundledDts = `/* eslint-disable */
// @ts-nocheck
// Generated file

// Import SDK types with Sdk prefix
import type {
  ${sdkPropsImports},
  ${typePropertiesImports.join(',\n  ')}
} from './sdk';

${configWithoutDuplicates}

${ESSENTIAL_DECLARATIONS}

${augmentedPropsTypes}

// Overrides types for child resources
${overridesTypes}

${resourceClassDeclarations}

${typePropertiesClassDeclarations}

// CloudFormation Properties interfaces for overrides
${propertiesInterfaces}

${resourcesDts}

${typePropertiesDts}

${awsServicesDts}

${directivesDts}

${connectToConfigDts}
`;

  await outputFile(TS_CONFIG_TYPES_PATH, bundledDts, { encoding: 'utf8' });
  await prettifyFile({ filePath: TS_CONFIG_TYPES_PATH });
  await prettifyFile({ filePath: TS_CONFIG_TYPES_PATH });

  logSuccess(`TypeScript declarations generated to ${TS_CONFIG_TYPES_PATH}`);
};

export const buildNpmMainExport = async () => {
  await Promise.all([buildNpmMainJsFileExport(), generateNpmMainExportDeclarations()]);
};

if (import.meta.main) {
  buildNpmMainExport();
}
