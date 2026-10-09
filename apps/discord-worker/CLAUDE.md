# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The primary FFXIV Dye Tools Discord bot, running on Cloudflare Workers via Discord HTTP Interactions (no Gateway WebSocket — fully serverless). All slash commands, autocompletes, button clicks, and modal submissions hit a single POST endpoint that verifies an Ed25519 signature and routes by interaction type.

This worker replaces the deprecated `xivdyetools-discord-bot` (Node.js + discord.js Gateway bot). It hosts the 5.0 command set spanning colour matching, harmony generation, image extraction, dye comparison, WCAG contrast, colour-vision accessibility, `.chara` character files, community presets, and the Universalis-backed 13G `/budget` ledger. The v4 `/match`, `/match_image`, `/favorites`, `/collection` and `/language` commands were deleted in 5.0. Renders SVG cards converted to PNG via `resvg-wasm`; dominant-color extraction from uploaded images is delegated to `xivdyetools-image-worker` over a Service Binding (`photon-wasm` moved there in the image-worker split — see `docs/operations/IMAGE_WORKER_SPLIT.md`).

## Commands

```bash
npm run dev                  # wrangler dev (local interactions endpoint)
npm run deploy               # Deploy the BETA bot (xivdyetools-discord-worker-dev, *.workers.dev)
npm run deploy:production    # Deploy to production env
npm run test                 # vitest unit tests
npm run test:integration     # vitest integration tests (separate config)
npm run test:all             # Both unit + integration
npm run test:coverage        # Coverage via @vitest/coverage-v8
npm run type-check           # tsc --noEmit
npm run lint                 # eslint src/ && pnpm run lint:dead (knip)
npm run register-commands    # tsx scripts/register-commands.ts (publish slash command schemas)
npm run upload-emojis        # tsx scripts/upload-emojis.ts (sync application emojis)
python scripts/instance-latin-fonts.py   # regenerate the static Space Grotesk / Onest faces (see below)
python scripts/subset-cjk-fonts.py       # regenerate the Noto Sans JP/SC/KR subsets
```

**Fonts ship as static instances, never variable files.** resvg's font database cannot move a variable axis — a variable file exposes only its default instance, so every `font-weight` in the card system rendered at one weight (Space Grotesk's default is Light 300) until 2026-08-29. `src/fonts/` holds `SpaceGrotesk-{Regular,SemiBold,Bold}.ttf` and `Onest-{Regular,SemiBold,Bold}.ttf`, instanced by `scripts/instance-latin-fonts.py` from the variable sources in `scripts/font-sources/`; `font-faces.test.ts` renders 400/600/700 through resvg-wasm and fails if any two match. Four lists mirror the `fonts.ts` imports and must move together: `fonts.test.ts` (DEAD-005 mocks), `font-coverage.test.ts` (cmaps), `font-load-order.test.ts` (real-byte mocks; it fails if one is missing) — `font-faces.test.ts` reads the list off `fonts.ts` itself.

**The CJK subsets (`NotoSans{SC,JP,KR}-Subset.ttf`) are cut from four inputs** by `scripts/subset-cjk-fonts.py`: the core and bot-logic locale JSON (minus `commands.<cmd>.options`, I18N-001), `CONSOLIDATED_DYES` names, and — since Sprint 30 (FONT-001, 2026-10-06) — api-worker's equippable-item name tables in `apps/api-worker/src/chara/data/`: `item-names.{ko,zh}.json` feed the SC and KR cuts, and `item-names.ja.json` feeds the JP cut only. `/glamour` draws a piece's localized name only when the bundled fonts can draw every codepoint of it (`canDraw` → `filterToRenderable`, BUG-030), else the English name; with the item names in the cut, every ko, zh and ja item name is drawable except two ko names whose source text carries a stray U+200F (allow-listed in `item-name-coverage.test.ts`; down from 63.2 % ko / 97.3 % zh / 7.3 % ja falling back to English). The ja table is build-time data only — api-worker still serves ja names from XIVAPI at run time and never imports it; `build-item-names.mjs ja` copies the same game data from the global datamining export, and a 319-id sample matched XIVAPI `latest` (7.56x1) exactly.

