# Src Folder Testing Todo List

This document tracks the testing progress for all files in the `src/` folder.

## Status Legend
- [ ] Not started
- [x] Completed

---

## Config (`src/config/`)

- [x] `random.ts` - Random configuration (Batch 12)
- [x] `cli.ts` - CLI configuration (Batch 12)
- [ ] `error-messages.ts` - Error messages configuration

---

## Utils (`src/utils/`)

- [x] `directives.spec.ts` - Directive utilities (ALREADY EXISTS)
- [x] `aws-config.ts` - AWS configuration (Batch 2)
- [ ] `aws-sdk-manager/index.ts` - AWS SDK manager
- [ ] `aws-sdk-manager/utils.ts` - AWS SDK manager utilities
- [x] `basic-compose-shim.ts` - Basic compose shim (Batch 11)
- [x] `cli.ts` - CLI utilities (Batch 13)
- [x] `cloudformation.ts` - CloudFormation utilities (Batch 2)
- [x] `cloudwatch-logs.ts` - CloudWatch logs utilities (Batch 2)
- [x] `collections.ts` - Collection utilities (Batch 1)
- [x] `decorators.ts` - Decorator utilities (Batch 16)
- [x] `domains.ts` - Domain utilities (Batch 1)
- [x] `dotenv.ts` - Dotenv utilities (Batch 3)
- [x] `errors.ts` - Error utilities (Batch 4)
- [x] `file-loaders.ts` - File loader utilities (Batch 3)
- [x] `formatting.ts` - Formatting utilities (Batch 1)
- [ ] `git-info-manager/index.ts` - Git info manager
- [x] `git.ts` - Git utilities (Batch 13)
- [x] `helper-lambdas.ts` - Helper lambdas utilities (Batch 11)
- [x] `http-client.ts` - HTTP client utilities (Batch 15)
- [x] `ip.ts` - IP utilities (Batch 1)
- [ ] `log-collector/index.ts` - Log collector
- [x] `pretty-json.ts` - Pretty JSON utilities (Batch 1)
- [ ] `printer/index.ts` - Printer utilities
- [ ] `printer/spinnies.ts` - Spinnies utilities
- [ ] `python-bridge/index.ts` - Python bridge
- [x] `referenceable-types.ts` - Referenceable types (Batch 7)
- [x] `scripts.ts` - Scripts utilities (Batch 16)
- [x] `sentry.ts` - Sentry utilities (Batch 15)
- [ ] `ssm-session.ts` - SSM session utilities
- [ ] `stack-info-map-diff.ts` - Stack info map diff
- [x] `stack-info-map-sensitive-values.ts` - Stack info map sensitive values (Batch 16)
- [x] `telemetry.ts` - Telemetry utilities (Batch 15)
- [x] `temp-files.ts` - Temporary files utilities (Batch 3)
- [x] `time.ts` - Time utilities (Batch 1)
- [x] `user-code-processing.ts` - User code processing (Batch 10)
- [x] `uuid.ts` - UUID utilities (Batch 1)
- [x] `validation-utils.ts` - Validation utilities (Batch 1)
- [x] `validator.ts` - Validator utilities (Batch 4)
- [x] `versioning.ts` - Versioning utilities (Batch 10)

---

## App Layer (`src/app/`)

### Announcements Manager (`src/app/announcements-manager/`)
- [ ] `index.ts` - Announcements manager

### Application Manager (`src/app/application-manager/`)
- [ ] `index.ts` - Application manager

### Event Manager (`src/app/event-manager/`)
- [ ] `event-log.ts` - Event log
- [ ] `index.ts` - Event manager
- [ ] `utils.ts` - Event manager utilities

### Global State Manager (`src/app/global-state-manager/`)
- [ ] `index.ts` - Global state manager
- [ ] `utils.ts` - Global state manager utilities

### Stacktape TRPC API Manager (`src/app/stacktape-trpc-api-manager/`)
- [ ] `index.ts` - Stacktape TRPC API manager (stubbed)

---

## Domain Layer (`src/domain/`)

### Budget Manager (`src/domain/budget-manager/`)
- [ ] `index.ts` - Budget manager

