#!/usr/bin/env bun

import { readFile, writeFile } from 'fs/promises';

const filesToClean = [
  {
    file: 'c:\\Projects\\stacktape\\shared\\packaging\\bundlers\\es\\utils.ts',
    removeFunctions: [
      'getInfoFromPackageJson',
      'hasBinary',
      'getEsPackageManager',
      'resolvePrisma',
      'getModuleNameFromArgs',
      'getAllJsDependenciesFromMultipleFiles',
      'copyNodeModules',
      'getLambdaRuntimeFromNodeTarget',
      'determineIfAlias',
      'getModuleNameFromPath',
      'copyToDeploymentPackage',
      'getExternalDeps',
      'getModuleFromImporter',
      'getFailedImportsFromEsbuildError',
      'resolveDifferentSourceMapLocation'
    ],
    removeTypes: ['PackageJsonDepsInfo'],
    removeConsts: ['PACKAGE_LOCKS']
  }
];

const main = async () => {
  for (const { file } of filesToClean) {
    const content = await readFile(file, 'utf-8');

    // Since this file has many unused exports and they're interconnected,
    // let's just mark them for manual review
    console.log(`File: ${file}`);
    console.log('This file needs manual cleanup of 17 unused exports.');
    console.log('The exports are all used only within this file and not imported from outside.');
    console.log('Since they form a complex dependency tree, it\'s safer to remove them manually.\n');
  }
};

main().catch(console.error);
