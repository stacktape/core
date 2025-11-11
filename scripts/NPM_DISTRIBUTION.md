# NPM Distribution Guide

This document explains how Stacktape is distributed via NPM using platform-specific packages.

## Overview

Stacktape can now be installed via NPM using any package manager (npm, yarn, pnpm, bun). The distribution uses a platform-specific package approach similar to esbuild, which keeps package sizes small while supporting all platforms.

## Architecture

### Main Package: `stacktape`

The main package includes:

- **SDK**: JavaScript SDK for programmatic usage
- **TypeScript types**: Full type definitions for TypeScript config
- **Bin wrapper**: Smart launcher that detects platform and executes the correct binary
- **Optional dependencies**: References to platform-specific packages

### Platform Packages

Six platform-specific packages contain the complete CLI distribution:

- `@stacktape/cli-win32-x64` - Windows x64
- `@stacktape/cli-linux-x64` - Linux x64
- `@stacktape/cli-linux-arm64` - Linux ARM64
- `@stacktape/cli-darwin-x64` - macOS x64
- `@stacktape/cli-darwin-arm64` - macOS ARM64
- `@stacktape/cli-alpine-x64` - Alpine Linux x64

Each platform package contains:

- Stacktape CLI binary
- Bundled tools (pack, nixpacks, esbuild, session-manager-plugin)
- Helper Lambda functions
- Config schema
- Shell completions
- Legal notices

These are listed as `optionalDependencies` in the main package, so package managers only download the one needed for the current platform.

## Installation Methods

Users can install Stacktape in several ways:

### Global Installation

```bash
npm install -g stacktape
stacktape --help
```

### Local Installation

```bash
npm install stacktape
npx stacktape --help
```

### Direct Execution with npx

```bash
npx stacktape <command>
```

### SDK Usage

```typescript
import { Stacktape } from 'stacktape/sdk';

const stp = new Stacktape({ stage: 'dev' });
await stp.deploy();
```

## Build Process

### Building NPM Packages

To build all NPM packages (main + platform packages):

```bash
# Build binaries for all platforms
bun run build:cli:bin --platforms=all

# Build main NPM package
bun run build:npm

# Build platform-specific packages (requires binaries to be built first)
# This is handled automatically by the release script
```

### Release Process

The release script handles the complete release (CLI + NPM):

```bash
bun run release
```

This script:

1. Gets the version number
2. Validates the project
3. Builds CLI binaries for all platforms
4. Creates platform-specific NPM packages
5. Builds the main NPM package
6. Creates GitHub release (backward compatibility)
7. Publishes platform packages to NPM
8. Publishes main package to NPM
9. Updates package.json versions
10. Commits changes

### Available Flags

**Version Control:**

- `--major` - Auto-increment major version (e.g., 1.2.3 -> 2.0.0)
- `--minor` - Auto-increment minor version (e.g., 1.2.3 -> 1.3.0)
- `--patch` - Auto-increment patch version (e.g., 1.2.3 -> 1.2.4)
- _(none)_ - Prompt for version (default: suggests patch increment)

**Build & Publish Control:**

- `--spc` - Skip project checks (validation, branch check)
- `--scr` - Skip creating GitHub release
- `--snp` - Skip NPM publish (useful for testing)

Examples:

```bash
# Prompt for version (interactive)
bun run release

# Auto-increment patch version
bun run release --patch

# Auto-increment minor version
bun run release --minor

# Auto-increment major version
bun run release --major

# Test build without publishing
bun run release --patch --snp --scr
```

## File Structure

```
stacktape/
├── src/api/npm/
│   ├── bin/
│   │   └── stacktape.js          # Bin wrapper script
│   ├── package.json               # Main package.json (with bin + optionalDependencies)
│   ├── sdk/                       # SDK source code
│   └── ts/                        # TypeScript config source code
├── scripts/
│   ├── platform-package-template/ # Template for platform packages
│   │   ├── package.json
│   │   └── README.md
│   ├── build-npm.ts               # Builds main NPM package
│   ├── build-cli-binaries.ts      # Builds CLI binaries
│   ├── build-cli-platform-packages.ts  # Builds platform NPM packages
│   └── release.ts                 # Unified release script (CLI + NPM)
├── __release-npm/                 # Built main NPM package (gitignored)
├── __platform-packages/           # Built platform packages (gitignored)
└── __binary-dist/                 # Built binaries (gitignored)
```

## How the Bin Wrapper Works

The bin wrapper ([src/api/npm/bin/stacktape.js](src/api/npm/bin/stacktape.js)) is a Node.js script that:

1. **Detects the current platform** using `os.platform()` and `os.arch()`
2. **Finds the appropriate binary** by looking for the platform-specific package in:
   - `node_modules/@stacktape/cli-<platform>/bin/stacktape`
   - Several alternative paths (for npx, monorepos, etc.)
3. **Executes the binary** using `spawnSync`, passing through all arguments
4. **Provides helpful error messages** if the binary can't be found

### Alpine Linux Detection

The wrapper specifically detects Alpine Linux (which uses musl instead of glibc) by checking the output of `ldd --version`.

## Backward Compatibility

The install scripts (linux.sh, windows.ps1, etc.) continue to work and download binaries from GitHub releases. This ensures existing users and documentation remain functional.

## Benefits of This Approach

1. **Small package size**: Users only download the binary for their platform (~30-50MB vs ~300MB for all platforms)
2. **Works with all package managers**: npm, yarn, pnpm, bun all handle optionalDependencies correctly
3. **Offline support**: Once installed, works offline (unlike postinstall download approaches)
4. **Industry standard**: Used by esbuild, swc, and other popular tools
5. **Unified distribution**: CLI and SDK in one package
6. **Version synchronization**: All platform packages automatically match the main package version

## Testing

To test the new distribution locally:

### 1. Build Everything

```bash
bun run build:cli:bin --platforms=current
bun run release --snp --scr
```

### 2. Test Global Installation

```bash
cd __release-npm
npm link
stacktape --help
```

### 3. Test Local Installation

```bash
cd /path/to/test/project
npm install /path/to/stacktape/__release-npm
npx stacktape --help
```

### 4. Test SDK

```javascript
// test.js
const { Stacktape } = require('./path/to/__release-npm/dist/sdk.js');

console.info(Stacktape);
```

## Troubleshooting

### Binary Not Found Error

If users see "Could not find Stacktape binary" error:

1. Check that the platform is supported
2. Try reinstalling: `npm uninstall -g stacktape && npm install -g stacktape`
3. Check for npm/yarn/pnpm installation issues

### Version Mismatch

If platform package versions don't match the main package:

1. The build process automatically syncs versions
2. Check [src/api/npm/package.json](src/api/npm/package.json) - versions should use `2.22.2` format (not `^2.22.2`)

### Platform Package Not Publishing

If a platform package fails to publish:

1. Check that you're logged into npm: `npm whoami`
2. Verify you have publish permissions for `@stacktape/*`
3. Check if the version already exists: `npm view @stacktape/cli-linux-x64 versions`

## Migration Notes

### For Developers

- Old release scripts have been removed
- Use `bun run release` for all releases (CLI + NPM)
- The main package now includes both SDK and CLI functionality

### For Users

- Existing install scripts continue to work
- NPM installation is now the recommended method
- Both global and local installation are supported