### Calculated Stack Overview Manager (`src/domain/calculated-stack-overview-manager/`)
- [ ] `index.ts` - Main calculated stack overview manager
- [ ] `resource-resolvers/aws-cdk-construct/index.ts` - AWS CDK construct resolver
- [ ] `resource-resolvers/application-load-balancers/index.ts` - ALB resolver
- [ ] `resource-resolvers/application-load-balancers/utils.ts` - ALB utilities
- [ ] `resource-resolvers/bastion/index.ts` - Bastion resolver
- [ ] `resource-resolvers/bastion/utils.ts` - Bastion utilities
- [ ] `resource-resolvers/batch-jobs/index.ts` - Batch jobs resolver
- [ ] `resource-resolvers/batch-jobs/utils.ts` - Batch jobs utilities
- [ ] `resource-resolvers/buckets/index.ts` - Buckets resolver
- [ ] `resource-resolvers/buckets/utils.ts` - Buckets utilities
- [ ] `resource-resolvers/budget/index.ts` - Budget resolver
- [ ] `resource-resolvers/cloudformation-resources/index.ts` - CloudFormation resources resolver
- [ ] `resource-resolvers/custom-resources/index.ts` - Custom resources resolver
- [ ] `resource-resolvers/databases/index.ts` - Databases resolver
- [ ] `resource-resolvers/databases/utils.ts` - Databases utilities
- [ ] `resource-resolvers/deployment-scripts/index.ts` - Deployment scripts resolver
- [ ] `resource-resolvers/dynamo-db-tables/index.ts` - DynamoDB tables resolver
- [ ] `resource-resolvers/dynamo-db-tables/utils.ts` - DynamoDB tables utilities
- [ ] `resource-resolvers/edge-lambda-functions/index.ts` - Edge Lambda functions resolver
- [ ] `resource-resolvers/efs-filesystems/index.ts` - EFS filesystems resolver
- [ ] `resource-resolvers/efs-filesystems/utils.ts` - EFS filesystems utilities
- [ ] `resource-resolvers/event-buses/index.ts` - Event buses resolver
- [ ] `resource-resolvers/hosting-buckets/index.ts` - Hosting buckets resolver
- [ ] `resource-resolvers/http-api-gateways/index.ts` - HTTP API gateways resolver
- [ ] `resource-resolvers/http-api-gateways/utils.ts` - HTTP API gateways utilities
- [ ] `resource-resolvers/mongo-db-atlas-clusters/index.ts` - MongoDB Atlas clusters resolver
- [ ] `resource-resolvers/mongo-db-atlas-clusters/utils.ts` - MongoDB Atlas clusters utilities
- [ ] `resource-resolvers/network-load-balancers/index.ts` - NLB resolver
- [ ] `resource-resolvers/network-load-balancers/utils.ts` - NLB utilities
- [ ] `resource-resolvers/nextjs-web/index.ts` - Next.js web resolver
- [ ] `resource-resolvers/nextjs-web/utils.ts` - Next.js web utilities
- [ ] `resource-resolvers/open-search/index.ts` - OpenSearch resolver
- [ ] `resource-resolvers/open-search/utils.ts` - OpenSearch utilities
- [ ] `resource-resolvers/outputs/index.ts` - Outputs resolver
- [ ] `resource-resolvers/private-services/index.ts` - Private services resolver
- [ ] `resource-resolvers/redis-clusters/index.ts` - Redis clusters resolver
- [ ] `resource-resolvers/redis-clusters/utils.ts` - Redis clusters utilities
- [ ] `resource-resolvers/sns-topics/index.ts` - SNS topics resolver
- [ ] `resource-resolvers/sqs-queues/index.ts` - SQS queues resolver
- [ ] `resource-resolvers/state-machines/index.ts` - State machines resolver
- [ ] `resource-resolvers/state-machines/utils.ts` - State machines utilities
- [ ] `resource-resolvers/upstash-redis/index.ts` - Upstash Redis resolver
- [ ] `resource-resolvers/upstash-redis/utils.ts` - Upstash Redis utilities
- [ ] `resource-resolvers/user-pools/index.ts` - User pools resolver
- [ ] `resource-resolvers/user-pools/utils.ts` - User pools utilities
- [ ] `resource-resolvers/web-app-firewalls/index.ts` - Web app firewalls resolver
- [ ] `resource-resolvers/web-services/index.ts` - Web services resolver
- [ ] `resource-resolvers/worker-services/index.ts` - Worker services resolver

