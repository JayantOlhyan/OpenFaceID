import test from 'node:test';
import assert from 'node:assert';
import { FaceRecognizer } from '../../packages/vision/src/recognizer.ts';
import type { EnrolledIdentity } from '../../packages/vision/src/interfaces.ts';

test('Threshold Semantics & Calibration Preset Verification', async (t) => {
  // Helper to construct synthetic normalized embeddings
  function createOrthogonalEmbedding(dim: number = 512, activeIndex: number = 0): Float32Array {
    const vec = new Float32Array(dim);
    vec[activeIndex] = 1.0;
    return vec;
  }

  // Create an embedding with a controlled cosine similarity to a reference embedding
  function createControlledSimilarityEmbedding(reference: Float32Array, targetSimilarity: number): Float32Array {
    const dim = reference.length;
    const ortho = new Float32Array(dim);
    // Find orthogonal component (assuming reference is unit vector along index 0)
    ortho[1] = 1.0;

    const result = new Float32Array(dim);
    const s = Math.max(-1.0, Math.min(1.0, targetSimilarity));
    const perpFactor = Math.sqrt(Math.max(0, 1.0 - s * s));

    for (let i = 0; i < dim; i++) {
      result[i] = reference[i] * s + ortho[i] * perpFactor;
    }

    // Verify unit length
    let norm = 0;
    for (let i = 0; i < dim; i++) norm += result[i] * result[i];
    norm = Math.sqrt(norm);
    for (let i = 0; i < dim; i++) result[i] /= norm;

    return result;
  }

  await t.test('Recognition Presets are strictly monotonic (Balanced < Strict < Very Strict)', () => {
    const PRESET_BALANCED = 0.70;
    const PRESET_STRICT = 0.80;
    const PRESET_VERY_STRICT = 0.88;

    assert.ok(
      PRESET_BALANCED < PRESET_STRICT,
      `Expected Balanced (${PRESET_BALANCED}) < Strict (${PRESET_STRICT})`
    );
    assert.ok(
      PRESET_STRICT < PRESET_VERY_STRICT,
      `Expected Strict (${PRESET_STRICT}) < Very Strict (${PRESET_VERY_STRICT})`
    );
  });

  await t.test('Higher threshold strictly enforces higher similarity (monotonic rejection)', () => {
    const ref = createOrthogonalEmbedding(512, 0);
    const gallery: EnrolledIdentity[] = [
      {
        id: 'user_alice',
        name: 'Alice',
        embeddings: [ref],
        averageEmbedding: ref,
        enrolledAt: Date.now(),
        updatedAt: Date.now(),
        enabled: true,
      },
    ];

    // Probe with similarity = 0.75
    const probe75 = createControlledSimilarityEmbedding(ref, 0.75);

    // Recognizer at Balanced (0.70)
    const recognizerBalanced = new FaceRecognizer({ threshold: 0.70, windowSize: 1, requiredMatches: 1 });
    const resBalanced = recognizerBalanced.evaluateFrame(probe75, gallery);
    assert.strictEqual(resBalanced.matched, true, 'Probe with similarity 0.75 MUST match under Balanced (0.70)');

    // Recognizer at Strict (0.80)
    const recognizerStrict = new FaceRecognizer({ threshold: 0.80, windowSize: 1, requiredMatches: 1 });
    const resStrict = recognizerStrict.evaluateFrame(probe75, gallery);
    assert.strictEqual(resStrict.matched, false, 'Probe with similarity 0.75 MUST BE REJECTED under Strict (0.80)');

    // Recognizer at Very Strict (0.88)
    const recognizerVeryStrict = new FaceRecognizer({ threshold: 0.88, windowSize: 1, requiredMatches: 1 });
    const resVeryStrict = recognizerVeryStrict.evaluateFrame(probe75, gallery);
    assert.strictEqual(resVeryStrict.matched, false, 'Probe with similarity 0.75 MUST BE REJECTED under Very Strict (0.88)');
  });

  await t.test('Probe with similarity 0.84 passes Balanced and Strict, but fails Very Strict', () => {
    const ref = createOrthogonalEmbedding(512, 0);
    const gallery: EnrolledIdentity[] = [
      {
        id: 'user_alice',
        name: 'Alice',
        embeddings: [ref],
        averageEmbedding: ref,
        enrolledAt: Date.now(),
        updatedAt: Date.now(),
        enabled: true,
      },
    ];

    const probe84 = createControlledSimilarityEmbedding(ref, 0.84);

    const recBalanced = new FaceRecognizer({ threshold: 0.70, windowSize: 1, requiredMatches: 1 });
    assert.strictEqual(recBalanced.evaluateFrame(probe84, gallery).matched, true);

    const recStrict = new FaceRecognizer({ threshold: 0.80, windowSize: 1, requiredMatches: 1 });
    assert.strictEqual(recStrict.evaluateFrame(probe84, gallery).matched, true);

    const recVeryStrict = new FaceRecognizer({ threshold: 0.88, windowSize: 1, requiredMatches: 1 });
    assert.strictEqual(recVeryStrict.evaluateFrame(probe84, gallery).matched, false);
  });

  await t.test('REGRESSION CHECK: A threshold of 0.58 is LOOSER than 0.70 and fails security contract', () => {
    const ref = createOrthogonalEmbedding(512, 0);
    const gallery: EnrolledIdentity[] = [
      {
        id: 'user_alice',
        name: 'Alice',
        embeddings: [ref],
        averageEmbedding: ref,
        enrolledAt: Date.now(),
        updatedAt: Date.now(),
        enabled: true,
      },
    ];

    // Marginal impostor or poor match with similarity 0.62
    const probe62 = createControlledSimilarityEmbedding(ref, 0.62);

    // Under legitimate Balanced (0.70), this probe is rejected
    const recBalanced = new FaceRecognizer({ threshold: 0.70, windowSize: 1, requiredMatches: 1 });
    assert.strictEqual(
      recBalanced.evaluateFrame(probe62, gallery).matched,
      false,
      'Similarity 0.62 must be rejected by Balanced (0.70)'
    );

    // If a flawed implementation sets threshold = 0.58 as "Very Strict", the impostor passes!
    const recFlawed = new FaceRecognizer({ threshold: 0.58, windowSize: 1, requiredMatches: 1 });
    const flawedResult = recFlawed.evaluateFrame(probe62, gallery);
    assert.strictEqual(
      flawedResult.matched,
      true,
      'A threshold of 0.58 erroneously accepts similarity 0.62, proving 0.58 is NOT stricter than 0.70'
    );
  });

  await t.test('Threshold clamping enforces secure range [0.50, 0.98]', () => {
    const recognizer = new FaceRecognizer();

    recognizer.setThreshold(0.1);
    assert.strictEqual(recognizer.getThreshold(), 0.50, 'Values below 0.50 must clamp to 0.50');

    recognizer.setThreshold(1.5);
    assert.strictEqual(recognizer.getThreshold(), 0.98, 'Values above 0.98 must clamp to 0.98');

    recognizer.setThreshold(0.85);
    assert.strictEqual(recognizer.getThreshold(), 0.85, 'Valid intermediate value must be preserved');
  });
});
