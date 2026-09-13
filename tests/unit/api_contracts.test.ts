import test from 'node:test';
import assert from 'node:assert';
import {
  CanonicalStateMachine,
  PresenceStateMachine,
  SecurityStateMachine,
  RecognitionStateMachine,
  ConfigValidator,
  DEFAULT_CONFIG,
  OpenFaceIDError,
  ErrorCode,
  BRANDING,
} from '../../packages/core/src/index.ts';
import { CryptoManager, MemorySanitizer } from '../../packages/security/src/index.ts';
import { CLI_EXIT_CODES } from '../../apps/cli/bin/openfaceid.ts';

test('Public API Contract & Stability Invariants (Section 60 & 86)', async (t) => {
  await t.test('verifies CanonicalStateMachine implements authoritative lifecycle API', () => {
    const fsm = new CanonicalStateMachine();
    const snapshot = fsm.getSnapshot();
    assert.strictEqual(typeof snapshot.system, 'string');
    assert.strictEqual(typeof snapshot.camera, 'string');
    assert.strictEqual(typeof snapshot.detection, 'string');
    assert.strictEqual(typeof snapshot.presence, 'string');
    assert.strictEqual(typeof snapshot.timestamp, 'number');
    assert.strictEqual(typeof fsm.subscribe, 'function');
    assert.strictEqual(typeof fsm.setCameraState, 'function');
  });

  await t.test('verifies PresenceStateMachine valid state transitions and guard rails', () => {
    const psm = new PresenceStateMachine('UNKNOWN');
    assert.strictEqual(psm.getState(), 'UNKNOWN');
    assert.strictEqual(psm.canTransitionTo('USER_PRESENT'), true);
    assert.strictEqual(psm.canTransitionTo('USER_LEFT'), true);
    assert.strictEqual(psm.canTransitionTo('GRACE_PERIOD'), false); // Cannot jump UNKNOWN -> GRACE_PERIOD

    const success = psm.transition('USER_PRESENT', 0);
    assert.strictEqual(success, true);
    assert.strictEqual(psm.getState(), 'USER_PRESENT');
    assert.strictEqual(psm.canTransitionTo('GRACE_PERIOD'), true);
  });

  await t.test('verifies SecurityStateMachine contract and valid state progression', () => {
    const ssm = new SecurityStateMachine('UNKNOWN');
    assert.strictEqual(ssm.getState(), 'UNKNOWN');
    assert.strictEqual(ssm.canTransitionTo('FACE_DETECTED'), true);
    assert.strictEqual(ssm.canTransitionTo('ACTION_AUTHORIZED'), false); // Fail-closed: cannot skip directly to authorize
  });

  await t.test('verifies RecognitionStateMachine contract', () => {
    const rsm = new RecognitionStateMachine('IDLE');
    assert.strictEqual(rsm.getState(), 'IDLE');
    assert.strictEqual(rsm.canTransitionTo('SEARCHING'), true);
    assert.strictEqual(rsm.canTransitionTo('AUTHORIZED'), false); // Cannot jump IDLE -> AUTHORIZED
  });

  await t.test('verifies Config validation contracts and threshold constraints (Section 48)', () => {
    // Valid config passes
    const valid = ConfigValidator.validate(DEFAULT_CONFIG);
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.errors.length, 0);

    // Default threshold is safe (0.70: Balanced)
    assert.strictEqual(DEFAULT_CONFIG.recognition.threshold, 0.70);

    // Insecure threshold (< 0.50) is rejected
    const invalidThreshold = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    invalidThreshold.recognition.threshold = 0.35;
    const resultInsecure = ConfigValidator.validate(invalidThreshold);
    assert.strictEqual(resultInsecure.valid, false);
    assert.ok(resultInsecure.errors.some((e: string) => e.includes('threshold')));

    // Invalid liveness mode rejected
    const invalidLiveness = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    invalidLiveness.liveness.mode = 'invalid_bypass_mode';
    const resultLiveness = ConfigValidator.validate(invalidLiveness);
    assert.strictEqual(resultLiveness.valid, false);
    assert.ok(resultLiveness.errors.some((e: string) => e.includes('liveness.mode')));

    // Telemetry is permanently disabled even if requested
    const telemetryAttempt = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    telemetryAttempt.privacy.telemetryEnabled = true;
    const resultTelemetry = ConfigValidator.validate(telemetryAttempt);
    assert.strictEqual(resultTelemetry.config.privacy.telemetryEnabled, false);
  });

  await t.test('verifies CryptoManager contracts (AES-256-GCM)', () => {
    const masterSecret = 'super-secret-key-32-chars-long!!';
    const payload = 'contract-test-string';
    const encrypted = CryptoManager.encrypt(payload, masterSecret);
    assert.strictEqual(typeof encrypted.ciphertext, 'string');
    assert.strictEqual(typeof encrypted.iv, 'string');
    assert.strictEqual(typeof encrypted.salt, 'string');
    assert.strictEqual(typeof encrypted.authTag, 'string');

    const decrypted = CryptoManager.decrypt(encrypted, masterSecret).toString('utf8');
    assert.strictEqual(decrypted, payload);

    // Authentication failure on tampered tag
    assert.throws(() => {
      CryptoManager.decrypt(
        { ...encrypted, authTag: '0'.repeat(32) },
        masterSecret
      );
    });
  });

  await t.test('verifies MemorySanitizer zeroization contract', () => {
    const buffer = new Uint8Array([1, 2, 3, 4, 5]);
    MemorySanitizer.zeroizeBuffer(buffer);
    assert.deepStrictEqual(Array.from(buffer), [0, 0, 0, 0, 0]);
  });

  await t.test('verifies CLI exit code stability contract (Section 12)', () => {
    assert.strictEqual(CLI_EXIT_CODES.SUCCESS, 0);
    assert.strictEqual(CLI_EXIT_CODES.GENERAL_FAILURE, 1);
    assert.strictEqual(CLI_EXIT_CODES.INVALID_ARGUMENTS, 2);
    assert.strictEqual(CLI_EXIT_CODES.CAMERA_UNAVAILABLE, 3);
    assert.strictEqual(CLI_EXIT_CODES.AUTH_UNAVAILABLE, 4);
    assert.strictEqual(CLI_EXIT_CODES.SECURITY_FAILURE, 5);
    assert.strictEqual(CLI_EXIT_CODES.PRIVACY_RESTRICTION, 6);
    assert.strictEqual(CLI_EXIT_CODES.DAEMON_UNAVAILABLE, 7);
  });

  await t.test('verifies Canonical ErrorCode contract (Section 45)', () => {
    const err = new OpenFaceIDError(ErrorCode.CAMERA_UNAVAILABLE, 'Camera disconnected');
    assert.strictEqual(err.code, 'CAMERA_UNAVAILABLE');
    assert.strictEqual(err.recovery.retryable, true);
    assert.strictEqual(typeof err.recovery.action, 'string');
  });

  await t.test('verifies Branding package reports authoritative version and metadata', () => {
    assert.strictEqual(BRANDING.version, '0.2.1-rc.1');
    assert.strictEqual(BRANDING.name, 'OpenFaceID');
    assert.strictEqual(BRANDING.codeName, 'SightLock');
  });
});
