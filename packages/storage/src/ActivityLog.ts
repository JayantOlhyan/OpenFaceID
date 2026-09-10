import fs from 'fs';
import path from 'path';
import os from 'os';
import { Logger } from '../../core/src/index.ts';

export interface ActivityEntry {
  id: string;
  timestamp: number;
  type: 'MATCH' | 'DENIED' | 'PRESENCE' | 'ABSENCE' | 'LOCK' | 'SYSTEM';
  identityName?: string;
  confidence?: number;
  description: string;
}

export class ActivityLog {
  private filePath: string;
  private autoDeleteDays: number;
  private enabled: boolean;

  constructor(customPath?: string, autoDeleteDays: number = 7, enabled: boolean = true) {
    this.filePath = customPath || path.join(os.homedir(), '.openfaceid', 'activity.json');
    this.autoDeleteDays = autoDeleteDays;
    this.enabled = enabled;
    this.ensureFileExists();
  }

  private ensureFileExists(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify([]), { mode: 0o600 });
      }
    } catch {
      this.filePath = path.join(os.tmpdir(), '.openfaceid', 'activity.json');
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify([]));
      }
    }
  }

  public addEntry(entry: Omit<ActivityEntry, 'id' | 'timestamp'>): void {
    if (!this.enabled) return;

    try {
      const entries = this.getEntries();
      const newRecord: ActivityEntry = {
        id: Math.random().toString(36).substring(2, 10),
        timestamp: Date.now(),
        ...entry,
      };

      entries.unshift(newRecord);

      // Prune records older than autoDeleteDays
      const maxAgeMs = this.autoDeleteDays * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const filtered = entries.filter((e) => now - e.timestamp <= maxAgeMs);

      fs.writeFileSync(this.filePath, JSON.stringify(filtered, null, 2));
    } catch (err) {
      Logger.error('storage', 'Failed to append activity log entry', { error: String(err) });
    }
  }

  public getEntries(): ActivityEntry[] {
    try {
      this.ensureFileExists();
      const content = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(content) as ActivityEntry[];
    } catch {
      return [];
    }
  }

  public clear(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify([]));
      Logger.info('storage', 'Activity log cleared by user');
    } catch (err) {
      Logger.error('storage', 'Failed to clear activity log', { error: String(err) });
    }
  }
}
