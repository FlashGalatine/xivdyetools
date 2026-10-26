# Review: r2-discord-handlers (deploy unit: discord-worker)

Second-pass reviewer, 2026-10-26 whole-monorepo audit, HEAD 13c386e5. Read-only; no scratch probes.
Focus: the discord-worker handler bodies round 1 only grepped (preset submit/edit/browse, budget,
extractor image path, stats, preview-image moderator flow, announcements, changelog parser, SVG
renderer, font coverage, emoji), error-text echo, mentions, moderator-only effects, option bounds,
KV/cache key construction.

## Command / component / module table

| Surface | Entry | User input reaching outbound / storage | Response type | Authz |
|---|---|---|---|---|
| `/preset list` | `preset.ts:177-268` | `category`, `sort` (schema choices) -> `URLSearchParams` (`preset-api.ts:219-229`) | deferred public, REST edit | any user |
| `/preset show` / `random` | `preset.ts:274-396` | name/UUID -> `lookupPreset` (UUID path-encoded, else `search=` query) `preset-api.ts:237-266` | deferred public | any user; presets-api returns only approved presets to a userless bot GET (`presets/handlers/presets.ts:969-972`) |
| `/preset submit` | `preset.ts:402-595` | name/description/tags/dye names -> body of signed v2 POST; display name -> `X-User-Discord-Name` (`preset-api.ts:96-98`) | sync ephemeral refusals, then deferred public | presets-api requireAuth + requireUserContext + ban gate |
| `/preset vote` | `preset.ts:601-685` | preset UUID/name; user id header | deferred public | presets-api per user |
| `/preset edit` | `preset.ts:691-958` | new name/desc/tags/dye names | deferred public | bot-side owner check `preset.ts:782` + presets-api re-authorises |
| `/preset favorite add/remove/list` | `preset.ts:1129-1349` | preset id/name; KV key `xivdye:preset_favorites:v2:<userId>` (`preset-favorites.ts:64-68`) | deferred ephemeral | own user id only |
| `/budget find` / `quick` | `budget.ts:257-520`, `:601-646` | target dye (resolved to DB itemID before defer), world (canonicalised by `validateWorld` after defer, `budget.ts:168-196`) | deferred public; refusals moved private (`refusePrivately` `:207-228`) | any user |
| `/budget set_world` | `budget.ts:534-592` | world -> canonical name -> `prefs:v1:<userId>` | deferred ephemeral | own user |
| `/extractor color` | `extractor.ts:228-419` | color text (resolved to hex/dye before defer) | deferred public | any user |
| `/extractor image` | `extractor.ts:430-659` | resolved attachment URL -> image-worker `/extract` (`image-client.ts:39-80`) | deferred public | any user |
| `/stats summary` | `stats.ts:169-220` | none | immediate public (no user text) | any user |
| `/stats overview/commands/health` | `stats.ts:235-463` | none | immediate ephemeral | `STATS_AUTHORIZED_USERS` exact match (`stats.ts:71-78`, gate `:106-118`) |
| `/changelog` | `changelog.ts:61-119` | `version` -> exact-match lookup; echo sanitized (`:87-89`) | immediate ephemeral | any user |
| `/dye search/info` | `dye.ts:121-217` | query/name echoed via `sanitizeEmbedText(…,100)` (`:139`, `:207`) | immediate public (search, title only) / deferred | any user |
| `/preferences set` | `preferences.ts:440-598` | every key enum-validated (`services/preferences.ts:491-573`); world canonicalised (`preferences.ts:465-486`) | ephemeral | own user |
| copy buttons | `buttons/index.ts:69-85` | bot-issued custom_id | ephemeral type 4 | any clicker |
| preview-image approve/reject | `buttons/preview-image.ts:139-188` | custom_id parsed to UUID / 78-char key (`:103-120`, `types/preset.ts:200-210`) | DEFERRED_UPDATE_MESSAGE + REST edit | `isModerator` before any API call (`:161-163`); presets-api re-checks moderator from signed headers |
| modals | `index.ts:1516-1528` | none handled (fixed refusal) | ephemeral | n/a |
| moderation-channel embed builder | `preset-notifications.ts:146-279` | stored preset text, sanitized (`:154-156`) | channel post via REST | webhook-authenticated caller only |
| GitHub announcement | `announcements.ts:30-112`, `changelog-parser.ts:39-101` | maintainer changelog text | channel post via REST (`allowed_mentions` default) | HMAC webhook |
| SVG -> PNG | `services/svg/renderer.ts:78-151` | card SVG (escaped by `@xivdyetools/svg`) | - | - |
| font coverage | `services/font-coverage.ts:176-220` | preset name/desc/author filtered to drawable code points; embed keeps original | - | - |
| emoji | `services/emoji.ts:59-62` | stainID + own application id lookup only | - | - |

