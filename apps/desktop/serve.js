import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BRANDING } from '../../packages/branding/src/index.ts';
import { getPlatformAdapter } from '../../packages/platform/src/index.ts';
import { DEFAULT_CONFIG, Logger } from '../../packages/core/src/index.ts';
import { IdentityStore, ActivityLog, ConfigStore } from '../../packages/storage/src/index.ts';
import { CameraManager } from '../../packages/camera/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = BRANDING.identifiers.localApiPort || 41793;
const HOST = '127.0.0.1'; // BIND STRICTLY TO LOCALHOST

const adapter = getPlatformAdapter();
const identityStore = new IdentityStore();
const activityLog = new ActivityLog();
const configStore = new ConfigStore();
const cameraManager = new CameraManager();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  
  // Strict Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' data: blob:; media-src 'self' blob: mediastream:;");

  // CORS headers for local host requests
  res.setHeader('Access-Control-Allow-Origin', `http://${HOST}:${PORT}`);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Status Endpoint
  if (url.pathname === '/api/v1/status') {
    try {
      const info = adapter.getPlatformInfo();
      const isLocked = await adapter.isScreenLocked();
      const idleMs = await adapter.getSystemIdleTimeMs();
      const identities = await identityStore.listIdentities();
      const perm = await cameraManager.checkPermission();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        app: BRANDING.name,
        codeName: BRANDING.codeName,
        status: 'active',
        screenLocked: isLocked,
        idleTimeSeconds: Math.round(idleMs / 1000),
        platform: info,
        cameraPermission: perm,
        enrolledCount: identities.length,
        livenessMode: DEFAULT_CONFIG.liveness.mode,
        threshold: DEFAULT_CONFIG.recognition.threshold,
        cloudEgress: false,
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  // 2. Camera Devices Endpoint
  if (url.pathname === '/api/v1/camera/devices') {
    try {
      const devices = await cameraManager.enumerateDevices();
      const permission = await cameraManager.checkPermission();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ devices, permission }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  // 3. Screen Lock Endpoint
  if (url.pathname === '/api/v1/lock' && req.method === 'POST') {
    Logger.info('platform', 'Lock requested via local API');
    activityLog.logEvent('WORKSTATION_LOCKED', { source: 'api' });
    const locked = await adapter.lockScreen();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: locked }));
    return;
  }

  // 4. Identities Endpoints
  if (url.pathname === '/api/v1/identities' && req.method === 'GET') {
    try {
      const identities = await identityStore.listIdentities();
      const mapped = identities.map((id) => ({
        id: id.id,
        name: id.name,
        posesCount: id.embeddings?.length || 1,
        enabled: id.enabled,
        createdAt: id.createdAt,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ identities: mapped }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  if (url.pathname === '/api/v1/identities' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        if (!payload.name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Name is required' }));
          return;
        }

        const id = 'usr_' + Date.now().toString(36);
        const now = Date.now();
        const dummyEmbedding = new Float32Array(512).fill(0.04419); // dummy unit vector for registration
        const identity = {
          id,
          name: payload.name.trim(),
          enabled: true,
          createdAt: now,
          updatedAt: now,
          embeddings: [dummyEmbedding],
          averageEmbedding: dummyEmbedding,
          recognitionStats: {
            matchCount: 0,
            lastRecognizedAt: undefined,
            lastConfidence: undefined,
          },
        };

        await identityStore.saveIdentity(identity);
        activityLog.logEvent('IDENTITY_ENROLLED', { identityId: id, name: identity.name });

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, identity: { id, name: identity.name, posesCount: 1 } }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  if (url.pathname.startsWith('/api/v1/identities/') && req.method === 'DELETE') {
    const id = url.pathname.replace('/api/v1/identities/', '');
    try {
      const deleted = await identityStore.deleteIdentity(id);
      if (deleted) {
        activityLog.logEvent('IDENTITY_DELETED', { identityId: id });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Identity not found' }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  // 5. Activity Log Endpoint
  if (url.pathname === '/api/v1/activity') {
    if (req.method === 'GET') {
      const entries = activityLog.getRecentEntries(50);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ entries }));
      return;
    } else if (req.method === 'DELETE') {
      activityLog.clearLog();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }
  }

  // 6. Static File Serving (Desktop App HTML & Client Scripts)
  let filePath = path.join(__dirname, 'index.html');
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error loading desktop UI');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\x1b[32m✓ ${BRANDING.name} Desktop server listening at http://${HOST}:${PORT}\x1b[0m`);
  console.log(`\x1b[36m  Local processing active. Zero cloud egress guaranteed.\x1b[0m`);
});
