# Candidate rows returned by the 18 reviewers (verbatim), with the coordinator's verification verdicts

Legend: **C** = confirmed at file:line · **C↓** = confirmed, severity lowered (reason) · **C↑** = confirmed, raised · **R** = rejected (reason) · **→ID** = filed as. Every verdict was reached by opening the cited lines in the worktree at `79a69d1f`; the Opus pass in `verifier-pass.md` re-checked every row graded MEDIUM or above.

## coordinator (baseline run)

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| coord-01 | BUG | LOW | packages/test-utils/src/factories/dye.ts:35-36,181 | `createMockDye()` draws stainID from `Math.random()*254` with no uniqueness; `tests/factories/dye.test.ts:94` is flaky (baseline run: `expected 5794 not to be 5794`) | flaky | C — merged with pkg-worker-kit-test-utils-16 |

## core-color

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| core-color-01 | BUG | MEDIUM | ColorConverter.ts:445-462 | `hexToHsv` consults the LRU before validating; `normalizeHexKey` (197-205) strips `#`, so once `'#FF0000'` is cached, `hexToHsv('FF0000')` returns a value where `hexToRgb` (208-214) would throw | no | C↓ LOW — order-dependent acceptance of malformed input, never a wrong colour |
| core-color-02 | UNTESTED | MEDIUM | ColorAccessibility.test.ts:108-121 | guarded `if (!smallText) { expect(largeText) }` with no else; for `#767676`/white smallText is always true so the body never runs | — | C — UNTESTED |

## core-data

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| core-data-01 | BUG | MEDIUM | DyeDatabase.ts:392-395,400-403 | `getAllDyes` is a shallow copy (`[...this.dyes]`); elements are the shared `DyeInternal` records | no | C↓ LOW — `git grep` finds no consumer assigning to a dye field outside `initialize()`; latent doc/behaviour mismatch |
| core-data-02 | UNTESTED | — | DyeDatabase.test.ts:195-201 | "defensive copy" test checks array identity only | — | C — folded into core-data-01 |
| core-data-03 | BUG | MEDIUM | LocaleLoader.ts:49-70, LocaleRegistry.ts:64-66 | locale module objects returned without a clone | no | C↓ LOW — same shape as core-data-01, no mutator found |
| core-data-04 | LOW | LOW | CharacterColorService.ts:49 vs :327 | doc default `'oklab'`, code default `'ciede2000'` | — | C — LOW (doc drift) |
| core-data-05 | LOW | LOW | PresetService.ts:16-19 vs :262 | header example shows itemID-shaped values | — | R — lines 1-20 contain no dye values at all; nothing to correct |

## discord-handlers

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| discord-handlers-01 | UNTESTED | MEDIUM | commands/gradient.ts | no test file for `/gradient`'s adapter | no | C — UNTESTED (no `gradient.test.ts` exists) |
| discord-handlers-02 | UNTESTED | MEDIUM | commands/mixer-v4.ts | no test file for `/mixer`'s adapter | no | C — UNTESTED |
| discord-handlers-03 | BUG | MEDIUM | commands/preset.ts:817-827 | `/preset edit dye5:` on a 2-dye preset appends at index 2 (`push`), not slot 5 | no | C↓ LOW — the stored array is an ordered list, not six slots; only surprising when a user skips a slot |
| discord-handlers-04 | REFACTOR | LOW | commands/preset.ts:571,576,924 | notify* helpers never receive the logger, so their failures log nowhere | no | C — LOW refactor |
| discord-handlers-05 | BUG | MEDIUM | commands/manual.ts:255-283 | `/manual topic:🪙` still answers `{type:4}` and on a cold isolate awaits two 10 s service-binding calls (`getCachedWorlds`/`getCachedDataCenters`, 265) | no | C↓ LOW — residual of the fixed BUG-034; miss is ~once per isolate |
| discord-handlers-06 | BUG | MEDIUM | commands/stats.ts:556 | `workerEnv = 'production'` hard-coded; `env.ENVIRONMENT` is `development` on the beta bot | test pins the literal (stats.test.ts:892) | C↓ LOW — gated admin panel, cosmetic |

