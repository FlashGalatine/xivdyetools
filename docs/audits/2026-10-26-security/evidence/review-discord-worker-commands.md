# Review: discord-worker-commands (discord-worker + bot-logic)

Audit: 2026-10-26 whole-monorepo security audit, HEAD 13c386e5. Reviewer key `discord-worker-commands`.
Read-only. No scratch probes were needed; every claim below cites the file:line that was opened.

## Command / module table (the .chara surface first)

| Command / module | Entry | Input | Outbound | Rate limit (worker-kit `DISCORD_COMMAND_LIMITS`) | Authz |
|---|---|---|---|---|---|
| `/swatch file: order: slot:` | `handlers/commands/swatch.ts:52` | ATTACHMENT (`schemas.ts:904-`), `order`/`slot` allowlisted at `swatch.ts:79-82` | Discord CDN GET (`chara-attachment.ts:112`), Discord webhook PATCH | `swatch` 15/min (`configs.ts:91`) | any Discord user (signed interaction) |
| `/glamour file:` | `handlers/commands/glamour.ts:101` | ATTACHMENT (`schemas.ts:943-951`) | Discord CDN GET; api-worker `POST /v1/chara/resolve` over `UNIVERSALIS_PROXY` (`glamour.ts:54-98`); Discord PATCH | **no entry** -> `default` 15/min (`configs.ts:102`, `getDiscordCommandLimit` `configs.ts:115`) | any Discord user |
| `utils/chara-attachment.ts` | `checkCharaAttachment` :65, `downloadCharaAttachment` :107 | resolved attachment (signed payload) | `fetch(url, {redirect:'manual', signal: AbortSignal.timeout(10_000)})` :112-115 | - | - |
| `utils/read-text-capped.ts` | `readBytesCapped` :48 | CDN response | - | - | - |
| bot-logic `chara-identity.ts` | `readCharaForTools` :46 | bytes (preferred) or text | - | - | - |
| bot-logic `glamour.ts` | `executeGlamour` :423 | projection members only (:435-444) | injected resolver (`wireModel` :271) | - | - |
| bot-logic `swatch.ts` | `executeSwatch` | projection minus nickname (`withoutNickname` :264) | - | - | - |
| autocomplete | `index.ts:1100` | focused option | presets-api (service binding), budget world list | `autocomplete` 60/min + burst (`index.ts:1113-1127`) | preset `edit` / `favorite remove` scoped to the caller's own id (`index.ts:1197-1208`) |
| `/stats overview|commands|health` | `stats.ts:107` | subcommand | KV list | default | `STATS_AUTHORIZED_USERS` exact id match (`stats.ts:71-78`) |
| copy buttons | `buttons/copy.ts:34-113` | bot-built `custom_id` | ephemeral type-4 reply | - | - |

Authz matrix (commands in scope): every command passes the dispatcher's missing-userId refusal (`index.ts:915-920`) and the per-user limiter before dispatch (`index.ts:952-972`); there is no route-level auth beyond the Ed25519 check (out of this lens; 2026-10-03 positive control).

## Candidates

- **discord-worker-commands-01 (LOW, INTERNET-AUTH)** `/glamour` has no tier of its own in `DISCORD_COMMAND_LIMITS` (`packages/worker-kit/src/rate-limiter/presets/configs.ts:68-103`; resolution falls to `default` at :115), so it gets the same 15/min/user as a pure render, yet every run spends one request against api-worker's single shared service key (`apps/api-worker/src/middleware/rate-limit.ts:62-63`, `SERVICE_LIMIT` 1300/60 s, `SERVICE_KEY = 'workers'`). About 87 Discord accounts at 15/min fill that key (per colo), after which every user's `/glamour` answers RESOLVE_BUSY (`bot-logic/src/commands/glamour.ts:469-471`). Varying the gear numbers also makes each call a cache-missing XIVAPI search. Bounded: the public `/v1/chara/resolve` is already reachable at 60/min/IP, so this is a cross-user availability lever for the bot path, not a new amplifier. The 1300 bucket fails open (`failOpen: true`).

## Positive controls (verified at file:line)

