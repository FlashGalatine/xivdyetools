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
 *
 * **Text invariant: candidates come from MASKED text; references and
 * exemption tags come from RAW text.** Every declaration scan that decides
 * what *is* a candidate — `EXPORT_DECL`, `CLASS_DECL`, `MEMBER_DECL`,
 * `TYPE_BLOCK_RE`, `TOP_LEVEL_RESYNC_RE` — runs on `maskSource` output (via
 * `declarationLines`, which falls back to raw for the handful of files whose
 * mask desynced — see there), so a commented-out `export class Old {}` or a
 * member-shaped line inside a template literal can never invent a symbol that
 * does not exist (a false positive, this checker's worst direction, and the
 * one masking exists to prevent). Every scan that decides whether
 * a candidate is *reached* — import specifiers in `buildReferenceMap`, the
 * `\bname\b` export search, the `dotted`/`bracketed` member patterns — stays
 * on raw text: a mention inside a comment then counts as a reference, which
 * under-reports (the safe direction), whereas masking that corpus would let
 * one masker desync swallow a real call site and manufacture a false
 * positive. Exemption tags live in doc comments, so `docblockAbove` and every
 * tag lookup read raw lines by necessity. The two views stay interchangeable
 * by index because `maskSource` only ever replaces non-code characters with
 * spaces — never inserting, deleting, or moving a line or column.
 *
 * @entrypoint No importer — the root `dead-code:check` script runs this directly, and tests reach it via `test:scripts`.
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
const PUBLIC = 'public';

/** A line that opens a new `@tag`, used to know where a reason's continuation must stop. */
const ANY_TAG_START_RE = /^[ \t]*(?:\/\*\*|\*)?[ \t]*@[A-Za-z]\w*\b/i;

/**
 * Strips one docblock line down to its bare reason content: a leading `*`
 * doc-marker (if present) is removed, and — if this line carries the block's
 * closing `*\/` — everything from the `*\/` onward is cut first, before the
 * marker strip and trim, and `closed` comes back true. Doing the `*\/` cut
 * before the marker strip (rather than relying on a character-class
 * exclusion) is what keeps a bare `/** @tag *\/` from ever reading the
 * closing delimiter back as if it were reason text.
 */
function stripDocLine(line: string): { content: string; closed: boolean } {
  let s = line;
  let closed = false;
  const closeIdx = s.indexOf('*/');
  if (closeIdx !== -1) {
    s = s.slice(0, closeIdx);
    closed = true;
  }
  s = s.replace(/^[ \t]*\*[ \t]?/, '');
  return { content: s.trim(), closed };
}

/**
 * `@<tag> <reason>` parsing, shared by `@testonly` and `@entrypoint` so the
 * two escape hatches get identical mandatory-reason enforcement from one
 * function instead of two hand-duplicated copies.
 *
 * The tag itself is found on a docblock line start — either a JSDoc
 * continuation (`*`) or, for a single-line `/** @tag reason *\/` docblock,
 * the opening `/**` itself — with a trailing word boundary on the tag name,
 * so `@testonlyish` and a prose mention mid-sentence (e.g. "derived from the
 * old @testonly annotations") don't satisfy it.
 *
 * The reason is not limited to that same line: it continues across
 * `*`-continuation lines, joined with a single space, until the docblock
 * closes or another `@tag` begins — so a reason wrapped onto a second line,
 * or written entirely on the line after a bare `@tag`, is captured in full
 * rather than truncated or missed. `stripDocLine` strips the closing `*\/`
 * before any content is read, so a bare single-line docblock can never have
 * `*\/` misread as reason text. A tag with no reason text on any of its
 * lines — before the block closes or the next tag starts — stays bare
 * (returns null), same as before.
 */
function tagReason(docblock: string, tag: string): string | null {
  const lines = docblock.split('\n');
  const startRe = new RegExp(String.raw`^[ \t]*(?:\/\*\*|\*)?[ \t]*@${tag}\b(.*)$`, 'i');

  let startLine = -1;
  let afterTag = '';
  for (let i = 0; i < lines.length; i++) {
    const m = startRe.exec(lines[i]);
    if (m) {
      startLine = i;
      afterTag = m[1];
      break;
    }
  }
  if (startLine === -1) return null;

  const parts: string[] = [];
  const first = stripDocLine(afterTag);
  if (first.content !== '') parts.push(first.content);

  if (!first.closed) {
    for (let i = startLine + 1; i < lines.length; i++) {
      if (ANY_TAG_START_RE.test(lines[i])) break;
      const { content, closed } = stripDocLine(lines[i]);
      if (content !== '') parts.push(content);
      if (closed) break;
    }
  }

  return parts.length ? parts.join(' ').trim() : null;
}

