#!/usr/bin/env bun

import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

const main = async () => {
  const analysisPath = 'c:\\Projects\\stacktape\\scripts\\shared-usage-analysis.json';

  if (!existsSync(analysisPath)) {
    console.error('❌ Analysis file not found. Run analyze-shared-usage.ts first.');
    process.exit(1);
  }

  const analysis = await Bun.file(analysisPath).json();
  const unusedFiles: string[] = analysis.unusedFiles;

  console.log(`🗑️  Removing ${unusedFiles.length} unused files from shared/...\n`);

  let removed = 0;
  let failed = 0;

  for (const file of unusedFiles) {
    const fullPath = `c:\\Projects\\stacktape\\${file}`;

    try {
      if (existsSync(fullPath)) {
        await unlink(fullPath);
        console.log(`✅ Removed: ${file}`);
        removed++;
      } else {
        console.log(`⚠️  Not found: ${file}`);
      }
    } catch (error) {
      console.error(`❌ Failed to remove ${file}:`, error);
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   - Removed: ${removed} files`);
  console.log(`   - Failed: ${failed} files`);
  console.log(`\n✨ Cleanup complete!`);
};

main().catch(console.error);
