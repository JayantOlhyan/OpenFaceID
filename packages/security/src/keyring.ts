import crypto from 'crypto';
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

      // 2. Generate new 256-bit cryptographically random secret
      const newSecret = crypto.randomBytes(32).toString('hex');
      const stored = await adapter.storeSecret(this.KEY_NAME, newSecret);

      if (stored) {
        Logger.info('security', 'New master encryption key generated and sealed in OS keystore');
      } else {
        Logger.warn('security', 'OS keystore unavailable; using secure in-memory fallback secret');
      }

      this.cachedSecret = newSecret;
      return newSecret;
    } catch (err) {
      Logger.error('security', 'Failed to interface with OS keyring, using process-local secret', {
        error: String(err),
      });
      const ephemeral = crypto.randomBytes(32).toString('hex');
      this.cachedSecret = ephemeral;
      return ephemeral;
    }
  }

  public static clearCache(): void {
    this.cachedSecret = null;
  }
}
