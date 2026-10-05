# Review: gap-7 - consolidation hygiene (discord-core rebuild, oauth exact anchors, overlapping fixes)

Anchors re-read at preview-2026-10-04 @80262a2f. Several line numbers in the source reviews had drifted; the pinned ones below are authoritative.

## 1. Map
| Source row(s) | Gap-7 id | Pinned anchor |
|---|---|---|
| discord-core-01 (+ filed preset.ts:575/576, presets.ts:1077/1089 rows) | gap7-01 | apps/discord-worker/src/index.ts:402 |
| discord-core-03 + discord-services-03/04 | gap7-02 | apps/discord-worker/src/index.ts:1296 (write :1307) |
| discord-core-04 | gap7-03 | apps/discord-worker/src/index.ts:1076 |
| discord-core-05 (+ filed preset-notifications.ts:214 row) | gap7-04 | apps/discord-worker/src/index.ts:407 |
| discord-core-07 | gap7-05 | apps/discord-worker/src/index.ts:1137 |
| oauth-01 | gap7-06 | apps/oauth/src/index.ts:184 (key built services/rate-limit.ts:145) |
| oauth-02 (+ oauth-04 test half) | gap7-07 | apps/oauth/src/handlers/callback.ts:64, xivauth.ts:95 |
| webapp-services-04 + webapp-v4-presets-01/-02 | gap7-08 | apps/web-app/src/components/v4/preset-tool.ts:630 |
| core-chara-01 + webapp-glamour-01 | gap7-09 | packages/core/src/services/chara/chara-parser.ts:498 |

## 2. Candidates

### gap7-01 BUG MEDIUM - apps/discord-worker/src/index.ts:402 (restates discord-core-01)
- Claim: a bot-submitted or bot-edited pending preset is announced twice in the moderation channel (bot-side `notifyModerationChannel` preset.ts:576 / `notifyEditModerationChannel` :924, legacy ids; plus the presets-api webhook posting for every source, handled at index.ts:402-409, revision-bound ids). Approved ones double-write the submission log.
- Failing input: `/preset submit` with flagged text, MODERATION_CHANNEL_ID set -> two embeds for one preset; one carries legacy `preset_approve_<uuid>` ids that only refresh.
- Tests: index.test.ts covers the webhook only, preset.test.ts the handler only. Covered: no. Origin: MAIN.
- Excerpt: `if (preset.status === 'pending' && env.MODERATION_CHANNEL_ID) { ... sendModerationNotification(env, { kind: 'new', ...`
- Fix: one poster. Delete the bot-side moderation and submission-log posts (webhook has revision binding, retry, dead-letter). This single fix closes the already-filed rows at preset.ts:575, preset.ts:576, presets.ts:1077 and presets.ts:1089; they are one defect, not four.

### gap7-02 BUG MEDIUM - apps/discord-worker/src/index.ts:1296 (restates discord-core-03; same family as discord-services-03/04)
- Claim: favourites back-fill turns any failed `getPreset` into a persisted UUID name. `getPreset` returns null only on 404 and rethrows otherwise (preset-api.ts:241-244), but the call site `.catch(() => null)` (index.ts:1293) then writes `resolved[i]?.name ?? missing[i].id` (:1296) and saves (:1307). The `!e.name` filter (:1291) never selects it again.
- Failing input: legacy v1 user types in `/preset favorite remove` while presets-api answers 5xx/429/timeout -> every unresolved entry saved as `{id, name: <uuid>}`; autocomplete then shows UUIDs permanently.
- Tests: no test drives this path (gap7-03). Covered: no. Origin: MAIN.
- Excerpt: `missing[i].name = resolved[i]?.name ?? missing[i].id;` then `await savePresetFavoriteEntries(env.KV, userId, entries, logger);`
- Fix: persist only names from successful lookups; skip the entry (and the write if none resolved) on a thrown error; a 404 may take a placeholder.
- Overlap with discord-services-04 (preset-favorites.ts: `getPresetFavoriteEntries` returns [] at :100 so `addPresetFavorite` overwrites the list): same KV blob and the same lenient-read-then-whole-blob-write family, different call sites, fixes do not conflict. Combined plan: one strict `readPresetFavoriteEntries` in preset-favorites.ts (rethrows; empty only for a missing key) used by add/remove (services-04); the back-fill's lenient read is safe (failure returns [] before the loop) but it should re-read through the strict helper right before writing so a concurrent `favorite add` during the multi-second fan-out is not lost. discord-services-03 (preferences.ts) is a different blob: sibling, same treatment, no shared code.

