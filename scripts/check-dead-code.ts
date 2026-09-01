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
 * Escape hatch: `@testonly <reason>` — the reason is mandatory.
 * Spec: docs/superpowers/specs/2026-09-01-dead-code-guardrails-design.md
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

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

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `@testonly <reason>` — returns the reason, or null when absent. */
export function testOnlyReason(docblock: string): string | null {
  const m = /@testonly[ \t]+(\S[^\n*]*)/i.exec(docblock);
  return m ? m[1].trim() : null;
}

/** True when `@testonly` is present but carries no reason. */
export function hasBareTag(docblock: string): boolean {
  return /@testonly/i.test(docblock) && testOnlyReason(docblock) === null;
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

export function findOrphanModules(
  prod: string[],
  tests: string[],
  texts: Map<string, string>,
): { violations: Violation[]; exempt: string[] } {
  const violations: Violation[] = [];
  const exempt: string[] = [];
  for (const file of prod) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const base = basename(file).replace(/\.(tsx?|jsx?)$/, '');
    if (base === 'index') continue;
    const re = new RegExp(`['"\`][^'"\`]*/${escapeRe(base)}(\\.js|\\.ts|\\.tsx)?['"\`]`);
    if (prod.some((f) => f !== file && re.test(texts.get(f) ?? ''))) continue;
    const testRefs = tests.filter((f) => re.test(texts.get(f) ?? '')).length;
    if (testRefs === 0) continue; // zero importers at all is knip's job, not ours
    const doc = leadingDocblock(texts.get(file) ?? '');
    if (hasBareTag(doc)) {
      violations.push({ kind: 'file', file, testRefs });
      continue;
    }
    if (testOnlyReason(doc)) exempt.push(file);
    else violations.push({ kind: 'file', file, testRefs });
  }
  return { violations, exempt };
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

  const { violations, exempt } = findOrphanModules(prod, tests, texts);

  for (const v of violations) {
    console.error(`✗ ${v.file} — imported by ${v.testRefs} test file(s), 0 production files`);
    console.error('    → delete it, or add `@testonly <why>` to the file docblock');
  }
  console.log(`ℹ ${exempt.length} exempted${exempt.length ? `: ${exempt.join(', ')}` : ''}`);
  console.log(`  scanned ${prod.length} production / ${tests.length} test files`);
  if (violations.length) process.exit(1);
}

main();
