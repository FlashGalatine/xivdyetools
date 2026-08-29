# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed — 2026-08-29

- **`/dye info` card was unreadable on light dyes.** The header band is painted in the dye's own colour and its text was always white, so on Pure White, Snow White, Honey Yellow and some 55 other light dyes the name, stain number, category and command pill all but vanished. The band's ink is now picked per dye by measured contrast (`@xivdyetools/svg` `bandInk` / `pillInkOnDye`); dark dyes render exactly as before.
- **Dye autocomplete values are stainIDs, and the typed query may be an id.** The shared dye-name autocomplete (every "hex code or dye name" option: harmony, comparison, contrast, accessibility, mixer, gradient, `/dye info`, `/preset` dyes) sent the English canonical name as the choice value, so Discord echoed `name: Carmine Red` under every locale. The value is now the stainID; a query that is a bare stainID or legacy item id resolves to that one dye (a localized name already matched); and every resolver accepts all three forms (`@xivdyetools/bot-logic` `parseDyeIdInput`).
- **`/preset submit` and `/preset edit` work against presets-api 5.0 again.** They sent `dye.id` (the legacy item id) and allowed 2–5 dyes; the API takes **stainIDs and 3–6 dyes** and rejected every bot submission ("looks like a legacy item ID"). Both now send `dye.stainID`, enforce 3–6, and gained a `dye6` option (`dye3` is required on submit). Tests pin the payload with dyes whose stainID differs from their legacy id. The six locales' dye-count strings say 3 / 3–6.
- **`/budget` is stainID-keyed like the rest of 5.0.** The `target_dye` autocomplete offered legacy item ids as values (the command echo read `target_dye: 13114` for Pure White) and the quick picks were keyed the same way. Choice values and `QUICK_PICKS.targetDyeId` are stainIDs now; a new `resolveTargetDye` accepts either range (1–254 = stainID, ≥ 5729 = legacy item id) so a typed item id keeps working, and `findBudgetLedger` resolves through it. Tests assert every autocomplete value and every quick pick sits in 1–254.
- **`/budget quick` built the ledger for the wrong dye for its two headline presets.** `QUICK_PICKS` carried item id `5763` for Jet Black and `5762` for Pure White — those are Ul Brown's and Bone White's — so the card was titled "Budget Alternatives for Ul Brown" / "Bone White" with the matching share link. Corrected to `13115` / `13114`; the other 20 presets were right. A new test resolves every preset's id through the dye database and asserts the name matches, which is what would have caught this.
- **`/swatch` could not download any attachment.** The FINDING-033 hardening set `redirect: 'error'` on the CDN fetch; the Workers runtime implements only `follow` and `manual` and throws `TypeError: Invalid redirect value` on `error`, so every download failed. Now `redirect: 'manual'` — a redirect comes back as a 3xx response that the existing `!ok` check refuses, so the "never follow" intent is unchanged. A shared ESLint rule now rejects `redirect: 'error'` anywhere in the workspace.

### Changed — 2026-08-29 merge-day close-out

- `CHANGELOG-laymans.md`'s `[5.0.0]` entry now carries the real ship date (2026-08-28, the `monorepo-2.0-prep` → `main` merge) instead of the 2026-08-16 changelog-sync date; the root product-level file was corrected the same way, which is also the push that fires the first release announcement through the newly wired GitHub webhook (`/webhooks/github`).
- **New CI workflow `sync-dye-emojis.yml`** (`workflow_dispatch`, `production` environment): runs `scripts/upload-emojis.ts` against the main bot application with the repository secret `DISCORD_TOKEN` and publishes the rewritten `src/data/emoji-mapping.json` as an artifact to commit — the bot token no longer needs to touch a local shell for the 5.0 emoji regeneration.

### Removed

- `scripts/cleanup-v4-kv.ts` — ran once against production on 2026-08-29 (one orphaned `xivdye:favorites:*` key and one `xivdye:collections:*` key deleted; no `i18n:user:*` keys existed). The `budget:world:v1:*` sweep it deliberately did not cover (DEAD-010) remains a product decision; `preferences.ts` still folds that prefix on read.

### Security — 2026-08-21 security audit (`docs/audits/2026-08-21-security/`, FINDING-003)

- Rate limiter logs a one-time warning per isolate when it falls back from Upstash to KV (`services/rate-limiter.ts`). The KV backend cannot throttle a fast client (KV 1 write/s/key, swallowed put failures, eventually-consistent reads), so it is a dev fallback only — production must configure `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, and the warning makes a missing configuration visible in the logs instead of silently running unthrottled.
- Bot → presets-api requests also carry `X-Request-Signature-V2` + `X-Request-Nonce` (FINDING-014): the v2 signature binds method, path, the exact JSON body bytes sent, timestamp, nonce and identity (60 s window) via `@xivdyetools/auth` 1.4.0; the v1 header stays during rollover. The body is serialised once and the same bytes are signed and sent.
- Interaction timestamps are now enforced fresh (FINDING-021): `verifyDiscordRequest` (`@xivdyetools/auth` 1.4.0) rejects `X-Signature-Timestamp` older than 5 minutes or > 60 s in the future before reading the body — a captured interaction can no longer be replayed later.
- **FINDING-019 — user text in bot embeds**: every user-sourced string that reaches a Discord embed goes through `@xivdyetools/bot-logic`'s `sanitizeEmbedText` (control / zero-width / bidi characters stripped, `@everyone` / `@here` / `<@…>` defused, markdown incl. masked links escaped, length capped); `utils/sanitize.ts`'s `sanitizePresetName` / `sanitizePresetDescription` now delegate to it. Covered: `/preset show|list|submit|edit|favorite` (stored name / description / tags / author, the duplicate-preset echoes, typed dye names), the auto-approved submission-log embed and the webhook's author / tags fields (both had skipped the sanitiser the moderation path uses), the `/swatch` parse-error embed (the parser echoes `.chara` field *values*), the `/dye search` query title and the `/budget` echoes. The preset swatch PNG still receives the raw text — the SVG layer XML-escapes and would otherwise print backslashes. Every outbound payload in `utils/discord-api.ts` (follow-up / edit / channel message / multipart `payload_json`) now carries `allowed_mentions: { parse: [] }` unless the caller passes an explicit `allowedMentions`.
- **FINDING-020 — preset ids in URL paths**: `services/preset-api.ts` percent-encodes every preset-id path segment (`getPreset`, `editPreset`, `voteForPreset`, `removeVote`, `hasVoted`, `setPreviewImageStatus`) so `..` / `/` / `?` / `#` cannot steer a bot-authenticated request onto another route, and handlers validate at the boundary (`isValidPresetId`, `types/preset.ts`): a `/preset show|vote|edit|favorite` value that is not a UUID is a typed *name* and is resolved through the search query (never a path segment), and the preview-image moderation buttons refuse a non-UUID `custom_id` before authorisation or any API call.
- **FINDING-022 — analytics vs. privacy policy**: Analytics Engine blob3 is now the context `'guild' | 'dm'` — the raw guild id is never written — and `PRIVACY_POLICY.md` discloses exactly what usage telemetry is retained (Analytics Engine command events with a pseudonymous user id and the server/DM flag; 30-day KV usage counters; 30-day `usertrack:{date}:{userId}` daily-activity keys). `/stats` is unchanged.
- **FINDING-023 — dangling domains**: `/stats summary` links come from core's `PRODUCT_LINKS` / `SOCIAL_LINKS` / `XIVDYETOOLS_DOCS_URL` (`https://xivdyetools.app/`, `https://developers.xivdyetools.app/`, `https://discord.gg/5VUSKTZCe5`); the non-resolving `xivdyetools.com`, `docs.xivdyetools.com` and `discord.gg/xivdyetools` are gone from the worker.
- **FINDING-033 — hardening**: `/swatch` downloads only from `cdn.discordapp.com` / `media.discordapp.net` over HTTPS, with a 10 s `AbortSignal.timeout`, `redirect: 'error'`, a Content-Length pre-check and a streamed 1 MiB cap that no longer trusts the Discord-reported `size`; `/stats` left the rate-limit exemption list (default 15/min per user — its public summary runs paginated KV `list()` scans); `/budget find|quick world:` overrides go through `validateWorld()` like `set_world`, so only a known world / data centre (canonical name) reaches the Universalis proxy and the price-cache key.

### Fixed — 2026-08-20 i18n audit remediation (`docs/audits/2026-08-20-discord-worker-i18n/`)

- **Seven `t.t()` keys that never existed** (`budget.noWorldSet.*`, `budget.errors.missingWorld|saveFailed|missingPreset`, `common.unknownError`, `preset.errors.notFound`) rendered raw dotted keys on `/budget` (no world set) and `/preset favorite` since 2026-02 — added / repointed, plus a reverse key-existence gate in bot-logic (F-01).
- **Localized dye-name input**: autocomplete and typed dye names match English *or* the user's locale (`searchDyesByName` / `findDyeByName`), choices are labelled with the localized name; every handler passes `t.getLocale()` into `resolveColorInput` (F-02).
- **Discord command localizations** (`src/commands/localize.ts`): `description_localizations` for all 17 commands and `name_localizations` for the preferences-reset, gender/theme, harmony-type, vision-lens and dye-category choice lists, attached by `register-commands.ts` (F-03 phase 1 — option descriptions and the remaining lists are phase 2).
- Rate-limit message, router/button/copy/extractor error replies, `PresetAPIError` messages (now `getSafeMessageKey()`), `/preferences` filter labels / theme / affected-commands / method and blending descriptions / world autocomplete, `/preset` list-submit-edit-vote-favorite replies, `/stats summary` — all through the translator (F-04, F-05a–d). The four `/stats` admin dashboards are documented as deliberately operator-English.
- `/swatch` generation failure no longer English-only (F-06); locale decimal separators for ratios, percents and ΔE tails, `card.perDe` (F-08); `Translator.tc()` plurals (`1 of 1 slots`, `1 Steps`, `second/seconds`) (F-09); consolidated market-item names in the user's locale on `/dye info` and the budget ledger (F-10); localized preset swatch card (F-11); handlers pass their logger into bot-logic so Translator misses are warned (F-13).
- **Fonts**: CJK subsets re-cut (they predated the `previewImage.*` keys); new `src/services/font-coverage.test.ts` asserts the bundled TTFs cover every locale string + code glyph, JP covers ja, KR covers Hangul; `subset-cjk-fonts.py` also reads `consolidated-ids.ts` (F-17).
- `index.test.ts` AUTOCOMPLETE block had been red since OPT-007 (unmocked `checkRateLimit`); fixed.

## [5.0.0] - 2026-08-16

The **5.0 command set** — the Discord half of the XIV Dye Tools 5.0 redesign (`docs/research/monorepo-2.0/`, Phases 0–5 plus the 2026-08-09 pre-release audit sprints and the bot-graphics conformance audit). Every card the bot draws was redrawn on the new `@xivdyetools/svg` frame system, the v4 command set is gone, `/contrast` and `/changelog` are new, and the Worker now sits on `@xivdyetools/core@4.0.0` / `types@2.0.0` / `svg@2.0.0` / `bot-logic@2.0.0` / `worker-kit@1.0.0`. Nothing in this entry has shipped yet — merging to `main` deploys production **and** runs `register-commands` (see Deploy window).

### ⚠️ BREAKING

