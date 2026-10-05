# Cleanup Plan — 2026-10-04 dead-code audit

> [!NOTE]
> **Superseded on 2026-10-04 by the merged [REMEDIATION_PLAN.md](../2026-10-04-deep-dive/REMEDIATION_PLAN.md)** of the same day's deep-dive audit.
> - It schedules all 64 of these findings, with the same IDs, alongside the deep-dive's fixes: one sprint per unit, fixes before removals.
> - The sprint numbers below no longer apply; the findings and their steps are unchanged.

**Sources:** [DEAD_CODE_REPORT.md](DEAD_CODE_REPORT.md), 64 findings.

**Status basis:** 64 total:
- 0 fixed;
- 46 outstanding: 2 of them introduced by open PRs, 44 already on `main`;
- 0 superseded;
- 18 KEEP;
- 0 need rotation.

**Ordering:**
1. Fix the two PR-introduced items inside their open PRs, before the batch merge (Sprint 0).
2. One deploy unit per sprint after the batch merge.
3. Confidence × Blast: the safest first, so that the early sprints prove the gates catch breakage (test-utils, root config, then the small workers, then the large web-app sprint).
4. Cascades come after their trigger. In web-app they are the next commit in the same pull request, because the knip gate cannot be green between them (Sprint 10 explains).
5. MAJOR package removals are not scheduled: they are KEEP until each package's next planned major.

**Other catalogs:** the open 2026-10-03 security plan was checked for overlap.
- Its code sprints are all in the open PRs, which this audit already read merged.
- Its remaining items are GitHub settings and hand-run steps.
- No dead-code finding touches code a security fix still has to change, so there are no fix-vs-remove conflicts and nothing is superseded.

**Execution:** one PR per sprint, as with the security sprints. Sprints 3–7 are one or two small items each, and can be done in one sitting as separate PRs.

