import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'events';
import { LocalApiServer } from '../../packages/api/src/index.ts';

class MockResponse extends EventEmitter {
  public statusCode: number = 200;
  public headers: Record<string, string> = {};
  public body: string = '';

  public setHeader(key: string, val: string) {
    this.headers[key.toLowerCase()] = val;
  }

  public writeHead(code: number, headers?: Record<string, string>) {
    this.statusCode = code;
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        this.headers[k.toLowerCase()] = v;
      }
    }
  }

  public write(chunk: string) {
    this.body += chunk;
  }

  public end(data?: string) {
    if (data) this.body += data;
    this.emit('finish');
  }
}

function simulateRequest(
  server: LocalApiServer,
  path: string,
  method: string = 'GET',
  headers: Record<string, string> = {}
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  const req = {
    url: path,
    method,
    headers,
    on: () => {},
  };
  const res = new MockResponse();

  return new Promise((resolve) => {
    res.on('finish', () => {
      resolve({ status: res.statusCode, body: res.body, headers: res.headers });
    });
    server.handleRequest(req, res);
  });
}

describe('LocalApiServer', () => {
  it('serves public status and enforces authentication on sensitive endpoints', async () => {
    const apiServer = new LocalApiServer({ port: 42891 });
    const token = apiServer.getApiToken();

    // 1. Public Status Endpoint
    const statusRes = await simulateRequest(apiServer, '/api/v1/status');
    assert.equal(statusRes.status, 200);
    const statusJson = JSON.parse(statusRes.body);
    assert.equal(statusJson.status, 'active');
    assert.equal(statusJson.localProcessingOnly, true);
    assert.equal(statusJson.cloudEgress, false);

    // 2. Sensitive endpoint without bearer token -> 401
    const unauthRes = await simulateRequest(apiServer, '/api/v1/identities');
    assert.equal(unauthRes.status, 401);
    const errJson = JSON.parse(unauthRes.body);
    assert.ok(errJson.error.includes('Unauthorized'));

    // 3. Sensitive endpoint with valid bearer token -> 200
    const authRes = await simulateRequest(apiServer, '/api/v1/identities', 'GET', {
      authorization: `Bearer ${token}`,
    });
    assert.equal(authRes.status, 200);
    const identitiesJson = JSON.parse(authRes.body);
    assert.ok(Array.isArray(identitiesJson.identities));

    // 4. Unknown endpoint with valid auth -> 404
    const notFoundRes = await simulateRequest(apiServer, '/api/v1/unknown', 'GET', {
      authorization: `Bearer ${token}`,
    });
    assert.equal(notFoundRes.status, 404);
  });
});
