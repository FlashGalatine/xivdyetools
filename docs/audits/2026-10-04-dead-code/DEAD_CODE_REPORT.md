# Dead code — whole monorepo, as it will be after the 2026-10-04 batch merge (2026-10-04)

- **Branch/commit:** `preview/integration-2026-10-04@1e842b20`, a local branch that was never pushed. It is `main@8ecb878f` with the 13 open PRs (#223–#235) merged in; the exact heads are in [evidence/preview-branch.md](evidence/preview-branch.md).
- **Scope:** all 17 workspaces, plus root `scripts/`, CI workflows and root configuration. **Depth:** standard. **No source file was modified by the audit.**
- **Method:**
  1. The full gate, the repo's dead-code, knip, i18n and docs checks, `tsc --noUnusedLocals` on every unit, and a `wrangler --dry-run` bundle baseline for each of the 7 workers.
  2. Twelve per-unit reviewers ran the symbol, class-member, orphan-file, dead-path, stale-test, CSS, asset, dependency and delta sweeps.
  3. An adversarial verifier checked every candidate at `file:line`, tagged its origin (already on `main`, or introduced by an open PR) and measured its lines.
  4. A completeness critic found 8 gaps; a second round of sweeps and verification closed them.
  5. 111 verdicts in all: 81 confirmed, 30 rejected. Duplicates were merged into the 64 findings below, and each overlapping deletion was given a single owner.
  6. A final adversarial pass ([evidence/final-check.json](evidence/final-check.json)):
     - twelve skeptics each tried to refute one of the largest removals; none was refuted, and their fix-step corrections are folded into the findings;
     - a consistency check of these documents;
     - a re-check of the merge-batch claims.
- **Totals:** **64 findings**:
  - **46 cleanup entries:** 1,554 source lines and 2,217 dedicated test lines.
  - **18 KEEP:** 14 of them are published package API, which only a planned major release can remove.
  - **By origin:** **2 were introduced by open PRs** (DEAD-001 by #225, DEAD-002 by #227); 62 are already on `main`.
- **Act now (before the batch merge), both done 2026-10-04:**
  - **DEAD-001:** fixed inside PR #225 (`ea264d49`).
  - **The failing moderation-worker test** caused by PR #224: fixed in #224 (`10a1cb77`). It is a merge-batch blocker, not a dead-code finding; see below.
  - DEAD-002 is optional.

## Merge-batch results (read before merging)

The preview branch is what `main` will be after tomorrow's merges, so its checks are a trial run of the batch.

- **Merge conflicts:** only in `README.md` / `docs/versions.md` version rows and the root `CHANGELOG-laymans.md`; none in code. The real merges will hit the same ones; keep every version bump and keep the laymans entries newest first.
- **Lockfile:** `pnpm install --frozen-lockfile` passes.
- **Checks:** all pass except one: **61 of 62 turbo tasks pass**, and 62 of 62 once the #224 fix below is in. Also green: `dead-code:check`, `workers:check-logs` (so #233's new check goes green once the six pin PRs are in), `test:scripts`, `type-check:scripts` and both docs gates.
- **Blocker — PR #224 breaks a moderation-worker test.**
  - **What happens:** `apps/moderation-worker/tests/moderation-stats-contract.test.ts:57` reads presets-api's `moderation.ts` as text. It collects `as <alias>` words from the file's first `SELECT` up to `as actions_last_week`. #224's new comment at `apps/presets-api/src/handlers/moderation.ts:390`, "same shape as the revert route above", adds the alias `the`.
  - **Why CI missed it:** CI runs only the affected workspaces. moderation-worker is not a package dependent of presets-api, so neither PR's own CI runs this pairing.
  - **Fix:** reword the comment in #224. **Done 2026-10-04 in `10a1cb77`:** the comment now reads "mirrors the revert route above".
  - **Re-check:** the full gate on the preview with both fixes merged is in [evidence/gates-after-pr-fixes.txt](evidence/gates-after-pr-fixes.txt).
  - **Optional:** anchor the test to the stats statement in #225, so a future comment cannot break it.
- **DEAD-001 (PR #225):** five moderation-worker strings lost their last reader in #225's button rewrite. **Deleted in #225 on 2026-10-04 (`ea264d49`).**
- **DEAD-002 (PR #227):** the `author_discord_id` field on `ModerationPresetInfo` is no longer read.
  - #227 kept it deliberately, and its test fixture relies on it, so removing it is optional.
  - If it goes, reshape the fixture so the "ID not rendered" assertion keeps its meaning.

## Catalog

| ID | Title | Conf | Blast | Semver | Deploy unit | Origin | Rec |
|---|---|---|---|---|---|---|---|
| [DEAD-001](findings/DEAD-001.md) | preset.moderation.{approved,approvedDesc,missingReason,rejected,rejectedDesc} in moderation-worker bot-i18n.ts are orphaned by PR #225 — 5 lines, 0 test lines | HIGH | LOW | NONE | apps/moderation-worker | PR-#225 | REMOVE |
| [DEAD-002](findings/DEAD-002.md) | ModerationPresetInfo.author_discord_id in preset-notifications.ts is unread since #227: 2 lines; fixture must be reshaped, not deleted | HIGH | NONE | NONE | apps/discord-worker | PR-#227 | REMOVE WITH CAUTION |
| [DEAD-003](findings/DEAD-003.md) | 6 legacy ContextAction members in result-card.ts and their handler cases in 5 tools are never emitted (~102 src lines + 126-line guard test) | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE WITH CAUTION |
| [DEAD-004](findings/DEAD-004.md) | v4-layout-shell.ts static styles: pre-5.0 Accessibility CSS block is unreachable (337 lines) | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-005](findings/DEAD-005.md) | BaseLitComponent.baseStyles utility classes and two preset-detail selectors have no markup (~31 lines) | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-006](findings/DEAD-006.md) | themes.css dead Tailwind-override selectors (lines 153-224) — 23 lines | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-007](findings/DEAD-007.md) | 5 orphan accessibility.* locale keys x 6 locales hidden by the analyzer's dynamic-prefix rule (30 lines) | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-008](findings/DEAD-008.md) | empty-state.ts: 6 of the 7 EMPTY_STATE_PRESETS factories are test-only — 54 source + 53 test lines | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE WITH CAUTION |
| [DEAD-009](findings/DEAD-009.md) | 4 state icons in state-icons.ts are reachable only from the 6 test-only EMPTY_STATE_PRESETS: 33 lines + 4 import lines | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE WITH CAUTION |
| [DEAD-010](findings/DEAD-010.md) | 14 web-app locale keys x 6 locales are read only by the test-only empty-state presets: 24 lines per locale, 144 total | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-011](findings/DEAD-011.md) | BaseLitComponent hasError/errorMessage @state is write-only (10 lines) | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-012](findings/DEAD-012.md) | HybridPresetService: 5 public methods with no caller and no test, about 49 lines including blanks | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-013](findings/DEAD-013.md) | getFeaturedPresets: HybridPresetService's has no caller and CommunityPresetService's is test-only — 33 source + 31 test lines | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-014](findings/DEAD-014.md) | getPresets 'community' guard in hybrid-preset-service.ts is unreachable — 19 lines | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-015](findings/DEAD-015.md) | getRemainingSubmissions in preset-submission-service.ts has no caller or test — 41 lines | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-016](findings/DEAD-016.md) | web-app: the msw mocks for /presets/featured and /presets/rate-limit and the e2e /featured route only serve removed methods — 34 test lines | HIGH | NONE | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-017](findings/DEAD-017.md) | WorldService: 6 test-only lookup methods + orphaned worldByName map — 57 src lines + ~100 test lines | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-018](findings/DEAD-018.md) | IndexedDBService.getAll/count/deleteDatabase are test-only — 100 src lines + ~200 test lines | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-019](findings/DEAD-019.md) | SubscriptionManager.addAll and getters count/hasSubscriptions have no caller or test — 21 lines | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-020](findings/DEAD-020.md) | APIService static formatPrice/getPriceData/isInitialized are test-only — 25 src lines + 72 test lines | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-021](findings/DEAD-021.md) | color-service.test.ts tests @xivdyetools/core ColorService, not web-app code — 280 test lines | HIGH | NONE | NONE | apps/web-app | MAIN | REMOVE WITH CAUTION |
| [DEAD-022](findings/DEAD-022.md) | shared/__tests__/types.test.ts tests @xivdyetools/types, not web-app — 361 test lines | HIGH | NONE | NONE | apps/web-app | MAIN | REMOVE WITH CAUTION |
| [DEAD-023](findings/DEAD-023.md) | web-app LanguageService.getLabel and preloadLocales are test-only — 17 source + 43 test lines | HIGH | LOW | NONE | apps/web-app | MAIN | REMOVE |
| [DEAD-024](findings/DEAD-024.md) | CommandRegistryEntry.deprecated in registry.ts is never set or read in production: 2 lines + 3-line test | HIGH | NONE | NONE | apps/discord-worker | MAIN | REMOVE |
| [DEAD-025](findings/DEAD-025.md) | rateLimitMiddleware in moderation-worker rate-limit.ts is a never-mounted no-op reached only by its test — 25 source + 13 test lines | HIGH | LOW | NONE | apps/moderation-worker | MAIN | REMOVE |
| [DEAD-026](findings/DEAD-026.md) | getPreset in moderation-worker services/preset-api.ts is test-only: 13 src lines + 34 test lines | HIGH | LOW | NONE | apps/moderation-worker | MAIN | REMOVE |
| [DEAD-027](findings/DEAD-027.md) | Translator.t() fallbackData branch in moderation-worker bot-i18n.ts is a no-op (data === fallbackData === strings): about 8 lines; getLocale is NOT included and stays as an observation hook | HIGH | LOW | NONE | apps/moderation-worker | MAIN | REMOVE |
| [DEAD-028](findings/DEAD-028.md) | Unused _maxRetries parameter of incrementRateLimit in rate-limit.ts; its @param falsely says it is passed to the shared package: 2 src lines + 4 call-site edits | HIGH | LOW | NONE | apps/moderation-worker | MAIN | REMOVE |
| [DEAD-029](findings/DEAD-029.md) | Legacy base64-username suffix parsing in ban-reason.ts:57-92 and ban-confirmation.ts:70-78 is unreachable: no emitter has produced the suffix since the 2026-08-21 FINDING-007 fix, and those flows are ephemeral — about 16 source lines, with a test-fixture rewrite | MEDIUM | LOW | NONE | apps/moderation-worker | MAIN | REMOVE WITH CAUTION |
| [DEAD-030](findings/DEAD-030.md) | moderation-worker bot-i18n.ts: older orphan strings (preset.categories.*, three ban.* keys, the meta block, common.success) — 24 source + 12 test lines | HIGH | LOW | NONE | apps/moderation-worker | MAIN | REMOVE |
| [DEAD-031](findings/DEAD-031.md) | successResponse + ApiSuccessResponse in presets-api api-response.ts are test-only: 31 src lines + 31 test lines | HIGH | LOW | NONE | apps/presets-api | MAIN | REMOVE |
| [DEAD-032](findings/DEAD-032.md) | ErrorCode.BAD_REQUEST and ErrorCode.DATABASE_ERROR in presets-api api-response.ts are never read: 2 lines | HIGH | NONE | NONE | apps/presets-api | MAIN | REFACTOR FIRST |
| [DEAD-033](findings/DEAD-033.md) | PresetCategory/AuthSource re-exports in presets-api types.ts are test-only: 6 src lines + 33 test lines | HIGH | NONE | NONE | apps/presets-api | MAIN | REMOVE |
| [DEAD-034](findings/DEAD-034.md) | Stale 'community' ternary in presets-api scripts/migrate-presets.ts is a never-taken branch: 1 line | HIGH | LOW | NONE | apps/presets-api | MAIN | REMOVE |
| [DEAD-035](findings/DEAD-035.md) | createMockKV re-export in api-worker tests/test-utils.ts has no importer — 1 line | HIGH | NONE | NONE | apps/api-worker | MAIN | REMOVE |
| [DEAD-036](findings/DEAD-036.md) | decodeJWT wrapper in apps/oauth jwt-service.ts is test-only: 8 src lines + 31-line describe block | HIGH | LOW | NONE | apps/oauth | MAIN | REMOVE WITH CAUTION |
| [DEAD-037](findings/DEAD-037.md) | apps/oauth vitest.config.ts coverage.exclude names nonexistent rate-limit-do.ts / durable-objects: 3 config lines | HIGH | NONE | NONE | apps/oauth | MAIN | REMOVE |
| [DEAD-038](findings/DEAD-038.md) | apps/image-worker '@' path alias (vitest resolve.alias + tsconfig paths) has no importer: 10 config lines | HIGH | NONE | NONE | apps/image-worker | MAIN | REMOVE |
| [DEAD-039](findings/DEAD-039.md) | CrawlerInfo.userAgent in apps/og-worker/src/types.ts is written but never read since the crawler log was minimized: 4 src lines + 11 test lines | HIGH | LOW | NONE | apps/og-worker | MAIN | REMOVE |
| [DEAD-040](findings/DEAD-040.md) | Unused '@' path alias in apps/og-worker vitest.config.ts and tsconfig.json: 10 config lines | HIGH | LOW | NONE | apps/og-worker | MAIN | REMOVE |
| [DEAD-041](findings/DEAD-041.md) | test-utils integration/ suite only tests local re-implementations of presets-api auth: setup.ts 214 lines + 581 test lines | HIGH | NONE | NONE | packages/test-utils | MAIN | REMOVE WITH CAUTION |
| [DEAD-042](findings/DEAD-042.md) | createMockD1 in test-utils cloudflare/d1.ts is reached only by its own unit test: 22 src lines + 18 test lines | HIGH | NONE | NONE | packages/test-utils | MAIN | REMOVE |
| [DEAD-043](findings/DEAD-043.md) | randomStainId in test-utils factories/dye.ts is test-only — 9 lines + 6-line test | HIGH | NONE | NONE | packages/test-utils | MAIN | REMOVE |
| [DEAD-044](findings/DEAD-044.md) | test-utils './auth' exports-map subpath has zero importers — 4 config lines | HIGH | NONE | NONE | packages/test-utils | MAIN | REMOVE WITH CAUTION |
| [DEAD-045](findings/DEAD-045.md) | The qs override in pnpm-workspace.yaml:11 names a package nothing installs: 1 line, plus the comment on line 7 and lockfile line 10 | HIGH | MEDIUM | NONE | root (CI/scripts) | MAIN | REMOVE WITH CAUTION |
| [DEAD-046](findings/DEAD-046.md) | The turbo.json `deploy` task (lines 130-134) has no caller: 5 lines | HIGH | LOW | NONE | root (CI/scripts) | MAIN | REMOVE |
| [DEAD-047](findings/DEAD-047.md) | HarmonyGenerator find*Dyes family + 8 DyeService delegates + DyeDatabase hue-bucket index are test-only: ~660 src lines + ~1080 test lines | HIGH | HIGH | MAJOR | packages/core | MAIN | KEEP |
| [DEAD-048](findings/DEAD-048.md) | ColorManipulator (whole class) + 6 ColorService delegates + 3 ColorAccessibility methods/delegates are test-only: ~170 src lines + ~600 test lines | HIGH | HIGH | MAJOR | packages/core | MAIN | KEEP |
| [DEAD-049](findings/DEAD-049.md) | core: getToolName and getLabel, with the `tools`/`labels` locale sections, have no consumer outside core's tests — about 257 source + 100 test lines | HIGH | HIGH | MAJOR | packages/core | MAIN | KEEP |
| [DEAD-050](findings/DEAD-050.md) | types: ToolKey and LocaleData.tools outlive core's getToolName — 13 source lines, for the types major after DEAD-049 | HIGH | HIGH | MAJOR | packages/types | MAIN | KEEP |
| [DEAD-051](findings/DEAD-051.md) | core LocalizationService.setLocaleFromPreference and preloadLocales are test-only published API — 52 source + 60 test lines | HIGH | HIGH | MAJOR | packages/core | MAIN | KEEP |
| [DEAD-052](findings/DEAD-052.md) | PresetService.getPresetWithDyes in core is test-only published API — 34 lines + 145-line test | HIGH | HIGH | MAJOR | packages/core | MAIN | KEEP |
| [DEAD-053](findings/DEAD-053.md) | HarmonyInput.harmonyOptions in bot-logic harmony.ts is ignored legacy published API — 2 lines + 11-line stale test | HIGH | HIGH | MAJOR | packages/bot-logic | MAIN | KEEP |
| [DEAD-054](findings/DEAD-054.md) | UpstashRateLimiter in worker-kit has no in-repo constructor (only its own test) but is @public published API: ~206 src lines + 344-line test | HIGH | HIGH | MAJOR | packages/worker-kit | MAIN | KEEP |
| [DEAD-055](findings/DEAD-055.md) | getClientIp trustXForwardedFor opt-in path is test-only in-repo — 26 src lines + 60 test lines; stale comments | HIGH | HIGH | MAJOR | packages/worker-kit | MAIN | KEEP |
| [DEAD-056](findings/DEAD-056.md) | logger BaseLogger.child() and the DelegatingLogger class have no non-test caller anywhere: 79 src lines + ~128 test lines | HIGH | HIGH | MAJOR | packages/logger | MAIN | KEEP |
| [DEAD-057](findings/DEAD-057.md) | logger createBrowserLogger's errorTracker branch never runs in-repo (published extension point): ~90 src lines + 207 test lines | HIGH | HIGH | MAJOR | packages/logger | MAIN | KEEP |
| [DEAD-058](findings/DEAD-058.md) | types createDyeId/createHue/createSaturation are untagged published exports reached only by tests: 68 src lines + ~200 test lines | HIGH | HIGH | MAJOR | packages/types | MAIN | KEEP |
| [DEAD-059](findings/DEAD-059.md) | auth verifier tuning options never passed by any app — ~27 src lines + 74 test lines (bot-signature knobs untested) | HIGH | HIGH | MAJOR | packages/auth | MAIN | KEEP |
| [DEAD-060](findings/DEAD-060.md) | auth barrel re-export of hmacSignHex is test-only in-repo and lacks @public — 1 line | HIGH | HIGH | MAJOR | packages/auth | MAIN | KEEP |
| [DEAD-061](findings/DEAD-061.md) | registryCommandNames in registry.ts is test-only: 10 lines (62-71), 3 test lines to rewrite | HIGH | NONE | NONE | apps/discord-worker | MAIN | KEEP |
| [DEAD-062](findings/DEAD-062.md) | handleModal and the unsupportedComponent fallback in index.ts are unreachable defensive router branches: 24 lines + 12 locale lines + 59 test lines | MEDIUM | MEDIUM | NONE | apps/discord-worker | MAIN | KEEP |
| [DEAD-063](findings/DEAD-063.md) | presets-api GET /presets/featured and /presets/rate-limit have no in-repo client once the dead web-app methods go; documented public API, so KEEP (~35 route lines) | MEDIUM | HIGH | NONE | apps/presets-api | MAIN | KEEP |
| [DEAD-064](findings/DEAD-064.md) | stoat-worker: five more parked-feature leftovers (MessageContextStore.get/delete/size, isAuthorized, the Upstash config fields, HELP_TOPICS, two StoatMessage fields) — 54 source + 106 test lines | HIGH | LOW | NONE | apps/stoat-worker | MAIN | KEEP |

