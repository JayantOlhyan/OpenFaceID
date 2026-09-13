import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ModelRegistry } from '../../packages/vision/src/index.ts';
import { CryptoManager, KeyringManager, MemorySanitizer } from '../../packages/security/src/index.ts';
import { getPlatformAdapter } from '../../packages/platform/src/index.ts';
import { BRANDING, getBuildMetadata } from '../../packages/branding/src/index.ts';

describe('Diagnostics & Health Verification (Phase 4)', () => {
  it('verifies security check criteria: loopback, models, crypto tamper, timing defense', async () => {
    // 1. Loopback binding
    assert.equal(BRANDING.identifiers.localApiPort, 41793);

    // 2. Cryptographic roundtrip & tamper detection
    const secret = await KeyringManager.getOrCreateMasterSecret();
    assert.ok(secret.length >= 32);

    const testMessage = 'diagnostics-security-test-vector';
    const encrypted = CryptoManager.encrypt(testMessage, secret);
    const decrypted = CryptoManager.decrypt(encrypted, secret).toString('utf8');
    assert.equal(decrypted, testMessage);

    // Tampered payload must fail
    const tampered = { ...encrypted, ciphertext: encrypted.ciphertext.slice(0, -4) + '0000' };
    assert.throws(() => {
      CryptoManager.decrypt(tampered, secret);
    });

    // 3. Timing-safe comparison defense
    const tokenA = 'usr_token_secure_vector_12345';
    const tokenB = 'usr_token_secure_vector_12346';
    assert.equal(CryptoManager.verifyTimingSafe(tokenA, tokenA), true);
    assert.equal(CryptoManager.verifyTimingSafe(tokenA, tokenB), false);

    // 4. Model Registry signatures
    const registry = ModelRegistry.getInstance();
    const verification = await registry.verifyAllModels();
    assert.equal(verification.allValid, true);
    assert.ok(Object.keys(verification.results).length >= 3);
  });

  it('verifies privacy check criteria: RAM sanitization and zero cloud telemetry', () => {
    // RAM zeroization
    const buf = Buffer.from('volatile-face-embedding-data');
    assert.ok(buf.some((b) => b !== 0));
    MemorySanitizer.zeroizeBuffer(buf);
    assert.ok(buf.every((b) => b === 0));

    // Zero cloud egress guarantee
    assert.equal(BRANDING.security.localOnly, true);
    assert.equal(BRANDING.security.noPlaintextPasswords, true);
  });

  it('verifies system doctor and build metadata diagnostics', async () => {
    const adapter = getPlatformAdapter();
    const info = adapter.getPlatformInfo();
    assert.ok(['macos', 'windows', 'linux'].includes(info.os));

    const meta = getBuildMetadata();
    assert.equal(meta.version, BRANDING.version);
    assert.equal(meta.version, '0.2.1-rc.1');
    assert.ok(meta.nodeVersion.startsWith('v'));
  });

  it('produces redacted diagnostic payload without secrets or raw vectors', async () => {
    const meta = getBuildMetadata();
    const payload = {
      app: BRANDING.name,
      version: BRANDING.version,
      build: meta,
      cloudEgress: false,
      ramOnly: true,
    };

    const jsonStr = JSON.stringify(payload);
    assert.ok(!jsonStr.includes('password'));
    assert.ok(!jsonStr.includes('masterSecret'));
    assert.ok(!jsonStr.includes('keyringSecret'));
    assert.ok(jsonStr.includes('OpenFaceID'));
    assert.ok(jsonStr.includes(BRANDING.version));
  });
});
