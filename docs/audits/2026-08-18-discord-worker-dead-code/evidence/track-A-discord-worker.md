# Track A — `apps/discord-worker` manual verification notes

Scope: `apps/discord-worker` @ 84b6cf1 (monorepo-2.0-prep, clean tree). 61 src files, 15,278 non-test lines, 15,953 test lines.
Method: `grep -rnw <symbol> apps packages` (excl. node_modules/dist/coverage) for every candidate; classification per the ground rules (DEAD / TEST-ONLY / DUPLICATE / REDUNDANT-RE-EXPORT / LIVE). Searches were run from the monorepo root unless a path is shown.

Confirmed pre-conditions: `tsc --noEmit` exit 0 (`tsc-discord-worker.txt`); no `.skip/.todo/.only`; `coverage/`, `.wrangler/`, `.turbo/` are gitignored by the ROOT `.gitignore` (lines 13/9/31) — the app's own `.gitignore` only holds `scripts/.font-sources/`.

Important knip caveat that shaped this track: knip treats `*.test.ts` as entry files, so **an export used only by its own test never shows up as unused**. Every "TEST-ONLY" finding below is therefore something knip could not have reported; I found them by scanning every `export` in non-test src for zero non-test references outside its own file (command in section 8).

---

## 1. Knip findings — verified

