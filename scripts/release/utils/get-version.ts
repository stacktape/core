import { join } from 'node:path';
import { writeFile } from 'fs-extra';
import { getVersion } from './args';

const main = async () => {
  const version = await getVersion();

  // Write version to file for GitHub Actions to read
  await writeFile(join(process.cwd(), '.release-version'), version, 'utf-8');

  console.info(`Version: ${version}`);
};

if (import.meta.main) {
  main().catch((error) => {
    console.error('Error getting version:', error);
    process.exit(1);
  });
}