**Which face draws a CJK glyph is decided by the font LOAD order, not the font-family list.** Every card text stack is Latin-led (`Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR` and its Space Grotesk / Fragment Mono variants), so the Latin face draws what it has and resvg fills every other glyph from the loaded faces in `getFontBuffers(locale)` order: JP, SC, KR for `ja`; SC, KR, JP for every other locale. Every card handler passes the user's locale as `renderSvgToPng(svg, { scale: 2, locale })`. Reordering the CJK names behind the Latin face in `@xivdyetools/svg`'s stacks changes nothing here (moving a CJK family to the front would change the primary face instead). Measured with real resvg-wasm renders on 2026-10-06, after the switch to locale-aware order:

- all 29,057 ja item names, and all 813 ja locale lines that need a CJK face, render pixel-identical to a JP-only render;
- the switch changed 1,951 of those names and 521 of those lines, each of which had drawn some glyph from SC where SC's form differs from JP's;
- every zh and ko item name and locale line renders byte-identical to before.

`fonts.test.ts` pins both orders and `font-load-order.test.ts` renders them.

**Re-cut trigger:** any locale edit, and any run of api-worker's `scripts/build-item-names.mjs` — `font-coverage.test.ts` (locale strings; surplus report) and `item-name-coverage.test.ts` (item names drawable; every ja kana/kanji in the JP subset) fail until the re-cut lands, and CI runs the latter on every push because an api-worker-only change never selects this workspace. The item names cost ~340 KiB gzipped (ko/zh ~250, ja ~90): the Worker measured 2,717.2 KiB of its 3,072 KiB cap afterwards, 109 KiB under the 2,826 KiB warning band (`pnpm run check-bundle-size`), so check it after every re-cut.

### Registering Commands

```powershell
$env:DISCORD_TOKEN = "..."
$env:DISCORD_CLIENT_ID = "1447108133020369048"
$env:DISCORD_GUILD_ID = "<test-guild>"   # Optional — guild commands publish instantly
npm run register-commands
```

### Setting Secrets

A bare `wrangler secret put` writes to the top-level block — the **beta** bot
(`xivdyetools-discord-worker-dev`). Append `--env production` to set the live bot's copy
(`docs/operations/SECRET_ROTATION.md`).

```bash
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put BOT_API_SECRET
wrangler secret put BOT_SIGNING_SECRET
wrangler secret put INTERNAL_WEBHOOK_SECRET
wrangler secret put GITHUB_WEBHOOK_SECRET
wrangler secret put STATS_AUTHORIZED_USERS   # CSV of Discord IDs for /stats
wrangler secret put MODERATOR_IDS            # CSV of Discord IDs
wrangler secret put MODERATION_CHANNEL_ID
wrangler secret put MODERATION_BOT_TOKEN     # BUG-009: moderation app's token — makes approve/reject buttons routable
wrangler secret put SUBMISSION_LOG_CHANNEL_ID
```

### Pre-commit Checklist

```bash
npm run lint && npm run test -- --run && npm run type-check
```

## Architecture

### Request Flow

```
Discord  ──POST /──►  Ed25519 verify (@xivdyetools/auth)
                        │
                        ▼
              Hono router (src/index.ts)
                        │
        ┌───────────────┼─────────────────┬──────────────┐
        ▼               ▼                 ▼              ▼
       PING         APPLICATION_COMMAND  AUTOCOMPLETE   MESSAGE_COMPONENT
       PONG               │                 │              │
                          ▼                 ▼              ▼
                  rate-limiter (RL_* bindings) handlers/buttons
                          │
                          ▼
                  handlers/commands/<name>
                          │
                          ▼
                  defer  →  follow-up via Discord REST
```

