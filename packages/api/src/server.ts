import http from 'http';
import crypto from 'crypto';
import { BRANDING } from '../../branding/src/index.ts';
import { getPlatformAdapter } from '../../platform/src/index.ts';
import { EventBus, DEFAULT_CONFIG, Logger } from '../../core/src/index.ts';
import { IdentityStore } from '../../storage/src/index.ts';
import { CryptoManager } from '../../security/src/index.ts';

export interface LocalApiOptions {
  port?: number;
  host?: string;
  identityStore?: IdentityStore;
}

export class LocalApiServer {
  private server: http.Server | null = null;
  private port: number;
  private host: string;
  private apiToken: string;
  private identityStore: IdentityStore;
  private sseClients: Set<http.ServerResponse> = new Set();
  private busUnsubscribe: (() => void) | null = null;

  constructor(options: LocalApiOptions = {}) {
    this.port = options.port || BRANDING.identifiers.localApiPort || 41793;
    this.host = '127.0.0.1'; // BIND STRICTLY TO LOCALHOST
    this.apiToken = 'ofid_' + crypto.randomBytes(24).toString('hex');
    this.identityStore = options.identityStore || new IdentityStore();
  }

  public getApiToken(): string {
    return this.apiToken;
  }

  public getPort(): number {
    return this.port;
  }

  public async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      // Hook up EventBus to SSE
      const bus = EventBus.getInstance();
      const eventsToStream = ['USER_PRESENT', 'USER_LEFT', 'IDENTITY_MATCHED', 'CAMERA_CONNECTED', 'CAMERA_DISCONNECTED'];
      for (const evt of eventsToStream) {
        bus.subscribe(evt as any, (event) => {
          this.broadcastSse(event.type, event.payload);
        });
      }

      this.server.listen(this.port, this.host, () => {
        const url = `http://${this.host}:${this.port}`;
        Logger.info('security', `Local API server listening strictly on ${url}`);
        resolve(url);
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        for (const client of this.sseClients) {
          client.end();
        }
        this.sseClients.clear();
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public async handleRequest(req: any, res: any): Promise<void> {
    const url = new URL(req.url || '/', `http://${this.host}:${this.port}`);
    const method = req.method || 'GET';

    // Set strict local headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', `http://127.0.0.1:${this.port}`);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Public Status Endpoint
    if (url.pathname === '/api/v1/status' && method === 'GET') {
      const adapter = getPlatformAdapter();
      const info = adapter.getPlatformInfo();
      const isLocked = await adapter.isScreenLocked();
      const idleMs = await adapter.getSystemIdleTimeMs();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          app: BRANDING.name,
          codeName: BRANDING.codeName,
          status: 'active',
          screenLocked: isLocked,
          idleSeconds: Math.round(idleMs / 1000),
          livenessMode: DEFAULT_CONFIG.liveness.mode,
          matchThreshold: DEFAULT_CONFIG.recognition.threshold,
          platform: info.os,
          localProcessingOnly: true,
          cloudEgress: false,
        })
      );
      return;
    }

    // SSE Stream
    if (url.pathname === '/api/v1/events' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);
      this.sseClients.add(res);

      req.on('close', () => {
        this.sseClients.delete(res);
      });
      return;
    }

    // Authenticated Endpoints Guard
    if (url.pathname.startsWith('/api/v1/')) {
      const authHeader = req.headers['authorization'] || '';
      const providedToken = authHeader.replace(/^Bearer\s+/i, '');

      // Check token in constant time
      if (!CryptoManager.verifyTimingSafe(providedToken, this.apiToken)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing bearer token' }));
        return;
      }

      // GET /api/v1/identities
      if (url.pathname === '/api/v1/identities' && method === 'GET') {
        const identities = await this.identityStore.listIdentities();
        const sanitized = identities.map((id) => ({
          id: id.id,
          name: id.name,
          enabled: id.enabled,
          posesCount: id.embeddings.length,
          createdAt: id.createdAt,
          updatedAt: id.updatedAt,
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ identities: sanitized }));
        return;
      }

      // POST /api/v1/lock
      if (url.pathname === '/api/v1/lock' && method === 'POST') {
        const adapter = getPlatformAdapter();
        const success = await adapter.lockScreen();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
        return;
      }

      // POST /api/v1/identities
      if (url.pathname === '/api/v1/identities' && method === 'POST') {
        let body = '';
        let bodyTooLarge = false;

        await new Promise<void>((resolve) => {
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString();
            if (body.length > 1024 * 1024) {
              bodyTooLarge = true;
              res.writeHead(413, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Payload Too Large: Max body size is 1MB' }));
              resolve();
            }
          });
          req.on('end', () => resolve());
        });

        if (bodyTooLarge) return;

        let payload: any;
        try {
          payload = JSON.parse(body || '{}');
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
          return;
        }

        if (!payload || typeof payload.name !== 'string' || !payload.name.trim() || payload.name.trim().length > 64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid name: Must be a non-empty string of 1 to 64 characters' }));
          return;
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, name: payload.name.trim() }));
        return;
      }

      // DELETE /api/v1/identities/:id
      if (url.pathname.startsWith('/api/v1/identities/') && method === 'DELETE') {
        const id = url.pathname.split('/').pop() || '';
        const ID_REGEX = /^usr_[a-zA-Z0-9_-]{1,64}$/;
        if (!ID_REGEX.test(id)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid identity ID format: Must match ^usr_[a-zA-Z0-9_-]{1,64}$' }));
          return;
        }

        const deleted = await this.identityStore.deleteIdentity(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: deleted }));
        return;
      }
    }

    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }

  private broadcastSse(type: string, data: unknown): void {
    const payload = `data: ${JSON.stringify({ type, payload: data, timestamp: Date.now() })}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(payload);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }
}
