import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CanonicalStateMachine, ErrorCode, ERROR_RECOVERY_SUGGESTIONS } from '../../packages/core/src/index.ts';
import { DesktopEngine } from '../../apps/desktop/src/daemon.ts';
import { QuickGlanceHud } from '../../apps/desktop/src/hud.ts';
import { DesktopTrayManager } from '../../apps/desktop/src/tray.ts';
import { ENROLLMENT_POSES, EnrollmentManager } from '../../packages/vision/src/index.ts';

describe('Phase 5 Product UX & Authoritative State Machine', () => {
  it('enforces canonical authoritative presence hierarchy', () => {
    const fsm = new CanonicalStateMachine(15);
    let snapshot = fsm.getSnapshot();

    // 1. Initial State: Uninitialized / Unauthorized
    assert.equal(fsm.isAuthorized(), false);
    assert.equal(snapshot.presence, 'PRESENCE_UNAUTHORIZED');

    // 2. Setup Camera and System
    fsm.setSystemState('SYSTEM_READY');
    fsm.setCameraState('CAMERA_READY');
    assert.equal(fsm.isAuthorized(), false);

    // 3. No face in view -> Looking for you...
    fsm.updateVisionState({
      faceCount: 0,
      detectionState: 'NO_FACE',
      livenessState: 'LIVENESS_REQUIRED',
      identityState: 'IDENTITY_UNKNOWN',
    });
    assert.equal(fsm.isAuthorized(), false);
    assert.equal(fsm.getSnapshot().unauthorizedReason, 'Looking for you...');

    // 4. Section 8: Multiple Faces Detected -> Hard Fail-Closed PRESENCE_AMBIGUOUS
    fsm.updateVisionState({
      faceCount: 2,
      detectionState: 'MULTIPLE_FACES',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'usr_alice',
    });
    assert.equal(fsm.isAuthorized(), false);
    assert.equal(fsm.getSnapshot().presence, 'PRESENCE_AMBIGUOUS');
    assert.ok(fsm.getSnapshot().unauthorizedReason?.includes('Multiple faces detected'));

    // 5. Section 7: Recognized face with failed liveness -> NOT AUTHORIZED
    fsm.updateVisionState({
      faceCount: 1,
      detectionState: 'FACE_DETECTED',
      livenessState: 'LIVENESS_FAILED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'usr_alice',
    });
    assert.equal(fsm.isAuthorized(), false);
    assert.equal(fsm.getSnapshot().presence, 'PRESENCE_UNAUTHORIZED');
    assert.equal(fsm.getSnapshot().unauthorizedReason, 'Liveness check failed');

    // 6. Section 7: Recognized face + Passed Liveness + Single Face -> AUTHORIZED
    const tAuth = 100000;
    fsm.updateVisionState({
      faceCount: 1,
      detectionState: 'FACE_DETECTED',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'usr_alice',
      identityName: 'Alice',
      now: tAuth,
    });
    assert.equal(fsm.isAuthorized(), true);
    assert.equal(fsm.getSnapshot().presence, 'PRESENCE_AUTHORIZED');
    assert.equal(fsm.getSnapshot().activeIdentityName, 'Alice');
    assert.equal(fsm.getSnapshot().presenceSession.authorizedAt, tAuth);
    assert.equal(fsm.getSnapshot().presenceSession.expiresAt, tAuth + 15000);

    // 7. Section 17: Presence Session Expiration
    fsm.checkSessionExpiration(tAuth + 16000);
    assert.equal(fsm.isAuthorized(), false);
    assert.equal(fsm.getSnapshot().presence, 'PRESENCE_EXPIRED');

    // 8. Section 18: Privacy Pause immediately revokes presence
    fsm.setPrivacyPaused(true);
    assert.equal(fsm.isAuthorized(), false);
    assert.equal(fsm.getSnapshot().presence, 'PRESENCE_UNAUTHORIZED');
    assert.ok(fsm.getSnapshot().unauthorizedReason?.includes('Privacy paused'));

    // 9. Section 27: System wake explicitly resets presence
    fsm.setPrivacyPaused(false);
    fsm.resetOnWake();
    assert.equal(fsm.isAuthorized(), false);
    assert.equal(fsm.getSnapshot().presence, 'PRESENCE_UNAUTHORIZED');
  });

  it('verifies canonical error recovery suggestions for all Section 25 codes', () => {
    const requiredCodes = [
      ErrorCode.CAMERA_PERMISSION_DENIED,
      ErrorCode.CAMERA_UNAVAILABLE,
      ErrorCode.CAMERA_DISCONNECTED,
      ErrorCode.CAMERA_INITIALIZATION_FAILED,
      ErrorCode.MODEL_INTEGRITY_FAILURE,
      ErrorCode.IDENTITY_STORE_CORRUPT,
      ErrorCode.IDENTITY_NOT_FOUND,
      ErrorCode.IDENTITY_ENROLLMENT_FAILED,
      ErrorCode.IDENTITY_DELETE_FAILED,
      ErrorCode.LIVENESS_FAILED,
      ErrorCode.LIVENESS_TIMEOUT,
      ErrorCode.FACE_NOT_DETECTED,
      ErrorCode.MULTIPLE_FACES_DETECTED,
      ErrorCode.UNKNOWN_FACE,
      ErrorCode.IPC_UNAUTHORIZED,
      ErrorCode.IPC_UNAVAILABLE,
      ErrorCode.IPC_TIMEOUT,
      ErrorCode.PRIVACY_PAUSED,
      ErrorCode.SYSTEM_ERROR,
    ];

    for (const code of requiredCodes) {
      const suggestion = ERROR_RECOVERY_SUGGESTIONS[code];
      assert.ok(suggestion, `Missing suggestion for ${code}`);
      assert.ok(suggestion.action.length > 5, `Action too short for ${code}`);
      assert.equal(typeof suggestion.retryable, 'boolean', `retryable boolean missing for ${code}`);
    }
  });

  it('verifies 5-pose guided enrollment targets and guidance specifications', () => {
    assert.equal(ENROLLMENT_POSES.length, 5);
    const expectedPoses = ['LOOK_STRAIGHT', 'TURN_LEFT', 'TURN_RIGHT', 'LOOK_UP', 'LOOK_DOWN'];
    for (let i = 0; i < expectedPoses.length; i++) {
      assert.equal(ENROLLMENT_POSES[i].pose, expectedPoses[i]);
      assert.ok(ENROLLMENT_POSES[i].title.length > 0);
      assert.ok(ENROLLMENT_POSES[i].description.length > 0);
    }

    const mgr = new EnrollmentManager('Test User');
    const prog = mgr.getProgress();
    assert.equal(prog.currentPoseIndex, 0);
    assert.equal(prog.totalPoses, 5);
    assert.equal(prog.isCompleted, false);
  });

  it('verifies Quick Glance HUD and Tray structure conforms to Section 19 & 20', async () => {
    const engine = new DesktopEngine();
    await engine.initialize();
    const hud = new QuickGlanceHud(engine);
    const tray = new DesktopTrayManager(engine);

    // Initial state
    const hudPayload = await hud.getHudPayload();
    assert.equal(hudPayload.presence, 'NOT AUTHORIZED');
    assert.ok(hudPayload.reason !== null);
    assert.ok(['Required', 'Passed', 'Failed', 'Checking'].includes(hudPayload.liveness));

    // Tray items
    const trayItems = await tray.getMenuItems();
    const openItem = trayItems.find((i) => i.id === 'header');
    assert.ok(openItem?.label.includes('OpenFaceID'));

    const securityCheck = trayItems.find((i) => i.id === 'security_check');
    assert.equal(securityCheck?.label, 'Run Security Check');

    const privacyCheck = trayItems.find((i) => i.id === 'privacy_check');
    assert.equal(privacyCheck?.label, 'Run Privacy Check');

    const settingsItem = trayItems.find((i) => i.id === 'open_settings');
    assert.equal(settingsItem?.label, 'Open Settings');

    const diagItem = trayItems.find((i) => i.id === 'open_diagnostics');
    assert.equal(diagItem?.label, 'Open Diagnostics');

    await engine.shutdown();
  });
});
