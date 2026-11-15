import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = resolve(packageRoot, '../..');
const contracts = [
  ['index', 'commands/harmony', 'const', 'HARMONY_TYPES'],
  ['index', 'commands/accessibility', 'const', 'VISION_TYPES'],
  ['index', 'input-resolution', 'interface', 'ResolveColorOptions'],
  ['i18n/index', 'i18n/types', 'interface', 'LocaleData'],
  ['i18n/index', 'i18n/types', 'interface', 'TranslatorLogger'],
] as const;

it('emits declarations for existing public command and translator contracts', () => {
  const output = resolve(mkdtempSync(join(tmpdir(), 'xiv-bot-declarations-')));
  if (!output.startsWith(resolve(tmpdir()) + sep) || !basename(output).startsWith('xiv-bot-declarations-')) {
    throw new Error('Refusing cleanup outside the named declaration-test directory');
  }
  try {
    // Use the real stripInternal configuration rather than an existing dist or skipLibCheck.
    execFileSync(process.execPath, [
      join(workspaceRoot, 'node_modules/typescript/bin/tsc'),
      '-p', join(packageRoot, 'tsconfig.build.json'),
      '--emitDeclarationOnly', '--outDir', output,
    ], { cwd: packageRoot, stdio: 'pipe', windowsHide: true });
    for (const [entry, module, kind, name] of contracts) {
      expect(readFileSync(join(output, entry + '.d.ts'), 'utf8'), `${name} remains reexported`).toContain(name);
      expect(readFileSync(join(output, module + '.d.ts'), 'utf8'), `${name} must survive declaration emission`).toMatch(
        new RegExp(`export ${kind === 'const' ? 'declare ' : ''}${kind} ${name}\\b`),
      );
    }
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}, 30_000);
