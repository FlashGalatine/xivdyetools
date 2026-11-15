# Review: policy-bot-en (discord-worker (policy))

Scope: `apps/discord-worker/PRIVACY_POLICY.md` and `apps/discord-worker/TERMS_OF_SERVICE.md` (English, authoritative,
both "Last Updated: October 12, 2026", last commit 3aed1596) checked claim-by-claim against discord-worker 5.9.0,
moderation-worker 1.8.2, presets-api 2.6.1, bot-logic 4.11.0, core 5.15.0 (`/chara`, xivcharakit 0.1.0-beta.4) and
api-worker 0.21.0's `/v1/chara/resolve`. HEAD 13c386e5. Read-only; no probes were needed.

## Claim table (policy section -> code)

| Policy claim | Code checked | Verdict |
|---|---|---|
| PP §2 Discord User ID uses (prefs, favorites, votes, RL, first-run flag, usertrack, AE count) | `services/preferences.ts:56` `prefs:v1:`, `services/preset-favorites.ts:23,31`, `index.ts:878` `firstrun:v5:`, `services/analytics.ts:94,140,231` | accurate |
| PP §2 Preferences field list incl. "time you last changed them" | `types/preferences.ts:64-115` (language, blending, matching, count, clan, gender, world, market, show*, theme, dyeFilters, updatedAt, _version) | accurate (`_version` is schema metadata) |
| PP §2 favorites: up to 50, id + name at save time | `preset-favorites.ts:146-161,188-196`; empty list deletes both v1/v2 keys | accurate |
| PP §2 first-run flag 180 days | `index.ts:860,881` `expirationTtl: 180d` | accurate |
| PP §2 Rate limiting: native service 60 s; KV fallback key userId+command, 120 s | `services/rate-limiter.ts:147-158`; worker-kit `backends/kv.ts:64,218` (60 s window + 60 s buffer) | accurate |
| PP §2 Usage Analytics columns + failure classes | `services/analytics.ts:27-35,90-107` (blob1-8, doubles 1-3); `OutcomeClass` matches the listed classes | accurate |
| PP §2 KV counters / usertrack 30-day TTL | `analytics.ts:133,191,231` | accurate |
| PP §2 Moderation Records (ban record fields, moderation log) | `presets-api/schema.sql:138-170` | accurate |
| PP §3 "Data We Do NOT Collect" closure | logger/KV/AE/D1 sinks for the bot (below) | holds; no IP, guild/channel id, message content, file or nickname reaches a sink |
| PP §3 Character Files steps 1-4 | `utils/chara-attachment.ts:65-127` (name `*.chara`, 8 KiB, CDN allowlist, manual redirect, capped read); `handlers/commands/glamour.ts:137-166`; nothing persisted | accurate |
| PP §3 "/glamour sends equipment model numbers + facewear id ... nothing else" | `glamour.ts:54-61` body `{gear, glasses}`; bot-logic `glamour.ts:465` `wireModel`; core `chara-models.ts:24-32` (slot/set/base/variant) | accurate |
| PP §3 "Read for its colors, dyes and equipment" | bot-logic `swatch.ts:477-482`, `glamour.ts:549` also read and print clan, gender and producing tool | INCOMPLETE -> policy-bot-en-01 |
| PP §3 Character names never displayed or stored | bot-logic `swatch.ts:102` `Omit<..., 'nickname'>`, `glamour.ts:432` | accurate |
| PP §5 Data Storage table (KV / D1 / AE / Discord posts) | KV writes `git grep kv.put` (prefs, favorites, firstrun, stats, usertrack, `announced:v:` memo - not personal); D1 tables `schema.sql`; moderation posts `review-message.ts:156-167`, moderation-worker `preset.ts:196-199,519-571` (ID-bearing ban confirm is ephemeral `flags: 64`), unban reply ephemeral `preset.ts:609` | accurate |
| PP §5 Operational Logs "two lines carry the user id" | `index.ts:922,967`; all 117 logger calls in `apps/discord-worker/src` reviewed (context objects: customId, presetId, keys, status, version...); bot-logic logs `failureKind` only (`glamour.ts:449,485`, `swatch.ts:412`); guarded by `src/__tests__/log-user-id-invariant.test.ts` | accurate |
| PP §5 Workers Logs off | `apps/{discord,moderation,presets-api,api,image,oauth,og}-worker/wrangler.toml [observability] enabled = false` | accurate |
| PP §6 third parties (Discord, Cloudflare, Universalis, XIVAPI, Perspective) | outbound-fetch.txt: discord-worker fetches Discord REST/CDN, service bindings, GitHub raw changelog (operational, no user data); api-worker -> XIVAPI, Universalis; presets-api -> Perspective | accurate (Perspective sunset tracked, not re-filed) |
| PP §7 commands `/preferences show|reset [key]`, `/preset favorite add|remove|list` | `commands/schemas.ts:654,797,802,1249-1284`; reset-all deletes blob + legacy keys `services/preferences.ts:385-391` | exist |
| PP §8 retention rows | presets-api `moderation-retention-service.ts` (90 d lifted ban, 12 mo user-action log), `notification-service.ts:198,205` (30/90 d), `rate-limit-service.ts:146` (30 d); preset delete purges votes/log/failed `handlers/presets.ts:458-468`; dead letter holds ids only `notification-service.ts:182-191` | accurate |
| ToS §3 service list vs `commands/registry.ts:29-57` (18 registrations) | every named command (`/preset favorite`, `/comparison`, `/contrast`, `/mixer`, `/gradient`, `/budget`, `/swatch`, `/glamour`) registered; utility commands unnamed but not described as absent | accurate |
| ToS §5 automated check, flagged/unresolved held | DEPRECATIONS.md Perspective entry; presets-api fail-closed | accurate |
| Section citations in code (§2 analytics, §3 chara, §5 logs) | `services/analytics.ts:43`, bot-logic `swatch.ts:93,109`, `glamour.ts:432`, `preferences.ts:680`, `log-user-id-invariant.test.ts:2` | all point at the right sections |
| Last Updated 2026-10-12 vs later changes | since then: 5.8.15 (`.chara` name + 8 KiB cap), 5.9.0 (xivcharakit facade, bytes passed) - no new data flow | not stale |
| Cross-doc: web PRIVACY.md L179-180, L237 defer to bot policy; bot /manual (`bot-logic en.json:712`) "read once ... not stored" | consistent |

