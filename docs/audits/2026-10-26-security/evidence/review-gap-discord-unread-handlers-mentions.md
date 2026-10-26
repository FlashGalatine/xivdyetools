# Review: gap-discord-unread-handlers-mentions (deploy unit: gap)

Checkout HEAD 13c386e5. Read in full: handlers/commands/preset.ts, manual.ts, changelog.ts, about.ts, utils/response.ts, services/announcements.ts, services/changelog-parser.ts, handlers/buttons/copy.ts, GitHub webhook block of index.ts (660-790), services/preset-api.ts request/vote/edit/autocomplete, types/preset.ts getSafeMessageKey. commands/localize.ts: header and map read (build-time only, imported solely by scripts/register-commands.ts; no runtime path).

## Route / command / module table

| Module | Surface | Response path | User-controlled text reaching `content` | Mention-capable? |
|---|---|---|---|---|
| preset.ts list/show/random/submit/vote/edit/favorite | slash, deferred | REST edit-original (allowed_mentions parse:[]), embeds only | none in `content`; embeds via sanitizePresetName/Description/sanitizeEmbedText | no (embeds never ping; REST adds parse:[]) |
| preset.ts sync early returns (80, 91, 135, 160, 165, 286, 429-468, 613, 704, 726, 1140, 1217) | immediate | messageResponse / ephemeralResponse | `errors.unknownSubcommand {name}` at 160/165 (Discord-schema-validated subcommand name, ephemeral) | no (ephemeral, schema-bounded) |
| manual.ts | slash, ephemeral (flags 64), spectrum_prices deferred ephemeral | Response.json embeds | none (locale strings, core constants, stored world only used for lookup) | no |
| changelog.ts | slash, ephemeral | Response.json embeds | `version` option echoed via sanitizeEmbedText(…,64) in an ephemeral reply (87) | no |
| about.ts | slash, PUBLIC | Response.json embeds | none (static roster, package version) | no |
| copy.ts | button, ephemeral | Response.json `content` | hex / rgb / hsv parsed from bot-issued custom_id, inside a code fence | no (ephemeral, own-user only) |
| budget.ts:564-585 set_world | deferred | REST edit `content` | world input, sanitizeEmbedText(…,64) | no (REST parse:[]) |
| announcements.ts + index.ts /webhooks/github | HMAC webhook -> channel post | sendMessage embeds only, REST parse:[] | changelog text of pinned repo, embed description | no |
| utils/response.ts messageResponse/ephemeralResponse | builders | no allowed_mentions | n/a | see Rejected 1 |
| commands/localize.ts | build-time | n/a | n/a | n/a |

Authz matrix (preset subcommands): list/show/random/favorite = any user; submit/edit/vote send X-User-Discord-ID + HMAC v2 signature to presets-api (preset-api.ts:96-130); edit checks `existingPreset.author_discord_id !== userId` before PATCH (preset.ts:782) and presets-api re-authorises; moderation commands are not on this worker.

## Positive controls
- Every non-ephemeral immediate response in this worker (`dye.ts`, `extractor.ts`, `mixer-v4.ts`, `stats.ts`, `about.ts`, `preset.ts`) is embeds-only: `git grep "content:"` over non-test src yields only copy.ts (ephemeral), preview-image.ts (ephemeral/REST), budget.ts:564 (REST) and response.ts. No public immediate `content` carries user text, so the missing allowed_mentions on the immediate builders (response.ts:88-112) has no reachable ping. Embed text never notifies in Discord.
- Deferred/follow-up/edit/sendMessage/editMessage all go through utils/discord-api.ts, which defaults `allowed_mentions: {parse: []}` (discord-api.ts:31-33, bodies at 84/108/173/196/417/451, multipart payload_json too).
- preset.ts relays NO presets-api error text for transport failures: non-2xx throws PresetAPIError (preset-api.ts:162-167) and the handler renders only `t.t(error.getSafeMessageKey())` (preset.ts:588-590, 952-953; mapping types/preset.ts:160-179). `response.error` (547-549, 665-667, 903-905) is reached only on a 2xx body carrying `success:false`; it is placed in an embed description, so it cannot ping and presets-api is trusted internal.
- Stored preset name/description/author/tags are sanitised before embed use (preset.ts:236-238, 534, 563, 891, 921, 1019-1022, 1170, 1246, 1327); the typed dye name echo is sanitized (844).
- Preset id/name routing: UUID check then search-query, `encodeURIComponent` on every path segment (FINDING-020 holds: preset-api.ts:343-345, 366, 380, 394; preset.ts:973-978).
- GitHub announce path: repository pinned (index.ts:681), ref main, fixed raw URL to the pinned repo with 10 s timeout (711-713), version memo (741-745), embed-only post, send result checked (announcements.ts:95-103, BUG-026). Changelog text is maintainer-authored markdown in an embed description and a pinned link; no payload field is interpolated into the URL or message.
- Logging in these handlers records only error objects/ids (preset.ts logger.error calls pass `Error`); no option values, preset names or display names are logged. Display name goes only to presets-api (X-User-Discord-Name, preset-api.ts:96-98), which PRIVACY_POLICY.md line 20 discloses.
- manual.ts/about.ts/changelog.ts contain no free-text from users; manual reads the stored world only to pick a Lodestone region.

## Rejected
1. Immediate builders without allowed_mentions (response.ts:88-112): no non-ephemeral immediate path puts user text in `content` (see above); ephemeral replies only ping their sole viewer. Hardening only; not filed.
2. copy.ts code-fence breakout via crafted custom_id: custom_id comes from bot-issued components inside a signature-verified interaction and the reply is ephemeral to the clicker.
3. preset.ts verbatim presets-api error relay: not present (safe-key mapping), except the 2xx `success:false` branch which is an embed from an internal service.
4. `/webhooks/github` fetching `main` rather than the pushed SHA: only a maintainer-controlled repo, version-memoised; race gives at worst a wrong-but-maintainer-authored announcement.
5. `errors.unknownSubcommand {name}` / `notImplemented {command}` echoes: values constrained by the registered schema, ephemeral.
6. Autocomplete choice names built from preset name/author (preset-api.ts:496-503): choices are plain labels, never parsed for mentions; capped at 100 chars.
7. Non-ASCII display name in X-User-Discord-Name header: robustness question, no security effect; out of scope.

## FILES COVERED
~17 files read in apps/discord-worker/src (handlers/commands, handlers/buttons/copy.ts, services, utils, types, commands/localize.ts partial, index.ts webhook section) plus apps/discord-worker/CLAUDE.md and PRIVACY_POLICY.md line greps. Directories: apps/discord-worker/src/{handlers,services,utils,types,commands}.
