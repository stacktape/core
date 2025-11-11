/**
 * Generates type properties class declarations (engines, packaging, events, etc.)
 */

import { TYPE_PROPERTIES } from '../../src/api/npm/ts/resource-metadata';

/**
 * Generate type/properties class declarations
 */
export function generateTypePropertiesClassDeclarations(): string {
  return TYPE_PROPERTIES.map(({ className, typeValue, propsType }) => {
    return `
export declare class ${className} extends BaseTypeProperties {
  constructor(properties: ${propsType});
  readonly type: '${typeValue}';
}`;
  }).join('\n');
}

/**
 * Get unique props types from type properties (for importing from SDK)
 */
export function getTypePropertiesImports(sdkPropsWithAugmentation: string[]): string[] {
  const typePropertiesAlreadyImported: string[] = [];
  const imports = TYPE_PROPERTIES.map(({ propsType }) => {
    // Skip script props as they're being augmented (imported with Sdk prefix)
    if (sdkPropsWithAugmentation.includes(propsType)) {
      return null;
    }
    if (typePropertiesAlreadyImported.includes(propsType)) {
      return null;
    }
    typePropertiesAlreadyImported.push(propsType);
    return propsType;
  }).filter(Boolean) as string[];

  return imports;
}
