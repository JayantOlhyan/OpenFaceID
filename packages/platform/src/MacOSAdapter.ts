import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PlatformAdapter, type PlatformInfo, type DisplayInfo } from './PlatformAdapter.ts';
import { Logger } from '../../core/src/index.ts';

const execAsync = promisify(exec);

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
      await execAsync('/usr/bin/pmset displaysleepnow');
      return true;
    } catch (err) {
      Logger.error('platform', 'Failed to lock macOS screen via pmset, attempting AppleScript fallback', { error: String(err) });
      try {
        await execAsync(`osascript -e 'tell application "System Events" to sleep'`);
        return true;
      } catch (fallbackErr) {
        Logger.error('platform', 'AppleScript lock fallback also failed', { error: String(fallbackErr) });
        return false;
      }
    }
  }

  public async isScreenLocked(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`/usr/sbin/ioreg -n Root -d1 -a`);
      return stdout.includes('CGSSessionScreenIsLocked') || stdout.includes('"CGSSessionScreenIsLocked" = 1');
    } catch (err) {
      Logger.debug('platform', 'Error checking macOS screen lock state', { error: String(err) });
      return false;
    }
  }

  public async getSystemIdleTimeMs(): Promise<number> {
    try {
      const { stdout } = await execAsync(`/usr/sbin/ioreg -c IOHIDSystem`);
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
      const cmd = enable
        ? `osascript -e 'tell application "System Events" to make login item at end with properties {name: "${appName}", path: "/Applications/${appName}.app", hidden: false}'`
        : `osascript -e 'tell application "System Events" to delete login item "${appName}"'`;
      await execAsync(cmd);
      return true;
    } catch (err) {
      Logger.warn('platform', `Could not update macOS login item: ${String(err)}`);
      return false;
    }
  }

  public async isStartupEnabled(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`osascript -e 'tell application "System Events" to get the name of every login item'`);
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
    try {
      const safeTitle = title.replace(/"/g, '\\"');
      const safeBody = body.replace(/"/g, '\\"');
      await execAsync(`osascript -e 'display notification "${safeBody}" with title "${safeTitle}"'`);
    } catch (err) {
      Logger.warn('platform', 'Failed to display macOS notification', { error: String(err) });
    }
  }

  public async storeSecret(key: string, secret: string): Promise<boolean> {
    try {
      const cmd = `/usr/bin/security add-generic-password -U -s "${this.serviceName}" -a "${key}" -w "${secret}"`;
      await execAsync(cmd);
      return true;
    } catch (err) {
      Logger.error('security', `Keychain storeSecret failed for key ${key}`, { error: String(err) });
      return false;
    }
  }

  public async retrieveSecret(key: string): Promise<string | null> {
    try {
      const cmd = `/usr/bin/security find-generic-password -s "${this.serviceName}" -a "${key}" -w`;
      const { stdout } = await execAsync(cmd);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  public async deleteSecret(key: string): Promise<boolean> {
    try {
      const cmd = `/usr/bin/security delete-generic-password -s "${this.serviceName}" -a "${key}"`;
      await execAsync(cmd);
      return true;
    } catch {
      return false;
    }
  }
}