function tagPresent(docblock: string, tag: string): boolean {
  return new RegExp(String.raw`^[ \t]*(?:\/\*\*|\*)?[ \t]*@${tag}\b`, 'im').test(docblock);
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

/**
 * `@public` — a third exemption category, deliberately asymmetric with
 * `@testonly`/`@entrypoint`: it takes no mandatory reason. This repo already
 * has 173 bare `/** @public *\/` tags across 5 barrel files (documented at
 * `packages/bot-logic/src/index.ts:15` as "published API, deliberately kept
 * without an in-repo consumer") and `knip.jsonc:41`'s `"tags": ["-public"]`
 * — the tag itself is the assertion, so presence alone is enough. This is
 * intentionally excluded from `hasBareTag`'s tag list above: a bare
 * `@public` must never fail the gate the way a bare `@testonly`/`@entrypoint`
 * does, since it was never supposed to carry a reason in the first place.
 */
export function isPublic(docblock: string): boolean {
  return tagPresent(docblock, PUBLIC);
}

/** A decorator line applied to the next declaration: `@Identifier` or `@Identifier(...)`. */
const DECORATOR_LINE_RE = /^@[A-Za-z_$][\w$]*/;

/** Net `(` minus `)` count in a line — a plain character count, not a parser. */
function parenDelta(line: string): number {
  let d = 0;
  for (const ch of line) {
    if (ch === '(') d++;
    else if (ch === ')') d--;
  }
  return d;
}

/**
 * True when every line before `openIndex` is blank, or — line 0 only — a
 * shebang. This restates, over an already-split `lines` array, the same rule
 * `leadingDocblock`'s regex applies from the start of the raw file text, so
 * `docblockAbove` can check "is this the file's leading docblock" without
 * re-joining and re-scanning the file.
 */
function isLeadingDocblockStart(lines: string[], openIndex: number): boolean {
  for (let k = 0; k < openIndex; k++) {
    const t = lines[k].trim();
    if (t === '') continue;
    if (k === 0 && t.startsWith('#!')) continue;
    return false;
  }
  return true;
}

/**
 * The `/** … *\/` block attached to `declIndex`, or ''.
 *
 * Walking upward, blank lines and decorator lines (`@Foo`, `@Foo(...)`) are
 * skipped rather than treated as a wall: a blank line for readability, or a
 * Lit `@customElement(...)`/`@property()` between a docblock and its
 * declaration, must not hide a real tag. A decorator whose own argument list
 * spans multiple raw lines — `@customElement(\n  'my-element'\n)` — is
 * skipped as a unit too: a wall line with more `)` than `(` is treated as a
 * candidate call tail, and the walk sums `parenDelta` further upward until
 * the balance returns to zero; if the line that balances it is itself a
 * decorator start, the whole span is the argument list and the walk resumes
 * from there, otherwise the balance-probe changes nothing and the original
 * line is still a genuine wall. Once a candidate docblock is found, though,
 * it is refused — the walk returns '' — when it is the file's own leading
 * docblock (nothing but whitespace or a shebang precedes its opening `/**`).
 * Without that check, skipping blank lines would let a file-header comment
 * silently attach to whichever export happens to sit first, exempting it by
 * accident. A genuine file-level tag is already handled by `leadingDocblock`
 * at file granularity, and the file-subsumes-symbol rule in `main` means an
 * exempt file never needs symbol-level attribution anyway, so refusing to
 * reuse the header here costs nothing.
 */
export function docblockAbove(lines: string[], declIndex: number): string {
  let i = declIndex;
  while (i > 0) {
    const prev = lines[i - 1].trim();
    if (prev === '' || DECORATOR_LINE_RE.test(prev)) {
      i--;
      continue;
    }
    if (parenDelta(prev) < 0) {
      let depth = parenDelta(prev);
      let k = i - 1;
      while (depth < 0 && k > 0) {
        k--;
        depth += parenDelta(lines[k]);
      }
      if (depth === 0 && DECORATOR_LINE_RE.test(lines[k].trim())) {
        i = k;
        continue;
      }
    }
    break;
  }
  const out: string[] = [];
  let j = i;
  while (j > 0) {
    const prev = lines[j - 1].trim();
    if (!prev.startsWith('*') && !prev.startsWith('/**')) break;
    out.unshift(lines[j - 1]);
    j--;
    if (prev.startsWith('/**')) break;
  }
  if (out.length === 0) return '';
  if (isLeadingDocblockStart(lines, j)) return '';
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
 * `check-dead-code.ts` imports nothing from any workspace package or app, so
 * every textual match inside it is prose or a string literal, never a real
 * reference — and the same holds for its test file, whose fixture strings
 * are synthetic source that never runs as code. Both are excluded from the
 * REFERRER side of every reference computation below (they remain
 * *subjects* — still checked for their own dead-code status, still
 * classified prod/test exactly as before) so a doc comment or fixture that
 * happens to name a real symbol can never again mask a finding by counting
 * as production or test usage of it — the exact bug that reopened itself in
 * each of the two prior fix rounds. Named by path relative to the repo
 * root, not by basename, and deliberately not generalised to "a file with
 * no workspace imports is never a referrer": a Lit web component is
 * legitimately referenced by tag name from another component's template,
 * and its members reached through a `querySelector(...)` cast, with no
 * import at all — a general rule here would manufacture false positives.
 */
const EXCLUDED_REFERRERS = new Set<string>([
  'scripts/check-dead-code.ts',
  'scripts/check-dead-code.test.ts',
]);

/** True when `file` must never count as a referrer — see `EXCLUDED_REFERRERS`. */
export function isExcludedReferrer(file: string): boolean {
  return EXCLUDED_REFERRERS.has(file);
}

/** `files`, minus anything `isExcludedReferrer` rejects — the referrer-eligible subset. */
const asReferrers = (files: readonly string[]): string[] =>
  files.filter((f) => !isExcludedReferrer(f));

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
): {
  violations: Violation[];
  testOnlyExempt: string[];
  entrypointExempt: string[];
  publicExempt: string[];
} {
  const violations: Violation[] = [];
  const testOnlyExempt: string[] = [];
  const entrypointExempt: string[] = [];
  const publicExempt: string[] = [];
  const tracked = new Set<string>([...prod, ...tests]);
  const basenameGroups = groupByBasename([...tracked]);
  const prodRefs = buildReferenceMap(asReferrers(prod), tracked, basenameGroups, texts);
  const testRefsMap = buildReferenceMap(asReferrers(tests), tracked, basenameGroups, texts);
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
    if (isPublic(doc)) {
      publicExempt.push(file);
      continue;
    }
    const eReason = entrypointReason(doc);
    const tReason = testOnlyReason(doc);
    if (eReason) entrypointExempt.push(file);
    else if (tReason) testOnlyExempt.push(file);
    else violations.push({ kind: 'file', file, testRefs });
  }
  return { violations, testOnlyExempt, entrypointExempt, publicExempt };
}

const EXPORT_DECL = /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_]\w*)/;

