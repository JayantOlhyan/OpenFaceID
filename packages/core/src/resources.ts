import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Determines whether the current process is running inside a packaged desktop bundle.
 */
export function isPackagedApp(): boolean {
  if (process.env.OFID_DESKTOP_STANDALONE === 'true') return true;
  if (process.env.OFID_RESOURCES_DIR && fs.existsSync(process.env.OFID_RESOURCES_DIR)) return true;
  
  // Inspect __dirname for Contents/Resources
  const normalized = path.normalize(__dirname);
  return normalized.includes('/Contents/Resources') || normalized.includes('\\Contents\\Resources');
}

/**
 * Finds the canonical Contents/Resources directory if running inside an app bundle.
 */
export function getBundleResourcesDir(): string | null {
  if (process.env.OFID_RESOURCES_DIR && fs.existsSync(process.env.OFID_RESOURCES_DIR)) {
    return process.env.OFID_RESOURCES_DIR;
  }

  let curr = path.resolve(__dirname);
  while (curr !== path.dirname(curr)) {
    if (path.basename(curr) === 'Resources' && path.basename(path.dirname(curr)) === 'Contents') {
      return curr;
    }
    curr = path.dirname(curr);
  }

  // Also check relative to process.execPath (in case bundled node binary is at Contents/Resources/bin/node)
  const execDir = path.dirname(process.execPath);
  const candidateFromExec = path.resolve(execDir, '..');
  if (path.basename(candidateFromExec) === 'Resources') {
    return candidateFromExec;
  }

  return null;
}

/**
 * Finds the root repository directory in development mode.
 */
export function getRepoRootDir(): string | null {
  let curr = path.resolve(__dirname);
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, 'package.json')) && fs.existsSync(path.join(curr, 'packages'))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return null;
}

/**
 * Central production-safe bundle resource path resolver.
 * Resolves resources relative to the app bundle in production or repository root in development.
 */
export function getBundleResourcePath(relativePath: string): string {
  const cleanRelative = relativePath.replace(/^[\/\\]+/, '');
  const candidates: string[] = [];

  // 1. Explicit environment variable overrides
  if (process.env.OFID_RESOURCES_DIR) {
    candidates.push(path.resolve(process.env.OFID_RESOURCES_DIR, cleanRelative));
  }
  if (process.env.OFID_APP_DIR) {
    candidates.push(path.resolve(process.env.OFID_APP_DIR, cleanRelative));
  }

  // 2. Discovered bundle Resources directory
  const bundleResources = getBundleResourcesDir();
  if (bundleResources) {
    candidates.push(path.resolve(bundleResources, cleanRelative));
    // If cleanRelative starts with "app/", also check relative to Resources/app
    if (!cleanRelative.startsWith('app/')) {
      candidates.push(path.resolve(bundleResources, 'app', cleanRelative));
    }
  }

  // 3. Discovered repository root directory (development mode)
  const repoRoot = getRepoRootDir();
  if (repoRoot) {
    candidates.push(path.resolve(repoRoot, cleanRelative));
    if (cleanRelative.startsWith('app/')) {
      candidates.push(path.resolve(repoRoot, cleanRelative.replace(/^app\//, '')));
    }
  }

  // 4. Relative to process.cwd()
  candidates.push(path.resolve(process.cwd(), cleanRelative));

  // 5. Return the first candidate that exists on disk
  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand)) {
        return cand;
      }
    } catch {
      // Continue search
    }
  }

  // Fallback to first primary candidate if none exist yet
  return candidates[0] || path.resolve(process.cwd(), cleanRelative);
}

/**
 * Explicitly resolves the desktop UI index.html path.
 * Guaranteed to find the HTML entrypoint in both packaged and development environments.
 */
export function resolveDesktopUiHtml(): string {
  const candidates: string[] = [];

  // 1. Bundle packaged location: Contents/Resources/app/apps/desktop/index.html
  const resourcesDir = getBundleResourcesDir();
  if (resourcesDir) {
    candidates.push(path.resolve(resourcesDir, 'app/apps/desktop/index.html'));
    candidates.push(path.resolve(resourcesDir, 'apps/desktop/index.html'));
  }

  // 2. OFID_APP_DIR environment variable
  if (process.env.OFID_APP_DIR) {
    candidates.push(path.resolve(process.env.OFID_APP_DIR, 'apps/desktop/index.html'));
    candidates.push(path.resolve(process.env.OFID_APP_DIR, 'index.html'));
  }

  // 3. Local desktop app relative paths
  if (process.argv[1]) {
    const scriptDir = path.dirname(process.argv[1]);
    candidates.push(path.resolve(scriptDir, 'index.html'));
    candidates.push(path.resolve(scriptDir, 'apps/desktop/index.html'));
  }
  candidates.push(path.resolve(__dirname, 'index.html'));
  candidates.push(path.resolve(__dirname, '../index.html'));
  candidates.push(path.resolve(__dirname, '../../apps/desktop/index.html'));
  candidates.push(path.resolve(__dirname, '../../../apps/desktop/index.html'));

  // 4. Repository root relative path
  const repoRoot = getRepoRootDir();
  if (repoRoot) {
    candidates.push(path.resolve(repoRoot, 'apps/desktop/index.html'));
  }

  // 5. Process working directory relative
  candidates.push(path.resolve(process.cwd(), 'apps/desktop/index.html'));
  candidates.push(path.resolve(process.cwd(), 'index.html'));

  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand) && fs.statSync(cand).size > 0) {
        return cand;
      }
    } catch {
      // Continue search
    }
  }

  throw new Error(
    `Failed to locate desktop UI index.html. Checked locations:\n${candidates.map((c) => '  - ' + c).join('\n')}`
  );
}

/**
 * Resolves static assets (favicons, PNGs, logos) in both packaged and development modes.
 */
export function resolveDesktopAsset(assetPath: string): string | null {
  const clean = assetPath.replace(/^[\/\\]+/, '');
  const candidates: string[] = [];

  const resourcesDir = getBundleResourcesDir();
  if (resourcesDir) {
    candidates.push(path.resolve(resourcesDir, 'app/apps/desktop', clean));
    candidates.push(path.resolve(resourcesDir, 'apps/desktop', clean));
    candidates.push(path.resolve(resourcesDir, clean));
  }

  if (process.env.OFID_APP_DIR) {
    candidates.push(path.resolve(process.env.OFID_APP_DIR, 'apps/desktop', clean));
    candidates.push(path.resolve(process.env.OFID_APP_DIR, clean));
  }

  const repoRoot = getRepoRootDir();
  if (repoRoot) {
    candidates.push(path.resolve(repoRoot, 'apps/desktop', clean));
  }

  if (process.argv[1]) {
    const scriptDir = path.dirname(process.argv[1]);
    candidates.push(path.resolve(scriptDir, clean));
    candidates.push(path.resolve(scriptDir, 'apps/desktop', clean));
  }
  candidates.push(path.resolve(__dirname, clean));
  candidates.push(path.resolve(__dirname, '../../apps/desktop', clean));
  candidates.push(path.resolve(process.cwd(), clean));

  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand)) {
        return cand;
      }
    } catch {
      // Continue search
    }
  }

  return null;
}
