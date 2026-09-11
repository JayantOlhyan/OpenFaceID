/**
 * OpenFaceID / SightLock Centralized Branding Configuration
 * All product names, descriptions, taglines, identifiers, and repositories
 * are declared here so rebranding does not require rewriting the codebase.
 */

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
  version: '0.1.0',
  codeName: 'SightLock',
  displayName: 'OpenFaceID',
  tagline: 'Face recognition for every desktop.',
  alternateTagline: 'Open-source Face ID for every desktop.',
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

export default BRANDING;