### Cleanup by unit

| Deploy unit | Entries | Source lines | Test lines |
|---|---:|---:|---:|
| apps/web-app | 21 | 1126 | 1300 |
| packages/test-utils | 4 | 249 | 605 |
| apps/moderation-worker | 7 | 93 | 202 |
| apps/presets-api | 4 | 40 | 64 |
| apps/og-worker | 2 | 14 | 11 |
| apps/oauth | 2 | 11 | 31 |
| apps/image-worker | 1 | 10 | 0 |
| root (CI/scripts) | 2 | 6 | 0 |
| apps/discord-worker | 2 | 4 | 4 |
| apps/api-worker | 1 | 1 | 0 |

Line counts were measured by the verifiers, who opened the files. Bundle savings will be smaller than the source lines:
- types and tests erase;
- the CSS in DEAD-004–006 ships in the web-app bundle;
- the locale keys in DEAD-007/010 ship in all six locale files.

## Quick wins

HIGH confidence, NONE/LOW blast, REMOVE, and not part of a cascade: DEAD-001, DEAD-004, DEAD-005, DEAD-006, DEAD-007, DEAD-011, DEAD-012, DEAD-013, DEAD-014, DEAD-015, DEAD-017, DEAD-018, DEAD-019, DEAD-020, DEAD-023, DEAD-024, DEAD-025, DEAD-026, DEAD-027, DEAD-028, DEAD-030, DEAD-031, DEAD-033, DEAD-034, DEAD-035, DEAD-037, DEAD-038, DEAD-039, DEAD-040, DEAD-042, DEAD-043, DEAD-046.

