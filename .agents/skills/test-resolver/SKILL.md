---
name: test-resolver
description: Use when a xivdyetools test run is red — vitest or Playwright failures, a coverage-threshold miss, "tests are failing", "fix the tests", "npm/pnpm test failed" — before changing any test or source.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Agent
---

# Test Resolver (xivdyetools)

Before delegating or running command blocks, read `../audit-shared/model-routing.md`. It defines the Claude/Codex runtime mapping, coordinator rules, and shell/tool conventions for this workflow.

Every workspace is **Vitest 4** (web-app: jsdom; workers/packages: node); web-app also has
Playwright e2e. Several suites are *gates that go red on purpose* — the fix is upstream of the
test, never in it. Runs from the monorepo root `xivdyetools/`.

## Step 1 — capture (fresh, narrow)

Vitest verbose output is the largest thing this skill touches. Run the capture in a `collector`
agent (`../audit-shared/model-routing.md`) that returns only: pass/total, every failing test
name with its file, the first assertion line of each, and the log path. Follow the coordinator
rules for delegation. Read the raw log yourself only when a failure resists classification.

```bash
pnpm --filter <name> exec vitest run <path/to/file.test.ts> --reporter=verbose 2>&1 | tee "<TMP>/<log-id>-test.log"   # one file
pnpm --filter <name> exec vitest run -t "<test name substring>"                                                       # one test
pnpm turbo run test --filter=<name> 2>&1 | tail -60                                                                   # whole unit the way CI runs it (turbo `test` depends on ^build → deps rebuilt)
```
`pnpm --filter <name> run test` / `exec vitest` **bypass turbo** — dependency `dist/` may be stale;
when a failure smells like old code rebuild first: `pnpm turbo run build --filter=<name>...`
(trailing dots = unit + deps; workers have no build script of their own).

## Step 2 — classify (project table first, generic second)

| Red suite / symptom | It means | Fix (never the test) |
|---|---|---|
| `font-coverage.test.ts` (og-worker, discord-worker): "codepoint not covered" | locale/card text changed, CJK subsets stale | `pnpm --filter @xivdyetools/core run build` (the **full** build: the subset script reads the generated `src/data/locales` JSON, the test reads core's `dist/` — `build:locales` alone leaves the test stale) → `python scripts/subset-cjk-fonts.py` in **both** workers (`pip install fonttools brotli`; discord's font cache may download ~37 MiB) → rerun; compare subsets by cmap, not md5 |
| `locale-orphans.test.ts` / `i18n-orphans.test.ts` / reverse key gate / `.tc()` plural gate | key missing in a locale, orphaned key, or `t()` of a non-existent key | add the key to **all six** files (or delete the dead lookup); web-app: `node scripts/reorder-locales.mjs` then `pnpm --filter xivdyetools-web-app run validate:i18n` |
| `validate-i18n.js` / `i18n-parity.mjs` | duplicate key, key order, `{placeholder}` mismatch | fix the JSON; never hand-edit `packages/core/src/data/locales` (generated — fix CSV/`build-locales.ts`) |
| `bundle-budget.test.ts` / `check-bundle-size.js` | web-app chunk over budget | lazy-load or trim; note sourcemap attribution charges virtual modules to the preceding file |
| `public-metadata.test.ts` | sitemap/manifest/browserconfig/index.html drift vs `ROUTES` | regenerate from `ROUTES`, don't edit the expectation |
| coverage threshold red with no failing test | ratchet/threshold crossed | find the uncovered lines (coverage-testing skill); a drop with no source change is usually a constant-valued mock crossing a component threshold — bisect with historical test files; **never lower web-app's ratchet** (71/55/65/72); removed dead code lowering coverage is legitimate — report it |
| `Cannot find module '@xivdyetools/…'` in tests | dependency `dist/` missing/stale or subpath (`/blending`, `/encoding`, `/rate-limiter`, `/i18n`) not built | `pnpm turbo run build --filter=<name>...`; check the package `exports` map |
| TS1484/TS1205 in a test | `verbatimModuleSyntax` — type used as value import | `import type { … }` |
| `fileURLToPath` / `URL` type clash | workers-types + @types/node both loaded | pass `import.meta.url` **string**, not a `URL` object |
| flaky timing in web-app | `setTimeout(0)` flush counts lose to jsdom's ~16 ms rAF on fast runners | `await vi.waitFor(() => …)` on the signal; prove with rAF stubbed to 250 ms |
| full `<v4-config-sidebar>` won't mount | ConfigController mock → range sliders throw | render panels with lit `render()` instead |
| Discord handler tests | 25-choice autocomplete cap, embed length limits, `Translator.t()` returns the key (never falsy) | assert on the real limits; don't add `\|\| 'fallback'` |
| og-worker card tests | `new CharacterColorService()` at module load, renderer WASM | `vi.mock('./services/renderer')`, `vi.spyOn(globalThis,'fetch')`; core stays real (`server.deps.inline`) |
| Playwright (web-app `pnpm --filter xivdyetools-web-app run test:e2e`) | mobile-chrome project has ~28 pre-existing reds | triage against the known list before "fixing" |
| CI-only red | CI is ~5× slower; `ci.yml` runs affected units only (`--filter='...[HEAD^]'`) | check which path a perf budget times (core "k-d tree" benchmarks time the linear scan) |

Generic classes (assertion · runtime · timeout · mock · env · snapshot · flaky · config) follow
the usual vitest rules: raise a timeout only after proving the await chain; snapshot `-u` only
after reading the diff.

## Step 3 — context

More than one failing file → bounded `worker` assignments per file, in parallel within the
runtime's capacity when useful, each
returning `test | source | last 5 commits touching either | which of the three verdicts and
why` in ≤ 20 lines. **The verdict itself — test wrong / source regressed / gate doing its job
— is `verifier` work**; follow the coordinator rules for whether it runs inline or is delegated.
Getting it wrong means "fixing" a test that was correctly red, which this skill exists
to prevent.

Read the failing test, its source, `git log -5 --format='%h %s' -- <test> <source>`, the unit's
`vitest.config.ts` (env, `server.deps.inline`, thresholds, excludes) and `CLAUDE.md` testing
notes. Decide **test wrong / source regressed / gate doing its job** before editing anything.

## Step 4 — fix one at a time

Fix → rerun the single file → rerun the unit (`pnpm turbo run test --filter=<name>`) → then
`pnpm turbo run type-check lint --filter=<name>` (non-blocking but reported). For a test that
cannot fail (`typeof x === 'function'`, bare `not.toThrow()`, guarded body, value captured before
the action) rewrite it against observable output instead of "fixing" it.

## Step 5 — report (plain)

```
Unit <name> · was: <n> failing in <files> · now: <pass/total>
| Test | Class | Root cause | Fix |
Validation: type-check ✓/✗ · lint ✓/✗
Follow-ups: <guardrail to add, e.g. reverse key gate, or "none">
```

## Rules

- Gates that went red by design (fonts, i18n parity/orphans, bundle, metadata, coverage
  ratchet) are fixed upstream — never relaxed, skipped, or `.skip`'d.
- Agents diagnose; **the coordinator edits** (Step 4 stays a single-writer loop) and the
  coordinator alone commits (`../audit-shared/model-routing.md`).
- Don't lower thresholds, don't widen timeouts blindly, don't update snapshots unseen.
- Stage only your own paths (another session shares the checkout); no `git stash`.
- After 3–4 failed attempts: summarize attempts, show test + source, ask.
