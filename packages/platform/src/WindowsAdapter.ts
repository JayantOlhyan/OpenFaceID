import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PlatformAdapter, type PlatformInfo, type DisplayInfo } from './PlatformAdapter.ts';
import { Logger } from '../../core/src/index.ts';

const execFileAsync = promisify(execFile);

export class WindowsAdapter extends PlatformAdapter {
  private serviceName = 'OpenFaceID';

  public getPlatformInfo(): PlatformInfo {
    return {
      os: 'windows',
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
    if (process.env.CI) return true;
    try {
      Logger.info('platform', 'Locking Windows workstation via user32.dll,LockWorkStation');
      await execFileAsync('rundll32.exe', ['user32.dll,LockWorkStation'], { timeout: 2000, windowsHide: true });
      return true;
    } catch (err) {
      Logger.error('platform', 'Failed to lock Windows workstation', { error: String(err) });
      return false;
    }
  }

  public async isScreenLocked(): Promise<boolean> {
    if (process.env.CI) return false;
    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '(Get-Process -Name logonui -ErrorAction SilentlyContinue) -ne $null',
      ], { timeout: 2000, windowsHide: true });
      return stdout.trim().toLowerCase() === 'true';
    } catch {
      return false;
    }
  }

  public async getSystemIdleTimeMs(): Promise<number> {
    if (process.env.CI) return 0;
    try {
      const psScript = `
Add-Type @'
using System;
using System.Runtime.InteropServices;
public struct LASTINPUTINFO {
    public uint cbSize;
    public uint dwTime;
}
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    [DllImport("kernel32.dll")]
    public static extern uint GetTickCount();
}
'@
$lii = New-Object LASTINPUTINFO
$lii.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lii)
if ([Win32]::GetLastInputInfo([ref]$lii)) {
    $ticks = [Win32]::GetTickCount()
    $idle = $ticks - $lii.dwTime
    Write-Output $idle
} else {
    Write-Output 0
}
`.trim();

      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        psScript,
      ], { timeout: 2500, windowsHide: true });
      const val = parseInt(stdout.trim(), 10);
      return isNaN(val) ? 0 : val;
    } catch {
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
    if (process.env.CI) return true;
    try {
      const appName = 'OpenFaceID';
      const exePath = 'C:\\Program Files\\OpenFaceID\\OpenFaceID.exe';
      if (enable) {
        await execFileAsync('reg.exe', [
          'add',
          'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
          '/v',
          appName,
          '/t',
          'REG_SZ',
          '/d',
          exePath,
          '/f',
        ], { timeout: 2000, windowsHide: true });
      } else {
        await execFileAsync('reg.exe', [
          'delete',
          'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
          '/v',
          appName,
          '/f',
        ], { timeout: 2000, windowsHide: true });
      }
      return true;
    } catch (err) {
      Logger.warn('platform', `Could not update Windows Run registry key: ${String(err)}`);
      return false;
    }
  }

  public async isStartupEnabled(): Promise<boolean> {
    if (process.env.CI) return false;
    try {
      const { stdout } = await execFileAsync('reg.exe', [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
        '/v',
        'OpenFaceID',
      ], { timeout: 2000, windowsHide: true });
      return stdout.includes('OpenFaceID');
    } catch {
      return false;
    }
  }

  public async getDisplayInfo(): Promise<DisplayInfo[]> {
    return [
      {
        id: 'primary-win-display',
        width: 1920,
        height: 1080,
        isPrimary: true,
        scaleFactor: 1.25,
      },
    ];
  }

  public async showNotification(title: string, body: string): Promise<void> {
    if (process.env.CI || this.shouldThrottleNotification(title, body)) return;
    try {
      const safeTitle = title.replace(/'/g, "''");
      const safeBody = body.replace(/'/g, "''");
      const psScript = `[reflection.assembly]::loadwithpartialname('System.Windows.Forms') | Out-Null; [System.Windows.Forms.MessageBox]::Show('${safeBody}', '${safeTitle}')`;
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], { timeout: 2000, windowsHide: true });
    } catch {
      // Ignored
    }
  }

  private validateKey(key: string): void {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(key)) {
      throw new Error(`Invalid storage key format: ${key}`);
    }
  }

  public async storeSecret(key: string, secret: string): Promise<boolean> {
    if (process.env.CI) return false;
    try {
      this.validateKey(key);
      const b64Secret = Buffer.from(secret, 'utf8').toString('base64');
      const script = `
Add-Type -AssemblyName System.Security
$bytes = [System.Convert]::FromBase64String('${b64Secret}')
$protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
$out = [System.Convert]::ToBase64String($protected)
$dir = "$env:LOCALAPPDATA\\OpenFaceID"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
Set-Content -Path "$dir\\${key}.secret" -Value $out -Force
`.trim();

      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 2500, windowsHide: true });
      return true;
    } catch {
      return false;
    }
  }

  public async retrieveSecret(key: string): Promise<string | null> {
    if (process.env.CI) return null;
    try {
      this.validateKey(key);
      const script = `
Add-Type -AssemblyName System.Security
$path = "$env:LOCALAPPDATA\\OpenFaceID\\${key}.secret"
if (-not (Test-Path $path)) { exit 1 }
$content = Get-Content -Path $path -Raw
$bytes = [System.Convert]::FromBase64String($content)
$unprotected = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[System.Text.Encoding]::UTF8.GetString($unprotected)
`.trim();

      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 2500, windowsHide: true });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  public async deleteSecret(key: string): Promise<boolean> {
    if (process.env.CI) return true;
    try {
      this.validateKey(key);
      const script = `Remove-Item -Path "$env:LOCALAPPDATA\\OpenFaceID\\${key}.secret" -Force -ErrorAction SilentlyContinue`;
      await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 2500, windowsHide: true });
      return true;
    } catch {
      return false;
    }
  }
}
