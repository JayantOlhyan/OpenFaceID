import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PlatformAdapter, type PlatformInfo, type DisplayInfo } from '../../packages/platform/src/PlatformAdapter.ts';
import { MacOSAdapter } from '../../packages/platform/src/MacOSAdapter.ts';
import { LinuxAdapter } from '../../packages/platform/src/LinuxAdapter.ts';
import { WindowsAdapter } from '../../packages/platform/src/WindowsAdapter.ts';
import { DesktopEngine } from '../../apps/desktop/src/daemon.ts';

class TestPlatformAdapter extends PlatformAdapter {
  public storedSecrets: Map<string, string> = new Map();
  public unlockScreenCallCount: number = 0;
  public lastUnlockSecret: string | undefined = undefined;
  public screenLocked: boolean = true;

  public getPlatformInfo(): PlatformInfo {
    return {
      os: 'macos',
      release: '24.0.0',
      arch: 'arm64',
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
    this.screenLocked = true;
    return true;
  }

  public async isScreenLocked(): Promise<boolean> {
    return this.screenLocked;
  }

  public async getSystemIdleTimeMs(): Promise<number> {
    return 0;
  }

  public async requestCameraPermission(): Promise<boolean> {
    return true;
  }

  public async checkCameraPermission(): Promise<'granted'> {
    return 'granted';
  }

  public async registerStartup(): Promise<boolean> {
    return true;
  }

  public async isStartupEnabled(): Promise<boolean> {
    return false;
  }

  public async getDisplayInfo(): Promise<DisplayInfo[]> {
    return [];
  }

  public async showNotification(): Promise<void> {}

  public startWakeAndLockListener(): void {}
  public stopWakeAndLockListener(): void {}

  public async storeSecret(key: string, secret: string): Promise<boolean> {
    this.storedSecrets.set(key, secret);
    return true;
  }

  public async retrieveSecret(key: string): Promise<string | null> {
    return this.storedSecrets.get(key) || null;
  }

  public async deleteSecret(key: string): Promise<boolean> {
    return this.storedSecrets.delete(key);
  }

  public override async unlockScreen(secret?: string): Promise<boolean> {
    this.unlockScreenCallCount++;
    this.lastUnlockSecret = secret;
    if (this.screenLocked && secret) {
      this.screenLocked = false;
      return true;
    }
    return !this.screenLocked;
  }
}

describe('Phase 4 — Platform Credential Vault & Screen Unlockers', () => {
  it('stores, retrieves, and deletes user credentials with namespacing and sanitization', async () => {
    const adapter = new TestPlatformAdapter();
    const userId = 'alice.user@test';
    const password = 'CorrectHorseBatteryStaple123!';

    const stored = await adapter.storeCredential(userId, password);
    assert.equal(stored, true);
    assert.ok(adapter.storedSecrets.has('cred_alice_user_test'));

    const retrieved = await adapter.retrieveCredential(userId);
    assert.equal(retrieved, password);

    const deleted = await adapter.deleteCredential(userId);
    assert.equal(deleted, true);
    assert.equal(await adapter.retrieveCredential(userId), null);
  });

  it('MacOSAdapter handles unlockScreen cleanly in test environment', async () => {
    process.env.OPENFACEID_MOCK_UNLOCK = '1';
    const macAdapter = new MacOSAdapter();
    const result = await macAdapter.unlockScreen('mock_secret');
    assert.equal(result, true);
  });

  it('LinuxAdapter handles unlockScreen cleanly in test environment', async () => {
    process.env.OPENFACEID_MOCK_UNLOCK = '1';
    const linuxAdapter = new LinuxAdapter();
    const result = await linuxAdapter.unlockScreen('mock_secret');
    assert.equal(result, true);
  });

  it('WindowsAdapter handles unlockScreen cleanly in test environment', async () => {
    process.env.OPENFACEID_MOCK_UNLOCK = '1';
    const winAdapter = new WindowsAdapter();
    const result = await winAdapter.unlockScreen('mock_secret');
    assert.equal(result, true);
  });

  it('DesktopEngine enforces lockout after 3 consecutive failed unlock attempts', async () => {
    const engine = DesktopEngine.getInstance();
    engine.resetLockout();

    const statusInitial = engine.getUnlockStatus();
    assert.equal(statusInitial.lockout.isLockedOut, false);
    assert.equal(statusInitial.lockout.consecutiveFailures, 0);

    // Simulate 3 failures
    for (let i = 0; i < 3; i++) {
      const res = await engine.triggerUnlockSession('test_lockout_trigger');
      assert.equal(res.success, false);
    }

    const statusAfterFailures = engine.getUnlockStatus();
    assert.equal(statusAfterFailures.lockout.isLockedOut, true);
    assert.equal(statusAfterFailures.lockout.consecutiveFailures, 3);
    assert.ok(statusAfterFailures.lockout.remainingSec > 0);

    // 4th attempt is blocked immediately by lockout
    const resBlocked = await engine.triggerUnlockSession('test_blocked_trigger');
    assert.equal(resBlocked.success, false);
    assert.ok(resBlocked.error?.includes('LOCKOUT_RATE_LIMIT_EXCEEDED'));

    // Manual reset clears lockout
    engine.resetLockout();
    const statusReset = engine.getUnlockStatus();
    assert.equal(statusReset.lockout.isLockedOut, false);
    assert.equal(statusReset.lockout.consecutiveFailures, 0);
  });
});
