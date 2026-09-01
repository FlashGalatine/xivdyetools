# Dead code — whole monorepo (2026-09-01)

- **Branch/commit:** audited at `8ca1bb09` (= `main`), clean tree. **Remediated on the same branch** — see the status table at the foot of this file; `1deef4ef` is the catalog as filed, everything after it is execution.
- **Scope:** all 17 deploy units — 8 packages + 9 apps (≈141k non-test TS lines, ≈144k test lines) plus root tooling, `wrangler.toml` bindings, static assets, six locale sets and the web-app stylesheets
- **Method:** knip 6.33 (root monorepo config + web-app's and og-worker's own configs, `--production` for og-worker) · `tsc --noEmit --noUnusedLocals --noUnusedParameters` forced in all 17 workspaces · per-export reference bucketing over `git ls-files` (1,200+ exports) · class-member survey (knip 6 has no `classMembers` rule) · a **test-only module** scan · i18n orphan gates plus a by-hand resolution of the 175 dynamically-keyed web-app keys · dead-CSS, asset, binding and dependency sweeps. Scripts in `evidence/scripts/`, raw output in `evidence/`.
- **Baseline gates (before):** `pnpm turbo run type-check` 25/25 green; `pnpm turbo run test` 25/25 green **on the second run** — the first run failed `@xivdyetools/svg#test` with `Test timed out in 5000ms` on the *first* test of `src/index.test.ts`, which passes in 1.1 s in isolation and passed on a forced re-run of the whole graph. Treat it as a load-dependent flake, not a red baseline (`evidence/gates-test.txt`, `gates-test-rerun.txt`).
- **Totals:** 34 findings — **30 FIXED, 0 open, 4 KEEP** · Sprint 0: none — nothing here was a live defect or a security issue.
- **Measured weight:** ≈**2,690 non-test source lines** + **82 CSS lines** + ≈**1,840 test lines** + 2 dependency declarations + 4 dead `Env` fields + 13 dead type re-exports + 3 orphaned scripts. Packages contribute almost none of it.

Three things are worth reading before the catalog.

> **1. The biggest tier is invisible to every gate this repo has.** knip treats test files as entries, so a module imported *only* by tests counts as used; knip 6 has no `classMembers` rule, so a public method with no caller is never reported. Between them they hide **1,240 lines of orphaned web-app modules** (`dye-action-dropdown.ts`, `tooltip-service.ts`, `announcer-service.ts`) and **37 dead service methods** — in the unit that was audited most recently. `evidence/scripts/test-only-modules.sh` and `members-all.sh` are the two scans that see it; neither runs in CI today.

> **2. The never-audited workers carry the same sediment the audited ones did.** moderation-worker, presets-api, oauth, api-worker and image-worker had never had a dead-code pass. They yield 13 test-only exports, 8 dead barrel re-exports, 13 dead `@deprecated` type shims, a 74-line notification path with no caller, and two dead dependencies — the same shapes the 2026-08-18 pass found in discord-worker, because the code was copied from it.

> **3. Two gated removals from `POST_MERGE_CHECKLIST.md` §3 are now unblocked, and one is not.** The stainID D1 rewrite completed on 2026-08-28, which retires the `resolvePresetDye` legacy branch (DEAD-007) and the migration script that produced it (DEAD-013); `notifyModerators` was already gate-free (DEAD-009). The KV rate-limiter fallbacks (DEAD-034) still need a week of production logs that no static pass can supply — they stay.

## Catalog

