import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import multer from 'multer';
import { isPathWithin } from './path-utils';

export function registerUploadRoutes(app: Express, uploadsDirectory: string): void {
  const storage = multer.diskStorage({
    destination: (req, _file, callback) => {
      const conversationId = req.body.conversationId as string;
      if (!conversationId) {
        callback(new Error('conversationId is required'), '');
        return;
      }
      const directory = path.join(uploadsDirectory, conversationId);
      const resolved = path.resolve(directory);
      if (!isPathWithin(uploadsDirectory, resolved, { allowRoot: false })) {
        callback(new Error('Invalid conversationId'), '');
        return;
      }
      fs.mkdirSync(directory, { recursive: true });
      callback(null, directory);
    },
    filename: (_req, file, callback) => {
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      callback(null, `${Date.now()}_${sanitized}`);
    },
  });
  const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  app.post('/api/upload', upload.array('files', 20), (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }
    const result = files.map((file) => ({
      originalName: file.originalname,
      absolutePath: file.path,
      mimeType: file.mimetype,
      size: file.size,
    }));
    console.log(
      `[Upload] ${files.length} file(s) saved:`,
      result.map(({ absolutePath }) => absolutePath)
    );
    res.json({ files: result });
  });
}