- **v4 commands deleted**: `/match`, `/match_image`, `/favorites`, `/collection` and `/language` are gone from the schema, the dispatch switch, autocomplete and the handler barrel; `src/services/user-storage.ts` (favorites/collections KV) is deleted. `/preferences set language` owns language (legacy `i18n:user:*` KV keys already fold into `prefs:v1:*` on read); dye matching lives in `/extractor color`; saved palettes live in the web app. `/about` carries a "Removed in v5" field for one release naming where each went. **User-run:** `scripts/cleanup-v4-kv.ts` lists the orphaned `xivdye:favorites:v1:*` / `xivdye:collections:v1:*` / `i18n:user:*` keys and emits reviewed `wrangler kv key delete` commands — it never deletes anything itself.
- **Matching vocabulary**: every `matching` option (`/harmony`, `/extractor color|image`, `/gradient`, `/mixer`, `/budget find`, `/preferences set matching`) now offers core's six 5.0 methods — `ciede2000` (ΔE2000, **new default**, was `oklab`), `oklab` (ΔEOK), `cie76` (ΔE76), `redmean`, `rgb`, `distinguish` — and `hyab` / `oklch-weighted` are retired. Stored v4 preference values normalise on read via `normalizeMatchingMethod()` (no KV rewrite needed); `MatchingMethod` is re-exported from core rather than declared locally.
- **Schema reshaped** (all published by CI on merge): `/swatch` lost its `color` / `grid` subcommands and now takes a required `.chara` `file:` attachment (+ `order: slots|hardest`, `slot:` 7 choices); `/accessibility` went pair-based (`dye`, optional `dye2`, `vision: all|protanopia|deuteranopia|tritanopia|achromatopsia` — the `dye3`–`dye6` contrast inputs moved to `/contrast`, `normal` left the lens list); `/budget find` gained `matching`, `exclude_coffers`, `exclude_wide_spectrum` and re-scoped `max_distance` to the 2–20 ΔE2000 match line while `max_price` / `sort_by` / `max_results` were cut; `/preset` category choices dropped `community` (BUG-001 — Discord itself was vouching for a category the API no longer had) and gained `appearance`, `zones`, `raids-trials`.
- **Emoji mapping is stainID-keyed and per-application**: `getDyeEmoji(stainId, applicationId)` replaced `getDyeEmoji(dyeId)`; `src/data/emoji-mapping.json` is `byApplication[appId].{artwork, byStainId}`. All 15 call sites now pass `dye.stainID` (several were passing `dye.id` against an itemID-keyed map and could never have matched). Production's slot still records `artwork: "legacy-icons"`; the beta application's slot is on `chip-1`.
- **Dropped dependencies**: `@cf-wasm/photon` (moved to `xivdyetools-image-worker`), `@xivdyetools/bot-i18n` → `@xivdyetools/bot-logic/i18n`, `@xivdyetools/color-blending` → `@xivdyetools/core/blending`, `@xivdyetools/rate-limiter` + `@xivdyetools/worker-middleware` → `@xivdyetools/worker-kit` (+ `/rate-limiter`). New required binding: `IMAGE_WORKER` (Service Binding → `xivdyetools-image-worker`); `UNIVERSALIS_PROXY` now points at `xivdyetools-api-worker` (the universalis-proxy app was absorbed).

### Added