The `/webhooks/preset-submission` endpoint receives notifications from `presets-api` and posts embeds + approve/reject buttons to the moderation channel. It is the **only** poster of preset moderation embeds (the sole caller of `handlers/commands/preset-notifications.ts`): `/preset submit` and `/preset edit` answer the user and post nothing, because presets-api notifies for those writes itself — the bot-side posts duplicated every bot submission (BUG-004). The embed names the author by sanitized name only — never a `<@id>` mention (FINDING-008). An owner edit (`is_edit: true` on the payload; a payload without the marker, from an older presets-api, is read as a new submission) is posted as kind `'edit'`, its changes diffed against the payload's top-level `edited_from` — the text that edit replaced — not against `preset.previous_values`, the write-once revert snapshot, which presets-api takes only from an approved preset (so a pending preset's edit or a rejected preset's resubmission normally has none) and which can be older than the text the edit replaced. Only when `edited_from` is absent (presets-api before 2.6.0) does the diff fall back to `previous_values`, under the header *Changes since the Revert snapshot*. Whenever Revert is offered, the embed says which text it restores and, when that snapshot differs from `edited_from`, that it is older than the text this edit replaced. Revert restores `previous_values` **and** approves the preset, so the webhook's embed offers it only when `is_edit`, a well-formed `previous_values` and `edited_from_status === 'approved'` all hold — never approving text no moderator approved (BUG-003; moderation-worker's refresh of a stale or legacy click does not apply this rule yet, and still offers Revert on any pending preset with a snapshot). When presets-api sends `content_revision` (2.4.0+) the buttons carry `preset_<approve|reject|revert>_<uuid>:<revision>:<status>` (≤ 100 chars; built by `buildReviewCustomIdOrLegacy` from `@xivdyetools/types`, the same module whose `parseReviewCustomId` moderation-worker reads the click with, and `preset-notifications.test.ts` parses every id it builds back through that parser — REFACTOR-001) so a click is bound to the text the moderator saw; without it (an older presets-api) the legacy `preset_<kind>_<uuid>` ids are emitted, which moderation-worker answers with a refresh rather than acting (FINDING-017). The `/webhooks/github` endpoint listens for pushes that modify `CHANGELOG-laymans.md` and announces releases to the announcement channel — only `push` events from `FlashGalatine/xivdyetools` (`GITHUB_ANNOUNCE_REPO`/`GITHUB_ANNOUNCE_REPO_URL` in `src/index.ts`; the payload's `repository` is only compared, never used to build a URL), and each version only once (KV `announced:v:<version>`, 90-day TTL, written after a successful send), so a GitHub *Redeliver* is safe (FINDING-021).

### Key Directories