- Attachment guard: `*.chara` filename (case-insensitive) checked before any fetch (`chara-attachment.ts:79`); Discord-reported size against core's 8 KiB `MAX_CHARA_FILE_BYTES` (`:82`, `core/src/services/chara/chara-parser.ts:81`); https + exact host allowlist `cdn.discordapp.com` / `media.discordapp.net` (`:42-58`); `redirect: 'manual'` plus `!response.ok` refuses any 3xx (`:112-119`); 10 s timeout (`:36`, `:114`); counted streamed cap that cancels the reader above the cap and does not trust Content-Length (`read-text-capped.ts:52-73`). The 2026-10-03 cap was 1 MiB; it is now 8 KiB (stricter, not a regression).
- The capped **bytes** (not the lossy decode) are what core reads (`glamour.ts:156-160`, `swatch.ts:110-111`, `chara-identity.ts:47`), and core reads them through `readChara(input, { maxBytes: MAX_CHARA_FILE_BYTES })` (`core/src/services/chara/chara-library.ts:142-144`); diagnostic paths are reduced to a known-segment allowlist (`chara-library.ts:151-160`), issues capped at 64 (:48, :162-177), labels capped at 256 code units (:146-149).
- Nickname never leaves the read: glamour destructures only gear/race/gender/tribe/producer/issues (`bot-logic/src/commands/glamour.ts:435-444`); swatch strips it at projection (`swatch.ts:256-266`, `SwatchCharacter = Omit<..., 'nickname'>` :102). TypeName reaches a card only as a fixed token from a 3-entry allowlist (`chara-identity.ts:75-85`); tribe only when the library marks it `valid` (`chara-library.ts:258`) and then through `getLocalizedClan`; gender via `HOST_GENDER` map (:136, :259-260).
- File name is used only for the suffix check; it is never logged, put in a KV key, a datapoint or a message (grep `logger|console` x `interaction|resolved|attachment|filename|.url` over `apps/discord-worker/src` and `packages/bot-logic/src`: no hit).
- Failure logs name the class and code, never the message (`bot-logic/src/commands/failure-kind.ts:14-18`; glamour :449, :485-487, :619; swatch :412, :635); the adapters log only the result code (`handlers/commands/glamour.ts:176`, `swatch.ts:131`). Outcome classification records a fixed enum, never error text (`services/command-trace.ts:298-311`).
- Refusals are fixed localized text (`chara-attachment.ts:27-33`, `glamour.ts:430`, `swatch.ts:417`), and the adapters still pass `errorMessage` through `sanitizeEmbedText(..., 1024)` (`handlers/commands/glamour.ts:179`, `swatch.ts:136-140`).
- Resolve request carries only `{slot, base, variant, set?}` plus an integer glasses id (`bot-logic glamour.ts:271-273`, `:465`; adapter body `handlers/commands/glamour.ts:56`), 12 s timeout (:41, :61); api-worker's English 4xx reason is never shown or logged (`bot-logic glamour.ts:479-481`).
- Every outbound Discord REST body defaults `allowed_mentions: { parse: [] }` (`utils/discord-api.ts:27-32`).
- Card text is XML-escaped in `@xivdyetools/svg` (`packages/svg/src/glamour-card.ts:38` imports `escapeXml`; the swatch embed carries only computed hexes, dye names and fixed strings, `bot-logic swatch.ts:583-630`).
- Every STRING option in `commands/schemas.ts` has `max_length` or `choices` (node scan of the file: 53 options, 0 without).
- User-typed values echoed into embeds go through `sanitizeEmbedText` with a cap (`dye.ts:139`, `:207`; `comparison.ts:69-71`; `contrast.ts:76`; `gradient.ts:76/92`; `harmony.ts:81`; `mixer-v4.ts:64/77`; `extractor.ts:274`; `budget.ts:296`; `preset.ts:844`); the repeated-dye message names the dye from the database, not the typed text (`preset.ts:993-998`).
- `/stats` admin subcommands are gated by exact id match (`stats.ts:71-78`, `:106-118`); autocomplete is rate limited and fail-soft (`index.ts:1111-1128`).
- `xivcharakit` is pinned exactly (`packages/core/package.json:78` `0.1.0-beta.4`, lockfile integrity at `pnpm-lock.yaml:4048-4049`, no transitive deps at :7149).

## Rejected

- **Download-error log leaks the CDN URL (with the file name in its path)** - `handlers/commands/glamour.ts:151` / `swatch.ts:116` log the caught Error, but the URL is allowlisted and well-formed before fetch, and a workerd network/timeout error does not quote the URL; no reachable path shown. Logs are also off in production (`[observability] enabled = false`, CI gate).
- **Glamour embed `plain()` does not neutralize masked links / `@` in item names and acquisition lines** (`bot-logic glamour.ts:384-386`) - the text comes from api-worker's game-data tables and XIVAPI, never the file; mentions are disabled by default (`discord-api.ts:27-32`).
- **Copy buttons echo `custom_id` unvalidated** (`buttons/copy.ts:34-47`) - the id is built by the bot (`:146`), Discord only returns ids of components the bot created, and the reply is ephemeral.
- **`safeEditOriginalResponse` logs Discord's raw error body via `console.error`** (`discord-api.ts:268-273`) - Discord's validation errors name field paths and codes, not submitted values; logs are off in production.
- **Glamour description can overflow when the notes tail alone exceeds 4000 chars** (`bot-logic glamour.ts:606-608`) - a correctness edge (silent failed edit), not a security effect.
- **`downloadCharaAttachment` leaves a non-ok body unconsumed** (`chara-attachment.ts:116-119`) - bounded by the timeout; no resource effect beyond the request.
- **`/budget` logs `error.message`** (`budget.ts:503-506`) - the world is canonicalized and the dye resolved before the try (`budget.ts:300-310`, :350-352); no user text reaches those errors on a path I could trace. Outside this lens's new surface.

## Files covered

22 files: `apps/discord-worker/src/utils/{chara-attachment,read-text-capped,discord-api(part)}.ts`; `apps/discord-worker/src/handlers/commands/{glamour,swatch,stats(part),dye(part),comparison(part),budget(part),preferences(part),preset(part)}.ts`; `apps/discord-worker/src/handlers/buttons/copy.ts`; `apps/discord-worker/src/index.ts` (dispatcher 902-1060, autocomplete 1100-1300); `apps/discord-worker/src/services/{command-trace(part),analytics(part)}.ts`; `apps/discord-worker/src/commands/{schemas,registry}.ts` (scan/grep); `packages/bot-logic/src/commands/{glamour,swatch,chara-identity,failure-kind}.ts`; `packages/core/src/services/chara/chara-library.ts` (projection); `packages/worker-kit/src/rate-limiter/presets/configs.ts`; `apps/api-worker/src/middleware/rate-limit.ts` (service limiter); `packages/svg/src/glamour-card.ts` (escape grep).

Not covered: xivcharakit internals (`readChara` depth/node bounds, prototype keys), `extractor.ts` image path beyond the attachment lookup, `preset.ts` submit/edit bodies and presets-api error text, `handlers/buttons/preview-image.ts`, `manual.ts`/`changelog.ts`/`about.ts`, `commands/localize.ts`.
