# review-r2-bot-chara-second-look (2026-10-26, HEAD 13c386e5)

Independent second look at the bot-side `.chara` path (bot-logic + discord-worker). Read-only.

## Command / module table

| Unit | Entry | Auth | Input from user | Upstream strings | Sinks |
|---|---|---|---|---|---|
| discord-worker `handlers/commands/glamour.ts` | `/glamour file:` | Ed25519 interaction (dispatcher) + per-user limit `default` 15/min (worker-kit `configs.ts:104`; no explicit `glamour` key) | attachment (name, size, url from signed `resolved`) | api-worker `/v1/chara/resolve` envelope (`glamour.ts:92-97`) | Discord edit (embed + PNG), logger.warn fixed code |
| discord-worker `handlers/commands/swatch.ts` | `/swatch file: order: slot:` | same, `swatch` 15/min (`configs.ts:91`) | attachment; `order`/`slot` allowlisted (`swatch.ts:79-82`) | none | Discord edit, logger.warn fixed code |
| discord-worker `utils/chara-attachment.ts` | check + download | n/a | filename `.chara` (`:79`), size <= 8 KiB (`:82`), host allowlist https cdn/media.discordapp (`:42-58`) | CDN body | bytes capped by stream count (`:121`, `read-text-capped.ts:48-80`) |
| bot-logic `commands/chara-identity.ts` | `readCharaForTools` | n/a | bytes preferred over text (`:47`) | n/a | producer -> fixed token allowlist (`:75-85`), tribe valid-enum only (core `chara-library.ts:258`) |
| bot-logic `commands/glamour.ts` | `executeGlamour` | n/a | projection members only (`:444`), wire model = 4 lanes (`:271-273`) | names, acquisition, glasses, familySize, uiCategory | SVG card, embed description (`plain()` `:384-386`, budget `:606-608`) |
| bot-logic `commands/swatch.ts` | `executeSwatch` | n/a | nickname stripped at projection (`:264-268`) | none | SVG card, embed (computed hex only) |

Authz matrix: both commands are user-level, no moderator path, no components/autocomplete on these commands. Service call to api-worker carries no auth header (`glamour.ts:58`), keyed by api-worker as service binding (`rate-limit.ts:75-77`, one shared key `workers` 1300/min).

## Candidates

1. r2-bot-chara-second-look-01 (LOW) glamour embed budget breaks when `tail` > ~3996 chars: `body.lastIndexOf('\n', EMBED_BUDGET - tail.length - 4)` gets a negative position, returns -1, `body.slice(0,-1)` keeps almost the whole body (`glamour.ts:604-608`). Probe: body 12 lines + tail 4100 -> description 4968 (>4096). Discord then 400s the edit; `safeEditOriginalResponse` result is ignored on the success path (`handlers/commands/glamour.ts:185-195`), so the user stays on "thinking" and the trace records `ok`. Precondition: tail is only notes built from item names; realistic game names keep it ~2.6k, so it needs abnormal upstream names (api-worker `cleanName` has no length cap, `xivapi.ts:96-98`). Peer `review-gap-upstream-game-data-trust.md` row 13 notes tail uncapped.
2. r2-bot-chara-second-look-02 (LOW) `plain()` escapes only `* _ ~ \` | \\` (`glamour.ts:384-386`): masked links `[x](https://...)`, `<@id>`/`<#id>`/`<t:..>` render tokens and `@everyone` text from api-worker item names / acquisition lines / glasses names reach the public embed description unescaped (`:412`, `:581`, `:591`, `:598`). allowed_mentions parse [] stops pings; masked link phishing remains if XIVAPI (third party) or the bundled acquisition table is poisoned. Upstream-trust precondition.
3. r2-bot-chara-second-look-03 (INFO) `SwatchResult.character` (published API) carries `producer` = raw `TypeName` (<=256 units, `chara-library.ts:265`), user free text; no in-repo consumer prints it (grep of discord-worker/stoat-worker src). Fine today; a future consumer could echo it.

## POSITIVE controls

- Attachment: `.chara` name check, declared-size check, https + Discord CDN host allowlist, `redirect: 'manual'` (3xx refused by `!ok`), 10 s timeout, streamed byte cap that ignores Content-Length lies (`chara-attachment.ts:79-124`, `read-text-capped.ts:48-80`).
- Bytes (not decoded text) go to the reader so invalid UTF-8 is refused (`chara-identity.ts:47`); core caps at `MAX_CHARA_FILE_BYTES` (`chara-library.ts:143`).
- Nickname never leaves: glamour destructures only gear/dye/identity members (`glamour.ts:444`); swatch strips at projection, type-level `Omit` (`swatch.ts:102`, `:264`).
- Producer is a fixed-token allowlist; tribe/gender/race come from valid-enum states only.
- Only the 4 validated integer lanes + glasses id leave for api-worker (`glamour.ts:271-273`, handler `:56`); matches PRIVACY_POLICY.md:92.
- Failure logs: `failureKind` = class + string code, never message (`failure-kind.ts:14-18`); handler logs fixed result codes only (`glamour.ts:176`, `swatch.ts:131`); api-worker 4xx reason is never logged or shown (HC-002, `glamour.ts:479-488`).
- Error embeds go through `sanitizeEmbedText` (defense in depth) (`glamour.ts:179`, `swatch.ts:138`); outbound edits carry `allowed_mentions` (`discord-api.ts:196`).
- SVG text through `frame.ts:171` `escapeXml`; card names fall back to English when the fonts cannot draw them (`glamour.ts:539`).
- Analytics blob6 is subcommand only, type-gated (`command-trace.ts:329-340`); no option values, filename or URL in any datapoint or log on these paths.
- 429 from api-worker answered as busy, not retried (`glamour.ts:469-471`).

## REJECTED

- Unbounded `response.json()` on the resolve response / 4xx body (`handlers/commands/glamour.ts:82-92`): internal service binding to our own api-worker, response bounded by 12 slots; INTERNAL trusted.
- Shared api-worker service key exhaustion by many users (1300/min vs 15/min/user): needs ~87 accounts, affects only /glamour, documented BUG-048 design; accepted trade-off class.
- `sanitizeEmbedText` collapsing the NO_GEAR newline / escaping localized text: cosmetic.
- Fetch error logged via `logger.error('Glamour download error', error)`: workerd network/timeout errors carry no URL; no reachable leak of the CDN URL (channel id / filename) found.
- `localName` empty-string name when XIVAPI omits a language: cosmetic.
- `failureKind` echoing data via `error.name`/`code`: names/codes are library constants.

## FILES COVERED (19)

packages/bot-logic/src/commands/{glamour,swatch,chara-identity,failure-kind}.ts, packages/bot-logic/src/discord-markdown.ts, packages/bot-logic/src/i18n/locales/en.json (grep);
apps/discord-worker/src/handlers/commands/{glamour,swatch}.ts, apps/discord-worker/src/utils/{chara-attachment,read-text-capped,discord-api}.ts, apps/discord-worker/src/services/{rate-limiter,command-trace,analytics}.ts (partial), apps/discord-worker/src/index.ts (dispatch 960-1040), apps/discord-worker/PRIVACY_POLICY.md (grep);
packages/worker-kit/src/rate-limiter/presets/configs.ts; apps/api-worker/src/middleware/rate-limit.ts, apps/api-worker/src/chara/xivapi.ts (grep); packages/core/src/services/chara/chara-library.ts (partial); packages/svg/src/{glamour-card,frame}.ts (grep).