/** Escapes regex metacharacters so an identifier can be dropped into a `\b...\b` pattern. */
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The file portion of a `${file}:${name}` exempt-array entry (the LAST colon
 * splits them, since a qualified member name can itself contain one — e.g. a
 * `file.ts:` prefix followed by BaseLogger's own `timeAsync`, dot-joined).
 */
const fileOf = (entry: string): string => entry.slice(0, entry.lastIndexOf(':'));

/** The name portion of a `${file}:${name}` exempt-array entry — see `fileOf`. */
const nameOf = (entry: string): string => entry.slice(entry.lastIndexOf(':') + 1);

/**
 * Exported-symbol granularity: a module-level `function`/`const`/`let`/`class`
 * export that only test files reference by name. This is the gap file-level
 * reachability can't see — the test import already makes the *file* reachable,
 * so `findOrphanModules` sees nothing wrong; only checking the individual
 * symbol's own references catches a dead export living inside a used file.
 *
 * *Reference* matching is a word-boundary identifier regex against raw file
 * text, not a syntax-aware parse (candidacy, by contrast, comes from
 * `EXPORT_DECL` on masked text) — a symbol named after a common word (`render`,
 * `logger`) will find an unrelated textual hit elsewhere and be judged
 * referenced. That under-reports, the same conservative direction the
 * file-level fallback already takes, and is accepted rather than tightened.
 *
 * `EXPORT_DECL` matches per line, so an overloaded signature (several
 * `export function foo(...)` lines for one name) produces several matching
 * lines for the same symbol. Those are grouped by name before any verdict is
 * computed: the "is this used in production" scan excludes every one of the
 * symbol's own declaration lines — not just whichever line is currently being
 * looked at, which would otherwise let sibling overload lines count as each
 * other's "usage" — and a valid tag on any one signature exempts the whole
 * symbol. One verdict per exported name per file, never a duplicate.
 */
export function findTestOnlyExports(
  prod: string[],
  tests: string[],
  texts: Map<string, string>,
): {
  violations: Violation[];
  testOnlyExempt: string[];
  entrypointExempt: string[];
  publicExempt: string[];
} {
  const violations: Violation[] = [];
  const testOnlyExempt: string[] = [];
  const entrypointExempt: string[] = [];
  const publicExempt: string[] = [];
  const prodReferrers = asReferrers(prod);
  const testReferrers = asReferrers(tests);
  for (const file of prod) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const text = texts.get(file) ?? '';
    const lines = text.split('\n');
    // Candidacy is decided on MASKED text (the file docblock's invariant): a
    // column-0 `export function ghost() {}` on the middle line of a block
    // comment is not a declaration. Masking is line-preserving, so an index
    // found here indexes raw `lines` unchanged for the docblock lookup below,
    // and `declLines` still excludes the right lines from the raw reference
    // scan.
    const candidateLines = declarationLines(text);

    const byName = new Map<string, number[]>();
    candidateLines.forEach((line, i) => {
      const m = EXPORT_DECL.exec(line);
      if (!m) return;
      const name = m[1];
      const arr = byName.get(name);
      if (arr) arr.push(i);
      else byName.set(name, [i]);
    });

    for (const [name, indices] of byName) {
      const word = new RegExp(`\\b${escapeRe(name)}\\b`);
      const declLines = new Set(indices);
      // Any non-test reference outside this symbol's own declaration lines
      // counts as production use.
      const usedInProd = prodReferrers.some((f) => {
        const t = texts.get(f) ?? '';
        if (f !== file) return word.test(t);
        return t.split('\n').some((l, j) => !declLines.has(j) && word.test(l));
      });
      if (usedInProd) continue;
      const testRefs = testReferrers.filter((f) => word.test(texts.get(f) ?? '')).length;
      if (testRefs === 0) continue; // knip's job

      // Each signature line may carry its own docblock; a bare tag on any one
      // of them still fails the gate (same precedence as a single-signature
      // export), otherwise a valid reason — or a bare `@public`, which needs
      // none — on any one of them exempts the whole symbol.
      let anyBare = false;
      let anyPublic = false;
      let eReason: string | null = null;
      let tReason: string | null = null;
      for (const i of indices) {
        const doc = docblockAbove(lines, i);
        if (hasBareTag(doc)) anyBare = true;
        if (isPublic(doc)) anyPublic = true;
        if (!eReason) eReason = entrypointReason(doc);
        if (!tReason) tReason = testOnlyReason(doc);
      }
      if (anyBare) violations.push({ kind: 'export', file, name, testRefs });
      else if (anyPublic) publicExempt.push(`${file}:${name}`);
      else if (eReason) entrypointExempt.push(`${file}:${name}`);
      else if (tReason) testOnlyExempt.push(`${file}:${name}`);
      else violations.push({ kind: 'export', file, name, testRefs });
    }
  }
  return { violations, testOnlyExempt, entrypointExempt, publicExempt };
}

