import os from 'os';
import net from 'net';
import fs from 'fs';
import { execFile, spawn } from 'child_process';
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

  private pamServer: net.Server | null = null;
  private activePamSocketPath: string | null = null;
  public static readonly PAM_SOCKET_PATH = '/var/run/openfaceid/auth.sock';
  public static readonly DEV_PAM_SOCKET_PATH = '/tmp/openfaceid_auth.sock';

  public startPamSocketServer(authHandler: (username: string) => Promise<boolean>, customSocketPath?: string): void {
    this.stopPamSocketServer();
    const socketPath = customSocketPath || (process.getuid && process.getuid() === 0
      ? MacOSAdapter.PAM_SOCKET_PATH
      : (fs.existsSync('/var/run/openfaceid') ? MacOSAdapter.PAM_SOCKET_PATH : MacOSAdapter.DEV_PAM_SOCKET_PATH));

    this.activePamSocketPath = socketPath;

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
              const user = req.user || os.userInfo().username;
              Logger.info('platform', `Received macOS PAM auth challenge for user: ${user}`);
              const verified = await authHandler(user);
              if (verified) {
                socket.write(JSON.stringify({ status: 'AUTHORIZED', user }) + '\n');
              } else {
                socket.write(JSON.stringify({ status: 'DENIED', reason: 'Biometric mismatch or liveness failure' }) + '\n');
              }
            } catch (err) {
              socket.write(JSON.stringify({ status: 'DENIED', error: String(err) }) + '\n');
            }
            socket.end();
          }
        });
      });

      this.pamServer.on('error', (err: any) => {
        Logger.warn('platform', 'macOS PAM socket server error', { error: String(err) });
      });

      this.pamServer.listen(socketPath, () => {
        Logger.info('platform', `macOS PAM authentication socket listening on ${socketPath}`);
        try {
          fs.chmodSync(socketPath, 0o666);
        } catch {}
      });
      this.pamServer.unref();
    } catch (err) {
      Logger.warn('platform', 'Failed to bind macOS PAM Unix domain socket', { error: String(err) });
    }
  }

  public stopPamSocketServer(): void {
    if (this.pamServer) {
      try {
        this.pamServer.close();
      } catch {}
      this.pamServer = null;
    }
    if (this.activePamSocketPath) {
      try {
        if (fs.existsSync(this.activePamSocketPath)) {
          fs.unlinkSync(this.activePamSocketPath);
        }
      } catch {}
      this.activePamSocketPath = null;
    }
  }

  public override async checkAccessibilityPermission(): Promise<boolean> {
    try {
      const script = 'tell application "System Events" to return UI elements enabled';
      const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', script]);
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  public override async requestAccessibilityPermission(): Promise<void> {
    try {
      await execFileAsync('/usr/bin/open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility']);
    } catch (err) {
      Logger.warn('platform', 'Could not open Accessibility preferences', { error: String(err) });
    }
  }

  public override async unlockScreen(secret?: string): Promise<boolean> {
    if (!secret || secret.length === 0) {
      Logger.warn('platform', 'No unlock secret provided; unable to complete keystroke unlock. Please configure password in OpenFaceID Settings.');
      return false;
    }

    if (process.env.OPENFACEID_MOCK_UNLOCK === '1') {
      Logger.debug('platform', 'Mock screen unlock executed (test environment)');
      return true;
    }

    try {
      const isLocked = await this.isScreenLocked();
      if (!isLocked) {
        Logger.info('platform', 'macOS session is already unlocked; no action needed');
        return true;
      }

      // 1. Verify macOS Accessibility permission
      const hasAccessibility = await this.checkAccessibilityPermission();
      if (!hasAccessibility) {
        Logger.error('platform', 'macOS Accessibility permission not granted. OpenFaceID cannot type unlock credentials.');
        return false;
      }

      // 2. Wake display from sleep
      try {
        await execFileAsync('/usr/bin/caffeinate', ['-u', '-t', '2']);
      } catch {
        // Caffeinate failure is non-fatal
      }

      // 3. Dispatch secure keystroke via standard input (NEVER pass secret in CLI arguments)
      Logger.info('platform', 'Dispatching secure macOS lockscreen keystroke unlock via stdin');
      return await this.executeSecureKeystroke(secret);
    } catch (err) {
      Logger.error('platform', 'Failed to unlock macOS screen via secure keystroke injection', { error: String(err) });
      return false;
    }
  }

  private executeSecureKeystroke(secret: string): Promise<boolean> {
    return new Promise((resolve) => {
      // AppleScript that reads password from stdin, preventing CLI argument exposure in ps aux
      const script = `
        set pass to do shell script "cat"
        tell application "System Events"
          delay 0.3
          keystroke pass
          delay 0.1
          key code 36
        end tell
      `;

      const child = spawn('/usr/bin/osascript', ['-e', script], {
        stdio: ['pipe', 'ignore', 'pipe'],
      });

      let errOutput = '';
      child.stderr?.on('data', (d) => {
        errOutput += d.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          Logger.info('platform', 'macOS lock screen keystroke executed successfully');
          resolve(true);
        } else {
          Logger.error('platform', `Keystroke injection failed with code ${code}`, { error: errOutput.trim() });
          resolve(false);
        }
      });

      child.on('error', (err) => {
        Logger.error('platform', 'Failed to spawn osascript for keystroke', { error: String(err) });
        resolve(false);
      });

      // Write secret directly to stdin and close the stream
      child.stdin?.write(secret);
      child.stdin?.end();
    });
  }
}

