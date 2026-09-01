#!/usr/bin/env tsx
/**
 * Test-only reachability gate.
 *
 * knip treats test files as entries, so anything a test imports counts as used —
 * which is how 1,240 lines of orphaned web-app modules survived a dedicated
 * dead-code audit (2026-09-01, DEAD-001/002/003). knip 6 also dropped the
 * classMembers rule entirely. This closes both gaps by asking one question at
 * three granularities: is this reachable from production code, or only tests?
 *
 * Escape hatches: `@testonly <reason>` (only tests reach this — it may be
 * deletable) and `@entrypoint <reason>` (reached only by an external
 * convention static analysis can't see — must never be deleted). Both
 * require a reason; the two categories are reported separately so the list
 * that "someone eventually questions" doesn't conflate deletable with
 * load-bearing.
 * Spec: docs/superpowers/specs/2026-09-01-dead-code-guardrails-design.md
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, posix as posixPath } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Violation = {
  kind: 'file' | 'export' | 'member';
  file: string;
  name?: string;
  testRefs: number;
};

/** Workspaces excluded wholesale, with the reason they are excluded. */
const EXCLUDED_WORKSPACES: Record<string, string> = {
  'apps/stoat-worker': 'parked — no active investment (audit-shared/units.md)',
};

/**
 * Test-file patterns, matched against the WORKSPACE-RELATIVE path.
 *
 * Anchoring matters: a naive whole-path match on `test-utils` classifies all of
 * packages/test-utils/src/** as test code and blinds the checker to that package —
 * which is exactly where it needs to look (14 of its 36 exports had no external
 * consumer at the 2026-09-01 audit). packages/test-utils is production code for
 * its consumers; only an app's own tests/test-utils.ts is a test file.
 */
const TEST_PATTERNS = [
  /\.(test|spec)\.[tj]sx?$/,
  /(^|\/)__tests__\//,
  /(^|\/)__fixtures__\//,
  /(^|\/)__mocks__\//,
  /(^|\/)mocks\//,
  /(^|\/)e2e\//,
  /(^|\/)tests?\//,
  /(^|\/)test-utils\.[tj]sx?$/,
  /(^|\/)test-setup\.[tj]sx?$/,
];

const WORKSPACE_RE = /^((?:apps|packages)\/[^/]+)\//;

export function workspaceOf(file: string): string | null {
  const m = WORKSPACE_RE.exec(file);
  return m ? m[1] : null;
}

export function isTestFile(file: string): boolean {
  const ws = workspaceOf(file);
  const rel = ws ? file.slice(ws.length + 1) : file;
  return TEST_PATTERNS.some((re) => re.test(rel));
}