const CLASS_DECL = /^export\s+(?:abstract\s+)?class\s+([A-Za-z_]\w*)/;
const MEMBER_DECL =
  /^ {2,}(?:public\s+|static\s+|async\s+|get\s+|set\s+)*([A-Za-z_]\w*)\s*(?:<[^>]*>)?\(/;
const MEMBER_SKIP = new Set([
  'constructor',
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'super',
]);

/**
 * A `class`/`interface` declaration that opens a new declaring-type block —
 * `export` optional (a non-exported companion class in the same file, e.g.
 * `DelegatingLogger` alongside the exported `BaseLogger`, still needs its own
 * block so its members are never attributed to the exported class), `default`
 * and `abstract` both optional, either keyword accepted since an interface's
 * method *signatures* are just as capable of colliding by name with an
 * unrelated class's method as another class's methods are.
 */
const TYPE_BLOCK_RE =
  /^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(?:class|interface)\s+([A-Za-z_]\w*)/;

/**
 * A top-level declaration keyword or decorator sitting at column 0 — no
 * leading whitespace at all. In this prettier-formatted repo, every real
 * class, interface, function, or variable declaration at module scope is
 * printed flush left; anything indented is nested inside something else.
 * Used only by `attributeLinesToBlocks` to detect and bound a brace-tracking
 * desync — never to attribute a member or infer module structure on its own.
 */
const TOP_LEVEL_RESYNC_RE =
  /^(?:class\b|interface\b|export\b|function\b|const\b|let\b|var\b|type\b|enum\b|import\b|@[A-Za-z_$])/;

/**
 * Blanks out comments, string literals, and template literals in `text` —
 * replacing every character inside them with a space, except newlines
 * (always left untouched, so line numbers and column positions never shift)
 * — so a downstream brace count only ever sees a real code brace, and a
 * downstream *declaration* scan only ever sees a real declaration, never one
 * hiding inside a comment (`// see }`, `// export class Old {}`), a string
 * (`'{'`), or a Lit `html`…`` / `css`…`` template. Every caller that decides
 * candidacy reaches this output through `declarationLines`; see the file
 * docblock's invariant for which scans deliberately do not.
 * A hand-written character scanner with a
 * small state stack, not a parser or a full-language tokenizer: the only
 * structure it tracks is which of these spans — line comment, block comment,
 * `'...'`, `"..."`, `` `...` ``, or a template's `${…}` — the scanner is
 * currently inside, nested as deep as the source actually nests them (a
 * template's `${…}` can itself contain a string, a nested template, or a
 * comment, and this repo's Lit `html`…`` templates do exactly that: see the
 * dedicated test for `` html`<div>${x ? '{' : ''}</div>` `` ).
 *
 * A template literal is masked in full, `${…}` included — nothing inside a
 * template can be a real class/interface boundary, so there is no reason to
 * leave its interpolated expression's own braces unmasked. The scanner only
 * needs enough `${…}` awareness to find the matching `}` that ends it (so a
 * nested object literal like `${fn({x: 1})}` does not close the
 * interpolation early) and to keep recognizing nested strings/templates/
 * comments inside it (so a stray backtick or brace inside THOSE does not end
 * the interpolation, or the outer template, early either).
 *
 * Regex literals are deliberately not masked — telling a regex `/` from a
 * division `/` requires knowing the preceding token, which this scanner does
 * not attempt (a parser's job). A `{` inside one (`/\{/`) can still desync a
 * brace walk built on this mask; `attributeLinesToBlocks`'s column-0 resync
 * is what bounds that residual gap, not this function. A *quote or backtick*
 * inside one is the worse case — `` /`([^`]+)`/g `` opens a span that runs
 * past the end of the line — which is what `scanSource`'s `clean` flag exists
 * to detect; see `declarationLines`.
 */
export function maskSource(text: string): string {
  return scanSource(text).masked;
}

/**
 * `maskSource`'s scanner, plus whether it ended where well-formed source must:
 * back at the top-level `code` frame, with every comment, string, and template
 * it opened also closed. `clean === false` means the mask is not trustworthy
 * for this file — in practice a quote or backtick inside an unmasked regex
 * literal opened a span that swallowed real code after it.
 */
function scanSource(text: string): { masked: string; clean: boolean } {
  const chars = [...text];
  const n = chars.length;

  type Frame =
    | { kind: 'code' }
    | { kind: 'templateExpr'; depth: number }
    | { kind: 'template' }
    | { kind: 'lineComment' }
    | { kind: 'blockComment' }
    | { kind: 'singleQuote' }
    | { kind: 'doubleQuote' };

  const stack: Frame[] = [{ kind: 'code' }];
  const blank = (idx: number): void => {
    if (chars[idx] !== '\n') chars[idx] = ' ';
  };

  let i = 0;
  while (i < n) {
    const top = stack[stack.length - 1];
    const ch = chars[i];

    if (top.kind === 'lineComment') {
      if (ch === '\n') {
        stack.pop();
      } else {
        blank(i);
      }
      i += 1;
      continue;
    }

    if (top.kind === 'blockComment') {
      if (ch === '*' && chars[i + 1] === '/') {
        blank(i);
        blank(i + 1);
        stack.pop();
        i += 2;
      } else {
        blank(i);
        i += 1;
      }
      continue;
    }

    if (top.kind === 'singleQuote' || top.kind === 'doubleQuote') {
      const quote = top.kind === 'singleQuote' ? "'" : '"';
      if (ch === '\n') {
        // An unescaped newline can't appear in a real string literal --
        // bail out defensively rather than let one malformed file cascade
        // the mask across the rest of it.
        stack.pop();
        i += 1;
      } else if (ch === '\\' && i + 1 < n) {
        blank(i);
        blank(i + 1);
        i += 2;
      } else if (ch === quote) {
        blank(i);
        stack.pop();
        i += 1;
      } else {
        blank(i);
        i += 1;
      }
      continue;
    }

    if (top.kind === 'template') {
      if (ch === '\\' && i + 1 < n) {
        blank(i);
        blank(i + 1);
        i += 2;
      } else if (ch === '`') {
        blank(i);
        stack.pop();
        i += 1;
      } else if (ch === '$' && chars[i + 1] === '{') {
        blank(i);
        blank(i + 1);
        stack.push({ kind: 'templateExpr', depth: 1 });
        i += 2;
      } else {
        blank(i);
        i += 1;
      }
      continue;
    }

    // 'code' (true top level) and 'templateExpr' (inside a template's
    // `${…}`) share the same recognition of comments/strings/templates;
    // templateExpr additionally masks every character it sees directly (the
    // whole template is masked, `${…}` included) and tracks its own brace
    // depth to know when its `${` is closed by the matching `}`. 'code'
    // leaves a bare `{`/`}` untouched -- those are real code braces a
    // downstream brace count must still see.
    const inExpr = top.kind === 'templateExpr';
    if (ch === '/' && chars[i + 1] === '/') {
      if (inExpr) {
        blank(i);
        blank(i + 1);
      }
      stack.push({ kind: 'lineComment' });
      i += 2;
    } else if (ch === '/' && chars[i + 1] === '*') {
      if (inExpr) {
        blank(i);
        blank(i + 1);
      }
      stack.push({ kind: 'blockComment' });
      i += 2;
    } else if (ch === "'") {
      if (inExpr) blank(i);
      stack.push({ kind: 'singleQuote' });
      i += 1;
    } else if (ch === '"') {
      if (inExpr) blank(i);
      stack.push({ kind: 'doubleQuote' });
      i += 1;
    } else if (ch === '`') {
      if (inExpr) blank(i);
      stack.push({ kind: 'template' });
      i += 1;
    } else if (inExpr && ch === '{') {
      (top as { kind: 'templateExpr'; depth: number }).depth += 1;
      blank(i);
      i += 1;
    } else if (inExpr && ch === '}') {
      const frame = top as { kind: 'templateExpr'; depth: number };
      blank(i);
      frame.depth -= 1;
      i += 1;
      if (frame.depth === 0) stack.pop();
    } else {
      if (inExpr) blank(i);
      i += 1;
    }
  }

  // The base `code` frame is never popped, so a scan that consumed every span
  // it opened ends with exactly it on the stack.
  return { masked: chars.join(''), clean: stack.length === 1 };
}

/**
 * The lines every DECLARATION scan runs over (the file docblock's invariant):
 * masked, so a commented-out `export class Old {}` or a member-shaped line
 * inside a template literal is not a candidate — **unless the mask desynced
 * on this file**, in which case the raw lines are used instead.
 *
 * The fallback matters because masking is the only thing standing between a
 * declaration and the candidate list, so a runaway span silently *deletes*
 * real declarations — the opposite error from the one masking prevents, and
 * invisible in the gate's output because a deleted candidate simply never
 * appears. Two real instances exist in this repo, both a backtick inside an
 * unmasked regex literal (`packages/bot-logic/src/discord-markdown.ts`'s
 * `` /([*_~`|>#\\[\]()])/g `` and `apps/web-app/vite-plugin-changelog-parser.ts`'s
 * `` /`([^`]+)`/g ``), each of which blanked every export below it. Falling
 * back to raw restores exactly the pre-masking behavior for such a file —
 * never worse than the checker has always been — while the other ~500 files
 * still get the stricter masked reading.
 *
 * `attributeLinesToBlocks` deliberately does NOT take this fallback: raw
 * braces are precisely what masking fixed for the brace walk, and it carries
 * its own bound for a desync (the column-0 resync).
 */
export function declarationLines(text: string): string[] {
  const { masked, clean } = scanSource(text);
  return (clean ? masked : text).split('\n');
}

/**
 * Attributes every line in `lines` to the name of the innermost class or
 * interface block that textually encloses it, by tracking brace depth — a
 * plain per-character count, not a parser, the same heuristic class
 * `parenDelta` uses for decorator argument lists, extended here to persist
 * across an entire file instead of one line. Returns a parallel array:
 * `blocks[i]` is the enclosing type's name, or `null` for a line outside any
 * tracked block (module scope, or nested inside some other construct
 * entirely — object-literal methods, local functions).
 *
 * Persisting a brace count across a whole file is exactly what makes it
 * fragile — a single stray `{`/`}` anywhere in the file can desync every
 * line after it — so two defenses keep real code that merely *contains* an
 * unbalanced-looking brace from corrupting attribution:
 *
 * a. The whole walk runs over `maskSource(lines.join('\n'))`, not `lines`
 *    directly, so a brace inside a comment, string, or template is never
 *    seen as a real one — and neither is a *declaration* inside one, since
 *    `TOP_LEVEL_RESYNC_RE` and `TYPE_BLOCK_RE` read the same masked text the
 *    braces do. Reading raw text for either regex while the braces read
 *    masked text is incoherent in both directions: a column-0
 *    declaration-shaped line inside a template or block comment would clear
 *    the stack mid-class, and a `class X {` inside a comment would set
 *    `pendingName` off a line whose own `{` had just been blanked, leaving
 *    it to be claimed by the next *real* `{`. Masking is invisible to both
 *    regexes on real code (they match only keywords and identifiers, never
 *    string, comment, or template text). That is one instance of the file
 *    docblock's invariant: every declaration scan reads masked text, while
 *    reference scans and docblock/tag lookups read raw `lines`. Both views
 *    index identically, since masking never shifts a line or column — it only
 *    blanks non-code characters within one.
 * b. If a `class`/`interface`/`export`/`function`/`const`/`let`/`var`/
 *    `type`/`enum`/`import`/decorator line sits at column 0
 *    (`TOP_LEVEL_RESYNC_RE`) while the stack still claims an open block, the
 *    tracker has desynced — most plausibly from a regex literal, the one
 *    thing (a) doesn't mask. Resync by discarding the stack and resetting
 *    depth to 0: a column-0 declaration is by definition not nested in
 *    anything, so this is exactly the state a correctly-synced walk would
 *    be in. This bounds any residual desync to the remainder of one class
 *    body rather than letting it cascade through the rest of the file.
 *
 * A `class`/`interface` line does not open its own block until the first `{`
 * at or after it is reached, so a multi-line header (`class Foo\n extends
 * Bar\n{`) still attributes correctly — it's the brace, not the declaration
 * line itself, that fixes the block's own body depth. A block closes on the
 * `}` that brings depth back down to exactly the level its own opening `{`
 * established; nested braces inside it (method bodies, control flow, object
 * literals) only ever push depth higher before returning to that same level,
 * so they can never close it early.
 */
export function attributeLinesToBlocks(lines: string[]): (string | null)[] {
  const maskedLines = maskSource(lines.join('\n')).split('\n');
  const blocks: (string | null)[] = new Array(lines.length).fill(null);
  const stack: { openDepth: number; name: string }[] = [];
  let depth = 0;
  let pendingName: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    // The MASKED line, for the two regexes below as well as the brace walk:
    // both `TOP_LEVEL_RESYNC_RE` and `TYPE_BLOCK_RE` must agree with the
    // braces about what counts as code, or a declaration-shaped line that
    // is really comment/string/template *content* (an embedded code sample,
    // a column-0 `@media` at-rule in a `css` template) resyncs the stack or
    // sets `pendingName` off text whose own braces were blanked. Masking
    // never alters a real declaration — both regexes match only keywords
    // and identifiers, which the mask leaves untouched in real code.
    const line = maskedLines[i] ?? '';
    if (stack.length > 0 && TOP_LEVEL_RESYNC_RE.test(line)) {
      stack.length = 0;
      depth = 0;
      pendingName = null;
    }
    blocks[i] = stack.length > 0 ? stack[stack.length - 1].name : null;
    if (pendingName === null) {
      const m = TYPE_BLOCK_RE.exec(line);
      if (m) pendingName = m[1];
    }
    for (const ch of line) {
      if (ch === '{') {
        depth += 1;
        if (pendingName !== null) {
          stack.push({ openDepth: depth, name: pendingName });
          pendingName = null;
        }
      } else if (ch === '}') {
        if (stack.length > 0 && depth === stack[stack.length - 1].openDepth) {
          stack.pop();
        }
        depth -= 1;
      }
    }
  }
  return blocks;
}