### gap7-03 UNTESTED LOW - apps/discord-worker/src/index.ts:1076 (restates discord-core-04)
- Behaviour uncaught: the subcommand-group walk (`/preset favorite remove`, index.ts:1126-1129), the back-fill incl. the BUG-028 "KV put rejection must not blank choices" fix (:1299-1310), clan autocomplete, `/preferences world`. No router-level case in index.test.ts.
- Failing state: a regression of the group walk or of BUG-028 passes the suite. Origin: MAIN.
- Fix: four app.fetch autocomplete cases, including `savePresetFavoriteEntries` rejecting and `getPreset` throwing (pins gap7-02).

### gap7-04 BUG LOW - apps/discord-worker/src/index.ts:407 (restates discord-core-05)
- Claim: the webhook hard-codes `kind: 'new'` although presets-api sends the same payload for edits (with `previous_values`). The builder adds Revert only for `kind === 'edit'` (preset-notifications.ts:214-222), so an edit's first moderation post has no diff and no Revert.
- Failing input: web PATCH of a pending/approved preset -> "New preset pending" embed, no Revert; recovery only via the refresh path. Covered: no. Origin: MAIN.
- Fix: when `preset.previous_values` is present build `kind: 'edit'` with the bound ids. Same defect as the already-filed row at preset-notifications.ts:214; merge them. Interaction with gap7-01: if bot-side edit posts are deleted the webhook becomes the only edit poster, which makes this fix mandatory rather than cosmetic; land together.

### gap7-05 REFACTOR LOW - apps/discord-worker/src/index.ts:1137 (restates discord-core-07)
- `presetApi.searchPresetsForAutocomplete(env, query, { status: 'approved' })` omits `logger`; its catch logs only `if (options.logger)` (preset-api.ts:516-523) and returns [], so every presets-api autocomplete outage is invisible while the user-presets path logs. Fix: pass `{ status: 'approved', logger }`. Origin: MAIN.

### gap7-06 BUG MEDIUM - apps/oauth/src/index.ts:184 (restates oauth-01; also services/rate-limit.ts:145)
- Claim: `const path = new URL(c.req.url).pathname;` (:184) stays percent-encoded while Hono routes on the decoded path. The key is `${ip}:${path}` (rate-limit.ts:145) and `getOAuthLimit(path)` (:143) falls to the default tier.
- Failing input: `POST /auth/%63allback` -> routed to the callback but bucketed separately at the 30/min default, bypassing the 10/min login and 20/min exchange limits with unlimited spellings. Verified in the source review with hono 4.13.9.
- Tests: rate-limit.test.ts uses literal paths. Covered: no. Origin: MAIN.
- Fix: use `c.req.path` (decoded, what Hono matched), normalized; add a test posting an encoded spelling past the limit.

### gap7-07 BUG LOW - apps/oauth/src/handlers/callback.ts:64 and apps/oauth/src/handlers/xivauth.ts:95 (restates oauth-02, oauth-04)
- Claim: `const { code, ... } = body;` sits after the parse try/catch (callback.ts:52-62, xivauth.ts:83-93); a JSON body `null` parses fine and the destructure throws -> 500 via onError instead of 400 'Invalid request body'.
- Tests: invalid-body tests send malformed JSON only. Covered: no. Origin: MAIN.
- Fix: after parse, `if (typeof body !== 'object' || body === null) return 400` in both handlers; add the test. Related roster guard (oauth-03): xivauth.ts:305 and :342 dereference `ch.verified` on a possibly-null element, and :343 `?? null` lets an empty `name` through as an empty username (:344); filter the roster to objects and require a non-empty string name.

