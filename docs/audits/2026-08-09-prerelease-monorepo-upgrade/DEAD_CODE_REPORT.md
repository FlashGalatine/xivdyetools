# Dead Code Analysis Report — Pre-Release, Monorepo 2.0 / Web-App 5.0

## Executive Summary

- **Project:** xivdyetools (16 workspaces, ~253k lines TypeScript)
- **Analysis Date:** 2026-08-09
- **Analysis Depth:** standard (static analysis; `knip`/`ts-prune`/`depcheck` are not installed,
  so detection was done with targeted import-graph tracing and entry-point analysis)
- **Total Findings:** 8
- **Recommended Removals:** 7
- **Keep / Monitor:** 1
- **Estimated Dead Bytes:** ~685 KiB of assets + ~23 KiB of orphaned markup + a handful of lines

## Health Score

**Code Freshness: A**

Under 0.05% of the TypeScript surface is dead. There are **no orphaned source modules**, no
backup/`.old` files, no commented-out code blocks, and no unused workspace packages. The 5.0
rebuild cleaned up after itself well — the design record's condemned symbols (`ICON_GRID`,
`generateErrorSvg`, `generateNoWorldSetSvg`, `generateCompactAccessibilityRow`,
`generateCompactPresetSwatch`) are **all genuinely gone**, several with tombstone comments
explaining why.

What remains is almost entirely **stale assets and config left behind by the Vite entry move**
— not logic.

## Verification of the 5.0 Cleanup Claims

The design record listed specific symbols for deletion. All were verified as actually removed:

| Symbol condemned in the record | Status |
|---|---|
| `ICON_GRID` | ✅ **Gone** — zero references repo-wide |
| `generateErrorSvg` | ✅ **Gone** |
| `generateNoWorldSetSvg` | ✅ **Gone** |
| `generateCompactAccessibilityRow` | ✅ **Gone** |
| `generateCompactPresetSwatch` | ✅ **Gone** — with a tombstone at `packages/svg/src/preset-swatch.ts:320` recording *"zero callers, condemned in the…"* |
| `COLORS.blurple` (declared 4×) | ✅ **Gone** — only explanatory comments remain in og-worker |
| Habibi in the SVG/bot font stack | ✅ **Gone** — replaced by Fragment Mono; `test-font-rendering.ts` even keeps a `RETIRED_FONTS` guard |

This is a genuinely good cleanup record and worth stating plainly: the deletions the design
called for were executed.

## Summary by Category

| Category | Count | Remove | Keep | Approx. size |
|----------|-------|--------|------|--------------|
| Orphaned Files | 3 | 3 | 0 | ~663 KiB |
| Stale Assets | 1 | 1 | 0 | 14 KiB |
| Stale Test Code | 2 | 1 | 1 | few lines |
| Legacy Data | 1 | 1 | 0 | 1 line |
| Dead Config | 1 | 1 | 0 | 1.8 KiB |

## Findings Catalog

| ID | Title | Category | Confidence | Blast radius | Semver | Recommendation |
|----|-------|----------|-----------|--------------|--------|----------------|
| [DEAD-001](findings/DEAD-001.md) | `apps/web-app/index.html` — orphaned former Vite entry (22.7 KiB) | Orphaned File | HIGH | NONE | NONE | **REMOVE** |
| [DEAD-002](findings/DEAD-002.md) | `apps/web-app/fonts/` — 28 unreferenced woff2 files (640 KiB) | Orphaned File | HIGH | NONE | NONE | **REMOVE** |
| [DEAD-003](findings/DEAD-003.md) | `apps/web-app/netlify.toml` — stale deploy config with a drifting CSP copy | Dead Config | HIGH | NONE | NONE | **REMOVE** |
| DEAD-004 | `public/fonts/habibi-v22-latin_latin-ext-regular.woff2` + its `@font-face` | Stale Asset | HIGH | LOW | NONE | **REMOVE — after BUG-002** |
| DEAD-005 | `fonts.test.ts:13` mocks `../fonts/Habibi-Regular.ttf`, which no longer exists | Stale Test | HIGH | NONE | NONE | **REMOVE** |
| DEAD-006 | `test-utils` category factory seeds the retired `community` category | Legacy Data | MEDIUM | LOW | **MINOR** | **REMOVE WITH CAUTION** |
| DEAD-007 | 3 skipped E2E suites written against pre-5.0 DOM selectors | Stale Test | MEDIUM | NONE | NONE | **REMOVE OR REWRITE** |
| DEAD-008 | 7 `it.skip` in `presets-api` tests gated on "requires Cloudflare Workers" | Stale Test | LOW | NONE | NONE | **KEEP** (register below) |

