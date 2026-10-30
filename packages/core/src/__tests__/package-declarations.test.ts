import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = resolve(coreRoot, '../..');

it('emits declarations for the existing public utility reexports', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'xiv-core-declarations-'));
  const output = resolve(temporary);
  // Validate the unique cleanup target before entering the compiler/cleanup boundary.
  if (!output.startsWith(resolve(tmpdir()) + sep) || !basename(output).startsWith('xiv-core-declarations-')) {
    throw new Error('Refusing cleanup outside the named declaration-test directory');
  }
  try {
    // Exercise the actual stripInternal build, independently of pre-existing dist or skipLibCheck.
    execFileSync(process.execPath, [
      join(workspaceRoot, 'node_modules/typescript/bin/tsc'),
      '-p', join(coreRoot, 'tsconfig.build.json'),
      '--emitDeclarationOnly', '--outDir', output,
    ], { cwd: coreRoot, stdio: 'pipe', windowsHide: true });
    const rootDeclarations = readFileSync(join(output, 'index.d.ts'), 'utf8');
    const utilities = readFileSync(join(output, 'utils/index.d.ts'), 'utf8');
    for (const name of ['clamp', 'round', 'isValidRGB', 'isValidHSV', 'isAbortError']) {
      expect(rootDeclarations, `${name} is an existing package-root export`).toContain(name);
      expect(utilities, `${name} must survive declaration emission`).toMatch(
        new RegExp(`export declare function ${name}\\(`),
      );
    }
  } finally {
    // Only remove the unique output directory created by this test.
    rmSync(output, { recursive: true, force: true });
  }
  // Compiling the complete declaration graph deserves its own bounded integration-test budget.
}, 30_000);
