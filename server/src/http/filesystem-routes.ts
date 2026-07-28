import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import {
  HOME_DIRECTORY,
  displayPathWithHomeAlias,
  isPathWithin,
  normalizeDirectoryInput,
} from './path-utils';

export interface FilesystemRouteDependencies {
  uploadsDirectory: string;
  isUnderKnownProject: (resolvedPath: string) => boolean;
}

export function registerFilesystemRoutes(
  app: Express,
  dependencies: FilesystemRouteDependencies
): void {
  const { uploadsDirectory, isUnderKnownProject } = dependencies;

  app.get('/api/paths', async (req: Request, res: Response) => {
    const inputPath = typeof req.query.path === 'string' ? req.query.path : '';
    const trimmedInput = inputPath.trim();
    const useHomeAlias = trimmedInput.startsWith('~');

    if (!trimmedInput) {
      try {
        const entries = await fs.promises.readdir(HOME_DIRECTORY, { withFileTypes: true });
        res.json(
          entries
            .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
            .slice(0, 20)
            .map((entry) => ({
              name: entry.name,
              path: path.join(HOME_DIRECTORY, entry.name),
              isDirectory: true,
            }))
        );
      } catch {
        res.json([]);
      }
      return;
    }

    const normalizedPath = normalizeDirectoryInput(trimmedInput);
    if (!normalizedPath) {
      res.json([]);
      return;
    }
    const partialSegment = path.basename(normalizedPath);
    const includeHidden = partialSegment.startsWith('.');

    try {
      const stats = await fs.promises.stat(normalizedPath);
      if (stats.isDirectory()) {
        const entries = await fs.promises.readdir(normalizedPath, { withFileTypes: true });
        res.json(
          entries
            .filter(
              (entry) => entry.isDirectory() && (includeHidden || !entry.name.startsWith('.'))
            )
            .slice(0, 20)
            .map((entry) => ({
              name: entry.name,
              path: displayPathWithHomeAlias(path.join(normalizedPath, entry.name), useHomeAlias),
              isDirectory: true,
            }))
        );
        return;
      }
    } catch {
      // A partial path is handled by listing its parent below.
    }

    const parentDirectory = path.dirname(normalizedPath);
    const partial = partialSegment.toLowerCase();
    try {
      const stats = await fs.promises.stat(parentDirectory);
      if (stats.isDirectory()) {
        const entries = await fs.promises.readdir(parentDirectory, { withFileTypes: true });
        res.json(
          entries
            .filter(
              (entry) =>
                entry.isDirectory() &&
                (includeHidden || !entry.name.startsWith('.')) &&
                entry.name.toLowerCase().startsWith(partial)
            )
            .slice(0, 20)
            .map((entry) => ({
              name: entry.name,
              path: displayPathWithHomeAlias(path.join(parentDirectory, entry.name), useHomeAlias),
              isDirectory: true,
            }))
        );
        return;
      }
    } catch {
      // An invalid parent has no suggestions.
    }
    res.json([]);
  });

  app.get('/api/validate-path', async (req: Request, res: Response) => {
    const inputPath = typeof req.query.path === 'string' ? req.query.path : '';
    const trimmedInput = inputPath.trim();
    if (!trimmedInput) {
      res.json({ valid: false, error: 'Empty path' });
      return;
    }
    const resolvedPath = path.resolve(normalizeDirectoryInput(trimmedInput));
    try {
      const stats = await fs.promises.stat(resolvedPath);
      res.json(
        stats.isDirectory()
          ? {
              valid: true,
              path: displayPathWithHomeAlias(resolvedPath, trimmedInput.startsWith('~')),
            }
          : { valid: false, error: 'Path is not a directory' }
      );
    } catch {
      res.json({ valid: false, error: 'No matching folder' });
    }
  });

  app.post('/api/mkdir', async (req: Request, res: Response) => {
    const inputPath = typeof req.body?.path === 'string' ? req.body.path.trim() : '';
    if (!inputPath) {
      res.status(400).json({ error: 'Missing path' });
      return;
    }
    const resolvedPath = path.resolve(normalizeDirectoryInput(inputPath));
    try {
      await fs.promises.mkdir(resolvedPath, { recursive: true });
      res.json({
        path: displayPathWithHomeAlias(resolvedPath, inputPath.startsWith('~')),
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Failed to create directory' });
    }
  });

  const mayServe = (resolvedPath: string): boolean =>
    isUnderKnownProject(resolvedPath) || isPathWithin(uploadsDirectory, resolvedPath);

  app.get('/api/files', (req: Request, res: Response) => {
    const filePath = req.query.path as string;
    if (!filePath || !filePath.startsWith('/')) {
      res.status(400).json({ error: 'Absolute path required' });
      return;
    }
    const resolved = path.resolve(filePath);
    if (resolved !== path.normalize(filePath)) {
      res.status(400).json({ error: 'Path traversal rejected' });
      return;
    }
    if (!mayServe(resolved)) {
      res.status(403).json({ error: 'Path not under any known project' });
      return;
    }
    res.sendFile(resolved, (error) => {
      if (error && !res.headersSent) res.status(404).json({ error: 'File not found' });
    });
  });

  app.get('/api/serve/*', (req: Request, res: Response) => {
    const rawPath = `/${req.params[0]}`;
    const resolved = path.resolve(rawPath);
    if (resolved !== path.normalize(rawPath)) {
      res.status(400).json({ error: 'Path traversal rejected' });
      return;
    }
    if (!mayServe(resolved)) {
      res.status(403).json({ error: 'Path not under any known project' });
      return;
    }
    res.sendFile(resolved, (error) => {
      if (error && !res.headersSent) res.status(404).json({ error: 'File not found' });
    });
  });
}
