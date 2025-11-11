import { join } from 'node:path';
import { logInfo, logSuccess } from '@shared/utils/logging';
import { extractTgzArchive } from '@shared/utils/zip';
import AdmZip from 'adm-zip';
import { chmod, copy, mkdir, pathExists, readFile, remove, writeFile } from 'fs-extra';
import { getPlatformsToBuildFor } from './build-cli-sources';

type SupportedPlatform = 'win' | 'linux' | 'macos' | 'macos-arm' | 'alpine' | 'linux-arm';

const PLATFORM_METADATA: Record<
  SupportedPlatform,
  {
    packageSuffix: string;
    os: string[];
    cpu: string[];
    displayName: string;
    binaryName: string;
    folderName: string;
  }
> = {
  win: {
    packageSuffix: 'win32-x64',
    os: ['win32'],
    cpu: ['x64'],
    displayName: 'Windows x64',
    binaryName: 'stacktape.exe',
    folderName: 'windows'
  },
  linux: {
    packageSuffix: 'linux-x64',
    os: ['linux'],
    cpu: ['x64'],
    displayName: 'Linux x64',
    binaryName: 'stacktape',
    folderName: 'linux'
  },
  'linux-arm': {
    packageSuffix: 'linux-arm64',
    os: ['linux'],
    cpu: ['arm64'],
    displayName: 'Linux ARM64',
    binaryName: 'stacktape',
    folderName: 'linux-arm'
  },
  macos: {
    packageSuffix: 'darwin-x64',
    os: ['darwin'],
    cpu: ['x64'],
    displayName: 'macOS x64',
    binaryName: 'stacktape',
    folderName: 'macos'
  },
  'macos-arm': {
    packageSuffix: 'darwin-arm64',
    os: ['darwin'],
    cpu: ['arm64'],
    displayName: 'macOS ARM64',
    binaryName: 'stacktape',
    folderName: 'macos-arm'
  },
  alpine: {
    packageSuffix: 'alpine-x64',
    os: ['linux'],
    cpu: ['x64'],
    displayName: 'Alpine Linux x64',
    binaryName: 'stacktape',
    folderName: 'alpine'
  }
};

const TEMPLATE_DIR = join(process.cwd(), 'scripts', 'platform-package-template');

const generatePlatformPackageJson = async ({
  platform,
  version,
  templatePath
}: {
  platform: SupportedPlatform;
  version: string;
  templatePath: string;
}): Promise<string> => {
  const metadata = PLATFORM_METADATA[platform];
  const template = await readFile(templatePath, 'utf-8');

  const packageJson = template
    .replace(/<<PLATFORM>>/g, metadata.packageSuffix)
    .replace(/<<VERSION>>/g, version)
    .replace(/<<PLATFORM_DISPLAY>>/g, metadata.displayName)
    .replace(/<<OS>>/g, metadata.os[0])
    .replace(/<<CPU>>/g, metadata.cpu[0]);

  return packageJson;
};

const generatePlatformReadme = async ({
  platform,
  templatePath
}: {
  platform: SupportedPlatform;
  templatePath: string;
}): Promise<string> => {
  const metadata = PLATFORM_METADATA[platform];
  const template = await readFile(templatePath, 'utf-8');

  const readme = template
    .replace(/<<PLATFORM>>/g, metadata.packageSuffix)
    .replace(/<<PLATFORM_DISPLAY>>/g, metadata.displayName);

  return readme;
};

