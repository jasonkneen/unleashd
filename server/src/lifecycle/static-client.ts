import path from 'node:path';
import express, { type Express, type Request, type Response } from 'express';

export function registerStaticClient(app: Express, clientDirectory: string): void {
  app.use(express.static(clientDirectory));
  app.get('*', (_request: Request, response: Response) => {
    response.sendFile(path.join(clientDirectory, 'index.html'));
  });
}
