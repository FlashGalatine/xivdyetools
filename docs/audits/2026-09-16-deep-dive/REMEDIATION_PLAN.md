# Remediation Plan — 2026-09-16

**Sources:** `DEEP_DIVE_REPORT.md` (43 BUG · 9 REFACTOR · 1 OPT = 53) · **Status basis:** 53 total — 0 fixed, 53 outstanding, 0 superseded, 0 KEEP, 0 need rotation
**Ordering:** 1. one deploy unit per sprint 2. P0 first (one row: the shared-fixture flake) 3. user-facing integrity before performance; refactors ride with the bugs they prevent; a package change is one publish sprint then one sprint per consumer deploy 4. terminal work last (the two cross-unit duplications land in `@xivdyetools/worker-kit`, then its three consumers)

There is no P1 tier in this plan — the catalog has 0 CRITICAL / 0 HIGH — so the eight MEDIUMs are P2 and lead the cadence. Two of them need a **product decision before code** (BUG-001, BUG-002); their sprints are gated and the questions are asked at Sprint 0 so they are answered before those sprints open. Sprints 13–16 are the nice-to-have structural tail; stopping after Sprint 12 leaves no MEDIUM open.

## Sprint 0 — Emergency & prerequisites — `test-utils` — ✅ COMPLETED 2026-09-16 `98637eff`

**Deploy needs:** none (workspace-private; consumers pick the fixture up from `dist` on their next run). Whole-graph `turbo run test` 25/25 green at the gate. Deferred minors from review: the `MAX_STAIN_ID_FOR_TEST()` helper in the new test is unused beside a literal `254`; `factories/index.ts` JSDoc still says "random IDs"; `{ stainID: undefined }` flows through as-is (no caller does this).

