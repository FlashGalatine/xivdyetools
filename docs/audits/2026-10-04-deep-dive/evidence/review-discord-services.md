# Review: discord-services (apps/discord-worker/src/services)

## Map
| Module | Role |
|---|---|
| preferences.ts | single KV blob `prefs:v1:{id}`, legacy migration, validate/apply/reset |
| preset-favorites.ts | KV favourites v2 (+v1 mirror) |
| preset-api.ts | presets-api client (service binding / URL), v2 HMAC signing |
| budget/* | Universalis client, Cache-API price cache, 13G ledger calculator, quick picks |
| analytics.ts / command-trace.ts | AE datapoints, KV counters, trace drain + outcome classifier |
| rate-limiter.ts | native RL_* tiers over worker-kit, KV fallback |
| image-client.ts / image-input-errors.ts | image-worker binding, error marker table |
| fonts.ts / font-coverage.ts / svg/renderer.ts | resvg init, cmap filter |
| announcements / changelog-parser / emoji / i18n / bot-i18n | thin helpers |

## Candidates

### discord-services-01 BUG HIGH (origin MAIN)
- preset-api.ts:96-97, 141-147 (request, inside the try at 131)
- Claim: `userName` is put verbatim into the `X-User-Discord-Name` header. A Discord display name with any code point above U+00FF (CJK, emoji, most "fancy" names) makes `new Request(..., {headers})` throw a ByteString TypeError.
- Failing input: `/preset submit` or `/preset edit` by a user whose `global_name` is `桜の夢` (preset.ts:76-81 passes global_name first). Verified in Node/undici: `new Request(u,{headers:{'X-User-Discord-Name':'桜の夢'}})` throws "Cannot convert argument to a ByteString ... greater than 255". workerd uses the same ByteString contract (not run on workerd here).
- Outcome: the throw lands in the catch at 171-179, becomes `PresetAPIError(500,'Failed to communicate with preset API')`, classified `upstream_presets`. The user sees a generic failure and presets-api never gets the request. Hits the JA/KO/ZH audience most. The v2 signature (117-128) is built from the same string, so a fix must change both ends.
- Tests miss it: preset-api*.test.ts contain no non-ASCII name. Covered by a test: no.
- Excerpt: `if (options.userName) { headers['X-User-Discord-Name'] = options.userName; }`
- Fix direction: percent-encode on send, decode in presets-api `authMiddleware` (auth.ts:254) and in the signed `userName` on both sides. moderation-worker/src/services/preset-api.ts:107 has the same line.

### discord-services-02 BUG MEDIUM (origin MAIN)
- command-trace.ts:310-312 with budget/universalis-client.ts:171-172
- Claim: the client synthesises `UniversalisError(408,'Request timeout')` on abort; `isUserCondition` treats every 4xx except 429 as a user condition.
- Failing input: the Universalis proxy stalls past 10 s during `/budget`. budget.ts:409 calls `classifyError(error)` -> `rejected`.
- Outcome: the row is recorded answered (`ANSWERED_OUTCOMES`), so `/stats` success counters and the public success rate count a timeout as success, and the AE outage spike is hidden as a user-input class.
- Tests miss it: command-trace.test.ts:366-373 tabulates 400/404/429/503/0 but not 408. Covered by a test: no.
- Excerpt: `return typeof status === 'number' && status >= 400 && status < 500 && status !== 429;`
- Fix direction: treat 408 as upstream (`status !== 408`), or throw a 504/0 status from the client on abort; add the 408 table row.

### discord-services-03 BUG MEDIUM (origin MAIN)
- preferences.ts:126-143 (swallow), 273-285 (set), 333-347 (reset)
- Claim: `getUserPreferences` returns `{}` for any KV read failure or JSON parse failure. `setPreferences` and `resetPreference(key)` treat that `{}` as the user's real state and write it back.
- Failing state: transient `kv.get` rejection (or a corrupt blob), then `/preferences set theme:light` -> `put({theme, updatedAt})` replaces all stored settings. `/preferences reset key:theme` under the same failure -> `hasPrefs` false -> `kv.delete(prefs key)` wipes everything.
- Outcome: silent loss of the whole preference blob, reported to the user as success.
- Tests miss it: preferences.exhaustive.test.ts:329-335 asserts only that the read returns `{}`; no test follows with a write. Covered by a test: no.
- Excerpt: `catch (error) { ...; return {}; }` then `const prefs = await getUserPreferences(...); ... await kv.put(buildPrefsKey(userId), JSON.stringify(prefs));`
- Fix direction: give the write paths a strict internal read that rethrows (null only for a missing key); keep the lenient one for command reads.

### discord-services-04 BUG LOW (origin MAIN)
- preset-favorites.ts:620-626, 670-680
- Claim: same pattern: a read failure returns `[]`, then `addPresetFavorite` saves `[new]` over the user's list (up to 50).
- Failing state: `kv.get` throws once during `/preset favorite add`. Outcome: the list is replaced by one entry. Remove is safe (returns notFound).
- Tests miss it: no read-failure-then-add test. Covered by a test: no.
- Fix direction: write paths use a rethrowing read.

### discord-services-05 BUG LOW (origin MAIN, latent)
- preferences.ts:204-223 vs 489-506
- Claim: validation lower-cases boolean strings (`'ON'`, `'True'` pass) but `applyPreference` compares case-sensitively, so a valid `'ON'` stores `false`. Same shape for `count`: parsed for validation (445-451), raw value stored (190-192).
- Unreachable today: the schema types these options BOOLEAN/INTEGER (schemas.ts ~690-760, 308), so Discord sends typed values. Latent for any future string caller.
- Tests miss it: preferences.exhaustive.test.ts checks validation and apply separately. Covered by a test: no.
- Fix direction: normalise once in `applyPreference`, or have validate return the normalised value.

### discord-services-06 OPT LOW (origin MAIN)
- preferences.ts:135-137 and 531-559
- Claim: a user with no unified blob (anyone who never ran `/preferences set`) pays two extra KV reads of the legacy keys on every `getUserPreferences` call, plus another in `resolveUserLocale`. The legacy writers were removed in March 2026 (comment at 523-524) and nothing negative-caches the miss.
- Impact: about three KV reads per command for most users, inside the pre-defer window. Fix direction: write a tombstone blob on first miss, or retire the migration.

### discord-services-07 OPT LOW (origin MAIN)
- budget/price-cache.ts:556-590
- Claim: ids with no listing are absent from `fetched`, so they are never cached. A `/budget` whose candidate set includes an unlisted board-only dye re-calls the proxy every time.
- Fix direction: cache a null entry for ids the proxy returned no row for, with the 5-minute TTL.

### discord-services-08 BUG LOW (origin MAIN)
- budget/universalis-client.ts:122-135, 164
- Claim: the abort timer is cleared in `finally` as soon as headers arrive, before `response.json()`. A proxy that sends headers then stalls the body is unbounded (the 20 s trace drain records `unknown`, but the command itself hangs). preset-api.ts:137 uses `AbortSignal.timeout`, which does cover the body.
- Fix direction: use `AbortSignal.timeout`, or clear the timer after the body read.

## POSITIVE
- Price groups follow the consolidation rules (budget-calculator.ts:82-101): A = min(vendor 216, board of 52254); B/C board only; no invented figures. Quick-pick ids 86-125 verified against dyes.json stainIDs.
- `setPreferences` does one read and one write (BUG-029); legacy-key cleanup on reset is correct.
- `fetchWithCache` stale-if-error and the `validateWorld` upstream/unknown split are sound; module caches never store a rejection.
- Rate limiter: alias folding, subcommand scoping and the tier table match worker-kit `selectTier` (every limit maps onto the 5/10/15/20/30/70 tiers).
- `initRenderer` resets a rejected init promise (BUG-013 stays fixed).
- command-trace drain loop, deadline timer cleanup and first-mark-wins are correct.

## REJECTED
- `LOCAL_COMMAND_LIMITS[commandName]` / `COMMAND_ALIASES[...]` prototype-key lookup (rate-limiter.ts:202, 243): commandName comes from signature-verified Discord payloads carrying only registered names; not reachable.
- `count` stored as a string: the option is INTEGER; folded into -05 as latent.
- `pricesAsOf` uses the first map entry (budget-calculator.ts:272): cosmetic, entries are at most 5 minutes apart on the fresh path.
- Lost updates on prefs/favourites KV read-modify-write: documented BUG-036, known decision.
- api-worker service-binding rate bucket starving the bot: a separate 20x `UNIVERSALIS_SERVICE_RATE_LIMITER` exists (api-worker wrangler.toml:80-85, 157-160).
- Resvg instances never `.free()`d (renderer.ts:369): wasm-bindgen finalizers cover it; no evidence of growth.
- Double moderation post lead: handlers and presets-api, outside this slice.

## COVERED
21 files read: analytics.ts, announcements.ts, bot-i18n.ts, budget/{budget-calculator,index,price-cache,quick-picks,universalis-client}.ts, changelog-parser.ts, command-trace.ts, emoji.ts, font-coverage.ts (lines 1-220, the whole file), fonts.ts, i18n.ts, image-client.ts, image-input-errors.ts, preferences.ts, preset-api.ts, preset-favorites.ts, rate-limiter.ts, svg/renderer.ts. Tests were grepped and sampled (preferences.exhaustive, command-trace, preset-api), not read in full.