- **`/contrast`** (new command, `handlers/commands/contrast.ts`): WCAG 1.4.11 contrast for 2–4 dyes, routed by count — 2 → 13A (one pair, ratio at 30 px, band named by ratio), 3 → 13B ledger (every pair worst-first), 4 → 13C·1 log-axis plot with the 3 / 4.5 / 7 criterion lines. Four dyes is the schema-enforced limit; no AA/AAA letter grades anywhere in the bot any more.
- **`/a11y`**: a second registration with options identical to `/accessibility` (Discord has no alias mechanism); the card chip prints whichever the user typed.
- **`/changelog`** (new, ephemeral): renders the bot's own `apps/discord-worker/CHANGELOG-laymans.md` via `parseAll()` — newest release expanded, five collapsed one-liners, `version:` expands any recorded release (echoed through `sanitizeEmbedText(…, 64)` when unknown). The markdown is bundled into the Worker as a string — wrangler `[[rules]] type = "Text"` for `*.md`, typed by `src/types/markdown.d.ts`, mirrored for both vitest configs by `vitest.markdown-plugin.ts` — so there is no fetch, no KV cache and no "unavailable" path; the beta bot shows the beta's notes. (An earlier pre-release cut fetched the root product-level file from GitHub `main`; its version numbers were really the web app's and ~90 % of its bullets web-app changes, so `version:` could never match a bot release.) Long entries cut on a line boundary via `utils/text.ts#cutOnLineBoundary` with a `…` + link to the full file; `changelog-parser.test.ts` carries a contract test on the bundled file (grammar on every `##` header, versions strictly descending, newest entry never ahead of `package.json`, newest entry renders uncut); the parser is CRLF-tolerant. Skipped by the rate limiter alongside `about` / `manual`. Locale strings `changelog.title` / `commands.changelog.description` say "bot" in all six locales.
- **`/manual` topics**: six topics from core's `MANUAL_TOPICS` (`match_image` 📸, `color_vision` ♿, `contrast` 🔲, `matching_methods` 📐, `spectrum_prices` 🪙, `character_file` 👤) with localized name/body and a learn-more line (`[authority](url) - host`; a missing localized URL degrades to no link, never the English one). Spectrum & Prices resolves the Lodestone by game region from the stored world via Universalis.
- **`/preferences set theme` (`dark` | `light`, default `dark`)** — every card-generating handler passes the stored theme into its generator; `reset` and `show` learned the key. Light cards are opt-in via preferences; no first-run prompt.
- **`/swatch` character-file frame**: downloads the `.chara` attachment (1 MiB cap), `executeSwatch` resolves live slots via core's `parseCharaFile` + `resolveCharaColors`, renders the swatch card (merged eyes one row, heterochromia two; off-grid winners marked OFF GRID; past five live slots the safest match drops so `order:` shows the same five rows), `slot:` routes to the 14J·2 colour sheet with the slot colour as target. The embed carries what the PNG leaves out (off-grid hex pairs, lip raw-vs-blend, gear-dye stainIDs, dropped slots, `/manual 👤` pointer).
- **Preview-image moderation** (`handlers/buttons/preview-image.ts`, `services/preset-api.ts#setPreviewImageStatus`): `/webhooks/preset-submission` accepts a new `preview_image` payload (discriminated union on `type`) and posts a "picture pending review" embed with the `shots.xivdyetools.app` image and ✅/❌ buttons to `MODERATION_CHANNEL_ID` — with **this** bot's token, because Discord routes clicks to the app that posted the message; `previewimg_approve_` / `previewimg_reject_` call presets-api's `PATCH /api/v1/moderation/:id/preview-image` as the clicking moderator. Reject clears only the image, never the preset's status. Discord rejections return 502 so presets-api's retry/dead-letter path engages.
- **First-run notice**: a one-time ephemeral follow-up describing 5.0, gated by `firstrun:v5:{userId}` (flag set before send, so a failed send never repeats; suppressed silently for users with stored preferences).
- **`/about`**: roster built from `src/commands/registry.ts`, Version + Dyes (count read from the database) fields, "Built on" (Universalis, spectral.js), the full product/social link set from core, and the Square Enix attribution verbatim in every locale.
- **Command registry** (`src/commands/registry.ts`) + **schemas** (`src/commands/schemas.ts`): the 1,340-line schema literal moved out of `scripts/register-commands.ts`, which now refuses to publish on roster drift; `about.test.ts` asserts parity; `PRESET_CATEGORY_CHOICES` is typed against `PresetCategory` so a dropped union member is a compile error, and a structural test proves all three `/preset` category options route through it.
- **`/harmony`**: `inverted-tetradic` type (mirror rectangle — offsets 120/180/300).
- **`utils/brand.ts`**: `BRAND_ACCENT` (#EA4133) + a `STATE` vocabulary (success/warning/error/neutral/confirm) — one home for embed colours; blurple was declared in five files and used as a literal in three more.
- **Beta bot**: the top-level `wrangler.toml` env is now `xivdyetools-discord-worker-dev` (beta application `1536085517270261771`, its own KV namespace and Analytics Engine dataset, `workers_dev = true`, no routes; D1 and the service bindings are shared with production on purpose). `.github/workflows/deploy-discord-worker-beta.yml` deploys it on non-main pushes and registers commands **guild-scoped** when `BETA_DISCORD_TOKEN` / `BETA_DISCORD_GUILD_ID` are set. `emoji-mapping.json` carries the beta application's 125-emoji `chip-1` slot.

### Changed

- **`/mixer` default blending model is `ryb`** (`PREFERENCE_DEFAULTS.blending`), the same default as the web app's Mixer (first row of the 5C model order: "blue + yellow = olive") — it was `rgb`, so the same two dyes mixed differently on the two surfaces for anyone without a stored preference. The `mode` / `/preferences set blending` labels drop the "(recommended)" tag from OKLAB (no design document recommends one model over another)
- **Every card redrawn on the `@xivdyetools/svg` frame system** (400 px canvas, 350 px ceiling, `CARD_DARK` / `CARD_LIGHT`, command chip, app-icon mark, measured five-slot row): `/dye info` → 11B sheet (dye-coloured band, numeric grid, SRC/MKT rows incl. the consolidated Spectrum item, nearest-dyes strip); `/dye random` → 11B table (count clamped to 5); `/harmony` → 11A ideal-vs-found card (Turn-13 re-cut: 39 px rows, cap 4, angle lead per slot, method printed wherever a tier appears, weakest-slot verdict; the harmony wheel is deleted); `/extractor image` → 14K ramp (proportional band with all colours, top-five rows) and `/extractor color` → 14J·2 colour sheet (ranking flipped from raw RGB to ΔE2000 over the whole non-Facewear pool — the answer changes, not just the picture); `/gradient` → 12H strip over distinct dyes (three-stage row cap, per-step ΔE2000 kept, ≥4 steps collapsing to ≤2 rows renders the shorter verdict frame); `/mixer` → 12F ratio sweep at 25/40/50/65/80 % (the handler now defers and attaches a PNG for the first time; distances raw RGB → ΔE2000); `/accessibility` → 13D (one named lens) / 13E (`vision:all`, worst lens named) / 13H (single dye — a shift is not a risk, no verdict); `/comparison` → 14A duel (seven readouts) / 14C·2 triangle / 14C coded triangle for 2/3/4 dyes (`comparison-grid.ts` deleted, no `+N` tail); `/budget` → 13G ledger (see below).
- **Embeds collapse to one line + share URL** — the PNG is self-contained; no dye list printed twice, no instructions baked in. Emoji quality ladders and the old text builders are deleted.
- **`/budget` 13G model** (`services/budget/budget-calculator.ts#findBudgetLedger` replaces `findCheaperAlternatives`): tier-group pricing (Type-A = min(vendor 216 gil, board 52254) with a vendor-undercuts flag; B/C = the consolidated board figure only, scrip/credit never converted; board-only = own listing or null), gil-per-ΔE pinned to ΔE2000 regardless of the `matching` option, ΔE2000 match line 2–20, path exclusions drop whole groups but never the target, unpriced rows blank (never invented), pixel-budget row cap with omitted rows named in the embed, an already-the-floor target gets a sentence instead of an empty frame; method = option > KV preference > ΔE2000. Stale-if-error pricing (OPT-006) survives.
- **`/preferences` is now entirely ephemeral** — `show`, `set`, `reset`, `filters show|set|reset` were broadcasting settings to the channel while only the error paths were private; all 18 response sites use `ephemeralResponse()`.
- **`/stats`**: the dead "V4 Migration" panel became the "5.0 Adoption" panel (`/contrast` `/a11y` `/changelog` `/swatch` + an `extractor_image` / `extractor_color` split — `index.ts` now tracks the extractor subcommand).
- **`/extractor image` pixel extraction** goes over the `IMAGE_WORKER` service binding (`services/image-client.ts#extractImagePixels`, `POST /extract`); `services/image/{photon,validators,index}.ts` are deleted. This is what brought the deployed bundle from 3,209.3 KiB gzip (over Cloudflare's 3,072 KiB limit) to ~2,632 KiB (14.3 % free) — see `docs/operations/IMAGE_WORKER_SPLIT.md`.
- **Fonts**: `NotoSansJP-Subset.ttf` added (Japanese no longer renders in Chinese letterforms; the JP-first fallback is per-locale so `zh` never picks up JP glyphs), `FragmentMono-Regular.ttf` replaces `Habibi` for hex/numeric columns, and all three CJK subsets were re-cut after the 5.0 string work (128 tofu codepoints → 0 across ja/ko/zh; SC 1,129 / JP 556 / KR 489 codepoints, outline- and render-verified). `scripts/subset-cjk-fonts.py` gained the JP target, downloads sources into the git-ignored `scripts/.font-sources/` (outside wrangler's `**/*.ttf` glob), reads locale inputs from `bot-logic/src/i18n/locales`, and runs `fix_names` on SC too.
- **Emoji sync** (`scripts/upload-emojis.ts`): every chip is generated at run time from `dyes.json` (128 px rounded square of the dye hex, hairline inset ring, rendered with resvg-wasm — no out-of-repo art folder); sync gained update (`ARTWORK_VERSION` change = full regeneration), delete-orphans and a loud name-collision check; the script writes only the slot for the `DISCORD_CLIENT_ID` it uploaded to.
- **`/preset`**: dyes resolve via `dyeService.getByStainId()` (5.0 presets are stainID-keyed); `STATUS_DISPLAY` / `CATEGORY_DISPLAY` and test fixtures carry the widened `CommunityPreset` (`secondary_categories`, `preview_image_status`).
- **Release announcement** (`services/announcements.ts`): a long release now cuts on a line boundary (shared `utils/text.ts#cutOnLineBoundary`, the summary line budgeted inside the 4000-character figure) and says it is a summary linking the root `CHANGELOG-laymans.md` on GitHub — not `/changelog`, which shows the bot's own notes — instead of truncating mid-bullet behind a bare `...`; new `announcements.test.ts`; `changelog-parser.ts` parses the whole history (`parseAll()`, `parseLatestVersion = parseAll()[0]`) against the strict root `CHANGELOG-laymans.md` contract.
- **`wrangler.toml` deploy safety** (`docs/operations/DEPLOY_ENVIRONMENTS.md`): production config (`xivdyetools-discord-worker`, the two `bot.*` custom domains, `ANNOUNCEMENT_CHANNEL_ID` — vars are not inheritable) lives only under `[env.production]`; a bare `wrangler deploy` / `npm run deploy` deploys the beta bot and can no longer touch production.
- CORS `allowMethods` pinned to `['GET','POST','OPTIONS']` (hono 4.13 started advertising `QUERY` by default).
- `package.json` `license` corrected `ISC` → `MIT`.
- Docs: `README.md` rewritten from the audit template (command surface, licensing/attribution, Square Enix notice, Blog link dropped); `CLAUDE.md` rebuilt for the 5.0 command table, image-worker split, worker-kit and the beta/production deploy split.
- Tests: coverage 75.7/65.8/79.8/76.2 → 85.4/77.5/89.5/85.9 (statements/branches/functions/lines) with new suites for `/contrast`, `/changelog`, `/manual`, `/preferences`, the emoji per-application mapping, the safe Discord API wrappers, the registry/schema parity and the 13G ledger model; thresholds raised to 85/77/88/85 (branches is a ratchet — the gap is `src/index.ts` and `handlers/commands/preset.ts`); `src/test-utils.ts` excluded from coverage; three handler suites whose partial `vi.mock` factories made their render assertions vacuous now assert real calls. Thresholds are now **84/77/88/85** — the 2026-08-18 dead-code audit (see Removed) deleted fully-covered code (`component-context.ts`, the `preset-api.ts` moderation client), which dropped the achieved statements figure to 84.88% with nothing actually losing coverage, so `statements` moved down to match.
- **Follow-up 1 (adopts DEAD-012/013's flagged gap)**: `/preferences set count` now has a production reader — `/extractor color` resolves its match count as explicit `count` option → stored `/preferences` value → default, via `resolveCount()` (previously dead code). `PREFERENCE_DEFAULTS.count` changes `5` → `1` so a user who never sets the preference sees the same single-match output `/extractor color` always returned; `commands/schemas.ts`'s `/preferences set count` description now names `/extractor color` explicitly. `register-commands` picks up the description change on merge.

### Fixed

- **`/budget quick` choices resolve again** (2026-08-22 review of the `/changelog` change): the registered `preset` choice list still offered Pure White / Jet Black / Metallic Silver / Metallic Gold / Pastel Pink although 4.1.1 had replaced the three metallic/pastel picks with the 22 Cosmic dyes in `QUICK_PICKS` — so three of five choices hit `getQuickPickById()` → null → "Could not find quick pick preset". `schemas.ts` now generates the choices from `QUICK_PICKS` (22 ≤ Discord's 25) and the new `schemas.test.ts` asserts schema ↔ table parity; `register-commands` runs in CI on merge.
- **`/gradient` and `/harmony` resolve the matching method the same way as every other command** — option → stored preference → ΔE2000. `/gradient` had hard-coded `'oklab'` and ignored the stored preference entirely; `/harmony` passed `undefined` for a user with no stored preference, so bot-logic's own (`oklab`) default graded a first-time user's card on ΔEOK bands (`executeHarmony`/`executeGradient` defaults corrected in bot-logic 2.0.0 too)
- **`/extractor` options now do what the schema promises** — `matching` drives the ranking (`color`), the per-slot dye pick and every displayed distance (`image`), and the 14J·2 / 14K cards render that method's tier bars, column tag and "nearest by …" key line (`@xivdyetools/svg` method-aware rows); resolution is option → stored `/preferences` method → ΔE2000, like `/harmony`. `prevent_duplicates` on `image` is honoured (default on; `false` keeps each slot's true nearest dye). Removed from the schema: `vibrancy_boost` (never implemented anywhere) and `prevent_duplicates` on `color` (a nearest-N of distinct dyes cannot repeat) — `register-commands` runs in CI on merge
- **Rate limiting keyed on the 5.0 roster** — `resolveRateLimitScope()` canonicalises `/a11y` onto `/accessibility` so the alias no longer gets its own (default-tier) bucket, and passes `/extractor`'s subcommand so `image` (Photon path) is tiered at 5/min in its own bucket while `color` keeps 15/min (`@xivdyetools/worker-kit` `DISCORD_COMMAND_LIMITS` re-keyed in the same change)
- **BUG-001 (HIGH)**: the registered `/preset list|random|submit` schemas still offered the retired `🌐 Community` category (see BREAKING).
- **FONT-001**: 128 locale codepoints without glyphs rendered as tofu for ja/ko/zh users (see Fonts above).
- **Beta bot rendered bare `:dye_name:` text** — application emoji are owned by the uploading application; the mapping is now per-application and an application with no uploaded set gets no emoji rather than production's markup.
- **`/preferences` privacy** (see Changed) and the missing `ANNOUNCEMENT_CHANNEL_ID` in `[env.production.vars]`, which would have silently dropped the release-announcement channel once beta and production were separated.
- Dye-emoji lookups keyed by `dye.id` against an itemID-keyed map could never have matched (see BREAKING / emoji).
- Harmony card was frozen at the Turn-11 geometry (400×390, over the 350 px ceiling) and always scored ΔE2000 regardless of the chosen method (bot-logic / svg fixes A1–A7 of the graphics-conformance audit; `/comparison` was drawing tier tags at 9.5 px against an 11 px floor, caught by the new `frame-budget` guard in svg).
- The barrel-import test gets an explicit timeout (it flaked at the 5 s default under parallel load).

### Security

- `hono` floor `^4.12.32` → `^4.12.34` (resolves to 4.13.1; clears the four hono advisories incl. the CORS ReDoS reachable here); `wrangler` `^4.114.0` → `^4.120.0` (miniflare 5 / undici 7.29 — Sprint 6 dev-toolchain sweep).
- **Follow-up 3 (supersedes DEAD-019's "kept as-is")**: `services/preset-api.ts`'s `generateRequestSignature` now delegates to `@xivdyetools/auth`'s `hmacSignHex` instead of a hand-rolled `crypto.subtle` implementation — verified byte-for-byte identical against a pinned vector. `utils/env-validation.ts` now enforces `BOT_SIGNING_SECRET.length >= 32` whenever the secret is set (mirroring oauth's `JWT_SECRET` check), closing the gap that previously blocked the adoption. `utils/github-verify.ts` stays hand-rolled on purpose — GitHub imposes no minimum webhook-secret length.

### Removed (2026-08-18 dead-code audit)

- **`fonts-src/NotoSansSC-Regular.ttf`** (DEAD-008): a 10.6 MB static SC face left over from the pre-5.0 era; `subset-cjk-fonts.py` has cut the SC subset from the variable face only since 5.0 and never read this file.
- **`services/svg/index.ts`, `types/image.ts`, `handlers/modals/index.ts`** (DEAD-003): orphaned modules with zero non-test consumers — the SVG barrel (every caller imports `services/svg/renderer.js` directly), the pre-5.0 match-quality emoji ladder (`MatchQuality` / `MATCH_QUALITIES` / `getMatchQuality`, superseded by core's `classifyBandTier`), and the empty modal-handler placeholder (`handleModal` in `src/index.ts` already answers inline).
- **`services/component-context.ts`** (DEAD-001): the KV-backed button-context store (`buildCustomId`/`storeContext`/`getContext`/`updateContext`/`verifyContextUser`/`parseCustomId`) — rewritten in Phase 0.4 "to unblock pagination," but no pagination or stateful button flow ever consumed it; removed 2026-08-18, pagination context never shipped.
- **`services/preset-api.ts` moderation client** (DEAD-002): `getFeaturedPresets`, `deletePreset`, `getCategories`, and the whole moderation block (`getPendingPresets`, `approvePreset`, `rejectPreset`, `flagPreset`, `getModerationStats`, `getModerationHistory`, `revertPreset`) — preset moderation moved to `xivdyetools-moderation-worker`; this worker only ever kept `isModerator` + `setPreviewImageStatus` (preview-image approve/reject) live. `types/preset.ts` dropped its now-unused `ModerationStats` / `ModerationLogEntry` / `CategoryMeta` re-exports.
- **20 dead / test-only exports across services & utils** (DEAD-004, ~300 lines + dedicated tests): `resolvePreference`, `hasPreferences`, `resolveMarket` (`services/preferences.ts`); `UserWorldPreference` (`types/budget.ts`); `createHexButton` (`handlers/buttons/copy.ts` + barrel); `MAX_COLLECTION_NAME_LENGTH` / `MAX_COLLECTION_DESCRIPTION_LENGTH` / `sanitizeCollectionName` / `sanitizeCollectionDescription` (`utils/sanitize.ts` — dead since `/collection` left in v5); `SUPPORTED_LOCALES` / `LocaleInfo` / `getLocaleInfo` / `formatLocaleDisplay` (`services/i18n.ts` — `/preferences language` choices are hard-coded in `commands/schemas.ts`); `FONT_FAMILIES` / `getFontWithCjkFallback` / `hasCjkFont` (`services/fonts.ts` — duplicated `@xivdyetools/svg`'s `FONTS`); `safeSendFollowUp` / `deleteOriginalResponse` (`utils/discord-api.ts`); `renderSvgToDataUrl` (`services/svg/renderer.ts`); `isPresetFavorited` (`services/preset-favorites.ts`); `getConfiguredBackend` (`services/rate-limiter.ts`); the `getHarmonyTypeChoices` re-export (`handlers/commands/harmony.ts` + `commands/index.ts`); `searchDyes` / `getAllDyes` / `getCategories` (`services/budget/budget-calculator.ts` — 1-line `dyeService` wrappers); `getQuickPickChoices` (`services/budget/quick-picks.ts`); the `UPDATE_MESSAGE` / `MODAL` `InteractionResponseType` enum members (`types/env.ts`). `resetRateLimiterInstance` and `registryCommandNames` were kept (legitimate test hooks).
- **4 dead factories in `src/test-utils.ts`** (DEAD-005): `createMockExecutionContext`, `createMockDye`, `createMockDyes`, `createMockPreset` — zero non-test consumers; `createMockKV` / `createMockAnalytics` / `createMockEnv` stay (Task 5 territory). `createMockD1` itself is gone — see DEAD-007 below.
- **DEAD-005 consolidation (Task 5, 2026-08-18)**: `src/test-utils.ts`'s `createMockEnv` now composes `createMockKV` / `createMockAnalyticsEngine` from `@xivdyetools/test-utils/cloudflare` instead of two local 20-line reimplementations. Four of the eight per-file local `createMockKV` copies (`handlers/commands/about.test.ts`, `services/bot-i18n.test.ts`, `services/i18n.test.ts`, `services/preferences.test.ts`) were swapped to the same shared mock — none of them assert on the KV mock as a Vitest spy, so the swap is behavior-preserving. The other four (`handlers/commands/stats.test.ts`, `services/analytics.test.ts`, `services/preset-favorites.test.ts`, `services/rate-limiter.test.ts`) keep their local `vi.fn()`-wrapped `createMockKV` — they assert `toHaveBeenCalledWith`/`mockResolvedValueOnce` etc. directly on `.get`/`.put`/`.list`, which requires real Vitest spies; the shared mock's methods are plain functions, not spies, so swapping would break those assertions. `analytics.test.ts` and `rate-limiter.test.ts` also lean on local-only helpers (`_setWithMetadata`, `_clear`) the shared mock doesn't have.
- **`utils/color.ts` and `utils/verify.ts` re-export shims** (DEAD-006): both were pure pass-throughs left over from the 2026-07-30/31 package migrations. The 11 production call sites now import `resolveColorInput` / `dyeService` directly from `@xivdyetools/bot-logic`, and `index.ts` imports `verifyDiscordRequest` / `unauthorizedResponse` / `badRequestResponse` / `timingSafeEqual` directly from `@xivdyetools/auth`; `index.test.ts`'s ~30 `vi.mock('./utils/verify.js', …)` sites now mock `@xivdyetools/auth`, and `contrast.test.ts`'s `resolveColorInput` mock merged into its existing `@xivdyetools/bot-logic` mock. `utils/verify.test.ts` (220 lines) is deleted — it mocked `verifyDiscordRequest` and then tested the mock; the real coverage is `packages/auth/src/discord.test.ts`. Also trimmed: the unused `services/budget/index.ts` barrel lines (`fetchPrices`, `fetchPricesBatched`, `CACHE_TTL_SECONDS`, `getCachedPrice(s)`, `setCachedPrice(s)`, `fetchWithCache`, `QUICK_PICKS`, `UniversalisWorld`, `UniversalisDataCenter`), `handlers/buttons/index.ts`'s unused `handlePreviewImageButton` / `isPreviewImageButton` re-export line (both are live via direct import + routed at `index.ts`), `services/bot-i18n.ts`'s unused `LocaleCode` re-export, and `types/preset.ts`'s unused `PresetStatus` / `PresetSortOption` re-exports (12 other names in that block are still consumed).
- **`index.ts`'s local `DiscordInteraction` duplicate** (DEAD-009, ~65 lines): replaced with the exported `DiscordInteraction` from `types/env.ts` (which exists specifically to end this duplication). Reconciled the two field differences: added `data.component_type` and `data.options[].focused` to the shared type (both were on the local copy but missing from the exported one); dropped the local copy's unused `data.values` field (nothing reads it). `handlers/buttons/index.ts` and `handlers/buttons/preview-image.ts`'s own local `ButtonInteraction` shapes had `member.user.username` / `user.username` loosened from required to optional to stay structurally assignable from the now-optional-everywhere `DiscordInteraction` — full unification of the three `ButtonInteraction` shapes is still a follow-up.
- **Stale "legacy" comments and one unreachable branch** (DEAD-010): the "Legacy commands (deprecated in v4 …)" comments in `handlers/commands/index.ts` and `index.ts` — the handlers they described (accessibility, contrast, manual, changelog, comparison, preset, stats, budget) are all live 5.0 commands, not legacy; the actually-deprecated match/match-image handlers were deleted in cfb5f85. Also removed `index.ts`'s unreachable `ENVIRONMENT === 'development'` branch in the global error handler — this Worker has no `ENVIRONMENT` var in `wrangler.toml` (see DEAD-007), so `isDev` was always `false`.
- **Fixed a defect surfaced by the DEAD-010 audit**: `/stats health` tested `env.UNIVERSALIS_PROXY_URL` (never set in `wrangler.toml`) instead of the `UNIVERSALIS_PROXY` service binding, so it always reported Universalis "Not configured" in production. `handlers/commands/stats.ts` now calls the same `isUniversalisEnabled()` used by `services/budget/universalis-client.ts`.
- Added a comment (not a deletion — the sweep is a product decision) to `scripts/cleanup-v4-kv.ts` noting it has no cleanup step for the legacy `budget:world:v1:*` world/datacenter preference, which `services/preferences.ts`'s `migrateLegacyPreferences` still reads on first access.
- **DEAD-024 (adopt)**: `types/preferences.ts`'s `CLANS_BY_RACE` now derives its race/clan set from `@xivdyetools/types`' `RACE_SUBRACES` (zero importers at audit time) instead of hand-rolling its own copy of the game-data fact; the `/preferences clan` display order and label strings (`'Au Ra'`, `'Seeker of the Sun'`, etc.) are preserved verbatim through a small local display-name/order adapter. New `types/preferences.test.ts` asserts the derived table stays in lockstep with `RACE_SUBRACES` and that the pre-adoption order/labels are unchanged.
- **Dead D1 `DB` binding in both wrangler envs, dead `Env` fields, stale vitest excludes/mocks, unused `@/*` alias** (DEAD-007): the `[[d1_databases]]` block is deleted from both the top-level (beta) and `[env.production]` `wrangler.toml` environments, along with the comment claiming it was "shared with production on purpose, so /preset renders real data" — nothing has read `env.DB` since presets moved behind the `PRESETS_API` service binding. `Env.DB`, `Env.IMAGES` and `Env.ASSETS` (no R2 binding ever existed) are gone from `types/env.ts`; `utils/env-validation.ts` no longer requires the dead `DB` binding (+ its test case); `src/test-utils.ts` drops `createMockD1` and the `DB` field from `createMockEnv` (all callers updated). `vitest.config.ts` coverage excludes no longer list four paths that don't exist (`src/locales/**`, `services/svg/dye-info-card.ts`, `services/svg/random-dyes-grid.ts`, `services/svg/budget-comparison.ts`); its `include` glob now excludes `*.integration.test.ts` so `test:all` no longer runs `budget-pipeline.integration.test.ts` twice (`vitest.integration.config.ts` still owns it). The unused `@/*` → `./src/*` alias is gone from `tsconfig.json`, `vitest.config.ts` and `vitest.integration.config.ts` (zero imports used it). Three inert `vi.mock` calls targeting modules deleted by earlier 5.0/audit work are gone: `dye.test.ts`'s mocks of `services/svg/dye-info-card.js` and `random-dyes-grid.js`, and `preset.test.ts`'s mock of `services/svg/preset-swatch.js`. **Wave 1 complete.**
- **Wave 3a (Task 7, bot-logic tightening — DEAD-012/013)**: `handlers/commands/gradient.ts`'s inline match-quality ladder (distinct thresholds from core's) is replaced by a call to `classifyMatchDistance` from `@xivdyetools/types`, mapped onto the same live `quality.*` locale keys. `handlers/commands/mixer-v4.ts` no longer resolves or passes a `count` (`@xivdyetools/bot-logic`'s `MixerInput.count` / `MixerResult.matches`/`blendedHex`/`inputDyes` are gone — the extra nearest-dye searches they drove were pure waste per `/mixer` call); `commands/schemas.ts`'s `/mixer` command drops its now-inert `count` option (re-registration required). The general `/preferences set count` preference (`resolveCount`, `PREFERENCE_DEFAULTS.count`) is unchanged and now has no production reader — flagged as a follow-up, not removed here.
- **Wave 3b (Task 8, svg API tightening — DEAD-014 adopt `CATEGORY_DISPLAY`)**: `types/preset.ts`'s local `CATEGORY_DISPLAY` copy (byte-identical to `@xivdyetools/svg`'s) is deleted; `handlers/commands/preset.ts` now imports it from `@xivdyetools/svg` alongside `generatePresetSwatch`. `STATUS_DISPLAY` and `PresetAPIError` are unaffected.
- **Wave 3f (Task 12, DEAD-035 stale-default fix)**: `handlers/commands/extractor.ts`'s palette-deduplication path called `@xivdyetools/core`'s `dyeService.findDyesWithinDistance` without a `matchingMethod`, silently searching the alternative-dye neighborhood in plain RGB distance while the primary palette match used the user's chosen method. Now passes `matchingMethod` explicitly. (This is the same audit wave that removed `@xivdyetools/core`'s legacy positional/array/number call shapes and ~40 uncalled class methods — see that package's CHANGELOG.)
- **Wave 4a (Task 13, DEAD-037)**: new `types/preferences.test.ts` coverage asserts `MATCHING_METHODS`' `value` column equals core's `MATCHING_METHODS` tuple exactly (same values, same order) and carries no extra/missing entries — this app's list additionally carries the `/preferences` display `name`/`description` columns core has no reason to know about, so the two stay separate lists proven not to drift rather than merging into one shared table.

### Deploy window (release day)

1. Merging to `main` runs `.github/workflows/deploy-discord-worker.yml`: `wrangler deploy --env production` **and then `register-commands` globally** — the schema reshape above ships automatically; do not run it by hand first.
2. Deploy `xivdyetools-image-worker` **before** this Worker (the `IMAGE_WORKER` binding must resolve) and confirm `xivdyetools-api-worker` serves the absorbed `/api/v2/*` Universalis routes (`UNIVERSALIS_PROXY`).
3. **User-run:** `npm run upload-emojis` with **production** credentials (`DISCORD_CLIENT_ID=1447108133020369048`) — production's slot is on `legacy-icons`, so this deletes and re-uploads all 125 emoji as the 5.0 chips; deferred by decision until the audit sprints finished (they have). Run it only after the deploy that ships the stainID-keyed mapping.
4. **User-run:** `scripts/cleanup-v4-kv.ts` (list → review → delete) for the orphaned favorites/collections/i18n keys.
5. Beta bot (optional): Discord portal interactions URL, `DISCORD_TOKEN` / `DISCORD_PUBLIC_KEY` secrets on the dev worker, `BETA_DISCORD_TOKEN` / `BETA_DISCORD_GUILD_ID` repo secrets — see the beta runbook.
6. Presets D1 migrations (0007 community drop, stainID rewrite) are presets-api's, but `/preset` shows nothing sensible until they have run.

### Known issues (not fixed in this release — deferred to a 5.1 discord-worker release, decision 2026-08-16)

- **Resolved 2026-08-29 — see Unreleased.** `/preset submit` and `/preset edit` used to send `dye.id` (the legacy itemID) and validate 2–5 dyes, while presets-api 5.0 accepts **stainIDs (1–254) and 3–6 dyes** and rejects legacy IDs loudly ("looks like a legacy item ID"). Bot-side preset submission/editing therefore fails against the migrated API until the handler is moved to `dye.stainID` — tracked as the open "presets stainID P1" item; browsing/voting/favorites are unaffected.

## [4.7.0] - 2026-07-19

2026-07-18 audit remediation (Sprint 5) — bot reliability & bundle headroom.

### Fixed

- **BUG-009 (HIGH)**: moderation approve/reject buttons finally work — Discord routes component clicks to the application that owns the message, so embeds posted with the main bot's token could never reach moderation-worker's handlers. All three moderation-embed paths now go through one shared sanitized builder (`preset-notifications.ts`); when the new `MODERATION_BOT_TOKEN` secret is set, embeds post via the moderation application (buttons work); when unset, buttons are omitted with a `/preset moderate` hint instead of dead UI.
- **BUG-035**: throw-safe, outcome-checked Discord API wrappers (`safeEditOriginalResponse` / `safeSendFollowUp`) at every deferred call site — silent 4xx failures no longer strand users on an eternal "Bot is thinking…" with no log trail.
- **BUG-033**: Universalis aggregated responses use the world → DC → region scope cascade, so world-scoped `/budget` queries no longer report datacenter-minimum prices as the user's world price.
- **BUG-034**: `/preset` exact-name lookup fetches a full page (limit 25) so the exact match is actually reachable.
- **BUG-037**: `/stats` unique-user count follows KV list cursors (no 1,000-user cap).
- **BUG-072/074**: sanitization applied unconditionally in moderation embeds; webhook Discord-send failures return 502 so presets-api's retry/dead-letter engages; changelog fetch has a 10 s timeout; shaped `app.onError`.
- **BUG-073**: MODERATOR_IDS parsed via the shared `@xivdyetools/bot-logic` grammar (whitespace/comma + snowflake validation).
- **BUG-075**: component-context TTL capped at Discord's 15-minute interaction-token lifetime.

### Changed

- **OPT-006**: `/budget` serves stale-if-error prices (≤15 min old, flagged `pricesStale`) instead of failing during Universalis outages.
- **OPT-007**: preset favorites store denormalized `{id, name}` entries (v2 schema, lazy migration) — favorites autocomplete dropped from up to 50 service-binding subrequests per keystroke to zero; new fail-soft 60/min autocomplete rate limit.
- **OPT-008**: analytics no-op verification read deleted (3 fewer KV reads per command).
- **OPT-009**: ~21 MiB of unused full-size CJK source fonts moved out of wrangler's bundling reach (`fonts-src/`).
- **OPT-026**: `/budget` reads user preferences once per interaction via `createUserTranslatorWithPrefs`.
- **BUG-036** documented as a known limitation (single-blob KV read-modify-write race; durable fix needs a data migration).

## [4.6.1] - 2026-06-09

### Removed

Dead-code cleanup (DEAD-113 through DEAD-120) — removed unused exports with zero consumers, trimming roughly 1,300 lines from the module surface:

- **`src/utils/error-response.ts`**: deleted the entire file and its 344-line test suite. This was an unused "Error UX Standard V4" module — `ErrorCategory`, `ErrorCode`, `ErrorResponseOptions`, `createErrorEmbed`, `createErrorResponse`, `validationError`, `notFoundError`, `rateLimitError`, `externalError`, `internalError`, `permissionError`, `invalidHexError`, `invalidDyeError`, `invalidCountError`, `collectionNotFoundError`, `collectionLimitError`, `dyeAlreadyInCollectionError`, `presetNotFoundError`, `universalisError`, `renderError`, `adminOnlyError`, `guildOnlyError` — none had any callers; live handlers build error responses inline via `utils/response.ts`.
- **`src/utils/response.ts`**: removed unused `embedResponse()` and `autocompleteResponse()` builders.
- **`src/utils/verify.ts`**: removed the `VerificationResult` backwards-compatibility alias for `@xivdyetools/auth`'s `DiscordVerificationResult` — no remaining call sites referenced the old name.
- **`src/services/budget/price-cache.ts`** (+ re-export in `src/services/budget/index.ts`): removed `getCachedPriceWithStale()` and `invalidateCachedPrice()`, plus the now-unused `STALE_THRESHOLD_MS` constant — the stale-while-revalidate fallback was never wired into `/budget`'s call sites.
- **`src/services/component-context.ts`**: removed `deleteContext()` and `isAuthorized()` — context entries expire via Cache API TTL, and authorization is checked inline in button/modal handlers.
- **`src/services/emoji.ts`**: removed `getDyeEmojiOrFallback()`, `hasDyeEmoji()`, and `getEmojiCount()` — only `getDyeEmoji()` is used by SVG renderers.
- **`src/types/budget.ts`**: removed `SORT_DISPLAY` and `getDistanceQuality()` — superseded by the SVG budget-comparison card's own labeling.
- **`src/types/image.ts`**: removed `DiscordAttachment` and `ExtractedPaletteEntry` interfaces and the now-unused `Dye`/`RGB` type imports from `@xivdyetools/types` — extraction flows through `@xivdyetools/core`'s shared types instead.
- **`src/types/preferences.ts`**: removed `getRaceForClan()` — clan validation only needs `normalizeClan()`.
- **`src/types/preset.ts`**: removed the re-export of `PresetPreviousValues` from `@xivdyetools/types` — unused outside `presets-api`.
- **`src/test-utils.integration.ts`**: removed `createFullMockEnv()` and `assertDiscordJsonResponse()` — integration tests construct envs and assertions directly.

### Added

- **`src/services/preset-favorites.test.ts`** (22 tests, new file): full coverage for the `/preset favorite` KV-backed service introduced in 4.6.0 — `getPresetFavorites`, `addPresetFavorite`, `removePresetFavorite`, `isPresetFavorited`, including the `alreadyExists` / `limitReached` / `notFound` / `error` result branches and malformed-JSON / KV-failure recovery paths (with and without an injected logger).

### Fixed

- **Coverage threshold enforcement (Vitest 4)**: `vitest.config.ts`'s `coverage.thresholds` used the Vitest 1/2-era `{ global: { statements, branches, functions, lines } }` shape, which Vitest 4 silently ignores — `test:coverage` exited 0 even after statements coverage drifted to 84.89%, just under the documented 85% floor. Flattened to `coverage.thresholds.{statements,branches,functions,lines}` (the shape Vitest 4 actually reads) and closed the gap with the new `preset-favorites.test.ts` above. Coverage is now **86.39% statements / 76.73% branches / 88.69% functions / 86.66% lines**, all above the 85/75/85/85 thresholds.

---

## [4.6.0] - 2026-05-12

### Added — Web-app feature parity (2026-05-08)

This release closes the option-level gap between `/discord-worker` and the `web-app`. Where the web app exposed configurability that the bot didn't, the bot now mirrors it (within Discord's slash-command UX). Web-only UI affordances (live eyedropper, drag-drop, color-wheel widget, theme picker, share URLs) remain out of scope as they don't translate to slash commands.

- **`/harmony` — companion expansion + algorithm controls**: Added `companions` (1–3, default 1), `matching` (6 algorithm choices, including `oklch-weighted`), `strict_matching` (BOOLEAN), and `prevent_duplicates` (BOOLEAN). Companion expansion runs N closest-match lookups per harmony hue; `prevent_duplicates` dedupes globally across all output slots; `strict_matching` tightens the ΔE tolerance via `algorithm: 'deltaE', deltaEFormula: 'cie2000'`.
- **`/extractor color` and `/extractor image` — matching/dedupe/vibrancy**: Both subcommands gain `matching` (6 algorithm choices) and `prevent_duplicates` (BOOLEAN). The `image` subcommand additionally gains `vibrancy_boost` (BOOLEAN) and bumps `colors` from 1–5 to **3–10** (matching the web `ExtractorConfig`).
- **`/gradient` — wider step range + 4 new interpolation modes + 6th matching algorithm**: `steps` extended from 2–10 to **2–12** (web cap is 12). `color_space` now supports the 4 mixer-style modes in addition to the 5 hue-based ones — total 9 choices (`hsv|oklch|lab|lch|rgb|oklab|ryb|hsl|spectral`). `oklab|ryb|hsl|spectral` interpolation evaluates `blendColors()` from `@xivdyetools/color-blending` at N evenly-spaced ratios. `matching` adds `oklch-weighted` for parity with `/preferences set matching`.
- **`/mixer` — matching algorithm**: Added `matching` STRING option (6 choices) — the bot used a hardcoded match before; users can now pin a matcher per call.
- **`/accessibility` — 6 outfit slots + 5 vision modes**: Added `dye5` and `dye6` STRING options to mirror the web's 6-slot outfit comparison. Added `normal` and `achromatopsia` to the `vision` choice list (all 5 web vision modes now exposed). The contrast-matrix renderer in `@xivdyetools/svg` was updated to accept up to 6 dyes (was 4).
- **`/swatch color` and `/swatch grid` — OKLCH-Weighted matcher**: Added `oklch-weighted` choice to both subcommands' `matching` lists.
- **`/budget find` — explicit result count**: Added `max_results` INTEGER (1–20) — previously hardcoded to 5. Mirrors the web `BudgetConfig.maxResults`.
- **`/preset favorite` — preset favoriting (NEW subcommand group)**: Mirrors the web's preset-favorites system. Three subcommands: `add` (preset_name STRING, autocomplete from approved presets), `remove` (autocomplete from user's currently-favorited presets), `list` (renders the user's favorited presets in a compact embed). Storage: KV key `xivdye:preset_favorites:v1:{userId}` → JSON `string[]` of preset IDs. Cap: 50 favorites/user. Distinct from the existing dye-favorites namespace (`xivdye:favorites:v1:`) — no key collision.
- **`/preferences set` — display-option toggles**: Added 6 BOOLEAN options — `show_hex`, `show_rgb`, `show_hsv`, `show_lab`, `show_deltae`, `show_acquisition` — matching the web's `DisplayOptionsConfig`. The `/preferences reset` choice list also grew by 6 corresponding entries (final total: 15 choices, well under Discord's 25-choice limit). All 6 new flags default to `true`. Honored by the `/dye info` SVG card today; other renderers (palette grid, comparison grid, harmony wheel, gradient bar) read the same `DisplayOptions` shape and can be wired in a follow-up.

### Changed

- `@xivdyetools/bot-logic@1.2.0` → bumped to support 4 additional gradient interpolation modes, harmony-companion expansion, accessibility 6-dye support + achromatopsia, and `MixerInput.matchingMethod`.
- `@xivdyetools/svg@1.1.2` → `VisionType` widened to include `achromatopsia` (Brettel matrix already lived in `@xivdyetools/core`); `ContrastMatrixOptions.dyes` cap raised from 4 to 6; `dye-info-card.ts` now accepts an optional `displayOptions` flag set and conditionally emits HEX/RGB/HSV/LAB rows; new exported type `DisplayOptions` and constant `DEFAULT_DISPLAY_OPTIONS`.
- `@xivdyetools/bot-i18n@1.2.0` → 6 new locale keys per language (`preferences.keys.show*` and `preferences.descriptions.show*`) for the display-option labels in en/ja/de/fr/ko/zh.
- `getPresetFavorites` autocomplete walks 3 levels of option nesting (was 2) — required for `SUB_COMMAND_GROUP > SUB_COMMAND > option` introduced by `/preset favorite`.

### Deployment requirement

`pnpm --filter xivdyetools-discord-worker run register-commands` **must** be re-run after deploy so Discord's slash-command schema picks up the new options, choices, and the `/preset favorite` subcommand group. Existing `/preferences set` and `/preferences reset` invocations using the old key set continue to work — the additions are additive.

---

## [4.5.0] - 2026-04-29

### Removed

- **`/preferences set allied_society` slash-command option** + the corresponding `excludeAlliedSocietyDyes` mapping row in `preferences.ts`'s `FILTER_OPTIONS` table. Patch 7.5 dye consolidation collapsed the Allied Society vendor categories out of the dye database; the option was a no-op against current data. **Deployment requirement:** `pnpm --filter xivdyetools-discord-worker run register-commands` must be re-run after deploy so the Discord slash-command schema drops the `allied_society` choice. Existing user preferences referencing the removed key are silently ignored. Co-removed with `@xivdyetools/types@1.14.0` and `@xivdyetools/core@2.6.0`.

### Added

- **ARCH-002 consolidation fan-out integration test** (2026-04-28 audit): New `src/services/budget/consolidation-fanout.test.ts` (3 cases) closes the gap between unit-level coverage of `getMarketItemID` (in `@xivdyetools/core`) and the live budget pipeline:
  - With consolidation **active** (live state), three real Type-A consolidated dyes from `dyeDatabase` deduplicate to a single market query for itemID 52254 (proxy `vi.fn` mock asserts `toHaveBeenCalledTimes(1)`); the returned price fans back out so each original itemID resolves via `getMarketItemID` to the same `DyePriceData`.
  - With consolidation **inactive** (pre-patch state via `CONSOLIDATED_IDS.A/B/C = null` in a beforeEach/restore), the same three dyes produce three distinct market queries and each gets its own price.
  - Pinned regression for the 2026-02-05 Bug 3: the `itemID > 0` filter must strip Facewear synthetic-negative IDs before they reach the upstream proxy regex `^[\d,]+$`.

### Fixed

- **i18n FONT_SUBSET_AUDIT (HIGH)** (2026-04-28 audit): `scripts/subset-cjk-fonts.py` had two stale path resolutions left over from the monorepo restructure — `CORE_LOCALES_DIR` resolved to a non-existent `apps/xivdyetools-core/...` and `BOT_LOCALES_DIR` to `apps/discord-worker/src/locales/`, but bot UI strings now live in `packages/bot-i18n/src/locales/`. Both `if (os.path.exists(path))` silent skips made the script "succeed" while emitting subsets containing only ASCII; on the next re-run after CSV updates this would have produced tofu glyphs for all dye names. Both paths were corrected to the new package layout, and both silent skips were converted into `FileNotFoundError` so future restructures fail loudly.
- Stale doc comments in `src/services/fonts.ts` claiming subset sizes of "~222 KiB / ~155 KiB" replaced with the actual post-rerun sizes (~474 KiB SC / ~801 KiB KR) plus a pointer to `scripts/subset-cjk-fonts.py`.

### Changed

- Refreshed `src/fonts/NotoSansSC-Subset.ttf` (484 KiB, 1,179 glyphs) and `src/fonts/NotoSansKR-Subset.ttf` (820 KiB, 1,400 glyphs) from the corrected subsetter run covering all current core dye-name and bot-i18n locale strings.

---

## [4.4.0] - 2026-04-07

### Security

- **BUG-001**: Re-enabled strict TypeScript checks (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`); cleaned up ~80 unused variables, imports, and implicit return warnings

### Changed

- Migrated request-ID and logger middleware to `@xivdyetools/worker-middleware` shared package; deleted local `src/middleware/request-id.ts` and `src/middleware/logger.ts`
- **ARCH-001**: Removed `nodejs_compat` compatibility flag from `wrangler.toml` — worker uses only Web APIs

---

## [4.3.0] - 2026-04-03

### Added

- `/preferences filters set` subcommand — set dye type filter preferences (9 boolean toggles)
- `/preferences filters show` subcommand — display current filter settings
- `/preferences filters reset` subcommand — reset all filters to defaults
- `dyeFilters` field on `UserPreferences` interface
- All 4 command handlers (match, harmony, gradient, mixer) now pass user filter preferences to bot-logic

---

## [4.2.1] - 2026-03-18

### Fixed

- **ARCH-001**: Deploy workflow now triggers on changes to `bot-i18n`, `bot-logic`, `color-blending`, and `svg` packages (previously only tracked core, types, logger, auth, rate-limiter, crypto)

---

## [4.2.0] - 2026-03-14

### Changed

- Budget calculator uses `getMarketItemID()` from `@xivdyetools/core` for market board price lookups with deduplication (105 → ~20 API calls post-consolidation)
- Updated mock dye objects in test suites for new `consolidationType` and `isIshgardian` fields

---

## [4.1.2] - 2026-03-09

### Changed

- Updated `hono` from 4.12.3 to 4.12.5 (security: SSE injection, cookie injection, middleware bypass fixes)
- Updated `@cloudflare/workers-types` from 4.20260305.0 to 4.20260307.1
- Updated `wrangler` from 4.69.0 to 4.71.0
- Updated `@types/node` from 25.3.3 to 25.3.5

## [4.1.1] - 2026-03-01

### Changed

- **Budget quick picks**: Replace Metallic Silver, Metallic Gold, and Pastel Pink with all 16 Cosmic Exploration dyes and 4 Cosmic Fortunes dyes (22 total quick picks)
- Migrate type imports (`Dye`, `RGB`, `CharacterColorMatch`) across 8 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)

### Removed

- Remove dead `export * from '@xivdyetools/svg'` re-export from `services/svg/index.ts` — no discord-worker file imports via this path (DEAD-082)
- **Dead code cleanup — Wave 5** (DEAD-020 through DEAD-023 from 2026-02-28 audit)
  - 6 dead service/util files never imported in production: `pagination.ts`, `progress.ts`, `image-cache.ts`, `color-blending.ts`, `user-preferences.ts`, `css-colors.ts` — plus their test files (DEAD-020)
  - 6 orphaned locale JSON files in `src/locales/` — duplicates of `@xivdyetools/bot-i18n` package data (DEAD-021)
  - Legacy `handleMixerCommand` handler replaced by `handleGradientCommand` in v4 — removed `mixer.ts`, `mixer.test.ts`, barrel re-export, and test mocks (DEAD-022)
  - Unused `discord-interactions` devDependency — signature verification uses native Web Crypto API (DEAD-023)
- **Dead code cleanup — Wave 6** (DEAD-024 through DEAD-031 from 2026-02-28 audit)
  - `InteractionContext` class, deadline helpers, and `DeadlineResult` interface — speculative DISCORD-PERF-001 code never integrated into handlers (DEAD-024)
  - 4 unused component builders in `component-context.ts`: `buildBlendingModeSelect`, `buildMatchingMethodSelect`, `buildMarketToggleButton`, `buildRefreshButton` + `SelectMenuOption` interface (DEAD-025)
  - Un-exported `sanitizeDisplayText` (internal-only), removed `sanitizeErrorMessage` and `ERROR_CODE_DESCRIPTIONS` (DEAD-026)
  - Legacy KV preference functions `setUserLanguagePreference` and `clearUserLanguagePreference` from `i18n.ts` — replaced by unified preferences system; `getUserLanguagePreference` kept as internal-only (DEAD-029)
  - 3 unused re-exports (`translate`, `getAvailableLocales`, `isLocaleSupported`) and `LocaleData` type from `bot-i18n.ts` (DEAD-035)
  - Prefixed 4 unused handler `ctx` params with `_` for interface conformance (DEAD-027 partial)
  - DEAD-030 (`test-utils.integration.ts`) skipped — still imported by budget-pipeline integration tests

## [4.1.0] - 2026-02-27

### Added

- **Prevent Duplicate Results**: `/extractor image` now deduplicates dyes across palette slots — when a monochromatic image causes multiple extracted colors to match the same dye, later slots are reassigned to the next-best unique alternative via `findDyesWithinDistance()`. Always on (no toggle needed with max 5 slots and 136 dyes)

### Fixed

- **ESLint v10 compatibility**: Fix lint errors for new `eslint:recommended` rules
  - `prefer-const`: Convert `uniqueUsersToday` to const in `analytics.ts`
  - `preserve-caught-error`: Add `{ cause: error }` to re-thrown errors in `photon.ts`, `validators.ts`, and `renderer.ts` (2 locations)

## [4.0.2] - 2026-02-21

### Fixed

- Fix `targetDye.hex` reference bug in budget handler
- Fix `stats.test.ts` mock to reject with raw string instead of Error object

### Changed

- Fix 85+ lint errors (unused imports, unsafe type assertions, no-floating-promises, require-await, no-case-declarations)

## [4.0.1] - 2026-02-09

### Fixed

- **BUG-001**: Fixed LocalizationService singleton race condition under concurrent requests
  - Replaced global singleton mutation with per-locale instance cache (`Map<LocaleCode, LocalizationService>`)
  - `getLocalizedDyeName()` and `getLocalizedCategory()` now accept explicit `locale` parameter
  - Updated all 16 command handlers to pass locale explicitly, eliminating shared mutable state
- **BUG-002**: Fixed budget "no world set" displaying a broken image embed
  - JSON responses cannot carry file attachments; replaced with text-only ephemeral response
- **BUG-003**: Fixed `renameCollection()` missing input sanitization
  - Added `sanitizeCollectionName()` call to match `createCollection()` behavior
  - Prevents control characters, Zalgo text, and invisible Unicode in renamed collections
- **BUG-004**: Added timeouts to `sendFollowUp()` and `editOriginalResponse()` Discord API calls
  - 5-second timeout (`AbortSignal.timeout`) for JSON webhook requests
  - 10-second timeout for multipart/file upload requests (larger payloads need more time)
  - Deadline-aware wrappers (`sendFollowUpWithDeadline`, `editOriginalResponseWithDeadline`) skip calls when Discord's 3-second interaction deadline is exceeded
- **BUG-005**: Fixed GitHub webhook reading entire body before checking payload size
  - Added `Content-Length` header pre-check before `c.req.text()` to reject oversized payloads without buffering
  - Retains post-read body length check as defense-in-depth (in case header is missing or spoofed)
- **BUG-007**: Fixed unique user tracking race condition and unbounded KV value growth
  - Replaced single comma-separated string (`stats:users:{date}`) with individual KV keys (`usertrack:{date}:{userId}`)
  - Eliminates read-modify-write race condition (concurrent requests could lose user IDs)
  - Each key is a fixed 1-byte value with TTL auto-expiry instead of an ever-growing string
  - Read-first optimization conserves KV write quota (100k reads/day free vs 1k writes/day)

### Changed

- **REFACTOR-001**: Consolidated duplicate `resolveDyeInput()` from `favorites.ts` and `collection.ts` into `utils/color.ts`
  - Fixes subtle Facewear fallback bug: previously returned a Facewear dye when all search results were Facewear, now correctly returns `null`
  - Both deprecated handlers import from the single shared implementation
- **REFACTOR-002**: Consolidated 9 duplicate `DyeService` instantiations into single shared singleton
  - `utils/color.ts` exports the canonical `dyeService` instance; all other files now import it
  - Eliminates 8 redundant `new DyeService(dyeDatabase)` calls across `index.ts`, `dye.ts`, `favorites.ts`, `collection.ts`, `match-image.ts`, `preset.ts`, `swatch.ts`, and `budget-calculator.ts`
- **REFACTOR-004**: Localized all preferences command strings across 6 languages
  - Preference key labels, display values, validation messages, and subcommand responses use `t.t('preferences.*')` i18n keys
  - ~30 locale keys added to en, ja, de, fr, ko, zh locale files

### Performance

- **OPT-001**: Added 1-hour in-memory cache for world/datacenter autocomplete data
  - `getWorldAutocomplete()` and `validateWorld()` now use cached results
  - Eliminates redundant HTTP requests on every Discord autocomplete keystroke
- **OPT-002**: Pre-filter dyes by color distance before fetching market prices in `/budget find`
  - Calculates color distance (CPU-only) for all 136 tradeable dyes, then fetches prices only for candidates within `maxDistance`
  - Reduces Universalis API calls by 70–85% on cold cache (typically 15–40 candidates instead of 136)
- **OPT-004**: Removed unnecessary SVG→PNG generation in budget "no world set" path
  - The rendered image was never attached to the response (wasted ~50-100ms CPU per invocation)

### Dependencies

- Bumped `@cloudflare/workers-types` to 4.20260207.0
- Bumped `hono` to 4.11.9
- Bumped `@types/node` to 25.2.2

---

## [4.0.0] - 2026-02-05

### Added

#### V4 Infrastructure (Phase 1)
- **Unified Preferences System**: Centralized user settings management with KV storage and migration from legacy keys (`i18n:user:*`, `budget:world:v1:*`)
  - 8 configurable preferences: language, blending, matching, count, clan, gender, world, market
- **Image Caching Service**: Cloudflare Cache API wrapper for SVG→PNG render results with TTL strategy (24h standard, 2h with market data)
- **Error UX Standard**: 6 error categories (validation, notFound, rateLimit, external, internal, permission) with consistent styling and error codes
- **Component Context Storage**: KV-backed context storage for Discord message components with short hash keys and TTL
- **Pagination System**: Button-based navigation for large result sets with 5-button (full) and 3-button (compact) layouts
- **Progress Feedback Service**: Status updates for long-running operations via deferred Discord responses

#### New Commands (Phases 2-3)
- `/extractor` - Merges `/match` and `/match_image` into one command
  - `color` subcommand: find closest dye(s) to a hex color or dye name
  - `image` subcommand: extract colors from image and match to dyes
- `/gradient` - Renamed from `/mixer`, generates color gradients between two colors with dye matches
  - Added color space interpolation: HSV (default), OKLCH, LAB, LCH, RGB
  - Added matching algorithm selection: OKLAB, CIEDE2000, CIE76, HyAB, RGB
- `/preferences` - Unified settings management (show/set/reset) for all 8 user preferences
  - Enhanced `set` subcommand to accept multiple options in a single invocation
- `/mixer` (NEW) - Dye blending with 6 color algorithms: RGB, LAB, OKLAB, RYB, HSL, Spectral (Kubelka-Munk)
- `/swatch` - Character color matching for skin, hair, eyes, highlights, lips, tattoos, facepaint across all 16 FFXIV clans
- `/stats` - Expanded from single embed to 5 subcommands: summary (public), overview, commands, preferences, health (admin)

#### Command Enhancements (Phase 5)
- `/comparison`: Added LAB color values (perceptual color space) with increased section height
- `/dye info`: New visual result card showing large color swatch, dye name, category, HEX/RGB/HSV/LAB values, and internal IDs
- `/dye random`: New visual infographic grid with 5-dye card layout, 3-column grid with centered last row
- `/harmony`: Added `color_space` parameter for hue rotation (HSV, OKLCH, LCH, HSL)

#### CJK Font Rendering
- Bundled subsetted Noto Sans SC (Chinese/Japanese, ~222 KiB) and Noto Sans KR (Korean, ~155 KiB) for proper glyph rendering
- Updated 7 SVG templates with CJK font fallback chains
- Added `scripts/subset-cjk-fonts.py` for re-subsetting when locales change

#### Changelog Announcement System (Phase 7)
- GitHub webhook endpoint listening for pushes to main branch
- Detects CHANGELOG-laymans.md changes, parses latest version entry
- Posts rich Discord embed to announcement channel
- New files: `github.ts` types, `github-verify.ts`, `changelog-parser.ts`, `announcements.ts`

#### CI/CD
- GitHub Actions workflow for automated Cloudflare deployment with CJK font support

### Changed

#### Localization (Phase 6)
- Added locale sections for all v4 commands (swatch, preferences, stats, gradient, extractor, mixer blending modes, pagination, components, matching methods) across all 6 languages
- Localized `/about` command categories and descriptions
- Localized `/mixer` and `/swatch` commands with full i18n support
- Migrated `extractor.ts` from `match.*` to `extractor.*` locale keys
- Migrated `gradient.ts` from `mixer.*` to `gradient.*` locale keys
- Added multilingual support for webhook notifications and admin message formatting

#### Command Deprecations (Phase 4)
- `/language` → Soft deprecated, delegates to `/preferences set language` with yellow deprecation notice
- `/favorites` → Soft deprecated, points to `/preset` with deprecation warnings
- `/collection` → Soft deprecated, points to `/preset` with deprecation warnings
- Command registration updated with `[DEPRECATED]` prefixes

#### Command Registration (Phase 8)
- Removed deprecated commands from registration: `/match`, `/match_image`, `/favorites`, `/collection`
- Final command set: 15 commands (about, harmony, dye, extractor, gradient, mixer, accessibility, manual, stats, preferences, swatch, comparison, language, preset, budget)

#### Dependencies
- Bumped `@xivdyetools/core` to ^1.16.0 (color space support, Korean/Chinese dye names)
- Bumped `@xivdyetools/auth` to ^1.0.2 (timing-safe JWT and HMAC verification)
- Bumped `@xivdyetools/logger` to ^1.1.2 (expanded secret redaction, recursive nested redaction)
- Bumped `@xivdyetools/rate-limiter` to ^1.3.0 (IP spoofing mitigation, IPv6 normalization, KV key safety)
- Bumped `@cloudflare/workers-types` to 4.20260131.0
- Bumped `hono` to 4.11.7
- Bumped `wrangler` to 4.61.1

### Security

#### Dependency Security Audit (2026-02-06)
- **FINDING-001** (auth): JWT signature verification now uses `crypto.subtle.verify()` for timing-safe comparison
- **FINDING-002** (auth): HMAC base64url verification upgraded to timing-safe `crypto.subtle.verify()`
- **FINDING-003** (rate-limiter): `getClientIp()` now supports `trustXForwardedFor` option to disable spoofable header fallback
- **FINDING-005** (logger): Added 6 new secret redaction patterns (`client_secret`, `private_key`, `signing_key`, `webhook_secret`, `auth_token`, `credentials`)
- **FINDING-006** (rate-limiter): IP addresses normalized to lowercase, preventing IPv6 case mismatches in rate-limit keys
- **FINDING-007** (rate-limiter): KV key delimiter changed to avoid ambiguity with IPv6 colons
- **FINDING-008** (logger): Context field redaction now recurses into nested objects (up to 3 levels)
- Full audit report: `xivdyetools-docs/audits/2026-02-06/SECURITY_AUDIT_REPORT.md`

### Fixed

- `/extractor image` quality badges (EXCELLENT, GOOD, FAIR) now vertically centered in each palette row instead of aligned to bottom text baseline
- `/swatch` grid command registration now advertises 1-based row/col ranges matching handler validation
- `/budget` command failures resolved:
  - Use `fetchPricesBatched` for >100 dyes on cold cache
  - Rewrite Universalis aggregated API response parsing to match actual array-based format
  - Filter Facewear dyes with synthetic negative itemIDs (`itemID > 0`)
  - Migrate from legacy user-preferences to unified preferences system
  - Added full i18n support with CJK font fallbacks for SVG graphic

### Performance

- Migrated component context storage from KV to Cache API (eliminates ~1 KV write per interactive command)
- Migrated price cache from KV to Cache API (eliminates ~136 KV writes per `/budget` command)
- Migrated rate limiting from KV to Upstash Redis (atomic operations, eliminates race conditions from DISCORD-BUG-001)
  - Upstash preferred when configured, automatic fallback to KV if not
  - Uses Redis `INCR` for truly atomic counter increments
  - 10,000 free commands/day vs KV's 1,000 writes/day
- All migrations combined keep the worker well within free-tier limits

---

## [2.3.9] - 2026-01-26

### Security

- Added pre-commit hooks for security scanning (detect-secrets, trivy)
  - Scans for accidentally committed secrets before push
  - Vulnerability scanning for dependencies and container images

### Changed

- Added Dependabot configuration for automated dependency updates
  - Weekly npm dependency updates
  - Weekly GitHub Actions updates

### Fixed

- Updated test suite for `@xivdyetools/auth` migration (REFACTOR-003 follow-up)
  - Fixed `verify.test.ts` to mock shared auth package instead of deprecated `discord-interactions`
  - Fixed `analytics.test.ts` mock to properly support OPT-002 list() optimization

---

## [2.3.8] - 2026-01-26

### Changed

- **REFACTOR-003**: Migrated authentication utilities to `@xivdyetools/auth` shared package
  - Discord signature verification now uses `verifyDiscordRequest()` from shared package
  - Timing-safe comparison now uses `timingSafeEqual()` from shared package
  - Reduces code duplication across Discord workers

---

## [2.3.7] - 2026-01-25

### Changed

- **REFACTOR-002**: Migrated KV-based rate limiting to `@xivdyetools/rate-limiter` shared package
  - Uses `KVRateLimiter` with `getDiscordCommandLimit()` for command-specific limits
  - Preserves per-user, per-command rate limiting pattern
  - Fail-open behavior maintained via shared package implementation

---

## [2.3.6] - 2026-01-25

### Performance

- **OPT-002**: Optimized analytics `getStats()` using KV list() with metadata
  - Stores counter values in KV metadata during `incrementCounter()`
  - `getStats()` now uses single `kv.list()` call instead of 14+ individual gets
  - Removes hardcoded command list - dynamically discovers all tracked commands
  - Includes backward compatibility fallback for counters without metadata
  - **Reference**: Security audit OPT-002 (2026-01-25)

---

## [2.3.5] - 2026-01-25

### Security

- **FINDING-004**: Updated `hono` to ^4.11.4 to fix JWT algorithm confusion vulnerability (CVSS 8.2)
- **FINDING-005**: Updated `wrangler` to ^4.59.1 to fix OS command injection in `wrangler pages deploy`

---

## [2.3.4] - 2026-01-19

### Fixed

- **DISCORD-BUG-001**: Fixed non-atomic counter increment in analytics. Added optimistic concurrency with retries and version tracking via KV metadata to prevent lost updates under concurrent load
- **DISCORD-BUG-002**: Verified Analytics.writeDataPoint already had try-catch error handling with logger support (no changes needed)

### Refactored

- **DISCORD-REF-001**: Extracted shared color utilities to `src/utils/color.ts`
  - `isValidHex()` - Supports both 6-digit and optional 3-digit shorthand validation
  - `normalizeHex()` - Ensures `#` prefix and expands 3-digit to 6-digit (`#F00` → `#FF0000`)
  - `resolveColorInput()` - Flexible options for different command needs
  - Reduced ~110 lines of duplicated functions across 5 command handlers

---

## [2.3.3] - 2026-01-07

### Added

- **Localization**: Added `matchImageHelp` section translations for all supported languages
  - German (de), French (fr), Japanese (ja), Korean (ko), Chinese (zh)
  - Ensures feature parity with English locale for `/match_image` help command

### Changed

- Updated @xivdyetools/core to 1.5.6 (fixes missing metallic dye IDs)

## [2.3.2] - 2026-01-05

### Added

- **Text Sanitization Utility**: New `src/utils/sanitize.ts` module for secure text handling
  - `sanitizeDisplayText()` - Removes control characters, zalgo text, invisible Unicode
  - `sanitizePresetName()` / `sanitizePresetDescription()` - Preset-specific sanitization
  - `sanitizeCollectionName()` / `sanitizeCollectionDescription()` - Collection-specific sanitization
  - `sanitizeErrorMessage()` - Converts HTTP status codes to safe user messages

### Security

#### Medium Priority Audit Fixes (2026-01-05 Security Audit)

- **M-001**: Sanitized preset names/descriptions before display in Discord embeds
  - Preset webhook embeds now use `sanitizePresetName()` and `sanitizePresetDescription()`
  - Prevents zalgo text, invisible characters, and display issues

- **M-002**: Added character validation for collection names
  - `createCollection()` now sanitizes names/descriptions before storage
  - Removes control characters, normalizes whitespace, enforces length limits

- **M-003**: Sanitized API error messages shown to users
  - Added `getSafeMessage()` method to `PresetAPIError` class
  - Error handlers now use safe messages instead of raw upstream errors
  - Prevents exposing internal API details to end users

---

## [2.3.1] - 2025-12-24

### Changed

- Updated `@xivdyetools/core` to ^1.5.3 for latest bug fixes and performance improvements
- Updated `@xivdyetools/logger` to ^1.0.2 for improved log redaction patterns
- Updated `@xivdyetools/types` to ^1.1.1 for new Dye fields and branded type documentation

---

## [2.3.0] - 2025-12-24

### Changed

#### Low Priority Audit Fixes

- **DISCORD-MED-003**: Added KV schema versioning for future data migrations
  - Added `KV_SCHEMA_VERSION` constant (`v1`) to key prefixes in `user-storage.ts`
  - Keys now follow pattern: `xivdye:favorites:v1:userId`
  - Enables non-breaking schema evolution when data format changes
  - **Note**: Existing user favorites/collections reset (users can rebuild)

### Fixed

#### Security Audit - Critical Issues Resolved

- **DISCORD-CRITICAL-001**: Fixed analytics tracking to use actual command success status
  - Analytics now tracks after command execution, not before
  - Wraps command execution in try-catch to capture failures
  - Provides accurate success/failure metrics for monitoring
- **DISCORD-CRITICAL-002**: Documented race condition in collection autocomplete
  - Added explanatory comment about stale dye counts during concurrent modification
  - Full fix would require schema changes (version/etag on collections)
- **DISCORD-CRITICAL-003**: Fixed timing-safe comparison bypass in webhook auth
  - Separated secret configuration check from auth verification
  - Prevents timing oracle attack to detect configured vs unconfigured secrets

---

## [2.2.0] - 2025-12-15

### Added

#### User Ban System
- `/preset ban_user` - Ban a user from Preset Palettes (moderators only)
  - Autocomplete searches preset authors by username
  - Shows confirmation embed with user details and last 3 presets
  - Modal for entering ban reason
  - Hides all user's presets on ban
- `/preset unban_user` - Unban a user (moderators only)
  - Autocomplete searches currently banned users
  - Restores hidden presets on unban

#### New Files
- `src/types/ban.ts` - Type definitions for ban system
- `src/services/ban-service.ts` - Core ban operations (check, search, ban, unban)
- `src/handlers/commands/preset-ban.ts` - Subcommand handlers
- `src/handlers/buttons/ban-confirmation.ts` - Confirmation button handlers
- `src/handlers/modals/ban-reason.ts` - Ban reason modal handler

### Changed

- Updated `/preset` command registration with ban_user and unban_user subcommands
- Added `hidden` status to STATUS_DISPLAY for banned user presets
- Added autocomplete routing for ban/unban user searches
- Added modal routing for ban reason input

---

## [2.1.1] - 2025-12-15

### Fixed

- **Authentication**: HMAC signatures now sent with Service Binding requests, not just URL fallback
  - Previously, HMAC signing code was inside the `else` block for URL-based requests
  - Service Binding requests were missing signatures, causing "Valid authentication required" errors
  - Voting and other authenticated operations now work correctly via Service Binding
- **Production Config**: Added missing bindings to `[env.production]` in `wrangler.toml`
  - KV namespace, D1 database, Service Binding, and Analytics Engine were not inherited
  - Preset autocomplete and other features now work in production

### Changed

- Updated `wrangler.toml` documentation to clarify `BOT_SIGNING_SECRET` is required

---

## [2.1.0] - 2025-12-14

### Added

- **Structured Logging**: Complete migration to `@xivdyetools/logger/worker` for structured request logging
- **Request Logger Middleware**: New middleware for consistent request/response logging
- **Deadline Tracking**: Added 3-second deadline tracking for Discord interaction timeout handling (DISCORD-PERF-001)

### Changed

- **Dependency Migration**: Migrated from `xivdyetools-core` to `@xivdyetools/core`
- **Types Migration**: Migrated `types/preset.ts` to use `@xivdyetools/types`
- **Logging Refactor**: Replaced all `console` calls with structured logger

### Fixed

- **Security**: Added HMAC signature to preset API fallback requests
- **Security**: Strengthened SSRF protection with redirect validation
- **Security**: Added cross-cutting security improvements
- **Rate Limiter**: Addressed HIGH severity rate limiter audit findings
- **Medium Severity**: Addressed MEDIUM severity audit findings
- **Tests**: Updated test mocks and expectations for logger migration

### Deprecated

#### Type Re-exports
The following re-exports from `src/types/preset.ts` are deprecated and will be removed in the next major version:

- **Preset Types** (PresetStatus, PresetCategory, CommunityPreset, etc.): Import from `@xivdyetools/types` instead
- **Request Types** (PresetFilters, PresetSubmission, etc.): Import from `@xivdyetools/types` instead
- **Response Types** (PresetListResponse, VoteResponse, etc.): Import from `@xivdyetools/types` instead
- **Moderation Types** (ModerationLogEntry, ModerationStats): Import from `@xivdyetools/types` instead

**Note:** Project-specific types (PresetNotificationPayload, PresetAPIError, CATEGORY_DISPLAY, STATUS_DISPLAY) remain unchanged.

**Migration Guide:**
```typescript
// Before (deprecated)
import { PresetStatus, CommunityPreset } from '@/types/preset';

// After (recommended)
import type { PresetStatus, CommunityPreset } from '@xivdyetools/types';
```

---

## [2.0.1] - 2025-12-08

### Changed

#### About Command Enhancement
- `/about` now displays all 17 available commands organized by category
- Version number is dynamically imported from `package.json`
- Commands grouped: Color Tools, Dye Database, Analysis, Your Data, Community, Utility
- Added invite bot link and timestamp
- Added Patreon link to support resources

### Files Added
- `src/handlers/commands/about.ts` - Dedicated about command handler

### Files Modified
- `src/handlers/commands/index.ts` - Export about handler
- `src/index.ts` - Route to about handler instead of inline response

---

## [2.0.0] - 2025-12-08

### Added

#### Stats Command
- `/stats` - Display bot usage statistics (authorized users only)
- KV-based counters for real-time stats (total commands, success rate, top commands)
- Analytics Engine integration for long-term storage
- Access controlled via `STATS_AUTHORIZED_USERS` secret

#### Manual Command Enhancement
- `/manual topic:match_image` - Dedicated help for image matching
- Three comprehensive embeds: How It Works, Examples, Technical Details
- Full localization support in `matchImageHelp` namespace

#### Analytics Service
- New `src/services/analytics.ts` for command tracking
- Automatic tracking of all command executions
- Unique user counting per day
- Command breakdown statistics

### Changed

- **Version bump to 2.0.0** - This release marks full feature parity with the deprecated traditional bot
- Updated `wrangler.toml` with Analytics Engine binding
- Updated `src/types/env.ts` with `ANALYTICS` and `STATS_AUTHORIZED_USERS`
- Enhanced `src/handlers/commands/manual.ts` with topic parameter support

### Deprecated

- The traditional `xivdyetools-discord-bot` (Node.js/Discord.js) is now fully deprecated
- Moved to `_deprecated/` folder in the monorepo
- This worker is now the sole Discord bot for XIV Dye Tools

### Files Added
- `src/services/analytics.ts` - Analytics tracking service
- `src/handlers/commands/stats.ts` - Stats command handler

### Files Modified
- `wrangler.toml` - Added Analytics Engine binding
- `src/types/env.ts` - Added new environment types
- `src/handlers/commands/manual.ts` - Added topic parameter
- `src/handlers/commands/index.ts` - Export stats handler
- `src/index.ts` - Route stats command, add analytics tracking
- `src/locales/en.json` - Added matchImageHelp translations
- `scripts/register-commands.ts` - Added stats command and manual topic option
- `package.json` - Version 2.0.0
- `CLAUDE.md` - Updated documentation

---

## [1.1.0] - 2025-12-07

### Added

#### Preset Editing
- `/preset edit` - Edit your own presets (name, description, dyes, tags)
- Autocomplete for user's own presets
- Duplicate dye combination detection
- Content moderation for edited text

#### Moderation
- **Revert Button**: New moderation button to revert flagged edits
- Modal for revert reason input
- Logs revert actions in moderation log

### Changed

- Updated `/preset` command registration with edit subcommand
- Added `preset_revert_` button handler

### Files Modified
- `src/handlers/commands/preset.ts` - Edit subcommand
- `src/handlers/buttons/preset-moderation.ts` - Revert button handler
- `src/services/preset-api.ts` - Edit and revert API methods
- `scripts/register-commands.ts` - Updated command definitions

---

## [1.0.0] - 2025-12-07

### Added

#### Architecture
- **HTTP Interactions**: Discord bot using HTTP Interactions instead of Gateway WebSocket
- **Cloudflare Workers**: Serverless deployment on Cloudflare edge network
- **Ed25519 Verification**: Request signature verification for Discord interactions

#### Commands
- `/harmony` - Generate color harmony wheels (complementary, triadic, analogous, split-complementary, tetradic, square)
- `/match <color>` - Find closest FFXIV dye to a hex color
- `/match_image` - Extract and match colors from uploaded images (1-5 colors with K-means++ clustering)
- `/dye <name>` - Search the 136-dye database by name
- `/mixer <start> <end>` - Create color gradients between two dyes
- `/accessibility <dye>` - Simulate colorblindness for dye colors
- `/comparison` - Compare multiple dyes side-by-side
- `/manual` - Help and documentation
- `/language` - Change bot UI language (6 languages supported)
- `/favorites` - Manage favorite dyes (add, remove, list)
- `/collection` - Create and manage custom dye collections
- `/preset` - Browse, submit, and vote on community presets
- `/about` - Bot information and credits

#### Features
- **SVG→PNG Rendering**: High-quality image generation via resvg-wasm
- **Rate Limiting**: Per-user, per-command sliding window rate limiter (KV-backed)
- **Favorites System**: Save up to 20 favorite dyes per user
- **Collections System**: Create up to 50 custom collections with up to 20 dyes each
- **Community Presets**: Browse, submit, and vote on user-created color palettes
- **Multi-Language Support**: Full localization for EN, JA, DE, FR, KO, ZH

#### Integrations
- **Service Binding**: Direct connection to xivdyetools-presets-api for preset operations
- **xivdyetools-core**: Shared color algorithms, dye database, and type definitions
- **Universalis API**: Real-time market board pricing (optional)

#### Storage
- **Cloudflare KV**: User preferences, favorites, collections, rate limit counters
- **Cloudflare R2**: Generated images with automatic expiration (optional)
