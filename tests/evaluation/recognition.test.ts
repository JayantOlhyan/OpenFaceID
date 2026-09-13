import test from 'node:test';
import assert from 'node:assert';
import { FaceRecognizer } from '../../packages/vision/src/recognizer.ts';
import { ArcFaceEmbedder } from '../../packages/vision/src/embedder.ts';
import type { EnrolledIdentity } from '../../packages/vision/src/interfaces.ts';

test('Biometric Recognition & Gallery Discrimination Evaluation', async (t) => {
  const embedder = new ArcFaceEmbedder();

  function createDeterministicEmbedding(seed: number): Float32Array {
    const vec = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      vec[i] = Math.sin((seed + 1) * (i + 1) * 0.1) + Math.cos((seed + 2) * (i + 1) * 0.05);
    }
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < 512; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    for (let i = 0; i < 512; i++) vec[i] /= norm;
    return vec;
  }

  function addPerturbation(base: Float32Array, noiseMagnitude: number = 0.1): Float32Array {
    const perturbed = new Float32Array(base.length);
    for (let i = 0; i < base.length; i++) {
      perturbed[i] = base[i] + (Math.sin(i * 1.7) * noiseMagnitude);
    }
    let norm = 0;
    for (let i = 0; i < perturbed.length; i++) norm += perturbed[i] * perturbed[i];
    norm = Math.sqrt(norm);
    for (let i = 0; i < perturbed.length; i++) perturbed[i] /= norm;
    return perturbed;
  }

  const aliceBase = createDeterministicEmbedding(101);
  const alicePoses = [
    aliceBase,
    addPerturbation(aliceBase, 0.08), // Slight head turn left
    addPerturbation(aliceBase, 0.09), // Slight head turn right
    addPerturbation(aliceBase, 0.07), // Slight tilt
  ];

  const bobBase = createDeterministicEmbedding(999);
  const bobPoses = [
    bobBase,
    addPerturbation(bobBase, 0.08),
  ];

  const gallery: EnrolledIdentity[] = [
    {
      id: 'id_alice',
      name: 'Alice',
      embeddings: alicePoses,
      averageEmbedding: aliceBase,
      enrolledAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    },
    {
      id: 'id_bob',
      name: 'Bob',
      embeddings: bobPoses,
      averageEmbedding: bobBase,
      enrolledAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true,
    },
  ];

  await t.test('Inter-identity separation between Alice and Bob is verified', () => {
    const interSim = embedder.calculateCosineSimilarity(aliceBase, bobBase);
    assert.ok(
      interSim < 0.35,
      `Expected distinct synthetic identities to have low similarity, got: ${interSim}`
    );
  });

  await t.test('Temporal window requires requiredMatches (4/5) before granting match', () => {
    const recognizer = new FaceRecognizer({ threshold: 0.70, windowSize: 5, requiredMatches: 4 });
    const aliceProbe = addPerturbation(aliceBase, 0.05);

    // Frame 1
    const res1 = recognizer.evaluateFrame(aliceProbe, gallery);
    assert.strictEqual(res1.matched, false, 'Frame 1: 1/4 matches must not grant authorization');
    assert.strictEqual(res1.frameCount, 1);

    // Frame 2
    const res2 = recognizer.evaluateFrame(aliceProbe, gallery);
    assert.strictEqual(res2.matched, false, 'Frame 2: 2/4 matches must not grant authorization');
    assert.strictEqual(res2.frameCount, 2);

    // Frame 3
    const res3 = recognizer.evaluateFrame(aliceProbe, gallery);
    assert.strictEqual(res3.matched, false, 'Frame 3: 3/4 matches must not grant authorization');
    assert.strictEqual(res3.frameCount, 3);

    // Frame 4 (Should now reach requiredMatches: 4/5)
    const res4 = recognizer.evaluateFrame(aliceProbe, gallery);
    assert.strictEqual(res4.matched, true, 'Frame 4: 4/4 matches MUST grant authorization');
    assert.strictEqual(res4.identityId, 'id_alice');
    assert.strictEqual(res4.identityName, 'Alice');
    assert.ok(res4.similarity >= 0.70);
  });

  await t.test('Gallery discrimination: Alice probe does not match Bob, Bob probe does not match Alice', () => {
    const recAlice = new FaceRecognizer({ threshold: 0.70, windowSize: 1, requiredMatches: 1 });
    const recBob = new FaceRecognizer({ threshold: 0.70, windowSize: 1, requiredMatches: 1 });

    const aliceProbe = addPerturbation(aliceBase, 0.05);
    const bobProbe = addPerturbation(bobBase, 0.05);

    const matchAlice = recAlice.evaluateFrame(aliceProbe, gallery);
    assert.strictEqual(matchAlice.matched, true);
    assert.strictEqual(matchAlice.identityId, 'id_alice');

    const matchBob = recBob.evaluateFrame(bobProbe, gallery);
    assert.strictEqual(matchBob.matched, true);
    assert.strictEqual(matchBob.identityId, 'id_bob');
  });

  await t.test('Impostor identity (Charlie) is completely rejected across all frames', () => {
    const charlieBase = createDeterministicEmbedding(4321);
    const recognizer = new FaceRecognizer({ threshold: 0.70, windowSize: 5, requiredMatches: 4 });

    for (let frame = 1; frame <= 10; frame++) {
      const probe = addPerturbation(charlieBase, 0.04);
      const res = recognizer.evaluateFrame(probe, gallery);
      assert.strictEqual(res.matched, false, `Impostor must be rejected on frame ${frame}`);
      assert.strictEqual(res.isUnknown, true);
    }
  });

  await t.test('Disabled enrolled identity is omitted from matching', () => {
    const disabledGallery: EnrolledIdentity[] = [
      {
        ...gallery[0],
        enabled: false,
      },
      gallery[1],
    ];

    const recognizer = new FaceRecognizer({ threshold: 0.70, windowSize: 1, requiredMatches: 1 });
    const aliceProbe = addPerturbation(aliceBase, 0.05);

    const res = recognizer.evaluateFrame(aliceProbe, disabledGallery);
    assert.strictEqual(res.matched, false, 'Disabled identity must not be recognized');
    assert.strictEqual(res.isUnknown, true);
  });

  await t.test('Empty gallery safely returns unknown without exceptions', () => {
    const recognizer = new FaceRecognizer();
    const probe = createDeterministicEmbedding(1234);

    const res = recognizer.evaluateFrame(probe, []);
    assert.strictEqual(res.matched, false);
    assert.strictEqual(res.isUnknown, true);
    assert.strictEqual(res.similarity, 0);
  });
});