Authz matrix (moderator-only effects reachable from this worker): preview-image approve / reject / legacy refresh are the only moderator effects; all three return `previewImage.notPermitted` before any presets-api call for a non-moderator (`preview-image.ts:155-163`). No modal, autocomplete or command on this worker performs a moderator effect; `/preset moderate` lives on moderation-worker. `/stats` admin panels are read-only operator data gated by exact id match.

## Candidates

- **r2-discord-handlers-01 (LOW, INTERNET-AUTH, CWE-770, policy NONE)** - `/preset favorite list` fans one command out to up to 50 parallel presets-api reads that carry no user id, so presets-api's per-IP and per-user limiters both skip them. One account with 50 favorites therefore drives ~500 D1 reads/min through the shared service binding, bounded only by discord-worker's own `/preset` limit (10/min, `packages/worker-kit/src/rate-limiter/presets/configs.ts:83`). Evidence: `preset.ts:1310-1312` `Promise.all(ids.map((id) => presetApi.getPreset(env, id).catch(() => null)))` over up to `MAX_PRESET_FAVORITES = 50` (`preset-favorites.ts:34`); `getPreset` passes no `userDiscordId` (`preset-api.ts:237-239`); `apps/presets-api/src/middleware/rate-limit.ts:138-140` `if (!…'CF-Connecting-IP') return next();` and `:158-160` `if (!actingUserId(c)) return next();`. Hardening only: pass the acting user id on reads, or cap/serialise the fan-out. (Not filed by the presets-api reviewers: `review-presets-api-routes.md:7,46` records the skip as design.)

## Positive controls (verified at file:line)

