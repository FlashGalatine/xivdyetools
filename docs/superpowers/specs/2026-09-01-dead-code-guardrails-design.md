# Dead-code guardrails — knip everywhere + a test-only reachability gate

**Date:** 2026-09-01 · **Scope:** whole monorepo (root tooling, 12 ungated workspaces) ·
**Status:** design approved in chat, not yet implemented · **Branch:** `worktree-dead-code-audit-2026-09-01`
(the 2026-09-01 dead-code audit's branch; these are its Recommendations 1–3)

## Problem

The 2026-09-01 dead-code audit removed ~6,400 lines across 30 findings. Its largest single tier —
1,240 lines of orphaned web-app modules plus 31 dead service methods — was **invisible to every gate
this repo has**, and sat in the unit that had been audited most recently (2026-08-16). Two structural
blind spots caused that:

1. **knip treats test files as entries.** A module imported only by tests is "used". That is how
   `dye-action-dropdown.ts` (570 lines, 0 production importers, `vi.mock`ed by seven tool tests)
   survived a dedicated dead-code audit five weeks earlier.
2. **knip 6 dropped the `classMembers` rule.** A public method with no caller is never reported, at
   all, anywhere.

A third gap is coverage rather than capability: **12 of 17 workspaces have no dead-code gate.** Only
`packages/{core,svg,bot-logic}` (root config) and `apps/{web-app,og-worker}` (own configs) are gated.

### Why gates, and why blocking — both failure modes are already on this repo's record

- **Unenforced conventions drift.** `noUnusedLocals` was adopted as a guardrail after the 2026-08-16
  audit and was silently switched off in four workspaces (DEAD-032). Nobody noticed for six weeks.
- **Report-only tools decay into noise.** `pnpm lint:dead` already *is* a report-only dead-code
  sweep, documented as "triage, not a gate". It accumulated roughly 200 findings that nothing acted
  on until an audit did the work by hand.

So neither "write it down" nor "just report it" survives contact with this codebase. The gates block.
The design problem is therefore not *whether* to block but **how to block without the gate rotting** —
which is a false-positive problem, because a gate that is wrong often enough gets disabled.

## Decisions (user, 2026-09-01)

1. **Block, on all three guardrails** — not report-only.
2. **Option C**: knip expansion, plus gates 1 and 2 unified into a single reachability checker rather
   than two bespoke tools with separate exception mechanisms.
3. **All three phases in scope**, including the packages tagging pass I recommended deferring. Noted
   at the time: my Phase 3 estimate was ~14 items and the measured figure is 47 (≈26 distinct); the
   user re-confirmed with the corrected number.

## 1. Current measured state

Run at design time on this branch, post-cleanup:

| Configuration | Reported items |
|---|---|
| Root knip today (12 workspaces ungated) | **11** |
| + `includeEntryExports` for the 7 ungated **apps** | **18** |
| + `includeEntryExports` for the 5 ungated **packages** | **65** (47 of them from packages) |

The root sweep is therefore **not** the "~200 issues" that `CLAUDE.md` and
`audit-shared/traps/knip-and-dead-verdicts.md` still describe. That claim is stale by an order of
magnitude and is corrected as part of Phase 1 — left alone, the next reader concludes the sweep is
unusable and skips it.

Class members the checker will flag on first run, measured over web-app + core only: **13**
(7 kept by the audit with reasons, 3 `__*ForTesting` hooks, 3 `@xivdyetools/core` published methods).
Adding the workers' own hooks (`resetRateLimiterInstance`, `clearRateLimits`, `_setTestPatterns`,
`_resetPatternsForTesting`, `DyeService.resetInstance`) the realistic one-time tagging pass is
**~30 tags**, not ~10.

## 2. Phase 1 — knip across the seven ungated apps

`api-worker`, `discord-worker`, `moderation-worker`, `oauth`, `presets-api`, `image-worker`, plus
`stoat-worker` **excluded** (parked per `audit-shared/units.md`; gating a parked app manufactures
work nobody will do).

Per app, mirroring the proven `packages/{core,svg,bot-logic}` pattern:

```jsonc
// package.json
"lint:dead": "knip --directory ../.. --workspace apps/<name> --no-config-hints --no-tag-hints",
"lint": "eslint src/ && pnpm run lint:dead"
```

```jsonc
// root knip.jsonc — MUST come AFTER the "apps/*" glob block
"apps/api-worker": { "includeEntryExports": true },
```

> **Config ordering is load-bearing and fails silently.** A probe that placed the specific workspace
> key *before* `"apps/*"` lost that workspace's `entry`/`project` globs and changed the reported set.
> The working precedent (`packages/core` after `packages/*`) puts the specific key last. Verify by
> running the gate, not by reading the config.

`includeEntryExports` is unambiguously correct for apps: an app has no external consumers, so a
barrel export with no in-repo importer *is* dead. That is exactly why it is **not** safe for the
packages — see Phase 3.