```
src/
├── index.ts                       # Hono app, routing, Ed25519 verification, webhooks
├── commands/
│   ├── registry.ts                # COMMAND_REGISTRY — the roster of record (18 registrations)
│   ├── schemas.ts                 # Slash-command schemas published by register-commands
│   └── localize.ts                # name/description_localizations for the schemas;
│                                  # imported ONLY by scripts/register-commands.ts
├── data/
│   └── emoji-mapping.json         # Per-application dye emoji ids, keyed by stainID (services/emoji.ts)
├── handlers/
│   ├── commands/                  # One file per slash command (about, harmony, dye, accessibility,
│   │                              # comparison, contrast, mixer-v4, gradient, swatch, glamour, extractor,
│   │                              # preset, preferences, stats, budget, changelog, manual).
│   │                              # The v4 match / match-image / favorites / collection / language
│   │                              # files were DELETED in 5.0 — don't reintroduce them.
│   │                              # preset-notifications.ts is NOT a command; it builds/sends
│   │                              # the moderation-channel embeds for incoming preset submissions
│   └── buttons/                   # Component handlers (copy.ts, preview-image.ts moderation buttons, index.ts dispatcher)
│                                  # The modals/ placeholder (index.ts only, never wired to a modal) was
│                                  # removed 2026-08-18 — don't reintroduce it without a real consumer.
├── services/
│   ├── analytics.ts               # KV counters + Analytics Engine writes (Tier A column layout)
│   ├── command-trace.ts           # Per-interaction trace: traced ctx, outcome marks, classifier
│   ├── rate-limiter.ts            # Native `[[ratelimits]]` bindings (RL_5…RL_70), KV fallback only when unbound
│   ├── preset-favorites.ts        # Per-user preset favourites in KV (/preset favorite add|remove|list)
│   ├── preferences.ts             # User preferences (race/clan, world, language, matching, theme)
│   ├── preset-api.ts              # Service Binding client to presets-api
│   ├── i18n.ts                    # Locale resolution + dye name lookup
│   ├── bot-i18n.ts                # Bot UI translator (createTranslator/createUserTranslator)
│   ├── emoji.ts                   # Application emoji helpers
│   ├── fonts.ts                   # Bundled TTF buffers for resvg (brand + Noto Sans JP/SC/KR subsets)
│   ├── font-coverage.ts           # What the bundled subsets can draw; drops uncoverable
│   │                              # user text from cards (BUG-030) — the embed keeps the original
│   ├── image-input-errors.ts      # Rejection markers the image-worker path raises
│   ├── changelog-parser.ts        # Parse CHANGELOG-laymans.md files (root → /webhooks/github; this app's → /changelog)
│   ├── announcements.ts           # Send formatted release embeds
│   ├── svg/                       # renderer.ts — resvg PNG conversion (the cards themselves
│   │                              # come from @xivdyetools/svg)
│   ├── image-client.ts            # IMAGE_WORKER service-binding client (photon moved to xivdyetools-image-worker)
│   └── budget/                    # Universalis price cache, calculator, quick picks
├── utils/
│   ├── brand.ts                   # BRAND_ACCENT — the one embed accent colour
│   ├── github-verify.ts           # HMAC-SHA256 verification for GitHub webhooks
│   ├── response.ts                # pong/ephemeral/deferred response builders
│   ├── discord-api.ts             # REST helpers (sendMessage, follow-ups, edits)
│   ├── sanitize.ts                # sanitizePresetName / sanitizePresetDescription
│   ├── text.ts                    # Line-boundary truncation for embed budgets
│   ├── chara-attachment.ts        # The .chara attachment guards /swatch and /glamour share (CDN allowlist, 1 MiB, bounded download)
│   ├── read-text-capped.ts        # Stream-counted body reads (`.chara` downloads, `/webhooks/preset-submission`)
│   └── env-validation.ts          # Validate required env vars at first request
└── types/
    ├── env.ts                     # Env interface, InteractionType/ResponseType enums
    ├── preset.ts                  # PresetNotificationPayload, STATUS_DISPLAY
    ├── github.ts                  # GitHubPushPayload
    ├── budget.ts                  # Budget calculator types
    ├── markdown.d.ts              # `*.md` imports are strings (wrangler Text rule / vitest plugin)
    └── preferences.ts             # CLANS_BY_RACE, preference shapes
```

Ed25519 verification and `timingSafeEqual` come from `@xivdyetools/auth`; the dye service and the
hex helpers come from `@xivdyetools/bot-logic` / `@xivdyetools/core`. There is no local
`utils/verify.ts`, `utils/color.ts` or `utils/error-response.ts` — don't reintroduce them.

### Environment Bindings (wrangler.toml)