- **The largest:**
  - **DEAD-004:** 337 lines of shadow-root CSS left over from the pre-5.0 Accessibility tool.
  - **DEAD-018:** IndexedDBService getAll/count/deleteDatabase, 100 source + 200 test lines.
  - **DEAD-017:** WorldService lookups, 57 + 100.
- **Cascades:** DEAD-009/010 (after DEAD-008) and DEAD-016 (after DEAD-013/015) are separate commits in the same pull request as their trigger. Web-app's knip gate fails on the orphaned icon exports, so it cannot be green between DEAD-008 and DEAD-009. DEAD-050 (types) follows DEAD-049 (core) in a later major.
- **Needs care, REMOVE WITH CAUTION:**
  - DEAD-003, the context-action vocabulary across 5 tools;
  - DEAD-021/022, whole stale test files;
  - DEAD-029, old ban custom_id parsing;
  - DEAD-036 (`decodeJWT`);
  - DEAD-041, the test-utils integration suite (795 lines);
  - DEAD-044;
  - DEAD-045, the `qs` override, whose lockfile must be regenerated in the same commit.

## KEEP register

| ID | Item | Reason and revisit trigger |
|---|---|---|
| [DEAD-047](findings/DEAD-047.md) | HarmonyGenerator find*Dyes family + 8 DyeService delegates + DyeDatabase hue-bucket index are test-only: ~660 src lines + ~1080 test lines | This is published DyeService API in core 5.8.0 (npm view = 5.8.0), and HarmonyGenerator.ts:33-39 documents it as kept on purpose. Revisit trigger: the next core major (same class as 2026-09-15-dead-code/DEAD-018). Until then, consider @deprecated on the 8 DyeService methods in a core minor. Note: dead-code:check cannot see this family because the facade delegate calls share the method names. |
| [DEAD-048](findings/DEAD-048.md) | ColorManipulator (whole class) + 6 ColorService delegates + 3 ColorAccessibility methods/delegates are test-only: ~170 src lines + ~600 test lines | These are published ColorService static API and are listed in the core CLAUDE.md public API. Revisit trigger: the next core major (fold into the 2026-09-15-dead-code/DEAD-018 class). ColorManipulator.invert stays live while the DEAD-047 family exists, so ColorManipulator can only be deleted with or after DEAD-047. |
| [DEAD-049](findings/DEAD-049.md) | core: getToolName and getLabel, with the `tools`/`labels` locale sections, have no consumer outside core's tests — about 257 source + 100 test lines | Already @deprecated I18N-003 with removal at a core major. The trigger (next core major, plus a types major for ToolKey/LocaleData.tools) is not met. TranslationProvider.getToolName (:340-354) is not deprecated, and its docblock still claims og-worker uses it. Add @deprecated there in the next core minor. |
| [DEAD-050](findings/DEAD-050.md) | types: ToolKey and LocaleData.tools outlive core's getToolName — 13 source lines, for the types major after DEAD-049 | Published API: types 3.2.0 and core 5.8.0 (= npm) both ship it; already @deprecated with 'removal is a core major'. Revisit at next core + types major (same trigger as 2026-09-15-dead-code/DEAD-018). Note gate blind spot: renaming og-worker's local getToolName would surface these as test-only. |
| [DEAD-051](findings/DEAD-051.md) | core LocalizationService.setLocaleFromPreference and preloadLocales are test-only published API — 52 source + 60 test lines | Published core API (`.` exports to dist/index.js, and the barrel exports LocalizationService). Revisit trigger: the next core major (2026-09-15-dead-code/DEAD-018 family). Until then, tag both methods `@public`, as getAvailableLocales already is, so the KEEP is explicit and no longer hidden by the self-reference. Removal cascades: resolveLocaleFromPreference (core barrel :20) loses its only production caller, and LocalePreference (packages/types) loses its last use. |
| [DEAD-052](findings/DEAD-052.md) | PresetService.getPresetWithDyes in core is test-only published API — 34 lines + 145-line test | Published core API (barrel index.ts:27, and CHANGELOG 689 documents the contract). Revisit trigger: the next core major (2026-09-15-dead-code/DEAD-018 family). Tag it `@public` now. On removal, ResolvedPreset (the @public type at index.ts:28) loses its only producer. IDyeService stays because searchPresets at :176 uses it. |
| [DEAD-053](findings/DEAD-053.md) | HarmonyInput.harmonyOptions in bot-logic harmony.ts is ignored legacy published API — 2 lines + 11-line stale test | Published API (HarmonyInput is @public at index.ts:58, and the field exists in npm 4.5.0). Revisit at the next bot-logic major, the same shape as 2026-09-15-dead-code/DEAD-018. Now, with semver NONE: rename harmony.test.ts:377 to 'accepts deprecated harmonyOptions without error'. That keeps the type-compat coverage and drops the false claim. |
| [DEAD-054](findings/DEAD-054.md) | UpstashRateLimiter in worker-kit has no in-repo constructor (only its own test) but is @public published API: ~206 src lines + 344-line test | Published @public backend (npm 1.4.1). Revisit trigger: the next worker-kit major (2.0.0). Retire the backend, its options type, the ./rate-limiter/upstash subpath and the @upstash/redis dependency together then. This is not 2026-09-15-dead-code/DEAD-020: it is not a fallback, and no selector picks it. |
| [DEAD-055](findings/DEAD-055.md) | getClientIp trustXForwardedFor opt-in path is test-only in-repo — 26 src lines + 60 test lines; stale comments | Published security opt-in; GetClientIpOptions is explicitly /** @public */ at rate-limiter/index.ts:82; worker-kit 1.4.1 = npm. Revisit at next worker-kit major. Fix the stale docs now (comment-only, no semver). |
| [DEAD-056](findings/DEAD-056.md) | logger BaseLogger.child() and the DelegatingLogger class have no non-test caller anywhere: 79 src lines + ~128 test lines | Part of the published ExtendedLogger contract (types.ts:120-135), shipped in npm 2.2.1. Revisit trigger: the next logger major, where child() could leave the interface. Do not remove DelegatingLogger on its own, because child() constructs it. |
| [DEAD-057](findings/DEAD-057.md) | logger createBrowserLogger's errorTracker branch never runs in-repo (published extension point): ~90 src lines + 207 test lines | A documented, published extension point (Sentry integration; @public createBrowserLogger, exported ErrorTracker type), and it carries BUG-026/FINDING-026 redaction. Revisit trigger: the next logger major, or a decision that no consumer will ever wire an error tracker. |
| [DEAD-058](findings/DEAD-058.md) | types createDyeId/createHue/createSaturation are untagged published exports reached only by tests: 68 src lines + ~200 test lines | Published API in README:287-289. Revisit trigger: the next types major. Meanwhile, tag them explicitly so the exemption is documented. |
| [DEAD-059](findings/DEAD-059.md) | auth verifier tuning options never passed by any app — ~27 src lines + 74 test lines (bot-signature knobs untested) | Published API in auth 2.0.2 (= npm; present at ef555e57), types re-exported from index.ts:79/:97. Revisit at next auth major; consider adding a verifyBotSignatureV2 test that passes maxAgeMs/clockSkewMs rather than removing. |
| [DEAD-060](findings/DEAD-060.md) | auth barrel re-export of hmacSignHex is test-only in-repo and lacks @public — 1 line | Published in auth 2.0.2 (= npm; ef555e57 index.ts:65) and also reachable via ./hmac subpath. Add /** @public */ to index.ts:65 now: otherwise auth lint:dead (includeEntryExports) goes red the moment the presets-api test stops importing it. Revisit at next auth major. |
| [DEAD-061](findings/DEAD-061.md) | registryCommandNames in registry.ts is test-only: 10 lines (62-71), 3 test lines to rewrite | The owner kept it on purpose in 2026-08-18-discord-worker-dead-code/DEAD-004 (CHANGELOG.md:750, 'kept (legitimate test hooks)'), and the dead-code gate lists it as @testonly-exempt. Revisit trigger: the owner reverses that decision. Removing it is then a zero-risk 10-line change. |
| [DEAD-062](findings/DEAD-062.md) | handleModal and the unsupportedComponent fallback in index.ts are unreachable defensive router branches: 24 lines + 12 locale lines + 59 test lines | Confidence is MEDIUM because Discord, not this repo, sends the payloads, and pre-monorepo messages that might carry select menus cannot be checked. Removing the branches turns a polite ephemeral reply into a 400. The fallback cannot simply be deleted because handleComponent must return something, and the two locale keys live in the published bot-logic package. Revisit if the router is restructured. |
| [DEAD-063](findings/DEAD-063.md) | presets-api GET /presets/featured and /presets/rate-limit have no in-repo client once the dead web-app methods go; documented public API, so KEEP (~35 route lines) | Revisit trigger: an explicit presets-api API deprecation decision (a v2 or major contract change) that updates api-contracts.md, endpoints.md, overview.md, the README, CLAUDE.md and community-presets.md, and/or Workers analytics showing zero external traffic. /rate-limit is the weaker keep: it needs a user JWT, and POST / already returns remaining_submissions (:1120). Separately, README.md:16 says 'Curated' but CLAUDE.md:223 says there is no is_curated filter. That is a doc fix, not dead code. |
| [DEAD-064](findings/DEAD-064.md) | stoat-worker: five more parked-feature leftovers (MessageContextStore.get/delete/size, isAuthorized, the Upstash config fields, HELP_TOPICS, two StoatMessage fields) — 54 source + 106 test lines | The app is parked, so these join the 2026-09-15-dead-code/DEAD-019 entry. Revisit trigger: Stoat is resumed or retired (docs/research/discord-alternatives/07-2026-10-refresh.md recommends parking or archiving it). On retirement the whole app goes; on resumption each item is re-judged against the new command set. HELP_TOPICS needs a refactor first, since help.ts builds its text inline. |

