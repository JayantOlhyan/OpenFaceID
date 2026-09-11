import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ModelRegistry, REGISTERED_MODELS } from '../../packages/vision/src/index.ts';

describe('ModelRegistry & Cryptographic Integrity (Phase 4)', () => {
  const registry = ModelRegistry.getInstance();

  it('lists registered production models with complete metadata', () => {
    const models = registry.listModels();
    assert.ok(models.length >= 3);

    const detector = registry.getModelMetadata('blazeface-detector');
    assert.ok(detector);
    assert.equal(detector.type, 'detector');
    assert.equal(detector.codeLicense, 'Apache-2.0');
    assert.ok(detector.sha256.length === 64);

    const embedder = registry.getModelMetadata('arcface-embedder');
    assert.ok(embedder);
    assert.equal(embedder.type, 'embedder');
    assert.equal(embedder.codeLicense, 'Apache-2.0');
    assert.equal(embedder.weightsLicense, 'MIT');
    assert.ok(embedder.sha256.length === 64);

    const liveness = registry.getModelMetadata('liveness-pad-evaluator');
    assert.ok(liveness);
    assert.equal(liveness.type, 'liveness');
    assert.ok(liveness.sha256.length === 64);
  });

  it('successfully verifies integrity of all production models', async () => {
    const check = await registry.verifyAllModels();
    assert.equal(check.allValid, true);
    assert.equal(registry.isModelVerified('blazeface-detector'), true);
    assert.equal(registry.isModelVerified('arcface-embedder'), true);
    assert.equal(registry.isModelVerified('liveness-pad-evaluator'), true);
  });

  it('detects corrupted model and triggers MODEL_INTEGRITY_FAILURE', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ofid-model-corrupt-'));
    const corruptFile = path.join(tmpDir, 'corrupted_model.bin');
    fs.writeFileSync(corruptFile, Buffer.from('CORRUPTED_MODEL_DATA_OR_MALICIOUS_BYTES'));

    // Check against unknown model
    const unknownRes = await registry.verifyIntegrity('unknown-model-xyz');
    assert.equal(unknownRes.valid, false);
    assert.ok(unknownRes.error?.includes('MODEL_NOT_FOUND'));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
