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

export abstract class PlatformAdapter {
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
  
  // Secure Keystore operations
  public abstract storeSecret(key: string, secret: string): Promise<boolean>;
  public abstract retrieveSecret(key: string): Promise<string | null>;
  public abstract deleteSecret(key: string): Promise<boolean>;
}
