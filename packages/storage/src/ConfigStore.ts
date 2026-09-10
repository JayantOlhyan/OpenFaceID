import fs from 'fs';
import path from 'path';
import os from 'os';
import { type AppConfig, DEFAULT_CONFIG, ConfigValidator, Logger } from '../../core/src/index.ts';

export class ConfigStore {
  private filePath: string;

  constructor(customPath?: string) {
    this.filePath = customPath || path.join(os.homedir(), '.openfaceid', 'config.json');
    this.ensureFileExists();
  }

  private ensureFileExists(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify(DEFAULT_CONFIG, null, 2), { mode: 0o600 });
      }
    } catch {
      this.filePath = path.join(os.tmpdir(), '.openfaceid', 'config.json');
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify(DEFAULT_CONFIG, null, 2));
      }
    }
  }

  public loadConfig(): AppConfig {
    try {
      this.ensureFileExists();
      const content = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(content);
      const res = ConfigValidator.validate(parsed);
      return res.config;
    } catch (err) {
      Logger.warn('storage', 'Config file unreadable or corrupt, using defaults', { error: String(err) });
      return DEFAULT_CONFIG;
    }
  }

  public saveConfig(newConfig: Partial<AppConfig>): boolean {
    try {
      const current = this.loadConfig();
      const merged = { ...current, ...newConfig };
      const res = ConfigValidator.validate(merged);

      if (!res.valid) {
        Logger.error('storage', 'Configuration validation failed', { errors: res.errors });
        return false;
      }

      fs.writeFileSync(this.filePath, JSON.stringify(res.config, null, 2), { mode: 0o600 });
      Logger.info('storage', 'Configuration successfully updated and persisted');
      return true;
    } catch (err) {
      Logger.error('storage', 'Failed to write config file', { error: String(err) });
      return false;
    }
  }
}
