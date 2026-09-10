import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PlatformAdapter, type PlatformInfo, type DisplayInfo } from './PlatformAdapter.ts';
import { Logger } from '../../core/src/index.ts';

const execAsync = promisify(exec);

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
    try {
      Logger.info('platform', 'Locking Windows workstation via user32.dll,LockWorkStation');
      await execAsync('rundll32.exe user32.dll,LockWorkStation');
      return true;
    } catch (err) {
      Logger.error('platform', 'Failed to lock Windows workstation', { error: String(err) });
      return false;
    }
  }

  public async isScreenLocked(): Promise<boolean> {
    try {
      const cmd = `powershell -NoProfile -Command "(Get-Process -Name logonui -ErrorAction SilentlyContinue) -ne $null"`;
      const { stdout } = await execAsync(cmd);
      return stdout.trim().toLowerCase() === 'true';
    } catch {
      return false;
    }
  }

  public async getSystemIdleTimeMs(): Promise<number> {
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
      `.replace(/\n/g, ' ');

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript}"`);
      const ms = parseInt(stdout.trim(), 10);
      return isNaN(ms) ? 0 : ms;
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
    try {
      const appName = 'OpenFaceID';
      const exePath = 'C:\\Program Files\\OpenFaceID\\OpenFaceID.exe';
      const cmd = enable
        ? `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}" /t REG_SZ /d "${exePath}" /f`
        : `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}" /f`;
      await execAsync(cmd);
      return true;
    } catch (err) {
      Logger.warn('platform', `Could not update Windows Run registry key: ${String(err)}`);
      return false;
    }
  }

  public async isStartupEnabled(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "OpenFaceID"`);
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
    try {
      const safeTitle = title.replace(/"/g, '`"');
      const safeBody = body.replace(/"/g, '`"');
      const psCmd = `powershell -NoProfile -Command "[reflection.assembly]::loadwithpartialname('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${safeBody}', '${safeTitle}')"`;
      await execAsync(psCmd);
    } catch {
      // Ignored
    }
  }

  public async storeSecret(key: string, secret: string): Promise<boolean> {
    try {
      const b64Secret = Buffer.from(secret, 'utf8').toString('base64');
      const script = `
        Add-Type -AssemblyName System.Security
        $bytes = [System.Convert]::FromBase64String('${b64Secret}')
        $protected = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
        $out = [System.Convert]::ToBase64String($protected)
        Set-Content -Path "$env:LOCALAPPDATA\\OpenFaceID\\${key}.secret" -Value $out -Force
      `.replace(/\n/g, ' ');

      await execAsync(`powershell -NoProfile -Command "${script}"`);
      return true;
    } catch {
      return false;
    }
  }

  public async retrieveSecret(key: string): Promise<string | null> {
    try {
      const script = `
        Add-Type -AssemblyName System.Security
        $path = "$env:LOCALAPPDATA\\OpenFaceID\\${key}.secret"
        if (-not (Test-Path $path)) { exit 1 }
        $content = Get-Content -Path $path -Raw
        $bytes = [System.Convert]::FromBase64String($content)
        $unprotected = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
        [System.Text.Encoding]::UTF8.GetString($unprotected)
      `.replace(/\n/g, ' ');

      const { stdout } = await execAsync(`powershell -NoProfile -Command "${script}"`);
      return stdout.trim();
    } catch {
      return null;
    }
  }

  public async deleteSecret(key: string): Promise<boolean> {
    try {
      await execAsync(`powershell -NoProfile -Command "Remove-Item -Path '$env:LOCALAPPDATA\\OpenFaceID\\${key}.secret' -Force -ErrorAction SilentlyContinue"`);
      return true;
    } catch {
      return false;
    }
  }
}
