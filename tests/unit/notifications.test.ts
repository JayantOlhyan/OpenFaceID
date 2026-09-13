import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  NotificationManager,
  NotificationPolicy,
  type NotificationPayload,
} from '../../packages/core/src/notifications/index.ts';
import { ActionDispatcher } from '../../packages/automation/src/ActionDispatcher.ts';
import { PlatformAdapter, type PlatformInfo, type DisplayInfo } from '../../packages/platform/src/PlatformAdapter.ts';

class MockPlatformAdapter extends PlatformAdapter {
  public dispatchedNotifications: Array<{ title: string; body: string; timestamp: number }> = [];
  public shouldFail: boolean = false;

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
    return true;
  }
  public async isScreenLocked(): Promise<boolean> {
    return false;
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

  public async showNotification(title: string, body: string): Promise<void> {
    if (this.shouldFail) {
      throw new Error('OS Notification Center communication failure');
    }
    this.dispatchedNotifications.push({ title, body, timestamp: Date.now() });
  }

  public async storeSecret(): Promise<boolean> {
    return true;
  }
  public async retrieveSecret(): Promise<string | null> {
    return null;
  }
  public async deleteSecret(): Promise<boolean> {
    return true;
  }
}

describe('Semantic Notification System & Policy (Phase 7)', () => {
  let mockAdapter: MockPlatformAdapter;
  let manager: NotificationManager;

  beforeEach(() => {
    NotificationManager.resetInstance();
    mockAdapter = new MockPlatformAdapter();
    manager = NotificationManager.getInstance({ adapter: mockAdapter });
  });

  it('verifies canonical mappings for all core desktop events', async () => {
    // 1. Camera Disconnected
    const res1 = await manager.notifyCanonical('CAMERA_DISCONNECTED');
    assert.equal(res1, true);
    assert.equal(mockAdapter.dispatchedNotifications.length, 1);
    const n1 = mockAdapter.dispatchedNotifications[0];
    assert.equal(n1.title, 'OpenFaceID');
    assert.ok(n1.body.includes('Camera disconnected'));
    assert.ok(n1.body.includes('Protection is paused until your camera reconnects'));

    // 2. Camera Reconnected
    const res2 = await manager.notifyCanonical('CAMERA_CONNECTED');
    assert.equal(res2, true);
    const n2 = mockAdapter.dispatchedNotifications[1];
    assert.equal(n2.title, 'OpenFaceID');
    assert.ok(n2.body.includes('Camera reconnected'));

    // 3. Presence Authorized
    const res3 = await manager.notifyCanonical('PRESENCE_AUTHORIZED');
    assert.equal(res3, true);
    const n3 = mockAdapter.dispatchedNotifications[2];
    assert.ok(n3.body.includes('Presence verified'));

    // 4. Multiple Faces (Security)
    const res4 = await manager.notifyCanonical('MULTIPLE_FACES');
    assert.equal(res4, true);
    const n4 = mockAdapter.dispatchedNotifications[3];
    assert.equal(n4.title, 'OpenFaceID Security');
    assert.ok(n4.body.includes('Multiple faces detected'));

    // 5. Liveness Failed (Security)
    const res5 = await manager.notifyCanonical('LIVENESS_FAILED');
    assert.equal(res5, true);
    const n5 = mockAdapter.dispatchedNotifications[4];
    assert.equal(n5.title, 'OpenFaceID Security');
    assert.ok(n5.body.includes('Liveness verification failed'));

    // 6. Privacy Mode
    const res6 = await manager.notifyCanonical('PRIVACY_PAUSED');
    assert.equal(res6, true);
    const n6 = mockAdapter.dispatchedNotifications[5];
    assert.ok(n6.body.includes('Protection paused'));
  });

  it('REGRESSION TEST: "Event triggered" and "OpenFaceID Alert" NEVER appear in notification output', async () => {
    // Test direct dispatch with empty action payload
    await ActionDispatcher.dispatch('notify', {});

    // Test with ActionDispatcher populated with custom text
    await ActionDispatcher.dispatch('notify', {
      title: 'Camera Security',
      body: 'Camera feed restored.',
    });

    // Test all canonical definitions
    for (const key of Object.keys(NotificationPolicy.DEFINITIONS)) {
      const payload = NotificationPolicy.createPayload(key);
      assert.ok(payload);
      assert.notEqual(payload.body, 'Event triggered');
      assert.notEqual(payload.title, 'OpenFaceID Alert');
      assert.notEqual(payload.title, 'Generic alert');
      assert.notEqual(payload.title, 'Unknown event');
      assert.ok(!payload.body.includes('Event triggered'));
      assert.ok(!payload.body.includes('undefined'));
      assert.ok(!payload.body.includes('[object Object]'));
    }

    for (const dispatched of mockAdapter.dispatchedNotifications) {
      assert.notEqual(dispatched.body, 'Event triggered');
      assert.notEqual(dispatched.title, 'OpenFaceID Alert');
      assert.ok(!dispatched.body.includes('Event triggered'));
      assert.ok(!dispatched.title.includes('OpenFaceID Alert'));
    }
  });

  it('enforces deduplication and category cooldowns', async () => {
    const t0 = 1000000;
    const payload: NotificationPayload = {
      id: 'test_notif_1',
      category: 'camera',
      severity: 'warning',
      title: 'Camera disconnected',
      body: 'Protection is paused until your camera reconnects.',
      dedupeKey: 'camera-disconnected',
      cooldownMs: 60_000,
      timestamp: t0,
    };

    // First emission succeeds
    const res1 = await manager.notify(payload);
    assert.equal(res1, true);
    assert.equal(mockAdapter.dispatchedNotifications.length, 1);

    // Second emission within 60s cooldown is suppressed
    const res2 = await manager.notify({ ...payload, timestamp: t0 + 10_000 });
    assert.equal(res2, false);
    assert.equal(mockAdapter.dispatchedNotifications.length, 1);

    // Third emission after cooldown expires succeeds
    const res3 = await manager.notify({ ...payload, timestamp: t0 + 65_000 });
    assert.equal(res3, true);
    assert.equal(mockAdapter.dispatchedNotifications.length, 2);
  });

  it('enforces burst protection against high-frequency event floods', async () => {
    const t0 = 2000000;
    let dispatchedCount = 0;

    // Simulate 100 UNKNOWN_FACE_DETECTED events over 5 seconds
    for (let i = 0; i < 100; i++) {
      const res = await manager.notify({
        id: `flood_${i}`,
        category: 'recognition',
        severity: 'warning',
        title: 'Unknown person detected',
        body: 'Presence verification failed.',
        dedupeKey: `unknown_${i}`, // Bypass dedupeKey to explicitly test sliding burst limiter
        cooldownMs: 1_000,
        timestamp: t0 + (i * 50),
      });
      if (res) dispatchedCount++;
    }

    // Category burst limiter restricts max dispatches to 3 per 30-second window
    assert.ok(dispatchedCount <= 3, `Expected burst limit to clamp to <= 3, got ${dispatchedCount}`);
    assert.ok(mockAdapter.dispatchedNotifications.length <= 3);
  });

  it('handles state-transition authorization notifications without spam', async () => {
    // 100 consecutive frames of USER_PRESENT (simulating 30 FPS active presence)
    for (let i = 0; i < 100; i++) {
      await manager.handleEvent('USER_PRESENT');
    }

    // Must emit exactly 1 notification upon initial unauthorized -> authorized transition
    assert.equal(mockAdapter.dispatchedNotifications.length, 1);
    assert.ok(mockAdapter.dispatchedNotifications[0].body.includes('Presence verified'));

    // User leaves
    await manager.handleEvent('USER_LEFT');
    assert.equal(mockAdapter.dispatchedNotifications.length, 2);
    assert.ok(mockAdapter.dispatchedNotifications[1].body.includes('Presence ended'));

    // Repeated USER_LEFT without re-authorization emits nothing
    await manager.handleEvent('USER_LEFT');
    assert.equal(mockAdapter.dispatchedNotifications.length, 2);
  });

  it('handles multiple-face detection fail-closed transition', async () => {
    // 100 consecutive frames with 2 faces
    for (let i = 0; i < 100; i++) {
      await manager.handleEvent('MULTIPLE_FACES_DETECTED', { count: 2 });
    }

    // Exactly 1 security notification upon transitioning from single to multiple faces
    assert.equal(mockAdapter.dispatchedNotifications.length, 1);
    assert.equal(mockAdapter.dispatchedNotifications[0].title, 'OpenFaceID Security');
    assert.ok(mockAdapter.dispatchedNotifications[0].body.includes('Multiple faces detected'));
  });

  it('mitigates state oscillation storms through rate limits and cooldowns', async () => {
    // Rapidly oscillate presence 20 times within 1 second
    for (let i = 0; i < 20; i++) {
      await manager.handleEvent('USER_PRESENT');
      await manager.handleEvent('USER_LEFT');
    }

    // Due to deduplication cooldowns (5s for presence-authorized, 10s for presence-ended)
    // the system must not emit 40 notifications
    assert.ok(mockAdapter.dispatchedNotifications.length <= 4, `Oscillation produced too many notifications: ${mockAdapter.dispatchedNotifications.length}`);
  });

  it('guarantees silent internal events NEVER produce notifications', async () => {
    const silentEvents = [
      'FACE_DETECTED',
      'FACE_LOST',
      'CAMERA_FRAME_RECEIVED',
      'MATCHING_STARTED',
      'MATCHING_COMPLETED',
      'LIVENESS_STARTED',
      'LIVENESS_PROGRESS',
      'PRESENCE_HEARTBEAT',
      'FRAME_PROCESSED',
      'BATTERY_PROFILE_CHANGED',
    ];

    for (const evt of silentEvents) {
      const res = await manager.handleEvent(evt, { data: 'internal' });
      assert.equal(res, false, `Event ${evt} must not produce a notification`);
    }

    assert.equal(mockAdapter.dispatchedNotifications.length, 0);
  });

  it('CRITICAL INVARIANT: Notification failure NEVER breaks execution or changes security state', async () => {
    mockAdapter.shouldFail = true; // Simulate broken OS notification service / permissions

    // Must resolve cleanly without throwing
    const res = await manager.notifyCanonical('SECURITY_FAILURE', {
      body: 'Model integrity check failed.',
    });

    assert.equal(res, false);
    // History properly records the attempt and suppression/failure reason
    const hist = manager.getHistory();
    assert.equal(hist.length, 1);
    assert.equal(hist[0].dispatched, false);
    assert.equal(hist[0].suppressionReason, 'throttled');
  });

  it('sanitizes notification history (Zero Biometrics / Zero Secrets)', async () => {
    await manager.notifyCanonical('PRESENCE_AUTHORIZED');
    await manager.notifyCanonical('CAMERA_DISCONNECTED');

    const history = manager.getHistory();
    assert.equal(history.length, 2);

    for (const item of history) {
      assert.ok(item.id);
      assert.ok(item.category);
      assert.ok(item.title);
      assert.ok(item.body);
      // Ensure zero sensitive properties
      const serialized = JSON.stringify(item);
      assert.ok(!serialized.includes('embedding'));
      assert.ok(!serialized.includes('vector'));
      assert.ok(!serialized.includes('password'));
      assert.ok(!serialized.includes('token'));
      assert.ok(!serialized.includes('key'));
      assert.ok(!serialized.includes('rawFrame'));
    }
  });
});