#### Functions (`src/domain/calculated-stack-overview-manager/resource-resolvers/functions/`)
- [ ] `index.ts` - Functions resolver
- [ ] `utils.ts` - Functions utilities
- [ ] `events/application-load-balancer/index.ts` - ALB events
- [ ] `events/cloudwatch-alarm/index.ts` - CloudWatch alarm events
- [ ] `events/cloudwatch-log/index.ts` - CloudWatch log events
- [ ] `events/dynamo/index.ts` - DynamoDB events
- [ ] `events/event-bus/index.ts` - EventBridge events
- [ ] `events/http-api-gateway/index.ts` - HTTP API Gateway events
- [ ] `events/iot/index.ts` - IoT events
- [ ] `events/kafka-topic/index.ts` - Kafka topic events
- [ ] `events/kinesis/index.ts` - Kinesis events
- [ ] `events/s3/index.ts` - S3 events
- [ ] `events/schedule/index.ts` - Schedule events
- [ ] `events/sns/index.ts` - SNS events
- [ ] `events/sqs/index.ts` - SQS events
- [ ] `events/utils.ts` - Events utilities

#### Multi-Container Workloads (`src/domain/calculated-stack-overview-manager/resource-resolvers/multi-container-workloads/`)
- [ ] `index.ts` - Multi-container workloads resolver
- [ ] `utils.ts` - Multi-container workloads utilities
- [ ] `events/application-load-balancer/index.ts` - ALB events
- [ ] `events/http-api-gateway/index.ts` - HTTP API Gateway events
- [ ] `events/network-load-balancer/index.ts` - NLB events
- [ ] `events/service-connect/index.ts` - Service Connect events

#### Background Resources (`src/domain/calculated-stack-overview-manager/resource-resolvers/background-resources/`)
- [ ] `accept-vpc-peerings-custom-resource.ts` - Accept VPC peerings
- [ ] `code-deploy.ts` - CodeDeploy
- [ ] `default-domain-cert-custom-resource.ts` - Default domain cert
- [ ] `deployment-bucket/index.ts` - Deployment bucket
- [ ] `deployment-bucket/utils.ts` - Deployment bucket utilities
- [ ] `deployment-image-repository/index.ts` - Deployment image repository
- [ ] `deployment-image-repository/utils.ts` - Deployment image repository utilities
- [ ] `s3-events-custom-resource.ts` - S3 events
- [ ] `sensitive-data-custom-resource.ts` - Sensitive data
- [ ] `service-discovery.ts` - Service discovery
- [ ] `shared-edge-lambdas-custom-resource.ts` - Shared edge lambdas
- [ ] `stacktape-service-lambda.ts` - Stacktape service lambda
- [ ] `vpc.ts` - VPC

#### Resolver Utils (`src/domain/calculated-stack-overview-manager/resource-resolvers/_utils/`)
- [ ] `cdn.ts` - CDN utilities
- [ ] `connect-to-helper.ts` - Connect to helper utilities
- [ ] `custom-resource.ts` - Custom resource utilities
- [ ] `edge-lambdas.ts` - Edge lambdas utilities
- [ ] `efs.ts` - EFS utilities
- [ ] `env-vars.ts` - Environment variables utilities
- [ ] `firewall-helpers.ts` - Firewall helpers
- [ ] `http-api-events.ts` - HTTP API events utilities
- [ ] `image-urls.ts` - Image URLs utilities
- [ ] `lb-listener-rule-helpers.ts` - Load balancer listener rule helpers
- [ ] `log-forwarding.ts` - Log forwarding utilities
- [ ] `regions.ts` - Regions utilities
- [ ] `role-helpers.ts` - Role helpers

