# Dead-Code Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the two dead-code tiers that no gate can currently see — modules and symbols reachable only from tests — fail CI, and extend knip from 5 gated workspaces to 16.

**Architecture:** Three phases. Phase 1 turns on knip for the seven ungated apps using the proven `packages/core` pattern. Phase 2 adds `scripts/check-dead-code.ts`, a repo-wide reachability checker that answers one question at three granularities (file, exported symbol, class member), with a mandatory-reason `@testonly` tag as the escape hatch. Phase 3 turns on knip for the five ungated packages — tag-only, because every published export removal is a major bump.

**Tech Stack:** knip 6.33, TypeScript + `tsx` (already a root devDependency), turbo 2, pnpm 11, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-01-dead-code-guardrails-design.md`

## Global Constraints

- **Branch:** `worktree-dead-code-audit-2026-09-01`, in the worktree at `.claude/worktrees/dead-code-audit-2026-09-01`. Run everything from there; never `cd` to the shared checkout.
- **One commit per task**, conventional message, ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Stage only the task's own paths (`git commit --only -- <paths>`); never `git add -A`.
- **Gate per task:** `pnpm turbo run build type-check lint test --filter=<unit>`. **Before merge:** the whole graph with `--force`. A filtered gate can serve a cached green — that is how a type error survived during the audit this plan comes from.
- **knip workspace config ordering is load-bearing:** the specific `"apps/<name>"` key must come **after** the `"apps/*"` glob. Placing it before silently strips that workspace's `entry`/`project` globs. Verify by running the gate, never by reading the config.
- **Never delete an implementation because its barrel re-export is unused.** Check for a subpath consumer first (`@xivdyetools/auth/encoding` etc.). This trap is live: `base64UrlDecode` is reported unused and has a real consumer.
- **Published-package version rule** (`audit-shared/release-mechanics.md`): local version == registry version for `auth` 2.0.0, `logger` 2.1.1, `types` 2.0.0, `worker-kit` 1.2.0. **Therefore any public export removal from those four is a MAJOR bump — Phase 3 tags and does not remove.** `packages/test-utils` is private (`"private": true`) and may remove freely.
- **Do not gate `apps/stoat-worker`** — parked per `audit-shared/units.md`.
- Docs travel with code: a CHANGELOG entry for every workspace whose behaviour or config changes.

---

## Phase 1 — knip across the seven ungated apps

### Task 1: Prove the config pattern on api-worker

Smallest surface that exercises every hazard: the ordering gotcha, a project-glob gap (VitePress), a real dead type, and a dead test helper.

**Files:**
- Modify: `knip.jsonc` (add one workspace key after the `apps/*` block)
- Modify: `apps/api-worker/package.json` (scripts)
- Modify: `apps/api-worker/src/universalis/types.ts` (remove `Env`)
- Modify: `apps/api-worker/tests/test-utils.ts` (remove `buildRequest`)
- Modify: `apps/api-worker/CHANGELOG.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the `lint:dead` script shape every later app copies —
  `knip --directory ../.. --workspace apps/<name> --no-config-hints --no-tag-hints`.

- [ ] **Step 1: Observe the failing gate**

```bash
cd .claude/worktrees/dead-code-audit-2026-09-01
pnpm exec knip --directory . --workspace apps/api-worker --no-config-hints --no-tag-hints
```

Expected: reports `Env` (`src/universalis/types.ts:41:18`). This is the failing test.

- [ ] **Step 2: Add the workspace override AFTER the `apps/*` block**

In `knip.jsonc`, immediately after the closing brace of the `"apps/web-app"` block, add:

```jsonc
    // includeEntryExports is safe for apps and NOT for packages: an app has no
    // external consumers, so a barrel export with no in-repo importer IS dead.
    // These keys MUST stay after "apps/*" — placing them before strips the glob's
    // entry/project settings for that workspace (verified 2026-09-01).
    "apps/api-worker": {
      "includeEntryExports": true,
      "entry": ["src/index.ts!", "src/**/*.test.ts", "tests/**/*.ts", "scripts/**/*.{ts,js,mjs}!", "docs/.vitepress/config.ts!", "docs/.vitepress/theme/index.ts!"],
      "project": ["src/**/*.ts", "tests/**/*.ts", "scripts/**", "docs/.vitepress/**", "*.ts"]
    },