## discord-core

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| discord-core-01 | BUG | MEDIUM | index.ts:276-287 | `/webhooks/preset-submission` trusts `Content-Length` then `c.req.json()` unbounded | no | C↓ LOW — route is behind `INTERNAL_WEBHOOK_SECRET` and only presets-api calls it over a service binding |
| discord-core-02 | REFACTOR | LOW-MED | schemas.ts:1004-1019,1092-1114; preset-api.ts:506-511 | `preset_name`/`description` document length bounds but set no `min_length`/`max_length`; autocomplete choice names never truncated to 100 | no | C — LOW refactor (server validates; Discord truncates choices) |

## presets-api

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| presets-api-01 | BUG | HIGH | middleware/ban-check.ts:30-36 + auth.ts:71-77 | XIVAuth-only users are never blocked: `isUserBanned` reads `discord_id` only | no | C↓ MEDIUM, re-framed — the `sub` UUID flows consistently through `discord_id` on both write and check, BUT moderation-worker refuses any ban target that is not a snowflake (`preset.ts:521,621`, `ban-confirmation.ts:16`), so a XIVAuth-only author **cannot be banned at all**; `xivauth_id` has no reader or writer anywhere in `src/` |
| presets-api-02 | UNTESTED | HIGH | tests/middleware/ban-check.test.ts + test-utils d1.ts:242-252 | ban tests special-case the query and ignore the bound id | — | C — UNTESTED, folds into -01 |
| presets-api-03 | BUG | MEDIUM | handlers/presets.ts:344-350 | `PATCH /refresh-author` binds `auth.userName` (optional in `provider.ts:39`) with no fallback; siblings use `\|\| 'Unknown User'` (934) / `?? ''` (1181) | no | C↓ LOW — JWTs always mint `username`; reachable only from a bot call without the name header |
| presets-api-04 | BUG | MEDIUM | services/rate-limit-service.ts:168-200 | `text_edit`/`flagged_edit`/`preview_upload` caps are check-then-insert with no post-insert re-check | no | C↓ LOW — soft quota; concurrent overshoot bounded by parallelism |

## moderation-worker

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| moderation-worker-01 | OPT | MEDIUM | services/preset-api.ts:112-127 | service-binding and HTTP fallback fetches carry no `AbortSignal` | no | C↓ LOW BUG (Resource) — every Discord-facing call has one (BUG-040); presets-api itself can wait on Perspective |
| moderation-worker-02 | UNTESTED | LOW | middleware/rate-limit.test.ts:236 | `resolves.not.toThrow()` is the whole assertion for the KV-error path | — | C — UNTESTED |

## oauth

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| oauth-12 | BUG | MEDIUM | index.ts:119-141 vs 145-165 | env-validation 500 returns before the security-headers middleware registered after it: no nosniff / no-store / HSTS on that response | no | C↓ LOW — fires only while misconfigured; body carries no token; CLAUDE.md already documents the preflight exception, this is a second undocumented one |

## og-worker

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| og-worker-01 | BUG | MEDIUM | index.ts:357 | `wheel` cache-key gate is `startsWith('/og/harmony/')`, which also admits `/og/harmony/default.png`, a route that never reads `wheel` | no | C↓ LOW — bounded to 5 extra rasters of one card (validated wheel ids only) |
| og-worker-02 | OPT | LOW | index.ts:516,1218 | SPA pass-through `fetch()` calls have no timeout | no | C — LOW |

## api-worker

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| api-worker-01 | UNTESTED | MEDIUM | tests/lib/dye-serializer.test.ts:18-23 | boolean/enum fields asserted via `.toBeDefined()` only | weak | C — UNTESTED |
| api-worker-02 | UNTESTED | MEDIUM | routes/dyes.ts:240-252 | legacy-facewear 404 branch has no HTTP-level test | no | C — UNTESTED |
| api-worker-03 | BUG | LOW | universalis/services/cache-service.ts:118 | `waitUntil(cache.delete())` with no `.catch()` | no | C — LOW |
| api-worker-04 | REFACTOR | — | index.ts:206-246, routes/match.ts:52-65 | two error-envelope shapes; error `meta` lacks `locale` | — | C — LOW refactor |

