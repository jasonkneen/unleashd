import fs from 'node:fs';
import path from 'node:path';
import { type UIState, UIStateSchema } from '@unleashd/shared';
import type { Express, Request, Response } from 'express';

export interface Settings {
  colorPalette: string;
  ignore: string[];
}

const DEFAULT_SETTINGS: Settings = {
  colorPalette: 'solarized',
  ignore: [],
};

export class PersistedServerState {
  private readonly settingsFile: string;
  private readonly uiStateFile: string;
  private settings: Settings | null = null;
  private uiState: Record<string, unknown> = {};
  private uiStateSyncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly dataDirectory: string,
    private readonly applyIgnorePatterns: (patterns: string[]) => void
  ) {
    this.settingsFile = path.join(dataDirectory, 'settings.json');
    this.uiStateFile = path.join(dataDirectory, 'ui-state.json');
  }

  async initialize(): Promise<void> {
    await Promise.all([this.initializeSettings(), this.initializeUIState()]);
  }

  getSettings(): Settings {
    if (!this.settings) {
      throw new Error('Settings cache not initialized — call initialize() at startup');
    }
    return this.settings;
  }

  getUIState(): UIState {
    return UIStateSchema.parse(this.uiState);
  }

  registerRoutes(app: Express): void {
    app.get('/api/settings', (_req: Request, res: Response) => {
      res.json(this.getSettings());
    });
    app.post('/api/settings', (req: Request, res: Response) => {
      const settings = { ...this.getSettings(), ...req.body };
      this.writeSettings(settings);
      res.json(settings);
    });
    app.get('/api/ui-state', (_req: Request, res: Response) => {
      res.json(this.getUIState());
    });
    app.post('/api/ui-state', (req: Request, res: Response) => {
      this.setUIState(req.body);
      res.json({ ok: true });
    });
  }

  flushUIStateSync(): void {
    if (!this.uiStateSyncTimer) return;
    clearTimeout(this.uiStateSyncTimer);
    this.uiStateSyncTimer = null;
    try {
      fs.mkdirSync(this.dataDirectory, { recursive: true });
      fs.writeFileSync(this.uiStateFile, JSON.stringify(this.uiState, null, 2));
    } catch (error) {
      console.error('Error flushing UI state on shutdown:', error);
    }
  }

  private async initializeSettings(): Promise<void> {
    try {
      const data = await fs.promises.readFile(this.settingsFile, 'utf-8');
      this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      console.log('Settings loaded from disk');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`Failed to load settings: ${(error as Error).message}`);
      }
      this.settings = { ...DEFAULT_SETTINGS };
      console.log('Settings file not found, using defaults');
    }
    this.applyIgnorePatterns(this.getSettings().ignore ?? []);
  }

  private async initializeUIState(): Promise<void> {
    try {
      const data = await fs.promises.readFile(this.uiStateFile, 'utf-8');
      this.uiState = JSON.parse(data);
      console.log('UI state loaded from disk');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Failed to load UI state: ${(error as Error).message}`);
      } else {
        console.log('UI state file not found, using defaults');
      }
      this.uiState = {};
    }
  }

  private writeSettings(settings: Settings): void {
    this.settings = settings;
    this.applyIgnorePatterns(settings.ignore ?? []);
    void fs.promises
      .mkdir(this.dataDirectory, { recursive: true })
      .then(() => fs.promises.writeFile(this.settingsFile, JSON.stringify(settings, null, 2)))
      .catch((error) => console.error('Error saving settings to disk:', error));
  }

  private setUIState(partial: Record<string, unknown>): void {
    this.uiState = { ...this.uiState, ...partial };
    if (this.uiStateSyncTimer) clearTimeout(this.uiStateSyncTimer);
    this.uiStateSyncTimer = setTimeout(() => {
      this.uiStateSyncTimer = null;
      void fs.promises
        .mkdir(this.dataDirectory, { recursive: true })
        .then(() => fs.promises.writeFile(this.uiStateFile, JSON.stringify(this.uiState, null, 2)))
        .catch((error) => console.error('Error saving UI state to disk:', error));
    }, 500);
  }
}
