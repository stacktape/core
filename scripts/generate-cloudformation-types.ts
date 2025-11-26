import { readFileSync, writeFileSync } from "fs";
import { join, basename } from "path";

interface JsonSchemaProperty {
  description?: string;
  type?: string | string[];
  $ref?: string;
  enum?: (string | number | boolean)[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  additionalProperties?: boolean | JsonSchemaProperty;
  patternProperties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  pattern?: string;
  default?: unknown;
  oneOf?: JsonSchemaProperty[];
  anyOf?: JsonSchemaProperty[];
  allOf?: JsonSchemaProperty[];
}

interface CloudFormationSchema {
  typeName: string;
  description?: string;
  definitions?: Record<string, JsonSchemaProperty>;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

function convertTypeName(typeName: string): string {
  return typeName
    .split("::")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function sanitizeDefinitionName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "");
}

function generateJsDoc(prop: JsonSchemaProperty, indent: string = ""): string {
  const lines: string[] = [];

  if (prop.description) {
    // Split description into multiple lines if too long
    const descLines = prop.description.split("\n");
    for (const line of descLines) {
      // Wrap long lines
      const words = line.split(" ");
      let currentLine = "";
      for (const word of words) {
        if (currentLine.length + word.length + 1 > 100) {
          lines.push(currentLine.trim());
          currentLine = word + " ";
        } else {
          currentLine += word + " ";
        }
      }
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
    }
  }

  // Add directives
  if (prop.default !== undefined) {
    lines.push(`@default ${JSON.stringify(prop.default)}`);
  }
  if (prop.minimum !== undefined) {
    lines.push(`@minimum ${prop.minimum}`);
  }
  if (prop.maximum !== undefined) {
    lines.push(`@maximum ${prop.maximum}`);
  }
  if (prop.minLength !== undefined) {
    lines.push(`@minLength ${prop.minLength}`);
  }
  if (prop.maxLength !== undefined) {
    lines.push(`@maxLength ${prop.maxLength}`);
  }
  if (prop.minItems !== undefined) {
    lines.push(`@minItems ${prop.minItems}`);
  }
  if (prop.maxItems !== undefined) {
    lines.push(`@maxItems ${prop.maxItems}`);
  }
  if (prop.uniqueItems !== undefined) {
    lines.push(`@uniqueItems ${prop.uniqueItems}`);
  }
  if (prop.pattern !== undefined) {
    lines.push(`@pattern ${prop.pattern}`);
  }
  if (prop.enum !== undefined) {
    lines.push(`@enum ${JSON.stringify(prop.enum)}`);
  }

  if (lines.length === 0) {
    return "";
  }

  if (lines.length === 1) {
    return `${indent}/** ${lines[0]} */\n`;
  }

  return `${indent}/**\n${lines.map((line) => `${indent} * ${line}`).join("\n")}\n${indent} */\n`;
}

function resolveRef(ref: string): string {
  // Format: "#/definitions/ImageConfig"
  const match = ref.match(/^#\/definitions\/(.+)$/);
  if (match) {
    return sanitizeDefinitionName(match[1]);
  }
  return "unknown";
}

function propertyToTypeScript(
  prop: JsonSchemaProperty,
  definitions: Record<string, JsonSchemaProperty>,
  indent: string = "  "
): string {
  if (prop.$ref) {
    return resolveRef(prop.$ref);
  }

  if (prop.enum) {
    return prop.enum.map((v) => JSON.stringify(v)).join(" | ");
  }

  if (prop.oneOf || prop.anyOf) {
    const variants = prop.oneOf || prop.anyOf || [];
    return variants.map((v) => propertyToTypeScript(v, definitions, indent)).join(" | ");
  }

  if (prop.allOf) {
    return prop.allOf.map((v) => propertyToTypeScript(v, definitions, indent)).join(" & ");
  }

  const type = prop.type;

  if (Array.isArray(type)) {
    return type.map((t) => jsonTypeToTs(t)).join(" | ");
  }

  switch (type) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array":
      if (prop.items) {
        const itemType = propertyToTypeScript(prop.items, definitions, indent);
        // Wrap union types in parentheses for correct precedence
        const needsParens = itemType.includes(" | ") || itemType.includes(" & ");
        return needsParens ? `(${itemType})[]` : `${itemType}[]`;
      }
      return "unknown[]";
    case "object":
      if (prop.properties) {
        return generateInlineObject(prop, definitions, indent);
      }
      if (prop.patternProperties) {
        // Get the first pattern property type
        const patternValues = Object.values(prop.patternProperties);
        if (patternValues.length > 0) {
          const valueType = propertyToTypeScript(patternValues[0], definitions, indent);
          return `Record<string, ${valueType}>`;
        }
      }
      if (prop.additionalProperties === true) {
        return "Record<string, unknown>";
      }
      if (typeof prop.additionalProperties === "object") {
        const valueType = propertyToTypeScript(prop.additionalProperties, definitions, indent);
        return `Record<string, ${valueType}>`;
      }
      return "Record<string, unknown>";
    default:
      return "unknown";
  }
}

function jsonTypeToTs(type: string): string {
  switch (type) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array":
      return "unknown[]";
    case "object":
      return "Record<string, unknown>";
    default:
      return "unknown";
  }
}

