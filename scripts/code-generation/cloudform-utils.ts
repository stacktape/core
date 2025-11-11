/**
 * Utilities for working with CloudFormation resource types
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CloudFormation service name mappings.
 * Maps AWS CloudFormation service names to directory names in @generated/cloudform
 *
 * Pattern: Most services use lowercase first letter + camelCase.
 * Special cases are explicitly mapped.
 */
const CF_SERVICE_MAPPINGS: Readonly<Record<string, string>> = {
  ApiGatewayV2: 'apiGatewayV2',
  ApiGateway: 'apiGateway',
  ApplicationLoadBalancing: 'elasticLoadBalancingV2',
  ElasticLoadBalancingV2: 'elasticLoadBalancingV2',
  ElasticLoadBalancing: 'elasticLoadBalancing',
  CloudFormation: 'cloudFormation',
  CloudFront: 'cloudFront',
  CloudWatch: 'cloudWatch',
  CloudTrail: 'cloudTrail',
  DynamoDB: 'dynamoDb',
  StepFunctions: 'stepFunctions',
  OpenSearchService: 'openSearchService',
  ElastiCache: 'elastiCache',
  AutoScaling: 'autoScaling',
  EC2: 'ec2',
  IAM: 'iam',
  Lambda: 'lambda',
  RDS: 'rds',
  Route53: 'route53',
  SNS: 'sns',
  SQS: 'sqs',
  S3: 's3',
  CodeDeploy: 'codeDeploy',
  SSM: 'ssm',
  Logs: 'logs',
  ECS: 'ecs',
  EFS: 'efs',
  Scheduler: 'scheduler',
  Events: 'events',
  Kinesis: 'kinesis',
  Pipes: 'pipes',
  Cognito: 'cognito',
  Batch: 'batch',
  WAFv2: 'wafv2'
} as const;

/**
 * Converts a CloudFormation service name to its directory name
 * @example 'ApiGatewayV2' -> 'apiGatewayV2', 'DynamoDB' -> 'dynamoDb'
 */
export function cfServiceToDirectory(serviceName: string): string {
  const mapped = CF_SERVICE_MAPPINGS[serviceName];
  if (mapped) {
    return mapped;
  }

  // Default: lowercase first character
  return serviceName.charAt(0).toLowerCase() + serviceName.slice(1);
}

/**
 * Converts a CloudFormation resource name to a file name
 * @example 'Bucket' -> 'bucket', 'BucketPolicy' -> 'bucketPolicy'
 */
export function cfResourceToFileName(resourceName: string): string {
  return resourceName.charAt(0).toLowerCase() + resourceName.slice(1);
}

/**
 * Parses a CloudFormation type string into its components
 * @returns null if the type string is invalid
 */
function parseCfType(cfType: string): { service: string; resource: string } | null {
  const parts = cfType.split('::');

  if (parts.length !== 3 || parts[0] !== 'AWS') {
    return null;
  }

  return {
    service: parts[1],
    resource: parts[2]
  };
}

/**
 * Converts a CloudFormation type to file path
 * @example 'AWS::S3::Bucket' -> '/path/to/@generated/cloudform/s3/bucket.ts'
 */
export function cfTypeToFilePath(cfType: string, basePath: string): string | null {
  const parsed = parseCfType(cfType);
  if (!parsed) {
    return null;
  }

  const dir = cfServiceToDirectory(parsed.service);
  const fileName = cfResourceToFileName(parsed.resource);

  return join(basePath, '@generated', 'cloudform', dir, `${fileName}.ts`);
}

/**
 * Generates an interface name with service prefix to avoid conflicts
 * Handles cases where the resource name already contains the service name
 * @example 'CloudFront', 'CloudFrontOriginAccessIdentity' -> 'CloudFrontOriginAccessIdentityProperties'
 *          (not 'CloudFrontCloudFrontOriginAccessIdentityProperties')
 */
function generateInterfaceName(service: string, resource: string): string {
  if (resource.startsWith(service)) {
    return `${resource}Properties`;
  }
  return `${service}${resource}Properties`;
}

/**
 * Converts a CloudFormation type to an interface name with service prefix
 * @returns Object with directory, filename, and interface name, or null if invalid
 */
export function cfTypeToInterface(cfType: string): { dir: string; file: string; interface: string } | null {
  const parsed = parseCfType(cfType);
  if (!parsed) {
    return null;
  }

  const dir = cfServiceToDirectory(parsed.service);
  const fileName = `${cfResourceToFileName(parsed.resource)}.ts`;
  const interfaceName = generateInterfaceName(parsed.service, parsed.resource);

  return { dir, file: fileName, interface: interfaceName };
}

/**
 * Gets the property name from a CloudFormation logical name function
 * These are defined in child-resources.ts using cfLogicalNames functions
 */
export function getPropertyNameFromLogicalName(logicalNameFunc: any): string | null {
  if (typeof logicalNameFunc === 'function' && logicalNameFunc.name) {
    return logicalNameFunc.name;
  }
  return null;
}

/**
 * Regex patterns for CloudFormation type simplification
 */
