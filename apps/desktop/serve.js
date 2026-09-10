import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BRANDING } from '../../packages/branding/src/index.ts';
import { getPlatformAdapter } from '../../packages/platform/src/index.ts';
import { DEFAULT_CONFIG, Logger } from '../../packages/core/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = BRANDING.identifiers.localApiPort || 41793;
const HOST = '127.0.0.1'; // BIND STRICTLY TO LOCALHOST

const adapter = getPlatformAdapter();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' data:;");

  // Local REST API endpoints
  if (url.pathname === '/api/v1/status') {
    const info = adapter.getPlatformInfo();
    const isLocked = await adapter.isScreenLocked();
    const idleMs = await adapter.getSystemIdleTimeMs();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      app: BRANDING.name,
      codeName: BRANDING.codeName,
      status: 'active',
      screenLocked: isLocked,
      idleTimeSeconds: Math.round(idleMs / 1000),
      platform: info,
      livenessMode: DEFAULT_CONFIG.liveness.mode,
      threshold: DEFAULT_CONFIG.recognition.threshold,
      cloudEgress: false,
    }));
    return;
  }

  if (url.pathname === '/api/v1/lock' && req.method === 'POST') {
    Logger.info('platform', 'Lock requested via local API');
    const locked = await adapter.lockScreen();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: locked }));
    return;
  }

  if (url.pathname === '/api/v1/identities') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      identities: [
        { id: 'usr_01jk98', name: 'Jayant Olhyan', posesCount: 5, enabled: true, createdAt: 1789000000000 },
        { id: 'usr_02xy74', name: 'Jayant (With Glasses)', posesCount: 5, enabled: true, createdAt: 1789000000000 }
      ]
    }));
    return;
  }

  // Static File Serving
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