## pkg-foundation

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| pkg-foundation-01 | BUG | MEDIUM | logger/src/presets/browser.ts:120-125 | error-tracker wrapper uses raw `JSON.stringify(error)`; circular/BigInt throws inside `logger.error()` | no | C↓ LOW — no app configures an `errorTracker` (`git grep errorTracker apps/*/src` is empty); latent |

## pkg-svg-bot-logic

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| pkg-svg-bot-logic-01 | BUG | MEDIUM | bot-logic/src/commands/swatch.ts:248-254 | L/R suffix is appended only when `!offGrid`, so off-grid heterochromia renders two identical "EYES · OFF GRID" rows | no | C — MEDIUM (wrong result on an edge path; user cannot tell which eye) |
| pkg-svg-bot-logic-02 | REFACTOR | LOW | bot-logic/src/commands/dye-info.ts:90-97 | `marketValue()` re-implements core's consolidation gate | no | C — LOW refactor |
| pkg-svg-bot-logic-03 | REJECTED | — | svg/src/palette-grid.ts:111-129 | `bandSlices` undershoot past ~52 colours | — | R (reviewer's own rejection: clipped harmlessly) |

## pkg-worker-kit-test-utils

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| pkg-worker-kit-test-utils-16 | BUG | MEDIUM | test-utils/src/factories/dye.ts:35-37,181 | 254-value random stainID → ~1/254 collision per pair; the baseline failure was both draws landing on stainID 66 | the test is the flake | C — MEDIUM (every `pnpm test` has a ~0.4 % chance of a red that is nobody's fault) |
| pkg-worker-kit-test-utils-17 | BUG | MEDIUM | test-utils/src/factories/dye.ts:181-189 | `createMockDye({ stainID: null })` swaps null for a random decoy; the `legacyItemIdForStain(null)` fallback (39-41) is unreachable | no | C↓ LOW — test fixture; no caller passes `null` today |

## webapp-tools-a

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| webapp-tools-a-01 | BUG | HIGH | swatch-tool.ts:2377-2412, mixer-tool.ts:2019-2073 | nine context-menu actions dispatch `new CustomEvent('navigate-to-tool')`; `git grep navigate-to-tool apps/web-app/src` finds no listener, so the success toast fires and nothing happens | no | C — HIGH (every "Add to …"/"See Harmonies" from Swatch and Mixer is a no-op) |
| webapp-tools-a-02 | BUG | MEDIUM | swatch-tool.ts:1545-1549 | `void import('@components/preset-submission-form').then(...)` with no `.catch()` | no | C — MEDIUM (stale-chunk after a deploy = silent dead click, cf. the Pages asset-cache incident) |
| webapp-tools-a-03 | REFACTOR | LOW | gradient-tool.ts:293,492 | `[MixerTool]` log tags survived the rename | — | C — LOW |
| webapp-tools-a-04 | UNTESTED | — | swatch-tool.ts:2373-2424, mixer-tool.ts:2014-2085 | no test verifies a context action reaches its target | — | C — UNTESTED, folds into -01 |
| webapp-tools-a-05 | UNTESTED | — | swatch-tool.test.ts:684-688 | `selectDye` test asserts `not.toThrow()` only | — | C — UNTESTED |

## webapp-tools-b

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| webapp-tools-b-01 | BUG | MEDIUM | extractor-tool.ts (whole) | 4A rebuild dropped share links; `ShareService.ExtractorShareParams` (share-service.ts:114,285,313) and og-worker `/og/extractor/:colors.png` remain with no producer | no | C — MEDIUM (feature silently gone; server-side card and encoder orphaned) |
| webapp-tools-b-02 | UNTESTED | — | extractor-tool.test.ts:448 | "merges displayOptions" asserts `not.toThrow()` only | — | C — UNTESTED |
| webapp-tools-b-03 | UNTESTED | — | accessibility-tool.test.ts:816 | same pattern | — | C — UNTESTED |
| webapp-tools-b-04 | BUG | LOW | image-zoom-controller.ts:579,651 | mousedown/mouseup never check `button`; a right-button drag commits a sample | no | C — LOW |
| webapp-tools-b-05 | BUG | LOW | market-board.ts:376-378 | raw `setTimeout` bypasses `safeTimeout`; fires after `destroy()` | no | C — LOW |

## webapp-services

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| webapp-services-01 | BUG | MEDIUM | collection-service.ts:931 (+626) | `importData()` lets a truthy non-string `name` past `!collection.name`, then `createCollection`'s `name.trim()` throws and aborts the loop after earlier collections were persisted | no | C↓ LOW — needs a hand-edited import file; fix is a `typeof` guard |
| webapp-services-02 | BUG | MEDIUM | auth-service.ts:589-603 | `isAuthenticated()` fire-and-forgets `logout()` with no re-entrancy guard; N synchronous callers on an expired token → N revoke fetches + notify storms | no | C↓ LOW — harmless duplicates; `/auth/revoke` is idempotent |
| webapp-services-03 | UNTESTED | MEDIUM | gradient-tool.ts:23, preset-tool.ts:34, welcome-modal.ts:21 | value-import `RouterService` from `@services/router-service` while tests mock `@services/index` only → the mock is inert (the PR #161 trap, three survivors) | no | C — UNTESTED MEDIUM (gradient-tool.test.ts:44 mocks the barrel; the component never reads it) |

## webapp-v4

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| webapp-v4-19 | BUG | HIGH | v4/preset-detail.ts:127-141,594-710 vs render 868-1042 | `priceData` is fetched on every preset/connect and on `prices-updated`, `.dye-price` CSS exists (514-521), but nothing after line 703 reads `priceData` — live prices never display | no | C↓ MEDIUM (Opus) — line 958 DOES emit `.dye-price` with the static vendor `formatGil(dye.cost)`, so nothing wrong is shown; "Show prices" is a silent no-op on this view plus a wasted Universalis fetch |
| webapp-v4-20 | BUG | MEDIUM | v4/preset-detail.ts:644-675 | `checkVoteStatus()` has no request-generation guard; A→B navigation lets A's late response overwrite B's vote state | no | R as stated (Opus) — `preset-tool.ts:1080-1095` renders the detail in its own template branch and `selectedPreset = null` (814) destroys it, so A's response lands on a detached instance; the reachable variant (an in-flight check from `updated()` clobbering an optimistic `handleVote` result) is filed LOW |
| webapp-v4-21 | BUG | MEDIUM | v4/preset-tool.ts:431-443 vs 886-893 | `_searchDebounce` never cleared in `disconnectedCallback` | no | C↓ LOW (Opus agrees) — one wasted fetch into a detached element; `reconcileTombstones()` returns early while `searchQuery` is non-empty |
| webapp-v4-22 | BUG | MEDIUM | v4/preset-tool.ts:762-766 + v4-layout.ts:658-668 | `pushState({ preset })` omits `toolId`; Back from a detail page recreates `<v4-preset-tool>` and loses tab/search/scroll | no | C — MEDIUM (Opus): `RouterService.handlePopState` (356-375) notifies unconditionally, `v4-layout.ts:316-321` → `loadToolContent` clears the container and `createElement('v4-preset-tool')` with no same-tool skip |
| webapp-v4-23 | REFACTOR | LOW | v4/config-sidebar.ts:147-156 vs shared/tool-config-types.ts:419-428 | dead field-initializer default disagrees with the real default | — | C — LOW refactor |

## webapp-modals

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| webapp-modals-01 | BUG | MEDIUM (latent) | base-component.ts:306-323,419-432 | `handleRetry()`/`renderError()` never call `unbindAllEvents()`, so a `safeAsync` failure after a successful render leaks listener-map entries per fail→retry cycle | no | C↓ LOW — `git grep safeAsync(` finds no caller outside base-component; latent |
| webapp-modals-02 | UNTESTED | — | collection-manager-modal.ts:5 | 640-line CRUD/import-export modal under `/* istanbul ignore file */`, no test file | — | C — UNTESTED |
| webapp-modals-03 | UNTESTED | — | add-to-collection-menu.ts:1 | same pattern, zero coverage | — | C — UNTESTED |
| webapp-modals-04 | BUG | LOW | add-to-collection-menu.ts:53,61-66 | off-screen check assumes `menuWidth = 200` while CSS allows up to 256 px → up to 56 px off-viewport | no | C — LOW |
| webapp-modals-05 | BUG | LOW | preset-edit-form.ts:117-119,698 | unresolvable stored dye ids are dropped at load; the `join(',')` diff then sends a shortened `dyes` patch on a Save with no user edits | no | C — LOW, latent: every persisted preset holds stainIDs 1–125 today, so nothing is unresolvable until a dye is added to the API's 1–254 range but not to core |

## image-stoat

| cand-id | kind | sev | file:line | claim | tested? | verdict |
|---|---|---|---|---|---|---|
| image-stoat-14 | BUG | LOW | stoat-worker/src/commands/ping.ts:9-11 | latency string is built before `sendMessage` resolves, so ping always reports ~0 ms | no | C — LOW / P3 (parked unit) |
| image-stoat-15 | UNTESTED | P3 | stoat-worker/src/commands/info.ts:98-101 | embed content never asserted, only presence | — | C — UNTESTED P3 |
| image-stoat-16 | REFACTOR | LOW | image-worker/src/validators.ts:141-147,386-423 vs presets-api/src/services/preview-image-service.ts:113-144 | magic-byte sniffing duplicated; presets-api's copy lacks GIF/BMP | — | C — LOW refactor |

## Final ID map (after the Opus pass — see `verifier-pass.md`)

| cand-id | → ID | cand-id | → ID | cand-id | → ID |
|---|---|---|---|---|---|
| presets-api-01 (+02) | BUG-001 (+BUG-043) | webapp-tools-b-01 | BUG-002 | webapp-tools-a-02 | BUG-003 |
| webapp-v4-19 | BUG-004 (MEDIUM, corrected) | webapp-v4-22 | BUG-005 | pkg-svg-bot-logic-01 | BUG-006 |
| coord-01 / pkg-worker-kit-test-utils-16 | BUG-007 | discord-handlers-05 | BUG-008 (MEDIUM per Opus) | core-color-01 | BUG-009 |
| core-data-01/02/03 | BUG-010 | core-data-04 | BUG-011 | discord-handlers-06 | BUG-012 |
| discord-core-01 | BUG-013 | presets-api-03 | BUG-014 | presets-api-04 | BUG-015 |
| moderation-worker-01 | BUG-016 | oauth-12 | BUG-017 | og-worker-01 | BUG-018 |
| api-worker-03 | BUG-019 | pkg-foundation-01 | BUG-020 | pkg-worker-kit-test-utils-17 | BUG-021 |
| webapp-tools-b-04 | BUG-022 | webapp-tools-b-05 | BUG-023 | webapp-services-01 | BUG-024 |
| webapp-services-02 | BUG-025 | webapp-v4-20 (reachable variant) | BUG-026 | webapp-v4-21 | BUG-027 |
| webapp-modals-01 | BUG-028 | webapp-modals-04 | BUG-029 | webapp-modals-05 | BUG-030 |
| image-stoat-14 | BUG-031 | core-color-02 | BUG-032 | discord-handlers-01 | BUG-033 |
| discord-handlers-02 | BUG-034 | moderation-worker-02 | BUG-035 | api-worker-01 | BUG-036 |
| api-worker-02 | BUG-037 | webapp-tools-a-05 | BUG-038 | webapp-tools-b-02/03 | BUG-039 |
| webapp-services-03 | BUG-040 | webapp-modals-02/03 | BUG-041 | image-stoat-15 | BUG-042 |
| webapp-tools-a-01 (+04) | REFACTOR-001 (rejected as BUG) | discord-handlers-04 | REFACTOR-002 | discord-core-02 | REFACTOR-003 |
| api-worker-04 | REFACTOR-004 | pkg-svg-bot-logic-02 | REFACTOR-005 | webapp-tools-a-03 | REFACTOR-006 |
| webapp-v4-23 | REFACTOR-007 | image-stoat-16 | REFACTOR-008 | (dupes scan) | REFACTOR-009 |
| og-worker-02 | OPT-001 | discord-handlers-03 | REJECTED (dense array, no slots) | core-data-05, pkg-svg-bot-logic-03 | REJECTED |
