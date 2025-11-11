import type { Definition } from 'typescript-json-schema';

export const resolveRef = (node: Definition, schema: Definition): Definition => {
  if (node.$ref) {
    // @ts-ignore
    return { ...node, ...schema.definitions[node.$ref.slice(14)] };
  }
  return node;
};

export const getTypeDetailsFromNode = (
  node: Definition
): {
  allowedTypes: string[];
  allowedValues?: (string | number)[];
} => {
  if (node.enum) {
    // @ts-ignore
    return { allowedTypes: [node.type], allowedValues: node.enum };
  }
  if (Array.isArray(node.type)) {
    return {
      allowedTypes: node.type
    };
  }
  return {
    allowedTypes: [node.type]
  };
};