- presets-api error text is never relayed: non-2xx throws `PresetAPIError` (`preset-api.ts:162-167`) and every catch renders `t.t(error.getSafeMessageKey())` or a fixed key (`preset.ts:588-593`, `:951-956`, `types/preset.ts:160-179`). The only verbatim `response.error` echo is on a 2xx `success:false` body inside an embed description (`preset.ts:547-551`, `:664-668`, `:903-907`).
- UniversalisError / upstream text is never shown: `/budget` maps to `budget.errors.rateLimited` / `apiError` (`budget.ts:509-514`). Its log line `Budget error details: ${errorMsg}` (`:503-506`) cannot carry the typed world: the world is canonicalised before any priced call (`budget.ts:350-351`, `universalis-client.ts:356-390`), and api-worker's aggregated-route error bodies are fixed strings with no world echo (`apps/api-worker/src/universalis/router.ts:215, 221, 270, 285, 305, 320, 335`). The ledger log records only `hasWorld` (`budget.ts:365`).
- image-worker rejection text is matched to a marker table and never shown or recorded (`image-input-errors.ts:21-55`, `extractor.ts:643-653`); none of image-worker's messages interpolates the URL (`apps/image-worker/src/validators.ts:124-539`, `index.ts:140-215`, grep of `throw new` / `error:`).
- Typed option values echoed into embeds are sanitized and capped: dye search/info (`dye.ts:139`, `:207`), extractor (`extractor.ts:274`), budget dye/world/preset id (`budget.ts:296`, `:187`, `:576`, `:621`), preset edit dye (`preset.ts:844`), favorite remove fallback name (`preset.ts:1246`), changelog version (`changelog.ts:88`). `sanitizeEmbedText` strips C0/C1/zero-width/bidi first, then defuses `@everyone`/`@here`/`<@…>`, then escapes markdown incl. `[]()` (`packages/bot-logic/src/discord-markdown.ts:46-71`).
- `/budget` refusals that echo a typed or stored world are sent privately (delete public defer, ephemeral follow-up; `budget.ts:189-194`, `:207-228`).
- Preview-image: custom_id bound to exactly a UUID or a 78-char `<uuid>/<uuid>.webp` key (`types/preset.ts:205-210`), moderator gate before `waitUntil` (`preview-image.ts:161-163`), moderator name sanitized to 64 and never a `<@id>` mention (`:279`), refreshed key re-validated and required to start with `<presetId>/` (`preset-api.ts:433-437`), image URL rebuilt only from the validated key (`preview-image.ts:212`), stale revision answered 409 -> buttons retired (`:336-361`).
- Moderation-channel builder sanitizes name/description/author unconditionally and never mentions the author (`preset-notifications.ts:154-156`, `:182-183`); custom ids come from the shared typed builder (`:238-271`).
- Option bounds come from the signed schema: `steps` 2-12, `companions` 1-3, `colors` 3-10, `count` 1-10, `max_distance` 2-20 (`commands/schemas.ts:210-215, 340-345, 375-380, 429-434, 1338-1343`); code clamps again for counts (`extractor.ts:254-257`, `:477`) and `matchLine` (`budget-calculator.ts:159`); tags capped at 10 (`preset.ts:475-481`, `:806-810`); dye loops fixed at 6 (`preset.ts:420`, `:718`).
- Key construction: KV keys use only the user id (`prefs:v1:`, `firstrun:v5:` `index.ts:877-883`; favorites `preset-favorites.ts:64-68`); the price cache key uses the canonical world + numeric item id (`price-cache.ts:40-42`); presets-api path segments are `encodeURIComponent`-ed and typed names go to `search=` (`preset-api.ts:239, 346, 367, 380, 398, 461`).
- Preset show/random/favorite reads cannot surface hidden content: a userless bot GET sees only approved presets (`apps/presets-api/src/handlers/presets.ts:969-972`), and name lookup filters `status: 'approved'` (`preset-api.ts:257-261`).
- No immediate public reply carries user text in `content`: public immediate replies are embeds (`dye.ts:142-172`, `stats.ts:184-219`); `/budget set_world` answers via REST edit (`budget.ts:591`) which defaults `allowed_mentions: {parse: []}` (round-1 positive control, `utils/discord-api.ts`).
- Renderer frees both wasm allocations per render (`svg/renderer.ts:115-150`); font coverage is parsed once per isolate and fails open below 256 code points (`font-coverage.ts:163-166`, `:186`).
- Emoji lookup is keyed by the bot's own application id, never user input (`emoji.ts:59-62`).
- The one bot-logic warn line that echoes a caller value (`[harmony] unknown colour wheel "<wheel>"`) cannot carry free text from this bot: `wheel` is a `choices` option (`commands/schemas.ts:203-207`) parsed through `parseColorWheelId` (`harmony.ts:53`). Translator keys built at run time use schema/enum values only (`manual.ts:371,379`; `preferences.ts:129,269,533,548,571,654,769,776`), so no option value reaches a missing-key warning.
- `/budget` loops are bounded by the 125-dye database, not option values: the candidate net iterates `getAllDyes()` (`budget-calculator.ts:182-198`), `matchLine` is clamped 2-20 (`:159`), price fetches batch at 100 (`universalis-client.ts:82, 279-288`), rows stop at `ROW_CAP`/pixel budget (`budget-calculator.ts:273-300`), and `/budget quick` resolves only a fixed `QUICK_PICKS` id (`quick-picks.ts:183-185`).
- Log lines in these handlers carry no option values: grep of `logger.(info|warn|error)` with `userId|world|query|input|customId` over `apps/discord-worker/src` yields only the two user-id lines the policy discloses (`index.ts:922`, `:967`; `PRIVACY_POLICY.md:129`) and bot-issued `custom_id`s (`buttons/index.ts:65,96`, `index.ts:1480,1523`).

