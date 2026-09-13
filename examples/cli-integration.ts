/**
 * OpenFaceID Developer Example: Programmatic CLI Integration
 *
 * Purpose:
 *   Demonstrates executing the OpenFaceID CLI tool programmatically and parsing
 *   its machine-readable JSON output for automated scripting or telemetry.
 *
 * Requirements:
 *   - Node.js >= 22.0.0
 *
 * Run Command:
 *   node --experimental-strip-types examples/cli-integration.ts
 *
 * Expected Output:
 *   Structured status output, exit codes, and health check result.
 *
 * Security Considerations:
 *   CLI JSON output contains zero raw biometric vectors or face captures.
 */

import { execFile } from 'child_process';
import path from 'path';

function runCli(args: string[]): Promise<{ stdout: string; exitCode: number }> {
  const cliPath = path.resolve('apps/cli/bin/openfaceid.ts');
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--experimental-strip-types', cliPath, ...args],
      { timeout: 10000 },
      (error, stdout) => {
        resolve({
          stdout: stdout.trim(),
          exitCode: error ? (error.code as number) || 1 : 0,
        });
      }
    );
  });
}

async function run() {
  console.log('=== OpenFaceID Example: Programmatic CLI Integration ===\n');

  // 1. Run 'version --json'
  console.log('1. Executing: openfaceid version --json');
  const verRes = await runCli(['version', '--json']);
  console.log(`   Exit Code: ${verRes.exitCode}`);
  const versionData = JSON.parse(verRes.stdout);
  console.log(`   App:       ${versionData.name} v${versionData.version} (${versionData.codeName})`);
  console.log(`   OS:        ${versionData.platform.os} (${versionData.platform.arch})`);

  // 2. Run 'doctor --json'
  console.log('\n2. Executing: openfaceid doctor --json');
  const docRes = await runCli(['doctor', '--json']);
  console.log(`   Exit Code: ${docRes.exitCode}`);
  const doctorData = JSON.parse(docRes.stdout);
  console.log(`   Healthy:   ${doctorData.healthy ? 'YES' : 'NO'}`);
  console.log(`   Passed:    ${doctorData.passCount} / ${doctorData.totalChecks} checks`);

  // 3. Test Invalid Command Exit Code
  console.log('\n3. Executing invalid command to test error exit code:');
  const errRes = await runCli(['nonexistent-command', '--json']);
  console.log(`   Exit Code: ${errRes.exitCode} (Expected: 2 = INVALID_ARGUMENTS)`);
  const errData = JSON.parse(errRes.stdout);
  console.log(`   Error:     ${errData.error}`);

  console.log('\n✓ CLI integration example completed successfully.');
}

run().catch(console.error);