const CF_TYPE_PATTERNS = {
  // List<Value<T>> -> T[]
  listValue: /List<Value<(\w+)>>/g,
  // Value<primitive> -> primitive
  valuePrimitive: /Value<(string|number|boolean)>/g,
  // Value<complex> -> complex
  valueComplex: /Value<([A-Za-z_]\w*(?:<[^>]*>)?)>/g,
  // Value<object> -> object
  valueObject: /Value<(\{[^}]+\})>/g,
  // List<primitive> -> primitive[]
  listPrimitive: /List<(string|number|boolean)>/g,
  // List<object> -> object[]
  listObject: /List<(\{[^}]+\})>/g,
  // List<complex> -> complex[]
  listComplex: /List<([A-Za-z_]\w*(?:<[^>]*>)?)>/g,
  // Definite assignment: Property!: -> Property:
  definiteAssignment: /(\w+)!:/g,
  // Import statements for Value/List
  importValue: /import\s*\{[^}]*Value[^}]*\}\s*from\s*['"]\{^'"\]*dataTypes['"]\s*;?\n?/g,
  importList: /import\s*\{[^}]*List[^}]*\}\s*from\s*['"]\{^'"\]*dataTypes['"]\s*;?\n?/g,
  // Multiple newlines
  multipleNewlines: /\n{3,}/g
} as const;

/**
 * Simplifies CloudFormation wrapper types to primitive types
 * @example Value<string> -> string, List<Value<string>> -> string[]
 */
export function simplifyCloudFormationTypes(content: string): string {
  let simplified = content;

  // Apply transformations in order of specificity (most specific first)
  simplified = simplified.replace(CF_TYPE_PATTERNS.listValue, '$1[]');
  simplified = simplified.replace(CF_TYPE_PATTERNS.valuePrimitive, '$1');
  simplified = simplified.replace(CF_TYPE_PATTERNS.valueComplex, '$1');
  simplified = simplified.replace(CF_TYPE_PATTERNS.valueObject, '$1');
  simplified = simplified.replace(CF_TYPE_PATTERNS.listPrimitive, '$1[]');
  simplified = simplified.replace(CF_TYPE_PATTERNS.listObject, '$1[]');
  simplified = simplified.replace(CF_TYPE_PATTERNS.listComplex, '$1[]');
  simplified = simplified.replace(CF_TYPE_PATTERNS.definiteAssignment, '$1:');

  // Remove imports
  simplified = simplified.replace(CF_TYPE_PATTERNS.importValue, '');
  simplified = simplified.replace(CF_TYPE_PATTERNS.importList, '');

  // Clean up whitespace
  simplified = simplified.replace(CF_TYPE_PATTERNS.multipleNewlines, '\n\n');

  return simplified;
}

/**
 * Extracts code blocks (interfaces, types, enums, classes) from TypeScript content
 */
type CodeBlock = {
  type: 'interface' | 'type' | 'enum' | 'class';
  name: string;
  content: string;
};

/**
 * Extracts all exported interfaces, types, and enums from a CloudFormation file
 * @param filePath Path to the CloudFormation TypeScript file
 * @returns Extracted and combined code blocks
 */
export function extractInterfacesFromCloudformFile(filePath: string): string {
  if (!existsSync(filePath)) {
    return '';
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let result = '';
    let inBlock = false;
    let blockContent = '';
    let braceCount = 0;

    for (const line of lines) {
      const isExportDeclaration =
        line.includes('export interface') ||
        line.includes('export type') ||
        line.includes('export enum') ||
        line.includes('export class');

      if (isExportDeclaration && !inBlock) {
        inBlock = true;
        blockContent = line;
        braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

        // Handle single-line declarations
        if (braceCount === 0 && line.includes(';')) {
          if (!line.includes('export class')) {
            result += `${blockContent}\n\n`;
          }
          inBlock = false;
          blockContent = '';
        }
      } else if (inBlock) {
        blockContent += `\n${line}`;
        braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

        // Check if block is complete
        if (braceCount === 0 && (line.includes('}') || line.includes(';'))) {
          if (blockContent.includes('export class')) {
            // Convert classes to interfaces
            const interfaceContent = blockContent
              .replace(/export class (\w+)/, 'export interface $1')
              .replace(/\s+constructor\([^)]*\)\s*\{[^}]*\}/g, '')
              .replace(/\s+static\s+\w+\s*=\s*\w+;/g, '');
            result += `${interfaceContent}\n\n`;
          } else {
            result += `${blockContent}\n\n`;
          }
          inBlock = false;
          blockContent = '';
        }
      }
    }

    return result;
  } catch (error) {
    console.error(`[cloudform-utils] Error reading file ${filePath}:`, error);
    return '';
  }
}

/**
 * Prefixes interface/type/enum names with service name to avoid naming conflicts
 * @param content TypeScript content with interface definitions
 * @param serviceName Service name to use as prefix (e.g., 'Lambda')
 * @returns Content with prefixed names
 */
export function prefixInterfaceNames(content: string, serviceName: string): string {
  // Helper to determine if a name needs prefixing
  const needsPrefix = (name: string): boolean => !name.startsWith(serviceName);

  // Prefix export declarations
  let prefixed = content.replace(/export (interface|type|enum) (\w+)/g, (match, keyword, name) => {
    if (needsPrefix(name)) {
      return `export ${keyword} ${serviceName}${name}`;
    }
    return match;
  });

  // Update type references
  const definedTypes = new Set<string>();
  const typeDefRegex = /export (?:interface|type|enum) (\w+)/g;
  let typeMatch;

  while ((typeMatch = typeDefRegex.exec(prefixed)) !== null) {
    definedTypes.add(typeMatch[1]);
  }

  // Replace references to original names with prefixed versions
  for (const typeName of definedTypes) {
    if (typeName.startsWith(serviceName)) {
      const originalName = typeName.substring(serviceName.length);
      const regex = new RegExp(`\\b${originalName}\\b(?!:)`, 'g');

      prefixed = prefixed.replace(regex, (match, offset) => {
        // Don't replace if it's part of an export declaration
        const before = prefixed.substring(Math.max(0, offset - 25), offset);
        if (before.includes('export interface') || before.includes('export type') || before.includes('export enum')) {
          return match;
        }
        return typeName;
      });
    }
  }

  return prefixed;
}