**Not scheduled here:** a pending preset submitted through the bot produces two moderation posts. One comes from the bot's direct post; the other is the revision-bound post from presets-api's webhook. This is a behaviour issue already on `main` (see the report's *Rejected suspicions*), not dead code, and needs its own follow-up.

## Sprint 0 — Before the batch merge, inside the open PRs — ✅ APPLIED 2026-10-04 (`10a1cb77` in #224, `ea264d49` in #225; DEAD-002 left to the maintainer)

These come from the preview branch, not from `main`. Fix them in the PRs that introduced them, so `main` never carries them.

| ID / item | PR | Action |
|---|---|---|
| (gate) moderation-worker contract test fails with #224 | #224 | **Blocker.** Reword the comment at `apps/presets-api/src/handlers/moderation.ts:390` so it contains no `as <word>`. Optionally, anchor `moderation-stats-contract.test.ts` to the stats statement in #225. Details: [evidence/preview-branch.md](evidence/preview-branch.md). |
| [DEAD-001](findings/DEAD-001.md) | #225 | Delete the five orphaned `preset.moderation.*` strings from `bot-i18n.ts:53-57`. |
| [DEAD-002](findings/DEAD-002.md) | #227 | **Optional.** Drop the unread `author_discord_id` field and reshape the test fixture so the "ID is not rendered" assertion keeps its meaning. If deferred, it joins Sprint 7. |

**Ends with:** each PR's own gate, then a re-run of the full gate on a fresh preview merge of all 13 heads (`pnpm turbo run build type-check lint test --continue`). Expected result: 62/62.

## Sprint 1 — packages/test-utils: test-only helpers and the self-referential integration suite

The safest place to start: a private package with no npm consumers and no deploy, whose every change is caught by the dependents' test suites. DEAD-041 is the anchor (795 lines); do it last in the sprint, after its coverage check. (249 source + 605 test lines.)

| ID | Conf/Blast · Semver | Rec | Item |
|---|---|---|---|
| [DEAD-042](findings/DEAD-042.md) | HIGH/NONE · NONE | REMOVE | createMockD1 in test-utils cloudflare/d1.ts is reached only by its own unit test: 22 src lines + 18 test lines |
| [DEAD-043](findings/DEAD-043.md) | HIGH/NONE · NONE | REMOVE | randomStainId in test-utils factories/dye.ts is test-only — 9 lines + 6-line test |
| [DEAD-044](findings/DEAD-044.md) | HIGH/NONE · NONE | REMOVE WITH CAUTION | test-utils './auth' exports-map subpath has zero importers — 4 config lines |
| [DEAD-041](findings/DEAD-041.md) | HIGH/NONE · NONE | REMOVE WITH CAUTION | test-utils integration/ suite only tests local re-implementations of presets-api auth: setup.ts 214 lines + 581 test lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...@xivdyetools/test-utils` (every app that uses test-utils re-runs its tests), then `pnpm dead-code:check` (the test-only exemption count drops from 26 to 25) and `pnpm docs:check-links`. Test-utils is private, so there is no publish. Merging it deploys nothing, because no deploy workflow filters on `packages/test-utils/**`.

## Sprint 2 — root (CI/scripts): turbo task and stale override

Two root-config lines. DEAD-045 changes the lockfile's overrides block, so regenerate it in the same commit. (6 source + 0 test lines.)

| ID | Conf/Blast · Semver | Rec | Item |
|---|---|---|---|
| [DEAD-046](findings/DEAD-046.md) | HIGH/LOW · NONE | REMOVE | The turbo.json `deploy` task (lines 130-134) has no caller: 5 lines |
| [DEAD-045](findings/DEAD-045.md) | HIGH/MEDIUM · NONE | REMOVE WITH CAUTION | The qs override in pnpm-workspace.yaml:11 names a package nothing installs: 1 line, plus the comment on line 7 and lockfile line 10 |

**Ends with:** `pnpm install` (regenerates the `pnpm-lock.yaml` overrides block), then `pnpm install --frozen-lockfile`, then the whole-graph gate `pnpm turbo run build type-check lint test`, `pnpm dead-code:check` and `pnpm docs:check-links`. Merging deploys nothing; no deploy workflow filters on root files.

## Sprint 3 — image-worker: stale path alias

Test/config only; the bundle does not change. (10 source + 0 test lines.)

| ID | Conf/Blast · Semver | Rec | Item |
|---|---|---|---|
| [DEAD-038](findings/DEAD-038.md) | HIGH/NONE · NONE | REMOVE | apps/image-worker '@' path alias (vitest resolve.alias + tsconfig paths) has no importer: 10 config lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-image-worker` → merge → `deploy-image-worker.yml` (redeploys an identical bundle).

## Sprint 4 — oauth: stale coverage excludes, test-only decodeJWT

DEAD-037 is config. DEAD-036 removes a test-only helper next to the live JWT code; follow its caution note. (11 source + 31 test lines.)

| ID | Conf/Blast · Semver | Rec | Item |
|---|---|---|---|
| [DEAD-037](findings/DEAD-037.md) | HIGH/NONE · NONE | REMOVE | apps/oauth vitest.config.ts coverage.exclude names nonexistent rate-limit-do.ts / durable-objects: 3 config lines |
| [DEAD-036](findings/DEAD-036.md) | HIGH/LOW · NONE | REMOVE WITH CAUTION | decodeJWT wrapper in apps/oauth jwt-service.ts is test-only: 8 src lines + 31-line describe block |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-oauth-worker` → merge → `deploy-oauth.yml`. Remember that a bare `wrangler deploy` is production on oauth; let the workflow deploy.

## Sprint 5 — api-worker: redundant test re-export

One line in `tests/test-utils.ts`. (1 source + 0 test lines.)

| ID | Conf/Blast · Semver | Rec | Item |
|---|---|---|---|
| [DEAD-035](findings/DEAD-035.md) | HIGH/NONE · NONE | REMOVE | createMockKV re-export in api-worker tests/test-utils.ts has no importer — 1 line |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker` → merge → `deploy-api-worker.yml`.

## Sprint 6 — og-worker: unread crawler field, stale path alias

Both LOW blast; og-worker's own knip (`lint`) confirms nothing else depended on them. (14 source + 11 test lines.)

| ID | Conf/Blast · Semver | Rec | Item |
|---|---|---|---|
| [DEAD-039](findings/DEAD-039.md) | HIGH/LOW · NONE | REMOVE | CrawlerInfo.userAgent in apps/og-worker/src/types.ts is written but never read since the crawler log was minimized: 4 src lines + 11 test lines |
| [DEAD-040](findings/DEAD-040.md) | HIGH/LOW · NONE | REMOVE | Unused '@' path alias in apps/og-worker vitest.config.ts and tsconfig.json: 10 config lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker` → merge → `deploy-og-worker.yml`. A bare `deploy` here is the live beta, so let the workflow deploy.

## Sprint 7 — discord-worker: unused registry field

The two-line `deprecated` field. (DEAD-002, the other discord-worker item, is handled in Sprint 0 or folds in here if it was deferred.) (2 source + 3 test lines.)

| ID | Conf/Blast · Semver | Rec | Item |
|---|---|---|---|
| [DEAD-024](findings/DEAD-024.md) | HIGH/NONE · NONE | REMOVE | CommandRegistryEntry.deprecated in registry.ts is never set or read in production: 2 lines + 3-line test |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker` → merge → `deploy-discord-worker.yml` (CI also runs `register-commands`; the command shapes do not change).

## Sprint 8 — presets-api: test-only response helper, deprecated re-exports, dead error codes

Do DEAD-033 and DEAD-034 first, then DEAD-031. DEAD-032 is REFACTOR FIRST: make `ErrorCode.BAD_REQUEST` live (`body-validation.ts:73` still writes the literal), and delete `DATABASE_ERROR` together with its row in `docs/architecture/api-contracts.md`. (40 source + 64 test lines.)

| ID | Conf/Blast · Semver | Rec | Item |
|---|---|---|---|
| [DEAD-033](findings/DEAD-033.md) | HIGH/NONE · NONE | REMOVE | PresetCategory/AuthSource re-exports in presets-api types.ts are test-only: 6 src lines + 33 test lines |
| [DEAD-034](findings/DEAD-034.md) | HIGH/LOW · NONE | REMOVE | Stale 'community' ternary in presets-api scripts/migrate-presets.ts is a never-taken branch: 1 line |
| [DEAD-031](findings/DEAD-031.md) | HIGH/LOW · NONE | REMOVE | successResponse + ApiSuccessResponse in presets-api api-response.ts are test-only: 31 src lines + 31 test lines |
| [DEAD-032](findings/DEAD-032.md) | HIGH/NONE · NONE | REFACTOR FIRST | ErrorCode.BAD_REQUEST and ErrorCode.DATABASE_ERROR in presets-api api-response.ts are never read: 2 lines |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api` → merge → `deploy-presets-api.yml`. No D1 migration.

## Sprint 9 — moderation-worker: test-only wrappers, translator fallback, older orphan strings, legacy ban parsing

Safest first. DEAD-029 (MEDIUM confidence) comes last. It removes parsing of the old base64-username suffix in `ban_confirm_`/`ban_reason_modal_` custom_ids. An ephemeral message held open for weeks cannot be fully excluded, but that click then fails gracefully ("Invalid button/modal data"); it never bans the wrong account. Most of its work is rewriting about 15 test fixtures that carry the suffix. (88 source + 202 test lines.)

| ID | Conf/Blast · Semver | Rec | Item |
|---|---|---|---|
| [DEAD-027](findings/DEAD-027.md) | HIGH/LOW · NONE | REMOVE | Translator.t() fallbackData branch in moderation-worker bot-i18n.ts is a no-op (data === fallbackData === strings): about 8 lines; getLocale is NOT included and stays as an observation hook |
| [DEAD-028](findings/DEAD-028.md) | HIGH/LOW · NONE | REMOVE | Unused _maxRetries parameter of incrementRateLimit in rate-limit.ts; its @param falsely says it is passed to the shared package: 2 src lines + 4 call-site edits |
| [DEAD-025](findings/DEAD-025.md) | HIGH/LOW · NONE | REMOVE | rateLimitMiddleware in moderation-worker rate-limit.ts is a never-mounted no-op reached only by its test — 25 source + 13 test lines |
| [DEAD-026](findings/DEAD-026.md) | HIGH/LOW · NONE | REMOVE | getPreset in moderation-worker services/preset-api.ts is test-only: 13 src lines + 34 test lines |
| [DEAD-030](findings/DEAD-030.md) | HIGH/LOW · NONE | REMOVE | moderation-worker bot-i18n.ts: older orphan strings (preset.categories.*, three ban.* keys, the meta block, common.success) — 24 source + 12 test lines |
| [DEAD-029](findings/DEAD-029.md) | MEDIUM/LOW · NONE | REMOVE WITH CAUTION | Legacy base64-username suffix parsing in ban-reason.ts:57-92 and ban-confirmation.ts:70-78 is unreachable: no emitter has produced the suffix since the 2026-08-21 FINDING-007 fix, and those flows are ephemeral — about 16 source lines, with a test-fixture rewrite |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker` → merge → `deploy-moderation-worker.yml` (commands are registered by hand by the maintainer; nothing changes in the command shapes).

## Sprint 10 — web-app: dead CSS, orphan strings, unused and test-only service methods, stale tests

The largest sprint. Order:
1. CSS and locale keys (NONE/LOW, easy to eyeball).
2. The services.
3. The test-only triggers, each followed by its cascade as the next commit:
   - DEAD-008, then DEAD-009 and DEAD-010;
   - DEAD-013 and DEAD-015, then DEAD-016.
4. The whole stale test files.
5. DEAD-003 last: the context-action vocabulary across five tools, REMOVE WITH CAUTION.

Why the cascades share the trigger's pull request: the planner's rule keeps cascades in a later sprint, so that the trigger's removal is proven green first. Here that cannot work. Web-app's knip gate fails on the orphaned icon exports the moment DEAD-008 lands without DEAD-009. So each cascade is its own commit, gated together with its trigger.

After DEAD-012, re-check the `GetPresetsOptions.category` branches that DEAD-014 names as a follow-on. DEAD-023 must land before any future core removal of `getLabel` (KEEP DEAD-049). (1126 source + 1300 test lines.)

| ID | Conf/Blast · Semver | Rec | Item |
|---|---|---|---|
| [DEAD-004](findings/DEAD-004.md) | HIGH/LOW · NONE | REMOVE | v4-layout-shell.ts static styles: pre-5.0 Accessibility CSS block is unreachable (337 lines) |
| [DEAD-005](findings/DEAD-005.md) | HIGH/LOW · NONE | REMOVE | BaseLitComponent.baseStyles utility classes and two preset-detail selectors have no markup (~31 lines) |
| [DEAD-006](findings/DEAD-006.md) | HIGH/LOW · NONE | REMOVE | themes.css dead Tailwind-override selectors (lines 153-224) — 23 lines |
| [DEAD-011](findings/DEAD-011.md) | HIGH/LOW · NONE | REMOVE | BaseLitComponent hasError/errorMessage @state is write-only (10 lines) |
| [DEAD-007](findings/DEAD-007.md) | HIGH/LOW · NONE | REMOVE | 5 orphan accessibility.* locale keys x 6 locales hidden by the analyzer's dynamic-prefix rule (30 lines) |
| [DEAD-012](findings/DEAD-012.md) | HIGH/LOW · NONE | REMOVE | HybridPresetService: 5 public methods with no caller and no test, about 49 lines including blanks |
| [DEAD-014](findings/DEAD-014.md) | HIGH/LOW · NONE | REMOVE | getPresets 'community' guard in hybrid-preset-service.ts is unreachable — 19 lines |
| [DEAD-017](findings/DEAD-017.md) | HIGH/LOW · NONE | REMOVE | WorldService: 6 test-only lookup methods + orphaned worldByName map — 57 src lines + ~100 test lines |
| [DEAD-018](findings/DEAD-018.md) | HIGH/LOW · NONE | REMOVE | IndexedDBService.getAll/count/deleteDatabase are test-only — 100 src lines + ~200 test lines |
| [DEAD-019](findings/DEAD-019.md) | HIGH/LOW · NONE | REMOVE | SubscriptionManager.addAll and getters count/hasSubscriptions have no caller or test — 21 lines |
| [DEAD-020](findings/DEAD-020.md) | HIGH/LOW · NONE | REMOVE | APIService static formatPrice/getPriceData/isInitialized are test-only — 25 src lines + 72 test lines |
| [DEAD-023](findings/DEAD-023.md) | HIGH/LOW · NONE | REMOVE | web-app LanguageService.getLabel and preloadLocales are test-only — 17 source + 43 test lines |
| [DEAD-008](findings/DEAD-008.md) | HIGH/LOW · NONE | REMOVE WITH CAUTION | empty-state.ts: 6 of the 7 EMPTY_STATE_PRESETS factories are test-only — 54 source + 53 test lines |
| [DEAD-009](findings/DEAD-009.md) | HIGH/LOW · NONE | REMOVE WITH CAUTION | 4 state icons in state-icons.ts are reachable only from the 6 test-only EMPTY_STATE_PRESETS: 33 lines + 4 import lines **(next commit after DEAD-008)** |
| [DEAD-010](findings/DEAD-010.md) | HIGH/LOW · NONE | REMOVE | 14 web-app locale keys x 6 locales are read only by the test-only empty-state presets: 24 lines per locale, 144 total **(with DEAD-009)** |
| [DEAD-013](findings/DEAD-013.md) | HIGH/LOW · NONE | REMOVE | getFeaturedPresets: HybridPresetService's has no caller and CommunityPresetService's is test-only — 33 source + 31 test lines |
| [DEAD-015](findings/DEAD-015.md) | HIGH/LOW · NONE | REMOVE | getRemainingSubmissions in preset-submission-service.ts has no caller or test — 41 lines |
| [DEAD-016](findings/DEAD-016.md) | HIGH/NONE · NONE | REMOVE | web-app: the msw mocks for /presets/featured and /presets/rate-limit and the e2e /featured route only serve removed methods — 34 test lines **(next commit after DEAD-013/015)** |
| [DEAD-021](findings/DEAD-021.md) | HIGH/NONE · NONE | REMOVE WITH CAUTION | color-service.test.ts tests @xivdyetools/core ColorService, not web-app code — 280 test lines |
| [DEAD-022](findings/DEAD-022.md) | HIGH/NONE · NONE | REMOVE WITH CAUTION | shared/__tests__/types.test.ts tests @xivdyetools/types, not web-app — 361 test lines |
| [DEAD-003](findings/DEAD-003.md) | HIGH/LOW · NONE | REMOVE WITH CAUTION | 6 legacy ContextAction members in result-card.ts and their handler cases in 5 tools are never emitted (~102 src lines + 126-line guard test) |

**Ends with:** `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`, plus the Playwright spec that DEAD-016 edits (`e2e/preset-gallery-api.spec.ts`).

Check the coverage ratchet: removing covered dead code shifts the percentages, so recount, and never lower web-app's thresholds.

Then merge → `deploy-web-app.yml`.

## Superseded findings

None. No other open catalog overlaps this one (see *Other catalogs* above). The duplicates the audit found itself were merged before numbering. The completeness re-sweep independently re-confirmed six published-package items, kept as evidence in DEAD-050, DEAD-053, DEAD-054, DEAD-056, DEAD-058 and DEAD-059. It also re-confirmed one item each in DEAD-041 and DEAD-051. Overlapping deletions were each given a single owner: DEAD-008/009/010, DEAD-013/016 and DEAD-049/050.

## KEEP register

These are not scheduled. Each finding file gives the reason and the revisit trigger.

| ID | Conf/Blast · Semver | Rec | Item |
|---|---|---|---|
| [DEAD-047](findings/DEAD-047.md) | HIGH/HIGH · MAJOR | KEEP | HarmonyGenerator find*Dyes family + 8 DyeService delegates + DyeDatabase hue-bucket index are test-only: ~660 src lines + ~1080 test lines |
| [DEAD-048](findings/DEAD-048.md) | HIGH/HIGH · MAJOR | KEEP | ColorManipulator (whole class) + 6 ColorService delegates + 3 ColorAccessibility methods/delegates are test-only: ~170 src lines + ~600 test lines |
| [DEAD-049](findings/DEAD-049.md) | HIGH/HIGH · MAJOR | KEEP | core: getToolName and getLabel, with the `tools`/`labels` locale sections, have no consumer outside core's tests — about 257 source + 100 test lines |
| [DEAD-050](findings/DEAD-050.md) | HIGH/HIGH · MAJOR | KEEP | types: ToolKey and LocaleData.tools outlive core's getToolName — 13 source lines, for the types major after DEAD-049 |
| [DEAD-051](findings/DEAD-051.md) | HIGH/HIGH · MAJOR | KEEP | core LocalizationService.setLocaleFromPreference and preloadLocales are test-only published API — 52 source + 60 test lines |
| [DEAD-052](findings/DEAD-052.md) | HIGH/HIGH · MAJOR | KEEP | PresetService.getPresetWithDyes in core is test-only published API — 34 lines + 145-line test |
| [DEAD-053](findings/DEAD-053.md) | HIGH/HIGH · MAJOR | KEEP | HarmonyInput.harmonyOptions in bot-logic harmony.ts is ignored legacy published API — 2 lines + 11-line stale test |
| [DEAD-054](findings/DEAD-054.md) | HIGH/HIGH · MAJOR | KEEP | UpstashRateLimiter in worker-kit has no in-repo constructor (only its own test) but is @public published API: ~206 src lines + 344-line test |
| [DEAD-055](findings/DEAD-055.md) | HIGH/HIGH · MAJOR | KEEP | getClientIp trustXForwardedFor opt-in path is test-only in-repo — 26 src lines + 60 test lines; stale comments |
| [DEAD-056](findings/DEAD-056.md) | HIGH/HIGH · MAJOR | KEEP | logger BaseLogger.child() and the DelegatingLogger class have no non-test caller anywhere: 79 src lines + ~128 test lines |
| [DEAD-057](findings/DEAD-057.md) | HIGH/HIGH · MAJOR | KEEP | logger createBrowserLogger's errorTracker branch never runs in-repo (published extension point): ~90 src lines + 207 test lines |
| [DEAD-058](findings/DEAD-058.md) | HIGH/HIGH · MAJOR | KEEP | types createDyeId/createHue/createSaturation are untagged published exports reached only by tests: 68 src lines + ~200 test lines |
| [DEAD-059](findings/DEAD-059.md) | HIGH/HIGH · MAJOR | KEEP | auth verifier tuning options never passed by any app — ~27 src lines + 74 test lines (bot-signature knobs untested) |
| [DEAD-060](findings/DEAD-060.md) | HIGH/HIGH · MAJOR | KEEP | auth barrel re-export of hmacSignHex is test-only in-repo and lacks @public — 1 line |
| [DEAD-061](findings/DEAD-061.md) | HIGH/NONE · NONE | KEEP | registryCommandNames in registry.ts is test-only: 10 lines (62-71), 3 test lines to rewrite |
| [DEAD-062](findings/DEAD-062.md) | MEDIUM/MEDIUM · NONE | KEEP | handleModal and the unsupportedComponent fallback in index.ts are unreachable defensive router branches: 24 lines + 12 locale lines + 59 test lines |
| [DEAD-063](findings/DEAD-063.md) | MEDIUM/HIGH · NONE | KEEP | presets-api GET /presets/featured and /presets/rate-limit have no in-repo client once the dead web-app methods go; documented public API, so KEEP (~35 route lines) |
| [DEAD-064](findings/DEAD-064.md) | HIGH/LOW · NONE | KEEP | stoat-worker: five more parked-feature leftovers (MessageContextStore.get/delete/size, isAuthorized, the Upstash config fields, HELP_TOPICS, two StoatMessage fields) — 54 source + 106 test lines |

**Package-major backlog.** When a package's next major is planned for its own reasons, fold its KEEP items into that one release: bump the major → merge → Actions "Publish Packages to npm", then one sprint per consumer deploy, as `release-mechanics.md` requires.

| Package | Items |
|---|---|
| `@xivdyetools/core` | DEAD-047, DEAD-048, DEAD-049, DEAD-051, DEAD-052 (about 1,173 source lines) |
| `@xivdyetools/types` | DEAD-050 (after core drops `getToolName`), DEAD-058 |
| `@xivdyetools/logger` | DEAD-056, DEAD-057 |
| `@xivdyetools/worker-kit` | DEAD-054 (and the `@upstash/redis` dependency with it), DEAD-055 |
| `@xivdyetools/auth` | DEAD-059, DEAD-060 |
| `@xivdyetools/bot-logic` | DEAD-053 |

**App-level KEEPs:**
- DEAD-061: an accepted registry test hook.
- DEAD-062: a defensive Discord router branch.
- DEAD-063: public presets-api routes with possible outside callers.
- DEAD-064: parked Stoat leftovers, alongside 2026-09-15-dead-code/DEAD-019.

## Standing guidance

- **Verify before fixing:** check each finding's evidence against the code first; findings are leads. Re-grep every symbol immediately before `git rm` (`git grep -n -w <sym> -- . ':!docs/audits'`). Grep `apps/stoat-worker` by hand for anything exported by bot-logic, logger or types.
- **Commits and gates:** one commit per task, or per sprint when it is tiny, with the gate at every sprint boundary (`release-mechanics.md` → *Standing verification gate*). Stage only your own paths, with `git commit --only -- <paths>`.
- **Changelogs:** each touched unit's `CHANGELOG.md` gets an entry. Version bumps follow the repo's patch convention for internal cleanups. There is no player-facing change, so no `CHANGELOG-laymans.md`.
- **After each sprint,** re-run `pnpm dead-code:check` and root `pnpm exec knip`: removals can expose new test-only code.
- **Tracking:** mark executed sprints in their heading as **✅ COMPLETED <date> <commits>**, with **Deploy needs:**, and mirror it in each finding's `## Status` and the report's status table.
