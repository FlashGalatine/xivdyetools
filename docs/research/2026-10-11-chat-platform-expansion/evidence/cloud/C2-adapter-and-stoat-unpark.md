> **Raw agent report — not verified.** Produced by the 2026-10-11 cloud research run (see [the README](../../README.md)). That container could reach only GitHub and npm, so most web facts here come from search-result snippets, not from the pages themselves. Treat every claim not labeled `primary` or `repo` as a lead to confirm, not as a fact.

# Task C2: Multi-platform adapter seam and the Stoat un-park work breakdown

Date: 2026-10-11. Builds on `docs/research/discord-alternatives/07-2026-10-refresh.md` §4 and §7 [13]. Repo facts are from the current checkout (HEAD 2026-10-11, after Sprint 24). Web facts come from the npm registry, the published tarballs, and a blob-less git clone of the stoat.js repo.

## 1. Bottom line

- **stoat.js is unchanged on npm, but the repo is active.**
  - The latest published version is still `7.3.6` (2026-01-16) [2].
  - The repo has 54 commits after that tag [5], including a `7.3.7` tag from 2026-03-02 that was never published.
  - On 2026-10-06 the repo merged a WebSocket reliability fix (#198) [5]. A long-running WebSocket bot needs that fix, and it is **not** on npm.
  - Un-parking means either pinning a git commit or waiting for 7.3.7 to be published.
- **Migrating from revolt.js to stoat.js is small.** The bot touches 11 library APIs, and none of them changed shape between revolt.js 7.2.0 and stoat.js 7.3.6 or repo HEAD. The work is mostly a package rename, plus the new `Client.uploadFile` for images [3][5].
- **Stoat's bot API still has no interactions.** In the 2026-09-12 API spec (stoat-api 0.15.5), `interactions_url` is still documented as "Reserved". Message edits still accept only `content` and `embeds` [6]. Everything §4 of [13] said about the API fit still holds.
- **About half the code is shared, re-measured with a stated method.** Counting `bot-logic` plus `svg` against the resident command logic in discord-worker gives **50%** (10,866 of 21,599 lines). Counting `bot-logic` alone gives 29% (method in §4). The 48% in [13] is consistent with the first figure, but [13] did not state its method.
- **The minimum shared extraction is six pieces** (§5):
  - a platform-neutral `CommandReply` with the share URL as its own field;
  - per-platform text formatters and sanitizers;
  - the resolver moved into `bot-logic`;
  - namespaced preference keys;
  - a `Renderer` interface over shared fonts;
  - a namespaced `ActorId`.

  Estimate: 2–3 weeks.
- **Un-park checklist** (§7): about 2 weeks for a lookup-only MVP with no images. T1 parity (8 card commands, preferences, reactions, deploy, policy documents) takes 4–6 weeks on top of the 2–3-week shared extraction, so about 6–9 weeks in all. That is more than the 5–6.5 weeks in [13], which already includes the extraction.

## 2. Inventory of apps/stoat-worker (v0.3.3, 2026-10-06)

**What exists**
- Version 0.3.3, private. Depends on `revolt.js ^7.1.1`, which the lockfile resolves to 7.2.0 (`pnpm-lock.yaml:3534`), plus `bot-logic`, `logger` and `types`.
- `apps/stoat-worker/package.json` has no `lint:dead` script, and `lint` is a bare `eslint src/`.
- 16 test files. CHANGELOG 0.3.3 reports **209 tests**. A static count finds 177 `it(` / `test(` call sites plus 7 `.each` tables.
- I could not run the suite: `node_modules` is not installed in this checkout.

**What is wired**
- `ready`, `error` and `messageCreate` listeners: `src/index.ts:50,69,79`.
- A gate that drops self and bot messages, then applies a per-user throttle of 5 commands per 10 s: `src/message-handler.ts:70-98`.
- Routes `ping`, `help`, `about` and `dye.info`: `src/router.ts:101-109`.
- `!xd info`:
  - resolves through `resolveDyeInputMulti`, which is locale-aware since 0.3.3 (`src/services/dye-resolver.ts:56`);
  - calls bot-logic's `executeDyeInfo` (`src/commands/info.ts:9,90`);
  - sends a text embed with masquerade (`info.ts:99-116`).

**What is stubbed or unused**
- Locale is hard-coded to `'en'` with a TODO: `info.ts:38`.
- The SVG is generated and then dropped, with no PNG: `info.ts:98`.
- `MessageContextStore` writes have no reader, because there is no reaction listener (BUG-038): `info.ts:105-130`, `src/services/message-context.ts`.
- `DYE_INFO_REACTIONS`: `src/services/response-formatter.ts:43-48`.
- `withLoadingIndicator` (`src/services/loading-indicator.ts:25`) has no production importer.
- `parseMultiDyeArgs` (`src/commands/parser.ts:148`) is unused.
- `isAuthorized` (`src/config.ts:57`) gates nothing.
- The Upstash config fields (`config.ts:9-12`) are unused; the throttle is in-memory.
- There is no Dockerfile, no host and no deploy workflow (`README.md:5,31`; `CLAUDE.md:101`).

**revolt.js APIs touched** (all exist unchanged in stoat.js 7.3.6 [3])

| API | Where |
|---|---|
| `import { Client }` | `index.ts:10` |
| `new Client()` | `index.ts:47` |
| `client.on('ready' / 'error' / 'messageCreate')` | `index.ts:50,69,79` |
| `client.user?.username` | `index.ts:51` |
| `client.loginBot(token)` | `index.ts:92` |
| `type Message` | `router.ts:8`, `message-handler.ts:15` |
| `message.authorId`, `message.author?.bot`, `message.content`, `message.id` | `message-handler.ts:70-80` |
| `message.channel?.sendMessage({ content, embeds:[{title,description,colour}], replies, masquerade })` | `info.ts:109-116`, `router.ts:87`, `help.ts:69,76`, `about.ts:14`, `ping.ts:10`, `message-handler.ts:147` |
| `sent.edit({ content })` | `ping.ts:15` |
| `sent.id` | `info.ts:124` |
| `message.react` / `unreact` (structural, unused) | `loading-indicator.ts:30,39` |

## 3. revolt.js to stoat.js

**Versions**

| Package | Latest | Date | Notes |
|---|---|---|---|
| `stoat.js` | 7.3.6 | 2026-01-16 | Still the only release after 7.3.5 (2025-11-16) [2]. |
| `revolt.js` | 7.2.0 | 2025-05-12 | Not deprecated on npm [4]. |
| `stoat-api` (types and OpenAPI) | 0.15.5 | 2026-09-12 | stoat.js 7.3.6 pins the much older `stoat-api 0.8.9-4` (2025-10-22) [2][6]. |

**Repo state** (git clone of stoatchat/javascript-client-sdk, 2026-10-11 [5])
- `package.json` at HEAD says version `7.3.7` and depends on `stoat-api 0.15.3`.
- Commits after 7.3.6 include:
  - #198 (2026-10-06): stale-socket guards, connect and pong timers cleared on close, and JSON parse errors caught. Before this fix, a parse error was thrown inside `onmessage`.
  - #191 (2026-08-30): discover endpoints.
  - #196 (2026-09-23): `approximate_member_count`.
- `git diff 7.3.6..HEAD` touches no `sendMessage`, `edit`, `authorId`, `react` or `uploadFile` signatures.

**API differences that affect our calls**

| Difference | Detail |
|---|---|
| Default endpoints | revolt.js defaults to `https://api.revolt.chat` and `wss://ws.revolt.chat`. stoat.js defaults to `baseURL: "https://stoat.chat/api"` and falls back to `wss://stoat.chat/events` when the server config gives no `ws` (`lib/Client.js:50,151` [3]). The live `ws` and `autumn` URLs come from `GET /`, which I could not fetch (the proxy returned 403). |
| `uploadFile` | `Client.uploadFile(tag, file, uploadUrl?)` is **new** in stoat.js. It POSTs multipart to `${autumn.url}/${tag}` with `X-Bot-Token` (`lib/Client.js:141,251`). revolt.js 7.2.0 has no upload helper. Node 22 has a global `File`. |
| Events | The event map is identical apart from a new `policyChanges` event [3]. At HEAD, `error` is typed `StoatError \| Error \| Event` and is re-emitted only when a listener exists [5]. BUG-101's listener stays harmless. |
| `Message` | Gains `contentPlain`, `roleMentionIds`, `pinned`, `pin()` / `unpin()` and `unreact(emoji, deleteAll?)`. `channelId` becomes non-optional [3]. |
| Role mentions | Settles the open "presumed" comment at `response-formatter.ts:72-76`: stoat.js `ServerRole#toString` returns `<%id>` (`lib/classes/ServerRole.js:38`). `<%ULID>` is the role-mention form, so the `sanitizeEcho` rewrite is correct. |
| `Client` constructor | The `configuration` parameter is deprecated at HEAD in favor of `Client.initConfig` [5]. |
| Durable Object relay | `EventClient` uses the global `new WebSocket(url)` [5], which supports the DO-relay idea in [13]. Whether it needs `nodejs_compat` is still unverified. |

**Stoat API spec checks** (OpenAPI 0.15.5 [6])
- `DataEditBot.interactions_url` is "Reserved; URL for handling interactions".
- `SendableEmbed` limits: title 100, description 2000, `media` is a file id, `colour` 128. There are no fields and no footer.
- `DataMessageSend.embeds`: "Text embed content contributes to the content length cap".
- `DataEditMessage` has `content` and `embeds` (max 10) only, so an edit cannot add a PNG.
- Rate limits: `POST /channels/:id/messages` allows 10 per fixed 10 s window [7] (search snippet). Whether that bucket is per channel or per bot is *unverified*.

## 4. Where each of the 18 commands lives

**Method.** Physical lines of non-test `.ts`, measured 2026-10-11.
- **Shared:** `packages/bot-logic/src` (4,438) plus `packages/svg/src` (6,428), 10,866 in all.
- **Resident and platform-needed:** `apps/discord-worker/src/handlers/commands` (7,245) plus command-logic services (3,488):
  - `budget/*` 1,304
  - `preferences.ts` 776
  - `preset-api.ts` 525
  - `preset-favorites.ts` 237
  - `svg/renderer.ts` 151
  - `fonts.ts` 139
  - `changelog-parser.ts` 101
  - `image-client.ts` 80
  - `bot-i18n.ts` 71
  - `image-input-errors.ts` 60
  - `i18n.ts` 44
- **Excluded as Discord transport:** `index.ts` (1,548), `schemas.ts` (1,406), `discord-api.ts`, `rate-limiter`, `analytics`, `command-trace` and `buttons/`.

**Results**

| Measure | Shared |
|---|---|
| bot-logic + svg | 10,866 / 21,599 = **50.3%** |
| bot-logic alone | 29.3% |
| Counting only the 9 non-`execute*` handlers as resident | 55.5% |

**In bot-logic: 10 of 18 registry entries.** This is unchanged from [13].

| Command | bot-logic function | discord-worker handler |
|---|---|---|
| `harmony` | `executeHarmony` | 228 lines |
| `mixer` | `executeMixer` | 149 |
| `gradient` | `executeGradient` | 277 |
| `swatch` | `executeSwatch` | 162 |
| `glamour` | `executeGlamour` | 197 |
| `dye` | `executeDyeInfo` / `executeRandom` | 502; search and list stay in the handler |
| `comparison` | `executeComparison` | 155 |
| `contrast` | `executeContrast` | 150 |
| `accessibility`, `a11y` | `executeAccessibility` | 186 |

Even these "thin" handlers compose the user-visible text. For example, `handlers/commands/harmony.ts:178-196` builds the dye list using Discord custom emoji (`getDyeEmoji(..., env.DISCORD_CLIENT_ID)`) and `**bold**`, plus `attachment://image.png`.

**In discord-worker only: 8 entries**

| Command | Where the logic lives |
|---|---|
| `extractor` | 659-line handler, through the image-worker binding |
| `budget` | 697-line handler plus `services/budget` |
| `preset` | 1,349 + 316 lines; `preset-api.ts:194-421` takes Discord's `Env` |
| `preferences` | 978 lines plus `preferences.ts` (KV `prefs:v1:{userId}`, `:7,56`) |
| `manual`, `changelog`, `about`, `stats` | 473 / 119 / 159 / 463 lines |

**Discord assumptions inside bot-logic**

| Assumption | Where |
|---|---|
| `EmbedData` has a numeric `color` and a string `footer`, and its doc says Discord adapters map it to `APIEmbed` | `commands/types.ts:21-27` |
| Share URL carried in `embed.description`; discord-worker recovers it by sniffing `startsWith('https://')` | `dye-info.ts:177-181`, `harmony.ts:331-340`; handler `harmony.ts:~203` |
| "Discord's embed description limit" `EMBED_BUDGET = 4000`. Stoat caps the description at 2000 and counts it toward the message cap, so the glamour list overflows on Stoat. | `glamour.ts:182-183` |
| Discord-markdown escaping and bold labels | `glamour.ts:325-337` |
| `sanitizeEmbedText` / `escapeDiscordMarkdown` defuse only `@everyone` / `@here` and digit mentions. Stoat wraps them (`response-formatter.ts:111-117`). | `discord-markdown.ts:15-77`; mentions at `:46-50` |
| Snowflake-only moderator IDs | `moderators.ts:24-49` |
| `discordLocaleToLocaleCode` | `i18n/locale-resolution.ts:93` |
| `resolveUserLocale(kv, userId, discordLocale)` with un-namespaced keys `prefs:v1:` and `i18n:user:` | `i18n/locale-resolution.ts:159`; keys at `:68,75` |

**Outside bot-logic**
- `resolveDyeInputMulti` still lives in `apps/stoat-worker/src/services/dye-resolver.ts`.
- Dye autocomplete lives in discord-worker (`index.ts:1100-1225`, `budget-calculator.ts:373`).
- File input is locked to Discord's CDN at `image-worker/src/validators.ts:25-28` and `discord-worker/src/utils/chara-attachment.ts:42-44`. The latter has moved since the `:26-28` that [13] cites.

## 5. Proposed adapter seam

```ts
// packages/bot-logic/src/reply.ts (new)
export type Span = { text: string; bold?: boolean; code?: boolean; link?: string };
export type Block =
  | { kind: 'para'; spans: Span[] }
  | { kind: 'list'; items: Array<{ spans: Span[]; swatch?: { hex: string; stainID?: number } }> }
  | { kind: 'field'; name: string; value: Span[]; inline?: boolean };
export interface CardImage { svg: string; locale: LocaleCode; filename: string; widthHint: 600 | 800 }
export interface Action { id: string; label: string; emoji?: string; payload: Record<string, string> }
export interface CommandReply {
  title: string;
  accentHex: string;        // '#RRGGBB', not a number
  blocks: Block[];          // replaces description and fields
  shareUrl?: string;        // its own field, never inside the description
  footer?: string;
  card?: CardImage;         // the adapter renders and uploads it
  actions?: Action[];       // Discord buttons, Stoat reactions, Telegram inline keyboard
  visibility: 'public' | 'private-preferred';  // ephemeral hint; DM or public fallback per adapter
  followUps?: CommandReply[]; // multi-match: the adapter may merge them into one message (Stoat 10/10 s)
}
export type CommandResult = { ok: true; reply: CommandReply } | { ok: false; errorKey: string; vars?: Record<string, string | number> };

export interface ActorId { platform: 'discord' | 'stoat' | 'telegram' | 'fluxer'; id: string }
export interface CommandInput<A> { actor: ActorId; locale: LocaleCode; args: A; prefs: UserPrefsView; logger?: TranslatorLogger }

// Ports each adapter implements
export interface PreferenceStore { get(actor: ActorId): Promise<UserPrefs | null>; set(actor: ActorId, p: UserPrefs): Promise<void>; delete(actor: ActorId): Promise<void> }
export interface Renderer { png(svg: string, locale: LocaleCode, scale?: number): Promise<Uint8Array> }
export interface TextFormatter { render(blocks: Block[], maxChars: number): string; sanitize(userText: string, max: number): string }
```

**How each adapter maps a reply**

| Element | Discord | Stoat | Telegram |
|---|---|---|---|
| Blocks | `TextFormatter` renders markdown; custom emoji come from the swatch's `stainID` | Folds fields into the description; caps at 2000 including content | HTML parse mode |
| Accent color | `parseInt(hex)` | `colour` | Not used |
| Share URL | `embed.url` | Embed `url` | A URL button |
| Card | `file` plus `attachment://` | `uploadFile('attachments')`, then `attachments: [id]`, because edits cannot add files | `sendPhoto` |
| Actions | Buttons | `interactions.reactions` plus a `messageReactionAdd` handler | `inline_keyboard` |
| Private visibility | Ephemeral flag 64 | Public, or a DM | Public in groups, natural in a DM |

**Minimum extraction so Stoat and a second platform can share it**
1. `CommandReply` plus a share-URL field. Rewrite the 10 `execute*` returns and move the description composition out of the discord-worker handlers (example: `harmony.ts:178-196`). About 1 week.
2. `TextFormatter` and sanitizer per markup. Keep `discord-markdown.ts` as the Discord implementation and promote Stoat's `sanitizeEcho` into a Stoat implementation. Make glamour's budget a parameter, not 4000. 2–3 days.
3. Move `resolveDyeInputMulti` and the dye-autocomplete ranking into `bot-logic`. 1–2 days.
4. `PreferenceStore` keyed by `ActorId`, with `prefs:v1:<platform>:<id>` for new platforms (Discord keeps its bare key). Generalize `resolveUserLocale`'s `discordLocale` into a `platformLocaleHint` mapped by the adapter. 2–3 days.
5. A `Renderer` interface plus shared fonts (§6). 2–3 days.

Total: about **2–3 weeks**, in line with [13]'s 2.0–2.5. Budget, extractor and preset stay out of this cut (T2/T3).

**Vercel Chat SDK** (`chat` 4.41.1, MIT, 2026-09-28) [9][10]
- It already offers this kind of seam: one `Chat` class, JSX cards, `postEphemeral` with `fallbackToDM`, `files` uploads, and `onSlashCommand` for Discord through HTTP interactions with an automatic deferred response.
- Adapters exist for Discord, Telegram, Slack, Teams, WhatsApp and others, plus a community Matrix adapter, `@beeper/chat-adapter-matrix` 0.2.0 [11].
- There is **no Stoat or Fluxer adapter**. Its slash-command doc does not mention autocomplete. It requires a state adapter (Redis, Postgres or memory). Whether it runs on Workers is *unverified*.
- **Opinion:** borrow its shape, but don't adopt it. It would replace discord-worker's mature interaction handling and drop autocomplete.

## 6. Rendering on a non-Worker host

**Current render code**
- discord-worker renders with `@resvg/resvg-wasm` 2.6.2 from a static WASM import (`services/svg/renderer.ts:11-17`).
- `renderSvgToPng(svg, {scale:2, locale})` (`:78-150`) frees the WASM tree and pixmap in a `finally` block.
- Fonts come from `getFontBuffers(locale)`: JP first for `ja`, SC first otherwise (`services/fonts.ts:67-79`).
- **Fonts:** `apps/discord-worker/src/fonts`, 10 TTFs, 2.1 MB in all. The CJK subsets are JP 482 KB, SC 859 KB and KR 207 KB.
  - Each worker regenerates its subsets from the glyphs its cards emit (`scripts/subset-cjk-fonts.py`, `packages/svg/src/emitted-glyphs.ts`).
  - og-worker's copy differs: only 1 of the 10 files is byte-identical between the two workers.
- **image-worker** is service-binding-only and runs photon, not resvg (`image-worker/src/index.ts:9,121-185`).
- **og-worker** exposes public PNG routes (`og-worker/src/index.ts:903-1326`), but they draw 1200×630 OG layouts, not bot cards.

**Options**

| | Option | Pros | Cons |
|---|---|---|---|
| A | `@resvg/resvg-js` (native N-API; latest 2.6.2, 2024-03-26 [12]) in the Node container, with discord-worker's exact font set | No network hop, no new public surface | Native binary per platform in Docker; copies of the renderer and font-order logic; the font-coverage gate has to cover a third copy |
| B | New authenticated render route (HMAC through `packages/auth`) on a separate worker | One renderer | A new public CPU-abuse surface. discord-worker is at about 2.6 of its 3 MiB, so the route needs its own worker carrying about 927 KiB of resvg-wasm plus fonts. Adds a cross-network hop for every card. |
| C | **Recommended:** a shared `Renderer` with the fonts and order logic moved into a package (or `svg`), and two backends | One font set and one coverage gate; no public endpoint | Needs the extraction work in §5 |

For option C, the backends are `resvg-wasm` on Workers and either `resvg-wasm` loaded from a file (no native binary) or `resvg-js` on Node. That resvg-wasm runs under Node in this repo is *unverified*, so spike it.

## 7. Un-park checklist (sizes: S ≤ 1 day, M 2–5 days, L > 1 week)

**1. Library migration (S, 0.5–1 day).**
- Swap the imports at `index.ts:10`, `router.ts:8` and `message-handler.ts:15`, plus `src/test-utils/revolt-mocks.ts`.
- Pin stoat.js git commit `5e88ed6` or later, or wait for an npm 7.3.7 release. The WebSocket fix is unpublished.
- Run [13]'s half-day smoke test: log in, then send an embed and an uploaded PNG.

**2. Dead-code cleanup and gate (S–M, 1–2 days).**
- Remove `'apps/stoat-worker'` from `EXCLUDED_WORKSPACES` (`scripts/check-dead-code.ts:53-55`, applied in `listTracked` `:91-102`).
- Add a `lint:dead` script and a `knip.jsonc` workspace key (`knip.jsonc:12,115-125`).
- Update the comment at `turbo.json:66` and `scripts/knip-config.test.ts:140`.
- Clear DEAD-030 (2026-09-01) and DEAD-064 (2026-10-04): `withLoadingIndicator`, `parseMultiDyeArgs`, `isAuthorized`, the Upstash fields, and the `MessageContextStore` methods.
- Re-check the bot-logic `@public` tags, such as `resolveDyeInput`.

**3. Fan-out, STOAT-2 / FINDING-035 (S, 0.5 day).** Merge the 2–4 match replies into one message with several embeds. 0.3.3 (BUG-073) deliberately brought back up to 4 messages, and the throttle allows 5 commands per 10 s. That is up to 20 sends against the 10-per-10 s message bucket.

**4. Shared extraction (L, 2–3 weeks).** See §5.

**5. Image path (M, 3–5 days).** The `Renderer` backend on Node, then `uploadFile` with `attachments`. Edits cannot add files, so send a placeholder or ⏳ reaction first and post the card as a new message. Add a font-coverage test on the Node side.

**6. Commands, in priority order (L, 1.5–2.5 weeks).**
1. `dye info` with its card
2. `harmony`
3. `gradient`
4. `mixer`
5. `comparison`
6. `contrast`
7. `accessibility` / `a11y`
8. `dye random`

Later: `swatch` and `glamour` (need the attachment-host abstraction), then `budget`, `extractor` and presets read-only (T2/T3).

**7. Per-user locale and preferences (M, 2–4 days).** Use a `PreferenceStore` on Upstash (the fields already exist) or SQLite on a volume. Add `!xd prefs language`, use the `stoat:` namespace, and provide a deletion path.

**8. Reaction listener, BUG-038 (S–M, 1–2 days).** stoat.js has `messageReactionAdd(message, userId, emoji)` [3]. Use `interactions.restrict_reactions`.

**9. Infrastructure (M, 3–4 days in all).**
- Dockerfile and Fly config (S). `README.md:31` names Fly.io; price unverified.
- CI: turbo already covers lint, type-check and test; add a docker-build check (S).
- `deploy-stoat-worker.yml`, which must carry the four root `paths:` that `scripts/check-workflows.test.ts` enforces (S–M).
- Secrets: `BOT_TOKEN` as a host secret, plus `docs/operations/SECRET_ROTATION.md` and `DEPLOY_ENVIRONMENTS.md` entries (S).

**10. Logging policy, the FINDING-022 equivalent (S, 1 day).** `scripts/check-worker-logs.ts:122-130` scans only `wrangler.*` files, so a Node host needs its own retention setting and gate. Fly's log retention is *unverified*.

**11. Privacy policy and ToS (M–L, 3–5 days).**
- Today there are 12 discord-worker files: 6 `PRIVACY_POLICY*` and 6 `TERMS_OF_SERVICE*`.
- Either add 12 Stoat files or amend the Discord set, following `.agents/skills/audit-shared/policy-documents.md`: one commit for all six languages, the same date in each, and native-language review.
- Stoat currently has no policy, which `message-handler.ts:88-90` cites as the reason it logs nothing about users.

**12. Docs (S).**
- `apps/stoat-worker/README.md` and `CLAUDE.md`
- Root `README.md:36,106`
- `docs/versions.md:34,598`
- `.agents/skills/audit-shared/units.md:32` (the "parked" row)
- `docs/operations/OPEN_ITEMS.md:171` (the §7 residual risk "stoat-worker stays parked")
- Root `DEPRECATIONS.md` has no Stoat entry. Add one only if the app is archived instead.

**Totals**
- Lookup-only MVP with no images: about 2 weeks (steps 1–3 and 9–12, with the policy documents amended).
- T1 parity: 4–6 weeks plus 2–3 weeks of shared extraction (about 6–9 weeks in all; [13]'s 5–6.5 includes the extraction).

## Searches that found nothing or failed

- WebFetch could not resolve chat-sdk.dev, cdn.jsdelivr.net or api.stoat.chat (DNS errors). I read the Chat SDK docs bundled in the npm tarball instead.
- curl to `stoat.chat/api/`, `api.stoat.chat/` and `api.revolt.chat/` got 403 from the proxy, so the live `ws` and autumn config is unverified.
- The GitHub API for stoatchat is not enabled in this session; I used `git clone --filter=blob:none` instead.
- No Stoat or Fluxer Chat SDK adapter turned up on npm (searches: "chat-adapter stoat", "chat-adapter revolt", "chat-adapter fluxer").
- No official Stoat statement on interactions after 2026-10-04 turned up (extended web search). The 2026-09-12 OpenAPI still says "Reserved".

## Sources

1. Repo checkout, read 2026-10-11: `apps/stoat-worker/**`, `packages/bot-logic/src/**`, `apps/discord-worker/src/**`, `scripts/check-dead-code.ts`, `knip.jsonc`, `turbo.json`, `docs/**`.
2. npm registry, stoat.js metadata (versions, times, dependencies). https://registry.npmjs.org/stoat.js, accessed 2026-10-11.
3. stoat.js 7.3.6 tarball, `lib/Client.js` and `lib/classes/*`; revolt.js 7.2.0 tarball for the diff. https://registry.npmjs.org/stoat.js/-/stoat.js-7.3.6.tgz and https://registry.npmjs.org/revolt.js/-/revolt.js-7.2.0.tgz, accessed 2026-10-11.
4. npm registry, revolt.js (dist-tags latest 7.2.0, 2025-05-12, not deprecated). https://registry.npmjs.org/revolt.js, accessed 2026-10-11.
5. stoatchat/javascript-client-sdk git history: tags 7.3.6 (2026-01-16) and 7.3.7 (2026-03-02); HEAD 5e88ed6 "fix: Increase event websocket reliability (#198)", 2026-10-06. https://github.com/stoatchat/javascript-client-sdk, cloned 2026-10-11.
6. stoat-api 0.15.5 `OpenAPI.json` ("Stoat API" 0.15.5, published 2026-09-12). https://registry.npmjs.org/stoat-api/-/stoat-api-0.15.5.tgz
7. Stoat developer docs, Rate Limits (search snippet only). https://developers.stoat.chat/developers/api/ratelimits, accessed 2026-10-11.
8. stoat.py docs, Bots (`interactions_url` reserved; snippet). https://stoatpy.readthedocs.io/en/latest/api/bots.html, accessed 2026-10-11.
9. Vercel Chat SDK `chat` 4.41.1 (2026-09-28): README and bundled docs (`platform-adapters.mdx`, `slash-commands.mdx`, `ephemeral-messages.mdx`, `files.mdx`). https://registry.npmjs.org/chat, https://github.com/vercel/chat
10. `@chat-adapter/discord` 4.41.1 README. https://registry.npmjs.org/@chat-adapter/discord
11. npm search showing `@beeper/chat-adapter-matrix` 0.2.0. https://registry.npmjs.org/-/v1/search?text=chat-adapter%20matrix, accessed 2026-10-11.
12. npm registry, `@resvg/resvg-js` and `@resvg/resvg-wasm` (latest 2.6.2, 2024-03-26). https://registry.npmjs.org/@resvg/resvg-js
13. `docs/research/discord-alternatives/07-2026-10-refresh.md` §4 and §7 (repo, 2026-10-04).


## Platform verdicts (structured)

| Platform | FFXIV presence | Workers fit | Recommendation | Effort (weeks) | Rationale |
|---|---|---|---|---|---|
| Stoat (un-park) | tiny — No new search in this task. The 2026-10-04 survey found two stoatservers.com servers (53 and 6 members) and none on the official Discover site. | Poor: persistent WebSocket. Needs a Node host (Fly/VPS) or a Durable Object relay with a watchdog; stoat.js uses global WebSocket and fetch, so the DO route is plausible but unverified. | spike: run a 1-day smoke test on stoat.js git HEAD (5e88ed6 or later), covering login, an embed, and an uploadFile PNG; then build-if-asked, after the shared extraction. | MVP lookup-only ~2; T1 parity 4-6 plus 2-3 shared extraction | Library migration is small: every API used is unchanged and uploadFile is new. But the API still has no interactions (interactions_url 'Reserved' in 0.15.5, 2026-09-12), edits cannot carry files, the published SDK lacks the 2026-10-06 WebSocket reliability fix, and audience evidence is tiny. |
| Shared adapter extraction | n/a — n/a | Neutral: the seam is pure TypeScript; the Renderer has resvg-wasm (Workers) and resvg-wasm or resvg-js (Node) backends. | build-now if any second platform (Stoat, Telegram or Fluxer) is approved: CommandReply with shareUrl, TextFormatter/sanitizer per markup, resolver and autocomplete moved into bot-logic, ActorId-namespaced PreferenceStore, and a shared Renderer plus fonts. | 2-3 | Only 29% (bot-logic alone) to 50% (with svg) of platform-needed code is shared today. Even thin Discord handlers compose the final text with Discord emoji and markdown, and bot-logic leaks Discord limits (glamour 4000 vs Stoat 2000), snowflakes, Discord locale mapping and the share URL in the description. |


## Key claims (structured)

| ID | Claim | Confidence | Source | Date |
|---|---|---|---|---|
| C2-01 | stoat.js latest npm version is still 7.3.6 (published 2026-01-16); no newer release on npm. | primary | https://registry.npmjs.org/stoat.js | accessed 2026-10-11 |
| C2-02 | stoatchat/javascript-client-sdk has 54 commits after 7.3.6, an unpublished 7.3.7 tag (2026-03-02), and HEAD package.json version 7.3.7 depending on stoat-api 0.15.3; HEAD 5e88ed6 (2026-10-06) fixes event-websocket reliability (stale socket handlers, timer cleanup, caught JSON parse errors). | primary | https://github.com/stoatchat/javascript-client-sdk | 2026-10-06 (commit); cloned 2026-10-11 |
| C2-03 | stoat.js adds Client.uploadFile(tag, file, uploadUrl?) which POSTs multipart to the autumn URL with X-Bot-Token; revolt.js 7.2.0 has no upload helper. | primary | https://registry.npmjs.org/stoat.js/-/stoat.js-7.3.6.tgz (lib/Client.js:141,251) | 2026-01-16 |
| C2-04 | stoat.js 7.3.6 defaults baseURL to https://stoat.chat/api and falls back to wss://stoat.chat/events when server config lacks ws; revolt.js 7.2.0 defaults to api.revolt.chat / ws.revolt.chat. | primary | https://registry.npmjs.org/stoat.js/-/stoat.js-7.3.6.tgz (lib/Client.js:50,151) | 2026-01-16 |
| C2-05 | All 11 revolt.js APIs stoat-worker touches (Client, on ready/error/messageCreate, loginBot, user.username, Message.authorId/author.bot/content/id/channel.sendMessage, Message.edit, react/unreact) exist with the same signatures in stoat.js 7.3.6 and HEAD. | repo | apps/stoat-worker/src/index.ts:10-92; message-handler.ts:70-147; info.ts:109-124; ping.ts:10-15 | 2026-10-11 |
| C2-06 | stoat.js ServerRole#toString returns `<%id>`, confirming the role-mention form that stoat-worker's sanitizeEcho only presumed. | primary | https://registry.npmjs.org/stoat.js/-/stoat.js-7.3.6.tgz (lib/classes/ServerRole.js:38); apps/stoat-worker/src/services/response-formatter.ts:72-76 | 2026-01-16 |
| C2-07 | Stoat API 0.15.5 OpenAPI still describes interactions_url as 'Reserved'; DataEditMessage accepts only content and embeds (max 10); SendableEmbed description max 2000 and title 100, with no fields or footer; embed text counts toward the content cap. | primary | https://registry.npmjs.org/stoat-api/-/stoat-api-0.15.5.tgz (OpenAPI.json) | 2026-09-12 |
| C2-08 | Stoat message sends are limited to 10 per fixed 10 s bucket for POST /channels/:id/messages. | snippet | https://developers.stoat.chat/developers/api/ratelimits | accessed 2026-10-11 |
| C2-09 | stoat-worker 0.3.3: 16 test files; CHANGELOG reports 209 tests (177 static it/test call sites plus 7 .each tables); routes only ping, help, about and dye.info; locale hard-coded 'en'; SVG dropped (no PNG); no reaction listener. | repo | apps/stoat-worker/CHANGELOG.md; src/router.ts:101-109; src/commands/info.ts:38,98,105-130 | 2026-10-06 |
| C2-10 | 10 of 18 discord-worker registry entries call a bot-logic execute* function (harmony, mixer, gradient, swatch, glamour, dye, comparison, contrast, accessibility, a11y); extractor, budget, preset, preferences, manual, changelog, about and stats are resident in discord-worker. | repo | apps/discord-worker/src/commands/registry.ts:27-58; apps/discord-worker/src/handlers/commands/*.ts | 2026-10-11 |
| C2-11 | Shared share re-measured (physical non-test .ts LOC): bot-logic 4,438 plus svg 6,428 = 10,866 shared vs 10,733 resident platform-needed discord-worker code (handlers 7,245 + logic services 3,488) = 50.3%; bot-logic alone = 29.3%. | repo | packages/bot-logic/src; packages/svg/src; apps/discord-worker/src/handlers/commands; apps/discord-worker/src/services | 2026-10-11 |
| C2-12 | bot-logic carries Discord assumptions: EmbedData numeric color and footer (types.ts:21-27); share URL in embed.description (dye-info.ts:177-181, harmony.ts:331-340); glamour EMBED_BUDGET 4000 described as Discord's limit (glamour.ts:182-183), more than Stoat's 2000; Discord-markdown sanitizer (discord-markdown.ts:15-77); snowflake-only moderators (moderators.ts:24-49); discordLocaleToLocaleCode and un-namespaced prefs:v1 keys (locale-resolution.ts:68,75,93,159). | repo | packages/bot-logic/src/commands/types.ts:21-27 | 2026-10-11 |
| C2-13 | discord-worker handlers compose the final user-visible description themselves (Discord custom emoji via DISCORD_CLIENT_ID, **bold**, attachment://image.png), so even 'thin' handlers hold presentation logic. | repo | apps/discord-worker/src/handlers/commands/harmony.ts:176-216 | 2026-10-11 |
| C2-14 | The dead-code gate excludes apps/stoat-worker via EXCLUDED_WORKSPACES, which listTracked applies; knip.jsonc and turbo.json document stoat-worker as the one ungated workspace. | repo | scripts/check-dead-code.ts:53-55,91-102; knip.jsonc:12,115-125; turbo.json:66 | 2026-10-11 |
| C2-15 | discord-worker renders with @resvg/resvg-wasm 2.6.2 from a static WASM import, using 10 bundled TTFs (2.1 MB; CJK subsets JP 482 KB, SC 859 KB, KR 207 KB) in locale-dependent order; og-worker's font set differs (1 of 10 files identical); image-worker has no SVG renderer. | repo | apps/discord-worker/src/services/svg/renderer.ts:11-150; apps/discord-worker/src/services/fonts.ts:67-79; apps/discord-worker/src/fonts | 2026-10-11 |
| C2-16 | @resvg/resvg-js and @resvg/resvg-wasm latest are both 2.6.2 (2024-03-26). | primary | https://registry.npmjs.org/@resvg/resvg-js | 2024-03-26 |
| C2-17 | Vercel Chat SDK (`chat` 4.41.1, MIT, 2026-09-28) offers a multi-platform adapter layer (Discord through HTTP interactions with auto-defer, Telegram, Slack, Teams, WhatsApp; community Matrix adapter by Beeper 0.2.0) with JSX cards, postEphemeral with fallbackToDM, and file uploads; it has no Stoat or Fluxer adapter, requires a state adapter, and its slash-command doc does not cover autocomplete. | primary | https://registry.npmjs.org/chat (bundled docs/platform-adapters.mdx, slash-commands.mdx, ephemeral-messages.mdx) | 2026-09-28 |
| C2-18 | File input is locked to Discord's CDN hosts at image-worker validators and discord-worker chara-attachment. | repo | apps/image-worker/src/validators.ts:25-28; apps/discord-worker/src/utils/chara-attachment.ts:42-44 | 2026-10-11 |
| C2-19 | discord-worker policy documents total 12 files (6 PRIVACY_POLICY*, 6 TERMS_OF_SERVICE*); stoat-worker has no policy, which message-handler cites as the reason it logs no user identifiers. | repo | apps/discord-worker/PRIVACY_POLICY*.md; apps/stoat-worker/src/message-handler.ts:88-90 | 2026-10-11 |


## Corrections to the 2026-10-04 refresh

- §7 cites `apps/discord-worker/src/utils/chara-attachment.ts:26-28` for the Discord-CDN host lock; the allowlist is now at lines 42-44 (image-worker/src/validators.ts:25-28 is still correct). Source: repo, read 2026-10-11.
- §4 'STOAT-02 (fan-out)': the real ID is STOAT-2 under FINDING-035 (docs/audits/2026-08-21-security/findings/FINDING-035.md). A per-user CommandThrottle already exists (apps/stoat-worker/src/services/command-throttle.ts). The fan-out of up to 4 messages was deliberately brought back by BUG-073 in 0.3.3 (CHANGELOG 2026-10-06), so 5 commands per 10 s can mean up to 20 sends against Stoat's 10-per-10 s message bucket.
- §4 'The DEAD-030 cleanup' is ambiguous: DEAD-030 is the 2026-09-01 audit's Stoat finding (docs/audits/2026-09-01-dead-code/findings/DEAD-030.md, whose parseMultiDyeArgs location has moved to parser.ts:148), but in the 2026-10-04 audit DEAD-030 is a moderation-worker item and the Stoat leftovers are DEAD-064 (docs/audits/2026-10-04-dead-code/CLEANUP_PLAN.md:145,222). The noUnusedLocals override that DEAD-030 mentions is already gone (DEAD-032).
- §4 'Endpoints: API api.stoat.chat, events wss://events.stoat.chat': the stoat.js 7.3.6 SDK itself defaults to https://stoat.chat/api and falls back to wss://stoat.chat/events (lib/Client.js:50,151 of the npm tarball). The live config from GET / could not be fetched (proxy 403), so whether api.stoat.chat is also valid is unverified.
- §4 'later repo commits are unpublished' understates it: 54 commits after 7.3.6, an unpublished 7.3.7 tag (2026-03-02), HEAD on stoat-api 0.15.3, and a 2026-10-06 event-WebSocket reliability fix (#198) that a bot needs (git history of stoatchat/javascript-client-sdk).
- §4 'apps/stoat-worker has 4 of the 18 commands: ping, help, about and dye info': ping and help have no entry in the 18-command Discord registry. Stoat serves 2 registry equivalents (`about` and the `info` subcommand of `/dye`) plus 2 Stoat-only utilities (apps/discord-worker/src/commands/registry.ts:27-58; apps/stoat-worker/src/router.ts:101-109).
- §7 'About 48% (≈6.5k of ≈13.4k LOC)' gives no method. Re-measured with a stated method: 50.3% (bot-logic + svg 10,866 vs 10,733 resident) or 29.3% for bot-logic alone (repo, 2026-10-11).


## Open questions

- Is the Stoat message bucket (10 per 10 s) per channel, per bot or global? The docs snippet does not say.
- When will stoat.js 7.3.7 be published to npm, and will it include #198? Until then, pin a git commit.
- What do Stoat's live GET / config ws and autumn URLs say today (api.stoat.chat vs stoat.chat/api)? Blocked by the proxy in this session.
- Does @resvg/resvg-wasm 2.6.2 load and render correctly under Node 22 with discord-worker's fonts, avoiding the native resvg-js binary? Needs a spike.
- Can stoat.js run inside a Durable Object without nodejs_compat? Still unverified.
- Does Fly.io (the planned host) retain stdout logs by default, and can retention be disabled to meet the FINDING-022 no-persistent-logs rule?
- Policy approach: 12 new Stoat files, or amend the Discord documents to cover all platforms?
- Does Vercel Chat SDK run on Cloudflare Workers, and does it support Discord autocomplete? Neither is covered in its bundled docs.
