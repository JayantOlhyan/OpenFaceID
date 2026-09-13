import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import path from 'path';

function runExample(scriptName: string): Promise<{ stdout: string; stderr: string; code: number }> {
  const scriptPath = path.resolve('examples', scriptName);
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--experimental-strip-types', scriptPath],
      { timeout: 15000 },
      (error, stdout, stderr) => {
        resolve({
          stdout,
          stderr,
          code: error ? (error.code as number) || 1 : 0,
        });
      }
    );
  });
}

describe('Developer Examples Execution & Correctness (Phase 9)', () => {
  it('executes examples/core-state.ts without errors', async () => {
    const res = await runExample('core-state.ts');
    assert.equal(res.code, 0, `core-state.ts failed: ${res.stderr}`);
    assert.ok(res.stdout.includes('Core Presence State'));
    assert.ok(res.stdout.includes('PRESENCE_AUTHORIZED'));
    assert.ok(res.stdout.includes('PRESENCE_AMBIGUOUS'));
  });

  it('executes examples/camera-access.ts without errors', async () => {
    const res = await runExample('camera-access.ts');
    assert.equal(res.code, 0, `camera-access.ts failed: ${res.stderr}`);
    assert.ok(res.stdout.includes('Camera Access & RAM Zeroization'));
    assert.ok(res.stdout.includes('Memory Zeroization:     VERIFIED'));
  });

  it('executes examples/recognition.ts without errors', async () => {
    const res = await runExample('recognition.ts');
    assert.equal(res.code, 0, `recognition.ts failed: ${res.stderr}`);
    assert.ok(res.stdout.includes('Face Recognition & Cosine Similarity'));
    assert.ok(res.stdout.includes('512D'));
    assert.ok(res.stdout.includes('Genuine Probe Match:   YES'));
  });

  it('executes examples/liveness.ts without errors', async () => {
    const res = await runExample('liveness.ts');
    assert.equal(res.code, 0, `liveness.ts failed: ${res.stderr}`);
    assert.ok(res.stdout.includes('Liveness & Anti-Spoofing'));
    assert.ok(res.stdout.includes('2D Static Photo Presentation Attack'));
    assert.ok(res.stdout.includes('NO (BLOCKED)'));
  });

  it('executes examples/presence.ts without errors', async () => {
    const res = await runExample('presence.ts');
    assert.equal(res.code, 0, `presence.ts failed: ${res.stderr}`);
    assert.ok(res.stdout.includes('Presence Tracking Lifecycle'));
    assert.ok(res.stdout.includes('PRESENCE_AMBIGUOUS'));
  });

  it('executes examples/ipc-client.ts without errors', async () => {
    const res = await runExample('ipc-client.ts');
    assert.equal(res.code, 0, `ipc-client.ts failed: ${res.stderr}`);
    assert.ok(res.stdout.includes('Local IPC Daemon Client'));
  });

  it('executes examples/cli-integration.ts without errors', async () => {
    const res = await runExample('cli-integration.ts');
    assert.equal(res.code, 0, `cli-integration.ts failed: ${res.stderr}`);
    assert.ok(res.stdout.includes('Programmatic CLI Integration'));
    assert.ok(res.stdout.includes('Exit Code: 0'));
  });

  it('executes examples/automation.ts without errors', async () => {
    const res = await runExample('automation.ts');
    assert.equal(res.code, 0, `automation.ts failed: ${res.stderr}`);
    assert.ok(res.stdout.includes('Automation Actions'));
    assert.ok(res.stdout.includes('Security Check: PASS'));
  });
});
