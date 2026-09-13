import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { EnrollmentManager } from '../../packages/vision/src/enrollment.ts';
import { IdentityStore } from '../../packages/storage/src/IdentityStore.ts';
import { FrameSampler, type CameraFrame } from '../../packages/camera/src/index.ts';
import type { FaceLandmarks } from '../../packages/vision/src/interfaces.ts';

test('Biometric Profile & Model Versioning (Section 51)', async (t) => {
  const testDir = path.join(os.tmpdir(), `openfaceid-test-versioning-${Date.now()}`);
  const store = new IdentityStore(testDir);
  const sampler = new FrameSampler(15);

  function createTestFrame(width = 640, height = 480): CameraFrame {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const pattern = (x % 6 < 3 && y % 6 < 3) ? 40 : -20;
        data[idx] = 160 + pattern;
        data[idx + 1] = 130 + pattern;
        data[idx + 2] = 110 + pattern;
        data[idx + 3] = 255;
      }
    }
    return sampler.createFrame(width, height, data);
  }

  function createCenteredLandmarks(width = 640, height = 480): FaceLandmarks {
    const cx = width / 2;
    const cy = height / 2;
    return {
      leftEye: { x: cx - 45, y: cy - 25 },
      rightEye: { x: cx + 45, y: cy - 25 },
      noseTip: { x: cx, y: cy + 5 },
      leftMouth: { x: cx - 35, y: cy + 45 },
      rightMouth: { x: cx + 35, y: cy + 45 },
      leftEar: { x: cx - 90, y: cy - 10 },
      rightEar: { x: cx + 90, y: cy - 10 },
    };
  }

  t.after(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {}
  });

  await t.test('Enrollment produces identity with complete model metadata', async () => {
    const manager = new EnrollmentManager('Grace Hopper');

    for (let i = 0; i < 5; i++) {
      const frame = createTestFrame();
      const lm = createCenteredLandmarks();
      const res = await manager.capturePose(frame, lm);
      assert.strictEqual(res.success, true);
    }

    const identity = manager.finishEnrollment();
    assert.ok(identity.modelMetadata, 'Identity MUST include modelMetadata');
    assert.strictEqual(identity.modelMetadata.modelId, 'arcface-analytical-512d');
    assert.strictEqual(identity.modelMetadata.modelVersion, '1.0.0');
    assert.strictEqual(identity.modelMetadata.embeddingDim, 512);
    assert.strictEqual(identity.modelMetadata.embeddingFormat, 'float32-l2-normalized');
    assert.strictEqual(identity.modelMetadata.normalization, 'unit-hypersphere-l2');
    assert.strictEqual(identity.modelMetadata.creationVersion, '0.2.0');
  });

  await t.test('IdentityStore safely persists and restores model metadata', async () => {
    const emb = new Float32Array(512);
    emb[0] = 1.0;

    const identity = {
      id: 'usr_test_meta',
      name: 'Ada Lovelace',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      embeddings: [emb],
      averageEmbedding: emb,
      recognitionStats: { matchCount: 0 },
      modelMetadata: {
        modelId: 'arcface-analytical-512d',
        modelVersion: '1.0.0',
        embeddingDim: 512,
        embeddingFormat: 'float32-l2-normalized',
        normalization: 'unit-hypersphere-l2',
        creationVersion: '0.2.0',
      },
    };

    const saved = await store.saveIdentity(identity);
    assert.strictEqual(saved, true);

    const loaded = await store.getIdentity('usr_test_meta');
    assert.ok(loaded !== null);
    assert.strictEqual(loaded.name, 'Ada Lovelace');
    assert.ok(loaded.modelMetadata);
    assert.strictEqual(loaded.modelMetadata.modelId, 'arcface-analytical-512d');
    assert.strictEqual(loaded.modelMetadata.embeddingDim, 512);
  });

  await t.test('IdentityStore rejects profile with incompatible embedding dimension', async () => {
    const emb = new Float32Array(512);
    emb[0] = 1.0;

    const corruptedProfile = {
      id: 'usr_incompatible_dim',
      name: 'Corrupted Profile',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      embeddings: [emb],
      averageEmbedding: emb,
      recognitionStats: { matchCount: 0 },
      modelMetadata: {
        modelId: 'arcface-analytical-512d',
        modelVersion: '1.0.0',
        embeddingDim: 128, // Incompatible dimension!
        embeddingFormat: 'float32-l2-normalized',
        normalization: 'unit-hypersphere-l2',
        creationVersion: '0.2.0',
      },
    };

    const saved = await store.saveIdentity(corruptedProfile);
    assert.strictEqual(saved, true);

    // When loading, IdentityStore must reject incompatible dimension
    const loaded = await store.getIdentity('usr_incompatible_dim');
    assert.strictEqual(loaded, null, 'Identity with incompatible dimension must be rejected upon load');
  });
});