| Binding | Type | Purpose |
|---------|------|---------|
| `KV` | KV Namespace | Rate limiting fallback, user preferences, preset favourites, analytics counters, announced-version memo (`announced:v:<version>`) |
| `ANALYTICS` | Analytics Engine (`xivdyetools_bot_analytics`) | Long-term command usage telemetry |
| `PRESETS_API` | Service Binding → `xivdyetools-presets-api` | Worker-to-Worker preset CRUD |
| `UNIVERSALIS_PROXY` | Service Binding → `xivdyetools-api-worker` | Market board prices for `/budget` (via the absorbed `/api/v2/*` proxy routes); `/glamour`'s `POST /v1/chara/resolve`. A binding request carries no client IP, so all of them share one key — api-worker's `SERVICE_RATE_LIMITER` (1300/min, 20x a public IP's); one resolve per `/glamour`, no icons, and a 429 is answered as busy (`rate_limited`) |
| `IMAGE_WORKER` | Service Binding → `xivdyetools-image-worker` | Photon-backed pixel extraction for `/extractor` (see `docs/operations/IMAGE_WORKER_SPLIT.md`) |
| `RL_5`, `RL_10`, `RL_15`, `RL_20`, `RL_30`, `RL_70` | Rate Limiting (`[[ratelimits]]`, 60 s period) | Per-user command counters — one tier per distinct effective limit in `DISCORD_COMMAND_LIMITS`; KV is the fallback only when none is bound (FINDING-007) |

Vars: `ENVIRONMENT`, `DISCORD_CLIENT_ID`, `PRESETS_API_URL`, `ANNOUNCEMENT_CHANNEL_ID` — all four declared in **both** `wrangler.toml` blocks, since `vars` are not inheritable. `ENVIRONMENT` is `"development"` on the beta bot and `"production"` on the live one; the only behaviour it gates is `validateEnv`, which requires the six `RL_*` bindings in production (FINDING-013) — `/stats health` also prints it, as a label only (BUG-012). Custom domain: `bot.xivdyetools.app` only (`bot.xivdyetools.projectgalatine.com` was retired on 2026-10-04 — `docs/operations/DOMAIN_DEPRECATION.md`). `[[rules]]` includes `**/*.md` as `Text` (the bot's `CHANGELOG-laymans.md`, imported as a string by `/changelog`; `src/types/markdown.d.ts` types it and `vitest.markdown-plugin.ts` mirrors it for tests) and `**/*.ttf` as `Data` (CJK subset fonts bundled into the Worker).

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `DISCORD_TOKEN` | Bot token for Discord REST follow-ups |
| `DISCORD_PUBLIC_KEY` | Ed25519 public key for signature verification |

### Optional Secrets

| Secret | Purpose |
|--------|---------|
| `BOT_API_SECRET` | Bearer token for outbound calls to presets-api |
| `BOT_SIGNING_SECRET` | HMAC-SHA256 key for bot request signing — min. 32 characters (checked by `validateEnv`; `@xivdyetools/auth` rejects shorter keys) |
| `INTERNAL_WEBHOOK_SECRET` | Auth for inbound `/webhooks/preset-submission` — min. 32 characters in production: a shorter one makes that route answer 503 (presets-api retries, then dead-letters) while the rest of the bot keeps serving (FINDING-027, 2026-10-03 audit) |
| `GITHUB_WEBHOOK_SECRET` | HMAC-SHA256 key for GitHub push webhook |
| `MODERATOR_IDS` | CSV of Discord IDs allowed to moderate presets |
| `MODERATION_CHANNEL_ID` | Channel for pending presets posted from web app |
| `MODERATION_BOT_TOKEN` | BUG-009: bot token of the MODERATION Discord application. When set, moderation embeds are posted with it so approve/reject buttons route to moderation-worker; when unset, embeds omit buttons and hint at `/preset moderate` |
| `SUBMISSION_LOG_CHANNEL_ID` | Channel for auto-approved preset audit log |
| `STATS_AUTHORIZED_USERS` | CSV of Discord IDs allowed to use `/stats` |

## Key Patterns

### Command Routing (`src/index.ts`)

A single `switch (commandName)` in `handleCommand()` dispatches to handlers in `handlers/commands/`. Tracking is a dispatcher-owned `CommandTrace` finished in the `finally` after the handler's background work settles (see Analytics Tracking below). Rate-limit check runs before dispatch for every command — `/stats` since FINDING-033, `/about`, `/manual` and `/changelog` since FINDING-020 (2026-08-29 audit).

### Deferred Responses

Long-running handlers return `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` immediately, then call `sendFollowup()` (utils/discord-api.ts) once SVG rendering or external API calls finish. Image-generating commands use `ctx.waitUntil()` so the Worker isolates can shut down cleanly.

### Rate Limiting

`services/rate-limiter.ts` counts against the native `[[ratelimits]]` bindings (`RL_5`…`RL_70`, one per distinct per-minute limit in worker-kit's `DISCORD_COMMAND_LIMITS`), with the KV fallback used only when no tier is bound (tests / local dev). Image processing commands have tighter limits than text commands; every command is limited, including `/about`, `/manual` and `/changelog` (FINDING-020). Missing `userId` is treated as a hard reject to prevent bypass. Both degraded shapes warn once per isolate on the request logger — no tier bound (KV fallback) and a *partial* set, where worker-kit keeps the Cloudflare backend and silently routes the orphaned commands to the next larger tier — and on a `production` deployment `validateEnv` requires all six, with `src/index.ts` refusing every request (500 `Service misconfigured`, `/health` included) while one is unbound — the beta worker keeps the log-only path (FINDING-013).

### SVG → PNG Pipeline

1. Build SVG string with embedded CJK subset fonts (`services/svg/*.ts`).
2. `renderSvgToPng()` (`services/svg/renderer.ts`) invokes `@resvg/resvg-wasm`.
3. Returned as a `multipart/form-data` attachment via Discord REST.

### Preset API Service Binding

Always prefer the Service Binding (`env.PRESETS_API.fetch(req)`) — zero HTTP overhead. Falls back to `PRESETS_API_URL` for local dev when the binding is absent.

### Analytics Tracking

Tier A (2026-08-29, spec `docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md`): `handleCommand()` starts a `CommandTrace` (`services/command-trace.ts`) before the rate-limit check and hands every handler a **traced `ExecutionContext`** whose `waitUntil` also records the promise on the trace; the `finally` calls `finishCommandTrace()`, which drains those promises (bounded by `DRAIN_DEADLINE_MS` = 20 s, after which the row is written as `unknown` instead of being lost) and then writes the datapoint through `trackCommandWithKV()` — so `success`/latency describe the deferred work, not the deferred ack. The trace has **one writer**: `markCommandOutcome()`. Handlers call it wherever a command ends with an error embed — a catch (`classifyError(error[, 'render'])`), a bot-logic `GENERATION_FAILED` branch (`'render'`), an unreadable image/`.chara` (`'image_input'`); `/dye`'s text fallbacks mark `'render'` with `{ served: true }`; the dispatcher calls it for a rate-limited request and a handler throw; nobody else finishes a trace. **Two axes per datapoint:** `success` (blob4, and the KV `success`/`failure` counters behind `/stats`) = the user got an answer to what they asked; the outcome class (blob5) = the most significant thing of ours that broke, or `ok` — `ok`, `rejected`, `rate_limited`, `upstream_universalis`, `upstream_presets`, `image_input`, `render`, `unknown`. `classifyError` maps a presets-api / Universalis **4xx other than 408 and 429 to `rejected`** (the service's own reply, relayed to the user — answered, but visible as its own class so a systematic 4xx from our payload is a spike); a 408 (a timeout — universalis-client raises one for its own 10 s abort), a 429, a 5xx and a network/binding failure are `upstream_universalis` / `upstream_presets` and unanswered (BUG-005); a `served` mark is answered too; everything else with a class is a failure. Rate-limited requests are AE-only (no KV counters — `/stats` counts commands that ran, and KV allows one write per second per key). Columns: blobs 1–4 unchanged (command, userId, guild/dm, answered), blob5 **outcome class** (was the never-set `errorType`), blob6 subcommand/button kind, blob7 locale bucket, blob8 `command|button`, double2 real latency. Copy-button clicks are AE-only `kind=button` rows via `trackButtonClick()`; the button kinds are `COPY_BUTTON_KINDS` in `handlers/buttons/copy.ts`; the image-worker rejection markers are `services/image-input-errors.ts`. The list of what must **never** be recorded lives on `CommandEvent` in `services/analytics.ts` (the only place a value is written) and is promised by `PRIVACY_POLICY.md` §2. Queries and the outcome rules: `docs/operations/ANALYTICS_QUERIES.md` (Discord section).

### Autocomplete

Special routing inside `handleAutocomplete()`:
- `/preset` autocomplete checks subcommand: `edit` shows the user's own presets, `favorite remove` shows the user's favourited presets, and everything else (`show`, `vote`, `favorite add`) queries approved presets via the Service Binding. `moderate` is not registered on this worker — it belongs to `xivdyetools-moderation-worker`.
- `/preferences` clan field uses `CLANS_BY_RACE` table; world field reuses budget's world autocomplete.
- `/budget` delegates entirely to `handleBudgetAutocomplete()`.

## Security Patterns

### Ed25519 Signature Verification

`verifyDiscordRequest()` validates `X-Signature-Ed25519` + `X-Signature-Timestamp`. Body is read once and re-used for parsing. Max body size 100KB; Content-Length validated up-front to avoid OOM.

### Timing-Safe Comparisons

`timingSafeEqual()` (from `@xivdyetools/auth`) is used for the webhook bearer token comparison so a config-missing path returns `Unauthorized` without a measurable timing delta against a wrong-secret path.

### Webhook Payload Limits

Both webhook routes check `Content-Length` before reading the body, but the caps differ: `/webhooks/preset-submission` allows 10 KB (10,240 bytes), while `/webhooks/github` allows 1 MiB (`GITHUB_WEBHOOK_MAX_BYTES = 1_048_576` — GitHub's push payload carries the whole `repository` object plus up to 2048 commits, and a two-commit merge push measured 18,196 bytes). Both routes also stream-count the actual received bytes and cancel immediately above their own cap, since a client-declared `Content-Length` can be missing or spoofed — `/webhooks/preset-submission` through the shared `readTextCapped()` helper (`src/utils/read-text-capped.ts`, BUG-013), `/webhooks/github` through its own raw-byte reader. The GitHub route verifies HMAC over the bounded received bytes before text decoding; BOM removal or invalid UTF-8 replacement must never change the authenticated payload. Both refuse an oversized body with 413 before any JSON is parsed.

### User Content Sanitization

`sanitizePresetName()` and `sanitizePresetDescription()` (`utils/sanitize.ts`) delegate to `@xivdyetools/bot-logic`'s `sanitizeEmbedText` — control / zero-width / bidi stripping, `@everyone`/`@here`/`<@…>` defusing, markdown + masked-link escaping, length caps — and every user-sourced string that reaches an embed (preset names/descriptions/tags/authors, `/dye search` queries, `.chara` error echoes, `/budget` names, webhook author/tags) goes through them. Every outbound payload built in `utils/discord-api.ts` carries `allowed_mentions: { parse: [] }` unless the caller passes `allowedMentions` (FINDING-019, 2026-08-21 security audit). The swatch PNG still receives the raw text — the SVG layer XML-escapes it and backslashes would render.

### Security Headers

Applied to every response via post-handler middleware:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/about` | Bot info, registry-built command roster, Removed-in-v5 field |
| `/harmony` | Harmony palettes (11A card — found dye vs computed ideal) |
| `/dye search\|info\|list\|random` | Dye database lookups (11B cards) |
| `/comparison` | 14A Duel / 14C triangle router (2–4 dyes) |
| `/contrast` | WCAG 1.4.11 ratios, 13A/13B/13C·1 router (2–4 dyes) |
| `/accessibility` + `/a11y` | Colour-vision lenses (13D/13E/13H via `vision:`) |
| `/mixer` | 12F ratio-sweep blending card |
| `/gradient` | 12H gradient card (distinct dyes, 3-stage cap) |
| `/swatch` | `.chara` character-file frame (required `file:` attachment) |
| `/glamour` | The Glamour Reader: `.chara` attachment → card 2a (dyed pieces, twin named, in-game verdict) + the GPOSERS list in the embed; resolves via `UNIVERSALIS_PROXY` → api-worker `POST /v1/chara/resolve` |
| `/extractor` | Image ramp (14K) / colour sheet (14J·2) |
| `/preferences` | Race/clan/world/language/matching/theme preferences |
| `/preset` | Browse/submit/vote/edit community presets |
| `/budget` | 13G ledger — tier-group pricing via Universalis |
| `/changelog` | The bot's own release notes — `apps/discord-worker/CHANGELOG-laymans.md`, bundled as text at deploy time (ephemeral) |
| `/manual` | Help topics (📸 ♿ 🔲 📐 🪙 👤) with learn-more links |
| `/stats` | Usage stats incl. the 5.0 adoption panel (`summary` public; `overview`/`commands`/`health` gated — `preferences` was removed, FINDING-013) |

## Dependencies

| Package | Purpose |
|---------|---------|
| `hono` | HTTP framework |
| `@xivdyetools/core` | Dye database, color algorithms, k-d tree matcher |
| `@xivdyetools/types` | Branded types and shared interfaces |
| `@xivdyetools/auth` | JWT verify, HMAC, Ed25519 helpers |
| `@xivdyetools/worker-kit/rate-limiter` | Rate-limit backends — this worker uses the native `[[ratelimits]]` one (`CloudflareRateLimiter`), with `KVRateLimiter` as the unbound fallback |
| `@xivdyetools/svg` | Pure SVG card generators |
| `@xivdyetools/bot-logic` | Platform-agnostic command business logic |
| `@xivdyetools/bot-logic/i18n` | Bot localization strings (absorbed from bot-i18n) |
| `@xivdyetools/core/blending` | Six blending algorithms (moved from the retired `@xivdyetools/color-blending`) |
| `@xivdyetools/logger` | Structured logging with secret redaction |
| `@xivdyetools/worker-kit` | Shared Hono middleware (request ID, logger, rate limit) |
| `@resvg/resvg-wasm` | SVG → PNG rasterization |
| `IMAGE_WORKER` (service binding) | Photon-backed pixel extraction for `/extractor`, routed to `xivdyetools-image-worker` — `@cf-wasm/photon` itself was removed from this Worker's dependencies in the image-worker split (see `docs/operations/IMAGE_WORKER_SPLIT.md`) |

## Localization

6 languages: `en`, `ja`, `de`, `fr`, `ko`, `zh`. Locale resolution priority:
1. User preference stored in KV
2. `interaction.locale` (Discord client locale)
3. Default `en`

Dye names come from `@xivdyetools/core`; bot UI strings come from `@xivdyetools/bot-logic/i18n` via `createTranslator(locale)` / `createUserTranslator(env.KV, userId, locale, logger)`.

## Webhook Endpoints

| Path | Auth | Purpose |
|------|------|---------|
| `GET /health` | None | Health probe |
| `POST /` | Ed25519 | Discord interactions |
| `POST /webhooks/preset-submission` | Bearer (`INTERNAL_WEBHOOK_SECRET`) | Forwarded preset submissions from web app |
| `POST /webhooks/github` | HMAC-SHA256 (`GITHUB_WEBHOOK_SECRET`) | Push events that update the root (product-level) `CHANGELOG-laymans.md` — `push` events from `FlashGalatine/xivdyetools` only (`ping` → pong, other events → `Ignored event`, other repositories → 403), each version announced once via a versioned memo (`announced:v:<version>`), so redelivery is safe but a corrected changelog needs that KV key cleared to be re-announced |

## Testing

Vitest + `@xivdyetools/test-utils` for D1/KV/R2 mocks. Test files are co-located with source as `*.test.ts`. Integration tests live alongside unit tests but use `vitest.integration.config.ts`.

```bash
npm run test                                              # All unit tests
npx vitest run src/handlers/commands/harmony.test.ts      # One file
npx vitest run -t "harmony"                               # Pattern match
npm run test:integration                                  # Integration suite
```

## Related Projects

**Dependencies:** `@xivdyetools/core` (incl. `/blending`), `@xivdyetools/types`, `@xivdyetools/auth`, `@xivdyetools/worker-kit/rate-limiter`, `@xivdyetools/svg`, `@xivdyetools/bot-logic` (incl. `/i18n`), `@xivdyetools/logger`, `@xivdyetools/worker-kit`

**Service Bindings (outbound):** `xivdyetools-presets-api`, `xivdyetools-api-worker` (Universalis proxy routes; `/v1/chara/resolve` for `/glamour`), `xivdyetools-image-worker` (photon pixel extraction for `/extractor`)

**Service Bindings (inbound):** `xivdyetools-presets-api` calls back via `DISCORD_WORKER` for notifications

**Sibling:** `xivdyetools-moderation-worker` (separate Discord application for the moderation bot UI)

## Deployment Checklist

1. `wrangler secret list` — verify all required secrets are present.
2. `npm run lint && npm run test -- --run && npm run type-check`.
3. `npm run deploy` — publishes the BETA bot (`xivdyetools-discord-worker-dev`; there is no staging env).
4. Smoke-test core commands in the test guild.
5. `npm run deploy:production` — or simply merge to `main`: `deploy-discord-worker.yml` deploys `--env production` **and then runs `register-commands` itself** (`DISCORD_TOKEN` from repo secrets), so a manual `npm run register-commands` is only needed for out-of-band schema pushes. The beta workflow registers guild-scoped commands the same way.
6. Hit `https://bot.xivdyetools.app/health` to confirm the new build is live.