```

The `docs/.vitepress/**` additions are why `vue` and the three theme files stop being reported: they were outside the project glob, not unused.

- [ ] **Step 3: Verify the config change did not strip the globs**

```bash
pnpm exec knip --directory . --workspace apps/api-worker --no-config-hints --no-tag-hints
```

Expected: `vue`, `docs/.vitepress/config.ts`, `theme/index.ts`, `TryIt.vue` are **gone** from the report. `Env` and `buildRequest` remain. If unrelated new files appear, the ordering is wrong — move the key after `apps/*`.

- [ ] **Step 4: Verify `Env` and `buildRequest` are genuinely dead**

```bash
git ls-files apps/api-worker | grep -E '\.ts$' | xargs grep -nw "buildRequest"
git ls-files apps/api-worker | grep -E '\.ts$' | xargs grep -n "universalis/types"
```

Expected: `buildRequest` appears only at its declaration. For `Env`, confirm importers take other names from that module — api-worker's live `Env` is in `src/types.ts`, and this is a same-named leftover in the universalis subtree. **If either has a real consumer, stop and report — do not delete.**

- [ ] **Step 5: Remove both**

Delete the `Env` interface from `apps/api-worker/src/universalis/types.ts` and the `buildRequest` function from `apps/api-worker/tests/test-utils.ts`, with any import line left unused by the removal.

- [ ] **Step 6: Wire the gate**

`apps/api-worker/package.json`:

```jsonc
"lint": "eslint src/ && pnpm run lint:dead",
"lint:dead": "knip --directory ../.. --workspace apps/api-worker --no-config-hints --no-tag-hints",
```

- [ ] **Step 7: Verify the gate is green**

```bash
pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker
```

Expected: all tasks successful, `lint` includes a clean knip run.

- [ ] **Step 8: Commit**

```bash
git commit --only -- knip.jsonc apps/api-worker -m "chore(api-worker): gate on knip; drop a dead Env type and test helper

First app on the knip gate. The workspace key sits after the apps/* glob —
placing it before silently strips that workspace's entry/project globs.
docs/.vitepress/** joins the project glob, which is why vue and the three
theme files stop being reported as unused: they were out of scope, not dead.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Roll the gate out to the remaining six apps

**Files:**
- Modify: `knip.jsonc`
- Modify: `apps/{discord-worker,moderation-worker,oauth,presets-api,image-worker,og-worker}/package.json`
- Modify: `apps/discord-worker/src/services/budget/index.ts`, `apps/discord-worker/src/types/github.ts`
- Modify: `apps/moderation-worker/src/utils/verify.ts`
- Modify: `apps/presets-api/tests/test-utils.ts`
- Modify: `apps/oauth/src/__tests__/mocks/cloudflare-test.ts`
- Modify: each app's `CHANGELOG.md`

**Interfaces:**
- Consumes: the `lint:dead` script shape from Task 1.
- Produces: knip green for all seven apps.

> `og-worker` already has its own `knip.jsonc` and `lint: "knip && knip --production"` — it needs **no change**. Listed here only so an implementer does not "fix" it.

- [ ] **Step 1: Add the six workspace keys after `apps/*`**

```jsonc
    "apps/discord-worker": { "includeEntryExports": true },
    "apps/moderation-worker": { "includeEntryExports": true },
    "apps/oauth": { "includeEntryExports": true },
    "apps/presets-api": { "includeEntryExports": true },
    "apps/image-worker": { "includeEntryExports": true },
```

`apps/stoat-worker` is deliberately absent (parked).

- [ ] **Step 2: Run each and record the findings**

```bash
for w in discord-worker moderation-worker oauth presets-api image-worker; do
  echo "=== $w"; pnpm exec knip --directory . --workspace apps/$w --no-config-hints --no-tag-hints
done
```

Expected exactly: `getDyeById` (discord-worker `services/budget/index.ts:21`), `GitHubPushPayload` (discord-worker `types/github.ts:11`), `DiscordVerificationResult` / `DiscordVerifyOptions` / `VerificationResult` (moderation-worker `utils/verify.ts:15,16,20`), `createMockRequest` (presets-api `tests/test-utils.ts:73`), `createBrokenProductionEnv` (oauth `src/__tests__/mocks/cloudflare-test.ts:197`). image-worker: none.

**Anything else is new since 2026-09-01 — investigate before removing.**

- [ ] **Step 3: Verify each symbol at its site before deleting**

```bash
git ls-files apps | grep -E '\.ts$' | xargs grep -nw "getDyeById"
```

`getDyeById` is a **barrel re-export** in `services/budget/index.ts` — check whether the underlying implementation has other consumers. If it does, delete only the re-export line. Repeat for each of the seven.

- [ ] **Step 4: Remove the seven symbols**

Delete each, plus any import left unused. For `getDyeById`, remove only the barrel line if the implementation is still consumed.

- [ ] **Step 5: Wire the five `lint:dead` scripts**

Same shape as Task 1, substituting the app name. `og-worker` unchanged.

- [ ] **Step 6: Verify all seven apps green**

```bash
pnpm turbo run build type-check lint test --filter='./apps/*' --force
```

Expected: all successful.

- [ ] **Step 7: Commit**

```bash
git commit --only -- knip.jsonc apps -m "chore(apps): gate the remaining six apps on knip

Removes seven dead symbols surfaced by turning the gate on. stoat-worker stays
ungated (parked, units.md); og-worker already had its own config.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Correct the stale "~200 issues" claim

Two documents tell the next reader the root sweep is unusable. It reports 11.

**Files:**
- Modify: `CLAUDE.md` (the knip bullet, ~line 100)
- Modify: `.claude/skills/audit-shared/traps/knip-and-dead-verdicts.md` (§2, in the **shared checkout**, not the worktree — this file is outside the repo)

- [ ] **Step 1: Measure the current number**

```bash
pnpm exec knip --no-config-hints --no-tag-hints --no-exit-code | grep -cE '^\S+ +\S'
```

Record the actual figure; use it rather than the one written here, which will age.

- [ ] **Step 2: Rewrite the CLAUDE.md bullet**

Replace the "as of 2026-08-18 it currently exits non-zero (~200 issues in the ungated apps …)" clause with the current state: all apps except stoat-worker are gated, the remaining root-sweep findings are the five ungated packages plus documented exclusions, and the count.

- [ ] **Step 3: Update the trap file's §2 bullet** to match, noting the date of the measurement.

- [ ] **Step 4: Commit** (the trap file lives outside the repo — commit only `CLAUDE.md` here and edit the skill file in place)

```bash
git commit --only -- CLAUDE.md -m "docs: the root knip sweep reports 11, not ~200

Stale by an order of magnitude since the 2026-09-01 cleanup. Left uncorrected,
the next reader concludes the sweep is unusable and skips it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 2 — the test-only reachability checker

### Task 4: Checker skeleton + file granularity

**Files:**
- Create: `scripts/check-dead-code.ts`
- Modify: `package.json` (root — add `dead-code:check`)

**Interfaces:**
- Produces, for Tasks 5–6:
  - `type Violation = { kind: 'file' | 'export' | 'member'; file: string; name?: string; testRefs: number }`
  - `function listTracked(): string[]`
  - `function isTestFile(file: string): boolean`
  - `function testOnlyReason(docblock: string): string | null`
  - `function docblockAbove(lines: string[], declIndex: number): string`

- [ ] **Step 1: Write the checker's file-granularity core**

Create `scripts/check-dead-code.ts`:

```ts
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
```

- [ ] **Step 2: Add the root script**

In the root `package.json` `scripts`, after `coverage:report`:

```jsonc
"dead-code:check": "tsx scripts/check-dead-code.ts",
```

- [ ] **Step 3: Run it — this is the acceptance test**

```bash
pnpm dead-code:check
```

Expected: **exactly one violation**, `apps/web-app/functions/_middleware.ts`. `chara-fixtures.ts` must be absent (matched by `__fixtures__/`) and stoat's `loading-indicator.ts` must be absent (excluded workspace). If `packages/test-utils/src/**` files appear as *test* files rather than production, the workspace-relative anchoring is broken — fix `isTestFile`, do not widen the exclusions.

- [ ] **Step 4: Tag the one legitimate case**

At the top of `apps/web-app/functions/_middleware.ts`:

```ts
/**
 * Cloudflare Pages middleware.
 *
 * @testonly No importer by design — Pages loads this by path convention from
 * functions/, so static analysis cannot see the call site. Deployed code.
 */