/**
 * Class-member granularity: a method (or getter/setter) with no reference
 * anywhere in production code, only in tests. This is the gap neither file-
 * nor export-level reachability can see — the class itself is used in
 * production (so the file and the class's own export name both look fine),
 * and knip 6 dropped its `classMembers` rule entirely, so a dead public
 * method is otherwise invisible to every gate that exists.
 *
 * `MEMBER_DECL` is a plain indentation heuristic, not a syntax-aware parse,
 * so scanning is only opened for files that declare at least one *exported*
 * class (`CLASS_DECL`) — without that gate it would also match an
 * object-literal method sitting at the same indentation somewhere unrelated.
 * `MEMBER_SKIP` excludes `constructor` (constructed, never called by name, so
 * "no `.constructor` reference" would always be a false positive) and
 * control-flow keywords that share the same `keyword(` shape at 2+ indent
 * (`if (`, `for (`, `while (`, `switch (`, `catch (`), plus `return`/`super`
 * immediately preceding a parenthesized expression.
 *
 * Once a file is open for scanning, though, `MEMBER_DECL` itself does not
 * care whether a matching line belongs to that exported class, a second
 * *non-exported* class in the same file, or an *interface*'s method
 * signature (which has the identical `name(...)` shape as an implementation,
 * just terminated by `;` instead of `{`) — so declarations are first
 * attributed to their enclosing type via `attributeLinesToBlocks`, and
 * grouped by *(declaring type, name)*, not by name alone. Two unrelated
 * classes' same-named methods — or an interface signature and the class
 * implementing it — are never merged: each gets its own verdict, so a
 * `@testonly`/`@entrypoint`/`@public` tag on one can never silently exempt
 * the other. A declaration `attributeLinesToBlocks` cannot place inside any
 * tracked block (attribution returns `null`) falls back to the pre-fix,
 * file-flat behavior — grouped by name alone across the whole file — rather
 * than being dropped; in this repo today every declaration matched by
 * `MEMBER_DECL` lands inside a tracked block, so that fallback is currently
 * unexercised.
 *
 * Usage is checked as `.name` — a word-boundary match for the
 * property-access form every real call site has to use, whatever the
 * receiver: an external caller, a `this.name()` call from a sibling method
 * in the same class, a `super.name()` call from a subclass, or a call
 * through an interface-typed variable (`(x as IFoo).name()` is still
 * literally `.name` in the source text, regardless of the receiver's static
 * type) — or a literal-string bracket key (`obj['name']`/`obj["name"]`,
 * quotes matched by backreference), so a call reached only that way in
 * production is not misjudged as test-only just because a test happens to
 * call it with plain dot syntax. The scan covers every production file, this
 * member's own file included, so an internal self-call counts as production
 * use exactly like an external one — it does not need the declaration-line
 * exclusion `findTestOnlyExports` uses for its bare-identifier match, because
 * a method declaration (`dismissAll(): void {`) has no leading dot to begin
 * with and so never self-matches its own `.name` pattern.
 *
 * Usage detection is still purely name-based, though — it has no notion of
 * *which* declaring type a call site binds to (nothing does, without real
 * type inference), so BaseLogger's `timeAsync` and DelegatingLogger's own,
 * separate `timeAsync` get the identical `testRefs` count even though the
 * grouping keeps their *verdicts* independent. A fully *computed* bracket
 * key, `obj[key]()` where
 * `key` is a variable, is invisible to both the dotted and the
 * literal-string-bracket pattern. That gap runs the OPPOSITE direction from
 * `findTestOnlyExports`'s accepted identifier-collision trade-off: an
 * identifier collision over-matches, so it under-reports (safe — a missed
 * cleanup, never a false accusation), whereas a member reached only via a
 * computed key in production, with an ordinary `.method()` call from a test,
 * would have zero detected production reference and a positive test-file
 * count — reported as a violation despite being genuinely reachable, a false
 * positive, the expensive failure mode for this whole checker. No concrete
 * instance of this was found among the reported violations (every one was
 * checked by hand for a computed-dispatch shape), and a bracket-notation
 * grep cannot detect it by construction — a computed key's variable name has
 * no textual relationship to the member name being checked. This residual
 * gap is accepted as a real, documented limitation of a text scan rather
 * than a full parser; it is not resolved here.
 *
 * A getter/setter pair (or, in principle, overloaded method signatures)
 * shares one name across several declaration lines within the same declaring
 * type; each may carry its own docblock, so verdicts are grouped exactly
 * like `findTestOnlyExports` groups overloads — a bare `@testonly`/
 * `@entrypoint` on any one line still fails the whole member, a bare
 * `@public` or a valid reason on any one line exempts it, and either way
 * there is exactly one verdict per (declaring type, name) per file, never a
 * duplicate or a contradicting pair.
 *
 * A test file's textual `.name`/bracket match only counts as a real
 * reference when that test file actually *imports* the module declaring the
 * member — reusing the same import-resolution `buildReferenceMap` already
 * provides for file granularity. Without this, an unrelated same-named API
 * elsewhere inflates the count: `base-component.ts`'s `isVisible()` reported
 * "referenced by 7 test file(s)" pre-fix, but 6 of those were Playwright's
 * own, unrelated `isVisible()` method on its `Locator` type, called from
 * `e2e/*.spec.ts` files that never import `base-component.ts` at all.
 * Tightening this can drop a member from the
 * list entirely — if every apparent test reference turns out spurious, the
 * member has zero genuine references and is simply unused, which is knip's
 * job, not this checker's.
 */
