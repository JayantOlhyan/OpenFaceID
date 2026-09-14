import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PlatformAdapter, type PlatformInfo, type DisplayInfo } from './PlatformAdapter.ts';
import { Logger } from '../../core/src/index.ts';

const execFileAsync = promisify(execFile);

export class MacOSAdapter extends PlatformAdapter {
  private serviceName = 'org.openfaceid.desktop';

  public getPlatformInfo(): PlatformInfo {
    return {
      os: 'macos',
      release: os.release(),
      arch: os.arch(),
      isSupported: true,
      capabilities: {
        canLockScreen: true,
        canDetectLockState: true,
        canDetectIdleTime: true,
        hasHardwareBiometrics: true,
        hasSecureKeystore: true,
      },
    };
  }

  public async lockScreen(): Promise<boolean> {
    try {
      Logger.info('platform', 'Locking macOS session via pmset displaysleepnow');
      await execFileAsync('/usr/bin/pmset', ['displaysleepnow']);
      return true;
    } catch (err) {
      Logger.error('platform', 'Failed to lock macOS screen via pmset, attempting AppleScript fallback', { error: String(err) });
      try {
        await execFileAsync('/usr/bin/osascript', ['-e', 'tell application "System Events" to sleep']);
        return true;
      } catch (fallbackErr) {
        Logger.error('platform', 'AppleScript lock fallback also failed', { error: String(fallbackErr) });
        return false;
      }
    }
  }