export function listTracked(): string[] {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n')
    .filter(Boolean)
    .filter((f) => /\.(ts|tsx|js|mjs)$/.test(f))
    .filter((f) => !f.startsWith('docs/'))
    .filter((f) => !/\/coverage\/|e2e-coverage\//.test(f))
    .filter((f) => {
      const ws = workspaceOf(f);
      return !ws || !(ws in EXCLUDED_WORKSPACES);
    });
}

const TESTONLY = 'testonly';
const ENTRYPOINT = 'entrypoint';

/**
 * `@<tag> <reason>` parsing, shared by `@testonly` and `@entrypoint` so the
 * two escape hatches get identical mandatory-reason enforcement from one
 * regex pair instead of two hand-duplicated copies.
 *
 * Anchored to a docblock line start (optionally after a JSDoc `*` prefix)
 * with a trailing word boundary on the tag name, so `@testonlyish` and a
 * prose mention mid-sentence (e.g. "derived from the old @testonly
 * annotations") don't satisfy it. The reason capture stops at end-of-line —
 * it can't span multiple lines or read past the docblock it was given.
 */
function tagReason(docblock: string, tag: string): string | null {
  const re = new RegExp(String.raw`^[ \t]*\*?[ \t]*@${tag}\b[ \t]+(\S[^\n*]*)`, 'im');
  const m = re.exec(docblock);
  return m ? m[1].trim() : null;
}

function tagPresent(docblock: string, tag: string): boolean {
  return new RegExp(String.raw`^[ \t]*\*?[ \t]*@${tag}\b`, 'im').test(docblock);
}

/** `@testonly <reason>` — returns the reason, or null when absent. */
export function testOnlyReason(docblock: string): string | null {
  return tagReason(docblock, TESTONLY);
}

/** `@entrypoint <reason>` — returns the reason, or null when absent. */
export function entrypointReason(docblock: string): string | null {
  return tagReason(docblock, ENTRYPOINT);
}

/** True when `@testonly` or `@entrypoint` is present but carries no reason. */
export function hasBareTag(docblock: string): boolean {
  return [TESTONLY, ENTRYPOINT].some(
    (tag) => tagPresent(docblock, tag) && tagReason(docblock, tag) === null,
  );
}

/** The `/** … *\/` block immediately above `declIndex`, or ''. */
export function docblockAbove(lines: string[], declIndex: number): string {
  const out: string[] = [];
  let i = declIndex;
  while (i > 0) {
    const prev = lines[i - 1].trim();
    if (!prev.startsWith('*') && !prev.startsWith('/**')) break;
    out.unshift(lines[i - 1]);
    i--;
    if (prev.startsWith('/**')) break;
  }
  return out.join('\n');
}

/** The leading docblock of a file, or ''. */
export function leadingDocblock(text: string): string {
  const m = /^\s*(?:#![^\n]*\n)?\s*\/\*\*[\s\S]*?\*\//.exec(text);
  return m ? m[0] : '';
}

/**
 * Extracts raw import specifiers from a file's text: `from '<spec>'` (covers
 * `import ... from`, `export ... from`, `import type`/`export type`, since
 * matching only requires the trailing `from '<spec>'`, not what precedes
 * it), bare `import '<spec>'`, and dynamic `import('<spec>')`. This is a
 * text scan, not a syntax-aware parse — it can pick up a stray match inside
 * a comment, but that only ever widens the conservative fallback in
 * `buildReferenceMap`, never narrows real usage.
 */
const FROM_RE = /\bfrom\s+(['"`])((?:(?!\1)[\s\S])*)\1/g;
const BARE_IMPORT_RE = /\bimport\s+(['"`])((?:(?!\1)[\s\S])*)\1/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*(['"`])((?:(?!\1)[\s\S])*)\1/g;

export function extractSpecifiers(text: string): string[] {
  const specs: string[] = [];
  for (const re of [FROM_RE, BARE_IMPORT_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      specs.push(m[2]);
    }
  }
  return specs;
}

function isRelativeSpecifier(spec: string): boolean {
  return spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../');
}

/** Last path segment of a specifier or repo-relative path, extension stripped. */
const SPEC_EXT_RE = /\.(?:tsx?|jsx?|mjs)$/;
export function specifierBasename(spec: string): string {
  const seg = spec.split('/').pop() ?? spec;
  return seg.replace(SPEC_EXT_RE, '');
}

/**
 * Resolves a relative specifier (`./`, `../`, or bare `.`/`..`) against the
 * importer's directory to a repo-relative path present in `tracked`, trying
 * in order: the literal path; `+.ts`; `+.tsx`; `/index.ts`; `/index.tsx`. A
 * `.js`/`.jsx` specifier resolves against its `.ts`/`.tsx` sibling first —
 * this repo's ESM-style imports reference the compiled extension, not the
 * source one, so the literal `.js` path is never itself the right target.
 * Returns null when nothing in `tracked` matches; the caller then falls back
 * to conservative basename matching for that specifier.
 */
export function resolveRelativeSpecifier(
  spec: string,
  importer: string,
  tracked: ReadonlySet<string>,
): string | null {
  const dir = posixPath.dirname(importer);
  let base = posixPath.normalize(posixPath.join(dir, spec));
  if (base.endsWith('.js')) base = `${base.slice(0, -3)}.ts`;
  else if (base.endsWith('.jsx')) base = `${base.slice(0, -4)}.tsx`;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  for (const c of candidates) {
    if (tracked.has(c)) return c;
  }
  return null;
}

/**
 * Groups every tracked file by its stripped basename — the conservative
 * fallback target set for a specifier that real relative resolution can't
 * place (a bare package name, an alias, a template literal, a relative path
 * with no matching file, anything exotic). Precomputed once so the fallback
 * lookup is an O(1) map hit instead of an O(tracked) scan per specifier.
 */
function groupByBasename(tracked: readonly string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const f of tracked) {
    const b = specifierBasename(f);
    const arr = map.get(b);
    if (arr) arr.push(f);
    else map.set(b, [f]);
  }
  return map;
}

/**
 * Builds, for a cohort of importer files (production or test), a map from
 * each referenced repo-relative path to the set of importers referencing
 * it. A relative specifier resolves to a real file when possible; anything
 * that doesn't resolve falls back to every tracked file sharing its
 * basename — same conservative direction as a whole-basename scan, but now
 * scoped only to specifiers that actually failed real resolution, instead
 * of applied to every candidate unconditionally regardless of what actually
 * imports it.
 */
function buildReferenceMap(
  importers: readonly string[],
  tracked: ReadonlySet<string>,
  basenameGroups: Map<string, string[]>,
  texts: Map<string, string>,
): Map<string, Set<string>> {
  const refs = new Map<string, Set<string>>();
  const record = (target: string, importer: string): void => {
    if (target === importer) return; // ignore self-references
    let set = refs.get(target);
    if (!set) {
      set = new Set();
      refs.set(target, set);
    }
    set.add(importer);
  };
  for (const importer of importers) {
    const text = texts.get(importer) ?? '';
    for (const spec of extractSpecifiers(text)) {
      if (isRelativeSpecifier(spec)) {
        const resolved = resolveRelativeSpecifier(spec, importer, tracked);
        if (resolved) {
          record(resolved, importer);
          continue;
        }
      }
      for (const target of basenameGroups.get(specifierBasename(spec)) ?? []) {
        record(target, importer);
      }
    }
  }
  return refs;
}

export function findOrphanModules(
  prod: string[],
  tests: string[],
  texts: Map<string, string>,
): { violations: Violation[]; testOnlyExempt: string[]; entrypointExempt: string[] } {
  const violations: Violation[] = [];
  const testOnlyExempt: string[] = [];
  const entrypointExempt: string[] = [];
  const tracked = new Set<string>([...prod, ...tests]);
  const basenameGroups = groupByBasename([...tracked]);
  const prodRefs = buildReferenceMap(prod, tracked, basenameGroups, texts);
  const testRefsMap = buildReferenceMap(tests, tracked, basenameGroups, texts);
  for (const file of prod) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const base = basename(file).replace(/\.(tsx?|jsx?)$/, '');
    if (base === 'index') continue;
    if (prodRefs.has(file)) continue;
    const testRefs = testRefsMap.get(file)?.size ?? 0;
    if (testRefs === 0) continue; // zero importers at all is knip's job, not ours
    const doc = leadingDocblock(texts.get(file) ?? '');
    if (hasBareTag(doc)) {
      violations.push({ kind: 'file', file, testRefs });
      continue;
    }
    const eReason = entrypointReason(doc);
    const tReason = testOnlyReason(doc);
    if (eReason) entrypointExempt.push(file);
    else if (tReason) testOnlyExempt.push(file);
    else violations.push({ kind: 'file', file, testRefs });
  }
  return { violations, testOnlyExempt, entrypointExempt };
}

function main(): void {
  const all = listTracked();
  const texts = new Map<string, string>();
  for (const f of all) {
    try {
      texts.set(f, readFileSync(f, 'utf8'));
    } catch {
      /* unreadable file — skip */
    }
  }
  const tests = all.filter(isTestFile);
  const prod = all.filter((f) => !isTestFile(f));

  const { violations, testOnlyExempt, entrypointExempt } = findOrphanModules(prod, tests, texts);

  for (const v of violations) {
    console.error(`✗ ${v.file} — imported by ${v.testRefs} test file(s), 0 production files`);
    console.error(
      '    → delete it, or add `@testonly <why>` or `@entrypoint <why>` to the file docblock',
    );
  }
  if (testOnlyExempt.length) {
    console.log(`ℹ ${testOnlyExempt.length} test-only exempt: ${testOnlyExempt.join(', ')}`);
  }
  if (entrypointExempt.length) {
    console.log(`ℹ ${entrypointExempt.length} entrypoint exempt: ${entrypointExempt.join(', ')}`);
  }
  console.log(`  scanned ${prod.length} production / ${tests.length} test files`);
  if (violations.length) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