### 1.1 Unused files
| File | Result | Evidence |
|---|---|---|
| `src/services/svg/index.ts` (8 lines) | **DEAD** | Barrel `export * from './renderer.js'`. Every consumer imports `../../services/svg/renderer.js` directly (11 handler files). Zero imports of `services/svg'`, `services/svg/index`, or `svg/index` in src/scripts/tests. Only reference anywhere is the `vitest.config.ts` coverage-exclude line 43. |
| `src/types/image.ts` (54 lines) | **DEAD** | Exports `MatchQuality`, `MATCH_QUALITIES`, `getMatchQuality`. `grep -rnw` across apps+packages: only hit outside the file is `packages/svg/CHANGELOG.md` (history — svg 5.0 dropped these in favour of core's `classifyBandTier`). No `types/image` import anywhere. |

### 1.2 Unused exports

**`src/handlers/buttons/index.ts`**
| Symbol | Class | Evidence |
|---|---|---|
| `createHexButton` | **TEST-ONLY** (barrel re-export + underlying fn in `copy.ts:150-179`, ~27 lines incl. doc; tests `copy.test.ts:209-230`, `index.test.ts:16` mock) | No non-test reference; the live builder is `createCopyButtons` (dye.ts, extractor.ts). |
| `handlePreviewImageButton`, `isPreviewImageButton` | **REDUNDANT-RE-EXPORT** | Underlying functions are LIVE — imported directly from `./preview-image.js` inside the same barrel and routed at `index.ts:81-84`. Nobody imports them from the barrel. |

**`src/services/budget/index.ts`** — barrel importers are only `handlers/commands/budget.ts` (findBudgetLedger, getDyeById, getDyeByName, getDyeAutocomplete, isUniversalisEnabled, validateWorld, getWorldAutocomplete, getQuickPickById), `handlers/commands/manual.ts` (fetchWorlds, fetchDataCenters), `index.ts` (getWorldAutocomplete). Per symbol:
| Symbol | Class | Underlying use |
|---|---|---|
| `fetchPrices` | REDUNDANT-RE-EXPORT | live internally: `universalis-client.ts:280` (called by fetchPricesBatched) + tests |
| `fetchPricesBatched` | REDUNDANT-RE-EXPORT | live via direct import in `budget-calculator.ts` |
| `CACHE_TTL_SECONDS` | REDUNDANT-RE-EXPORT | used inside `price-cache.ts:78`; (`changelog.ts:24` has its *own* unrelated const of the same name) |
| `getCachedPrice`, `setCachedPrice`, `getCachedPrices`, `setCachedPrices` | REDUNDANT-RE-EXPORT | all called inside `price-cache.ts` (`fetchWithCache` chain); `export` keyword only serves `price-cache.test.ts` |
| `fetchWithCache` | REDUNDANT-RE-EXPORT | live via direct import in `budget-calculator.ts:35` |
| `searchDyes` (`budget-calculator.ts:291-293`) | **TEST-ONLY** (3 lines) | refs: budget-calculator.test.ts, budget-pipeline.integration.test.ts only |
| `getAllDyes` (`budget-calculator.ts:336-338`) | **TEST-ONLY** (3 lines) | all non-test `getAllDyes` hits in the app are `dyeService.getAllDyes()` (bot-logic), not this wrapper |
| `getCategories` (`budget-calculator.ts:343-345`) | **TEST-ONLY** (3 lines) | same; `preset-api.test.ts` uses preset-api's `getCategories`, not this one |
| `QUICK_PICKS` | REDUNDANT-RE-EXPORT | used inside `quick-picks.ts` by getQuickPickById/getQuickPickChoices |
| `getQuickPickChoices` (`quick-picks.ts:190-196`) | **TEST-ONLY** (~8 lines) | only `quick-picks.test.ts`; the `/budget` schema in `commands/schemas.ts` does not build choices from it |
| types `UniversalisWorld`, `UniversalisDataCenter` | REDUNDANT-RE-EXPORT | used internally in `universalis-client.ts` (fetchWorlds/fetchDataCenters return types) |

**`src/services/preferences.ts`**
| Symbol | Class | Evidence |
|---|---|---|
| `resolvePreference` (297-314, ~28 lines with doc) | **DEAD** | 0 references anywhere incl. tests. Sibling `resolveBlendingMode/Matching/Count` are the live specialised versions. |
| (extra, tool missed) `hasPreferences` (274-282, ~12 lines) | **TEST-ONLY** | only `preferences.exhaustive.test.ts:318` |
| (extra) `resolveMarket` (364-372, ~11 lines) | **TEST-ONLY** | only `preferences.test.ts:325` |
| `validatePreferenceValue` | LIVE | called by `setPreference` (line 149) — export keyword only needed by tests |

**`src/test-utils.ts`** (144 lines): importers are only 3 test files, all importing `createMockEnv`.
| Symbol | Class |
|---|---|
| `createMockExecutionContext` (76-85) | **DEAD** (0 refs) |
| `createMockDyes` (116-123), `createMockPreset` (125-144) | **DEAD** (0 refs) |
| `createMockDye` (87-114) | **DEAD transitively** — only caller is createMockDyes |
| `createMockKV/D1/Analytics` | live only as helpers of `createMockEnv` |

About 70 removable lines; the whole file duplicates `@xivdyetools/test-utils` (which exports `createMockKV`, `createMockD1`, `createMockAnalyticsEngine`, `createMockDye/Dyes`, `createMockPreset`, `createMockFetcher`). The one thing the package lacks is a discord-worker-`Env`-typed `createMockEnv`. Also: 9 test files (about, stats, analytics, bot-i18n, component-context, i18n, preferences, preset-favorites, rate-limiter) each define a *local* `createMockKV` instead of using either.

**`src/utils/color.ts`** (14 lines) — a pure re-export shim over `@xivdyetools/bot-logic` (comment says so). Consumers (11 files) import only `resolveColorInput` and `dyeService` from it.
| Symbol | Class |
|---|---|
| `isValidHex`, `normalizeHex`, `resolveDyeInput`, types `ResolvedColor`, `ResolveColorOptions` | **REDUNDANT-RE-EXPORT** (0 refs via the shim, 0 refs anywhere in the app) |
| whole file | **DUPLICATE (shim)** — deletable by rewriting 11 import lines to `@xivdyetools/bot-logic` (contrast.test.ts mocks the shim path and would need to mock the package instead) |

### 1.3 Unused exported types
| Symbol | Class | Evidence |
|---|---|---|
| `bot-i18n.ts: LocaleCode` re-export (line 22) | REDUNDANT-RE-EXPORT | every consumer takes `LocaleCode` from `services/i18n.js` (which also re-exports it) or from `@xivdyetools/bot-logic/i18n` |
| `types/budget.ts: UserWorldPreference` (141-150, 10 lines) | **DEAD** | 0 refs. Describes the pre-v4 `budget:world:v1:` KV blob; `preferences.ts:498` parses that blob with an inline `{ world?: string }` instead. |
| `types/github.ts: GitHubPushPayload` | **LIVE** (tool false positive) | used via inline `import('./types/github.js').GitHubPushPayload` at `index.ts:372,374`; knip does not resolve inline import types |
| `types/preset.ts: PresetSortOption` | REDUNDANT-RE-EXPORT | `PresetStatus` likewise has 0 external importers (types/preset.ts uses it via its own direct import). The whole re-export block is self-marked `@deprecated ... will be removed in the next major version` (4 blocks). Still-consumed re-exports: CommunityPreset, PresetCategory, PresetListResponse, PresetSubmitResponse, PresetSubmission, PresetEditRequest, PresetEditResponse, VoteResponse, PresetFilters, CategoryMeta, ModerationStats, ModerationLogEntry (the last three only by the TEST-ONLY preset-api functions in section 6). |
| `utils/color.ts: ResolvedColor, ResolveColorOptions` | REDUNDANT-RE-EXPORT | see above |
| `utils/verify.ts: DiscordVerificationResult, DiscordVerifyOptions` | REDUNDANT-RE-EXPORT | `verify.ts` is itself an 18-line re-export shim over `@xivdyetools/auth` (REFACTOR-003) — NOT a duplicate implementation. Only consumer is `index.ts:15`. |
| `types/env.ts: InteractionResponseType.UPDATE_MESSAGE, MODAL` | **DEAD enum members** (2 lines) | non-test uses: PONG, CHANNEL_MESSAGE_WITH_SOURCE, DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, DEFERRED_UPDATE_MESSAGE, APPLICATION_COMMAND_AUTOCOMPLETE_RESULT only. Low value — mirrors the Discord API enum; leave or trim. |

---

## 2. Duplication of package code

| Local | Package | Verdict |
|---|---|---|
| `services/i18n.ts: SUPPORTED_LOCALES: LocaleInfo[]` (6 entries with name/nativeName/flag) | `@xivdyetools/core SUPPORTED_LOCALES: readonly LocaleCode[]` | **Different shape, but the local one is TEST-ONLY.** `SUPPORTED_LOCALES`, `LocaleInfo`, `getLocaleInfo`, `formatLocaleDisplay` (i18n.ts:35-73, 165-171, ~40 lines) have zero non-test references (only `i18n.test.ts` x19, `locale-and-fonts.test.ts` x4). The `/preferences language` choices in `commands/schemas.ts:602` are hard-coded separately. `isValidLocale` (live) hard-codes `['en','ja','de','fr','ko','zh']` and could use core's `SUPPORTED_LOCALES` — cosmetic. |
| `services/rate-limiter.ts: formatRateLimitMessage` | `@xivdyetools/worker-kit/rate-limiter formatRateLimitMessage` | **Genuinely different, keep.** Local: Discord-markdown bold `**N second(s)**`, takes the local `RateLimitResult` (`resetAt: number`). Package: plain text with a minutes branch and an "allowed" branch, takes worker-kit's result (`resetAt: Date`). Both live (index.ts:576). |
| `services/rate-limiter.ts` overall | worker-kit backends | Wrapper (singleton selection + Discord alias/subcommand scoping) — not a duplicate. Extra: `getConfiguredBackend` (213-215) is **TEST-ONLY**; `resetRateLimiterInstance` (218-221) is a legit test hook (singleton reset). |
| `utils/verify.ts` (18 lines) | `@xivdyetools/auth` | **Shim, not a copy.** `verify.test.ts` (220 lines) re-tests the package through the shim *and mocks `verifyDiscordRequest` itself* (lines 19-29) — it exercises a mock; `packages/auth/src/discord.test.ts` is the real test. Candidate: delete shim + test, import from `@xivdyetools/auth` in `index.ts` (index.test.ts mocks `./utils/verify.js` in ~30 places and would mock the package instead). |
| `src/test-utils.ts` | `@xivdyetools/test-utils` | see 1.2 — 5 of 8 factories duplicate the package; 4 are dead. |
| `utils/color.ts` | `@xivdyetools/bot-logic` | shim, see 1.2 |
| `services/fonts.ts: FONT_FAMILIES` (101-112) + `getFontWithCjkFallback` (121-131) + `hasCjkFont` (53-55) | `@xivdyetools/svg base.ts:310-315 FONTS` | **DUPLICATE + TEST-ONLY** (~35 lines). Zero non-test refs (`fonts.test.ts`, `locale-and-fonts.test.ts` only); the svg package owns font-family strings; the app only supplies buffers via `getFontBuffers`. |
| `services/budget/budget-calculator.ts: getDyeById/searchDyes/getAllDyes/getCategories` | `dyeService` (bot-logic) | one-line pass-through wrappers; `getDyeById` is live (budget.ts, index.ts), the other three are TEST-ONLY (1.2). |
| `index.ts:1028-1092 interface DiscordInteraction` (~65 lines) | `types/env.ts:119 export interface DiscordInteraction` (comment: "Consolidated to avoid duplicate definitions across command handlers") | **Internal DUPLICATE**; minor field differences (`type: InteractionType` required, `values?: string[]`). `handlers/buttons/index.ts:20-50` and `copy.ts` also carry local `ButtonInteraction` shapes. |

---

## 3. Stale config

**`vitest.config.ts` coverage.exclude** — 4 of 24 patterns point at nothing:
- `src/locales/**` — no such dir (locales live in `packages/bot-logic/src/i18n/locales`)
- `src/services/svg/dye-info-card.ts`, `src/services/svg/random-dyes-grid.ts`, `src/services/svg/budget-comparison.ts` — deleted when generators moved to `@xivdyetools/svg`
- plus `src/services/svg/index.ts` and `src/handlers/modals/index.ts` become stale once those files go (sections 1/6).
- Include glob `src/**/*.test.ts` also matches `budget-pipeline.integration.test.ts`, so `test:all` (= `vitest run && vitest run --config vitest.integration.config.ts`) runs the integration suite twice.

**`tsconfig.json` / `vitest.config.ts` / `vitest.integration.config.ts` `@/*` alias** — 0 uses of `from '@/` in src or scripts (three stale alias declarations).

**`wrangler.toml`** — every binding/var was grepped in src:
| Binding/var | Reads in src (non-test) |
|---|---|
| KV, ANALYTICS, PRESETS_API, UNIVERSALIS_PROXY, IMAGE_WORKER, DISCORD_CLIENT_ID, PRESETS_API_URL, ANNOUNCEMENT_CHANNEL_ID | live |
| **`DB` (D1 `xivdyetools-presets`, both envs)** | **never queried**. Only ref is `utils/env-validation.ts:76` (`if (!env.DB) errors.push(...)`). No `env.DB.`, `.prepare(`, or `D1Database` use anywhere in src; `git log -S"env.DB."` over `apps/discord-worker/src` returns nothing since the monorepo import (79e945a). All preset data flows through the `PRESETS_API` service binding. The wrangler comment "D1 ... shared with production on purpose, so /preset renders real data" is wrong about the mechanism. Removing = drop 2 `[[...d1_databases]]` blocks + the `Env.DB` field + the env-validation check + `createMockD1` in test-utils. |
| `Env.IMAGES?: R2Bucket`, `Env.ASSETS?: R2Bucket` (`types/env.ts:83,86`) | **DEAD type fields** — 0 refs, no R2 binding in wrangler.toml |
| `Env.UNIVERSALIS_PROXY_URL` | live as an HTTP fallback in universalis-client, but NOT set in wrangler.toml; **`stats.ts:462` tests only this var** (`env.UNIVERSALIS_PROXY_URL ? 'Configured' : 'Not configured'`) so `/stats` always reports Universalis "Not configured" although the service binding is configured. Defect, not dead code. |
| `ENVIRONMENT` (`index.ts:1107`) | not in wrangler vars, not in `Env`; the `isDev` branch of `app.onError` is unreachable in any deploy; `index.ts:99` comment even says the worker has no ENVIRONMENT var. |
| Secrets comment in wrangler.toml | lists 6; `Env` also declares INTERNAL_WEBHOOK_SECRET, GITHUB_WEBHOOK_SECRET, MODERATOR_IDS, MODERATION_CHANNEL_ID, MODERATION_BOT_TOKEN, SUBMISSION_LOG_CHANNEL_ID, STATS_AUTHORIZED_USERS — all read in src (live), just undocumented there. |

**`package.json` scripts** — `register-commands` -> `scripts/register-commands.ts` (exists; also run by both deploy workflows), `upload-emojis` -> `scripts/upload-emojis.ts` (exists). Unscripted files in `scripts/`: `test-font-rendering.ts` (manual dev check, referenced only by audit docs), `cleanup-v4-kv.ts` (one-shot for the v5 deploy window; becomes dead after it runs), `subset-cjk-fonts.py` (referenced by README/docs). `@cloudflare/workers-types` sits in `dependencies` (types-only, belongs in devDependencies) — hygiene, not dead.

**`.github/workflows`** — `deploy-discord-worker.yml`, `deploy-discord-worker-beta.yml` build/type-check/test with `--filter=xivdyetools-discord-worker` and run register-commands. Nothing stale.

---

## 4. Assets

- `src/fonts/*.ttf` (6 files) — all six statically imported by `services/fonts.ts:29-45` (SpaceGrotesk, Onest, FragmentMono, NotoSansSC/KR/JP subsets). LIVE; `[[rules]] **/*.ttf` in wrangler bundles them.
- `src/data/emoji-mapping.json` — LIVE via `services/emoji.ts:26` (`getDyeEmoji`, used by 6 command handlers) and regenerated by `scripts/upload-emojis.ts`. Structure `byApplication -> {prod 1447108133020369048, beta 1536085517270261771} -> byStainId 1..125` — both application IDs match wrangler's two `DISCORD_CLIENT_ID`s; 125 keys each = the dye count. `artwork` tag is only read by the upload script (intentional cache-buster). No unused keys.
- **`fonts-src/`** (git-tracked, 21 MB): `NotoSansKR-Variable.ttf` (10.4 MB) IS a source candidate in `subset-cjk-fonts.py:238-241` (LIVE). **`NotoSansSC-Regular.ttf` (10.6 MB) is DEAD** — the script's own comment (lines 71-75) says it is "a static face still tracked from the pre-5.0 era" that must NOT be used (subsets are cut from the variable face; `SC_INPUT_CANDIDATES` deliberately excludes it). Nothing else references it. Deleting it stops every clone carrying 10.6 MB (history stays).
- `coverage/` — gitignored (root .gitignore:13). Not committed.

---

## 5. Dead code paths / legacy

Legacy-marker lines (`legacy-markers.txt`), each judged:
| Location | Verdict |
|---|---|
| `handlers/commands/index.ts:6-10, 24` and `index.ts:28` — "Legacy commands (deprecated in v4, kept for backward compatibility)" | **Stale comments only.** The listed "legacy" handlers (accessibility, contrast, manual, changelog, comparison, preset, stats, budget) are all live 5.0 commands; the actually-deprecated match/match-image handlers were deleted in cfb5f85. Comment cleanup, 0 code. |
| `services/preferences.ts` — `LEGACY_I18N_PREFIX 'i18n:user:'`, `LEGACY_WORLD_PREFIX 'budget:world:v1:'`, `migrateLegacyPreferences` (466-525, ~60 lines) | **Compat shim still needed until KV cleanup.** Nothing writes either legacy key any more (grep: reads only). Read-on-first-access migration into `prefs:v1:*`. `scripts/cleanup-v4-kv.ts` lists `i18n:user:*` for deletion in the v5 window but NOT `budget:world:v1:*` — that prefix has no cleanup step. After the window: remove migration + the `i18n.ts:94-110,146-150` legacy fallback (`getUserLanguagePreference`, ~25 lines) together. |
| `services/i18n.ts:94-150` legacy `i18n:user:` fallback in `resolveUserLocale` | same — a *second* reader of the same legacy key (resolveUserLocale reads `prefs:v1` directly to avoid a circular import, so it cannot benefit from the preferences migration). Remove with the above. |
| `services/bot-i18n.ts:50-51` | comment describing the above chain; not code |
| `services/preset-favorites.ts:45,65` v1 bare-ID blob -> v2 entries | live read-side migration; keep until a KV sweep |
| `services/analytics.ts:275-280` "old data" counter fallback (`getCounter` x3 when metadata lacks counts) | LOW-confidence compat; only triggers if `stats:total` exists without metadata — pre-OPT-002 keys. Keep unless KV verified. |
| `handlers/commands/about.ts:125` "Removed in v5" field + `about.removedTitle/Body` keys | intentional one-release carry (cfb5f85) — schedule removal in 5.1, not dead now. |
| `types/preset.ts` `@deprecated` re-export blocks | see 1.3 — author-declared removal target; 2 of 14 names already unimported. |

GitHub webhook path: `POST /webhooks/github` (index.ts:331-440) -> dynamic `import()` of `utils/github-verify.js`, `services/changelog-parser.js`, `services/announcements.js`. **LIVE**: root `CHANGELOG-laymans.md` exists (created 935ef88), `ANNOUNCEMENT_CHANNEL_ID` is deliberately repeated in `[env.production.vars]` for it, `GITHUB_WEBHOOK_SECRET` is a declared secret. `changelog-parser.parseAll` is additionally used by `/changelog`. Only `announcements.ts` has no dedicated test (`formatAnnouncementEmbed` export is internal-only).

Feature flags: `isUniversalisEnabled`, `isApiEnabled` are binding-presence checks, not flags. No commented-out code blocks of 5+ lines found (awk scan of `//` runs containing `;{}()`).

---

## 6. Handlers, routing, and TEST-ONLY leftovers the tool cannot see

- Registry parity: all 17 `COMMAND_REGISTRY` names (harmony, mixer, gradient, extractor, swatch, dye, comparison, contrast, accessibility, a11y, budget, preset, preferences, manual, changelog, about, stats) have a `case` in `index.ts:596-664`; every file in `handlers/commands/` maps to one (a11y -> accessibility; `preset-notifications.ts` is the webhook helper). No orphan handler.
- Buttons: `copy_hex_/copy_rgb_/copy_hsv_` (created by `createCopyButtons`) and `previewimg_approve_/reject_` (created in index.ts:233-240) all routed in `handlers/buttons/index.ts`. `preset_approve_/reject_/revert_` are created here (`preset-notifications.ts:153-169`) but routed by moderation-worker — by design.
- **`src/handlers/modals/index.ts` (10 lines: header comment + `export {}`) — DEAD.** Not imported by `index.ts` (its `handleModal` at 1010 is inline and answers "Unknown modal"). Only refs: `modals/index.test.ts` (17 lines asserting the module is empty) and the vitest exclude.
- `getHarmonyTypeChoices` re-export (`harmony.ts:168`, barrel line 14) — **TEST-ONLY** (harmony.test.ts, index.test.ts); the harmony schema hard-codes its choices.
- **`src/services/component-context.ts` (326 lines) — TEST-ONLY, whole module.** Zero non-test importers (`grep -rln component-context src` -> only itself + its two tests, 129 + 230 lines). Rewritten in 935ef88 (Phase 0.4) "to unblock pagination"; no pagination/button flow ever consumed it (`buildCustomId/storeContext/getContext/updateContext/verifyContextUser` all 0 non-test refs; the `parseCustomId` in `preview-image.ts` is a different local function). Docs (`docs/projects/discord-worker/interactions.md:35`, `overview.md:84`, app CLAUDE.md:111) describe it as live — they are wrong. Judgement call: delete (685 lines) or keep as planned infra; either way the docs are stale.
- **`src/services/preset-api.ts` moderation + misc functions — TEST-ONLY (~191 lines + ~260 test lines):** `getFeaturedPresets` (239-249), `deletePreset` (335-354), `getCategories` (454-468), the whole "Moderation Functions" block `getPendingPresets/approvePreset/rejectPreset/flagPreset/getModerationStats/getModerationHistory` (470-584), `revertPreset` (624-653). Handler grep (`presetApi.<name>(` in handlers + index.ts): 0 for each. Moderation moved to moderation-worker; discord-worker keeps only `isModerator` + `setPreviewImageStatus` (live for the preview-image buttons). Removing them also frees the `ModerationStats/ModerationLogEntry/CategoryMeta` re-exports in `types/preset.ts`. Tests: `preset-api.test.ts` describes at 228,320,560,583,605,705,728,751,773,792.
- **`src/utils/sanitize.ts`: `MAX_COLLECTION_NAME_LENGTH`, `MAX_COLLECTION_DESCRIPTION_LENGTH` (15-16), `sanitizeCollectionName` (81-89), `sanitizeCollectionDescription` (91-99)** — TEST-ONLY (~22 lines; `sanitize.test.ts` x14). `/collection` was deleted in v5 (cfb5f85); these outlived it.
- `utils/discord-api.ts`: `safeSendFollowUp` (265-294, ~30 lines) and `deleteOriginalResponse` (296-309, ~14 lines) — TEST-ONLY (`discord-api.safe.test.ts`, `discord-api.test.ts`).
- `services/svg/renderer.ts: renderSvgToDataUrl` (122-130, ~9 lines) — TEST-ONLY (`renderer.test.ts`).
- `services/preset-favorites.ts: isPresetFavorited` (194-205, ~12 lines) — TEST-ONLY (favorites tests x11).
- `commands/registry.ts: registryCommandNames` (61-64) — TEST-ONLY (registry.test.ts parity check). Cheap; keep as the parity helper or inline.
- `services/rate-limiter.ts: getConfiguredBackend` (210-215) — TEST-ONLY.
- `services/preferences.ts: hasPreferences`, `resolveMarket` — TEST-ONLY (1.2).
- `services/i18n.ts: SUPPORTED_LOCALES/LocaleInfo/getLocaleInfo/formatLocaleDisplay` — TEST-ONLY (2).
- `services/fonts.ts: FONT_FAMILIES/getFontWithCjkFallback/hasCjkFont` — TEST-ONLY + duplicate (2).

## 7. Stale tests
- `handlers/commands/dye.test.ts:16-22` mocks `../../services/svg/dye-info-card.js` and `../../services/svg/random-dyes-grid.js`; `handlers/commands/preset.test.ts:76-78` mocks `../../services/svg/preset-swatch.js` — **none of these modules exist** (moved to `@xivdyetools/svg`); the `vi.mock` calls are inert. Every other relative `vi.mock` target resolves (script in section 8).
- `handlers/modals/index.test.ts` — tests that an empty module is empty (6).
- `utils/verify.test.ts` — 220 lines testing a mock of `@xivdyetools/auth` through a shim (2).
- `handlers/commands/index.test.ts` — barrel-existence assertions (`toBeDefined`) — vacuous, and the only thing keeping `getHarmonyTypeChoices` on the barrel.
- `test-utils.integration.ts` (95 lines) — `createMockServiceBinding`, `createMockUniversalisProxy` both used by `budget-pipeline.integration.test.ts` -> LIVE.
- No test file whose *subject file* is missing.

## 8. Reproduction commands
```
# zero-non-test-reference scan for every export in non-test src (run from apps/discord-worker)
for f in $(find src -name '*.ts' ! -name '*.test.ts' ! -path 'src/types/*' ! -name 'test-utils*'); do
  grep -oE "^export (async function|function|const|class|interface|type|enum|let) [A-Za-z_][A-Za-z0-9_]*" "$f" | awk '{print $NF}' | while read s; do
    nt=$(grep -rlw "$s" src scripts --include=*.ts | grep -v "^$f$" | grep -v '\.test\.ts' | wc -l)
    [ "$nt" = 0 ] && echo "$f: $s tests=$(grep -rlw "$s" src --include=*.test.ts | wc -l) internal=$(grep -cw "$s" "$f")"
  done
done
# stale vi.mock targets
grep -rn "vi\.mock('\.[^']*'" src --include=*.test.ts | while IFS=: read f ln rest; do m=$(echo "$rest" | grep -o "vi\.mock('[^']*'" | sed "s/vi.mock('//; s/'$//"); d=$(dirname "$f"); [ -e "$d/${m%.js}.ts" ] || [ -e "$d/${m%.js}/index.ts" ] || echo "STALE $f:$ln -> $m"; done
# wrangler binding reads
for v in KV DB ANALYTICS PRESETS_API UNIVERSALIS_PROXY IMAGE_WORKER IMAGES ASSETS; do echo "$v $(grep -rn "env\.$v\b" src --include=*.ts | grep -v test | wc -l)"; done
```