```

- [ ] **Step 5: Verify green**

```bash
pnpm dead-code:check && echo "EXIT OK"
```

Expected: `ℹ 1 exempted: apps/web-app/functions/_middleware.ts`, exit 0.

- [ ] **Step 6: Commit**

```bash
git commit --only -- scripts/check-dead-code.ts package.json apps/web-app/functions/_middleware.ts -m "feat(scripts): test-only reachability gate — file granularity

knip counts a test import as usage, so a module imported only by tests reads as
live; that blind spot held 1,240 lines in the 2026-09-01 audit. First granularity:
whole files. @testonly needs a reason — the gate enforces the documentation.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Exported-symbol granularity

Closes the gap neither original gate covered: a module-level function that only tests call.

**Files:**
- Modify: `scripts/check-dead-code.ts`
- Modify: `apps/web-app/src/services/chara-resolve-service.ts` (tag)

**Interfaces:**
- Consumes: `listTracked`, `isTestFile`, `testOnlyReason`, `docblockAbove`, `Violation` from Task 4.
- Produces: `findTestOnlyExports(prod, tests, texts): { violations: Violation[]; exempt: string[] }`.

- [ ] **Step 1: Add the finder**

```ts
const EXPORT_DECL =
  /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_]\w*)/;

export function findTestOnlyExports(
  prod: string[],
  tests: string[],
  texts: Map<string, string>,
): { violations: Violation[]; exempt: string[] } {
  const violations: Violation[] = [];
  const exempt: string[] = [];
  for (const file of prod) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const lines = (texts.get(file) ?? '').split('\n');
    lines.forEach((line, i) => {
      const m = EXPORT_DECL.exec(line);
      if (!m) return;
      const name = m[1];
      const word = new RegExp(`\\b${escapeRe(name)}\\b`);
      // Any non-test reference outside this declaration line counts as production use.
      const usedInProd = prod.some((f) => {
        const t = texts.get(f) ?? '';
        if (f !== file) return word.test(t);
        return t.split('\n').some((l, j) => j !== i && word.test(l));
      });
      if (usedInProd) return;
      const testRefs = tests.filter((f) => word.test(texts.get(f) ?? '')).length;
      if (testRefs === 0) return; // knip's job
      const doc = docblockAbove(lines, i);
      if (!hasBareTag(doc) && testOnlyReason(doc)) exempt.push(`${file}:${name}`);
      else violations.push({ kind: 'export', file, name, testRefs });
    });
  }
  return { violations, exempt };
}
```

