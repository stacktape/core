import { CHILD_RESOURCES } from './child-resources';

// Private symbols for internal methods - not accessible from outside
// Use Symbol.for() so it can be accessed across modules
const getParamReferenceSymbol = Symbol.for('stacktape:getParamReference');
const getTypeSymbol = Symbol.for('stacktape:getType');
const getPropertiesSymbol = Symbol.for('stacktape:getProperties');
const getOverridesSymbol = Symbol.for('stacktape:getOverrides');

/**
 * A reference to a resource parameter that will be resolved at runtime
 */
export class ResourceParamReference {
  private __resourceName: string;
  private __param: string;

  constructor(resourceName: string, param: string) {
    this.__resourceName = resourceName;
    this.__param = param;
  }

  toString(): string {
    return `$ResourceParam('${this.__resourceName}', '${this.__param}')`;
  }

  toJSON(): string {
    return this.toString();
  }

  // Allow the reference to be used directly in template strings
  valueOf(): string {
    return this.toString();
  }
}

/**
 * Base class for type/properties structures (engines, packaging, events, etc.)
 */
export class BaseTypeProperties {
  public readonly type: string;
  public readonly properties: any;

  constructor(type: string, properties: any) {
    this.type = type;
    this.properties = properties;
  }
}

/**
 * Base resource class that provides common functionality
 */
export class BaseResource {
  private readonly _type: string;
  private readonly _properties: any;
  private readonly _overrides?: any;
  private readonly _resourceName: string;

  constructor(name: string, type: string, properties: any, overrides?: any) {
    this._resourceName = name;
    this._type = type;

    // Extract overrides from properties if present
    let finalProperties = properties;
    let finalOverrides = overrides;

    if (properties && typeof properties === 'object' && 'overrides' in properties) {
      // Clone properties without overrides
      finalProperties = { ...properties };
      const propertiesOverrides = finalProperties.overrides;
      delete finalProperties.overrides;

      // Transform overrides using cfLogicalNames
      if (propertiesOverrides && typeof propertiesOverrides === 'object') {
        finalOverrides = transformOverridesToLogicalNames(name, type, propertiesOverrides);
      }
    }

    this._properties = finalProperties;
    this._overrides = finalOverrides;
  }

  // Public getter for resource name (used for referencing resources)
  get resourceName(): string {
    return this._resourceName;
  }

  // Private methods using symbols - not accessible from outside or in autocomplete
  [getParamReferenceSymbol](paramName: string): ResourceParamReference {
    return new ResourceParamReference(this._resourceName, paramName);
  }

  [getTypeSymbol](): string {
    return this._type;
  }

  [getPropertiesSymbol](): any {
    return this._properties;
  }

  [getOverridesSymbol](): any | undefined {
    return this._overrides;
  }
}

/**
 * Transform user-friendly overrides (with property names like 'bucket', 'lambdaLogGroup')
 * to CloudFormation logical names using cfLogicalNames
 */
function transformOverridesToLogicalNames(resourceName: string, resourceType: string, overrides: any): any {
  // Get child resources for this resource type
  const childResources = CHILD_RESOURCES[resourceType] || [];

  // Build a map of property names to child resources
  const propertyNameMap = new Map<string, any>();

  for (const childResource of childResources) {
    // The logicalName function has a name property that matches the property name
    if (childResource.logicalName && childResource.logicalName.name) {
      propertyNameMap.set(childResource.logicalName.name, childResource);
    }
  }

  // Transform overrides object
  const transformedOverrides: any = {};
  const errorMessage = `Override of property {propertyName} of resource ${resourceName} is not supported.\n
Remove the override, run 'stacktape compile:template' command, and find the logical name of the resource you want to override manually. Then add it to the overrides object.`;

  for (const propertyName in overrides) {
    const childResource = propertyNameMap.get(propertyName);

    // Skip unresolvable resources
    if (childResource?.unresolvable) {
      throw new Error(errorMessage.replace('{propertyName}', propertyName));
    }

    if (childResource) {
      const logicalNameFn = childResource.logicalName;
      // Call the cfLogicalNames function to get the actual CloudFormation logical name
      // Try with resourceName first (most common), then try without arguments
      let logicalName: string;
      try {
        logicalName = logicalNameFn(resourceName);
      } catch {
        try {
          logicalName = logicalNameFn();
        } catch {
          // If both fail, use property name as-is
          logicalName = propertyName;
        }
      }
      if (logicalName.includes('undefined')) {
        throw new Error(errorMessage.replace('{propertyName}', propertyName));
      }
      transformedOverrides[logicalName] = overrides[propertyName];
    } else {
      // If not found in map, use property name as-is (shouldn't happen with proper types)
      transformedOverrides[propertyName] = overrides[propertyName];
    }
  }

  return transformedOverrides;
}

