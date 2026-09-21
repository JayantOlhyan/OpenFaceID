import os from 'os';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PlatformAdapter, type PlatformInfo, type DisplayInfo } from './PlatformAdapter.ts';
import { Logger } from '../../core/src/index.ts';

const execFileAsync = promisify(execFile);

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
      await execFileAsync('loginctl', ['lock-session']);
      return true;
    } catch {
      try {
        Logger.info('platform', 'Fallback lock via xdg-screensaver lock');
        await execFileAsync('xdg-screensaver', ['lock']);
        return true;
      } catch (err) {
        Logger.error('platform', 'All Linux lock commands failed', { error: String(err) });
        return false;
      }
    }
  }

  public async isScreenLocked(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('loginctl', ['show-session', 'self', '-p', 'LockedHint']);
      return stdout.includes('LockedHint=yes');
    } catch {
      try {
        const { stdout } = await execFileAsync('gnome-screensaver-command', ['-q']);
        return stdout.toLowerCase().includes('active') || stdout.toLowerCase().includes('locked');
      } catch {
        return false;
      }
    }
  }

  public async getSystemIdleTimeMs(): Promise<number> {
    try {
      const { stdout } = await execFileAsync('xprintidle', []);
      const ms = parseInt(stdout.trim(), 10);
      return isNaN(ms) ? 0 : ms;
    } catch {
      return 0;
    }
  }

  public async checkCameraPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    try {
      await fs.promises.access('/dev/video0', fs.constants.R_OK);
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
      const autostartDir = path.join(os.homedir(), '.config', 'autostart');
      const desktopFile = path.join(autostartDir, 'openfaceid.desktop');
      if (enable) {
        const content = `[Desktop Entry]\nType=Application\nName=OpenFaceID\nExec=openfaceid\nHidden=false\nNoDisplay=false\nX-GNOME-Autostart-enabled=true\n`;
        await fs.promises.mkdir(autostartDir, { recursive: true, mode: 0o700 });
        await fs.promises.writeFile(desktopFile, content, { mode: 0o644 });
      } else {
        if (fs.existsSync(desktopFile)) {
          await fs.promises.unlink(desktopFile);
        }
      }
      return true;
    } catch (err) {
      Logger.warn('platform', `Could not update Linux autostart: ${String(err)}`);
      return false;
    }
  }

  public async isStartupEnabled(): Promise<boolean> {
    try {
      const desktopFile = path.join(os.homedir(), '.config', 'autostart', 'openfaceid.desktop');
      return fs.existsSync(desktopFile);
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
    if (this.shouldThrottleNotification(title, body)) return;
    try {
      await execFileAsync('notify-send', [title, body]);
    } catch (err) {
      Logger.warn('platform', 'Failed to send Linux desktop notification', { error: String(err) });
    }
  }

  public async storeSecret(key: string, secret: string): Promise<boolean> {
    try {
      const child = execFile('secret-tool', [
        'store',
        '--label=OpenFaceID Secret',
        'service',
        this.serviceName,
        'key',
        key,
      ]);
      if (child.stdin) {
        child.stdin.write(secret);
        child.stdin.end();
      }
      await new Promise<void>((resolve, reject) => {
        child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
        child.on('error', reject);
      });
      return true;
    } catch {
      return false;
    }
  }

  public async retrieveSecret(key: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('secret-tool', [
        'lookup',
        'service',
        this.serviceName,
        'key',
        key,
      ]);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  public async deleteSecret(key: string): Promise<boolean> {
    try {
      await execFileAsync('secret-tool', [
        'clear',
        'service',
        this.serviceName,
        'key',
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

      if (elapsed > 3000) {
        Logger.info('platform', `Hardware sleep/wake detected (slept for ~${Math.round(elapsed / 1000)}s)`);
        this.sessionEventListener?.('wake');
      }

      const isLocked = await this.isScreenLocked();
      if (isLocked !== this.lastSessionLockedState) {
        this.lastSessionLockedState = isLocked;
        if (isLocked) {
          Logger.info('platform', 'Linux session locked');
          this.sessionEventListener?.('lock');
        } else {
          Logger.info('platform', 'Linux session unlocked');
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

  private pamServer: net.Server | null = null;
  public static readonly PAM_SOCKET_PATH = '/run/openfaceid/auth.sock';
  public static readonly DEV_PAM_SOCKET_PATH = '/tmp/openfaceid-auth.sock';

  public startPamSocketServer(authHandler: (username: string) => Promise<boolean>): void {
    this.stopPamSocketServer();
    const socketPath = process.getuid && process.getuid() === 0 ? LinuxAdapter.PAM_SOCKET_PATH : LinuxAdapter.DEV_PAM_SOCKET_PATH;

    try {
      if (fs.existsSync(socketPath)) {
        fs.unlinkSync(socketPath);
      }
    } catch {}

    try {
      this.pamServer = net.createServer((socket) => {
        let buffer = '';
        socket.on('data', async (chunk) => {
          buffer += chunk.toString();
          if (buffer.includes('\n')) {
            try {
              const req = JSON.parse(buffer.trim());
              const user = req.user || 'default_user';
              Logger.info('platform', `Received PAM auth challenge for user: ${user}`);
              const verified = await authHandler(user);
              if (verified) {
                socket.write(JSON.stringify({ status: 'AUTH_SUCCESS' }) + '\n');
              } else {
                socket.write(JSON.stringify({ status: 'AUTH_FAILED', reason: 'Biometric mismatch or liveness failure' }) + '\n');
              }
            } catch (err) {
              socket.write(JSON.stringify({ status: 'AUTH_ERROR', error: String(err) }) + '\n');
            }
            socket.end();
          }
        });
      });

      this.pamServer.listen(socketPath, () => {
        Logger.info('platform', `Linux PAM authentication socket listening on ${socketPath}`);
        try {
          fs.chmodSync(socketPath, 0o600);
        } catch {}
      });
    } catch (err) {
      Logger.warn('platform', 'Failed to bind PAM Unix domain socket', { error: String(err) });
    }
  }

  public stopPamSocketServer(): void {
    if (this.pamServer) {
      this.pamServer.close();
      this.pamServer = null;
    }
  }

  public override async unlockScreen(secret?: string): Promise<boolean> {
    if (process.env.OPENFACEID_MOCK_UNLOCK === '1' || process.env.NODE_ENV === 'test') {
      Logger.debug('platform', 'Mock screen unlock executed (test environment)');
      return true;
    }

    try {
      const isLocked = await this.isScreenLocked();
      if (!isLocked) {
        Logger.info('platform', 'Linux session is already unlocked; no action needed');
        return true;
      }

      // 1. Attempt loginctl session unlock (works if user has polkit privilege)
      try {
        await execFileAsync('loginctl', ['unlock-session']);
        Logger.info('platform', 'Linux session unlocked via loginctl unlock-session');
        return true;
      } catch (loginctlErr) {
        Logger.debug('platform', 'loginctl unlock-session not permitted, deferring to pam_openfaceid handshake');
      }

      // 2. Fallback to PAM socket readiness
      Logger.info('platform', 'Linux lock screen managed by pam_openfaceid module; awaiting PAM handshake on auth.sock');
      return true;
    } catch (err) {
      Logger.error('platform', 'Failed to unlock Linux session', { error: String(err) });
      return false;
    }
  }
}

