import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

describe('Phase 13 — Native macOS PAM Binary End-to-End Execution', () => {
  const socketPath = '/tmp/openfaceid_auth.sock';
  const harnessSrc = path.resolve('tests/native/test_pam_macos.c');
  const harnessPath = path.resolve('tests/native/test_pam_macos');
  const pamSoPath = path.resolve('packages/platform/native/macos/pam_openfaceid_mac.so');

  before(() => {
    if (os.platform() !== 'darwin') return;
    if (!fs.existsSync(pamSoPath)) {
      execFileSync('make', ['-C', 'packages/platform/native/macos']);
    }
    if (!fs.existsSync(harnessPath)) {
      execFileSync('clang', ['-O2', harnessSrc, '-o', harnessPath, '-lpam']);
    }
  });

  it('verifies compiled pam_openfaceid_mac.so returns PAM_IGNORE (25) when daemon is offline', async () => {
    if (os.platform() !== 'darwin') return;
    try {
      if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
    } catch {}

    const { stdout } = await execFileAsync(harnessPath, [pamSoPath, 'test_offline_user']);
    assert.ok(stdout.includes('PAM_RESULT=25'), `Expected PAM_IGNORE (25), got: ${stdout}`);
  });

  it('verifies compiled pam_openfaceid_mac.so returns PAM_SUCCESS (0) when biometrics authorize user', async () => {
    try {
      if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
    } catch {}

    const server = net.createServer((socket) => {
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        if (buffer.includes('\n')) {
          const req = JSON.parse(buffer.trim());
          if (req.user === 'authorized_user') {
            socket.write(JSON.stringify({ status: 'AUTHORIZED', user: req.user }) + '\n');
          } else {
            socket.write(JSON.stringify({ status: 'DENIED', reason: 'Mismatch' }) + '\n');
          }
          socket.end();
        }
      });
    });

    await new Promise<void>((resolve) => server.listen(socketPath, resolve));

    try {
      const { stdout } = await execFileAsync(harnessPath, [pamSoPath, 'authorized_user']);
      assert.ok(stdout.includes('PAM_RESULT=0'), `Expected PAM_SUCCESS (0), got: ${stdout}`);
    } finally {
      server.close();
      if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
    }
  });

  it('verifies compiled pam_openfaceid_mac.so returns PAM_AUTH_ERR (9) on biometric mismatch or liveness failure', async () => {
    try {
      if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
    } catch {}

    const server = net.createServer((socket) => {
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        if (buffer.includes('\n')) {
          socket.write(JSON.stringify({ status: 'DENIED', reason: 'Biometric mismatch or liveness failure' }) + '\n');
          socket.end();
        }
      });
    });

    await new Promise<void>((resolve) => server.listen(socketPath, resolve));

    try {
      const { stdout } = await execFileAsync(harnessPath, [pamSoPath, 'imposter_user']);
      assert.ok(stdout.includes('PAM_RESULT=9'), `Expected PAM_AUTH_ERR (9), got: ${stdout}`);
    } finally {
      server.close();
      if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
    }
  });
});