- [ ] **Step 2: Merge it into `main`**

Replace the body of `main()` from the `findOrphanModules` call onward with:

```ts
  const results = [
    findOrphanModules(prod, tests, texts),
    findTestOnlyExports(prod, tests, texts),
  ];
  const violations = results.flatMap((r) => r.violations);
  const exempt = results.flatMap((r) => r.exempt);

  for (const v of violations) {
    const what = v.name ? `${v.file}:${v.name}` : v.file;
    const how = v.kind === 'file' ? 'imported by' : 'referenced by';
    console.error(`✗ ${what} — ${how} ${v.testRefs} test file(s), 0 production files`);
    console.error(
      v.kind === 'file'
        ? '    → delete it, or add `@testonly <why>` to the file docblock'
        : '    → delete it, or add `@testonly <why>` to its docblock',
    );
  }
  console.log(`ℹ ${exempt.length} exempted${exempt.length ? `: ${exempt.join(', ')}` : ''}`);
  console.log(`  scanned ${prod.length} production / ${tests.length} test files`);
  if (violations.length) process.exit(1);
```

- [ ] **Step 3: Run — expect exactly one new violation**

```bash
pnpm dead-code:check
```

Expected: `apps/web-app/src/services/chara-resolve-service.ts:clearCharaResolveCache`. The other four DEAD-004 exports were deleted on 2026-09-01, so only this one survives. **More than one means the production-reference test is too narrow — check that `scripts/`, `functions/` and `vite-plugin-*.ts` are being counted as production.**

- [ ] **Step 4: Tag it**

`clearCharaResolveCache` already has a docblock explaining itself; add the tag line:

```ts
 * @testonly beforeEach isolation — one test's cached resolve must not answer the next one's request.
```

- [ ] **Step 5: Verify green, then commit**