const extractPlatformArchive = async ({
  platform,
  binariesDistPath,
  tempExtractPath
}: {
  platform: SupportedPlatform;
  binariesDistPath: string;
  tempExtractPath: string;
}): Promise<string> => {
  const metadata = PLATFORM_METADATA[platform];
  const archiveExt = platform === 'win' ? 'zip' : 'tar.gz';
  const archivePath = join(binariesDistPath, `${metadata.folderName}.${archiveExt}`);

  if (!(await pathExists(archivePath))) {
    throw new Error(`Archive not found at ${archivePath}`);
  }

  let extractedDir: string;

  if (platform === 'win') {
    // Extract ZIP
    extractedDir = join(tempExtractPath, metadata.folderName);
    await mkdir(extractedDir, { recursive: true });
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(extractedDir, true);
  } else {
    // Extract tar.gz - this returns the extracted folder path
    extractedDir = await extractTgzArchive({
      sourcePath: archivePath,
      distDirPath: tempExtractPath
    });
  }

  // Verify the main binary exists in the extracted archive
  const binaryPath = join(extractedDir, metadata.binaryName);
  if (!(await pathExists(binaryPath))) {
    throw new Error(`Binary not found after extraction at ${binaryPath}`);
  }

  // Return the extracted directory (contains all assets)
  return extractedDir;
};

export const buildPlatformPackage = async ({
  platform,
  version,
  binariesDistPath,
  platformPackagesDistPath,
  tempExtractPath,
  unarchivedSourcePath
}: {
  platform: SupportedPlatform;
  version: string;
  binariesDistPath: string;
  platformPackagesDistPath: string;
  tempExtractPath: string;
  unarchivedSourcePath?: string;
}): Promise<void> => {
  const metadata = PLATFORM_METADATA[platform];
  const packageName = `@stacktape/cli-${metadata.packageSuffix}`;

  logInfo(`Building platform package: ${packageName}`);

  // Create package directory
  const packageDir = join(platformPackagesDistPath, packageName.replace('@stacktape/', ''));
  await remove(packageDir);
  await mkdir(packageDir, { recursive: true });

  // Generate package.json
  const packageJson = await generatePlatformPackageJson({
    platform,
    version,
    templatePath: join(TEMPLATE_DIR, 'package.json')
  });
  await writeFile(join(packageDir, 'package.json'), packageJson, 'utf-8');

  // Generate README
  const readme = await generatePlatformReadme({
    platform,
    templatePath: join(TEMPLATE_DIR, 'README.md')
  });
  await writeFile(join(packageDir, 'README.md'), readme, 'utf-8');

  let sourceDir: string;
  if (unarchivedSourcePath) {
    sourceDir = unarchivedSourcePath;
  } else {
    // Extract archive to get all contents (binary + tools + helper-lambdas + etc.)
    sourceDir = await extractPlatformArchive({
      platform,
      binariesDistPath,
      tempExtractPath
    });
  }

  // Copy all contents from the source directory to the bin directory
  // This includes: stacktape binary, pack, nixpacks, session-manager-plugin, esbuild,
  // helper-lambdas, config schema, completions, legal files, etc.
  const binDir = join(packageDir, 'bin');
  await copy(sourceDir, binDir);

  // Ensure the binary has executable permissions on non-Windows platforms
  if (platform !== 'win') {
    const binaryPath = join(binDir, metadata.binaryName);
    await chmod(binaryPath, '755');
  }

  logSuccess(`Platform package ${packageName} built successfully at ${packageDir}`);
};

export const buildPlatformSpecificNpmPackages = async ({
  version,
  binariesDistPath,
  platformPackagesDistPath,
  platforms,
  platformPaths
}: {
  version: string;
  binariesDistPath: string;
  platformPackagesDistPath: string;
  platforms?: SupportedPlatform[];
  platformPaths?: Record<SupportedPlatform, string>;
}): Promise<void> => {
  const platformsToBuild = platforms || getPlatformsToBuildFor({ presetPlatforms: platforms });
  logInfo(`Building platform-specific NPM packages for platforms: ${platformsToBuild.join(', ')}`);

  const tempExtractPath = join(platformPackagesDistPath, '__temp-extract');
  await mkdir(tempExtractPath, { recursive: true });

  try {
    await Promise.all(
      platformsToBuild.map((platform) =>
        buildPlatformPackage({
          platform,
          version,
          binariesDistPath,
          platformPackagesDistPath,
          tempExtractPath,
          unarchivedSourcePath: platformPaths?.[platform]
        })
      )
    );

    logSuccess(`All platform packages built successfully at ${platformPackagesDistPath}`);
  } finally {
    // Cleanup temp directory
    await remove(tempExtractPath);
  }
};