| ID | Title | Conf | Blast | Semver | Deploy unit | Rec |
|----|-------|------|-------|--------|-------------|-----|
| [DEAD-001](findings/DEAD-001.md) | `dye-action-dropdown.ts` — 570-line component with 0 production importers; 8 test files mock it | HIGH | NONE | NONE | web-app | **REMOVE** |
| [DEAD-002](findings/DEAD-002.md) | `tooltip-service.ts` orphan (475) + 77 lines of CSS only it consumes + a false "ready" log | HIGH | NONE | NONE | web-app | **REMOVE** |
| [DEAD-003](findings/DEAD-003.md) | `announcer-service.ts` orphan (195) — v2.1 screen-reader service never mounted | HIGH | NONE | NONE | web-app | **REMOVE** (a11y call first) |
| [DEAD-004](findings/DEAD-004.md) | 5 exported functions with no production call site — 71 lines | HIGH | LOW | NONE | web-app | **REMOVE** |
| [DEAD-005](findings/DEAD-005.md) | 37 test-only public service methods across 13 classes — 352 lines | HIGH | LOW | NONE | web-app | **REMOVE WITH CAUTION** |
| [DEAD-006](findings/DEAD-006.md) | core `getSharedColors`/`getRaceSpecificColors`/`getAvailableLocales` — published API, no in-repo consumer | HIGH | HIGH | **MAJOR** | packages/core | **KEEP** |
| [DEAD-007](findings/DEAD-007.md) | `resolvePresetDye` legacy-itemID branch — §3 gate satisfied 2026-08-28 | MED | LOW | NONE | web-app | **REMOVE WITH CAUTION** |
| [DEAD-008](findings/DEAD-008.md) | 5 unused Tailwind-override selectors in `themes.css` | HIGH | NONE | NONE | web-app | **REMOVE** |
| [DEAD-009](findings/DEAD-009.md) | presets-api `notifyModerators` (74) + 4 dead `Env` fields + 3 orphan secrets (PAPI-16) | HIGH | LOW | NONE | presets-api | **REMOVE** |
| [DEAD-010](findings/DEAD-010.md) | `validateStringLength`/`validateArray`/`validateEnum` + 2 types — 108 lines, no tests either | HIGH | NONE | NONE | presets-api | **REMOVE** |
| [DEAD-011](findings/DEAD-011.md) | `checkBanStatus` + `requireNotBannedCheck` superseded by the mounted middleware — 61 lines | HIGH | LOW | NONE | presets-api | **REMOVE** |
| [DEAD-012](findings/DEAD-012.md) | 4 permanently-skipped tests (~145 lines); one is superseded by the next test in the file | HIGH | NONE | NONE | presets-api | **REFACTOR FIRST** |
| [DEAD-013](findings/DEAD-013.md) | `scripts/migrate-dyes-to-stainids.ts` — migration ran and was verified 2026-08-28 | HIGH | NONE | NONE | presets-api | **REMOVE WITH CAUTION** |
| [DEAD-014](findings/DEAD-014.md) | 13 test-only exports across 6 files copied from discord-worker — 191 lines | HIGH | LOW | NONE | moderation-worker | **REMOVE** |
| [DEAD-015](findings/DEAD-015.md) | 8 dead barrel re-exports in `handlers/buttons/index.ts` | HIGH | NONE | NONE | moderation-worker | **REMOVE** |
| [DEAD-016](findings/DEAD-016.md) | `toBannedUser` + `InteractionResponseBody` — zero references, no tests | HIGH | NONE | NONE | moderation-worker | **REMOVE** |
| [DEAD-017](findings/DEAD-017.md) | hand-rolled base64url duplicating `@xivdyetools/auth/encoding`; the encode half is dead | HIGH | LOW | NONE | moderation-worker | **REFACTOR FIRST** |
| [DEAD-018](findings/DEAD-018.md) | `discord-interactions` devDependency — no reference anywhere | HIGH | NONE | NONE | moderation-worker | **REMOVE** |
| [DEAD-019](findings/DEAD-019.md) | 13 dead `@deprecated` type re-exports of `@xivdyetools/types` across 3 apps | HIGH | LOW | NONE | moderation-worker · oauth · presets-api | **REMOVE** |
| [DEAD-020](findings/DEAD-020.md) | api-worker `errorResponse` — 18 lines, 0 call sites | HIGH | NONE | NONE | api-worker | **REMOVE** |
| [DEAD-021](findings/DEAD-021.md) | api-worker re-exports `LocalizationService` for nobody | HIGH | NONE | NONE | api-worker | **REMOVE** |
| [DEAD-022](findings/DEAD-022.md) | duplicate `createMockEnv`; the one under `src/` is dead | HIGH | NONE | NONE | api-worker | **REMOVE** |
| [DEAD-023](findings/DEAD-023.md) | `CacheService.deleteAsync`/`.deleteEntry` — no production caller | HIGH | LOW | NONE | api-worker | **REMOVE** |
| [DEAD-024](findings/DEAD-024.md) | `spectral.js` declared directly, reached only via core (web-app removed the same in 08-16) | HIGH | LOW | NONE | api-worker | **REMOVE WITH CAUTION** |
| [DEAD-025](findings/DEAD-025.md) | oauth `DISCORD_REQUIRED_SCOPES` + `isStateSigned` — 14 lines, no tests either | HIGH | NONE | NONE | oauth | **REMOVE** |
| [DEAD-026](findings/DEAD-026.md) | oauth 3 test-only user-lookup wrappers — 18 lines | HIGH | LOW | NONE | oauth | **REMOVE** |
| [DEAD-027](findings/DEAD-027.md) | image-worker `getImageDimensions` — 27 lines, test-only | HIGH | NONE | NONE | image-worker | **REMOVE** |
| [DEAD-028](findings/DEAD-028.md) | `scripts/test-font-rendering.ts` — unreferenced *and* wrong since the static-font swap | HIGH | NONE | NONE | discord-worker | **REMOVE** |
| [DEAD-029](findings/DEAD-029.md) | `registryCommandNames` test-only; `InteractionResponseBody` keeps 202 test references | HIGH | NONE | NONE | discord-worker | **REMOVE** / **KEEP** |
| [DEAD-030](findings/DEAD-030.md) | stoat-worker: 1 orphan module + 3 test-only exports + 4 unused test imports — 120 lines | HIGH | NONE | NONE | stoat-worker | **KEEP** (P3, parked) |
| [DEAD-031](findings/DEAD-031.md) | root `scripts/coverage-report.ts` — 245 lines, no script, no CI, no `tsx` to run it | HIGH | NONE | NONE | repo tooling | **REFACTOR FIRST** |
| [DEAD-032](findings/DEAD-032.md) | 4 workspaces disable the base `noUnusedLocals`/`noUnusedParameters` | HIGH | LOW | NONE | svg · bot-logic · image-worker · stoat-worker | **REMOVE** overrides |
| [DEAD-033](findings/DEAD-033.md) | `DEPRECATIONS.md` still lists `LocalStorageCacheBackend`, removed long ago | HIGH | NONE | NONE | repo docs | **REMOVE** |
| [DEAD-034](findings/DEAD-034.md) | KV rate-limiter fallbacks ×4 workers — gate is a week of production logs | LOW | MEDIUM | NONE | api-worker · oauth · discord-worker · moderation-worker | **KEEP** |