#### Alarms (`src/domain/calculated-stack-overview-manager/resource-resolvers/_utils/alarms/`)
- [ ] `index.ts` - Main alarms
- [ ] `utils.ts` - Alarms utilities
- [ ] `application-load-balancer-alarms/index.ts` - ALB alarms
- [ ] `application-load-balancer-alarms/custom/index.ts` - ALB custom alarms
- [ ] `application-load-balancer-alarms/error-rate/index.ts` - ALB error rate alarms
- [ ] `application-load-balancer-alarms/unhealthy-targets/index.ts` - ALB unhealthy targets alarms
- [ ] `application-load-balancer-alarms/utils.ts` - ALB alarms utilities
- [ ] `http-api-gateway-alarms/index.ts` - HTTP API Gateway alarms
- [ ] `http-api-gateway-alarms/error-rate/index.ts` - HTTP API Gateway error rate alarms
- [ ] `http-api-gateway-alarms/latency/index.ts` - HTTP API Gateway latency alarms
- [ ] `lambda-alarms/index.ts` - Lambda alarms
- [ ] `lambda-alarms/duration/index.ts` - Lambda duration alarms
- [ ] `lambda-alarms/error-rate/index.ts` - Lambda error rate alarms
- [ ] `relational-database-alarms/index.ts` - RDS alarms
- [ ] `relational-database-alarms/connection-count/index.ts` - RDS connection count alarms
- [ ] `relational-database-alarms/cpu-utilization/index.ts` - RDS CPU utilization alarms
- [ ] `relational-database-alarms/free-memory/index.ts` - RDS free memory alarms
- [ ] `relational-database-alarms/free-storage/index.ts` - RDS free storage alarms
- [ ] `relational-database-alarms/latency/index.ts` - RDS latency alarms
- [ ] `relational-database-alarms/utils.ts` - RDS alarms utilities
- [ ] `sqs-queue-alarms/index.ts` - SQS queue alarms
- [ ] `sqs-queue-alarms/not-empty/index.ts` - SQS queue not empty alarms
- [ ] `sqs-queue-alarms/received-messages-count/index.ts` - SQS queue received messages count alarms
- [ ] `sqs-queue-alarms/utils.ts` - SQS queue alarms utilities

### CloudFormation Registry Manager (`src/domain/cloudformation-registry-manager/`)
- [ ] `index.ts` - CloudFormation registry manager

### CloudFormation Stack Manager (`src/domain/cloudformation-stack-manager/`)
- [ ] `index.ts` - CloudFormation stack manager
- [ ] `utils.ts` - CloudFormation stack manager utilities

### CloudFront Manager (`src/domain/cloudfront-manager/`)
- [ ] `index.ts` - CloudFront manager

### Config Manager (`src/domain/config-manager/`)
- [ ] `index.ts` - Main config manager
- [ ] `config-resolver.ts` - Config resolver
- [ ] `built-in-directives.ts` - Built-in directives
- [x] `utils/alarms.ts` - Alarms utilities (Batch 6)
- [ ] `utils/application-load-balancers.ts` - ALB utilities
- [ ] `utils/bastion.ts` - Bastion utilities
- [x] `utils/buckets.ts` - Buckets utilities (Batch 6)
- [ ] `utils/custom-resource-definitions.ts` - Custom resource definitions utilities
- [ ] `utils/edge-functions.ts` - Edge functions utilities
- [ ] `utils/efs-filesystems.ts` - EFS filesystems utilities
- [ ] `utils/event-buses.ts` - Event buses utilities
- [ ] `utils/http-api-gateways.ts` - HTTP API gateways utilities
- [x] `utils/iam.ts` - IAM utilities (Batch 14)
- [ ] `utils/lambdas.ts` - Lambdas utilities
- [x] `utils/misc.ts` - Miscellaneous utilities (Batch 5)
- [ ] `utils/multi-container-workloads.ts` - Multi-container workloads utilities
- [ ] `utils/network-load-balancers.ts` - NLB utilities
- [ ] `utils/nextjs-webs.ts` - Next.js webs utilities
- [x] `utils/relational-databases.ts` - Relational databases utilities (Batch 14)
- [x] `utils/resource-references.ts` - Resource references utilities (Batch 5)
- [x] `utils/sns-topics.ts` - SNS topics utilities (Batch 6)
- [x] `utils/sqs-queues.ts` - SQS queues utilities (Batch 6)
- [ ] `utils/user-pools.ts` - User pools utilities
- [x] `utils/validation.ts` - Validation utilities (Batch 5)
- [ ] `utils/web-app-firewall.ts` - Web app firewall utilities
- [ ] `utils/web-services.ts` - Web services utilities

