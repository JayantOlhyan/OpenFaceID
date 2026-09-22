import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { MacOSAdapter } from '../../packages/platform/src/MacOSAdapter.ts';

describe('Phase 13 — macOS Native PAM Socket Authentication Protocol', { skip: process.platform === 'win32' }, () => {
  it('handles PAM challenge and responds with AUTHORIZED when verified', async () => {
    const adapter = new MacOSAdapter();
    let authCalled = false;

    adapter.startPamSocketServer(async (username: string) => {
      authCalled = true;
      assert.equal(username, 'test_user');
      return true;
    });

    const socketPath = MacOSAdapter.DEV_PAM_SOCKET_PATH;

    // Send mock PAM challenge over Unix Domain Socket
    const response = await new Promise<string>((resolve, reject) => {
      const client = net.createConnection({ path: socketPath }, () => {
        client.write(JSON.stringify({ action: 'authenticate', user: 'test_user', source: 'macos_pam' }) + '\n');
      });

      let buf = '';
      client.on('data', (chunk) => {
        buf += chunk.toString();
      });

      client.on('end', () => {
        resolve(buf.trim());
      });

      client.on('error', reject);
    });

    adapter.stopPamSocketServer();

    assert.equal(authCalled, true);
    const parsed = JSON.parse(response);
    assert.equal(parsed.status, 'AUTHORIZED');
    assert.equal(parsed.user, 'test_user');
  });

  it('handles PAM challenge and responds with DENIED when biometric fails', async () => {
    const adapter = new MacOSAdapter();

    adapter.startPamSocketServer(async (_username: string) => {
      return false; // Biometric mismatch or liveness failed
    });

    const socketPath = MacOSAdapter.DEV_PAM_SOCKET_PATH;

    const response = await new Promise<string>((resolve, reject) => {
      const client = net.createConnection({ path: socketPath }, () => {
        client.write(JSON.stringify({ action: 'authenticate', user: 'imposter_user', source: 'macos_pam' }) + '\n');
      });

      let buf = '';
      client.on('data', (chunk) => {
        buf += chunk.toString();
      });

      client.on('end', () => {
        resolve(buf.trim());
      });

      client.on('error', reject);
    });

    adapter.stopPamSocketServer();

    const parsed = JSON.parse(response);
    assert.equal(parsed.status, 'DENIED');
  });
});