```bash
pnpm dead-code:check && git commit --only -- scripts/check-dead-code.ts apps/web-app/src/services/chara-resolve-service.ts -m "feat(scripts): reachability gate — exported-symbol granularity

Catches a module-level export only tests call. knip cannot: the test import makes
it an entry. DEAD-004 found five of these; four were deleted, this tags the survivor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Class-member granularity

**Files:**
- Modify: `scripts/check-dead-code.ts`

**Interfaces:**
- Consumes: everything from Tasks 4–5.
- Produces: `findTestOnlyMembers(prod, tests, texts): { violations: Violation[]; exempt: string[] }`.

- [ ] **Step 1: Add the finder**

```ts
const CLASS_DECL = /^export\s+(?:abstract\s+)?class\s+([A-Za-z_]\w*)/;
const MEMBER_DECL =
  /^ {2,}(?:public\s+|static\s+|async\s+|get\s+|set\s+)*([A-Za-z_]\w*)\s*(?:<[^>]*>)?\(/;
const MEMBER_SKIP = new Set(['constructor', 'if', 'for', 'while', 'switch', 'catch', 'return', 'super']);

export function findTestOnlyMembers(
  prod: string[],
  tests: string[],
  texts: Map<string, string>,
): { violations: Violation[]; exempt: string[] } {
  const violations: Violation[] = [];
  const exempt: string[] = [];
  for (const file of prod) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const lines = (texts.get(file) ?? '').split('\n');
    // Only scan files that actually declare an exported class. MEMBER_DECL is an
    // indentation heuristic and would otherwise match object-literal methods.
    if (!lines.some((l) => CLASS_DECL.test(l))) continue;
    lines.forEach((line, i) => {
      const m = MEMBER_DECL.exec(line);
      if (!m) return;
      const name = m[1];
      if (MEMBER_SKIP.has(name)) return;
      if (/\bprivate\b|\bprotected\b/.test(line) || name.startsWith('#')) return;
      // Members are always called on a receiver, so `.name` is the reference form.
      const dotted = new RegExp(`\\.${escapeRe(name)}\\b`);
      if (prod.some((f) => dotted.test(texts.get(f) ?? ''))) return;
      const testRefs = tests.filter((f) => dotted.test(texts.get(f) ?? '')).length;
      if (testRefs === 0) return;
      const doc = docblockAbove(lines, i);
      if (!hasBareTag(doc) && testOnlyReason(doc)) exempt.push(`${file}:${name}`);
      else violations.push({ kind: 'member', file, name, testRefs });
    });
  }
  return { violations, exempt };
}
```

- [ ] **Step 2: Add it to the `results` array in `main`**

```ts
  const results = [
    findOrphanModules(prod, tests, texts),
    findTestOnlyExports(prod, tests, texts),
    findTestOnlyMembers(prod, tests, texts),
  ];
```

and make the member kind read as a call in the report — change the `what` line to:

```ts
    const what = v.kind === 'member' ? `${v.file}:${v.name}()` : v.name ? `${v.file}:${v.name}` : v.file;
```

- [ ] **Step 3: Run and capture the full list**

```bash
pnpm dead-code:check 2>&1 | tee /tmp/dead-code-first-run.txt
```

Expected to include the 13 measured over web-app + core — `ToastService.dismissAll`/`getToasts`, `ModalService.dismissAll`/`getModals`, `StorageService.resetAvailabilityCache`, `ThemeService.resetToDefault`, `MarketBoardService.getIsFetching`, `CollectionService.__reloadForTesting`, `SavedPresetsService.__reloadForTesting`, `ThemeService.__resetForTesting`, `CharacterColorService.getSharedColors`/`getRaceSpecificColors`, `LocalizationService.getAvailableLocales` — plus the workers' hooks (`resetRateLimiterInstance`, `clearRateLimits`, `_setTestPatterns`, `_resetPatternsForTesting`, `DyeService.resetInstance`). Roughly 30 total.

- [ ] **Step 4: Commit the checker (still red — tagging is Task 7)**

```bash
git commit --only -- scripts/check-dead-code.ts -m "feat(scripts): reachability gate — class-member granularity

knip 6 has no classMembers rule, so a public method with no caller is invisible
to every gate. Reports ~30; Task 7 tags them.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: The tagging pass

**Files:**
- Modify: every file named in Task 6's first-run output (~15 files across web-app, core, api-worker, presets-api, discord-worker, moderation-worker)

- [ ] **Step 1: Tag each reported member with its reason**

Seven already have their reason written in prose from the 2026-09-01 audit — add the tag line to the existing docblock rather than writing a new one. Reasons to use:

