# FINDING-024: /preset favorite list fans out up to 50 userless presets-api reads that skip both presets-api limiters
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** discord-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-770

## Location
- `apps/discord-worker/src/handlers/commands/preset.ts:1310` — /preset favorite list fans out up to 50 userless presets-api reads that skip both presets-api limiters

## Evidence
- preset.ts:1310-1312 `const resolved = await Promise.all(ids.map((id) => presetApi.getPreset(env, id).catch(() => null)));`; rate-limit.ts:139 `if (!c.req.raw.headers.get('CF-Connecting-IP')) return next();`; rate-limit.ts:159 `if (!actingUserId(c)) return next();`
- Reach: Any Discord user who has added up to 50 favorites (MAX_PRESET_FAVORITES, preset-favorites.ts:34) runs a signed `/preset favorite list` interaction. processFavoriteList (preset.ts:1310-1312) then issues one `Promise.all` of up to 50 `presetApi.getPreset` calls over the PRESETS_API service binding, each with no X-User-Discord-ID.
- getPreset (preset-api.ts:237-239) passes no userDiscordId, so request() (preset-api.ts:93-98) sends no identity header. presets-api's IP limiter returns early when there is no CF-Connecting-IP (rate-limit.ts:138-140), and the per-user limiter returns early when actingUserId is undefined (rate-limit.ts:158-160, :110-114; auth.ts:282 sets userDiscordId to undefined for a userless bot call). The only bound is discord-worker's per-user `preset` tier of 10/min (configs.ts:83, applied at index.ts:952-965), so each account can drive about 500 primary-key D1 reads per minute, and this scales with the number of accounts. The impact is load… Preconditions: You need a Discord account that can use the bot and has favorited up to 50 presets, which takes up to 50 prior /preset favorite add commands at 10/min. This is real as described. The presets-api reviewer recorded the binding skip as by design (review-presets-api-routes.md:7,46), but the rate-limit.…
- Live state the repo cannot show: This assumes the production RL_* bindings enforce the 10/min preset tier. If they are unbound, the KV fallback applies the same nominal limit, but it is eventually consistent.

## Fix
- Render the list from the v2 denormalized {id,name} entries, or add a batch `GET /presets?ids=` endpoint so the command makes one call. Failing that, cap the concurrency and send the acting userDiscordId so presets-api's per-user limiter counts these reads.

## Status
OPEN