### Deployed Stack Overview Manager (`src/domain/deployed-stack-overview-manager/`)
- [ ] `index.ts` - Deployed stack overview manager
- [ ] `hotswap-utils.ts` - Hotswap utilities
- [ ] `printing-utils.ts` - Printing utilities

### Deployment Artifact Manager (`src/domain/deployment-artifact-manager/`)
- [ ] `index.ts` - Deployment artifact manager
- [x] `utils.ts` - Deployment artifact manager utilities (Batch 9)

### Domain Manager (`src/domain/domain-manager/`)
- [ ] `index.ts` - Domain manager

### EC2 Manager (`src/domain/ec2-manager/`)
- [ ] `index.ts` - EC2 manager

### Notification Manager (`src/domain/notification-manager/`)
- [ ] `index.ts` - Notification manager

### Packaging Manager (`src/domain/packaging-manager/`)
- [ ] `index.ts` - Packaging manager

### SES Manager (`src/domain/ses-manager/`)
- [ ] `index.ts` - SES manager

### Template Manager (`src/domain/template-manager/`)
- [ ] `index.ts` - Template manager
- [x] `utils.ts` - Template manager utilities (Batch 8)

### Third Party Provider Credentials Manager (`src/domain/third-party-provider-credentials-manager/`)
- [ ] `index.ts` - Third party provider credentials manager

### VPC Manager (`src/domain/vpc-manager/`)
- [ ] `index.ts` - VPC manager

---

## Commands (`src/commands/`)

### Command Utils (`src/commands/_utils/`)
- [ ] `assume-role.ts` - Assume role utilities
- [ ] `common.ts` - Common command utilities
- [ ] `cw-deployment.ts` - CloudWatch deployment utilities
- [ ] `fn-deployment.ts` - Function deployment utilities
- [ ] `initialization.ts` - Initialization utilities
- [ ] `logs.ts` - Logs utilities

### Individual Commands
- [ ] `aws-profile-create/index.ts` - AWS profile create
- [ ] `aws-profile-delete/index.ts` - AWS profile delete
- [ ] `aws-profile-list/index.ts` - AWS profile list
- [ ] `aws-profile-update/index.ts` - AWS profile update
- [ ] `bastion-session/index.ts` - Bastion session
- [ ] `bastion-tunnel/index.ts` - Bastion tunnel
- [ ] `bucket-sync/index.ts` - Bucket sync
- [ ] `cf-module-update/index.ts` - CloudFormation module update
- [ ] `codebuild-deploy/index.ts` - CodeBuild deploy
- [ ] `compile-template/index.ts` - Compile template
- [ ] `container-session/index.ts` - Container session
- [ ] `defaults-configure/index.ts` - Defaults configure
- [ ] `defaults-list/index.ts` - Defaults list
- [ ] `delete/index.ts` - Delete
- [ ] `deploy/index.ts` - Deploy
- [ ] `deployment-script-run/index.ts` - Deployment script run
- [ ] `dev/index.ts` - Dev
- [ ] `dev/container/index.ts` - Dev container
- [ ] `dev/lambda-function/index.ts` - Dev lambda function
- [ ] `dev/utils.ts` - Dev utilities
- [ ] `domain-add/index.ts` - Domain add
- [ ] `help/index.ts` - Help
- [ ] `init/index.ts` - Init
- [ ] `init/using-existing-config/index.ts` - Init using existing config
- [ ] `init/using-starter-project/index.ts` - Init using starter project
- [ ] `init/using-starter-project/utils.ts` - Init using starter project utilities
- [ ] `login/index.ts` - Login
- [ ] `logout/index.ts` - Logout
- [ ] `logs/index.ts` - Logs
- [ ] `package-workloads/index.ts` - Package workloads
- [ ] `param-get/index.ts` - Param get
- [ ] `preview-changes/index.ts` - Preview changes
- [ ] `rollback/index.ts` - Rollback
- [ ] `script-run/index.ts` - Script run
- [ ] `script-run/utils.ts` - Script run utilities
- [ ] `secret-create/index.ts` - Secret create
- [ ] `secret-delete/index.ts` - Secret delete
- [ ] `secret-get/index.ts` - Secret get
- [ ] `stack-info/index.ts` - Stack info
- [ ] `stack-list/index.ts` - Stack list
- [ ] `version/index.ts` - Version