## Quick wins

HIGH confidence, NONE/LOW blast, no coupling — safe in any order, ~700 source lines:

| ID | Unit | What |
|----|------|------|
| DEAD-020, 021, 022, 023 | api-worker | 4 unused exports/members + a redundant re-export — 57 lines, one commit |
| DEAD-015, 016, 018 | moderation-worker | 8 barrel re-exports, 2 unreferenced symbols, 1 dependency |
| DEAD-025, 026 | oauth | 5 unused/test-only exports — 32 lines |
| DEAD-027 | image-worker | 27 lines |
| DEAD-028 | discord-worker | 76 lines, and it removes a script that now lies |
| DEAD-010 | presets-api | 108 lines with no tests to update |
| DEAD-008, 033 | web-app · docs | 5 CSS selectors, 1 stale deprecation section |

## KEEP register

| ID | Item | Reason | Revisit trigger |
|----|------|--------|-----------------|
| DEAD-006 | core `getSharedColors`, `getRaceSpecificColors`, `getAvailableLocales` ×2 | published API at 4.0.1 = registry version; removal is a MAJOR for ~25 lines | the next `@xivdyetools/core` major for any other reason |
| DEAD-029 | discord-worker `InteractionResponseBody` | 202 test references make it the de-facto handler-return assertion type | a future sweep still showing `prod=1` → move it to `src/types/testing.ts` |
| DEAD-030 | stoat-worker's dead tier | parked project; pruning a parked bot buys nothing | stoat-worker is un-parked, or retired (then delete the app) |
| DEAD-034 | KV rate-limiter fallbacks | reachable fallback paths, not dead code; empirical gate | one week of clean production tail on all four workers |
| — | `apps/discord-worker/fonts-src/NotoSansKR-Variable.ttf` (10.4 MB) | deliberate: lets a fresh clone re-subset without a 10 MiB download (`subset-cjk-fonts.py:257-263`) | if SC/JP are ever tracked too, or a pinned download replaces it — today the stated benefit covers 1 of 3 CJK faces |
| — | `apps/api-worker/scripts/build-item-names.mjs` | documented manual ko/zh table generator, referenced by `src/chara/regional-names.ts` and the chara docs | if `regional-names.ts` stops being hand-regenerated |
| — | `__setTestEnvironment`, `__reloadForTesting`, `__resetForTesting`, `resetRateLimiterInstance`, `clearRateLimits`, `_setTestPatterns`, `_resetPatternsForTesting` | deliberate test-isolation hooks | never |
| — | web-app `@shared/logger` `@deprecated` compat layer | 54 non-test importers — a refactor, not dead code | when a migration to `createBrowserLogger` is actually scheduled |

