export interface PlatformInfo {
  os: 'macos' | 'windows' | 'linux' | 'unknown';
  release: string;
  arch: string;
  isSupported: boolean;
  capabilities: {
    canLockScreen: boolean;
    canDetectLockState: boolean;
    canDetectIdleTime: boolean;
    hasHardwareBiometrics: boolean;
    hasSecureKeystore: boolean;
  };
}

export interface DisplayInfo {
  id: string;
  width: number;
  height: number;
  isPrimary: boolean;
  scaleFactor: number;
}

export interface SecureStorageResult {
  success: boolean;
  data?: string;
  error?: string;
}

export type SessionEventType = 'wake' | 'lock' | 'unlock';
export type SessionEventListener = (event: SessionEventType) => void;

export abstract class PlatformAdapter {
  private static lastNotificationTime = new Map<string, number>();

  protected shouldThrottleNotification(title: string, body: string, windowMs = 8000): boolean {
    const key = `${title}:::${body}`;
    const now = Date.now();
    const last = PlatformAdapter.lastNotificationTime.get(key) || 0;
    if (now - last < windowMs) {
      return true;
    }
    PlatformAdapter.lastNotificationTime.set(key, now);
    return false;
  }

  public abstract getPlatformInfo(): PlatformInfo;
  public abstract lockScreen(): Promise<boolean>;
  public abstract isScreenLocked(): Promise<boolean>;
  public abstract getSystemIdleTimeMs(): Promise<number>;
  public abstract requestCameraPermission(): Promise<boolean>;
  public abstract checkCameraPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'>;
  public abstract registerStartup(enable: boolean): Promise<boolean>;
  public abstract isStartupEnabled(): Promise<boolean>;
  public abstract getDisplayInfo(): Promise<DisplayInfo[]>;
  public abstract showNotification(title: string, body: string): Promise<void>;
  
  // Event-Driven Wake & Lock Session Monitors
  public abstract startWakeAndLockListener(listener: SessionEventListener): void;
  public abstract stopWakeAndLockListener(): void;

  // Secure Keystore operations
  public abstract storeSecret(key: string, secret: string): Promise<boolean>;
  public abstract retrieveSecret(key: string): Promise<string | null>;
  public abstract deleteSecret(key: string): Promise<boolean>;

  // Screen Unlock & Credential Vault operations
  public async unlockScreen(secret?: string): Promise<boolean> {
    return false;
  }

  public async checkAccessibilityPermission(): Promise<boolean> {
    return true;
  }

  public async requestAccessibilityPermission(): Promise<void> {}

  public async storeCredential(user: string, secret: string): Promise<boolean> {
    const safeUser = user.replace(/[^a-zA-Z0-9_-]/g, '_');
    return this.storeSecret(`cred_${safeUser}`, secret);
  }

  public async retrieveCredential(user: string): Promise<string | null> {
    const safeUser = user.replace(/[^a-zA-Z0-9_-]/g, '_');
    return this.retrieveSecret(`cred_${safeUser}`);
  }

  public async deleteCredential(user: string): Promise<boolean> {
    const safeUser = user.replace(/[^a-zA-Z0-9_-]/g, '_');
    return this.deleteSecret(`cred_${safeUser}`);
  }
}

