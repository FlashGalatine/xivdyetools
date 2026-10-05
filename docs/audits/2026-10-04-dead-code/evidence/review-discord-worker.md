# Dead-code review: apps/discord-worker (preview/integration-2026-10-04)

Read-only review. Search was over TRACKED files only (git grep / git ls-files, docs/audits, CHANGELOGs, coverage excluded).
Helper scripts used were throwaway python in the session scratch dir (token index over all tracked text files, comment-stripped for prod files).

## Module map

- Entry: `src/index.ts` (Hono). Routes: `GET /health`, `POST /` (interactions), `POST /webhooks/preset-submission` (caller: presets-api notification-service.ts:195 via service binding), `POST /webhooks/github` (GitHub push webhook; secret `GITHUB_WEBHOOK_SECRET`).
- Commands: `commands/registry.ts` (18 entries) -> `commands/schemas.ts` (only importer in prod: scripts/register-commands.ts, localize.ts, gen-option-description-keys.ts) -> `handlers/commands/*.ts` via `handlers/commands/index.ts`.
- custom_id prefixes emitted vs handled:
  - `copy_hex_/copy_rgb_/copy_hsv_`: emitted `handlers/buttons/copy.ts:146-158` (createCopyButtons), handled `buttons/index.ts` (copy handlers). Live.
  - `previewimg_approve_/previewimg_reject_<key>`: emitted `index.ts:365,372` and `buttons/preview-image.ts:211,217`, handled `isPreviewImageButton` -> `handlePreviewImageButton`. Live.
  - `preset_approve_/reject_/revert_<uuid>[:rev:status]`: emitted `preset-notifications.ts:204-220`; handled by moderation-worker (not this unit). Live.
  - Modals: none emitted; `handleModal` (index.ts:1380) answers `errors.unknownModal`. Select menus: none emitted; non-button components answer `errors.unsupportedComponent` (index.ts:1355).
- Env fields: every `Env` field in `types/env.ts` has a prod reader (checked by script, all >= 2 non-comment hits). wrangler `[vars]` ENVIRONMENT/DISCORD_CLIENT_ID/PRESETS_API_URL/ANNOUNCEMENT_CHANNEL_ID are all read; six `[[ratelimits]]` RL_5..RL_70 all read in `services/rate-limiter.ts`.

## Commands run and results

