import { join } from 'node:path';
import { chmod, readdir, rm, stat, unlink } from 'fs-extra';

export const forceRemoveWithRetry = async (dirPath: string) => {
  const maxRetries = 3;
  const retryDelay = 100; // ms

  async function retry(fn, retries = maxRetries) {
    try {
      return await fn();
    } catch (err) {
      if (retries > 0 && (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'ENOTEMPTY')) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return retry(fn, retries - 1);
      }
      throw err;
    }
  }

  async function removeItem(itemPath) {
    const stats = await retry(() => stat(itemPath));

    if (stats.isDirectory()) {
      const files = await retry(() => readdir(itemPath));

      for (const file of files) {
        await removeItem(join(itemPath, file));
      }

      await retry(() => rm(itemPath));
    } else {
      // First try to make the file writable
      await retry(() => chmod(itemPath, 0o666));
      await retry(() => unlink(itemPath));
    }
  }

  await removeItem(dirPath);
};
