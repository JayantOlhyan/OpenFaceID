#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Ensure simulation environment is set for headless CI and automated testing
process.env.OPENFACEID_SIMULATION = '1';

const args = process.argv.slice(2);
let targetDirs = ['tests/unit', 'tests/evaluation', 'tests/performance'];

if (args.includes('--unit')) {
  targetDirs = ['tests/unit'];
} else if (args.includes('--eval')) {
  targetDirs = ['tests/evaluation'];
} else if (args.includes('--perf')) {
  targetDirs = ['tests/performance'];
}

const explicitFiles = args.filter((a) => !a.startsWith('--'));
const testFiles = [];

if (explicitFiles.length > 0) {
  for (const f of explicitFiles) {
    testFiles.push(f.replace(/\\/g, '/'));
  }
} else {
  for (const dir of targetDirs) {
    try {
      const fullDir = resolve(process.cwd(), dir);
      if (statSync(fullDir).isDirectory()) {
        const files = readdirSync(fullDir).filter((f) => f.endsWith('.test.ts'));
        for (const f of files) {
          testFiles.push(join(dir, f).replace(/\\/g, '/'));
        }
      }
    } catch {}
  }
}

if (testFiles.length === 0) {
  console.error('Error: No test files found matching criteria.');
  process.exit(1);
}

const nodeArgs = [
  '--experimental-strip-types',
  '--test',
  '--test-timeout=30000',
  ...testFiles,
];

const result = spawnSync(process.execPath, nodeArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    OPENFACEID_SIMULATION: '1',
  },
});

process.exit(result.status ?? 1);
