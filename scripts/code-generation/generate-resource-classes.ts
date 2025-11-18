import type { ReferenceableParam, ReferenceableParamsMap } from './types';
import { getResourcesWithAugmentedProps, RESOURCES } from '../../src/api/npm/ts/resource-metadata';

/**
 * Generates getter declarations for a resource's referenceable parameters
 */
function generateGetters(params: ReferenceableParam[]): string {
  if (params.length === 0) {
    return '';
  }

  return params
    .map((param) => {
      return `  /** ${param.description} */\n  readonly ${param.name}: string;`;
    })
    .join('\n');
}

/**
 * Determines the props type to use for a resource constructor
 */
function determinePropsType(propsType: string, hasAugmentedProps: boolean): string {
  return hasAugmentedProps ? propsType : `${propsType}WithOverrides`;
}

/**
 * Generates a single resource class declaration
 */
function generateResourceClass(
  className: string,
  propsType: string,
  resourceType: string,
  hasAugmentedProps: boolean,
  referenceableParams: ReferenceableParam[]
): string {
  const finalPropsType = determinePropsType(propsType, hasAugmentedProps);
  const getters = generateGetters(referenceableParams);

  const parts = [
    '',
    `export declare class ${className} extends BaseResource {`,
    `  constructor(name: string, properties: ${finalPropsType});`,
    getters,
    '}'
  ];

  return parts.filter(Boolean).join('\n');
}

/**
 * Generate resource class declarations for all resources
 */
export function generateResourceClassDeclarations(REFERENCEABLE_PARAMS: ReferenceableParamsMap): string {
  const resourcesWithAugmented = getResourcesWithAugmentedProps();
  const augmentedPropsTypes = new Set(resourcesWithAugmented.map((r) => r.propsType));

  const classDeclarations = RESOURCES.map(({ className, resourceType, propsType }) => {
    const params = REFERENCEABLE_PARAMS[resourceType] || [];
    const hasAugmentedProps = augmentedPropsTypes.has(propsType);

    return generateResourceClass(className, propsType, resourceType, hasAugmentedProps, params);
  });

  return classDeclarations.join('\n');
}
