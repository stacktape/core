/**
 * Generates augmented props types with modified connectTo and environment properties
 * Preserves JSDoc comments from original type definitions
 */

import type { PropertyInfo } from './types';
import {
  getResourcesWithAugmentedProps,
  getResourcesWithOverrides,
  RESOURCES
} from '../../src/api/npm/ts/resource-metadata';
import { formatJSDoc, getSDKPropertyInfo } from './jsdoc-extractor';

/**
 * Script props types that need augmented connectTo/environment
 */
const SCRIPT_PROPS_TYPES = ['LocalScriptProps', 'BastionScriptProps', 'LocalScriptWithBastionTunnelingProps'] as const;

/**
 * All connectable resource types (for scripts that can connect to anything)
 */
const ALL_CONNECTABLE_RESOURCES = [
  'RelationalDatabase',
  'Bucket',
  'HostingBucket',
  'DynamoDbTable',
  'EventBus',
  'RedisCluster',
  'MongoDbAtlasCluster',
  'UpstashRedis',
  'SqsQueue',
  'SnsTopic',
  'OpenSearchDomain',
  'EfsFilesystem',
  'PrivateService',
  'WebService',
  'LambdaFunction',
  'BatchJob',
  'UserAuthPool',
  'GlobalAwsServiceConstant'
] as const;

/**
 * Default JSDoc for connectTo property (used as fallback)
 */
const DEFAULT_CONNECT_TO_JSDOC = {
  description: `List of resources or AWS services to which this resource receives permissions.
Automatically grants necessary IAM permissions for accessing the connected resources.`,
  tags: []
};

/**
 * Default JSDoc for environment property (used as fallback)
 */
const DEFAULT_ENVIRONMENT_JSDOC = {
  description: `Environment variables to set for this resource.
You can reference resource parameters using directive syntax: \$ResourceParam('resourceName', 'paramName')`,
  tags: []
};

/**
 * Default JSDoc for overrides property
 */
const DEFAULT_OVERRIDES_JSDOC = {
  description: `Override properties of underlying CloudFormation resources.
Allows fine-grained control over the generated infrastructure.`,
  tags: []
};

/**
 * Generates a property declaration with JSDoc
 */
function generatePropertyWithJSDoc(propertyInfo: PropertyInfo, indent: string = '  '): string {
  const lines: string[] = [];

  if (propertyInfo.jsdoc) {
    lines.push(formatJSDoc(propertyInfo.jsdoc, indent));
  }

  const optionalMarker = propertyInfo.optional ? '?' : '';
  lines.push(`${indent}${propertyInfo.name}${optionalMarker}: ${propertyInfo.type};`);

  return lines.join('\n');
}

/**
 * Gets connectTo property info with JSDoc from SDK type or uses default
 */
function getConnectToPropertyInfo(sdkTypeName: string, connectToType: string): PropertyInfo {
  const sdkPropertyInfo = getSDKPropertyInfo(sdkTypeName, 'connectTo');

  return {
    name: 'connectTo',
    type: `Array<${connectToType}>`,
    optional: true,
    jsdoc: sdkPropertyInfo?.jsdoc || DEFAULT_CONNECT_TO_JSDOC
  };
}

/**
 * Gets environment property info with JSDoc from SDK type or uses default
 */
function getEnvironmentPropertyInfo(sdkTypeName: string): PropertyInfo {
  const sdkPropertyInfo = getSDKPropertyInfo(sdkTypeName, 'environment');

  return {
    name: 'environment',
    type: '{ [envVarName: string]: string | number | boolean }',
    optional: true,
    jsdoc: sdkPropertyInfo?.jsdoc || DEFAULT_ENVIRONMENT_JSDOC
  };
}

/**
 * Gets overrides property info with JSDoc
 */
function getOverridesPropertyInfo(overridesTypeName: string): PropertyInfo {
  return {
    name: 'overrides',
    type: overridesTypeName,
    optional: true,
    jsdoc: DEFAULT_OVERRIDES_JSDOC
  };
}

/**
 * Generates a ConnectTo type alias for a resource
 */
function generateConnectToType(resourceType: string, canConnectTo: readonly string[]): string {
  if (resourceType === 'Script') {
    return `type ${resourceType}ConnectTo = ${[...ALL_CONNECTABLE_RESOURCES].join(' | ')};`;
  }

  const connectToList = [...canConnectTo, 'GlobalAwsServiceConstant'];
  return `type ${resourceType}ConnectTo = ${connectToList.join(' | ')};`;
}

/**
 * Generates an augmented props type declaration
 */
