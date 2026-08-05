import { access } from 'node:fs/promises';

/**
 * Returns the runtime artifacts that are not currently readable.
 *
 * Clean package builds remove their dist directory before rebuilding it. The
 * development backend imports these packages from dist, so a reload must wait
 * until the complete package entrypoint set exists again.
 */
export async function missingRuntimeArtifacts(paths, check = access) {
  const missing = [];
  await Promise.all(
    paths.map(async (file) => {
      try {
        await check(file);
      } catch (error) {
        if (error?.code === 'ENOENT') {
          missing.push(file);
          return;
        }
        throw error;
      }
    })
  );
  return missing.sort();
}
