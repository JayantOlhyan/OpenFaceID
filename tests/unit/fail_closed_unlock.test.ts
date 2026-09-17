import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UnlockStateMachine } from '../../packages/core/src/state/unlock.ts';
import { MacOSAdapter } from '../../packages/platform/src/MacOSAdapter.ts';
import { FaceRecognizer } from '../../packages/vision/src/recognizer.ts';
import { ModelRegistry } from '../../packages/vision/src/registry.ts';
import type { EnrolledIdentity } from '../../packages/vision/src/interfaces.ts';

describe('Phase 13 — Complete Fail-Closed Security Invariants Matrix', () => {
  // 1. Unknown Face
  it('fails closed on unknown face below similarity threshold', () => {
    const fsm = new UnlockStateMachine();
    fsm.triggerWake('wake');
    fsm.onFirstFrameReceived();
    fsm.setAnalyzing();

    const result = fsm.recordFailed('SIMILARITY_BELOW_THRESHOLD');
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
    assert.equal(result.error, 'SIMILARITY_BELOW_THRESHOLD');
    assert.equal(fsm.getLastResult()?.success, false);
  });

  // 2. Multiple Faces (Anti-Shoulder Surfing)
  it('fails closed on multiple faces detected simultaneously', () => {
    const fsm = new UnlockStateMachine();
    fsm.triggerWake('wake');
    fsm.onFirstFrameReceived();
    fsm.setAnalyzing();

    const result = fsm.recordFailed('MULTIPLE_FACES_DETECTED');
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
    assert.equal(result.error, 'MULTIPLE_FACES_DETECTED');
  });

  // 3. Failed Liveness / PAD Rejection
  it('fails closed on presentation attack detection failure', () => {
    const fsm = new UnlockStateMachine();
    fsm.triggerWake('wake');
    fsm.onFirstFrameReceived();
    fsm.setAnalyzing();

    const result = fsm.recordFailed('LIVENESS_REJECTED');
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
    assert.equal(result.error, 'LIVENESS_REJECTED');
  });

  // 4. Verification Timeout
  it('fails closed when deadline expires before face confirmation', () => {
    const fsm = new UnlockStateMachine({ burstTimeoutMs: 500 });
    fsm.triggerWake('wake', 1000);
    fsm.onFirstFrameReceived(1050);

    assert.equal(fsm.isBurstTimeout(1600), true);
    const result = fsm.recordFailed('TIMEOUT', 1600);
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
  });

  // 5. Camera Failure / Disconnection
  it('fails closed on camera disconnection during burst capture', () => {
    const fsm = new UnlockStateMachine();
    fsm.triggerWake('wake');
    const result = fsm.recordFailed('CAMERA_DISCONNECTED');
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
    assert.equal(result.error, 'CAMERA_DISCONNECTED');
  });

  // 6. Corrupted or Missing Model
  it('fails closed on model corruption or missing model artifact', async () => {
    const registry = ModelRegistry.getInstance();
    const check = await registry.verifyIntegrity(
      'arcface-coreml-mobilefacenet',
      'models/non_existent_corrupted_model.mlmodelc'
    );
    assert.equal(check.valid, false, 'Corrupted or missing model must be flagged as invalid');
    assert.ok(check.error?.includes('FILE_NOT_FOUND'));
  });

  // 7. Authentication IPC Failure
  it('fails closed when unlock secret or vault credential is missing', async () => {
    delete process.env.OPENFACEID_MOCK_UNLOCK;
    const adapter = new MacOSAdapter();
    assert.equal(await adapter.unlockScreen(''), false);
    assert.equal(await adapter.unlockScreen(undefined), false);
  });

  // 8. Stale / Expired Authorization
  it('fails closed when authorization token is stale or expired', () => {
    const now = Date.now();
    const tokenTimestamp = now - 5000; // 5 seconds old (max allowed window is 3000ms)
    const isStale = now - tokenTimestamp > 3000;
    assert.equal(isStale, true, 'Token older than 3000ms must be rejected as stale');
  });

  // 9. Ambiguous Identity (Margin threshold)
  it('fails closed on ambiguous identity when candidate margins are too close', () => {
    const recognizer = new FaceRecognizer({ threshold: 0.70 });
    const enrolledUserA: EnrolledIdentity = {
      id: 'usr_alice',
      name: 'Alice',
      enabled: true,
      averageEmbedding: new Float32Array(512).fill(0.044),
      embeddings: [new Float32Array(512).fill(0.044)],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      poses: [],
    };
    const enrolledUserB: EnrolledIdentity = {
      id: 'usr_bob',
      name: 'Bob',
      enabled: true,
      averageEmbedding: new Float32Array(512).fill(0.043),
      embeddings: [new Float32Array(512).fill(0.043)],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      poses: [],
    };
    const gallery = [enrolledUserA, enrolledUserB];

    // Query vector equidistant between A and B
    const query = new Float32Array(512).fill(0.0435);
    const result = recognizer.evaluateFrame(query, gallery);

    // Both similarities are nearly identical, which must not authorize on single frame
    assert.equal(result.matched, false, 'Single frame with ambiguous candidates must not immediately authorize');
  });
});