export function findTestOnlyMembers(
  prod: string[],
  tests: string[],
  texts: Map<string, string>,
): {
  violations: Violation[];
  testOnlyExempt: string[];
  entrypointExempt: string[];
  publicExempt: string[];
} {
  const violations: Violation[] = [];
  const testOnlyExempt: string[] = [];
  const entrypointExempt: string[] = [];
  const publicExempt: string[] = [];

  const tracked = new Set<string>([...prod, ...tests]);
  const basenameGroups = groupByBasename([...tracked]);
  const testImportersOf = buildReferenceMap(asReferrers(tests), tracked, basenameGroups, texts);
  const prodReferrers = asReferrers(prod);

  for (const file of prod) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const text = texts.get(file) ?? '';
    const lines = text.split('\n');
    // Both scans below decide CANDIDACY, so both read the masked view (the
    // file docblock's invariant). `attributeLinesToBlocks` masks `lines`
    // itself rather than taking this array: `maskSource` is a pure function of
    // the text, so the second pass costs one scan and nothing else, and
    // keeping it internal leaves that function's signature and its tested
    // behavior untouched — it also must NOT take `declarationLines`' raw
    // fallback, whose whole point is candidacy, not brace tracking.
    const candidateLines = declarationLines(text);
    // Only scan files that actually declare an exported class. MEMBER_DECL is an
    // indentation heuristic and would otherwise match object-literal methods —
    // which a commented-out `export class Old {}` would otherwise let in.
    if (!candidateLines.some((l) => CLASS_DECL.test(l))) continue;

    const blockOfLine = attributeLinesToBlocks(lines);
    const importingTests = [...(testImportersOf.get(file) ?? [])];

    const byGroup = new Map<
      string,
      { name: string; declaringType: string | null; indices: number[] }
    >();
    candidateLines.forEach((line, i) => {
      const m = MEMBER_DECL.exec(line);
      if (!m) return;
      const name = m[1];
      if (MEMBER_SKIP.has(name)) return;
      // Masked, so `private` has to be a real modifier: a trailing
      // `// private helper` comment no longer skips a public member.
      if (/\bprivate\b|\bprotected\b/.test(line) || name.startsWith('#')) return;
      const declaringType = blockOfLine[i];
      // A declaration this pass could not attribute to any tracked
      // class/interface block falls back to the pre-fix, file-flat grouping
      // (name alone) rather than being silently dropped.
      const key = declaringType !== null ? `${declaringType} ${name}` : ` ${name}`;
      const entry = byGroup.get(key);
      if (entry) entry.indices.push(i);
      else byGroup.set(key, { name, declaringType, indices: [i] });
    });

    for (const { name, declaringType, indices } of byGroup.values()) {
      // Members are always called on a receiver, so `.name` (property access) is
      // the usual reference form — but `obj['name']`/`obj["name"]` (a literal
      // string key, quotes matched by backreference) is also a real call site a
      // member-only-here scan must not miss.
      const dotted = new RegExp(`\\.${escapeRe(name)}\\b`);
      const bracketed = new RegExp(`\\[\\s*(['"\`])${escapeRe(name)}\\1\\s*\\]`);
      const isReferenced = (text: string): boolean => dotted.test(text) || bracketed.test(text);
      if (prodReferrers.some((f) => isReferenced(texts.get(f) ?? ''))) continue;
      // Only a test file that actually imports THIS file counts — otherwise an
      // unrelated same-named call in a test that never imports the declaring
      // module (e.g. Playwright's own Locator type's isVisible method)
      // inflates the count.
      const testRefs = importingTests.filter((f) => isReferenced(texts.get(f) ?? '')).length;
      if (testRefs === 0) continue; // knip's job

      let anyBare = false;
      let anyPublic = false;
      let eReason: string | null = null;
      let tReason: string | null = null;
      for (const i of indices) {
        const doc = docblockAbove(lines, i);
        if (hasBareTag(doc)) anyBare = true;
        if (isPublic(doc)) anyPublic = true;
        if (!eReason) eReason = entrypointReason(doc);
        if (!tReason) tReason = testOnlyReason(doc);
      }
      // Qualify the reported name with its declaring type when known
      // (BaseLogger's `timeAsync`, not just `timeAsync`) so two same-named
      // members in one file are never indistinguishable in the output.
      const qualifiedName = declaringType ? `${declaringType}.${name}` : name;
      if (anyBare) violations.push({ kind: 'member', file, name: qualifiedName, testRefs });
      else if (anyPublic) publicExempt.push(`${file}:${qualifiedName}`);
      else if (eReason) entrypointExempt.push(`${file}:${qualifiedName}`);
      else if (tReason) testOnlyExempt.push(`${file}:${qualifiedName}`);
      else violations.push({ kind: 'member', file, name: qualifiedName, testRefs });
    }
  }
  return { violations, testOnlyExempt, entrypointExempt, publicExempt };
}