function generateAugmentedPropsType(
  propsType: string,
  originalPropsType: string,
  resourceType: string,
  connectToType: string,
  includeOverrides: boolean
): string {
  const lines: string[] = [];

  // Start the type declaration
  lines.push(`export type ${propsType} = Omit<${originalPropsType}, 'connectTo' | 'environment'> & {`);

  // Add connectTo property with JSDoc
  const connectToProperty = getConnectToPropertyInfo(originalPropsType, connectToType);
  lines.push(generatePropertyWithJSDoc(connectToProperty));

  // Add environment property with JSDoc
  const environmentProperty = getEnvironmentPropertyInfo(originalPropsType);
  lines.push(generatePropertyWithJSDoc(environmentProperty));

  // Add overrides if needed
  if (includeOverrides) {
    const overridesProperty = getOverridesPropertyInfo(`${resourceType}Overrides`);
    lines.push(generatePropertyWithJSDoc(overridesProperty));
  }

  lines.push('};');

  return lines.join('\n');
}

/**
 * Generates a WithOverrides type for resources without augmented props
 */
function generateWithOverridesType(propsType: string, className: string): string {
  const lines: string[] = [];

  lines.push(`export type ${propsType}WithOverrides = ${propsType} & {`);

  const overridesProperty = getOverridesPropertyInfo(`${className}Overrides`);
  lines.push(generatePropertyWithJSDoc(overridesProperty));

  lines.push('};');

  return lines.join('\n');
}

/**
 * Generate augmented props types (Props with modified connectTo and environment)
 * Preserves JSDoc comments from original SDK types
 */
export function generateAugmentedPropsTypes(): string {
  const result: string[] = [];

  const resourcesWithAugmented = getResourcesWithAugmentedProps();

  // Collect all props that need ConnectTo types
  const connectToTypeNeeded = new Set<string>();

  // Process main resources
  for (const resource of resourcesWithAugmented) {
    connectToTypeNeeded.add(resource.className);
  }

  // Add Script type for script props
  connectToTypeNeeded.add('Script');

  // Generate ConnectTo type aliases
  result.push('// ConnectTo type aliases');
  for (const resourceType of connectToTypeNeeded) {
    if (resourceType === 'Script') {
      result.push(generateConnectToType('Script', ALL_CONNECTABLE_RESOURCES));
    } else {
      const resource = RESOURCES.find((r) => r.className === resourceType);
      if (resource && resource.canConnectTo) {
        result.push(generateConnectToType(resourceType, resource.canConnectTo));
      }
    }
  }

  result.push('');
  result.push('// Augmented props types with connectTo, environment, and overrides');
  result.push('');

  // Generate augmented props for resources
  for (const resource of resourcesWithAugmented) {
    const augmentedType = generateAugmentedPropsType(
      resource.propsType,
      `Sdk${resource.propsType}`,
      resource.className,
      `${resource.className}ConnectTo`,
      true // includeOverrides
    );
    result.push(augmentedType);
    result.push('');
  }

  // Generate augmented props for scripts
  for (const scriptPropsType of SCRIPT_PROPS_TYPES) {
    const augmentedType = generateAugmentedPropsType(
      scriptPropsType,
      `Sdk${scriptPropsType}`,
      'Script',
      'ScriptConnectTo',
      false // Scripts don't have overrides
    );
    result.push(augmentedType);
    result.push('');
  }

  // Generate WithOverrides types for other resources
  result.push('// WithOverrides types for resources without connectTo augmentation');
  result.push('');

  const augmentedPropsNames = [...resourcesWithAugmented.map((r) => r.propsType), ...SCRIPT_PROPS_TYPES];

  const resourcesWithOverrides = getResourcesWithOverrides();
  for (const resource of resourcesWithOverrides) {
    if (!augmentedPropsNames.includes(resource.propsType)) {
      const withOverridesType = generateWithOverridesType(resource.propsType, resource.className);
      result.push(withOverridesType);
      result.push('');
    }
  }

  return result.join('\n');
}

/**
 * Generate SDK import aliases for props types
 * Returns a string for the import statement
 */
export function generateSdkPropsImports(): string {
  const sdkPropsWithAugmentation = [...getResourcesWithAugmentedProps().map((r) => r.propsType), ...SCRIPT_PROPS_TYPES];

  const allResources = RESOURCES;
  const sdkPropsWithoutAugmentation = allResources
    .map((r) => r.propsType)
    .filter((propsType) => !sdkPropsWithAugmentation.includes(propsType));

  const imports = [...sdkPropsWithAugmentation.map((prop) => `${prop} as Sdk${prop}`), ...sdkPropsWithoutAugmentation];

  return imports.join(',\n  ');
}

/**
 * Generate a StacktapeConfig type export that properly types resources with class names
 */
export function generateStacktapeConfigType(): string {
  const resourceClassNames = RESOURCES.map((r) => r.className);

  return `// Re-export StacktapeConfig with properly typed resources
export type StacktapeConfig = Omit<import('./sdk').StacktapeConfig, 'resources'> & {
  resources: { [resourceName: string]: ${resourceClassNames.join(' | ')} };
};`;
}
