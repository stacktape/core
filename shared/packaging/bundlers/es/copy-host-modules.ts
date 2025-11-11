// import { join, resolve } from 'path';
// import fs from 'fs';
// import semver from 'semver';
// import uniqWith from 'lodash/uniqWith';
// import { readJsonSync } from 'fs-extra';
// import { dirExists, getMatchingFilesByGlob } from '@shared/utils/fs-utils';
// import { raiseError } from '@shared/utils/misc';
// import { IGNORED_MODULES, IGNORED_MISSING_DEPENDENCIES } from './config';
// import { copyToDeploymentPackage } from './utils';

// type PackageInfo = { name: string; version: string };

// const getPackageJson = (directory: string): PackageJson => {
//   const pkgPath = resolve(directory, 'package.json');
//   try {
//     return { dependencies: {}, devDependencies: {}, peerDependencies: {}, ...readJsonSync(pkgPath) };
//   } catch (e) {
//     // skip missing modules
//     return null;
//   }
// };

// const hasPackage = (pkg, pkgs) => {
//   const { name, version } = pkg;
//   for (let i = 0; i < pkgs.length; i += 1) {
//     if (pkgs[i].name === name && pkgs[i].version === version) {
//       return true;
//     }
//   }
//   return false;
// };

// const addPkgDeps = ({
//   baseDir,
//   packageInfo,
//   resultAccumulator,
//   rootDir
// }: {
//   baseDir: string;
//   rootDir: string;
//   packageInfo: PackageInfo;
//   resultAccumulator: PackageInfo[];
// }) => {
//   const packageDirPath = resolve(baseDir, `node_modules/${packageInfo.name}`);
//   const pkgContent = getPackageJson(packageDirPath);
//   if (!pkgContent) {
//     return;
//   }

//   if (hasPackage(pkgContent, resultAccumulator)) {
//     return;
//   }

//   if (baseDir === rootDir) {
//     const { name, version } = pkgContent;
//     if (!semver.validRange(packageInfo.version) || semver.satisfies(pkgContent.version, packageInfo.version)) {
//       resultAccumulator.push({ name, version });
//     }
//   }

//   // recursive search sub modules
//   const subPkgBase = resolve(packageDirPath, 'node_modules');
//   if (dirExists(subPkgBase)) {
//     const subPkgs = fs.readdirSync(subPkgBase);
//     subPkgs.forEach((name) =>
//       addPkgDeps({ baseDir: packageDirPath, packageInfo: { name, version: '*' }, resultAccumulator, rootDir })
//     );
//   }

//   Object.keys({ ...(pkgContent.dependencies || {}), ...(pkgContent.peerDependencies || {}) }).forEach((name) => {
//     const version = pkgContent.dependencies[name] || pkgContent.peerDependencies[name];
//     if (!version.startsWith('file:')) {
//       // eslint-disable-next-line no-shadow
//       const packageInfo = { name, version };
//       addPkgDeps({ baseDir: rootDir, rootDir, packageInfo, resultAccumulator });
//       addPkgDeps({ baseDir: packageDirPath, rootDir, packageInfo, resultAccumulator });
//     }
//   });
// };

// export const getAllDependencies = (rootDependencies: PackageInfo[], rootDirContainingModules: string) => {
//   const resultAccumulator: PackageInfo[] = [];
//   rootDependencies.forEach((dep) => {
//     addPkgDeps({
//       baseDir: rootDirContainingModules,
//       rootDir: rootDirContainingModules,
//       resultAccumulator,
//       packageInfo: dep
//     });
//   });
//   const allDependencies = uniqWith(resultAccumulator, (a, b) => a.name === b.name && a.version === b.version);
//   return allDependencies
//     .map((dep) => ({
//       ...dep,
//       absoluteSourceDir: resolve(rootDirContainingModules, 'node_modules', dep.name)
//     }))
//     .filter(({ name }) => !IGNORED_MODULES.includes(name));
// };

