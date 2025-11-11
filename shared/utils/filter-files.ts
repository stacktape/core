import { extname, join } from 'node:path';
import { readdir, remove, stat } from 'fs-extra';

export const removeAllFilesWithExts = async ({ directory, exts }: { directory: string; exts: string[] }) => {
  const items = await readdir(directory);

  for (const item of items) {
    const subpath = join(directory, item);
    const stats = await stat(subpath);

    if (stats.isDirectory()) {
      await removeAllFilesWithExts({ directory: subpath, exts });
    } else if (exts.includes(extname(item).toLowerCase())) {
      await remove(subpath);
    }
  }
};