### gap7-08 BUG MEDIUM - apps/web-app/src/components/v4/preset-tool.ts:630 (merges webapp-services-04, webapp-v4-presets-01, webapp-v4-presets-02; also hybrid-preset-service.ts:315)
- Three triggers, one function. `reconcileTombstones` (:630-645) runs after `loadPresets` (:586-606) and tombstones any non-curated saved id missing from `live` (:633-639).
  1. hybrid-preset-service.ts:315 swallows a failed API leg (`logger.warn`) and loadPresets takes `offline` from the boot-time `isAPIAvailable()` (:600), so one transient 5xx tombstones every saved community preset.
  2. a `local-<id>` palette saved to Saved is never in `live` (isFromAPI false, :633) -> tombstoned "Removed by its author", and also double-listed in the Saved pool.
  3. no supersede guard: the guard reads the current `this.searchQuery` (:631), not the query the response was fetched with (:594), so a stale filtered pool tombstones everything not matching it.
- Origin: MAIN. Covered: no (preset-tool.test.ts has no reconcile case).
- Single fix, ship together: (a) `getPresets` reports API-leg outcome (`{presets, apiOk}` or a `lastFetchOk`); the only app consumer is preset-tool.ts:593 (plus internal hybrid :394/:405), so the shape change is local; (b) `loadPresets` takes a seq and the query at call time, drops stale responses, and gates `offline` and `isLoading` on the seq; (c) `reconcileTombstones(fetchedQuery, apiOk)` returns early unless `apiOk` and the fetched query is empty, and `continue`s on ids starting `local-`; (d) dedupe the Saved pool against `localPalettePool` or hide Save on local cards. No conflicts between the proposed fixes; (a) is inert without (c).

### gap7-09 BUG LOW/MEDIUM - packages/core/src/services/chara/chara-parser.ts:498 (merges core-chara-01 and webapp-glamour-01; client call site apps/web-app/src/services/chara-resolve-service.ts:127)
- Claim: `readModelLane` (:498-501) and `readGlassesId` (:508) accept any positive finite number; one lane above 65535 makes api-worker reject the whole batch and the Reader reports an outage (webapp-glamour-01); `gearModelKey(65536,0)` also collides with `gearModelKey(0,1)` and `1e300` stringifies to a non-decimal key (core-chara-01).
- Failing input: `.chara` with `Body.ModelBase: 70000` or `Glasses.GlassesId: 99999`. Covered: no. Origin: MAIN.
- Single fix at the source: treat any lane or glasses id > 0xffff as empty (0/null) in the core parser. This fixes the key collision and the client outage, and covers other parser consumers. A second clamp in chara-resolve-service.ts:127 is redundant, not conflicting. Companion webapp-glamour-02 (stainId not integer/range checked) is in the same parser; fold it into the same change.

## 3. POSITIVE
- `getPreset` distinguishes 404 from other failures (preset-api.ts:241-244); the defect is the call-site `.catch`.
- BUG-020's 50-row full-page guard (preset-tool.ts:604-611) is correct and is kept by the merged fix.
- oauth state HMAC, PKCE binding and redirect allowlist (review-oauth.md) were not disturbed by the anchor pass.

## 4. REJECTED
- Folding discord-services-03 into gap7-02: different KV key and file, only the pattern is shared.
- A second clamp in chara-resolve-service: redundant once the parser clamps.

## 5. COVERED
17 files: review-discord-core.md, review-oauth.md, review-discord-services.md, review-webapp-glamour.md, review-core-chara.md, review-webapp-services.md, review-webapp-v4-presets.md; source: discord-worker index.ts, preset-api.ts, preset-favorites.ts, preset-notifications.ts; oauth index.ts, callback.ts, xivauth.ts, rate-limit.ts; web-app preset-tool.ts, hybrid-preset-service.ts, chara-resolve-service.ts; core chara-parser.ts.