| Member | `@testonly` reason |
|---|---|
| `ToastService.getToasts`, `ModalService.getModals` | how ~60 behaviour tests observe the service; components render from `subscribe()` |
| `ToastService.dismissAll`, `ModalService.dismissAll` | same — bulk-clear used by the container tests |
| `StorageService.resetAvailabilityCache` | `beforeEach` isolation — a stubbed localStorage must not leak between suites |
| `ThemeService.resetToDefault`, `.__resetForTesting` | `beforeEach` isolation — a theme switch must not leak between suites |
| `MarketBoardService.getIsFetching` | sole observer of the `isFetching` flag whose stuck-true state was BUG-039 |
| `*.__reloadForTesting`, `*.resetInstance`, `resetRateLimiterInstance`, `clearRateLimits`, `_setTestPatterns`, `_resetPatternsForTesting` | test-isolation hook |
| `CharacterColorService.getSharedColors`, `.getRaceSpecificColors`, `LocalizationService.getAvailableLocales` | published `@xivdyetools/core` API — removal is a MAJOR (DEAD-006) |

- [ ] **Step 2: Verify the bare-tag guard actually fires**

Temporarily reduce one tag to a bare `@testonly`, run `pnpm dead-code:check`, confirm it still reports that member, then restore the reason. This proves the mandatory-reason rule is enforced rather than assumed.

- [ ] **Step 3: Verify green**

```bash
pnpm dead-code:check && echo "GATE GREEN"
```

- [ ] **Step 4: Full graph gate**

```bash
pnpm turbo run build type-check lint test --force
```

- [ ] **Step 5: Commit**

```bash
git commit --only -- apps packages -m "chore: tag the test-only surface with @testonly + a reason

~30 members and one export. Each reason states what the symbol is FOR, not that
it is unused — seven were already documented in prose by the 2026-09-01 audit and
only needed the tag. The gate rejects a bare @testonly, so the list stays
meaningful rather than becoming a checkbox.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: CI wiring and documentation

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `CLAUDE.md` (pre-commit checklist + a line on the gate)
- Modify: `CHANGELOG.md` (root — monorepo tooling)

- [ ] **Step 1: Add the CI step** after the type-check step in the main job:

```yaml
      - name: Dead-code reachability
        run: pnpm dead-code:check
```

Unconditional — not under `--filter='...[HEAD^]'` like the turbo steps, because it is repo-wide by nature and costs seconds.

- [ ] **Step 2: Add to the CLAUDE.md pre-commit checklist and document the tag**

```bash
pnpm turbo run build type-check lint test && pnpm dead-code:check
```

Plus a short paragraph: what the gate catches that knip cannot, and that `@testonly` requires a reason.

- [ ] **Step 3: Root CHANGELOG `### Added` entry**

- [ ] **Step 4: Verify the workflow parses**

```bash
python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('ci.yml OK')"
```

- [ ] **Step 5: Commit**

