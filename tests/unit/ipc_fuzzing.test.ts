import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import { LocalApiServer } from '../../packages/api/src/index.ts';

class FuzzRequest extends EventEmitter {
  public url: string;
  public method: string;
  public headers: Record<string, string>;

  constructor(url: string, method: string = 'GET', headers: Record<string, string> = {}) {
    super();
    this.url = url;
    this.method = method;
    this.headers = headers;
  }
}

class FuzzResponse {
  public statusCode: number = 200;
  public headers: Record<string, string> = {};
  public body: string = '';
  public finished: boolean = false;

  public setHeader(key: string, val: string): void {
    this.headers[key] = val;
  }

  public writeHead(code: number, headers?: Record<string, string>): void {
    this.statusCode = code;
    if (headers) {
      Object.assign(this.headers, headers);
    }
  }

  public end(data?: string): void {
    if (data) this.body += data;
    this.finished = true;
  }
}

describe('IPC Fuzzing & Resilience (Phase 4)', () => {
  const server = new LocalApiServer();
  const token = server.getApiToken();
  const authHeaders = { authorization: `Bearer ${token}` };

  it('handles empty payload gracefully without crashing', async () => {
    const req = new FuzzRequest('/api/v1/identities', 'POST', {
      ...authHeaders,
      'content-type': 'application/json',
    });
    const res = new FuzzResponse();

    const promise = server.handleRequest(req, res);
    req.emit('data', Buffer.from(''));
    req.emit('end');
    await promise;

    assert.ok(res.statusCode >= 400);
    assert.equal(res.finished, true);
  });

  it('handles invalid / malformed JSON gracefully', async () => {
    const malformedInputs = [
      '{ not_valid_json ',
      '{"unterminated": "string',
      '[1, 2, 3,',
      'undefined',
      'NaN',
      '<xml>not json</xml>',
      '\0\0\0null_bytes',
    ];

    for (const input of malformedInputs) {
      const req = new FuzzRequest('/api/v1/identities', 'POST', {
        ...authHeaders,
        'content-type': 'application/json',
      });
      const res = new FuzzResponse();

      const promise = server.handleRequest(req, res);
      req.emit('data', Buffer.from(input));
      req.emit('end');
      await promise;

      assert.ok(res.statusCode >= 400 && res.statusCode < 500, `Expected 4xx for "${input}", got ${res.statusCode}`);
      assert.equal(res.finished, true);
    }
  });

  it('handles wrong types, null arrays, and unexpected fields', async () => {
    const badPayloads = [
      JSON.stringify({ name: 12345 }), // Number instead of string
      JSON.stringify({ name: null }),
      JSON.stringify({ name: false }),
      JSON.stringify({ name: ['Alice', 'Bob'] }), // Array instead of string
      JSON.stringify({ name: { nested: 'Alice' } }), // Object instead of string
      JSON.stringify({ name: 'Alice', unexpectedField: { malicious: true }, extra: [1, 2, 3] }),
      JSON.stringify(null),
      JSON.stringify([]),
    ];

    for (const payload of badPayloads) {
      const req = new FuzzRequest('/api/v1/identities', 'POST', {
        ...authHeaders,
        'content-type': 'application/json',
      });
      const res = new FuzzResponse();

      const promise = server.handleRequest(req, res);
      req.emit('data', Buffer.from(payload));
      req.emit('end');
      await promise;

      assert.ok(res.statusCode >= 200 && res.statusCode <= 500);
      assert.equal(res.finished, true);
    }
  });

  it('handles extremely long strings and unicode without crashing', async () => {
    const longString = 'A'.repeat(50_000);
    const unicodeString = '🧑‍💻 👁️ 🔒 測試 🚀 مرحبا بالعالم \u0000\uFFFF \uD83D\uDE00';

    const reqLong = new FuzzRequest('/api/v1/identities', 'POST', {
      ...authHeaders,
      'content-type': 'application/json',
    });
    const resLong = new FuzzResponse();

    const promise1 = server.handleRequest(reqLong, resLong);
    reqLong.emit('data', Buffer.from(JSON.stringify({ name: longString })));
    reqLong.emit('end');
    await promise1;
    assert.equal(resLong.finished, true);

    const reqUnicode = new FuzzRequest('/api/v1/identities', 'POST', {
      ...authHeaders,
      'content-type': 'application/json',
    });
    const resUnicode = new FuzzResponse();

    const promise2 = server.handleRequest(reqUnicode, resUnicode);
    reqUnicode.emit('data', Buffer.from(JSON.stringify({ name: unicodeString })));
    reqUnicode.emit('end');
    await promise2;
    assert.equal(resUnicode.finished, true);
  });

  it('rejects path traversal attempts in identity IDs', async () => {
    const dangerousIds = [
      '../../etc/passwd',
      '..%2F..%2Fetc%2Fpasswd',
      'usr_test/../../../root',
      'usr_test\0malicious',
      '\\Windows\\System32\\cmd.exe',
      'usr_' + 'X'.repeat(500),
    ];

    for (const id of dangerousIds) {
      const req = new FuzzRequest(`/api/v1/identities/${encodeURIComponent(id)}`, 'DELETE', authHeaders);
      const res = new FuzzResponse();
      await server.handleRequest(req, res);

      assert.ok(res.statusCode === 400 || res.statusCode === 404, `Expected 400 or 404 for traversal ID "${id}", got ${res.statusCode}`);
      assert.equal(res.finished, true);
    }
  });

  it('handles deeply nested objects without recursion or call stack overflow', async () => {
    let deeplyNested: any = { leaf: 'value' };
    for (let i = 0; i < 100; i++) {
      deeplyNested = { level: i, child: deeplyNested };
    }

    const req = new FuzzRequest('/api/v1/identities', 'POST', {
      ...authHeaders,
      'content-type': 'application/json',
    });
    const res = new FuzzResponse();

    const promise = server.handleRequest(req, res);
    req.emit('data', Buffer.from(JSON.stringify(deeplyNested)));
    req.emit('end');
    await promise;

    assert.ok(res.statusCode >= 400);
    assert.equal(res.finished, true);
  });
});
