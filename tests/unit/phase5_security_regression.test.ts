import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { CanonicalStateMachine } from '../../packages/core/src/index.ts';
import { DesktopEngine } from '../../apps/desktop/src/daemon.ts';
import { CryptoManager } from '../../packages/security/src/index.ts';
import { BRANDING } from '../../packages/branding/src/index.ts';

describe('Phase 5 Security Regression & Fail-Closed Invariants', () => {
  it('CRITICAL REGRESSION: AUTHORIZED state NEVER appears when authoritative state is not authorized', async () => {
    const engine = new DesktopEngine();
    await engine.initialize();

    // The engine starts unauthenticated with no recognized face
    const state = await engine.getAuthoritativeState();
    assert.equal(state.presence.isAuthorized, false);
    assert.notEqual(state.canonicalState.presence, 'PRESENCE_AUTHORIZED');
    assert.ok(state.presence.unauthorizedReason !== null);

    // Tray status must never claim authorized presence when no face is recognized
    assert.notEqual(state.tray.status, '● Authorized');

    await engine.shutdown();
  });

  it('strictly rejects multiple-face presence authorization bypass attempt', () => {
    const fsm = new CanonicalStateMachine(20);
    fsm.setSystemState('SYSTEM_READY');
    fsm.setCameraState('CAMERA_READY');

    // Attempt to authorize while multiple faces are visible
    fsm.updateVisionState({
      faceCount: 3,
      detectionState: 'MULTIPLE_FACES',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'usr_valid_user',
      identityName: 'Authorized Admin',
    });

    assert.equal(fsm.isAuthorized(), false);
    assert.equal(fsm.getSnapshot().presence, 'PRESENCE_AMBIGUOUS');
    assert.ok(fsm.getSnapshot().unauthorizedReason?.includes('Multiple faces detected'));
  });

  it('strictly rejects unknown-face presence authorization attempt', () => {
    const fsm = new CanonicalStateMachine(20);
    fsm.setSystemState('SYSTEM_READY');
    fsm.setCameraState('CAMERA_READY');

    // Attempt: single face, liveness passed, but identity is UNKNOWN
    fsm.updateVisionState({
      faceCount: 1,
      detectionState: 'UNKNOWN_FACE',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_UNKNOWN',
      identityId: null,
    });

    assert.equal(fsm.isAuthorized(), false);
    assert.equal(fsm.getSnapshot().presence, 'PRESENCE_UNAUTHORIZED');
    assert.equal(fsm.getSnapshot().unauthorizedReason, 'Unknown face');
  });

  it('strictly rejects liveness failure bypass attempt', () => {
    const fsm = new CanonicalStateMachine(20);
    fsm.setSystemState('SYSTEM_READY');
    fsm.setCameraState('CAMERA_READY');

    // Attempt: valid recognized identity but failed liveness (photo spoof attack)
    fsm.updateVisionState({
      faceCount: 1,
      detectionState: 'FACE_DETECTED',
      livenessState: 'LIVENESS_FAILED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'usr_alice',
      identityName: 'Alice',
    });

    assert.equal(fsm.isAuthorized(), false);
    assert.equal(fsm.getSnapshot().presence, 'PRESENCE_UNAUTHORIZED');
    assert.equal(fsm.getSnapshot().unauthorizedReason, 'Liveness check failed');
  });

  it('verifies timing-safe IPC token validation rejects invalid or missing credentials', () => {
    const secretToken = 'ofid_9876543210fedcba9876543210fedcba';
    
    // Constant time validation
    assert.equal(CryptoManager.verifyTimingSafe(secretToken, secretToken), true);
    assert.equal(CryptoManager.verifyTimingSafe('wrong_token', secretToken), false);
    assert.equal(CryptoManager.verifyTimingSafe('', secretToken), false);
    assert.equal(CryptoManager.verifyTimingSafe(secretToken.slice(0, -1), secretToken), false);
    assert.equal(CryptoManager.verifyTimingSafe(secretToken + 'x', secretToken), false);
  });

  it('verifies zero raw camera frame persistence on disk', () => {
    const configDir = path.join(os.homedir(), BRANDING.identifiers.configDirectoryName);
    if (fs.existsSync(configDir)) {
      const files = fs.readdirSync(configDir);
      const imageFiles = files.filter((f) => /\.(jpe?g|png|raw|bmp|tiff|webp)$/i.test(f));
      assert.equal(imageFiles.length, 0, `Found raw image files in storage: ${imageFiles.join(', ')}`);
    }
  });

  it('verifies zero external telemetry or tracking in core config', async () => {
    const engine = new DesktopEngine();
    const config = await engine.configStore.loadConfig();
    assert.equal(config.privacy.telemetryEnabled, false);

    // Attempt to force enable telemetry
    (config.privacy as any).telemetryEnabled = true;
    engine.configStore.saveConfig(config);
    const reloaded = engine.configStore.loadConfig();
    assert.equal(reloaded.privacy.telemetryEnabled, false, 'Telemetry must remain strictly false');

    await engine.shutdown();
  });
});