// export const copyPackages = async ({
//   distFolderPath,
//   dependenciesToCopy,
//   forceExclude,
//   forceInclude,
//   workingDir
// }: {
//   dependenciesToCopy: {
//     name: string;
//     version: string;
//     absoluteSourceDir: string;
//   }[];
//   distFolderPath: string;
//   forceExclude: string[];
//   forceInclude: string[];
//   workingDir: string;
// }) => {
//   const [forcefullyExcludedFiles, forcefullyIncludedFiles] = await Promise.all([
//     getMatchingFilesByGlob({ globPattern: forceExclude, cwd: workingDir }),
//     getMatchingFilesByGlob({ globPattern: forceInclude, cwd: workingDir })
//   ]);

//   return Promise.all(
//     dependenciesToCopy.map((pkg) => {
//       const from = pkg.absoluteSourceDir;
//       if (forcefullyExcludedFiles.includes(from) && !forcefullyIncludedFiles.includes(from)) {
//         return;
//       }
//       const to = join(distFolderPath, 'node_modules', pkg.name);
//       return copyToDeploymentPackage({ from, to });
//     })
//   );
// };

// const validatePackageJson = ({
//   bundledItemName,
//   dependencies,
//   packageJsonContent
// }: {
//   packageJsonContent: PackageJson;
//   bundledItemName: string;
//   dependencies: string[];
// }) => {
//   const missingDependencies = [];
//   const usedDevDependencies = [];
//   const packageJsonDependencies = Object.keys(packageJsonContent.dependencies);
//   const packageJsonDevDependencies = Object.keys(packageJsonContent.devDependencies);
//   dependencies
//     .filter((dep) => !IGNORED_MISSING_DEPENDENCIES.includes(dep))
//     .forEach((dependency) => {
//       if (!packageJsonDependencies.includes(dependency)) {
//         if (!packageJsonDevDependencies.includes(dependency)) {
//           missingDependencies.push(dependency);
//         } else {
//           usedDevDependencies.push(dependency);
//         }
//       }
//     });
//   if (missingDependencies.length) {
//     raiseError({
//       type: 'PACKAGING',
//       message: `[${bundledItemName}] Can't resolve following dependencies: ${missingDependencies.join(
//         ', '
//       )}. All dependencies must be specified in package.json. Please install them explicitly.`
//     });
//   }
// };

// export const copyNodeModulesFromHost = async ({
//   dependencies,
//   bundledItemName,
//   workingDir,
//   distFolderPath,
//   forceExclude = [],
//   forceInclude = []
// }: {
//   dependencies: string[];
//   workingDir: string;
//   distFolderPath: string;
//   bundledItemName: string;
//   forceExclude?: string[];
//   forceInclude?: string[];
// }) => {
//   const rootPackageJsonPath = join(workingDir, 'package.json');
//   const packageJsonContent = getPackageJson(workingDir);
//   if (!packageJsonContent) {
//     raiseError({ type: 'PACKAGING', message: `Can't access package.json at ${rootPackageJsonPath}.` });
//   }

//   const allInstalledDeps = [];
//   allInstalledDeps.push(
//     ...Object.keys(packageJsonContent.dependencies || {}).concat(Object.keys(packageJsonContent.devDependencies || {}))
//   );
//   const relevantDependencies = dependencies.map((fullDepName) => {
//     const baseDepName = fullDepName.split('/')[0];
//     return allInstalledDeps.includes(fullDepName) ? fullDepName : baseDepName;
//   });

//   validatePackageJson({ packageJsonContent, bundledItemName, dependencies: relevantDependencies });
//   const rootPkgList = [];
//   relevantDependencies.forEach((name) => {
//     const version = packageJsonContent.dependencies[name] || packageJsonContent.devDependencies[name];
//     if (!version.startsWith('file:')) {
//       rootPkgList.push({ name, version });
//     }
//   });

//   const dependenciesToCopy = getAllDependencies(rootPkgList, workingDir);

//   return copyPackages({ dependenciesToCopy, distFolderPath, forceInclude, forceExclude, workingDir });
// };