/** The shape `findTestOnlyMembers` (and `subsumeMembersByOwner`) return. */
export type MemberFindings = {
  violations: Violation[];
  testOnlyExempt: string[];
  entrypointExempt: string[];
  publicExempt: string[];
};

/**
 * A symbol-level verdict on an exported *class* subsumes member-level
 * verdicts for that class: tagging or fixing the class handles every member
 * inside it, so re-reporting each member separately from an already-
 * verdicted class is redundant noise. This is the mechanism that stops a
 * class-A tag from leaking onto an unrelated class-B member sharing its
 * name — extracted out of `main()` and exported specifically so that
 * property has a direct test, not just a hand-trace.
 *
 * Precise per member, not per file: `findTestOnlyMembers` gives every
 * attributable member a declaring type (reported as `Type.member`), so this
 * checks each member's OWN declaring type against `symbolVerdictedNames` (a
 * set of `${file}:${name}` strings — every export-level violation plus all
 * three of its exempt categories) rather than a file-wide "does this file
 * have exactly one exported class, and is it verdicted" special case. A
 * member `findTestOnlyMembers` could not attribute to a declaring type (the
 * file-flat fallback, `qualifiedName` with no `.`) is never subsumed this
 * way — `declaringTypeOf` returns `null` for it, and `ownerVerdicted` treats
 * `null` as "no verdict to inherit," same as an ambiguous owner was never
 * subsumed under the file-wide rule this replaced.
 */
