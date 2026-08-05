import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const defaultIo = { readFile, readdir, stat };

/**
 * Adds one directory tree to a content snapshot.
 *
 * Clean TypeScript builds replace dist trees while the watcher is traversing
 * them. ENOENT from readdir/stat/readFile therefore means "not in this
 * snapshot", not that the watcher is broken.
 */
export async function snapshotDirectory(
  directory,
  snapshot,
  previousSnapshot,
  isRelevant,
  io = defaultIo
) {
  let entries;
  try {
    entries = await io.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await snapshotDirectory(absolutePath, snapshot, previousSnapshot, isRelevant, io);
        return;
      }
      if (!entry.isFile() || !isRelevant(absolutePath)) return;

      try {
        const metadata = await io.stat(absolutePath);
        const metadataKey = `${metadata.mtimeMs}:${metadata.size}`;
        const previous = previousSnapshot.get(absolutePath);
        const digest =
          previous?.metadataKey === metadataKey
            ? previous.digest
            : createHash('sha256')
                .update(await io.readFile(absolutePath))
                .digest('base64url');
        snapshot.set(absolutePath, { metadataKey, digest });
      } catch (error) {
        if (error?.code === 'ENOENT') return;
        throw error;
      }
    })
  );
}