### Fixes required first (9)

`getDyeById` (discord-worker budget barrel) · `Env` (api-worker `universalis/types.ts`) ·
`GitHubPushPayload` (discord-worker) · `DiscordVerificationResult`, `DiscordVerifyOptions`,
`VerificationResult` (moderation-worker `utils/verify.ts`) · `CORE_REDACT_FIELDS|DEFAULT_REDACT_FIELDS`
duplicate export (logger) · `buildRequest` (api-worker `tests/test-utils.ts`) ·
`createMockRequest` (presets-api `tests/test-utils.ts`) · `createBrokenProductionEnv` (oauth mocks).

Each is verified at `file:line` before removal — the audit's own record is that 8 of 34 verdicts were
wrong when taken on reference count alone.

### Exclusions, each with a stated reason (6)

`analyze-unused-keys.d.ts`, `check-bundle-size.d.ts` (implicit `.d.ts` for a `.js` import — known
knip false positive) · `vue` + the three VitePress theme files (api-worker's `docs/.vitepress/**` is
outside the project glob; fix by widening the glob rather than ignoring the dependency) ·
`wrangler` (web-app — `wrangler-action` resolves the version from the working directory) ·
`build-item-names.mjs` (documented manual ko/zh table generator).

## 3. Phase 2 — the test-only reachability checker

### What it asserts

**One concept at three granularities:** is this reachable from production code, or only from tests?

| Granularity | Violation |
|---|---|
| File | a non-test source file imported by ≥1 test file and 0 production files |
| Exported symbol | an exported function/const/class with no non-test reference beyond its declaration |
| Class member | a public method of an exported class with no `.name(` reference in any non-test file |

The symbol granularity is not redundant with knip: knip counts a test import as usage, so a
module-level export that only tests call (`clearCharaResolveCache`, and the four others in DEAD-004)
is invisible to it. Types are **out of scope** — knip already owns those.

### "Production file" is defined by exclusion, not by `src/`

This is the single most important implementation detail, and the mistake the audit's own scripts
made. `symrefs.sh` bucketed only `<unit>/src` as production, so `countLocalizations` and
`LOCALE_CODES` read as dead when `scripts/register-commands.ts` uses them — two near-misses that
`recheck-nonsrc.sh` existed solely to catch.

A production file is **anything tracked by git that is not a test file**: `scripts/`, `functions/`,
`e2e/` configs, `vite-plugin-*.ts`, `eslint-rules/`, wrangler configs. Test files are
`*.{test,spec}.*`, `__tests__/`, `/tests?/`, `/e2e/`, `*test-utils*`, `*test-setup*`, `/mocks/`,
`__fixtures__/`.

> **The test-file patterns must be anchored per workspace, not matched on the whole path.** A naive
> `*test-utils*` match classifies all of `packages/test-utils/src/**` as test code, which would blind
> the checker to that package entirely — and the audit measured 14 of its 36 exports as having no
> external consumer, so that is exactly where it needs to look. `packages/test-utils` is *production
> code for its consumers*; only an app's own `tests/test-utils.ts` is a test file. Implement the
> patterns as workspace-relative, and assert this with a case in the checker's own validation.

### Shape and location

`scripts/check-dead-code.ts`, a root `"dead-code:check": "tsx scripts/check-dead-code.ts"`, and its
own CI step. Rationale:

- **Repo-wide, not per-workspace.** A package's consumers live in other workspaces, so a
  per-workspace scan would have to read the whole repo anyway.
- **TypeScript, not bash.** The audit scripts are GNU-specific (`xargs -d '\n'`, `grep -P`) and this
  is a Windows development machine. They were correct as throwaway investigation tools and are the
  wrong artefact for CI.
- **Root `scripts/` has the precedent** — `coverage-report.ts` plus the `tsx` devDependency landed
  there on 2026-09-01 (DEAD-031).

## 4. The `@testonly` convention

```ts
/**
 * Clear the memoized availability probe.
 * @testonly beforeEach isolation — one suite's stubbed localStorage must not leak into the next.
 */
static resetAvailabilityCache(): void {
```

- **The reason is mandatory.** A bare `@testonly` fails with "give a reason". The gate enforces the
  documentation, not merely the exemption — this is the property that keeps the exemption list
  meaningful two years from now.
- Applies at all three granularities: file docblock, symbol docblock, member docblock.
- **Tags, not a baseline file.** A tag travels with the code through renames and moves, appears in
  the diff that introduces it, and cannot drift out of sync. A baseline file does all three badly.
- **Structural exclusions live in config**, because tagging each would be noise: `**/__fixtures__/**`
  (fixtures are test data by definition) and `apps/stoat-worker` (parked).
- Precedent: this is the same shape as knip's `@public`, which this repo already uses for
  "published API, no in-repo consumer expected".

