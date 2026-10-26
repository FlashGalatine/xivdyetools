/**
 * Test helper: a source-level import-graph scanner for the chara bundle-boundary tests.
 *
 * Only `import type` / `export type` is erased under `verbatimModuleSyntax`; `import { type X }`
 * keeps a side-effect import, so it counts as runtime. A dynamic `import()` counts as runtime too:
 * bundlers emit a chunk for every reachable dynamic import target.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface ImportSpecifier {
  specifier: string;
  typeOnly: boolean;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

/** Every import / re-export specifier, flagged type-only when it is `import type` / `export type`. */
export function importSpecifiers(source: string): ImportSpecifier[] {
  const code = stripComments(source);
  const found: ImportSpecifier[] = [];
  const staticImport = /\b(?:import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of code.matchAll(staticImport)) {
    found.push({ specifier: match[2], typeOnly: match[1] !== undefined });
  }
  for (const match of code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    found.push({ specifier: match[1], typeOnly: false });
  }
  return found;
}

function resolveLocal(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), specifier);
  for (const candidate of [base.replace(/\.js$/, '.ts'), base, `${base}/index.ts`]) {
    if (candidate.endsWith('.ts') && existsSync(candidate)) return candidate;
  }
  return null;
}

export interface RuntimeImportGraph {
  /** Local `.ts` modules reachable from the entry (the entry included). */
  files: Set<string>;
  /** Bare (package) specifiers those modules import at runtime. */
  packages: Set<string>;
  /** Relative specifiers that resolve to no `.ts` file (JSON data, for instance). */
  unresolved: Set<string>;
}

/** Walks runtime (non-type-only) static imports, re-exports and dynamic `import()` targets. */
export function runtimeImportGraph(entry: string): RuntimeImportGraph {
  const files = new Set<string>([entry]);
  const packages = new Set<string>();
  const unresolved = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    for (const { specifier, typeOnly } of importSpecifiers(readFileSync(file, 'utf8'))) {
      if (typeOnly) continue;
      if (!specifier.startsWith('.')) {
        packages.add(specifier);
        continue;
      }
      const target = resolveLocal(file, specifier);
      if (target === null) {
        unresolved.add(resolve(dirname(file), specifier));
      } else if (!files.has(target)) {
        files.add(target);
        queue.push(target);
      }
    }
  }
  return { files, packages, unresolved };
}

/** Local `.ts` modules reachable from `entry` through runtime (non-type-only) imports. */
export function runtimeClosure(entry: string): Set<string> {
  return runtimeImportGraph(entry).files;
}