## POSITIVE controls

- `log-user-id-invariant.test.ts` source-scans every logger call and pins the two documented user-id lines.
- `CommandEvent` (analytics.ts:46-66) documents the never-record list next to the only writer; blob3 is `guild|dm`, never the id.
- `.chara` download: https + exact Discord CDN hosts, `redirect: 'manual'`, 10 s timeout, 8 KiB declared and streamed caps, name must end `.chara` (chara-attachment.ts:42-127).
- Resolve body is model numbers and a facewear id only; api-worker chara code has no logger calls.
- Preference write failures log key names/types/lengths, never values (preferences.ts:357-364); unreadable blob logs reason only (176-178).
- Ban-confirm (shows the target id) and unban reply are ephemeral in moderation-worker (preset.ts:571, 609).
- Every retention number in PP §8 has a matching constant and a cron purge (presets-api wrangler.toml:126).

## REJECTED

- `budget.ts:506` logs `error.message`: messages come from api-worker's fixed strings (`universalis/router.ts:215-336`), never the world name.
- `logger.info('Handling button', { customId })`: custom_ids carry dye hex/RGB/HSV or server-generated preview keys (`copy.ts:146-158`, `preview-image-service.ts:156`), no user data.
- Glamour/swatch "download error" logs the Error: a fetch failure does not carry the attachment URL in workerd's message (no reachable path shown).
- Legacy v4 KV keys (`xivdye:favorites:v1:` / `collections`) undisclosed: cleanup ran 2026-08-29 (CHANGELOG.md:1129); `budget:world:v1:` is a world preference, deleted by reset (preferences.ts:389-391,417-419).
- chara-resolve Cache API rows: keyed by model triple, shared, not linked to a user; covered by "looks them up in XIVAPI".
- GitHub missing from PP §6: only the public changelog is fetched on a webhook, no user data.
- Perspective row / 2026-12-31 sunset: rejected precedent (2026-10-03 report) and tracked in DEPRECATIONS.md.
- xivcharakit MIT notice: no ToS obligation for server-side use; supply-chain reviewer's lane.
- Preset `example_link` / `secondary_categories` not in PP §2: the bot never sets them (no reference in discord-worker/bot-logic).

## FILES COVERED (42)

apps/discord-worker/{PRIVACY_POLICY.md, TERMS_OF_SERVICE.md, CHANGELOG.md, wrangler.toml}; apps/discord-worker/src/{index.ts,
commands/registry.ts, commands/schemas.ts, handlers/commands/{glamour,swatch,budget,preferences,preset,stats}.ts,
handlers/buttons/{index,copy,preview-image}.ts, services/{analytics,preferences,preset-favorites,rate-limiter}.ts,
services/budget/universalis-client.ts, utils/chara-attachment.ts, types/preferences.ts, __tests__/log-user-id-invariant.test.ts};
packages/bot-logic/src/{commands/glamour.ts, commands/swatch.ts, i18n/locales/en.json}; packages/core/src/services/chara/chara-models.ts;
packages/worker-kit/src/rate-limiter/backends/kv.ts; apps/api-worker/src/chara/cache.ts (+ grep of src/chara, src/universalis/router.ts);
apps/presets-api/{schema.sql, src/services/notification-service.ts, src/services/moderation-retention-service.ts, src/services/rate-limit-service.ts, src/handlers/presets.ts};
apps/moderation-worker/src/{handlers/commands/preset.ts, handlers/review-message.ts, middleware/rate-limit.ts, utils/response.ts, index.ts};
apps/web-app/PRIVACY.md (bot cross-references only); DEPRECATIONS.md; 7 x apps/*/wrangler.toml [observability].
