import fs from 'node:fs';
import { join } from 'node:path';
import {
  cfTypeToFilePath,
  extractInterfacesFromCloudformFile,
  prefixInterfaceNames,
  simplifyCloudFormationTypes
} from './cloudform-utils';

/**
 * Generate Properties interfaces from cloudform files for all child resources
 */
export function generatePropertiesInterfaces(CHILD_RESOURCES: any): string {
  // First, extract and include the base types that all interfaces depend on
  const dataTypesPath = join(process.cwd(), '@generated', 'cloudform', 'dataTypes.ts');
  const resourcePath = join(process.cwd(), '@generated', 'cloudform', 'resource.ts');

  let baseTypes = '';

  // Read and extract necessary types from dataTypes.ts
  if (fs.existsSync(dataTypesPath)) {
    const dataTypesContent = fs.readFileSync(dataTypesPath, 'utf-8');
    // Extract type definitions (Value, List, Condition, etc.)
    const typeMatches = dataTypesContent.match(/export type \w.*?;/g) || [];
    // Only keep non-Value/List types since we'll simplify those away
    const filteredTypes: string[] = typeMatches.filter(
      (t: string) => !t.includes('Value') && !t.includes('List') && !t.includes('Condition')
    );
    baseTypes += `${filteredTypes.join('\n')}\n\n`;

    // Extract class exports that might be needed (IntrinsicFunction, ResourceTag, etc.)
    const classMatches = dataTypesContent.match(/export class \w[\s\S]*?(?=\n(?:export|$))/g) || [];
    baseTypes += `${classMatches.join('\n\n')}\n\n`;
  }

  // Read and extract ResourceTag and other base types from resource.ts
  if (fs.existsSync(resourcePath)) {
    const resourceContent = fs.readFileSync(resourcePath, 'utf-8');
    // Extract interface, type, and class definitions
    const exportPattern = /export (?:interface|type|enum|class) \w[\s\S]*?(?=\n(?:export|$))/g;
    const interfaceMatches = resourceContent.match(exportPattern) || [];
    baseTypes += `${interfaceMatches.join('\n\n')}\n\n`;
  }

  // Apply simplification to base types to remove Value<T> and List<T> wrappers
  baseTypes = simplifyCloudFormationTypes(baseTypes);

  const processedFiles = new Set<string>();
  const addedInterfaces = new Map<string, string>(); // Track interface name -> full definition
  let result = baseTypes;

  // Extract from all child resources
  const resources = Object.values(CHILD_RESOURCES) as Array<Array<{ resourceType: string }>>;

  for (const resourceArray of resources) {
    for (const resource of resourceArray) {
      const filePath = cfTypeToFilePath(resource.resourceType, process.cwd());
      if (filePath && !processedFiles.has(filePath)) {
        processedFiles.add(filePath);
        const interfaces = extractInterfacesFromCloudformFile(filePath);

        // Simplify CloudFormation wrapper types
        const simplified = simplifyCloudFormationTypes(interfaces);

        // Add service prefix to avoid naming conflicts
        // Extract service name from resource type (e.g., AWS::Lambda::Function -> Lambda)
        const parts = resource.resourceType.split('::');
        const serviceName = parts[1];

        // Prefix interface names with service name to avoid conflicts
        const prefixed = prefixInterfaceNames(simplified, serviceName);

        // Deduplicate: only add interfaces that haven't been added yet
        // Split by export declarations and check each one
        const exportBlocks = prefixed.split(/(?=export (?:interface|type|enum) )/);
        for (const block of exportBlocks) {
          if (!block.trim()) {
            continue;
          }

          // Extract the interface/type/enum name
          const nameMatch = block.match(/export (?:interface|type|enum) (\w+)/);
          if (nameMatch) {
            const interfaceName = nameMatch[1];
            if (!addedInterfaces.has(interfaceName)) {
              addedInterfaces.set(interfaceName, block);
              result += block;
            }
            // If already added, skip this duplicate
          }
        }
      }
    }
  }

  return result;
}