1. `ls docs/audits/.../evidence/`; read `pr-delta.txt` (PR #227 block lines 103-114: package.json, schemas.ts -5, preset-notifications.ts +56/-5, stats.ts -158, index.ts +1, types/preset.ts +6, wrangler.toml; plus tests) and `delta-since-2026-09-15.txt` (discord-worker section lines 90-135, 55 files).
2. `grep discord-worker dead-code-check.txt`: exemptions in this unit = `src/test-utils.integration.ts` (@testonly), `src/commands/registry.ts:registryCommandNames` (@testonly), `scripts/gen-option-description-keys.ts` (@entrypoint). Nothing else.
3. Export inventory: Grep `^export ` over `apps/discord-worker/src` non-test: 288 exported names, 109 non-test tracked files in the unit.
4. Token-index script (all tracked .ts/.tsx/.js/.mjs/.json/.toml/.yml/.vue/.py/.html/.css/.jsonc outside docs/audits, CHANGELOG, locales, md): for each export, prod files other than the declarer, and test files. Result: 41 names with zero OTHER prod file (listed under candidate cand-dw-06 / rejected). Re-run with comment lines stripped from prod files: 5 extra names appear (CommandEvent, IMAGE_INPUT_MARKERS, WORLD_NAME_MAX_LENGTH, fetchDataCenters, fetchWorlds), each referenced from other prod files only in comments; all have same-file prod use. `ignoreExportsUsedInFile: true` (knip.jsonc:43) is why knip does not flag any of these.
5. `python members.py types/preset.ts PresetAPIError` -> getSafeMessageKey unitSrc=3 (used). `members.py types/budget.ts UniversalisError` -> 0 public methods. These are the only two classes in the unit (`git grep "^\s*(export )?class "`).
6. `git grep -E "it\.skip|xit\(|describe\.skip|it\.todo|test\.skip|it\.only|describe\.only"` in src/tests/scripts: no skipped/only tests (only `process.exit(` false matches in scripts).
7. vi.mock / import resolution check over all `*.test.ts` in the unit: 392 relative specifiers checked, 0 unresolved (no mocks of deleted modules). No snapshot, fixtures or __mocks__ files tracked.
8. Test files without a same-named source (16) inspected by name/header: all are cross-cutting contracts (log-user-id-invariant, wrangler-config, preview-refresh, preset-api-v2, root-changelog...). None targets removed behaviour.
9. package.json deps (script): every dependency/devDependency is imported or config/CLI-used: @resvg/resvg-wasm (services/svg/renderer.ts, scripts/upload-emojis.ts), auth, bot-logic, svg, core, logger, types, worker-kit, hono, dotenv (scripts/register-commands.ts:17, upload-emojis.ts:43), test-utils (src/test-utils.ts, vitest configs), workers-types, @types/node (scripts), tsx (`npx tsx` in package.json scripts), wrangler (bundle-size script, deploy), vitest, @vitest/coverage-v8 (`test:coverage` script; no source import, config-use is live).
10. scripts/ entries: `register-commands.ts` (package.json + deploy workflows), `upload-emojis.ts` (package.json + sync-dye-emojis.yml), `check-bundle-size.mjs` (package.json + ci.yml:261, deploy workflow), `gen-option-description-keys.ts` (@entrypoint, localize.test.ts imports its pure half), `subset-cjk-fonts.py` / `instance-latin-fonts.py` (documented in CLAUDE.md, produce src/fonts/*.ttf), `scripts/font-sources/*.ttf` (inputs of instance-latin-fonts.py), `fonts-src/NotoSansKR-Variable.ttf` (subset input per fonts-src/README.md). All 9 font files in `src/fonts` imported by `services/fonts.ts` (FragmentMono at :49).
11. `git diff 8ecb878f HEAD` for schemas.ts / stats.ts / index.ts / types/preset.ts / wrangler.toml, and `git diff 0332fcc5 HEAD` for swatch.ts / budget-calculator.ts / preset-favorites.ts / preferences.ts: see delta section.
12. `git grep` for `prefs:v1|PREFERENCE_SAMPLE|listAllPreferenceKeys|handlePreferencesSubcommand|Preference Adoption|stats.preferences`: no leftover code, locale key or doc reference to the removed `/stats preferences` panel (CLAUDE.md:275 and a packages/test-utils kv.test.ts:353 comment mention it historically; the KV mock cursor support is still used by `getStats` pagination, analytics.ts:322).
13. DEPRECATIONS.md grep for this unit: only the Perspective API privacy-policy rows (PRIVACY_POLICY*.md) with a 2026-12-31 deadline; not yet due, nothing for discord-worker code that should already be gone. The older retired items (`getPreference`, `resolvePreference`, v1 request signature `X-Request-Signature`) are confirmed absent from src (grep, no hits).
14. Not run: any build, knip (root-knip.txt already shows the 3 web-app items only).

## Delta findings (PR #227 and since 2026-09-15)

- /stats `preferences` subcommand removed cleanly: handler, `listAllPreferenceKeys`, both constants, schema entry, adminSubcommands entry, bot-logic locale keys all gone; `COLORS.yellow` still used (stats.ts:411).
- `ModerationPresetInfo.author_discord_id` (preset-notifications.ts:42) lost its only reader when the `<@id>` mention was dropped (FINDING-008); its comment says "kept so callers can pass a whole preset" but structural typing does not need it. Only a test fixture sets it (preset-notifications.test.ts:29). -> cand-dw-03.
- `reviewCustomId` legacy-id fallback (preset-notifications.ts:100-114): NOT dead. The bot's own `/preset submit` and edit paths (`preset.ts:1142,1163`) pass no `contentRevision` and `CommunityPreset` (packages/types) has no `content_revision`, so those two paths ALWAYS emit legacy ids; only the webhook path (index.ts:409) emits revision-bound ids. Behavioural note for the reviewer, not a dead-code candidate.
- `src/types/preset.ts:71 content_revision?` optional, read at index.ts:409. Live.
- Earlier cleanups confirmed landed: `getPreference` gone, swatch's private `readTextCapped`/host allowlist moved to `utils/chara-attachment.ts` + `utils/read-text-capped.ts` (both have prod importers: swatch.ts, glamour.ts, index.ts preset webhook).
- wrangler.toml production route trimmed to one custom domain; no code reference to the retired domain remains in src (grep `projectgalatine` in unit: only CHANGELOG/docs).

## Candidates (see structured return for the same list)

- cand-dw-01 `commands/registry.ts:69 registryCommandNames` - @testonly; sole caller registry.test.ts (3 uses); body is `COMMAND_REGISTRY.map(c => c.name)`, which scripts/register-commands.ts:31 already inlines.
- cand-dw-02 `commands/registry.ts:26 CommandRegistryEntry.deprecated` - no registry entry sets it; only tests read it (index.test.ts:63, registry.test.ts:24); doc comment points at a "Removed in v5" field that is actually the hard-coded `REMOVED_IN_V5` array (about.ts:64).
- cand-dw-03 `handlers/commands/preset-notifications.ts:42 author_discord_id` - unread after #227.
- cand-dw-04 `index.ts:1380 handleModal` + `errors.unknownModal`, `InteractionType.MODAL_SUBMIT` branch (index.ts:780) and the non-button component fallback (index.ts:1355, `errors.unsupportedComponent`): the worker emits no modal or select menu, so Discord can never deliver either. Defensive; recommend KEEP unless the owner wants the router trimmed.
- cand-dw-05 Legacy KV-data fallbacks: `services/preferences.ts` migrateLegacyPreferences + `buildLegacy*Key` (comment: legacy writers removed March 2026), `services/analytics.ts:326-333` old-data counter fallback, `services/preset-favorites.ts` v1 `string[]` reader (migration test says both shapes "live in KV right now"). Need a KV scan to retire; no evidence in repo.
- cand-dw-06 `buttons/preview-image.ts:97-101` bare-preset-id legacy `previewimg_*_<uuid>` parse (only already-posted messages carry it; no emitter) and the legacy-id branch of `reviewCustomId`: kept for in-flight Discord messages.
- cand-dw-07 export-keyword-only symbols (all have same-file prod use, tests import them): commandCharCount, DISCORD_LOCALE_MAP (localize.ts), renderEntry (changelog.ts), formatAnnouncementEmbed + DESCRIPTION_BUDGET (announcements.ts), CACHE_TTL_SECONDS/getCachedPrices/setCachedPrices (price-cache.ts), bucketLocale/DRAIN_DEADLINE_MS/CommandTrace (command-trace.ts), buildCoverage/readCmapCodepoints/getRenderableCodepoints (font-coverage.ts), trackCommand/incrementCounter/getCounter/trackUniqueUser/CommandEvent (analytics.ts), MAX_PRESET_NAME/DESCRIPTION_LENGTH (sanitize.ts), VALID_CLANS, fetchWorlds/fetchDataCenters, IMAGE_INPUT_MARKERS, WORLD_NAME_MAX_LENGTH, BINDING_TIERS, buildModerationNotification, PRESET_CATEGORY_CHOICES. Plus type-only exports with no external reference even in tests: UniversalisWorld, UniversalisDataCenter, WorldValidation, ExtractedImage, ImageInputReason, PreviewImageModerationResult, PresetFavoriteEntry, PresetFavoriteResult, CappedTextSource, ModerationNotificationOptions, PRESET_API_TIMEOUT_MS, RateLimiterConfig, DiscordRateLimitBindings, CommandRegistryEntry. Cosmetic (drop `export`), no lines deleted; recommend KEEP / skip.

## Positive controls

- Prior-audit removals (getPreference, 20 test-only exports DEAD-004, v1 signature) are verifiably gone: no hits in src.
- `services/budget/index.ts` barrel: every re-exported name has an importer through the barrel (budget.ts:30-40, manual.ts:22, preferences.ts:27, stats.ts:24, index.ts:91); the two uncached fetchers were already dropped from it.
- `services/i18n.ts` / `bot-i18n.ts` re-exports: each name has a consumer (getLocalizedCategory in dye.ts/localize.ts/budget-calculator.ts, resolveUserLocale in index.ts:1107 and bot-i18n.ts:36, isValidLocale bot-i18n.ts:62).
- `test-utils.integration.ts` @testonly reason holds: both helpers used by budget-pipeline.integration.test.ts (lines 26-41, 219).
- Every wrangler var/binding and every Env field has a prod reader.

## Rejected (checked, live)

See structured return.

## Prior KEEP register

- DEAD-018 / DEAD-019: no files in this unit (core / bot-logic). Not assessed here.
- DEAD-020 (rate-limit fallbacks): `services/rate-limiter.ts` KV fallback + partial-tier warning still present and covered by rate-limiter-fallback.test.ts; no retirement design, so trigger NOT met.
- DEAD-021 (`InteractionResponseBody`, types/env.ts:244): still test-only (13 test files, own=1, no prod ref); no Discord test-support reorganization approved, trigger NOT met.

## Files covered

109 tracked non-test files in apps/discord-worker (src 78 incl. 2 test-utils files, scripts 9, config/docs/fonts rest) plus 392 test import specifiers across all `*.test.ts` in the unit.