**Packages:** fourteen of the KEEP entries (DEAD-047–060) are exports of published packages with no in-repo caller.

- **Why not now:** "Unused in this repo" does not mean unused on npm, so removing any of them is a MAJOR release.
- **When:** gather them into the next major of each package, one publish sprint per package and then its consumers, instead of a release per item.
- **core is the largest group:** DEAD-047, DEAD-048, DEAD-049, DEAD-051, DEAD-052, about 1,173 source lines.

**The prior register (2026-09-15):**
- 2026-09-15-dead-code/DEAD-019, DEAD-020 and DEAD-021 still hold; no trigger is met.
- 2026-09-15-dead-code/DEAD-020 grew: PR #229 adds another native-binding selector with a KV fallback (api-worker's Universalis proxy).
- **Correction to 2026-09-15-dead-code/DEAD-018:** `getSharedColors` and `getRaceSpecificColors` are **live**. og-worker's `src/services/character-cells.ts:66,68` calls them in production, and has since commit `35914823`. Only the rest of that entry (both `getAvailableLocales`, `hexToRyb`/`rybToHex`) is still published API without a caller.

## Dependency cleanup

- No unused dependency in any workspace:
  - knip is clean;
  - every reviewer checked config-only use;
  - `wrangler` in web-app stays as the documented pin.