export type GetConfigParams = {
  /**
   * Project name used for this operation
   */
  projectName: string;
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
  cliArgs: StacktapeArgs;
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

/**
 * Helper function to define a config with automatic transformation
 * Use this when exporting your config for the Stacktape CLI
 */
export const defineConfig = (configFn: (params: GetConfigParams) => StacktapeConfig) => {
  return (params: GetConfigParams) => {
    const config = configFn(params);
    return transformConfigWithResources(config);
  };
};

/**
 * Transforms a config with resource instances into a plain config object
 */
export const transformConfigWithResources = (config: any): any => {
  if (!config || typeof config !== 'object') {
    return config;
  }

  // Transform the config, marking resources and scripts sections specially
  const result: any = {};
  for (const key in config) {
    if (key === 'resources') {
      // Resources are transformed as definitions
      result[key] = transformResourceDefinitions(config[key]);
    } else if (key === 'scripts') {
      // Scripts are also transformed as definitions
      result[key] = transformScriptDefinitions(config[key]);
    } else {
      result[key] = transformValue(config[key]);
    }
  }
  return result;
};

/**
 * Transforms environment object to array format
 */
const transformEnvironment = (env: any): any => {
  if (!env || typeof env !== 'object' || Array.isArray(env)) {
    return env;
  }

  // Convert { KEY: value } to [{ name: 'KEY', value }]
  return Object.entries(env).map(([name, value]) => ({
    name,
    value: transformValue(value)
  }));
};

/**
 * Transforms resource definitions (values in the resources object)
 */
const transformResourceDefinitions = (resources: any): any => {
  if (!resources || typeof resources !== 'object') {
    return resources;
  }

  const result: any = {};
  for (const key in resources) {
    const resource = resources[key];
    if (resource instanceof BaseResource) {
      const type = (resource as any)[getTypeSymbol]();
      const properties = (resource as any)[getPropertiesSymbol]();
      const overrides = (resource as any)[getOverridesSymbol]();
      result[key] = {
        type,
        properties: transformValue(properties),
        ...(overrides !== undefined && { overrides: transformValue(overrides) })
      };
    } else {
      result[key] = transformValue(resource);
    }
  }
  return result;
};

/**
 * Transforms script definitions (values in the scripts object)
 */
const transformScriptDefinitions = (scripts: any): any => {
  if (!scripts || typeof scripts !== 'object') {
    return scripts;
  }

  const result: any = {};
  for (const key in scripts) {
    const script = scripts[key];
    if (script instanceof BaseTypeProperties) {
      result[key] = {
        type: script.type,
        properties: transformValue(script.properties)
      };
    } else {
      result[key] = transformValue(script);
    }
  }
  return result;
};

export const transformValue = (value: any): any => {
  if (value === null || value === undefined) {
    return value;
  }

  // Transform ResourceParamReference
  if (value instanceof ResourceParamReference) {
    return value.toString();
  }

  // Transform BaseResource references (not definitions) to resourceName
  // This handles cases like connectTo: [database]
  if (value instanceof BaseResource) {
    return value.resourceName;
  }

  // Transform BaseTypeProperties (engines, packaging, events) to plain object
  if (value instanceof BaseTypeProperties) {
    return {
      type: value.type,
      properties: transformValue(value.properties)
    };
  }

  // Transform arrays
  if (Array.isArray(value)) {
    return value.map((item) => {
      // If it's a resource instance in an array (e.g., connectTo), transform to resourceName
      if (item instanceof BaseResource) {
        return item.resourceName;
      }
      return transformValue(item);
    });
  }

  // Transform objects
  if (typeof value === 'object') {
    const result: any = {};
    for (const key in value) {
      // Special handling for environment property
      if (key === 'environment') {
        result[key] = transformEnvironment(value[key]);
      } else {
        result[key] = transformValue(value[key]);
      }
    }
    return result;
  }

  return value;
};
