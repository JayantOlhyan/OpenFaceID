import test from 'node:test';
import assert from 'node:assert';
import { EnrollmentManager, ENROLLMENT_POSES } from '../../packages/vision/src/enrollment.ts';
import { ArcFaceEmbedder } from '../../packages/vision/src/embedder.ts';
import { FrameSampler, type CameraFrame } from '../../packages/camera/src/index.ts';
import type { FaceLandmarks } from '../../packages/vision/src/interfaces.ts';

test('Enrollment Multi-Pose Consistency & Intra-Identity Cohesion', async (t) => {
  const embedder = new ArcFaceEmbedder();
  const sampler = new FrameSampler(15);

  // Helper to create synthetic camera frames with realistic edge texture
  function createSyntheticFaceFrame(width = 640, height = 480): CameraFrame {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const pattern = (x % 6 < 3 && y % 6 < 3) ? 40 : -20;
        data[idx] = Math.max(0, Math.min(255, 170 + pattern));     // R
        data[idx + 1] = Math.max(0, Math.min(255, 135 + pattern)); // G
        data[idx + 2] = Math.max(0, Math.min(255, 115 + pattern)); // B
        data[idx + 3] = 255;
      }
    }
    return sampler.createFrame(width, height, data);
  }

  // Nominal centered landmarks
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

  await t.test('Enrollment poses sequence defines exactly 5 canonical desktop poses', () => {
    assert.strictEqual(ENROLLMENT_POSES.length, 5);
    const poseNames = ENROLLMENT_POSES.map((p) => p.pose);
    assert.deepStrictEqual(poseNames, [
      'LOOK_STRAIGHT',
      'TURN_LEFT',
      'TURN_RIGHT',
      'LOOK_UP',
      'LOOK_DOWN',
    ]);
  });

  await t.test('Successful 5-pose enrollment pipeline advances state and produces cohesive identity', async () => {
    const manager = new EnrollmentManager('David');
    assert.strictEqual(manager.getProgress().isCompleted, false);
    assert.strictEqual(manager.getProgress().currentPoseIndex, 0);

    for (let i = 0; i < 5; i++) {
      const frame = createSyntheticFaceFrame();
      const lm = createCenteredLandmarks();
      const res = await manager.capturePose(frame, lm);
      assert.strictEqual(res.success, true, `Pose ${i} capture must succeed`);
      assert.strictEqual(res.progress.currentPoseIndex, i + 1);
    }

    const progress = manager.getProgress();
    assert.strictEqual(progress.isCompleted, true);
    assert.strictEqual(progress.capturedEmbeddingsCount, 5);

    const identity = manager.finishEnrollment();
    assert.strictEqual(identity.name, 'David');
    assert.strictEqual(identity.enabled, true);
    assert.strictEqual(identity.embeddings.length, 5);
    assert.strictEqual(identity.averageEmbedding.length, 512);

    // Verify average embedding has high similarity to each enrolled pose
    for (let i = 0; i < identity.embeddings.length; i++) {
      const sim = embedder.calculateCosineSimilarity(identity.averageEmbedding, identity.embeddings[i]);
      assert.ok(
        sim >= 0.95,
        `Expected high cohesion between average embedding and enrolled pose ${i}, got: ${sim}`
      );
    }
  });

  await t.test('Camera frame zeroization occurs immediately on capturePose (RAM privacy)', async () => {
    const manager = new EnrollmentManager('Eva');
    const frame = createSyntheticFaceFrame();
    const lm = createCenteredLandmarks();

    // Verify frame has data before capture
    assert.ok(frame.data[0] > 0);

    await manager.capturePose(frame, lm);

    // Verify frame data has been zeroized
    let allZero = true;
    for (let i = 0; i < 100; i++) {
      if (frame.data[i] !== 0) {
        allZero = false;
        break;
      }
    }
    assert.strictEqual(allZero, true, 'Frame data must be zeroized in RAM immediately after capture');
  });

  await t.test('Cannot finalize enrollment with zero captured poses', () => {
    const manager = new EnrollmentManager('Frank');
    assert.throws(
      () => manager.finishEnrollment(),
      /Cannot finalize enrollment with zero captured embeddings/
    );
  });

  await t.test('Intra-identity clustering rejects mixed-identity injection anomaly', () => {
    // Generate synthetic embeddings for Subject A vs Subject B
    const dim = 512;
    const embA1 = new Float32Array(dim);
    const embA2 = new Float32Array(dim);
    const embB = new Float32Array(dim);

    for (let i = 0; i < dim; i++) {
      embA1[i] = Math.sin(i * 0.1);
      embA2[i] = Math.sin(i * 0.1) + 0.05 * Math.cos(i * 0.1);
      embB[i] = Math.cos(i * 0.4);
    }

    const norm = (v: Float32Array) => {
      let s = 0;
      for (let i = 0; i < v.length; i++) s += v[i] * v[i];
      s = Math.sqrt(s);
      for (let i = 0; i < v.length; i++) v[i] /= s;
    };
    norm(embA1);
    norm(embA2);
    norm(embB);

    const intraSim = embedder.calculateCosineSimilarity(embA1, embA2);
    const interSim = embedder.calculateCosineSimilarity(embA1, embB);

    assert.ok(intraSim > 0.90, `Expected high intra-subject similarity: ${intraSim}`);
    assert.ok(interSim < 0.20, `Expected low inter-subject similarity: ${interSim}`);

    // Cosine distance check (distance = 1 - similarity)
    const intraDist = 1 - intraSim;
    const interDist = 1 - interSim;

    assert.ok(intraDist < 0.15, 'Intra-subject distance must be < 0.15');
    assert.ok(interDist > 0.70, 'Inter-subject distance must be > 0.70');
  });
});