Nothing ships out-of-band and nothing needs rotation. The one P0 is a shared fixture whose ~0.4 %/run collision reddens PRs that never touched it (it failed this audit's own baseline). Merge only — `@xivdyetools/test-utils` is workspace-private; every consumer re-resolves it from `dist` on its next run.

| ID | Source | Tier | Action |
|---|---|---|---|
| BUG-007 | deep-dive | P0 | `factories/dye.ts:35-37,181-183` — replace `randomStainId()` as the default with a per-test counter over 1..254 (reset via `vi` hooks; throw on wrap); keep the random draw only behind an explicit option; rewrite the "generates unique IDs" test to build 254 dyes and assert all distinct |
| BUG-021 | deep-dive | P3 | same three lines — `'stainID' in overrides ? overrides.stainID : …` so the documented `null` arm derives `legacyItemIdForStain(null)`; add the null-arm test |
| — | decision | gate | **Ask now, answer before Sprint 5:** BUG-001 identity key — (a) let the moderation gates accept the snowflake-or-UUID value already stored in `presets.author_discord_id`, or (b) write and check a real `xivauth_id`. **Ask now, answer before Sprint 7:** BUG-002 — restore extractor sharing or retire it (retire also deletes an og-worker route). |

**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/test-utils` → whole-graph `pnpm turbo run build type-check lint test` → merge to `main` (no publish, no deploy).

## Sprint 1 — `web-app`: Swatch / Mixer / preset-detail — dead clicks and unread state

The MEDIUMs in `swatch-tool.ts` and `preset-detail.ts`, the dead-branch deletion that shares those files, and the services/modals LOWs that need no other file. One Pages deploy.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-003 | deep-dive | MEDIUM | `swatch-tool.ts:1546` — add the `.catch` + error toast the two sibling call sites use; test: reject the import mock, assert the toast |
| REFACTOR-001 | deep-dive | P2 | delete the unreachable `navigate-to-tool` branches in `swatch-tool.ts:2373-2416` and `mixer-tool.ts:2014-2077`; add a test enumerating `ContextAction` against the handled cases |
| BUG-004 | deep-dive | MEDIUM | `v4/preset-detail.ts:958` — render `priceData.get(getMarketItemID(dye))` when `marketConfig.showPrices`, else vendor cost; test seeds `priceData` and asserts the rendered gil differs from `dye.cost` |
| BUG-026 | deep-dive | LOW | `v4/preset-detail.ts:644-675` — generation counter on `checkVoteStatus`, ignore stale resolutions |
| BUG-025 | deep-dive | LOW | `services/auth-service.ts:589-603` — memoise the in-flight `logout()` promise |
| BUG-024 | deep-dive | LOW | `services/collection-service.ts:931` — `typeof name !== 'string'` guard; per-record try/catch in `importData` |
| BUG-029 | deep-dive | LOW | `add-to-collection-menu.ts:53-66` — measure the menu after first paint |
| BUG-041 | deep-dive | LOW/untested | remove the two `istanbul ignore file` pragmas; suites for `collection-manager-modal` CRUD/import/export and the menu's add/remove + positioning (proves BUG-029) |
| BUG-038 | deep-dive | LOW/untested | `swatch-tool.test.ts:684-688` — assert the selected dye and match list after `selectDye` |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app` + `pnpm --filter xivdyetools-web-app run build:check` (swatch chunk sits ~2 KB under budget — the deletion helps) → web-app `CHANGELOG-laymans.md` entry → merge to `main` → `deploy-web-app.yml`.

## Sprint 2 — `web-app`: preset-tool shell, gradient, extractor, BaseComponent lifecycle

The remaining web-app rows; no file overlaps Sprint 1, so the two can be developed on parallel branches. One Pages deploy.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-005 | deep-dive | MEDIUM | `v4/preset-tool.ts:762-766` + `router-service.ts:356-375` / `v4-layout.ts:316-321` — push `{ toolId: 'presets', preset }` and skip the remount on same-tool popstate; test: pushState → popstate → same element instance |
| BUG-027 | deep-dive | LOW | `v4/preset-tool.ts:431-443` — `clearTimeout(this._searchDebounce)` |
| BUG-030 | deep-dive | LOW | `preset-edit-form.ts:117-119,698` — keep the original id list as the diff baseline; refuse to save when a stored id failed to resolve |
| BUG-040 | deep-dive | LOW/untested | `gradient-tool.ts:23`, `v4/preset-tool.ts:34`, `welcome-modal.ts:21` — import `RouterService` from the barrel; add `no-restricted-imports` for `@services/router-service` outside `services/` |
| REFACTOR-006 | deep-dive | P3 | `gradient-tool.ts:293,492` — rename the `[MixerTool]` tags |
| REFACTOR-007 | deep-dive | P3 | `v4/config-sidebar.ts:147-156` — initialise from `DEFAULT_TOOL_CONFIGS` or delete the initializer |
| BUG-022 | deep-dive | LOW | `image-zoom-controller.ts:579,651` — `if (button !== 0) return` |
| BUG-023 | deep-dive | LOW | `market-board.ts:376-378` — `safeTimeout` |
| BUG-028 | deep-dive | LOW | `base-component.ts:306-323,419-432` — `unbindAllEvents()` before `renderError()`; or delete `safeAsync` (no caller) |
| BUG-039 | deep-dive | LOW/untested | `extractor-tool.test.ts:448`, `accessibility-tool.test.ts:816` — read the merged config back and assert both keys |

**Ends with:** same gate as Sprint 1 (`build:check`, laymans changelog) → merge to `main` → `deploy-web-app.yml`.

## Sprint 3 — `@xivdyetools/bot-logic` (publish): `/swatch` off-grid eye markers

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-006 | deep-dive | MEDIUM | `commands/swatch.ts:248-254` — append `·L`/`·R`/`·LR` regardless of `offGrid`; add the heterochromia-off-grid case to `swatch.test.ts` |
| REFACTOR-005 | deep-dive | P3 | `commands/dye-info.ts:90-97` — call core's `getMarketItemID`; test the three consolidated types + one plain dye |

**Ends with:** `pnpm turbo run build test --filter=@xivdyetools/bot-logic` → bump `packages/bot-logic/package.json` (4.2.0 → 4.2.1, patch) → merge to `main` → Actions → **"Publish Packages to npm"** → `@xivdyetools/bot-logic`.

## Sprint 4 — `discord-worker` (consumer of Sprint 3): ack budget, env truth, body cap, adapter test debt

One production deploy picks up bot-logic 4.2.1 and the worker's own seven rows. The two new suites go last so the source fixes are not blocked on them; `/mixer`'s suite is the regression net for the bot-logic bump landing in the same deploy.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-008 | deep-dive | MEDIUM | `commands/manual.ts:255-283,338-346` — defer the 🪙 topic (or a 2 s `AbortSignal` budget on the two lookups, degrading to the no-link state) |
| BUG-012 | deep-dive | LOW | `commands/stats.ts:556` — read `env.ENVIRONMENT`; test both values |
| BUG-013 | deep-dive | LOW | `index.ts:276-287` — bounded body reader (10 KB) on `/webhooks/preset-submission` |
| REFACTOR-002 | deep-dive | P3 | `commands/preset.ts:571,576,924` — pass the logger to the notify helpers |
| REFACTOR-003 | deep-dive | P3 | `commands/schemas.ts:1004-1019,1092-1114` — `min_length`/`max_length`; `.slice(0,100)` on autocomplete choice names (schema change → `register-commands` runs in CI on merge) |
| BUG-034 | deep-dive | LOW/untested | new `mixer-v4.test.ts` — mode → bot-logic args, ratio bounds, render failure → `render` |
| BUG-033 | deep-dive | LOW/untested | new `gradient.test.ts` — happy path, duplicate dyes, > 3 stages, render failure |

**Ends with:** bump `@xivdyetools/bot-logic` dep → `pnpm turbo run build type-check lint test --filter=xivdyetools-discord-worker` → bundle gate (`bundle-discord-worker.txt` baseline 2,284 KiB / 74 %) → discord-worker + root `CHANGELOG-laymans.md` entries (the root one fires the Discord announcement) → merge to `main` → `deploy-discord-worker.yml` (`--env production`, then `register-commands`). Never a bare `deploy` for this — that is the beta bot.

## Sprint 5 — `presets-api`: ban identity key, leg 1 — **gated on the BUG-001 decision**

Precedes Sprint 6 on both paths so a ban target can never reach a writer that cannot store it. On path (a) this sprint has no source change beyond the test and the two LOWs.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-001 (presets-api leg) | deep-dive | MEDIUM | path (b) only: `ban-check.ts:30-36` → `discord_id = ? OR xivauth_id = ?` bound with the caller's id; document which id the moderation writer must store |
| BUG-043 | deep-dive | LOW/untested | `tests/middleware/ban-check.test.ts` — scripted row keyed on the bound value; add the UUID-`sub` case beside the snowflake one (this is the test that cannot see BUG-001 today) |
| BUG-014 | deep-dive | LOW | `handlers/presets.ts:344-350` — `auth.userName ?? ''` (or 400 when empty); test with a name-less token |
| BUG-015 | deep-dive | LOW | `services/rate-limit-service.ts:168-200` — insert-then-count-then-rollback like the `submission` cap |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api` → merge to `main` → `deploy:production` via `deploy-presets-api.yml`. Any D1 change is applied **by hand per runbook — never `d1 migrations apply`** (the `d1_migrations` table is empty). Fallback: if the decision has not landed when Sprint 4 closes, ship BUG-014/015/043 as this sprint and let BUG-001 form its own later pair.

## Sprint 6 — `moderation-worker`: ban identity key, leg 2 — **same gate**

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-001 (moderation leg) | deep-dive | MEDIUM | path (a): relax the two `/^\d{17,20}$/` gates (`handlers/commands/preset.ts:521,621`, `buttons/ban-confirmation.ts:16,86`) and the autocomplete to snowflake-or-UUID; path (b): write `xivauth_id` in `ban-service.ts:449` when the author is XIVAuth-only. Either way: a test that bans a UUID author end-to-end |
| BUG-016 | deep-dive | LOW | `services/preset-api.ts:112-127` — `AbortSignal.timeout(10_000)` on both branches; classify the abort as `upstream_presets` |
| BUG-035 | deep-dive | LOW/untested | `middleware/rate-limit.test.ts:236` — assert `{ allowed, backendError }` and the warning |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker` → merge to `main` → `deploy:production` via workflow (`register-commands` is user-run if the schema changed).

## Sprint 7 — `web-app`: extractor sharing — restore or retire — **gated on the BUG-002 decision**

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-002 | deep-dive | MEDIUM | **restore:** wire `v4-share-button` into the 4A extractor, produce + consume `ExtractorShareParams`, test the round-trip and that the og-worker card URL is emitted. **retire:** delete the `extractor` branches in `share-service.ts:114,136,285,313` and their tests; the og-worker route + `index.test.ts:554-629` deletion rides Sprint 10 |

**Ends with:** `build:check` → laymans changelog → merge to `main` → `deploy-web-app.yml`. Scheduled immediately before the og-worker sprint so the retire half ships as one coherent pair.

## Sprint 8 — `@xivdyetools/core` (publish): validate-before-cache, shared-record safety, doc default

No consumer deploy sprint: nothing here changes a result an app must pick up (see the finding files); consumers take it on their next natural deploy. Gate before merging: `git grep` confirms no app passes an unprefixed hex into `hexToHsv`/`hexToLab` — a hit is a new app-unit finding.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-011 | deep-dive | LOW | `CharacterColorService.ts:49` — fix the JSDoc default |
| BUG-009 | deep-dive | LOW | `ColorConverter.ts:445-455` — validate before the LRU lookup (mirror in the sibling hex→X entries); cold-vs-warm test |
| BUG-010 | deep-dive | LOW | `DyeDatabase.ts:392-395` — `Object.freeze` each record at `initialize()`, say so in the JSDoc; element-mutation test; same for the locale objects or document them as shared |
| BUG-032 | deep-dive | LOW/untested | `ColorAccessibility.test.ts:108-121` — a 3:1–4.5:1 pair, assert both flags |

**Ends with:** `pnpm turbo run build test --filter=@xivdyetools/core` (`build` regenerates `src/data/locales/`; tree must stay clean) → bump 5.2.0 → 5.2.1 → merge to `main` → Actions → **"Publish Packages to npm"** → `@xivdyetools/core`.

## Sprint 9 — `@xivdyetools/logger` (publish): browser error-tracker serialization

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-020 | deep-dive | LOW | `presets/browser.ts:120-125` — `safeStringify`; circular-value test |

**Ends with:** bump 2.2.0 → 2.2.1 → merge to `main` → Actions → **"Publish Packages to npm"** → `@xivdyetools/logger`. No consumer deploy sprint (no app configures a tracker).

## Sprint 10 — `og-worker`: cache-key hygiene, then the one optimization

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-018 | deep-dive | LOW | `index.ts:357` — exclude the default card from the `wheel` key; extend `og-guards.test.ts` |
| (BUG-002 retire half) | deep-dive | — | only if Sprint 7 chose *retire*: delete `/og/extractor/:colors.png` (`index.ts:1047`) and `index.test.ts:554-629` |
| OPT-001 | deep-dive | LOW | `index.ts:516,1218` — `AbortSignal.timeout(5_000)` on the SPA pass-throughs, fall through to the static card on abort |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-og-worker` → merge to `main` → `deploy:production` via workflow. **Never a bare `deploy` here** — that is the routed beta at `beta.xivdyetools.app`.

## Sprint 11 — `api-worker`: SWR cleanup, error envelope, contract tests

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-019 | deep-dive | LOW | `universalis/services/cache-service.ts:118` — `.catch` with a debug log |
| BUG-037 | deep-dive | LOW/untested | HTTP test for `GET /v1/dyes/-1234` → 404 + `details.facewearId/hex` |
| BUG-036 | deep-dive | LOW/untested | `tests/lib/dye-serializer.test.ts:18-23` — literal snapshots for a metallic, a pastel and a Type-C dye |
| REFACTOR-004 | deep-dive | P3 | `routes/match.ts:52-65` through `ApiError`; `locale` in error `meta`; update the VitePress contract page |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker` → merge to `main` → `deploy:production` via workflow.

## Sprint 12 — `stoat-worker` (parked): file-and-fix only

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-031 | deep-dive | LOW/P3 | `commands/ping.ts:9-11` — measure after the send, or drop the number |
| BUG-042 | deep-dive | LOW/P3 | `info.test.ts` — assert title/colour/description on one dye |

**Ends with:** whole-graph `pnpm turbo run build type-check lint test` → merge to `main`. No deploy — the unit is parked.

## Sprint 13 — `@xivdyetools/worker-kit` (publish): terminal structural — the two cross-unit duplications

Nice-to-have tail. If the "presets-api simply trusts image-worker's 415" variant of REFACTOR-008 is chosen, the sniffer never enters worker-kit and Sprint 15 drops out.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| REFACTOR-009 | deep-dive | P3 | `bodyGuards({ maxSize, depth, exempt })` factory replacing the oauth (10 KB) and presets-api (100 KB + preview-image exemption) copies; tests for both configurations |
| REFACTOR-008 | deep-dive | P3 | shared magic-byte sniffer (PNG/JPEG/WebP/GIF/BMP) with image-worker's table as the source of truth |

**Ends with:** `pnpm turbo run build test --filter=@xivdyetools/worker-kit` → bump 1.3.0 → 1.4.0 (additive, MINOR) → merge to `main` → Actions → **"Publish Packages to npm"** → `@xivdyetools/worker-kit`.

## Sprint 14 — `oauth` (consumer of Sprint 13): adopt `bodyGuards` + the headers-ordering fix

oauth ships exactly once in this plan, which matters here: it has no `[env.production]`, so **every** `wrangler deploy` on it is production.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| BUG-017 | deep-dive | LOW | `index.ts:119-165` — register the security-headers middleware before env validation (or set the headers on that one 500); note the exception in CLAUDE.md if kept |
| REFACTOR-009 (oauth leg) | deep-dive | P3 | replace `src/middleware/body-validation.ts` with the worker-kit factory |

**Ends with:** bump the worker-kit dep → `pnpm turbo run build type-check lint test --filter=xivdyetools-oauth-worker` → merge to `main` → `deploy-oauth.yml` (bare `wrangler deploy` **is** production).

## Sprint 15 — `image-worker` (consumer of Sprint 13): adopt the shared sniffer

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| REFACTOR-008 (image-worker leg) | deep-dive | P3 | `validators.ts:141-147,386-423` → import from worker-kit; keep the byte-table test |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-image-worker` → merge to `main` → `deploy:production` via workflow (service-binding only).

## Sprint 16 — `presets-api` (consumer of Sprint 13) — terminal

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| REFACTOR-009 (presets-api leg) | deep-dive | P3 | replace `src/middleware/body-validation.ts` with the factory, keeping the preview-image exemption and FINDING-004's stream-bound behaviour (its tests must stay green unchanged) |
| REFACTOR-008 (presets-api leg) | deep-dive | P3 | `services/preview-image-service.ts:113-144` → shared sniffer (or delete the pre-filter and trust image-worker's 415) |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api` → whole-graph `pnpm turbo run build type-check lint test` → merge to `main` → `deploy:production` via workflow.

## Superseded findings

| ID | Superseded by | Why |
|---|---|---|
| — | — | none: no other open catalog covers this tree (the 2026-09-15 dead-code and security catalogs were executed in PRs #183–#186) |

## KEEP register

| ID | Item | Reason | Revisit trigger |
|---|---|---|---|
| — | — | not applicable to a deep-dive catalog | — |

## Standing guidance

- Verify each finding's evidence against the code before fixing — findings are leads (two of this catalog's own HIGH candidates did not survive verification; see `evidence/verifier-pass.md`).
- One commit per task (or per sprint when tiny); run the standing gate at every sprint boundary (`release-mechanics.md`); stage only your own paths with `git commit --only -- <paths>` — another session usually has this checkout open.
- Every user-visible change updates the unit's `CHANGELOG-laymans.md`; the **root** one fires the Discord announcement on push to `main`, so write it for Sprint 4 (bot) and Sprints 1/2/7 (web) only when the change is worth announcing.
- Re-run the audit's gates after each sprint (`turbo run build type-check lint test --force`, coverage, `dead-code:check`); Sprint 1's deletion may surface newly-unreferenced symbols.
- Annotate executed sprints in the heading: **✅ COMPLETED <date> <commits>** + **Deploy needs:** — the plan doubles as the tracker.
