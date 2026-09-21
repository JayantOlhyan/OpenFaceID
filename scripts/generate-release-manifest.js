#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BRANDING, getBuildMetadata } from '../packages/branding/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function run() {
  console.log(`=== Generating OpenFaceID Release Manifest (v${BRANDING.version}) ===`);

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  const entries = fs.readdirSync(DIST_DIR);
  const artifacts = [];
  const checksumLines = [];

  for (const entry of entries) {
    const fullPath = path.join(DIST_DIR, entry);
    const stat = fs.statSync(fullPath);

    // Skip directories, manifest, and SHA256SUMS
    if (stat.isDirectory() || entry === 'release-manifest.json' || entry === 'SHA256SUMS' || entry.startsWith('.')) {
      continue;
    }

    const sha256 = computeSha256(fullPath);
    checksumLines.push(`${sha256}  ${entry}`);

    let platform = 'unknown';
    let arch = 'universal';
    let format = path.extname(entry).slice(1);

    if (entry.includes('macos') || entry.includes('arm64.dmg')) {
      platform = 'macos';
      arch = entry.includes('arm64') ? 'arm64' : 'universal';
    } else if (entry.includes('linux') || entry.includes('.deb') || entry.includes('.tar.gz')) {
      platform = 'linux';
      arch = 'x86_64';
    } else if (entry.includes('windows') || entry.includes('.exe') || entry.includes('.cmd')) {
      platform = 'windows';
      arch = 'x64';
    }

    artifacts.push({
      filename: entry,
      platform,
      arch,
      format,
      sizeBytes: stat.size,
      sha256,
    });

    console.log(`  • ${entry} (${stat.size} bytes) -> SHA-256: ${sha256.substring(0, 16)}...`);
  }

  // 1. Write SHA256SUMS
  const shaSumsPath = path.join(DIST_DIR, 'SHA256SUMS');
  fs.writeFileSync(shaSumsPath, checksumLines.join('\n') + (checksumLines.length ? '\n' : ''), 'utf8');
  console.log(`✓ Generated ${shaSumsPath}`);

  // 2. Write release-manifest.json
  const manifest = {
    schemaVersion: '1.0.0',
    app: {
      name: BRANDING.name,
      codename: BRANDING.codeName,
      version: BRANDING.version,
      tagline: BRANDING.tagline,
      repository: BRANDING.repository.url,
    },
    releaseDate: new Date().toISOString(),
    buildMetadata: getBuildMetadata(),
    platforms: {
      macos: {
        supported: true,
        verificationStatus: 'PHYSICALLY VERIFIED',
        minOsVersion: 'macOS 13.0 (Ventura)',
        testedArchitectures: ['arm64 (Apple Silicon)'],
      },
      windows: {
        supported: false,
        verificationStatus: 'UNVERIFIED (PHYSICAL HARDWARE TEST PENDING)',
        codeStatus: 'IMPLEMENTED',
        minOsVersion: 'Windows 10 Build 19041+',
        targetArchitectures: ['x64'],
      },
      linux: {
        supported: false,
        verificationStatus: 'UNVERIFIED (PHYSICAL HARDWARE TEST PENDING)',
        codeStatus: 'IMPLEMENTED',
        minOsVersion: 'Ubuntu 22.04 LTS / Debian 12 / Fedora 38',
        targetArchitectures: ['x86_64'],
      },
    },
    security: {
      algorithm: 'SHA-256',
      zeroCloudGuarantee: true,
      encryptionAlgorithm: 'AES-256-GCM',
    },
    artifacts,
  };

  const manifestPath = path.join(DIST_DIR, 'release-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`✓ Generated ${manifestPath}`);
  console.log(`=== Release Engineering Complete ===`);
}

run();