function generateInlineObject(
  prop: JsonSchemaProperty,
  definitions: Record<string, JsonSchemaProperty>,
  indent: string
): string {
  if (!prop.properties) {
    return "Record<string, unknown>";
  }

  const requiredProps = new Set(prop.required || []);
  const lines: string[] = ["{"];
  const innerIndent = indent + "  ";

  for (const [propName, propDef] of Object.entries(prop.properties)) {
    const jsDoc = generateJsDoc(propDef, innerIndent);
    const isRequired = requiredProps.has(propName);
    const tsType = propertyToTypeScript(propDef, definitions, innerIndent);
    const optionalMark = isRequired ? "" : "?";

    if (jsDoc) {
      lines.push(jsDoc.trimEnd());
    }
    lines.push(`${innerIndent}${propName}${optionalMark}: ${tsType};`);
  }

  lines.push(`${indent}}`);
  return lines.join("\n");
}

function generateDefinitionType(
  name: string,
  def: JsonSchemaProperty,
  definitions: Record<string, JsonSchemaProperty>
): string {
  const safeName = sanitizeDefinitionName(name);
  const jsDoc = generateJsDoc(def, "");

  if (def.type === "object" && def.properties) {
    const requiredProps = new Set(def.required || []);
    const propLines: string[] = [];

    for (const [propName, propDef] of Object.entries(def.properties)) {
      const propJsDoc = generateJsDoc(propDef, "  ");
      const isRequired = requiredProps.has(propName);
      const tsType = propertyToTypeScript(propDef, definitions, "  ");
      const optionalMark = isRequired ? "" : "?";

      if (propJsDoc) {
        propLines.push(propJsDoc.trimEnd());
      }
      propLines.push(`  ${propName}${optionalMark}: ${tsType};`);
    }

    return `${jsDoc}export type ${safeName} = {\n${propLines.join("\n")}\n};\n`;
  }

  // For non-object types
  const tsType = propertyToTypeScript(def, definitions, "");
  return `${jsDoc}export type ${safeName} = ${tsType};\n`;
}

function generateMainType(
  typeName: string,
  schema: CloudFormationSchema,
  definitions: Record<string, JsonSchemaProperty>
): string {
  const safeName = convertTypeName(typeName);
  const requiredProps = new Set(schema.required || []);

  let jsDoc = "";
  if (schema.description) {
    jsDoc = generateJsDoc({ description: schema.description }, "");
  }

  const propLines: string[] = [];

  if (schema.properties) {
    for (const [propName, propDef] of Object.entries(schema.properties)) {
      const propJsDoc = generateJsDoc(propDef, "  ");
      const isRequired = requiredProps.has(propName);
      const tsType = propertyToTypeScript(propDef, definitions, "  ");
      const optionalMark = isRequired ? "" : "?";

      if (propJsDoc) {
        propLines.push(propJsDoc.trimEnd());
      }
      propLines.push(`  ${propName}${optionalMark}: ${tsType};`);
    }
  }

  return `${jsDoc}export type ${safeName} = {\n${propLines.join("\n")}\n};\n`;
}

export function generateCloudFormationTypes(schemaPath: string, outputPath: string): void {
  const schemaContent = readFileSync(schemaPath, "utf-8");
  const schema: CloudFormationSchema = JSON.parse(schemaContent);

  const definitions = schema.definitions || {};
  const output: string[] = [];

  output.push("// This file is auto-generated. Do not edit manually.");
  output.push(`// Source: ${basename(schemaPath)}`);
  output.push("");

  // Generate definition types first
  for (const [name, def] of Object.entries(definitions)) {
    output.push(generateDefinitionType(name, def, definitions));
  }

  // Generate main type
  output.push(generateMainType(schema.typeName, schema, definitions));

  writeFileSync(outputPath, output.join("\n"), "utf-8");
  console.log(`Generated ${outputPath}`);
}

if (import.meta.main) {
  generateCloudFormationTypes(process.argv[2], process.argv[3]);
}