### DEAD-004 — Habibi web asset

`apps/web-app/public/fonts/habibi-v22-latin_latin-ext-regular.woff2` (14.2 KiB) and the
`@font-face` at `globals.css:8-14`. **This is a cascade, not an independent removal** — the
font is currently *live* (see [BUG-002](bugs/BUG-002.md)). It only becomes dead once `.number`
/`.font-numeric` are repointed at Fragment Mono. It must therefore land in a **later sprint
than BUG-002**, never the same one.

### DEAD-005 — Stale font mock

```ts
// apps/discord-worker/src/services/fonts.test.ts:13
vi.mock('../fonts/Habibi-Regular.ttf', () => ({ default: new ArrayBuffer(150) }));
```

`Habibi-Regular.ttf` no longer exists in `apps/discord-worker/src/fonts/` (verified: the
directory holds FragmentMono, NotoSansJP/KR/SC subsets, Onest, Space Grotesk). Vitest registers
a mock for an unresolved specifier without complaining, so the suite passes and the line is
invisible. Delete it — the file it describes has been gone since the Fragment Mono migration.

### DEAD-006 — `community` in the test factory

```ts
// packages/test-utils/src/factories/category.ts:122
{ id: 'community', name: 'Community', description: 'User submissions', icon: null,
  is_curated: false, display_order: 6 },
```

`PresetCategory` no longer includes `community` ([BUG-001](bugs/BUG-001.md)). This factory row
keeps the retired concept alive in fixtures, which means tests can assert behaviour for a
category production no longer has.

**Semver: MINOR.** `@xivdyetools/test-utils` is workspace-private and never published, so there
is no external consumer — but it *is* consumed by every other workspace's test suite. Removing
the row may break tests that index the factory array by position or expect six categories.
Grep for those before removing, and let it ride with the BUG-001 fix so the concept dies
everywhere at once.

### DEAD-007 — Skipped legacy E2E suites

```
apps/web-app/e2e/color-matcher.spec.ts:17    describe.skip('Color Matcher Tool (legacy selectors; replaced by v4 extractor coverage)')
apps/web-app/e2e/dye-comparison.spec.ts:117  describe.skip('Dye Comparison Tool (legacy DOM ID assertions)')  + 13 inner test.skip
apps/web-app/e2e/dye-mixer.spec.ts           describe.skip ×2
apps/web-app/e2e/harmony-generator.spec.ts   describe.skip ×2
```

These are honestly labelled — each names *why* it is skipped and what replaced it. Recent work
already moved in this direction (`ed8f477 test(web-app): rewrite ui-interactions against the
5.0 DOM, ending 16 silent skips`), so the pattern is being actively retired.

**Recommendation: finish the job.** A skipped suite is worse than a deleted one — it looks like
coverage in the file tree and provides none. Either rewrite each against the 5.0 DOM (as
`ui-interactions.spec.ts` was) or delete it and note the coverage gap. `color-matcher.spec.ts`
explicitly says its coverage moved to the v4 extractor suite, so that one is a clean delete.

## Keep / Monitor Register

Findings that are *not* scheduled for removal, each with the concrete condition that would make
removal correct later.