## Dependency cleanup

| Package | Where | Verdict |
|---------|-------|---------|
| `discord-interactions` | moderation-worker devDep | **Remove** (DEAD-018) |
| `spectral.js` | api-worker dep | **Remove** — declared by `@xivdyetools/core`, reached transitively (DEAD-024) |
| `vue` | api-worker devDep | **Keep** — knip false positive; used by `docs/.vitepress/theme/` which is outside the project glob |
| `wrangler` | web-app devDep | **Keep-uncertain**, carried from 2026-08-16 — `wrangler-action` resolves the version from the working directory |
| `@types/node`, `@vitest/coverage-v8`, `@vitest/ui`, `cross-env`, `tsx`, `tsup` | various | **Keep** — ambient types, CLI flags and package scripts; not importable references |

## Positive controls

What is already right, and should not be re-investigated next time:

- **knip is clean where it is gated**: web-app and og-worker exit 0 with no output; `packages/{core,svg,bot-logic}` report nothing under the root config.
- **`tsc --noUnusedLocals --noUnusedParameters` across all 17 workspaces yields 4 errors**, all in one parked app's tests.
- **i18n has no orphans**: web-app 1152/1152 keys reachable, and the 97 keys reachable only through data-driven stems (`preset.<id>.*`, `swatch.gearSlot.*`, `tools.<id>.*`, `comparison.m<Method>*`, `harmony.types.*Desc`) were each traced to their map by hand. bot-logic's three orphan-gate tests pass. core's locale sections all have live accessors — the 2026-08-18 DEAD-036 removals landed.
- **Zero commented-out code** in any tracked `.ts` file.
- **Every `wrangler.toml` binding and var has a production reference** in its own worker (`evidence/bindings.py`) — the dead D1 binding from 2026-08-18 is gone.
- **Static assets are all referenced**; web-app `public/` is down to 28 files from the 3.9 MB the 2026-08-16 pass found.
- **web-app CSS is down to 1,321 lines from 2,758**, with 5 dead selectors left (plus the 77 that fall with DEAD-002).
- **og-worker's DEAD-001 hole is closed** — `generateOGDataForTool` now dispatches to the extractor, presets and budget generators (`og-data-generator.ts:804,813,820`).
- **`LocalStorageCacheBackend` and oauth's `[env.preview]` are already gone** from the code.

## Rejected suspicions

Candidates checked and dropped — each looked dead by reference count:

- `countLocalizations`, `LOCALE_CODES` (discord-worker) and `calibrateBandVocabulary` (core) — used by `scripts/`, which the per-export bucketing does not count as production. This is why `evidence/scripts/recheck-nonsrc.sh` exists and every candidate was re-run through it.
- `brandHtmlForBeta`, `hasBetaHeadersBlock` (web-app) — consumed by `vite-plugin-beta-branding.ts` at the app root.
- `apps/web-app/functions/_middleware.ts` — a Cloudflare Pages entry point; framework-loaded, never imported.
- core locale sections `currencies`, `visions`, `sheets`, `acquisitions`, `harmonyTypes` — the section names appear only in `TranslationProvider.ts`, but their accessors (`getCurrency`, `getVisionShort`, `getSheetName`, …) all have og-worker and web-app consumers.
- api-worker `vue`; `validateDimensions`/`validateImageUrl` (image-worker, called internally); `assertValidMaxDimension` (`photon.ts:189`); `clipLabel`, `harmonyToKey`, all `*OGOptions` types (og-worker, used in-file).
- `GLYPH_SETS` (svg) — 2026-08-18 DEAD-015 removed its barrel line; what remains is a file-local parity-test fixture, as its docstring says.
- `requireNotBanned` (presets-api) — mounted on both mutating routers; only its two unused *alternatives* are dead.
- `analyze-unused-keys.d.ts` / `check-bundle-size.d.ts` — the known knip `.d.ts` false positives.

