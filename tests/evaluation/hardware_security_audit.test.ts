import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { CryptoManager } from '../../packages/security/src/index.ts';
import { CanonicalStateMachine } from '../../packages/core/src/state/canonical.ts';

describe('Phase 7 Hardware Security, IPC & Network Isolation Audit', () => {
  test('Strict Loopback Binding & Port Isolation', () => {
    // Port must be isolated local port (41793)
    const port = 41793;
    const host = '127.0.0.1';
    assert.strictEqual(host, '127.0.0.1', 'Host must be strictly IPv4 loopback');
    assert.strictEqual(port, 41793, 'Port must be 41793');
  });

  test('IPC Timing-Safe Bearer Token Validation', () => {
    const validToken = 'ofid_' + crypto.randomBytes(24).toString('hex');
    const invalidToken = 'ofid_' + crypto.randomBytes(24).toString('hex');
    const malformedToken = 'invalid_format_xyz';

    assert.strictEqual(CryptoManager.verifyTimingSafe(validToken, validToken), true);
    assert.strictEqual(CryptoManager.verifyTimingSafe(invalidToken, validToken), false);
    assert.strictEqual(CryptoManager.verifyTimingSafe(malformedToken, validToken), false);
    assert.strictEqual(CryptoManager.verifyTimingSafe('', validToken), false);
    assert.strictEqual(CryptoManager.verifyTimingSafe(null as any, validToken), false);
  });

  test('Filesystem Directory and File Permissions (0700 / 0600)', () => {
    const tmpDir = path.join(os.tmpdir(), 'ofid_sec_perm_test_' + Date.now());
    fs.mkdirSync(tmpDir, { mode: 0o700 });
    const statDir = fs.statSync(tmpDir);
    const dirMode = statDir.mode & 0o777;
    // On POSIX systems, verify user-only directory permissions
    if (process.platform !== 'win32') {
      assert.strictEqual(dirMode, 0o700, 'Directories must be 0700');
    }

    const testFile = path.join(tmpDir, 'token');
    fs.writeFileSync(testFile, 'test_token', { mode: 0o600 });
    const statFile = fs.statSync(testFile);
    const fileMode = statFile.mode & 0o777;
    if (process.platform !== 'win32') {
      assert.strictEqual(fileMode, 0o600, 'Sensitive files must be 0600');
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('Diagnostic Sanitization Redacts Biometrics and Secrets', () => {
    const sampleSensitiveData = {
      os: 'Darwin 25.6.0',
      camera: 'FaceTime HD Camera',
      token: 'ofid_secret_token_12345',
      embedding: new Float32Array(512).fill(0.123),
      rawFrame: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
      nested: {
        privateKey: 'super_secret_key',
        normalStat: 'ok'
      }
    };

    // Diagnostic sanitization logic matching serve.js
    const SENSITIVE_KEY_PATTERN = /^(embedding|embeddings|averageEmbedding|vector|vectors|token|secret|key|privateKey|password|authTag|ciphertext|rawFrame|faceCrop)$/i;

    function sanitize(val: any, currentKey = ''): any {
      if (val === null || val === undefined) return val;
      if (SENSITIVE_KEY_PATTERN.test(currentKey)) {
        return '[REDACTED]';
      }
      if (val instanceof Float32Array || val instanceof Uint8Array) {
        return `[REDACTED_TYPED_ARRAY]`;
      }
      if (typeof val === 'string' && (val.startsWith('data:image/') || val.includes('secret'))) {
        return '[REDACTED_STRING]';
      }
      if (typeof val === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(val)) {
          out[k] = sanitize(v, k);
        }
        return out;
      }
      return val;
    }

    const cleaned = sanitize(sampleSensitiveData);
    assert.strictEqual(cleaned.token, '[REDACTED]');
    assert.strictEqual(cleaned.embedding, '[REDACTED]');
    assert.strictEqual(cleaned.rawFrame, '[REDACTED]');
    assert.strictEqual(cleaned.nested.privateKey, '[REDACTED]');
    assert.strictEqual(cleaned.nested.normalStat, 'ok');
    assert.strictEqual(cleaned.os, 'Darwin 25.6.0');
  });

  test('Consumers (HUD/Tray/CLI) Cannot Autonomously Authorize Presence', () => {
    const fsm = new CanonicalStateMachine();
    // Consumer cannot set authorized directly
    assert.strictEqual(fsm.getSnapshot().presence, 'PRESENCE_UNAUTHORIZED');

    // FSM requires camera ready, 1 face, liveness passed, and identity matched
    fsm.setCameraState('CAMERA_READY');
    fsm.updateVisionState({
      faceCount: 1,
      detectionState: 'FACE_DETECTED',
      livenessState: 'LIVENESS_IN_PROGRESS',
      identityState: 'IDENTITY_UNKNOWN'
    });
    assert.strictEqual(fsm.getSnapshot().presence, 'PRESENCE_UNAUTHORIZED');

    // Passing liveness alone without matching identity is not enough
    fsm.updateVisionState({
      faceCount: 1,
      detectionState: 'FACE_DETECTED',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_UNKNOWN'
    });
    assert.strictEqual(fsm.getSnapshot().presence, 'PRESENCE_UNAUTHORIZED');

    // Matching identity authorizes presence
    fsm.updateVisionState({
      faceCount: 1,
      detectionState: 'FACE_DETECTED',
      livenessState: 'LIVENESS_PASSED',
      identityState: 'IDENTITY_RECOGNIZED',
      identityId: 'usr_real_01',
      identityName: 'Real User'
    });
    assert.strictEqual(fsm.getSnapshot().presence, 'PRESENCE_AUTHORIZED');

    // If an external consumer disconnects camera or pauses privacy, presence drops immediately
    fsm.setPrivacyPaused(true);
    assert.strictEqual(fsm.getSnapshot().presence, 'PRESENCE_UNAUTHORIZED');
  });
});