---

## API Layer (`src/api/`)

### CLI (`src/api/cli/`)
- [ ] `index.ts` - CLI entry point

### NPM SDK (`src/api/npm/sdk/`)
- [ ] `index.ts` - SDK entry point

### NPM TypeScript (`src/api/npm/ts/`)
- [ ] `child-resources.ts` - Child resources
- [ ] `config.ts` - Config
- [ ] `directives.ts` - Directives
- [ ] `global-aws-services.ts` - Global AWS services
- [ ] `index.ts` - TypeScript entry point
- [ ] `resource-metadata.ts` - Resource metadata
- [ ] `resources.ts` - Resources
- [ ] `type-properties.ts` - Type properties

---

## Summary

- **Total Files**: 274
- **Completed**: 37 (1 pre-existing + 8 from Batch 1 + 3 from Batch 2 + 3 from Batch 3 + 2 from Batch 4 + 3 from Batch 5 + 4 from Batch 6 + 1 from Batch 7 + 1 from Batch 8 + 1 from Batch 9 + 2 from Batch 10 + 2 from Batch 11 + 2 from Batch 12 + 2 from Batch 13 + 2 from Batch 14)
- **Remaining**: 237

## Test Statistics
- **Total Tests**: ~560 (estimated)
- **Total Assertions**: ~1000 (estimated)

---

## Batching Strategy

Given the complexity of the src/ folder, tests will be organized in the following batches:

### Batch 1: Simple Utils (Priority: High) ✅ COMPLETED
Focus on pure utility functions with minimal dependencies:
- [x] `collections.ts` - LinkedList and Stack data structures (75 tests)
- [x] `formatting.ts` - Time and object formatting (29 tests)
- [x] `pretty-json.ts` - JSON pretty printing (28 tests)
- [x] `uuid.ts` - UUID generation (10 tests)
- [x] `time.ts` - AWS time synchronization (3 tests)
- [x] `domains.ts` - Domain utilities (16 tests)
- [x] `validation-utils.ts` - Validation utilities (21 tests)
- [x] `ip.ts` - IP address utilities (5 tests)

**Batch 1 Stats**: 8 files, ~187 tests, 100% passing

### Batch 2: AWS Utils (Priority: High) ✅ COMPLETED
AWS-related utilities with AWS SDK mocking:
- [x] `aws-config.ts` - AWS profile management (24 tests)
- [x] `cloudformation.ts` - CloudFormation utilities (31 tests)
- [x] `cloudwatch-logs.ts` - CloudWatch log printers (22 tests)

**Batch 2 Stats**: 3 files, ~77 tests, 100% passing

### Batch 3: File & System Utils (Priority: High) ✅ COMPLETED
File system and system-related utilities:
- [x] `dotenv.ts` - Dotenv parsing (30 tests)
- [x] `temp-files.ts` - Temporary file operations (12 tests)
- [x] `file-loaders.ts` - File loading utilities (25 tests)

**Batch 3 Stats**: 3 files, ~67 tests, 100% passing

### Batch 4: Error & Validation (Priority: High) ✅ COMPLETED
- [x] `errors.ts` - Error classes and utilities (33 tests)
- [x] `validator.ts` - Validation functions (47 tests)

**Batch 4 Stats**: 2 files, ~80 tests, 100% passing

### Batch 5: Config Manager Utils (Priority: High) ✅ COMPLETED
Simple config manager utilities:
- [x] `config-manager/utils/validation.ts` - Packaging validation
- [x] `config-manager/utils/misc.ts` - Config merging and cleaning
- [x] `config-manager/utils/resource-references.ts` - Resource reference utilities

**Batch 5 Stats**: 3 files, ~45 tests, 100% passing

