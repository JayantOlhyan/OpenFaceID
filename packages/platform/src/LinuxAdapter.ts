import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PlatformAdapter, type PlatformInfo, type DisplayInfo } from './PlatformAdapter.ts';
import { Logger } from '../../core/src/index.ts';

const execAsync = promisify(exec);

export class LinuxAdapter extends PlatformAdapter {
  private serviceName = 'openfaceid';

  public getPlatformInfo(): PlatformInfo {
    return {
      os: 'linux',
      release: os.release(),
      arch: os.arch(),
      isSupported: true,
      capabilities: {
        canLockScreen: true,
        canDetectLockState: true,
        canDetectIdleTime: true,
        hasHardwareBiometrics: false,
        hasSecureKeystore: true,
      },
    };
  }

  public async lockScreen(): Promise<boolean> {
    try {
      Logger.info('platform', 'Attempting lock via loginctl lock-session');
      await execAsync('loginctl lock-session');
      return true;
    } catch {
      try {
        Logger.info('platform', 'Fallback lock via xdg-screensaver lock');
        await execAsync('xdg-screensaver lock');
        return true;
      } catch (err) {
        Logger.error('platform', 'All Linux lock commands failed', { error: String(err) });
        return false;
      }
    }
  }

  public async isScreenLocked(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`loginctl show-session $(loginctl | grep $(whoami) | head -n1 | awk '{print $1}') -p LockedHint`);
      return stdout.includes('LockedHint=yes');
    } catch {
      try {
        const { stdout } = await execAsync('gnome-screensaver-command -q 2>/dev/null || xscreensaver-command -time 2>/dev/null');
        return stdout.toLowerCase().includes('active') || stdout.toLowerCase().includes('locked');
      } catch {
        return false;
      }
    }
  }

  public async getSystemIdleTimeMs(): Promise<number> {
    try {
      const { stdout } = await execAsync('xprintidle');
      const ms = parseInt(stdout.trim(), 10);
      return isNaN(ms) ? 0 : ms;
    } catch {
      return 0;
    }
  }

  public async checkCameraPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    try {
      await execAsync('test -r /dev/video0');
      return 'granted';
    } catch {
      return 'denied';
    }
  }

  public async requestCameraPermission(): Promise<boolean> {
    return true;
  }

  public async registerStartup(enable: boolean): Promise<boolean> {
    try {
      const desktopFile = `${os.homedir()}/.config/autostart/openfaceid.desktop`;
      if (enable) {
        const content = `[Desktop Entry]\nType=Application\nName=OpenFaceID\nExec=openfaceid\nHidden=false\nNoDisplay=false\nX-GNOME-Autostart-enabled=true\n`;
        await execAsync(`mkdir -p ${os.homedir()}/.config/autostart && echo "${content}" > ${desktopFile}`);
      } else {
        await execAsync(`rm -f ${desktopFile}`);
      }
      return true;
    } catch (err) {
      Logger.warn('platform', `Could not update Linux autostart: ${String(err)}`);
      return false;
    }
  }

  public async isStartupEnabled(): Promise<boolean> {
    try {
      await execAsync(`test -f ${os.homedir()}/.config/autostart/openfaceid.desktop`);
      return true;
    } catch {
      return false;
    }
  }

  public async getDisplayInfo(): Promise<DisplayInfo[]> {
    return [
      {
        id: 'primary-linux-display',
        width: 1920,
        height: 1080,
        isPrimary: true,
        scaleFactor: 1.0,
      },
    ];
  }

  public async showNotification(title: string, body: string): Promise<void> {
    try {
      const safeTitle = title.replace(/"/g, '\\"');
      const safeBody = body.replace(/"/g, '\\"');
      await execAsync(`notify-send "${safeTitle}" "${safeBody}"`);
    } catch (err) {
      Logger.warn('platform', 'Failed to send Linux desktop notification', { error: String(err) });
    }
  }

  public async storeSecret(key: string, secret: string): Promise<boolean> {
    try {
      const cmd = `echo -n "${secret}" | secret-tool store --label="OpenFaceID Secret" service "${this.serviceName}" key "${key}"`;
      await execAsync(cmd);
      return true;
    } catch {
      return false;
    }
  }

  public async retrieveSecret(key: string): Promise<string | null> {
    try {
      const cmd = `secret-tool lookup service "${this.serviceName}" key "${key}"`;
      const { stdout } = await execAsync(cmd);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  public async deleteSecret(key: string): Promise<boolean> {
    try {
      const cmd = `secret-tool clear service "${this.serviceName}" key "${key}"`;
      await execAsync(cmd);
      return true;
    } catch {
      return false;
    }
  }
}
