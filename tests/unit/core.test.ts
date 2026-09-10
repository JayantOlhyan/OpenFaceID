import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BRANDING } from '../../packages/branding/src/index.ts';
import {
  ConfigValidator,
  DEFAULT_CONFIG,
  RecognitionStateMachine,
  SecurityStateMachine,
  PresenceStateMachine,
  EventBus,
  Logger,
  SessionManager,
} from '../../packages/core/src/index.ts';
import { getPlatformAdapter } from '../../packages/platform/src/index.ts';

describe('Centralized Branding', () => {
  it('has consistent branding constants', () => {
    assert.equal(BRANDING.name, 'OpenFaceID');
    assert.equal(BRANDING.codeName, 'SightLock');
    assert.equal(BRANDING.tagline, 'Face recognition for every desktop.');
    assert.equal(BRANDING.security.noPlaintextPasswords, true);
    assert.equal(BRANDING.security.localOnly, true);
  });
});

describe('Configuration & Validation', () => {
  it('validates default config successfully', () => {
    const res = ConfigValidator.validate(DEFAULT_CONFIG);
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
    assert.equal(res.config.privacy.telemetryEnabled, false);
  });

  it('enforces telemetryEnabled is strictly false even if user tries to enable it', () => {
    const maliciousInput = {
      ...DEFAULT_CONFIG,
      privacy: {
        ...DEFAULT_CONFIG.privacy,
        telemetryEnabled: true,
      },
    };
    const res = ConfigValidator.validate(maliciousInput);
    assert.equal(res.config.privacy.telemetryEnabled, false);
  });

  it('rejects out-of-bound recognition thresholds', () => {
    const invalidInput = {
      recognition: {
        threshold: 0.1, // too low
      },
    };
    const res = ConfigValidator.validate(invalidInput);
    assert.equal(res.valid, false);
    assert.ok(res.errors[0].includes('threshold must be between 0.50 and 0.98'));
  });
});

describe('Recognition State Machine', () => {
  it('follows valid transition sequence: IDLE -> SEARCHING -> FACE_DETECTED -> QUALITY_CHECK -> RECOGNIZING -> LIVENESS_CHECK -> AUTHORIZED', () => {
    const sm = new RecognitionStateMachine();
    assert.equal(sm.getState(), 'IDLE');

    assert.equal(sm.transition('SEARCHING'), true);
    assert.equal(sm.transition('FACE_DETECTED'), true);
    assert.equal(sm.transition('QUALITY_CHECK'), true);
    assert.equal(sm.transition('RECOGNIZING'), true);
    assert.equal(sm.transition('LIVENESS_CHECK'), true);
    assert.equal(sm.transition('AUTHORIZED'), true);
    assert.equal(sm.getState(), 'AUTHORIZED');
  });

  it('prevents illegal direct jump from IDLE to AUTHORIZED', () => {
    const sm = new RecognitionStateMachine();
    const result = sm.transition('AUTHORIZED');
    assert.equal(result, false);
    assert.equal(sm.getState(), 'IDLE');
  });
});

describe('Security State Machine', () => {
  it('strictly enforces multi-stage authorization: UNKNOWN -> FACE_DETECTED -> IDENTITY_MATCHED -> LIVENESS_VERIFIED -> POLICY_APPROVED -> ACTION_AUTHORIZED -> ACTION_COMPLETED', () => {
    const sm = new SecurityStateMachine();
    assert.equal(sm.getState(), 'UNKNOWN');

    assert.equal(sm.transition('FACE_DETECTED'), true);
    assert.equal(sm.transition('IDENTITY_MATCHED', { identityId: 'user-1' }), true);
    assert.equal(sm.transition('LIVENESS_VERIFIED'), true);
    assert.equal(sm.transition('POLICY_APPROVED', { policyAction: 'unlock_screen' }), true);
    assert.equal(sm.transition('ACTION_AUTHORIZED'), true);
    assert.equal(sm.transition('ACTION_COMPLETED'), true);
    assert.equal(sm.getState(), 'ACTION_COMPLETED');
  });

  it('rejects skipping liveness verification to jump straight to policy approval', () => {
    const sm = new SecurityStateMachine();
    sm.transition('FACE_DETECTED');
    sm.transition('IDENTITY_MATCHED');
    const jumped = sm.transition('POLICY_APPROVED');
    assert.equal(jumped, false);
    assert.equal(sm.getState(), 'IDENTITY_MATCHED');
  });
});

describe('Presence State Machine', () => {
  it('manages USER_PRESENT -> GRACE_PERIOD -> USER_LEFT cycle', () => {
    const sm = new PresenceStateMachine('UNKNOWN');
    assert.equal(sm.transition('USER_PRESENT'), true);
    assert.equal(sm.transition('GRACE_PERIOD', 10000), true);
    assert.equal(sm.transition('USER_LEFT', 20000), true);
    assert.equal(sm.getState(), 'USER_LEFT');
  });
});

describe('Event Bus', () => {
  it('dispatches and subscribes to events with strong typing', () => {
    const bus = EventBus.getInstance();
    let calledPayload: any = null;
    let callCount = 0;

    const unsubscribe = bus.subscribe('USER_PRESENT', (event) => {
      calledPayload = event.payload;
      callCount++;
    });
    bus.emit('USER_PRESENT', { identityId: 'jayant' });

    assert.equal(callCount, 1);
    assert.deepEqual(calledPayload, { identityId: 'jayant' });

    unsubscribe();
    bus.emit('USER_PRESENT', { identityId: 'jayant2' });
    assert.equal(callCount, 1);
  });
});

describe('Privacy-Safe Logger', () => {
  it('automatically strips biometric embeddings, vectors, and passwords', () => {
    Logger.clear();
    Logger.info('vision', 'Extracted face embedding', {
      embedding: new Float32Array([0.12, 0.45, 0.99]),
      password: 'secretPassword123',
      validKey: 'allowedMetadata',
    });

    const logs = Logger.getRecentLogs(1);
    assert.equal(logs[0].metadata?.embedding, '[REDACTED_BIOMETRIC_OR_SECRET]');
    assert.equal(logs[0].metadata?.password, '[REDACTED_BIOMETRIC_OR_SECRET]');
    assert.equal(logs[0].metadata?.validKey, 'allowedMetadata');
  });
});

describe('Session Manager', () => {
  it('creates, verifies, and revokes ephemeral authorization sessions', () => {
    const sm = new SessionManager(1000); // 1 sec TTL
    const session = sm.createSession('id-1', 'Jayant', 0.94, 'strong');

    assert.ok(session.sessionId);
    assert.equal(sm.getSession()?.identityName, 'Jayant');

    sm.revoke();
    assert.equal(sm.getSession(), null);
  });
});

describe('Platform Adapter Factory', () => {
  it('returns valid PlatformAdapter instance with proper capabilities', () => {
    const adapter = getPlatformAdapter();
    const info = adapter.getPlatformInfo();

    assert.ok(['macos', 'windows', 'linux'].includes(info.os));
    assert.equal(info.isSupported, true);
    assert.equal(info.capabilities.canLockScreen, true);
  });
});
