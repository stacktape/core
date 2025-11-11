#!/usr/bin/env bun

import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';

interface ImportInfo {
  from: string;
  imported: string[];
  isNamespaceImport: boolean;
}

interface FileAnalysis {
  usedFiles: Set<string>;
  usedExports: Map<string, Set<string>>;
  namespaceImports: Set<string>; // Files imported with * as
}

const getAllTsFiles = async (dir: string, baseDir: string = dir): Promise<string[]> => {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await getAllTsFiles(fullPath, baseDir));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }

  return files;
};

const parseImports = (content: string, filePath: string): ImportInfo[] => {
  const imports: ImportInfo[] = [];

  // Match various import patterns
  const importRegex = /import\s+(?:type\s+)?(?:(?:{([^}]+)})|(?:\*\s+as\s+(\w+))|(?:(\w+)))\s+from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const [, namedImports, namespaceImport, defaultImport, fromPath] = match;

    // Only process imports from @shared/ or relative paths to shared/
    if (!fromPath.startsWith('@shared/') && !fromPath.includes('/shared/')) {
      continue;
    }

    const imported: string[] = [];
    let isNamespaceImport = false;

    if (namespaceImport) {
      isNamespaceImport = true;
    } else if (namedImports) {
      // Parse named imports, handling aliases and type imports
      const names = namedImports.split(',').map(n => {
        const trimmed = n.trim();
        // Handle "type Foo", "Foo as Bar", "type Foo as Bar"
        const cleaned = trimmed.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        return cleaned;
      }).filter(Boolean);
      imported.push(...names);
    } else if (defaultImport) {
      imported.push('default');
    }

    imports.push({
      from: fromPath,
      imported,
      isNamespaceImport
    });
  }

  // Also match dynamic imports
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    const [, fromPath] = match;
    if (fromPath.startsWith('@shared/') || fromPath.includes('/shared/')) {
      imports.push({
        from: fromPath,
        imported: [],
        isNamespaceImport: true // Treat dynamic imports as using everything
      });
    }
  }

  return imports;
};

const resolveSharedPath = (importPath: string): string => {
  // Convert @shared/ to shared/
  if (importPath.startsWith('@shared/')) {
    return importPath.replace('@shared/', 'shared/');
  }

  // Handle relative paths (shouldn't be many)
  return importPath;
};

const analyzeUsage = async (): Promise<FileAnalysis> => {
  const analysis: FileAnalysis = {
    usedFiles: new Set<string>(),
    usedExports: new Map<string, Set<string>>(),
    namespaceImports: new Set<string>()
  };

  console.log('🔍 Scanning src/ and scripts/ for shared/ imports...');

  // Get all TS files from src/ and scripts/
  const srcFiles = await getAllTsFiles('c:\\Projects\\stacktape\\src');
  const scriptFiles = await getAllTsFiles('c:\\Projects\\stacktape\\scripts');
  const allFiles = [...srcFiles, ...scriptFiles];

  console.log(`📁 Found ${allFiles.length} TypeScript files to analyze`);

  // First pass: collect all imports from src/ and scripts/
  const importQueue: ImportInfo[] = [];

  for (const file of allFiles) {
    const content = await readFile(file, 'utf-8');
    const imports = parseImports(content, file);
    importQueue.push(...imports);
  }

  console.log(`📦 Found ${importQueue.length} imports from src/scripts to shared/`);

  // Process imports and handle transitive dependencies
  const processedFiles = new Set<string>();

  while (importQueue.length > 0) {
    const imp = importQueue.shift()!;
    const resolvedPath = resolveSharedPath(imp.from);

    // Add to used files
    analysis.usedFiles.add(resolvedPath);

    if (imp.isNamespaceImport) {
      analysis.namespaceImports.add(resolvedPath);
    } else {
      if (!analysis.usedExports.has(resolvedPath)) {
        analysis.usedExports.set(resolvedPath, new Set<string>());
      }
      imp.imported.forEach(name => analysis.usedExports.get(resolvedPath)!.add(name));
    }

    // Now check if this file itself imports other shared/ files (transitive deps)
    // Try both with and without .ts extension
    const possiblePaths = [
      `c:\\Projects\\stacktape\\${resolvedPath}`,
      `c:\\Projects\\stacktape\\${resolvedPath}.ts`,
      `c:\\Projects\\stacktape\\${resolvedPath}\\index.ts`
    ];

    for (const filePath of possiblePaths) {
      if (processedFiles.has(filePath)) continue;

      try {
        const content = await readFile(filePath, 'utf-8');
        processedFiles.add(filePath);

        const transitiveImports = parseImports(content, filePath);
        importQueue.push(...transitiveImports);
        break; // Found the file
      } catch (e) {
        // File doesn't exist with this extension, try next
        continue;
      }
    }
  }

  console.log(`✅ Analysis complete:`);
  console.log(`   - ${analysis.usedFiles.size} shared files are used`);
  console.log(`   - ${analysis.namespaceImports.size} files imported with namespace import (*)`);

  return analysis;
};