| ID | Description | Reason to Keep | **Revisit trigger** |
|----|-------------|----------------|---------------------|
| DEAD-008 | 7 `it.skip` in `presets-api` (`presets.test.ts` ×4, `auth.test.ts` ×3), each labelled *"requires Cloudflare Workers"* / *"requires Cloudflare Workers crypto"* | These are **not stale** — they are environment-gated. They cover real, valuable paths (preset creation, Service-Binding notification fan-out, JWT authentication) that need the `workerd` runtime rather than the Node test environment. Deleting them would destroy an accurate record of what is deliberately untested locally. | **When `presets-api` adopts `@cloudflare/vitest-pool-workers`** (or an equivalent `workerd` test pool), un-skip all seven and confirm they pass. If that migration is decided against, convert them to documented integration tests run against `wrangler dev` instead — but do not leave them skipped indefinitely without one of those two outcomes. |

## Dependency Cleanup

`depcheck` is not installed, so this is a manual read of the manifests. **No unused runtime
dependency was identified.** The dependency-related work in this release is *version freshness*,
not removal — see [FINDING-001](findings/FINDING-001.md) (hono) and
[FINDING-004](findings/FINDING-004.md) (dev toolchain) in the security audit.

One observation rather than a finding: `apps/web-app` depends on Google Fonts at runtime while
carrying 640 KiB of unreferenced self-hostable font files (DEAD-002). Resolving
[REFACTOR-002](refactoring/REFACTOR-002.md) would let the app self-host and drop the
third-party origin entirely.

## What Was Checked and Found Clean

| Check | Method | Result |
|---|---|---|
| Orphaned source modules | Entry-point tracing from `main.ts` → `v4-layout.ts` lazy imports; Worker `index.ts` route graphs | **None.** Both the top-level tool components *and* `components/v4/` are live — `v4-layout.ts:426/440/476` lazy-imports `harmony-tool`, `extractor-tool`, `gradient-tool` at route time |
| Backup / scratch files | `*.bak`, `*.old`, `*.orig`, `*.backup` | **0 hits** |
| Commented-out code | Files with heavy `//` density | **0 findings.** The dense files (`APIService.ts` 121, `comparison-tool.ts` 177) are JSDoc and rationale comments — documentation, not corpses |
| Condemned 5.0 symbols | Direct grep for each named symbol | **All 7 confirmed removed** (table above) |
| Unused workspace packages | `pnpm-workspace.yaml` vs actual imports | **None** — all 8 packages have live consumers |
| Legacy markers | `@deprecated`, `TODO…remove`, `LEGACY`, `OBSOLETE` | 40 occurrences across 14 files — reviewed, all are *explanatory* (documenting migrations already done, e.g. `LEGACY_FACEWEAR_ITEM_IDS`, which is a deliberate frozen compatibility map, not dead code) |

## Cleanup Execution Plan

See [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) for the sprint-sequenced plan. Note the one
**cascade**: DEAD-004 depends on BUG-002 landing first and must not share its sprint.

## Post-Cleanup Verification

Run the full gate at **every** sprint boundary, not once at the end:

- [ ] `pnpm turbo run type-check` — 24/24
- [ ] `pnpm turbo run test --force` — 24/24 tasks, 8,262 tests / 320 files
- [ ] `pnpm turbo run build`
- [ ] `pnpm turbo run lint` (after [REFACTOR-003](refactoring/REFACTOR-003.md) makes it read-only)
- [ ] `pnpm --filter xivdyetools-web-app exec playwright test` — E2E
- [ ] Manual: web app loads, fonts render, PWA manifest installs

## Recommendations

1. **Add `knip` to the repo** as a devDependency and a non-blocking CI report. This audit found
   dead code by hand because no tool was available; `knip` would make the next sweep
   near-instant and catch unused exports this manual pass could not exhaustively cover across
   253k lines.
2. **Delete skipped tests or fix them — do not let them sit.** DEAD-007's suites advertise
   coverage that does not exist. The `ed8f477` commit shows the team already agrees.
3. **Treat "move the build entry" as a cleanup event.** All three orphaned-file findings
   (DEAD-001/002/003) trace to the Vite `root: 'src'` move leaving the old entry and its assets
   behind. A grep for newly-unreferenced files at the time would have caught all three.