- **DEAD-045:** the `qs` floor in `pnpm-workspace.yaml` overrides a package nothing installs any more. It arrived with the retired `apps/api-docs` VitePress chain.
- **DEAD-054:** `@upstash/redis` would leave worker-kit with `UpstashRateLimiter` at worker-kit's next major.
- The other overrides (rollup, seroval, vitepress>vite, tsup>esbuild, miniflare>undici) all still resolve.

## Evidence and baseline

| Check | Result |
|---|---|
| `pnpm turbo run build type-check lint test --continue --concurrency=2` | 61/62 tasks; the one failure is the #224 blocker above ([gates-before.txt](evidence/gates-before.txt)) |
| The same gate after the two Sprint 0 fixes were merged into the preview | **62/62 tasks** ([gates-after-pr-fixes.txt](evidence/gates-after-pr-fixes.txt)) |
| `pnpm dead-code:check` | exit 0; 597 production / 550 test files; 26 test-only, 6 entrypoint, 7 public exemptions (2026-09-15: 34 / 4 / 7) |
| Root knip | exactly the 3 documented web-app items |
| web-app knip; og-worker knip and `knip --production` | exit 0, no findings |
| `tsc --noEmit --noUnusedLocals --noUnusedParameters`, all 17 units | exit 0 everywhere, no hits |
| web-app locale-key analyzer | 1,195 / 1,195 keys used. It counts DEAD-007's and DEAD-010's keys as used because of dynamic prefixes (`accessibility.${key}`) or test-only readers |
| bot-logic i18n tests | 98 tests, 5 files, pass |
| Skipped/focused tests | none; the 3 matches are comments |
| `workers:check-logs`, `test:scripts` (133), `type-check:scripts`, `docs:check-versions`, `docs:check-links` (957 links) | all exit 0 |