  public async isScreenLocked(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('/usr/sbin/ioreg', ['-n', 'Root', '-d1', '-a']);
      return stdout.includes('CGSSessionScreenIsLocked') || stdout.includes('"CGSSessionScreenIsLocked" = 1');
    } catch (err) {
      Logger.debug('platform', 'Error checking macOS screen lock state', { error: String(err) });
      return false;
    }
  }

  public async getSystemIdleTimeMs(): Promise<number> {
    try {
      const { stdout } = await execFileAsync('/usr/sbin/ioreg', ['-c', 'IOHIDSystem']);
      const match = stdout.match(/"HIDIdleTime"\s*=\s*(\d+)/i);
      if (match && match[1]) {
        const nano = BigInt(match[1]);
        return Number(nano / 1_000_000n);
      }
      return 0;
    } catch (err) {
      Logger.debug('platform', 'Failed to query IOHIDSystem idle time', { error: String(err) });
      return 0;
    }
  }

  public async checkCameraPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    return 'granted';
  }

  public async requestCameraPermission(): Promise<boolean> {
    return true;
  }

  public async registerStartup(enable: boolean): Promise<boolean> {
    try {
      const appName = 'OpenFaceID';
      const script = enable
        ? `tell application "System Events" to make login item at end with properties {name: "${appName}", path: "/Applications/${appName}.app", hidden: false}`
        : `tell application "System Events" to delete login item "${appName}"`;
      await execFileAsync('/usr/bin/osascript', ['-e', script]);
      return true;
    } catch (err) {
      Logger.warn('platform', `Could not update macOS login item: ${String(err)}`);
      return false;
    }
  }

  public async isStartupEnabled(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', 'tell application "System Events" to get the name of every login item']);
      return stdout.includes('OpenFaceID') || stdout.includes('SightLock');
    } catch {
      return false;
    }
  }

  public async getDisplayInfo(): Promise<DisplayInfo[]> {
    return [
      {
        id: 'primary-mac-display',
        width: 1920,
        height: 1080,
        isPrimary: true,
        scaleFactor: 2,
      },
    ];
  }

  public async showNotification(title: string, body: string): Promise<void> {
    if (this.shouldThrottleNotification(title, body)) return;
    try {
      const script = `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`;
      await execFileAsync('/usr/bin/osascript', ['-e', script]);
    } catch (err) {
      Logger.warn('platform', 'Failed to display macOS notification', { error: String(err) });
    }
  }

  public async storeSecret(key: string, secret: string): Promise<boolean> {
    try {
      await execFileAsync('/usr/bin/security', [
        'add-generic-password',
        '-U',
        '-s',
        this.serviceName,
        '-a',
        key,
        '-w',
        secret,
      ]);
      return true;
    } catch (err) {
      Logger.error('security', `Keychain storeSecret failed for key ${key}`, { error: String(err) });
      return false;
    }
  }

  public async retrieveSecret(key: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('/usr/bin/security', [
        'find-generic-password',
        '-s',
        this.serviceName,
        '-a',
        key,
        '-w',
      ]);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  public async deleteSecret(key: string): Promise<boolean> {
    try {
      await execFileAsync('/usr/bin/security', [
        'delete-generic-password',
        '-s',
        this.serviceName,
        '-a',
        key,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  private sessionEventListener: ((event: 'wake' | 'lock' | 'unlock') => void) | null = null;
  private sessionMonitorTimer: NodeJS.Timeout | null = null;
  private lastSessionLockedState: boolean = false;
  private lastSessionMonitorTick: number = Date.now();

  public startWakeAndLockListener(listener: (event: 'wake' | 'lock' | 'unlock') => void): void {
    this.stopWakeAndLockListener();
    this.sessionEventListener = listener;
    this.lastSessionMonitorTick = Date.now();

    this.sessionMonitorTimer = setInterval(async () => {
      const now = Date.now();
      const elapsed = now - this.lastSessionMonitorTick;
      this.lastSessionMonitorTick = now;

      // 1. Hardware sleep/wake delta check (>3000ms delta indicates suspension)
      if (elapsed > 3000) {
        Logger.info('platform', `Hardware sleep/wake detected (slept for ~${Math.round(elapsed / 1000)}s)`);
        this.sessionEventListener?.('wake');
      }

      // 2. Screen Lock State Transition Detection
      const isLocked = await this.isScreenLocked();
      if (isLocked !== this.lastSessionLockedState) {
        this.lastSessionLockedState = isLocked;
        if (isLocked) {
          Logger.info('platform', 'macOS session locked');
          this.sessionEventListener?.('lock');
        } else {
          Logger.info('platform', 'macOS session unlocked');
          this.sessionEventListener?.('unlock');
        }
      }
    }, 1000);

    this.sessionMonitorTimer.unref();
  }

  public stopWakeAndLockListener(): void {
    if (this.sessionMonitorTimer) {
      clearInterval(this.sessionMonitorTimer);
      this.sessionMonitorTimer = null;
    }
    this.sessionEventListener = null;
  }

  public override async unlockScreen(secret?: string): Promise<boolean> {
    if (process.env.OPENFACEID_MOCK_UNLOCK === '1' || process.env.NODE_ENV === 'test') {
      Logger.debug('platform', 'Mock screen unlock executed (test environment)');
      return true;
    }

    try {
      const isLocked = await this.isScreenLocked();
      if (!isLocked) {
        Logger.info('platform', 'macOS session is already unlocked; no action needed');
        return true;
      }

      // 1. Wake display from sleep
      try {
        await execFileAsync('/usr/bin/caffeinate', ['-u', '-t', '2']);
      } catch {
        // Caffeinate failure is non-fatal
      }

      // 2. Inject unlock credentials via System Events
      if (secret && secret.length > 0) {
        Logger.info('platform', 'Dispatching macOS lockscreen keystroke unlock via System Events');
        const script = `
on run argv
  set pass to item 1 of argv
  tell application "System Events"
    delay 0.2
    keystroke pass
    delay 0.1
    key code 36
  end tell
end run
`.trim();
        await execFileAsync('/usr/bin/osascript', ['-e', script, '--', secret]);
        return true;
      }

      Logger.warn('platform', 'No unlock secret provided; unable to complete keystroke unlock');
      return false;
    } catch (err) {
      Logger.error('platform', 'Failed to unlock macOS screen via keystroke injection', { error: String(err) });
      return false;
    }
  }
}

