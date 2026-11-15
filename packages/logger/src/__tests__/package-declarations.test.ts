import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = resolve(packageRoot, '../..');
const tsc = join(workspaceRoot, 'node_modules/typescript/bin/tsc');

// The package barrels re-export these six declarations as published API. Their JSDoc once
// carried @internal, which stripInternal honors by deleting the declaration while leaving
// the re-export behind, so the emitted .d.ts files named symbols that no longer existed.
const contracts = [
  ['adapters/console-adapter', 'class', 'ConsoleAdapter'],
  ['adapters/json-adapter', 'class', 'JsonAdapter'],
  ['adapters/noop-adapter', 'class', 'NoopAdapter'],
  ['core/base-logger', 'abstract class', 'BaseLogger'],
  ['types', 'interface', 'LogEntry'],
  ['presets/worker', 'function', 'createWorkerLogger'],
] as const;

it('emits declarations for the public barrel re-exports and type-checks the emitted entry points strictly', () => {
  const output = resolve(mkdtempSync(join(tmpdir(), 'xiv-logger-declarations-')));
  // Validate the unique cleanup target before entering the compiler/cleanup boundary.
  if (!output.startsWith(resolve(tmpdir()) + sep) || !basename(output).startsWith('xiv-logger-declarations-')) {
    throw new Error('Refusing cleanup outside the named declaration-test directory');
  }
  try {
    // Exercise the actual stripInternal build, independently of pre-existing dist or skipLibCheck.
    execFileSync(process.execPath, [tsc, '-p', join(packageRoot, 'tsconfig.build.json'), '--emitDeclarationOnly', '--outDir', output], {
      cwd: packageRoot,
      stdio: 'pipe',
      windowsHide: true,
    });
    for (const [file, kind, name] of contracts) {
      expect(readFileSync(join(output, `${file}.d.ts`), 'utf8'), `${name} must survive declaration emission`).toMatch(
        new RegExp(`export (declare )?${kind} ${name}\\b`),
      );
    }
    // Every barrel re-export must resolve: check the emitted entry points with library checking ON,
    // the way a strict consumer's compiler does. The DOM and WebWorker libs conflict with each
    // other under library checking, so a consumer picks one; DOM covers a browser or Node host.
    writeFileSync(
      join(output, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          lib: ['ES2022', 'DOM'],
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          types: [],
        },
        files: ['index.d.ts', 'presets/browser.d.ts', 'presets/worker.d.ts', 'presets/library.d.ts'],
      }),
    );
    execFileSync(process.execPath, [tsc, '-p', join(output, 'tsconfig.json')], { cwd: output, stdio: 'pipe', windowsHide: true });
  } finally {
    // Only remove the unique output directory created by this test.
    rmSync(output, { recursive: true, force: true });
  }
  // Compiling the complete declaration graph twice deserves its own bounded integration-test budget.
}, 60_000);
