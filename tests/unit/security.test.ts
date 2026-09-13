import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { CryptoManager, MemorySanitizer, KeyringManager } from '../../packages/security/src/index.ts';
import { IdentityStore, ActivityLog, ConfigStore } from '../../packages/storage/src/index.ts';
import type { EnrolledIdentity } from '../../packages/vision/src/index.ts';

const tempDir = path.join(os.tmpdir(), 'openfaceid-test-' + Math.random().toString(36).substring(2, 8));

describe('CryptoManager (AES-256-GCM)', () => {
  const secret = 'super-secret-master-key-32-chars-long!';

  it('encrypts and decrypts UTF-8 text and binary buffers accurately', () => {
    const message = 'BiometricVectorData_TopSecret';
    const encrypted = CryptoManager.encrypt(message, secret);

    assert.ok(encrypted.iv);
    assert.ok(encrypted.salt);
    assert.ok(encrypted.authTag);
    assert.ok(encrypted.ciphertext);

    const decrypted = CryptoManager.decrypt(encrypted, secret);
    assert.equal(decrypted.toString('utf8'), message);
  });

  it('rejects tampered ciphertext with authentication error', () => {
    const message = 'ValidBiometricPayload';
    const encrypted = CryptoManager.encrypt(message, secret);

    // Tamper with ciphertext by flipping last hex character
    const tamperedCiphertext =
      encrypted.ciphertext.slice(0, -1) + (encrypted.ciphertext.endsWith('0') ? '1' : '0');
    const tampered = { ...encrypted, ciphertext: tamperedCiphertext };

    assert.throws(() => {
      CryptoManager.decrypt(tampered, secret);
    });
  });
});

describe('MemorySanitizer', () => {
  it('zeroizes typed arrays and buffers completely', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5]);
    MemorySanitizer.zeroizeBuffer(buf);
    assert.deepEqual(buf, Buffer.alloc(5, 0));

    const floatArr = new Float32Array([0.1, 0.2, 0.3]);
    MemorySanitizer.zeroizeBuffer(floatArr);
    assert.equal(floatArr[0], 0.0);
    assert.equal(floatArr[1], 0.0);
  });
});

describe('KeyringManager', () => {
  it('generates, caches, and returns a high-entropy 256-bit secret', async () => {
    const key1 = await KeyringManager.getOrCreateMasterSecret();
    assert.ok(key1.length >= 32);

    const key2 = await KeyringManager.getOrCreateMasterSecret();
    assert.equal(key1, key2); // cached secret consistency
  });
});

describe('IdentityStore (Encrypted Biometrics & File Shredding)', () => {
  const store = new IdentityStore(path.join(tempDir, 'identities'));

  it('saves encrypted biometric identity, retrieves vectors, and shreds on delete', async () => {
    const dummyEmbedding = new Float32Array(512);
    dummyEmbedding[0] = 0.5;
    dummyEmbedding[511] = 0.5;

    const identity: EnrolledIdentity = {
      id: 'usr_test_01',
      name: 'Jayant Test',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      embeddings: [dummyEmbedding],
      averageEmbedding: dummyEmbedding,
      recognitionStats: { matchCount: 0 },
    };

    // 1. Save
    const saved = await store.saveIdentity(identity);
    assert.equal(saved, true);

    // 2. Retrieve
    const retrieved = await store.getIdentity('usr_test_01');
    assert.ok(retrieved);
    assert.equal(retrieved.name, 'Jayant Test');
    assert.equal(retrieved.averageEmbedding.length, 512);
    assert.ok(Math.abs(retrieved.averageEmbedding[0] - 0.5) < 0.0001);

    // 3. List
    const all = await store.listIdentities();
    assert.equal(all.length, 1);
    assert.equal(all[0].id, 'usr_test_01');

    // 4. Delete with Secure Shredding
    const deleted = await store.deleteIdentity('usr_test_01');
    assert.equal(deleted, true);

    const afterDelete = await store.getIdentity('usr_test_01');
    assert.equal(afterDelete, null);
  });
});

describe('ActivityLog & ConfigStore', () => {
  const logPath = path.join(tempDir, 'activity.json');
  const cfgPath = path.join(tempDir, 'config.json');

  it('records audit events and clears history', () => {
    const log = new ActivityLog(logPath, 7, true);
    log.addEntry({
      type: 'MATCH',
      identityName: 'Jayant',
      confidence: 0.92,
      description: 'Face recognized locally',
    });

    const entries = log.getEntries();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].identityName, 'Jayant');

    log.clear();
    assert.equal(log.getEntries().length, 0);
  });

  it('loads, validates, and persists configuration', () => {
    const cfgStore = new ConfigStore(cfgPath);
    const cfg = cfgStore.loadConfig();
    assert.equal(cfg.recognition.threshold, 0.70);

    const saved = cfgStore.saveConfig({
      recognition: { ...cfg.recognition, threshold: 0.80 },
    });
    assert.equal(saved, true);

    const updated = cfgStore.loadConfig();
    assert.equal(updated.recognition.threshold, 0.80);
  });
});