## Recommendations

Guardrails that would have caught this pass's findings, roughly in value order:

1. **Add a test-only-module gate.** `evidence/scripts/test-only-modules.sh` found 1,240 dead lines in the most recently audited unit. Run it in `lint` for web-app first — it is a 20-line script and its output is currently 6 rows.
2. **Add a class-member survey to the packages' `lint:dead`.** knip 6 dropped `classMembers`; `members-all.sh` fills the gap and found 37 dead methods in web-app and 3 in core.
3. **Extend the knip gate to the five ungated workers.** api-worker, moderation-worker, presets-api, oauth and image-worker have no `lint:dead`; the root config already traverses them, so it is a per-package script plus `@public` tags where intended.
4. **Restore `noUnusedLocals`/`noUnusedParameters`** in svg, bot-logic and image-worker (zero errors today — DEAD-032).
5. **Make `POST_MERGE_CHECKLIST.md` §3 rows carry their gate's *evidence*, not just its name.** Two of the four gated removals had silently become actionable; nothing pointed that out.
6. **Give the dynamic i18n families a resolver.** The orphan gate marks 175 keys live on a prefix match; `evidence/scripts/i18n-resolve-helpers.mjs` narrows that to 97, and the remaining 97 need a per-map enumeration to be provable rather than assumed.
7. **Treat a skipped test as a failing test.** The four `it.skip`s in presets-api have outlived the constraint that caused them.
8. **Raise `@xivdyetools/svg`'s `testTimeout`** (or warm the module graph) — `src/index.test.ts`'s first case imports the whole barrel and times out at 5 s under a parallel `turbo run test`, while taking 1.1 s alone. A cleanup campaign that gates on a full-graph test run will hit this repeatedly and read it as its own breakage.

## Remediation status

Executed 2026-09-01 on `worktree-dead-code-audit-2026-09-01`, quick wins first then least → most
risky, one commit per step with the unit's gates green at each boundary. Whole-graph verification
after the last commit: `pnpm turbo run build type-check lint test --force` → **61/61 green**.

| ID | Status | Commit |
|----|--------|--------|
| DEAD-001 | FIXED | `c89a822c` |
| DEAD-002 | FIXED | `c89a822c` |
| DEAD-003 | FIXED | `c89a822c` |
| DEAD-004 | FIXED (4 of 5; 1 reclassified KEEP) | `a7cb99f8` |
| DEAD-005 | FIXED (31 of 37; 6 reclassified KEEP) | `a7cb99f8` |
| DEAD-006 | KEEP | — |
| DEAD-007 | FIXED (gate verified against production D1) | `20eec62a` |
| DEAD-008 | FIXED | `45be904f` |
| DEAD-009 | FIXED (ops step outstanding) | `e09b462d` |
| DEAD-010 | FIXED | `825a45c0` |
| DEAD-011 | FIXED | `befee92c` |
| DEAD-012 | FIXED | `15a7cea6`, `00a33fae` |
| DEAD-013 | FIXED | `20eec62a` |
| DEAD-014 | FIXED (12 of 13; 1 reclassified → DEAD-017) | `ac96e79a` |
| DEAD-015 | FIXED | `6341acfc` |
| DEAD-016 | FIXED | `6341acfc` |
| DEAD-017 | FIXED | `ac96e79a` |
| DEAD-018 | FIXED | `6341acfc` |
| DEAD-019 | FIXED (13 dead names; the two `@deprecated` blocks remain) | `7d173835` |
| DEAD-020 | FIXED | `2fd2c2a7` |
| DEAD-021 | FIXED | `2fd2c2a7` |
| DEAD-022 | FIXED | `2fd2c2a7` |
| DEAD-023 | FIXED | `2fd2c2a7` |
| DEAD-024 | FIXED | `4d4ec7aa` |
| DEAD-025 | FIXED | `c99da102` |
| DEAD-026 | FIXED | `c99da102` |
| DEAD-027 | FIXED | `46713036` |
| DEAD-028 | FIXED | `192c81e1` |
| DEAD-029 | KEEP (recommendation reversed during execution) | — |
| DEAD-030 | KEEP (P3) | partially via `8c12d0ac` |
| DEAD-031 | FIXED (adopted, not deleted) | `6a53a956` |
| DEAD-032 | FIXED | `8c12d0ac` |
| DEAD-033 | FIXED | `45be904f` |
| DEAD-034 | KEEP | — |

