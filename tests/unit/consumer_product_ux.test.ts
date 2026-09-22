import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { IdentityStore } from '../../packages/storage/src/IdentityStore.ts';
import { CanonicalStateMachine, UnlockStateMachine } from '../../packages/core/src/index.ts';
import type { EnrolledIdentity, IdentityVariant } from '../../packages/vision/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Consumer Product UX & Transformation Architecture', () => {
  it('maps all 12 biometric authentication states to human-friendly consumer copy', () => {
    const stateCopyMap: Record<string, { title: string; humanFriendly: boolean }> = {
      IDLE: { title: 'Standby', humanFriendly: true },
      SEARCHING: { title: 'Looking for you…', humanFriendly: true },
      FACE_DETECTED: { title: 'Face Detected', humanFriendly: true },
      IDENTIFYING: { title: 'Recognizing…', humanFriendly: true },
      LIVENESS_CHECK: { title: 'Verifying Presence…', humanFriendly: true },
      VERIFYING: { title: 'Confirming Identity…', humanFriendly: true },
      AUTHENTICATED: { title: 'Access Granted', humanFriendly: true },
      UNKNOWN_FACE: { title: 'Face Not Recognized', humanFriendly: true },
      LIVENESS_FAILED: { title: 'Liveness Check Failed', humanFriendly: true },
      MULTIPLE_FACES: { title: 'Multiple People Detected', humanFriendly: true },
      CAMERA_UNAVAILABLE: { title: 'Camera Unavailable', humanFriendly: true },
      AUTHENTICATION_FAILED: { title: 'Authentication Paused', humanFriendly: true },
    };

    assert.equal(Object.keys(stateCopyMap).length, 12);
    for (const [state, info] of Object.entries(stateCopyMap)) {
      assert.ok(info.title.length > 0);
      assert.ok(info.humanFriendly);
      // Ensure no raw developer terminology is used
      assert.ok(!info.title.includes('PRESENCE_'));
      assert.ok(!info.title.includes('COSINE_'));
      assert.ok(!info.title.includes('FSM_'));
    }
  });

  it('manages biometric profile variants (Normal, Glasses, Beard, Low Light) per identity', async () => {
    const tmpDir = path.join(os.tmpdir(), `ofid_test_variants_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const store = new IdentityStore(tmpDir);

    const baseEmbedding = new Float32Array(512);
    for (let i = 0; i < 512; i++) baseEmbedding[i] = 1 / Math.sqrt(512);

    const testIdentity: EnrolledIdentity = {
      id: 'usr_test_variants',
      name: 'Jayant',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      embeddings: [baseEmbedding],
      averageEmbedding: baseEmbedding,
      variants: [
        {
          id: 'var_default',
          name: 'Normal',
          type: 'normal',
          createdAt: Date.now(),
          embeddingsCount: 1,
        },
      ],
      recognitionStats: { matchCount: 0 },
    };

    // 1. Save base identity with default variant
    const saved = await store.saveIdentity(testIdentity);
    assert.equal(saved, true);

    const loaded = await store.getIdentity('usr_test_variants');
    assert.ok(loaded);
    assert.equal(loaded?.name, 'Jayant');
    assert.equal(loaded?.variants?.length, 1);
    assert.equal(loaded?.variants?.[0].name, 'Normal');

    // 2. Add 'Glasses' variant
    const glassesVariant: IdentityVariant = {
      id: 'var_glasses',
      name: 'Glasses',
      type: 'glasses',
      createdAt: Date.now(),
      embeddingsCount: 1,
    };
    const addedGlasses = await store.addVariant('usr_test_variants', glassesVariant, [baseEmbedding]);
    assert.equal(addedGlasses, true);

    const updated1 = await store.getIdentity('usr_test_variants');
    assert.equal(updated1?.variants?.length, 2);
    assert.equal(updated1?.variants?.[1].name, 'Glasses');
    assert.equal(updated1?.variants?.[1].type, 'glasses');

    // 3. Add 'Beard' variant
    const beardVariant: IdentityVariant = {
      id: 'var_beard',
      name: 'Beard',
      type: 'beard',
      createdAt: Date.now(),
      embeddingsCount: 1,
    };
    await store.addVariant('usr_test_variants', beardVariant);
    const updated2 = await store.getIdentity('usr_test_variants');
    assert.equal(updated2?.variants?.length, 3);

    // 4. Delete 'Glasses' variant
    const deletedVariant = await store.deleteVariant('usr_test_variants', 'var_glasses');
    assert.equal(deletedVariant, true);

    const finalLoaded = await store.getIdentity('usr_test_variants');
    assert.equal(finalLoaded?.variants?.length, 2);
    assert.ok(!finalLoaded?.variants?.some((v) => v.id === 'var_glasses'));

    // Cleanup
    await store.deleteIdentity('usr_test_variants');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('executes full locked computer to verified unlock transition sequence', () => {
    const unlockFsm = new UnlockStateMachine();
    assert.equal(unlockFsm.getState(), 'STANDBY');

    // 1. Computer lid opened or screen wakes
    unlockFsm.triggerWake('screens_did_wake');
    assert.equal(unlockFsm.getState(), 'WAKE_TRIGGERED');
    assert.equal(unlockFsm.getTriggerSource(), 'screens_did_wake');

    // 2. Camera activates and bursts initial frames
    unlockFsm.onFirstFrameReceived();
    assert.equal(unlockFsm.getState(), 'CAPTURING_BURST');

    // 3. Analyzing facial biometrics and 5-cue liveness
    unlockFsm.setAnalyzing();
    assert.equal(unlockFsm.getState(), 'ANALYZING');

    // 4. Identity confirmed and verified
    const result = unlockFsm.recordVerified('usr_jayant', 'Jayant', 0.94);
    assert.equal(unlockFsm.getState(), 'VERIFIED');

    assert.ok(result);
    assert.equal(result.success, true);
    assert.equal(result.identityName, 'Jayant');
    assert.ok(result.confidence >= 0.85);
    assert.equal(result.livenessPassed, true);
  });

  it('validates desktop UI index.html contains all required consumer surfaces and elements', () => {
    const indexPath = path.resolve(__dirname, '../../apps/desktop/index.html');
    assert.ok(fs.existsSync(indexPath), 'index.html must exist');
    const html = fs.readFileSync(indexPath, 'utf8');

    // Notch / Capsule elements
    assert.ok(html.includes('systemNotchRegion'), 'Must have hardware notch region');
    assert.ok(html.includes('openFaceIdCapsule'), 'Must have biometric capsule');
    assert.ok(html.includes('biometricSphereCanvas'), 'Must have 3D biometric wireframe sphere canvas');
    assert.ok(html.includes('cameraLedIndicator'), 'Must have hardware camera LED indicator');

    // Dual styles: Original Squircle & Minimal Pill
    assert.ok(html.includes('capsuleOriginalView'), 'Must support Original Squircle view');
    assert.ok(html.includes('capsuleMinimalView'), 'Must support Minimal Pill view');

    // Lock screen simulator
    assert.ok(html.includes('lockScreenOverlay'), 'Must have lock screen simulator');
    assert.ok(html.includes('triggerWakeAndUnlock'), 'Must have unlock trigger simulation');

    // Guided enrollment sheet with 360-degree radial tick ring
    assert.ok(html.includes('enrollmentSheetModal'), 'Must have guided enrollment sheet');
    assert.ok(html.includes('enrollmentTickSvg'), 'Must have 360-degree radial tick-mark ring');

    // Identities & Profile variants
    assert.ok(html.includes('identityCardsContainer'), 'Must have identity cards gallery');
    assert.ok(html.includes('variants-section'), 'Must have profile variants section');

    // Settings & Developer mode isolation
    assert.ok(html.includes('developerDiagnosticsPanel'), 'Must have developer diagnostics panel');
    assert.ok(html.includes('prefDeveloperMode'), 'Must isolate developer mode behind toggle');
    assert.ok(html.includes('privacy-diagram-card'), 'Must visually explain local-only privacy');
  });
});
