#!/usr/bin/env bun

import { readFile } from 'fs/promises';
import * as ts from 'typescript';

interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'type' | 'interface' | 'const' | 'enum';
}

interface FileExports {
  filePath: string;
  exports: ExportInfo[];
}

const getExportsFromFile = async (filePath: string): Promise<ExportInfo[]> => {
  const content = await readFile(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

  const exports: ExportInfo[] = [];

  const visit = (node: ts.Node) => {
    // Check for export declarations
    if (ts.isExportDeclaration(node)) {
      // export { foo, bar } from './other'
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach(element => {
          exports.push({
            name: element.name.text,
            type: 'const' // We don't know the exact type for re-exports
          });
        });
      }
    } else if (ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (node.name) {
        exports.push({ name: node.name.text, type: 'function' });
      }
    } else if (ts.isClassDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (node.name) {
        exports.push({ name: node.name.text, type: 'class' });
      }
    } else if (ts.isInterfaceDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      exports.push({ name: node.name.text, type: 'interface' });
    } else if (ts.isTypeAliasDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      exports.push({ name: node.name.text, type: 'type' });
    } else if (ts.isEnumDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      exports.push({ name: node.name.text, type: 'enum' });
    } else if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      node.declarationList.declarations.forEach(decl => {
        if (ts.isIdentifier(decl.name)) {
          exports.push({ name: decl.name.text, type: 'const' });
        }
      });
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return exports;
};

const main = async () => {
  console.log('🔍 Analyzing exports in remaining shared/ files...\n');

  const analysisPath = 'c:\\Projects\\stacktape\\scripts\\shared-usage-analysis.json';
  const analysis = await Bun.file(analysisPath).json();

  const usedFiles: string[] = analysis.usedFiles;
  const usedExports: Record<string, string[]> = analysis.usedExports;

  console.log(`📁 Analyzing ${usedFiles.length} files for unused exports...\n`);

  const results: Array<{
    file: string;
    unusedExports: string[];
    totalExports: number;
  }> = [];

  for (const file of usedFiles) {
    const fullPath = `c:\\Projects\\stacktape\\${file}`;

    try {
      const fileExports = await getExportsFromFile(fullPath);

      if (fileExports.length === 0) {
        continue; // No exports
      }

      // Get the import path variations for this file
      const pathVariants = [
        file,
        file.replace(/\.ts$/, ''),
        file.replace('shared/', '@shared/'),
        file.replace('shared/', '@shared/').replace(/\.ts$/, ''),
        `shared/${file.replace('shared/', '')}`,
        `shared/${file.replace('shared/', '').replace(/\.ts$/, '')}`
      ];

      // Find which exports are actually used
      const usedExportsForFile = new Set<string>();
      for (const variant of pathVariants) {
        if (usedExports[variant]) {
          usedExports[variant].forEach(exp => usedExportsForFile.add(exp));
        }
      }

      // If 'default' is imported, we can't determine which exports are used
      if (usedExportsForFile.has('default') || usedExportsForFile.size === 0) {
        // Assume all exports are used (conservative approach)
        continue;
      }

      const unusedExports = fileExports
        .map(exp => exp.name)
        .filter(name => !usedExportsForFile.has(name));

      if (unusedExports.length > 0) {
        results.push({
          file,
          unusedExports,
          totalExports: fileExports.length
        });
      }
    } catch (error) {
      console.error(`⚠️  Error analyzing ${file}:`, error instanceof Error ? error.message : error);
    }
  }

  // Sort by number of unused exports
  results.sort((a, b) => b.unusedExports.length - a.unusedExports.length);

  console.log(`\n📊 Found ${results.length} files with unused exports:\n`);

  for (const result of results) {
    console.log(`📄 ${result.file}`);
    console.log(`   Total exports: ${result.totalExports}`);
    console.log(`   Unused exports (${result.unusedExports.length}):`);
    result.unusedExports.forEach(exp => console.log(`      - ${exp}`));
    console.log();
  }

  // Save results
  await Bun.write(
    'c:\\Projects\\stacktape\\scripts\\unused-exports-analysis.json',
    JSON.stringify(results, null, 2)
  );

  console.log('💾 Results saved to scripts/unused-exports-analysis.json');
};

main().catch(console.error);
