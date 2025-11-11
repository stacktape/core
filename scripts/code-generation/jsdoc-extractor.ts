/**
 * Utilities for extracting JSDoc comments from TypeScript source files
 */

import type { JSDocComment, PropertyInfo } from './types';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as ts from 'typescript';

/**
 * Extracts JSDoc comment from a TypeScript node
 */
function extractJSDocFromNode(node: ts.Node, sourceFile: ts.SourceFile): JSDocComment | undefined {
  const jsDocTags = ts.getJSDocTags(node);
  const jsDocComments = ts.getJSDocCommentsAndTags(node);

  if (jsDocComments.length === 0) {
    return undefined;
  }

  const firstComment = jsDocComments[0];
  if (!ts.isJSDoc(firstComment)) {
    return undefined;
  }

  const description = firstComment.comment
    ? typeof firstComment.comment === 'string'
      ? firstComment.comment
      : firstComment.comment.map((part) => part.text).join('')
    : '';

  const tags = jsDocTags.map((tag) => ({
    tag: tag.tagName.text,
    value: tag.comment ? (typeof tag.comment === 'string' ? tag.comment : tag.comment.map((p) => p.text).join('')) : ''
  }));

  return {
    description: description.trim(),
    tags
  };
}

/**
 * Finds a property in an interface and extracts its information
 */
function findPropertyInInterface(
  interfaceName: string,
  propertyName: string,
  sourceFile: ts.SourceFile
): PropertyInfo | undefined {
  let result: PropertyInfo | undefined;

  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          if (member.name.text === propertyName) {
            const type = member.type ? member.type.getText(sourceFile) : 'any';
            const optional = member.questionToken !== undefined;
            const jsdoc = extractJSDocFromNode(member, sourceFile);

            result = {
              name: propertyName,
              type,
              optional,
              jsdoc
            };
            return;
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}

/**
 * Cache for parsed source files to avoid re-parsing
 */
const sourceFileCache = new Map<string, ts.SourceFile>();

/**
 * Gets a TypeScript source file, using cache if available
 */
function getSourceFile(filePath: string): ts.SourceFile | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  if (sourceFileCache.has(filePath)) {
    return sourceFileCache.get(filePath);
  }

  const content = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  sourceFileCache.set(filePath, sourceFile);

  return sourceFile;
}

/**
 * Extracts property information (including JSDoc) from a type definition
 * @param typeName - The name of the type/interface (e.g., 'LambdaFunctionProps')
 * @param propertyName - The name of the property (e.g., 'connectTo')
 * @param searchPaths - Paths to search for the type definition
 */
export function extractPropertyInfo(
  typeName: string,
  propertyName: string,
  searchPaths: string[]
): PropertyInfo | undefined {
  for (const searchPath of searchPaths) {
    const sourceFile = getSourceFile(searchPath);
    if (!sourceFile) {
      continue;
    }

    const propertyInfo = findPropertyInInterface(typeName, propertyName, sourceFile);
    if (propertyInfo) {
      return propertyInfo;
    }
  }

  return undefined;
}

/**
 * Formats a JSDoc comment for code generation
 */
export function formatJSDoc(jsdoc: JSDocComment, indent: string = '  '): string {
  const lines: string[] = [];

  lines.push(`${indent}/**`);

  if (jsdoc.description) {
    // Split description into lines and add proper indentation
    const descriptionLines = jsdoc.description.split('\n');
    for (const line of descriptionLines) {
      lines.push(`${indent} * ${line}`);
    }
  }

  // Add tags if any
  for (const tag of jsdoc.tags) {
    if (tag.value) {
      lines.push(`${indent} * @${tag.tag} ${tag.value}`);
    } else {
      lines.push(`${indent} * @${tag.tag}`);
    }
  }

  lines.push(`${indent} */`);

  return lines.join('\n');
}

/**
 * Gets property info with JSDoc from SDK types
 * Searches common locations for SDK type definitions
 */
export function getSDKPropertyInfo(typeName: string, propertyName: string): PropertyInfo | undefined {
  const basePath = join(process.cwd(), 'types', 'stacktape-config');

  // Map type names to their likely file locations
  const typeFileMap: Record<string, string> = {
    LambdaFunctionProps: 'functions.d.ts',
    WebServiceProps: 'web-services.d.ts',
    PrivateServiceProps: 'private-services.d.ts',
    WorkerServiceProps: 'worker-services.d.ts',
    ContainerWorkloadProps: 'multi-container-workloads.d.ts',
    BatchJobProps: 'batch-jobs.d.ts',
    StateMachineProps: 'state-machines.d.ts',
    LocalScriptProps: 'scripts.d.ts',
    BastionScriptProps: 'scripts.d.ts',
    LocalScriptWithBastionTunnelingProps: 'scripts.d.ts'
  };

  const searchPaths: string[] = [];

  // Add specific file if we know it
  const specificFile = typeFileMap[typeName];
  if (specificFile) {
    searchPaths.push(join(basePath, specificFile));
  }

  // Also search common files
  searchPaths.push(join(basePath, '__helpers.d.ts'), join(basePath, 'services.d.ts'), join(basePath, 'packaging.d.ts'));

  return extractPropertyInfo(typeName, propertyName, searchPaths);
}