### Output prints exemptions on every run

```
✗ apps/web-app/src/components/foo.ts — imported by 3 test files, 0 production files
    → delete it, or add `@testonly <why>` to the file docblock
ℹ 30 exempted (functions/_middleware.ts, resetAvailabilityCache, …)
```

Deliberate: `noUnusedLocals` drifted because a silent exemption is invisible. A list printed in every
CI log is one somebody eventually questions.

## 5. Phase 3 — knip across the five ungated packages

`auth`, `logger`, `types`, `worker-kit`, `test-utils`. Measured cost: **47 reported, ≈26 distinct**
(nested barrels report the same symbol 2–3× — logger re-exports its 10 through `src/index.ts`,
`adapters/index.ts`, `core/index.ts` and `presets/index.ts`).

Unlike the apps, `includeEntryExports` here is **semantically loaded**: these publish to npm, so a
barrel export with no in-repo consumer may be a contract with consumers we cannot see. That is
precisely why `core`/`svg`/`bot-logic` needed a `@public` pass. Most of Phase 3 is therefore
*recording decisions that already exist* rather than making new ones.

Two traps this phase will hit, both already documented and both easy to get wrong:

1. **Barrel vs subpath.** `base64UrlDecode` is reported unused and is *not* dead — moderation-worker
   adopted it hours before this design was written, importing the `@xivdyetools/auth/encoding`
   **subpath**, so only the root barrel's re-export is unreferenced. Resolve by deleting the
   redundant barrel line or tagging it — **never** by deleting the implementation.
   (`audit-shared/traps/knip-and-dead-verdicts.md` §3.)
2. **The logger set is an adjudicated KEEP.** `BaseLogger`, the three adapters and the preset
   factories were explicitly kept by the 2026-08-18 audit as "documented public API / structurally
   live". Those are `@public` tags by prior decision, not fresh judgement.

## 6. CI wiring and local workflow

```yaml
- name: Dead-code reachability
  run: pnpm dead-code:check
```

Run **unconditionally**, not under `--filter='...[HEAD^]'` like the turbo steps: it is repo-wide by
nature and costs seconds. knip runs inside each workspace's existing `lint`, so it inherits the
existing filtered turbo step for free.

`CLAUDE.md`'s pre-commit checklist gains `pnpm dead-code:check`.

## 7. Acceptance

The checker's **first run must reproduce the audit's known-good result**. Concretely, it must report:

- **Exactly one orphaned module: `apps/web-app/functions/_middleware.ts`.** The audit's other two
  hits (`chara-fixtures.ts`, stoat's `loading-indicator.ts`) are absorbed by the `__fixtures__/` and
  `apps/stoat-worker` structural exclusions and must therefore *not* appear.
- **The 13 class members measured over web-app + core**, listed in §1 — plus the workers' own hooks
  (`resetRateLimiterInstance`, `clearRateLimits`, `_setTestPatterns`, `_resetPatternsForTesting`,
  `DyeService.resetInstance`), which were not separately measured. The first run enumerates the exact
  set; ~30 total is the estimate to plan against, not a number to assert.
- **The five DEAD-004 module-level exports**, of which four were deleted and only
  `clearCharaResolveCache` survives — so exactly one is expected here.

Anything reported *outside* those categories is over-reporting and must be explained before the gate
is turned on. Missing any of them means it is not looking hard enough. That corpus is the acceptance
test, and it is only valid on this branch — it depends on the cleanup already landed.

Per phase, the standing gate applies (`audit-shared/release-mechanics.md`):
`pnpm turbo run build type-check lint test` for the touched units, and the whole graph with `--force`
before merge — the audit's own type error slipped past a *cached* per-unit gate and only surfaced on
a forced whole-graph run.

## 8. Risks

| Risk | Mitigation |
|---|---|
| The checker is itself buggy, and a wrong gate is worse than none | Acceptance corpus above; the checker is validated against a repo whose dead code is already known |
| Tagging pass (~30) is dull and invites rubber-stamping | The reason is mandatory and appears in review; the seven audit-kept members already have their reasons written |
| Phase 3 deletes a live published export | Barrel-vs-subpath trap called out explicitly; version rule in `release-mechanics.md` makes any public removal a MAJOR |
| Gate fires on a legitimate new pattern and blocks a PR | `@testonly <reason>` is a one-line unblock, visible in the diff |
| knip config ordering silently changes the reported set | Verify by running the gate after each workspace is added, never by reading config |

## 9. Out of scope

- `apps/stoat-worker` — parked; structural exclusion, revisit if un-parked or retired.
- Type-level reachability — knip owns it.
- Recommendation 8 (`@xivdyetools/svg`'s `testTimeout`) — unrelated flake, tracked separately.
- Automating the `@public` judgement for published packages. It is a human call by construction.