## Rejected

1. **Component (button) interactions are not rate limited** (`index.ts:1471-1490`) - copy buttons answer an ephemeral type 4 from the bot-issued custom_id; cost per click is one KV read and one AE point, and Discord throttles interactions itself. Preview buttons are moderator-gated before work.
2. **`/budget` logs the raw error message** (`budget.ts:503-506`) - see positive control: no path puts the world or other user text in those messages; logs are off in production.
3. **Render error logs could quote SVG text** (`svg/renderer.ts:139-146`) - resvg parse errors report positions, card text is XML-escaped, logs off in production; no reachable leak shown.
4. **`/stats` admin list split on commas only** (`stats.ts:76`) - a newline-separated secret fails closed (denies), not open.
5. **`/preferences set` partial-failure field prints the raw reason code** (`preferences.ts:572`) - an i18n/UX defect; the value is an internal enum, not user text.
6. **`/preset edit` by typed name can pick a partial match** (`preset-api.ts:264-265`, `preset.ts:774-787`) - the owner check still runs on whatever matched; correctness, not authz.
7. **`Number(colorsOption.value)` NaN path** (`extractor.ts:477`) - unreachable: the option is an INTEGER with min/max in the signed schema.
8. **Changelog version regex backtracking** (`changelog-parser.ts:65`) - `.+$` always completes on a single line; input is the bundled/maintainer file.
9. **Verbatim `response.error` on 2xx `success:false`** - already rejected in round 1 (embed-only, internal service).

## FILES COVERED

33 files opened (grep-only files listed separately, not counted). Read in full: `apps/discord-worker/src/handlers/buttons/{index,preview-image}.ts`; `handlers/commands/{preset,budget,extractor,stats,preset-notifications}.ts`; `services/{preset-api,announcements,changelog-parser,font-coverage,emoji,image-client,image-input-errors}.ts`; `services/svg/renderer.ts`; `services/budget/{universalis-client,budget-calculator(130-386)}.ts`; `packages/bot-logic/src/discord-markdown.ts`. Read in part: `handlers/commands/{changelog,dye,preferences}.ts`; `services/{analytics,preferences}.ts`; `services/budget/price-cache.ts`; `types/preset.ts`; `src/index.ts` (820-900, 1370-1528); `commands/schemas.ts` (bounds grep); `apps/presets-api/src/handlers/presets.ts` (950-978); `apps/presets-api/src/middleware/rate-limit.ts` (1-177); `apps/api-worker/src/universalis/router.ts` (155-339); `apps/image-worker/src/{index,validators}.ts` (error grep); `apps/discord-worker/PRIVACY_POLICY.md` (grep). Grep only: `handlers/commands/{harmony,gradient,comparison,contrast,mixer-v4,accessibility,swatch,glamour,manual}.ts`, `services/{preset-favorites}.ts`, `services/budget/quick-picks.ts`.
`handlers/modals/` does not exist (removed 2026-08-18 per `apps/discord-worker/CLAUDE.md`); `MODAL_SUBMIT` is answered with a fixed refusal (`index.ts:1516-1528`).
Directories: `apps/discord-worker/src/{handlers/buttons,handlers/commands,services,services/budget,services/svg,types,commands}`, `packages/bot-logic/src`, `apps/presets-api/src/{handlers,middleware}`, `apps/api-worker/src/universalis`, `apps/image-worker/src`.

Not re-read here: `buttons/copy.ts`, `about.ts`, `manual.ts` - read in full by the round-1 gap reviewer (`review-gap-discord-unread-handlers-mentions.md`). Not covered: `accessibility.ts` / `mixer-v4.ts` / `harmony.ts` / `gradient.ts` bodies beyond grep; `utils/{discord-api,response,sanitize}.ts` (round-1 positive controls relied on).