```bash
git commit --only -- .github/workflows/ci.yml CLAUDE.md CHANGELOG.md -m "ci: run the dead-code reachability gate on every push

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase 3 — knip across the five ungated packages

> **Phase 3 tags; it does not remove.** `auth` 2.0.0, `logger` 2.1.1, `types` 2.0.0 and `worker-kit` 1.2.0 all sit at their registry version, so deleting any barrel export — including a redundant re-export line — breaks `import { X } from '@xivdyetools/<pkg>'` for npm consumers and costs a MAJOR bump. Tag with `@public` instead. `packages/test-utils` is `"private": true` and is the only one that may delete.

### Task 9: types + worker-kit

**Files:** `knip.jsonc`, `packages/types/package.json`, `packages/worker-kit/package.json`, plus the tagged source files.

- [ ] **Step 1: Add the two workspace keys after `packages/*`, beside the existing core/svg/bot-logic keys**

```jsonc
    "packages/types": { "includeEntryExports": true },
    "packages/worker-kit": { "includeEntryExports": true },
```

- [ ] **Step 2: Run and confirm the expected three**

```bash
pnpm exec knip --directory . --workspace packages/types --no-config-hints --no-tag-hints
pnpm exec knip --directory . --workspace packages/worker-kit --no-config-hints --no-tag-hints
```

Expected: `MATCH_QUALITY_TIERS` (types, reported twice — once per barrel level), `UpstashRateLimiter` and `OAUTH_LIMITS` (worker-kit).

- [ ] **Step 3: Tag each `/** @public */`** at its declaration, with a one-line note on who the intended consumer is. `UpstashRateLimiter` is a documented rate-limiter backend; `OAUTH_LIMITS` is a preset limit table.

- [ ] **Step 4: Add `lint:dead` to both packages** (same shape as `packages/core`), verify green, commit.

---

### Task 10: auth

**Files:** `knip.jsonc`, `packages/auth/package.json`, `packages/auth/src/index.ts`.

- [ ] **Step 1: Add the workspace key, run, expect nine**

`REFRESH_GRACE_SECONDS`, `createHmacKey`, `hmacVerifyHex`, `BOT_SIGNATURE_V2_MAX_AGE_MS`, `DEFAULT_DISCORD_MAX_TIMESTAMP_AGE_SECONDS`, `base64UrlDecode`, `base64UrlDecodeBytes`, `hexToBytes`, `bytesToHex` — all at `src/index.ts`.

- [ ] **Step 2: Confirm the barrel-vs-subpath trap before touching anything**

```bash
git ls-files apps packages | grep -E '\.ts$' | xargs grep -n "base64UrlDecode\|hexToBytes\|bytesToHex"
```

Expected: `base64UrlDecode` **has a live consumer** — `apps/moderation-worker/src/handlers/modals/ban-reason.ts`, importing the `@xivdyetools/auth/encoding` subpath. Only the root barrel's re-export is unreferenced. **Deleting the implementation would break production.**

- [ ] **Step 3: Tag all nine `@public`** at the `src/index.ts` re-export lines, noting for the encoding four that the live consumers use the `/encoding` subpath.

- [ ] **Step 4: Add `lint:dead`, verify green, commit.**

---

### Task 11: logger

**Files:** `knip.jsonc`, `packages/logger/package.json`, `packages/logger/src/{index,adapters/index,core/index,presets/index}.ts`.

- [ ] **Step 1: Add the workspace key, run, expect ~20 reports / 10 distinct symbols**

`BaseLogger`, `ConsoleAdapter`, `JsonAdapter`, `NoopAdapter`, `createBrowserLogger`, `browserLogger`, `createWorkerLogger`, `createRequestLogger`, `NoOpLogger`, `ConsoleLogger` — each reported 2–3× because the package re-exports through four nested barrels.

- [ ] **Step 2: Tag `@public` at each declaration site**

These are an **adjudicated KEEP**: the 2026-08-18 audit kept `BaseLogger`, the adapters and the preset factories as "documented public API / structurally live". This is recording an existing decision, not making a new one — cite that audit in the tag text.

- [ ] **Step 3: Confirm the duplicate export was already fixed** in Phase 1 Task 2 (`CORE_REDACT_FIELDS|DEFAULT_REDACT_FIELDS`); if it still reports, fix it here.

- [ ] **Step 4: Add `lint:dead`, verify green, commit.**

---

### Task 12: test-utils

The only package that may delete — it is `"private": true`, so there are no npm consumers.

**Files:** `knip.jsonc`, `packages/test-utils/package.json`, `packages/test-utils/integration/setup.ts`.

- [ ] **Step 1: Add the workspace key, run, expect four**

`createMockOAuthEnv`, `buildRequest`, `seedPreset`, `createMockKV` — all in `integration/setup.ts`.

- [ ] **Step 2: Check each for a consumer outside the package**

```bash
git ls-files apps packages | grep -E '\.ts$' | xargs grep -n "createMockOAuthEnv\|seedPreset"
```

`createMockKV` is a common name — confirm which package each hit resolves to before deciding. Anything with a real consumer gets `@public`; anything without gets deleted.

- [ ] **Step 3: Delete or tag accordingly. No version bump** — the package is private.

- [ ] **Step 4: Add `lint:dead`, verify green.**

- [ ] **Step 5: Final whole-graph gate and push**

```bash
pnpm turbo run build type-check lint test --force
pnpm dead-code:check
git push
```

- [ ] **Step 6: Commit**

```bash
git commit --only -- knip.jsonc packages -m "chore(packages): gate the five remaining packages on knip

Tag-only for the four published packages: all sit at their registry version, so
removing any barrel export — a redundant re-export line included — is a MAJOR.
test-utils is private and may delete.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Done when

- `pnpm dead-code:check` exits 0 and prints its exemption list.
- All 16 non-parked workspaces run knip in `lint`; `pnpm exec knip` at the root reports only documented exclusions.
- `pnpm turbo run build type-check lint test --force` is green across the graph.
- CI runs the reachability gate on every push.
- `CLAUDE.md` and the audit-shared trap file no longer claim the root sweep reports ~200 issues.
