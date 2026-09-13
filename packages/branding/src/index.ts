/**
 * OpenFaceID / SightLock Centralized Branding Configuration
 * All product names, descriptions, taglines, identifiers, and repositories
 * are declared here so rebranding does not require rewriting the codebase.
 */

import { execFileSync } from 'child_process';

export interface ProductBranding {
  name: string;
  version: string;
  codeName: string;
  displayName: string;
  tagline: string;
  alternateTagline: string;
  shortDescription: string;
  fullDescription: string;
  vendor: {
    name: string;
    author: string;
    githubOwner: string;
    url: string;
  };
  identifiers: {
    bundleId: string;
    appId: string;
    cliCommand: string;
    alternateCliCommand: string;
    configDirectoryName: string;
    localApiPort: number;
  };
  repository: {
    url: string;
    issuesUrl: string;
    securityUrl: string;
    defaultBranch: string;
  };
  security: {
    philosophy: string;
    boundaryWarning: string;
    noPlaintextPasswords: boolean;
    localOnly: boolean;
  };
}

export const BRANDING: ProductBranding = {
  name: 'OpenFaceID',
  version: '0.2.1-rc.1',
  codeName: 'SightLock',
  displayName: 'OpenFaceID',
  tagline: 'Face recognition for every desktop.',
  alternateTagline: 'Local webcam presence detection and biometric verification for desktop systems.',
  shortDescription: 'Open-source, privacy-first, cross-platform face recognition and presence system.',
  fullDescription:
    'SightLock (OpenFaceID) brings a seamless, privacy-preserving face recognition and presence detection workflow to ordinary desktop computers using available 2D webcams, keeping all biometric data local and encrypted.',
  vendor: {
    name: 'OpenFaceID Community',
    author: 'Jayant Olhyan',
    githubOwner: 'JayantOlhyan',
    url: 'https://github.com/JayantOlhyan/OpenFaceID',
  },
  identifiers: {
    bundleId: 'org.openfaceid.desktop',
    appId: 'openfaceid-desktop',
    cliCommand: 'openfaceid',
    alternateCliCommand: 'sightlock',
    configDirectoryName: '.openfaceid',
    localApiPort: 41793,
  },
  repository: {
    url: 'https://github.com/JayantOlhyan/OpenFaceID',
    issuesUrl: 'https://github.com/JayantOlhyan/OpenFaceID/issues',
    securityUrl: 'https://github.com/JayantOlhyan/OpenFaceID/security/policy',
    defaultBranch: 'main',
  },
  security: {
    philosophy: 'Your face data stays on your computer.',
    boundaryWarning:
      'OpenFaceID operates on standard 2D camera streams and is NOT a replacement for hardware-attested authenticators such as Apple Face ID, Touch ID, or Windows Hello IR.',
    noPlaintextPasswords: true,
    localOnly: true,
  },
};

export interface BuildMetadata {
  version: string;
  gitCommit: string;
  commitSha: string;
  buildDate: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  visionEngineVersion: string;
}

export function getBuildMetadata(): BuildMetadata {
  let commit = process.env.GIT_COMMIT || '';
  if (!commit) {
    try {
      commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 1000, stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch {
      commit = '2bbe16710c389ff378d1686207431599b502d352';
    }
  }

  return {
    version: BRANDING.version,
    gitCommit: commit.slice(0, 7),
    commitSha: commit,
    buildDate: process.env.BUILD_DATE || new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    visionEngineVersion: 'BlazeFace-896A-NMS+ArcFace-512D+PAD-8State',
  };
}

export default BRANDING;