### Bundle before (KiB, default environment, `wrangler deploy --dry-run`)

| Worker | Raw 2026-09-15 | Gzip 2026-09-15 | Raw now | Gzip now |
|---|---:|---:|---:|---:|
| api-worker | 3854.87 | 577.39 | 5237.38 | 706.38 |
| discord-worker | 7448.58 | 2282.85 | 7977.20 | 2362.86 |
| image-worker | 1666.45 | 645.50 | 1666.82 | 645.58 |
| moderation-worker | 220.64 | 51.50 | 234.93 | 55.61 |
| oauth | 159.27 | 41.19 | 160.91 | 41.67 |
| og-worker | 6393.90 | 1944.43 | 6409.02 | 1947.47 |
| presets-api | 215.94 | 53.48 | 231.57 | 57.53 |

- **Where the bundles are:** the dry-run output directories are kept locally only, as in the earlier audits; the `evidence/bundle-*.log` files hold the sizes.
- **Growth since 2026-09-15:** most of it is feature work (the Glamour Reader, `.chara` and api-worker's character endpoints), not dead code.

## Positive controls

- **Earlier cleanups stayed gone:** every 2026-09-15 cleanup is still absent; for example, og-worker's `getCrawlerName`, discord-worker's `getPreference` and the v1 request signature. Anything `DEPRECATIONS.md` retires is absent from source.
- **PR leftovers are clean:**
  - #229: the old per-isolate `MemoryRateLimiter` path in api-worker is fully gone, with no class, reset hook, mock or import left.
  - #228: the retired OAuth origin is gone; only guard comments and negative assertions remain.
  - #234: `sanitizeEcho` orphaned nothing.
  - #227: removing `/stats preferences` left no handler, schema entry or locale key behind.
- **#225 has a single custom_id parser:** `parseReviewCustomId`, shared by the buttons and both modals. The command and the refresh path share one embed builder (`review-message.ts`).
- **#224's retention cron is wired:** `runRetentionJob` → `scheduled()` → `Object.assign(app, { scheduled })`, on the production-only cron, and tested.
- **Workers config:** every worker's `Env` fields and `wrangler.toml` vars and bindings have a production reader, and no field is read without being declared.
- **web-app assets and helpers:** all 25 `public/` files and all `e2e/fixtures` exports have consumers. The VitePress helpers are consumed by `.vue` components.
- **root and CI:** `scripts/check-worker-logs.ts` (#233) carries a reasoned `@entrypoint` tag and is wired into `ci.yml:274`. Every workflow path filter and script reference resolves.
- **After #229, worker-kit backends:** every backend except `UpstashRateLimiter` is still constructed by an app (Cloudflare ×5, KV ×4, Memory ×2 as fallbacks).

## Rejected suspicions and corrections

Every rejection is listed with its reason in [evidence/verdicts.tsv](evidence/verdicts.tsv) (30 rows). The ones most likely to be re-chased:

- **Kept because live data still needs them:**
  - The legacy `v3_mixer_*` storage migration in gradient-tool runs on every load with an empty selection, and reads real persisted data. Retiring it is a retention decision, not dead code.
  - discord-worker's legacy preference keys and `previewimg_approve_<id>` branch: old Discord messages and stored v1 blobs still reach them.
- **Old-shape moderation buttons are still sent:** moderation-worker's legacy `preset_<kind>_<uuid>` handling is live, because discord-worker still emits that id.
  - `/preset submit` and `/preset edit` post their own moderation embed (`notifyModerationChannel` / `notifyEditModerationChannel`, `apps/discord-worker/src/handlers/commands/preset.ts:576` and `:924`). It carries no revision, because presets-api's direct responses do not include one.
  - presets-api also sends its webhook for those same submissions and edits. It has no source filter (`apps/presets-api/src/handlers/presets.ts:846-878`, `:1068-1090`). discord-worker posts a second, revision-bound embed from it (`src/index.ts:402-409`).
  - **A pending submission made through the bot therefore produces two moderation posts.** That is already true on `main`; PR #227 did not introduce it.
  - It is a behaviour issue for a follow-up, not dead code. The likely fix is to drop the duplicate direct post rather than to add a revision to it.
- **presets-api's legacy dead-letter shape** (`listFailedNotifications`) stays live until migration 0015 has been applied in production.
  - Then it becomes a dead-code candidate.
  - Revisit trigger: 0015 confirmed applied, plus one retention period.
- **Reset/observation hooks over real state** were checked again and all stay:
  - `RequestCoalescer.isInFlight`/`getInFlightCount`, `resetCategoryCache`, the `_resetPatternsForTesting`/`_setTestPatterns` pair, `MemoryRateLimiter`'s size reader and `resetMockDyeSequence`;
  - the web-app read-back accessors (`BaseComponent.hasErrorState`, `DyeSearchBox.getSearchQuery`, …).
- **Exported only for their tests, with production callers in their own file:** og-worker band helpers, image-worker photon/validator helpers, the svg/bot-logic helpers and the core wheel/calibration helpers. Under `knip.jsonc`'s `ignoreExportsUsedInFile` policy, dropping the `export` keyword is churn, not dead code.
- **Not dead after all:**
  - `ErrorCode` members in types: web-app's `error-handler.ts` uses them as map keys.
  - `calibrateBandVocabulary`: the `calibrate:bands` script runs it.
  - oauth's re-exported types and `base64UrlDecode`: production consumers.
  - api-worker's `RATE_LIMIT_WINDOW_SECONDS` branch: it is a deploy var, so the branch is reachable through configuration.
  - presets-api's moderator-only stats route is documented, and moderators use it.
- **Correction:** the 2026-09-15-dead-code/DEAD-018 entry wrongly listed `getSharedColors`/`getRaceSpecificColors` as without callers (see the KEEP register above).

## Recommendations

1. **Run the whole-graph gate on a trial merge of every batch.** The #224 → moderation-worker failure was invisible to each PR's affected-only CI. A scheduled full `turbo run test` on `main`, or `strict` branch protection with a merge queue, would catch the next one.
2. **Anchor file-reading contract tests to a unique marker,** not "the first `SELECT`". `moderation-stats-contract.test.ts` is the example.
3. **Extend the moderation-worker i18n gate.** Its inline `bot-i18n.ts` table has no orphan-key check, which is how DEAD-001 and DEAD-030 accumulated. A key test like bot-logic's locale-quality gate would cover it.
4. **Tighten web-app's orphan analyzer.** A dynamic prefix like `accessibility.${key}` should not mark every key under the prefix as used (DEAD-007). Count only keys whose suffix the code can actually produce.
5. **Keep a running "next major" list per published package** (DEAD-047–060), so a planned major can clear it in one release.
6. **Re-check `@testonly` reasons each audit.** This run moved `test-utils/integration/setup.ts` from exempt to removable (DEAD-041) and confirmed the rest.

## Coverage and limits

- **What was covered:** all 17 workspaces plus root scripts, CI and configuration. The per-unit coverage counts and the commands run are in `evidence/review-*.md` and `evidence/review-gap-*.md`.
- **What a static survey cannot exclude:** dynamic and computed access, external npm consumers, and Discord payloads from messages sent long ago. Those are why DEAD-062 and DEAD-063 are KEEP, and why several entries are REMOVE WITH CAUTION.
- **Not performed:** browser or E2E runs, live traffic or log inspection, an npm download-count or consumer survey, or full git archaeology.
- **Where the line counts come from:** the verifiers' measurements; recount before each removal.

## Remediation status

| ID | Status | Commit |
|---|---|---|
| DEAD-001 | FIXED 2026-10-05 (PR #225) | `ea264d49` |
| DEAD-002 | FIXED 2026-10-05 (PR #227) | `d3bf312a` |
| DEAD-003 | OPEN | — |
| DEAD-004 | OPEN | — |
| DEAD-005 | OPEN | — |
| DEAD-006 | OPEN | — |
| DEAD-007 | OPEN | — |
| DEAD-008 | OPEN | — |
| DEAD-009 | OPEN | — |
| DEAD-010 | OPEN | — |
| DEAD-011 | OPEN | — |
| DEAD-012 | OPEN | — |
| DEAD-013 | OPEN | — |
| DEAD-014 | OPEN | — |
| DEAD-015 | OPEN | — |
| DEAD-016 | OPEN | — |
| DEAD-017 | OPEN | — |
| DEAD-018 | OPEN | — |
| DEAD-019 | OPEN | — |
| DEAD-020 | OPEN | — |
| DEAD-021 | OPEN | — |
| DEAD-022 | OPEN | — |
| DEAD-023 | OPEN | — |
| DEAD-024 | OPEN | — |
| DEAD-025 | OPEN | — |
| DEAD-026 | OPEN | — |
| DEAD-027 | OPEN | — |
| DEAD-028 | OPEN | — |
| DEAD-029 | OPEN | — |
| DEAD-030 | OPEN | — |
| DEAD-031 | OPEN | — |
| DEAD-032 | OPEN | — |
| DEAD-033 | OPEN | — |
| DEAD-034 | OPEN | — |
| DEAD-035 | OPEN | — |
| DEAD-036 | OPEN | — |
| DEAD-037 | OPEN | — |
| DEAD-038 | OPEN | — |
| DEAD-039 | OPEN | — |
| DEAD-040 | OPEN | — |
| DEAD-041 | OPEN | — |
| DEAD-042 | OPEN | — |
| DEAD-043 | OPEN | — |
| DEAD-044 | OPEN | — |
| DEAD-045 | OPEN | — |
| DEAD-046 | OPEN | — |
| DEAD-047 | KEEP | — |
| DEAD-048 | KEEP | — |
| DEAD-049 | KEEP | — |
| DEAD-050 | KEEP | — |
| DEAD-051 | KEEP | — |
| DEAD-052 | KEEP | — |
| DEAD-053 | KEEP | — |
| DEAD-054 | KEEP | — |
| DEAD-055 | KEEP | — |
| DEAD-056 | KEEP | — |
| DEAD-057 | KEEP | — |
| DEAD-058 | KEEP | — |
| DEAD-059 | KEEP | — |
| DEAD-060 | KEEP | — |
| DEAD-061 | KEEP | — |
| DEAD-062 | KEEP | — |
| DEAD-063 | KEEP | — |
| DEAD-064 | KEEP | — |

## Next steps

[CLEANUP_PLAN.md](CLEANUP_PLAN.md) orders the cleanup:
- **First:** the PR-origin item inside the open PR (DEAD-001), before the batch merge.
- **Then:** one sprint per deploy unit, after the batch merge, safest first.
- **Throughout:** cascades after their trigger, and MAJOR package removals held for each package's next planned major.

Nothing is removed until the maintainer approves the plan.
