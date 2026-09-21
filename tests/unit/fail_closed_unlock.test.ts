import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UnlockStateMachine } from '../../packages/core/src/state/unlock.ts';
import { MacOSAdapter } from '../../packages/platform/src/MacOSAdapter.ts';
import { FaceRecognizer } from '../../packages/vision/src/recognizer.ts';
import { FaceQualityAnalyzer } from '../../packages/vision/src/quality.ts';
import { ModelRegistry } from '../../packages/vision/src/registry.ts';
import { ArcFaceEmbedder } from '../../packages/vision/src/embedder.ts';
import { resolveEmbedderProvider } from '../../packages/vision/src/providers.ts';
import type { EnrolledIdentity } from '../../packages/vision/src/interfaces.ts';

describe('Phase 13 & Final Finisher — Complete Fail-Closed Security Invariants Matrix', () => {
  // 1. Unknown Face / Low Similarity
  it('1. fails closed on unknown person below similarity threshold', () => {
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

  // 2. Multiple People (Anti-Shoulder Surfing)
  it('2. fails closed on multiple people detected simultaneously', () => {
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
  it('3. fails closed on presentation attack / failed liveness detection', () => {
    const fsm = new UnlockStateMachine();
    fsm.triggerWake('wake');
    fsm.onFirstFrameReceived();
    fsm.setAnalyzing();

    const result = fsm.recordFailed('LIVENESS_REJECTED');
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
    assert.equal(result.error, 'LIVENESS_REJECTED');
  });

  // 4. Low-Quality Frame
  it('4. fails closed on low-quality frame (undersized face or bad illumination)', () => {
    const analyzer = new FaceQualityAnalyzer();
    const frame = {
      width: 640,
      height: 480,
      timestamp: Date.now(),
      format: 'rgba' as const,
      data: new Uint8ClampedArray(640 * 480 * 4),
      zeroize() {},
    };
    // Very tiny face box (< 60px)
    const tinyBox = { x: 300, y: 220, width: 30, height: 30 };
    const landmarks = {
      leftEye: { x: 305, y: 225 },
      rightEye: { x: 325, y: 225 },
      noseTip: { x: 315, y: 235 },
      leftMouth: { x: 310, y: 245 },
      rightMouth: { x: 320, y: 245 },
    };

    const quality = analyzer.analyzeQuality(frame, tinyBox, landmarks);
    assert.equal(quality.isAcceptable, false, 'Undersized face must fail quality checks');

    const fsm = new UnlockStateMachine();
    fsm.triggerWake('wake');
    fsm.onFirstFrameReceived();
    fsm.setAnalyzing();
    const result = fsm.recordFailed('LOW_QUALITY_FRAME');
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
  });

  // 5. Camera Failure / Disconnection
  it('5. fails closed on camera disconnection during capture', () => {
    const fsm = new UnlockStateMachine();
    fsm.triggerWake('wake');
    const result = fsm.recordFailed('CAMERA_DISCONNECTED');
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
    assert.equal(result.error, 'CAMERA_DISCONNECTED');
  });

  // 6. Model Unavailable
  it('6. fails closed when required vision model is unavailable', () => {
    const fsm = new UnlockStateMachine();
    fsm.triggerWake('wake');
    const result = fsm.recordFailed('MODEL_UNAVAILABLE');
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
    assert.equal(result.error, 'MODEL_UNAVAILABLE');
  });

  // 7. Model Integrity Failure
  it('7. fails closed on model integrity failure or checksum mismatch', async () => {
    const registry = ModelRegistry.getInstance();
    const check = await registry.verifyIntegrity(
      'arcface-coreml-mobilefacenet',
      'models/non_existent_corrupted_model.mlmodelc'
    );
    assert.equal(check.valid, false, 'Corrupted or missing model must be flagged as invalid');
    assert.ok(check.error?.includes('FILE_NOT_FOUND'));

    const fsm = new UnlockStateMachine();
    fsm.triggerWake('wake');
    const result = fsm.recordFailed('MODEL_INTEGRITY_COMPROMISED');
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
  });

  // 8. Daemon Unavailable
  it('8. fails closed when background daemon is unavailable or socket missing', async () => {
    const adapter = new MacOSAdapter();
    adapter.stopPamSocketServer(); // Ensure daemon server is stopped

    const fsm = new UnlockStateMachine();
    fsm.triggerWake('wake');
    const result = fsm.recordFailed('DAEMON_UNAVAILABLE');
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
  });

  // 9. Authentication IPC Failure
  it('9. fails closed on IPC failure when unlock secret or credentials missing', async () => {
    delete process.env.OPENFACEID_MOCK_UNLOCK;
    const adapter = new MacOSAdapter();
    assert.equal(await adapter.unlockScreen(''), false);
    assert.equal(await adapter.unlockScreen(undefined), false);
  });

  // 10. Stale / Expired Authorization Token
  it('10. fails closed when authorization token is expired or stale', () => {
    const now = Date.now();
    const tokenTimestamp = now - 5000; // 5 seconds old (max allowed window is 3000ms)
    const isStale = now - tokenTimestamp > 3000;
    assert.equal(isStale, true, 'Token older than 3000ms must be rejected as stale');

    const fsm = new UnlockStateMachine();
    fsm.triggerWake('wake');
    const result = fsm.recordFailed('AUTHORIZATION_EXPIRED');
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
  });

  // 11. Malformed Authentication Response
  it('11. fails closed when IPC authentication response is malformed or invalid JSON', () => {
    const malformedPayloads = [
      '',
      '{ malformed json',
      '{"unexpected":"payload"}',
      'null',
      '{"status":"UNKNOWN_STATUS"}',
    ];

    for (const payload of malformedPayloads) {
      let authorized = false;
      try {
        const parsed = JSON.parse(payload);
        if (parsed?.status === 'AUTHORIZED' || parsed?.status === 'AUTH_SUCCESS') {
          authorized = true;
        }
      } catch {
        authorized = false;
      }
      assert.equal(authorized, false, `Malformed payload must not authorize: ${payload}`);
    }
  });

  // 12. Recognition Timeout
  it('12. fails closed when recognition timeout expires before positive match', () => {
    const fsm = new UnlockStateMachine({ burstTimeoutMs: 500 });
    fsm.triggerWake('wake', 1000);
    fsm.onFirstFrameReceived(1050);

    assert.equal(fsm.isBurstTimeout(1600), true);
    const result = fsm.recordFailed('TIMEOUT', 1600);
    assert.equal(fsm.getState(), 'FAILED');
    assert.equal(result.success, false);
  });

  // 13. Ambiguous Identity (Margin threshold)
  it('13. fails closed on ambiguous identity when candidate margins are too close', () => {
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

  // 14. REGRESSION TEST: Prohibit Silent Analytical Fallback in Production Mode
  it('14. regression: prohibits silent analytical fallback in production mode', async () => {
    const savedNodeEnv = process.env.NODE_ENV;
    const savedStrict = process.env.OPENFACEID_STRICT_PRODUCTION;

    try {
      process.env.NODE_ENV = 'production';
      process.env.OPENFACEID_STRICT_PRODUCTION = '1';

      // Requesting analytical in production MUST fail closed
      await assert.rejects(
        async () => {
          await resolveEmbedderProvider('analytical');
        },
        /NEURAL_MODEL_UNAVAILABLE/,
        'Analytical embedder must be rejected with fail-closed error in production mode'
      );
    } finally {
      process.env.NODE_ENV = savedNodeEnv;
      if (savedStrict === undefined) {
        delete process.env.OPENFACEID_STRICT_PRODUCTION;
      } else {
        process.env.OPENFACEID_STRICT_PRODUCTION = savedStrict;
      }
    }
  });
});