### Verdicts that changed once the code was in front of us

Eight of the 34 were wrong or too broad as filed. Each is corrected in its own finding:

- **DEAD-029** — `registryCommandNames` backs the registry↔schema roster-parity gate, and the
  2026-08-18 audit had already kept it deliberately. Reversed from REMOVE to KEEP before touching it.
- **DEAD-005** — six of the 37 methods are load-bearing: `ToastService`/`ModalService`'s
  `dismissAll`/`getToasts`/`getModals` are how ~60 real behaviour tests observe those services (the
  first cut deleted them all), `StorageService.resetAvailabilityCache` and
  `ThemeService.resetToDefault` are `beforeEach` hooks, and `MarketBoardService.getIsFetching` is
  the only observer of the flag behind BUG-039.
- **DEAD-004** — `clearCharaResolveCache` is an isolation hook too.
- **DEAD-014** — `encodeBase64Url` is not unused: three test files build legacy `custom_id`
  fixtures with it. It became a DEAD-017 adoption instead of a deletion.
- **DEAD-008** — the dead set was *larger* than filed; only `.dark:bg-blue-900` is referenced.
- **DEAD-024** — the documented "pnpm strict isolation needs it" rationale was wrong, proven by
  bundling with `wrangler deploy --dry-run` rather than by argument.
- **DEAD-018** — the CLAUDE.md row justifying `discord-interactions` was wrong; the script it named
  imports only `dotenv/config`.
- **DEAD-012** — two of the four skipped tests were duplicates of tests that already existed.

### Cascades the removals exposed

- Deleting `dye-action-dropdown.ts` orphaned 17 `harmony.*` locale keys across six languages. The
  i18n orphan gate caught it immediately — the guardrail working exactly as intended.
- Deleting `tooltip-service.ts` orphaned a 77-line `.tooltip*` block in `globals.css` that the
  general dead-CSS scan could not see, because a dead module still counts as a consumer.
- `noUnusedLocals` (re-enabled by DEAD-032) caught two more: `LocaleDisplay`/`LOCALE_DISPLAY_INFO`
  in `language-service.ts`, and the `isFetching` field that led to the DEAD-005 reversal above.
- `turbo`'s `type-check` task does not take `tests/` as an input, so a test-only edit can pass a
  cached per-unit gate. One type error slipped through that way and was caught by the whole-graph
  `--force` run (`00a33fae`). **Run the graph gate before merging, not just the per-unit one.**

## Next steps

Every finding is closed in code. What remains is operational, and needs credentials this audit
should not spend unattended:

1. **DEAD-009 ops step (needs a human)** — three secrets are still set on the deployed presets-api:
   `MODERATION_WEBHOOK_URL`, `OWNER_DISCORD_ID`, `DISCORD_BOT_TOKEN`. Their only reader is gone from
   the code, and all three are optional (`?:`) fields whose absence was already a no-op, so deletion
   is safe at any point; cleanest immediately after this branch merges and deploys:
   `wrangler secret delete <NAME> --env production` from `apps/presets-api`.
   The same §3 row also lists discord-worker `PRESET_API_SECRET` / `PERSPECTIVE_API_KEY` and
   presets-api `MODERATOR_CHANNEL_ID`, which predate this audit.
2. **DEAD-034 (time-gated)** — the KV rate-limiter fallbacks still want a week of clean production
   logs. Note the standing constraint: do not enable Workers Logs without re-checking the
   2026-08-29 security audit's FINDING-010/011 first.
3. **Guardrails not yet wired into CI** — Recommendations 1–3 (the test-only-module scan, the
   class-member survey, knip for the five ungated workers). Recommendation 4 landed as DEAD-032, and
   the turbo caching hole that cleanup exposed is fixed in `dafb5019`; Recommendation 8 (svg's
   `testTimeout`) is still open.
4. **DEAD-019 tail** — oauth and presets-api still carry `@deprecated` re-export blocks whose
   "removed in the next major version" promise predates their current majors.