const findAllSharedFiles = async (): Promise<string[]> => {
  const files = await getAllTsFiles('c:\\Projects\\stacktape\\shared');
  return files.map(f => relative('c:\\Projects\\stacktape', f).replace(/\\/g, '/'));
};

const main = async () => {
  console.log('🚀 Starting shared/ usage analysis...\n');

  const analysis = await analyzeUsage();
  const allSharedFiles = await findAllSharedFiles();

  console.log(`\n📊 Total shared/ files: ${allSharedFiles.length}`);

  // Normalize paths for comparison
  const normalizedUsedFiles = new Set(
    Array.from(analysis.usedFiles).flatMap(f => {
      const normalized = f.replace(/\\/g, '/');
      return [
        normalized,
        normalized + '.ts',
        normalized + '/index.ts',
        normalized.replace(/\.ts$/, ''),
        normalized.replace(/\/index\.ts$/, '')
      ];
    })
  );

  // Find unused files
  const unusedFiles = allSharedFiles.filter(file => {
    const withoutExt = file.replace(/\.ts$/, '');
    return !normalizedUsedFiles.has(file) &&
           !normalizedUsedFiles.has(withoutExt) &&
           !normalizedUsedFiles.has(`@shared/${file.replace('shared/', '')}`) &&
           !normalizedUsedFiles.has(`@shared/${withoutExt.replace('shared/', '')}`);
  });

  console.log(`\n❌ Unused files (${unusedFiles.length}):`);
  unusedFiles.sort().forEach(f => console.log(`   - ${f}`));

  console.log(`\n✅ Used files (${allSharedFiles.length - unusedFiles.length}):`);
  allSharedFiles.filter(f => !unusedFiles.includes(f)).sort().forEach(f => {
    const normalized = f.replace(/\.ts$/, '').replace('shared/', '');
    const hasNamespaceImport = analysis.namespaceImports.has(`shared/${normalized}`) ||
                                analysis.namespaceImports.has(`@shared/${normalized}`);
    const marker = hasNamespaceImport ? ' [*]' : '';
    console.log(`   - ${f}${marker}`);
  });

  console.log('\n[*] = Imported with namespace import (all exports used)');

  // Save results to JSON for further processing
  const results = {
    unusedFiles,
    usedFiles: allSharedFiles.filter(f => !unusedFiles.includes(f)),
    namespaceImports: Array.from(analysis.namespaceImports),
    usedExports: Object.fromEntries(
      Array.from(analysis.usedExports.entries()).map(([k, v]) => [k, Array.from(v)])
    )
  };

  await Bun.write(
    'c:\\Projects\\stacktape\\scripts\\shared-usage-analysis.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n💾 Results saved to scripts/shared-usage-analysis.json');
};

main().catch(console.error);
