import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import { LocalApiServer } from '../../packages/api/src/index.ts';

class MockRequest extends EventEmitter {
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

class MockResponse {
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

describe('IPC & Local API Authorization (Phase 3)', () => {
  it('enforces route classification: public endpoints open, sensitive endpoints require bearer token', async () => {
    const server = new LocalApiServer();
    const token = server.getApiToken();

    // 1. Public endpoint /api/v1/status requires no auth
    const reqStatus = new MockRequest('/api/v1/status', 'GET');
    const resStatus = new MockResponse();
    await server.handleRequest(reqStatus, resStatus);

    assert.equal(resStatus.statusCode, 200);
    const statusData = JSON.parse(resStatus.body);
    assert.equal(statusData.status, 'active');
    assert.equal(statusData.cloudEgress, false);
    // Verify zero biometric leakage in status payload
    assert.equal(statusData.embeddings, undefined);
    assert.equal(statusData.rawFrames, undefined);

    // 2. Protected endpoint /api/v1/identities without token -> 401 Unauthorized
    const reqUnauth = new MockRequest('/api/v1/identities', 'GET');
    const resUnauth = new MockResponse();
    await server.handleRequest(reqUnauth, resUnauth);

    assert.equal(resUnauth.statusCode, 401);
    const unauthData = JSON.parse(resUnauth.body);
    assert.ok(unauthData.error.includes('Unauthorized'));

    // 3. Protected endpoint with bad token -> 401 Unauthorized
    const reqBadToken = new MockRequest('/api/v1/identities', 'GET', {
      authorization: 'Bearer ofid_fake_invalid_token_12345',
    });
    const resBadToken = new MockResponse();
    await server.handleRequest(reqBadToken, resBadToken);

    assert.equal(resBadToken.statusCode, 401);

    // 4. Protected endpoint with valid bearer token -> 200 OK
    const reqAuth = new MockRequest('/api/v1/identities', 'GET', {
      authorization: `Bearer ${token}`,
    });
    const resAuth = new MockResponse();
    await server.handleRequest(reqAuth, resAuth);

    assert.equal(resAuth.statusCode, 200);
    const authData = JSON.parse(resAuth.body);
    assert.ok(Array.isArray(authData.identities));

    // 5. Highly sensitive endpoint /api/v1/lock without token -> 401 Unauthorized
    const reqLockUnauth = new MockRequest('/api/v1/lock', 'POST');
    const resLockUnauth = new MockResponse();
    await server.handleRequest(reqLockUnauth, resLockUnauth);

    assert.equal(resLockUnauth.statusCode, 401);

    // 6. Unknown route with valid token -> 404 Not Found
    const reqNotFound = new MockRequest('/api/v1/non_existent_route', 'GET', {
      authorization: `Bearer ${token}`,
    });
    const resNotFound = new MockResponse();
    await server.handleRequest(reqNotFound, resNotFound);

    assert.equal(resNotFound.statusCode, 404);
  });
});
