# Shared Folder Testing Todo List

This document tracks the testing progress for all files in the `shared/` folder.

## Status Legend
- [ ] Not started
- [x] Completed

---

## Utils (`shared/utils/`)

- [x] `aws-regions.ts` - AWS regions utilities
- [x] `bin-executable.ts` - Binary executable utilities
- [x] `constants.ts` - Constants definitions
- [x] `dates.ts` - Date utilities
- [ ] `dependency-installer.ts` - Dependency installer utilities
- [ ] `docker.ts` - Docker utilities
- [ ] `dockerfiles.ts` - Dockerfile utilities
- [ ] `download-file.ts` - File download utilities
- [ ] `exec.ts` - Execution utilities
- [ ] `fs-utils.ts` - File system utilities
- [ ] `github-api.ts` - GitHub API utilities
- [x] `hashing.ts` - Hashing utilities
- [x] `id-generation.ts` - ID generation utilities
- [ ] `json-fetch.ts` - JSON fetch utilities
- [x] `json-schema.ts` - JSON schema utilities
- [ ] `misc.ts` - Miscellaneous utilities
- [ ] `pack-exec.ts` - Pack execution utilities
- [ ] `prettier.ts` - Prettier utilities
- [ ] `runtimes.ts` - Runtime utilities
- [x] `roles.ts` - Role utilities
- [ ] `session-manager-exec.ts` - Session manager execution utilities
- [x] `short-hash.ts` - Short hash utilities
- [x] `stacktape-fees.ts` - Stacktape fees utilities
- [x] `streams.ts` - Stream utilities
- [x] `subscription-plans.ts` - Subscription plans utilities
- [ ] `telemetry.ts` - Telemetry utilities
- [ ] `test-utils.ts` - Test utilities
- [ ] `user-prompt.ts` - User prompt utilities
- [x] `validation.ts` - Validation utilities
- [x] `yaml.ts` - YAML utilities
- [ ] `zip.ts` - ZIP utilities

---

## Naming (`shared/naming/`)

- [ ] `arns.ts` - ARN naming utilities
- [ ] `cf-evaluated-links.ts` - CloudFormation evaluated links
- [ ] `cf-registry-types.ts` - CloudFormation registry types
- [ ] `console-links.ts` - Console links utilities
- [ ] `fs-paths.ts` - File system paths
- [ ] `helper-lambdas-resource-names.ts` - Helper lambdas resource names
- [ ] `logical-names.ts` - Logical names
- [ ] `metadata-names.ts` - Metadata names
- [ ] `project-fs-paths.ts` - Project file system paths
- [ ] `resource-names.ts` - Resource names
- [ ] `resource-referencable-params.ts` - Resource referencable parameters
- [ ] `resource-uris.ts` - Resource URIs
- [ ] `ssm-secret-parameters.ts` - SSM secret parameters
- [ ] `stack-output-names.ts` - Stack output names
- [ ] `stacktape-cloudfront-headers.ts` - Stacktape CloudFront headers
- [x] `tag-names.ts` - Tag names
- [x] `utils.ts` - Naming utilities (partial - simple functions)

---

## Packaging (`shared/packaging/`)

### Core Packaging Files
- [ ] `_shared.ts` - Shared packaging utilities
- [ ] `custom-artifact.ts` - Custom artifact packaging
- [ ] `custom-dockerfile.ts` - Custom Dockerfile packaging
- [ ] `external-buildpack.ts` - External buildpack
- [ ] `stacktape-es-image-buildpack.ts` - ES image buildpack
- [ ] `stacktape-es-lambda-buildpack.ts` - ES lambda buildpack
- [ ] `stacktape-go-image-buildpack.ts` - Go image buildpack
- [ ] `stacktape-go-lambda-buildpack.ts` - Go lambda buildpack
- [ ] `stacktape-java-image-buildpack.ts` - Java image buildpack
- [ ] `stacktape-java-lambda-buildpack.ts` - Java lambda buildpack
- [ ] `stacktape-py-image-buildpack.ts` - Python image buildpack
- [ ] `stacktape-py-lambda-buildpack.ts` - Python lambda buildpack

### ES Bundler (`shared/packaging/bundlers/es/`)
- [ ] `config.ts` - ES bundler config
- [ ] `copy-docker-installed-modules.ts` - Copy Docker installed modules
- [ ] `copy-host-modules.ts` - Copy host modules
- [ ] `index.ts` - ES bundler main
- [ ] `utils.ts` - ES bundler utilities
- [ ] `esbuild-decorators/index.ts` - ESBuild decorators
- [ ] `esbuild-decorators/strip-it.ts` - ESBuild decorators strip

### Go Bundler (`shared/packaging/bundlers/go/`)
- [ ] `index.ts` - Go bundler main
- [ ] `utils.ts` - Go bundler utilities

### Java Bundler (`shared/packaging/bundlers/java/`)
- [ ] `index.ts` - Java bundler main
- [ ] `utils.ts` - Java bundler utilities

### Python Bundler (`shared/packaging/bundlers/py/`)
- [ ] `index.ts` - Python bundler main
- [ ] `utils.ts` - Python bundler utilities

---

## AWS (`shared/aws/`)

- [ ] `buckets.ts` - S3 buckets utilities
- [ ] `cloudformation.ts` - CloudFormation utilities
- [ ] `codebuild-deploy.ts` - CodeBuild deploy utilities

### S3 Sync (`shared/aws/s3-sync/`)
- [ ] `index.ts` - S3 sync main
- [ ] `multipart-etag.ts` - Multipart ETag utilities

### SDK Manager (`shared/aws/sdk-manager/`)
- [ ] `index.ts` - SDK manager main
- [ ] `utils.ts` - SDK manager utilities

### Log Collector (`shared/aws/log-collector/`)
- [ ] `index.ts` - Log collector main

---

## TRPC (`shared/trpc/`)

- [ ] `api-key-protected.ts` - API key protected utilities
- [ ] `aws-identity-protected.ts` - AWS identity protected utilities

---

## Summary

- **Total Files**: 79
- **Completed**: 16
- **Remaining**: 63

## Test Statistics
- **Total Tests**: 343
- **Total Assertions**: 712
- **All tests passing** ✅

## Recently Completed (Batch 1 - 11 files)
- `short-hash.ts` - Short hash utilities (17 tests)
- `dates.ts` - Date utilities (30 tests)
- `id-generation.ts` - ID generation utilities (13 tests)
- `constants.ts` - Constants definitions (27 tests)
- `aws-regions.ts` - AWS regions utilities (16 tests)
- `validation.ts` - Validation utilities (21 tests)
- `hashing.ts` - Hashing utilities (18 tests)
- `roles.ts` - Role utilities (11 tests)
- `streams.ts` - Stream utilities (22 tests)
- `naming/tag-names.ts` - Tag names (24 tests)
- `naming/utils.ts` - Naming utilities - partial (38 tests)

## Recently Completed (Batch 2 - 5 files)
- `yaml.ts` - YAML parsing and stringification (19 tests)
- `subscription-plans.ts` - Organization member limits (11 tests)
- `stacktape-fees.ts` - Fee calculation with tiered pricing (30 tests)
- `json-schema.ts` - Schema resolution and type extraction (20 tests)
- `bin-executable.ts` - Platform detection and installation scripts (26 tests)
