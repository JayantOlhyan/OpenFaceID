import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getPlatformAdapter } from '../../platform/src/index.ts';
import { Logger } from '../../core/src/index.ts';

export class KeyringManager {
  private static readonly KEY_NAME = 'master_biometric_key';
  private static cachedSecret: string | null = null;

  public static async getOrCreateMasterSecret(): Promise<string> {
    if (this.cachedSecret) {
      return this.cachedSecret;
    }

    const adapter = getPlatformAdapter();

    try {
      // 1. Try to retrieve existing secret from OS Keystore
      const existing = await adapter.retrieveSecret(this.KEY_NAME);
      if (existing && existing.length >= 32) {
        Logger.info('security', 'Master encryption key retrieved from OS secure keystore');
        this.cachedSecret = existing;
        return existing;
      }
    } catch {
      // Handled below
    }

    // 2. Check local fallback secure keyfile if OS Keystore denied / unavailable
    const fallbackPath = this.getFallbackKeyPath();
    try {
      if (fs.existsSync(fallbackPath)) {
        const fileKey = fs.readFileSync(fallbackPath, 'utf8').trim();
        if (fileKey && fileKey.length >= 32) {
          Logger.info('security', 'Master encryption key retrieved from local secure keyfile');
          this.cachedSecret = fileKey;
          return fileKey;
        }
      }
    } catch {
      // Handled below
    }

    // 3. Generate new 256-bit cryptographically random secret
    const newSecret = crypto.randomBytes(32).toString('hex');
    let storedInKeystore = false;
    try {
      storedInKeystore = await adapter.storeSecret(this.KEY_NAME, newSecret);
    } catch {
      storedInKeystore = false;
    }

    if (storedInKeystore) {
      Logger.info('security', 'New master encryption key generated and sealed in OS keystore');
    } else {
      Logger.warn('security', 'OS keystore unavailable; saving to secure fallback keyfile');
      try {
        const dir = path.dirname(fallbackPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        }
        fs.writeFileSync(fallbackPath, newSecret, { encoding: 'utf8', mode: 0o600 });
      } catch (err) {
        Logger.error('security', 'Could not write fallback keyfile, using memory cache only', { error: String(err) });
      }
    }

    this.cachedSecret = newSecret;
    return newSecret;
  }

  public static clearCache(): void {
    this.cachedSecret = null;
  }

  private static getFallbackKeyPath(): string {
    const homeDir = os.homedir();
    const primary = path.join(homeDir, '.openfaceid', '.master_key');
    try {
      const dir = path.join(homeDir, '.openfaceid');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      return primary;
    } catch {
      return path.join(os.tmpdir(), '.openfaceid', '.master_key');
    }
  }
}
