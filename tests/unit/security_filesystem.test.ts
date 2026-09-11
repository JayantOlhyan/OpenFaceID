import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { IdentityStore } from '../../packages/storage/src/index.ts';

describe('Filesystem Security, Path Traversal & Permissions (Phase 4)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ofid-fs-sec-'));
  const store = new IdentityStore(tmpDir);

  it('rejects path traversal attempts and invalid IDs', () => {
    const maliciousIds = [
      '../escape',
      '../../../../etc/passwd',
      'foo/bar',
      'foo\\bar',
      'foo\0bar',
      '..%2F..%2Fetc',
      '   ',
      '',
    ];

    for (const badId of maliciousIds) {
      assert.throws(() => {
        store.getSafeFilePath(badId);
      }, /(INVALID_ID|INVALID_PATH|PATH_TRAVERSAL)/);
    }
  });

  it('accepts strictly alphanumeric and safe identifier strings', () => {
    const validIds = [
      'usr_123',
      'usr_test-identity_01',
      'user-profile',
      'admin_user_99',
    ];

    for (const validId of validIds) {
      const safePath = store.getSafeFilePath(validId);
      assert.ok(safePath.startsWith(path.resolve(tmpDir)));
      assert.ok(safePath.endsWith('.enc'));
    }
  });

  it('verifies strict 0600 file permissions on saved encrypted identities', async () => {
    const dummyId = {
      id: 'usr_sec_test',
      name: 'Security Test User',
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      embeddings: [new Float32Array(512).fill(0.04419)],
      averageEmbedding: new Float32Array(512).fill(0.04419),
      recognitionStats: { matchCount: 0 },
    };

    const saved = await store.saveIdentity(dummyId);
    assert.equal(saved, true);

    const filePath = store.getSafeFilePath(dummyId.id);
    assert.ok(fs.existsSync(filePath));

    // Check permissions on POSIX systems (mode & 0777)
    if (process.platform !== 'win32') {
      const stat = fs.statSync(filePath);
      const mode = stat.mode & 0o777;
      assert.equal(mode, 0o600, `Expected file mode 0600, got 0${mode.toString(8)}`);
    }

    // Cleanup
    await store.deleteIdentity(dummyId.id);
    assert.equal(fs.existsSync(filePath), false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
