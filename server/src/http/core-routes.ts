import type { Express, Request, Response } from 'express';
import { createProviderCatalog } from '../providers/catalog-service';

export function registerCoreRoutes(app: Express, getAuditResults: () => unknown): void {
  app.get('/api/audit', (_request: Request, response: Response) => {
    response.json(getAuditResults());
  });

  app.get('/api/provider-catalog', (_request: Request, response: Response) => {
    response.json(createProviderCatalog());
  });
}
