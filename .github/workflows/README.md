# GitHub Actions Release Workflow

This document explains how to use the GitHub Actions workflow for automated releases.

## Overview

The release workflow builds binaries on native platforms (Linux, macOS, Windows, Alpine) and publishes releases to GitHub and npm. This ensures binaries are compiled natively rather than cross-compiled.

## Prerequisites

### 1. AWS Secrets Manager Setup

Create secrets in AWS Secrets Manager (eu-west-1 region):
- Secret name: `github-token` - GitHub Personal Access Token with repo and workflow permissions
- Secret name: `npm-token` - NPM access token for publishing

These secrets will be accessed via the Stacktape CLI during the workflow.

### 2. GitHub Repository Secrets

Add the following secret to your GitHub repository:
- `STACKTAPE_API_KEY` - Your Stacktape API key for authenticating with AWS

To add the secret:
1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `STACKTAPE_API_KEY`
5. Value: Your Stacktape API key
6. Click "Add secret"

### 3. Stacktape Authentication

The workflow uses Stacktape CLI to fetch secrets from AWS Secrets Manager. The CLI authenticates using the `STACKTAPE_API_KEY` environment variable and uses the `stacktape secret:get` command to retrieve secrets.

## Usage

### Triggering a Release

Use the `release:gh` script to trigger the workflow:

```bash
# Release with explicit version
bun run release:gh --version 2.23.0

# Auto-increment version
bun run release:gh --minor
bun run release:gh --major
bun run release:gh --patch

# Prerelease
bun run release:gh --patch --prerelease
```

The script will:
1. Trigger the GitHub Actions workflow on the current branch
2. Pass version and prerelease parameters
3. Show a link to monitor the workflow run

### Workflow Steps

The workflow consists of three jobs:

#### 1. Determine Version
- Determines the version to release based on inputs
- Outputs version for other jobs to use

#### 2. Build Binaries (Matrix)
Builds binaries on native platforms:
- **Linux x64**: `ubuntu-latest` with glibc
- **Alpine x64**: `ubuntu-latest` with Docker (musl libc)
- **macOS x64**: `macos-13` (Intel)
- **macOS ARM64**: `macos-14` (Apple Silicon)
- **Windows x64**: `windows-latest`

Each job:
- Builds the native binary for its platform
- Creates an archive (.tar.gz or .zip)
- Uploads the archive as an artifact

#### 3. Release
After all binaries are built:
- Downloads all binary artifacts
- Installs Stacktape CLI
- Fetches GitHub and NPM tokens from AWS Secrets Manager using Stacktape
- Generates starter project metadata (non-prerelease)
- Generates schemas (non-prerelease)
- Builds npm package
- Creates GitHub release with binaries attached
- Publishes to npm
- Publishes install scripts to S3 (requires Stacktape CLI)
- Publishes schemas (non-prerelease, requires Stacktape CLI)
- Updates package.json versions
- Commits and pushes version bump

## Monitoring

View workflow runs at:
https://github.com/stacktape/stacktape/actions/workflows/release.yml

## Environment Variables

The workflow uses these environment variables:
- `STACKTAPE_API_KEY`: (from GitHub secrets) Used to authenticate Stacktape CLI
- `RELEASE_GITHUB_TOKEN`: (fetched via Stacktape) GitHub token for creating releases
- `NPM_TOKEN`: (fetched via Stacktape) NPM token for publishing

## How Secret Fetching Works

The workflow uses Stacktape CLI to securely fetch secrets:

```bash
# Stacktape CLI is installed from the latest release
curl -L https://installs.stacktape.com/linux.sh | sh

# Secrets are fetched using the CLI
# Stacktape outputs the secret as a JavaScript object literal
# We extract the value field using grep and awk
GITHUB_TOKEN=$(stacktape secret:get --region eu-west-1 --secretName github-token | grep "value:" | awk -F"'" '{print $2}')
NPM_TOKEN=$(stacktape secret:get --region eu-west-1 --secretName npm-token | grep "value:" | awk -F"'" '{print $2}')
```

The tokens are masked in logs to prevent exposure.

## Troubleshooting

### Workflow fails to trigger
- Ensure `release.yml` exists on the current branch
- Check GitHub token has `workflow` scope
- Verify the current branch is pushed to remote

### Stacktape authentication fails
- Verify `STACKTAPE_API_KEY` is set correctly in GitHub secrets
- Check the API key has permissions to access AWS Secrets Manager
- Ensure secrets exist in AWS Secrets Manager (eu-west-1)

### Secret fetching fails
- Verify secret names in AWS Secrets Manager: `github-token`, `npm-token`
- Check secrets are in eu-west-1 region
- Ensure Stacktape CLI has proper AWS credentials via API key

### Build fails on specific platform
- Check the build logs for that platform's job
- Platform-specific issues (e.g., missing dependencies) will show there
- You can re-run failed jobs individually from GitHub Actions UI

### NPM publish fails
- Verify npm token in AWS Secrets Manager is valid
- Check token has publish permissions for `stacktape` package
- For prereleases, ensure version follows pattern (alpha|beta|rc).N

### Install scripts publishing fails
- Ensure Stacktape CLI is properly authenticated
- Check AWS permissions for S3 bucket access
- Verify bucket exists and is accessible

## Local Development

To test the build scripts locally:

```bash
# Build binary for current platform
bun run scripts/github-actions/build-platform-binary.ts --platform linux --version 2.23.0-test

# Test version determination
bun run scripts/release/utils/get-version.ts --version 2.23.0-test

# Test Stacktape secret fetching (requires STACKTAPE_API_KEY)
export STACKTAPE_API_KEY=your-api-key
stacktape secret:get --region eu-west-1 --secretName github-token
# To extract just the value:
stacktape secret:get --region eu-west-1 --secretName github-token | grep "value:" | awk -F"'" '{print $2}'
```

## Architecture Notes

- **No validation phase**: The workflow skips linting and type checking to speed up releases. Validation should be done before triggering the release.
- **Native builds**: Each platform builds on its native OS for maximum compatibility.
- **Stacktape integration**: Uses Stacktape CLI for secret management and S3 operations, avoiding direct AWS SDK usage in the workflow.
- **Download-on-install npm**: The npm package downloads binaries on first run rather than bundling platform-specific packages.
