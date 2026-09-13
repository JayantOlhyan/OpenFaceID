import test from 'node:test';
import assert from 'node:assert';
import { CanonicalStateMachine } from '../../packages/core/src/state/canonical.ts';

test('Multi-Face Presence & Fail-Closed Ambiguity Evaluation', async (t) => {
  function createReadyStateMachine(): CanonicalStateMachine {
    const sm = new CanonicalStateMachine(20);
    sm.setSystemState('SYSTEM_READY');
    sm.setCameraState('CAMERA_READY');
    return sm;
  }

  await t.test('Zero faces in view maintains PRESENCE_UNAUTHORIZED', () => {
    const sm = createReadyStateMachine();
    sm.updateVisionState({
      faceCount: 0,
      detectionState: 'NO_FACE',
      livenessState: 'LIVENESS_REQUIRED',
      identityState: 'IDENTITY_UNKNOWN',
    });

    const snap = sm.getSnapshot();
    assert.strictEqual(snap.presence, 'PRESENCE_UNAUTHORIZED');
    assert.strictEqual(snap.faceCount, 0);
    assert.strictEqual(snap.activeIdentityId, null);
  });

  await t.test('Single enrolled face with passed liveness transitions to PRESENCE_AUTHORIZED', () => {
    const sm = createReadyStateMachine();
    const now = Date.now();

    sm.updateVisionState({
      faceCount: 1,
      detectionState: 'FACE_DETECTED',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'user_alice',
      identityName: 'Alice',
      now,
    });

    const snap = sm.getSnapshot();
    assert.strictEqual(snap.presence, 'PRESENCE_AUTHORIZED');
    assert.strictEqual(snap.activeIdentityId, 'user_alice');
    assert.strictEqual(snap.activeIdentityName, 'Alice');
    assert.strictEqual(snap.unauthorizedReason, null);
    assert.ok(snap.presenceSession.authorizedAt !== null);
  });

  await t.test('Bystander scenario (2 faces) immediately triggers fail-closed PRESENCE_AMBIGUOUS', () => {
    const sm = createReadyStateMachine();
    const now = Date.now();

    // 1. Initially Alice is authorized
    sm.updateVisionState({
      faceCount: 1,
      detectionState: 'FACE_DETECTED',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'user_alice',
      identityName: 'Alice',
      now,
    });
    assert.strictEqual(sm.getSnapshot().presence, 'PRESENCE_AUTHORIZED');

    // 2. Colleague steps into frame -> faceCount becomes 2
    sm.updateVisionState({
      faceCount: 2,
      detectionState: 'MULTIPLE_FACES',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'user_alice',
      identityName: 'Alice',
      now: now + 500,
    });

    const snap = sm.getSnapshot();
    assert.strictEqual(
      snap.presence,
      'PRESENCE_AMBIGUOUS',
      'Presence MUST immediately transition to PRESENCE_AMBIGUOUS when 2 faces are detected'
    );
    assert.ok(
      snap.unauthorizedReason?.includes('Multiple faces detected'),
      'Unauthorized reason must explain multiple face ambiguity'
    );
  });

  await t.test('Crowd/Group scenario (3+ faces) strictly enforces PRESENCE_AMBIGUOUS', () => {
    const sm = createReadyStateMachine();

    // 3 faces
    sm.updateVisionState({
      faceCount: 3,
      detectionState: 'MULTIPLE_FACES',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'user_alice',
      identityName: 'Alice',
    });
    assert.strictEqual(sm.getSnapshot().presence, 'PRESENCE_AMBIGUOUS');

    // 5 faces
    sm.updateVisionState({
      faceCount: 5,
      detectionState: 'MULTIPLE_FACES',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'user_alice',
      identityName: 'Alice',
    });
    assert.strictEqual(sm.getSnapshot().presence, 'PRESENCE_AMBIGUOUS');
  });

  await t.test('Recovery: When bystander leaves, authorized state safely restores', () => {
    const sm = createReadyStateMachine();
    const now = Date.now();

    // Initial state: Authorized
    sm.updateVisionState({
      faceCount: 1,
      detectionState: 'FACE_DETECTED',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'user_alice',
      identityName: 'Alice',
      now,
    });
    assert.strictEqual(sm.getSnapshot().presence, 'PRESENCE_AUTHORIZED');

    // Bystander enters
    sm.updateVisionState({
      faceCount: 2,
      detectionState: 'MULTIPLE_FACES',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'user_alice',
      identityName: 'Alice',
      now: now + 1000,
    });
    assert.strictEqual(sm.getSnapshot().presence, 'PRESENCE_AMBIGUOUS');

    // Bystander leaves
    sm.updateVisionState({
      faceCount: 1,
      detectionState: 'FACE_DETECTED',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'user_alice',
      identityName: 'Alice',
      now: now + 2000,
    });
    assert.strictEqual(sm.getSnapshot().presence, 'PRESENCE_AUTHORIZED');
    assert.strictEqual(sm.getSnapshot().unauthorizedReason, null);
  });

  await t.test('Privacy audit: State snapshots never contain raw biometric buffers', () => {
    const sm = createReadyStateMachine();
    sm.updateVisionState({
      faceCount: 2,
      detectionState: 'MULTIPLE_FACES',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'user_alice',
      identityName: 'Alice',
    });

    const snap = sm.getSnapshot();
    const snapStr = JSON.stringify(snap);

    assert.ok(!snapStr.includes('buffer'));
    assert.ok(!snapStr.includes('Uint8Array'));
    assert.ok(!snapStr.includes('pixelData'));
    assert.ok(!snapStr.includes('imageData'));
  });
});
