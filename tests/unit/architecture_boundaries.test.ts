import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

function findSourceFiles(dir: string): string[] {
  let files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(findSourceFiles(fullPath));
    } else if (/\.(ts|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

describe('Architectural Boundaries & Dependency Invariants (Section 57 & 58)', () => {
  it('enforces that packages never import from apps/ or UI layers', () => {
    const packageFiles = findSourceFiles('packages');
    assert.ok(packageFiles.length > 20, 'Found package source files');

    for (const file of packageFiles) {
      const imports = extractImports(file);
      for (const imp of imports) {
        assert.ok(
          !imp.includes('/apps/') && !imp.startsWith('../../apps') && !imp.startsWith('../../../apps'),
          `Forbidden dependency: Package file ${file} imports from apps layer: ${imp}`
        );
        assert.ok(
          !imp.includes('react') && imp !== 'react',
          `Forbidden dependency: Package file ${file} imports React: ${imp}`
        );
      }
    }
  });

  it('enforces that packages/core never imports downstream domain packages', () => {
    const coreFiles = findSourceFiles('packages/core/src');
    const forbiddenDownstream = [
      'vision',
      'camera',
      'storage',
      'security',
      'platform',
      'api',
      'automation',
    ];

    for (const file of coreFiles) {
      const imports = extractImports(file);
      for (const imp of imports) {
        for (const pkg of forbiddenDownstream) {
          assert.ok(
            !imp.includes(`packages/${pkg}`) && !imp.includes(`../${pkg}`) && !imp.includes(`../../${pkg}`),
            `Architecture Violation: core file ${file} imports downstream package ${pkg}: ${imp}`
          );
        }
      }
    }
  });

  it('enforces that packages/security never imports UI, vision, or presence', () => {
    const secFiles = findSourceFiles('packages/security/src');
    const forbidden = ['vision', 'presence', 'automation', 'api'];

    for (const file of secFiles) {
      const imports = extractImports(file);
      for (const imp of imports) {
        for (const pkg of forbidden) {
          assert.ok(
            !imp.includes(`packages/${pkg}`) && !imp.includes(`../${pkg}`) && !imp.includes(`../../${pkg}`),
            `Architecture Violation: security file ${file} imports package ${pkg}: ${imp}`
          );
        }
      }
    }
  });

  it('enforces that packages/vision never imports notifications or API', () => {
    const visionFiles = findSourceFiles('packages/vision/src');
    for (const file of visionFiles) {
      const imports = extractImports(file);
      for (const imp of imports) {
        assert.ok(
          !imp.includes('notifications'),
          `Architecture Violation: vision file ${file} imports notifications: ${imp}`
        );
        assert.ok(
          !imp.includes('packages/api'),
          `Architecture Violation: vision file ${file} imports api: ${imp}`
        );
      }
    }
  });

  it('enforces that runtime dependencies in package.json remain zero', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    assert.equal(pkg.dependencies, undefined, 'Monorepo must have 0 runtime dependencies');
  });
});