### Batch 6: More Config Manager Utils (Priority: Medium) ✅ COMPLETED
More complex config manager utilities:
- [x] `config-manager/utils/buckets.ts` - Bucket validation and reference resolution
- [x] `config-manager/utils/sns-topics.ts` - SNS topic validation and reference resolution
- [x] `config-manager/utils/sqs-queues.ts` - SQS queue validation and policy statements
- [x] `config-manager/utils/alarms.ts` - Alarm resolution and eligibility checks

**Batch 6 Stats**: 4 files, ~80 tests, 100% passing

### Batch 7: Naming & Type Utils (Priority: Medium) ✅ COMPLETED
- [x] `referenceable-types.ts` - CloudFormation resource referenceable params

**Batch 7 Stats**: 1 file, ~30 tests, 100% passing

### Batch 8: Template Manager (Priority: Medium) ✅ COMPLETED
- [x] `template-manager/utils.ts` - Initial CloudFormation template generation

**Batch 8 Stats**: 1 file, ~16 tests, 100% passing

### Batch 9: Deployment Utils (Priority: Medium) ✅ COMPLETED
- [x] `deployment-artifact-manager/utils.ts` - Deployment artifact parsing and type detection

**Batch 9 Stats**: 1 file, ~40 tests, 100% passing

### Batch 10: Versioning & User Code Utils (Priority: Medium) ✅ COMPLETED
- [x] `versioning.ts` - Version string manipulation and Stacktape version management
- [x] `user-code-processing.ts` - User code file path parsing and loading

**Batch 10 Stats**: 2 files, ~55 tests, 100% passing

### Batch 11: Basic Utilities (Priority: Medium) ✅ COMPLETED
- [x] `basic-compose-shim.ts` - CommonJS/ESM interop shim for basic-compose
- [x] `helper-lambdas.ts` - Helper lambda loading and details

**Batch 11 Stats**: 2 files, ~35 tests, 100% passing

### Batch 12: Config Files (Priority: Medium) ✅ COMPLETED
- [x] `config/random.ts` - Environment flags, endpoints, bucket names, language extensions
- [x] `config/cli.ts` - CLI and SDK command lists

**Batch 12 Stats**: 2 files, ~45 tests, 100% passing

### Batch 13: CLI & Git Utilities (Priority: Medium) ✅ COMPLETED
- [x] `git.ts` - Git variable extraction functions
- [x] `cli.ts` - CLI argument parsing and transformation

**Batch 13 Stats**: 2 files, ~37 tests, 100% passing

### Batch 14: Config Manager Database & IAM Utils (Priority: Medium) ✅ COMPLETED
- [x] `config-manager/utils/iam.ts` - IAM statement generation for S3 buckets
- [x] `config-manager/utils/relational-databases.ts` - Database validation and maintenance window

**Batch 14 Stats**: 2 files, ~40 tests, 100% passing

### Batch 15: HTTP Client, Sentry & Telemetry Utilities (Priority: Medium) ✅ COMPLETED
- [x] `http-client.ts` - HTTP client with jsonFetch function
- [x] `sentry.ts` - Sentry initialization, tags, and error reporting
- [x] `telemetry.ts` - Telemetry event tracking

**Batch 15 Stats**: 3 files, ~56 tests, 100% passing

### Batch 16: Scripts, Decorators & Sensitive Values (Priority: Medium) ✅ COMPLETED
- [x] `stack-info-map-sensitive-values.ts` - Sensitive value resolution (SSM/Secrets Manager)
- [x] `decorators.ts` - Decorator utilities (memoize, skip init, cancelable)
- [x] `scripts.ts` - Script execution utilities (hooks, environments)

**Batch 16 Stats**: 3 files, ~62 tests, 100% passing

### Batch 17+: Remaining Files (Priority: Low to Medium)
Will be organized based on dependencies and complexity.

---

## Notes

- Tests will require extensive AWS SDK mocking using bun:test's mock.module
- Many domain managers will need integration-style tests with complex mocking
- Commands will need CLI argument mocking and state manager mocking
- Focus on testing business logic and edge cases
- Some files may be skipped if they are entry points with minimal logic (e.g., `src/index.ts`)