export function subsumeMembersByOwner(
  memberFindings: MemberFindings,
  symbolVerdictedNames: ReadonlySet<string>,
): MemberFindings {
  const declaringTypeOf = (qualifiedName: string): string | null => {
    const dot = qualifiedName.indexOf('.');
    return dot === -1 ? null : qualifiedName.slice(0, dot);
  };
  const ownerVerdicted = (file: string, qualifiedName: string): boolean => {
    const declaringType = declaringTypeOf(qualifiedName);
    return declaringType !== null && symbolVerdictedNames.has(`${file}:${declaringType}`);
  };
  return {
    violations: memberFindings.violations.filter(
      (v) => !(v.name && ownerVerdicted(v.file, v.name)),
    ),
    testOnlyExempt: memberFindings.testOnlyExempt.filter(
      (e) => !ownerVerdicted(fileOf(e), nameOf(e)),
    ),
    entrypointExempt: memberFindings.entrypointExempt.filter(
      (e) => !ownerVerdicted(fileOf(e), nameOf(e)),
    ),
    publicExempt: memberFindings.publicExempt.filter((e) => !ownerVerdicted(fileOf(e), nameOf(e))),
  };
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

  const orphanResult = findOrphanModules(prod, tests, texts);
  const exportResult = findTestOnlyExports(prod, tests, texts);
  const memberResult = findTestOnlyMembers(prod, tests, texts);

  // A file-level verdict — violation or exemption — subsumes symbol- and member-level
  // verdicts within that same file. A file already carrying (or needing) one tag
  // shouldn't also demand one per export or per member, and a file already reported
  // as an orphan shouldn't re-report each of its exports/members as a separate
  // finding: fixing the file fixes all of them at once.
  const fileVerdicted = new Set<string>([
    ...orphanResult.violations.map((v) => v.file),
    ...orphanResult.testOnlyExempt,
    ...orphanResult.entrypointExempt,
    ...orphanResult.publicExempt,
  ]);
  exportResult.violations = exportResult.violations.filter((v) => !fileVerdicted.has(v.file));
  exportResult.testOnlyExempt = exportResult.testOnlyExempt.filter(
    (e) => !fileVerdicted.has(fileOf(e)),
  );
  exportResult.entrypointExempt = exportResult.entrypointExempt.filter(
    (e) => !fileVerdicted.has(fileOf(e)),
  );
  exportResult.publicExempt = exportResult.publicExempt.filter(
    (e) => !fileVerdicted.has(fileOf(e)),
  );
  memberResult.violations = memberResult.violations.filter((v) => !fileVerdicted.has(v.file));
  memberResult.testOnlyExempt = memberResult.testOnlyExempt.filter(
    (e) => !fileVerdicted.has(fileOf(e)),
  );
  memberResult.entrypointExempt = memberResult.entrypointExempt.filter(
    (e) => !fileVerdicted.has(fileOf(e)),
  );
  memberResult.publicExempt = memberResult.publicExempt.filter(
    (e) => !fileVerdicted.has(fileOf(e)),
  );

  // A symbol-level verdict on an exported *class* subsumes member-level verdicts
  // for that class — see subsumeMembersByOwner's own doc comment for why this
  // is precise per member rather than a file-wide special case. No-op against
  // today's data (no symbol-level violation or exempt name is a class name) —
  // kept for correctness, not because it changes today's headline.
  const symbolVerdictedNames = new Set<string>([
    ...exportResult.violations.map((v) => `${v.file}:${v.name}`),
    ...exportResult.testOnlyExempt,
    ...exportResult.entrypointExempt,
    ...exportResult.publicExempt,
  ]);
  const subsumedMemberResult = subsumeMembersByOwner(memberResult, symbolVerdictedNames);

  const results = [orphanResult, exportResult, subsumedMemberResult];
  const violations = results.flatMap((r) => r.violations);
  const testOnlyExempt = results.flatMap((r) => r.testOnlyExempt);
  const entrypointExempt = results.flatMap((r) => r.entrypointExempt);
  const publicExempt = results.flatMap((r) => r.publicExempt);

  for (const v of violations) {
    const what =
      v.kind === 'member' ? `${v.file}:${v.name}()` : v.name ? `${v.file}:${v.name}` : v.file;
    const how = v.kind === 'file' ? 'imported by' : 'referenced by';
    console.error(`✗ ${what} — ${how} ${v.testRefs} test file(s), 0 production files`);
    console.error(
      v.kind === 'file'
        ? '    → delete it, or add `@testonly <why>` or `@entrypoint <why>` to the file docblock'
        : '    → delete it, or add `@testonly <why>` or `@entrypoint <why>` to its docblock',
    );
  }
  if (testOnlyExempt.length) {
    console.log(`ℹ ${testOnlyExempt.length} test-only exempt: ${testOnlyExempt.join(', ')}`);
  }
  if (entrypointExempt.length) {
    console.log(`ℹ ${entrypointExempt.length} entrypoint exempt: ${entrypointExempt.join(', ')}`);
  }
  if (publicExempt.length) {
    console.log(`ℹ ${publicExempt.length} public exempt: ${publicExempt.join(', ')}`);
  }
  console.log(`  scanned ${prod.length} production / ${tests.length} test files`);
  if (violations.length) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
