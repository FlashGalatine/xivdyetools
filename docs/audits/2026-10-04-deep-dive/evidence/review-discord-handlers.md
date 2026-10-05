# Review: discord-handlers (apps/discord-worker/src/handlers/**)

Branch preview/integration-2026-10-04 @80262a2f. Reviewer: worker. Read-only except this file.

## 1. Map

| Module | Role | Notes |
|---|---|---|
| commands/index.ts | barrel | |
| commands/glamour.ts (190) | `/glamour` adapter: `.chara` attachment -> bot-logic `executeGlamour`; resolve via UNIVERSALIS_PROXY `POST /v1/chara/resolve` | public deferred reply; no character name anywhere (gear models only sent to api-worker) |
| commands/swatch.ts (160) | `/swatch` adapter | same attachment guards |
| commands/preset.ts (1419) | `/preset list/show/random/submit/vote/edit/favorite *` | submit/edit also post their own moderation/submission-log embeds (see -01) |
| commands/preset-notifications.ts (266) | shared moderation embed builder + `reviewCustomId` (revision-bound ids) | PR-#227 |
| commands/budget.ts (585) | `/budget find/set_world/quick` + autocomplete | world validated before defer |
| commands/extractor.ts (631) | `/extractor color/image` | image path via IMAGE_WORKER |
| commands/stats.ts (457) | `/stats summary/overview/commands/health` | PR-#227 (trimmed) |
| commands/manual.ts (473), about.ts (157), changelog.ts (117) | static / roster embeds | embed limits are tested per locale |
| commands/dye.ts (468), harmony.ts, comparison.ts, contrast.ts, accessibility.ts, gradient.ts, mixer-v4.ts | thin adapters over bot-logic `execute*` | defer + resvg PNG |
| commands/preferences.ts (802) | `/preferences show/set/reset/filters *` | |
| buttons/index.ts, copy.ts | copy_hex/rgb/hsv dispatch | custom_ids are server-minted |
| buttons/preview-image.ts (354) | `previewimg_approve/reject_<key>` moderation buttons (posted by this app) | |

## 2. Candidates

### discord-handlers-01 — BUG — MEDIUM
- **file:line:** apps/discord-worker/src/handlers/commands/preset.ts:570-572, 575-577, 923-925 (plus apps/discord-worker/src/index.ts:402-437, 446-496 and apps/presets-api/src/handlers/presets.ts:~869, ~1091)
- **claim (lead CONFIRMED):** every preset submitted or edited through `/preset` is announced twice. `processSubmitCommand` and `processEditCommand` call `notifyModerationChannel`/`notifyEditModerationChannel`/`notifySubmissionChannel` themselves, and presets-api's `notifyDiscordBot` (all paths, `source: auth.authSource` = 'bot' included, no skip) POSTs the same preset to `/webhooks/preset-submission`, which posts a second embed via `sendModerationNotification` (index.ts:404) or the submission log (index.ts:446).
- **failing input -> outcome:** a user runs `/preset submit` and the preset is pending. The moderation channel gets embed A (legacy ids, no revision, `contentRevision` never passed, preset.ts:1142-1150) and embed B (revision-bound ids). A's Approve/Reject only "refresh" (moderation-worker `handlers/buttons/preset-moderation.ts:121` "A legacy click never acts"), so a moderator can click a dead-looking button on one of two identical posts. An auto-approved preset also lands twice in `SUBMISSION_LOG_CHANNEL_ID` (`notifySubmissionChannel` vs the "newPresetPublished" webhook embed). Edits have the same pair.
- **why tests miss it / covered:** covered by test = yes, but it pins the duplicate (preset.test.ts:1469 "notifies moderation channel when pending..."). No test spans discord-worker + presets-api.
- **origin:** MAIN (already true at 8ecb878f; PR-#227's id binding makes the legacy twin visibly useless).
- **excerpt:**
```ts
// preset.ts:575
if (!isApproved && env.MODERATION_CHANNEL_ID) {
  await notifyModerationChannel(env, preset, logger);   // legacy ids, no revision
}
// presets-api presets.ts ~1091: notifyDiscordBot(...)  -> index.ts:404 sendModerationNotification (bound ids)
```
- **fix direction:** delete the three bot-side `notify*` calls (and the helpers in preset.ts:1067-1173) and rely on presets-api's webhook, the single source with `content_revision`. Update preset.test.ts to assert no direct post.

### discord-handlers-02 — BUG — MEDIUM
- **file:line:** preset-notifications.ts:214-224 with index.ts:404-408
- **claim:** the Revert button is emitted only for `kind: 'edit'`, but the webhook path (the only path that carries a revision) always passes `kind: 'new'`; the payload has no edit marker.
- **failing input -> outcome:** a web-app edit of an approved preset (text flagged, now pending) is announced as "New Preset Pending" with no diff and only Approve/Reject. Revert (bound id `preset_revert_<uuid>:<rev>:<status>`, which moderation-worker parses) is never offered. The bot-path edit embed does carry Revert (and the diff), but with legacy ids that only refresh. Net: no actionable Revert button exists in the moderation channel.
- **why tests miss it / covered:** preset-notifications.test.ts:61 only builds `kind:'edit'` directly; nothing drives the webhook with an edit. Covered: no.
- **origin:** MAIN (the edit-kind gap); the bound-id emission is PR-#227.
- **excerpt:**
```ts
...(opts.kind === 'edit' ? [{ /* revert */ custom_id: reviewCustomId('revert', ...) }] : []),
// index.ts:404: sendModerationNotification(env, { kind: 'new', preset, contentRevision, ... })
```
- **fix direction:** have presets-api send `edit: true` (and the pre-edit snapshot it already stores as `previous_values`) in the payload; the webhook maps it to `kind: 'edit'`. Combine with -01 so the one remaining post is the bound edit embed.

### discord-handlers-03 — BUG — MEDIUM
- **file:line:** budget.ts:215 and :504 (`resolveWorld`), preferences.ts:342, universalis-client.ts:319-326 and :79 (`REQUEST_TIMEOUT = 10000`)
- **claim:** `/budget find`, `/budget quick` and `/preferences set world:` await `validateWorld()` BEFORE returning the deferred ack. On a cold isolate (module-scope 1 h cache) that is one service-binding fetch for worlds and, for a data-centre input, a second sequential one, each with a 10 s timeout. Discord's ack window is 3 s. The same defect was fixed for `/manual spectrum_prices` (BUG-008/BUG-034, manual.ts:386-414).
- **failing input -> outcome:** api-worker slow or Universalis degraded: `/budget find target_dye:... world:Balmung` hangs past 3 s and the user sees "The application did not respond". The carefully designed `reason: 'upstream'` answers (budget.ts:222-228, BUG-031) are only reachable when the proxy fails fast, never when it is slow. After a successful cold fill the next command is fine.
- **why tests miss it / covered:** the mocks resolve instantly. Covered: no.
- **origin:** MAIN.
- **excerpt:**
```ts
const world = await resolveWorld(env, worldOverride, prefs, logger);   // budget.ts:215, pre-defer
...
const deferResponse = deferredResponse();                              // budget.ts:236
```
- **fix direction:** defer first (ephemeral for set_world), validate inside `ctx.waitUntil`, or race `validateWorld` against ~2 s and fall back to the stored canonical world / a deferred path.

### discord-handlers-04 — BUG — LOW
- **file:line:** buttons/preview-image.ts:261 and :275-285
- **claim:** `displayName = <@id>` is interpolated into an embed FOOTER (`previewImage.approvedFooter` = "Preview image approved by {moderator}", locales en.json:465). Embed footers do not resolve mentions, so the moderator sees a raw `<@123456789012345678>`. The same edit also replaces the original footer `ID: <presetId>`, losing the id from the resolved message.
- **failing input -> outcome:** moderator clicks Approve; the message footer reads "Preview image approved by <@id>".
- **why tests miss it / covered:** the test asserts the API call only (preview-image.test.ts:133-175). Covered: no.
- **origin:** MAIN.
- **fix direction:** put the moderator in the description or a field (mentions resolve there; `allowed_mentions.parse=[]` keeps it silent) and keep `ID:` in the footer.

### discord-handlers-05 — BUG — LOW
- **file:line:** stats.ts:235-236 (analytics.ts:131, 189)
- **claim:** "Avg Cmds/User" divides `stats.totalCommands` (a counter whose 30-day TTL is refreshed on every write, so effectively lifetime) by `uniqueUsersToday`. The footer says "30-day retention".
- **failing input -> outcome:** 200,000 lifetime commands / 150 users today = 1,333 "per user". Admin-only dashboard, so LOW.
- **origin:** MAIN. Covered: no (stats.test.ts asserts formatting only).
- **fix direction:** drop the metric or compute per-day counts.

### discord-handlers-06 — OPT — LOW
- **file:line:** stats.ts:174 -> analytics.ts:316-324
- **claim:** the public `/stats summary` calls `getStats()`, which pages through every `user:<date>:` KV key (one list per 1000 DAU) to produce `uniqueUsersToday`, and the summary never reads it (only `totalCommands`, `successRate`).
- **impact:** any user can trigger N sequential KV list ops before the 3 s ack at high DAU. Origin: MAIN.
- **fix direction:** split the unique-user count into its own function used only by `overview`.

### discord-handlers-07 — OPT — LOW
- **file:line:** preset.ts:1380-1382
- **claim:** `/preset favorite list` issues one `presetApi.getPreset` service-binding call per favourite (up to `MAX_PRESET_FAVORITES` = 50, preset-favorites.ts:34) via `Promise.all`, each a D1 read in presets-api, before the 3 s-deferred edit.
- **fix direction:** batch endpoint (`GET /presets?ids=`) or cap at the first page. Origin: MAIN.

### discord-handlers-08 — BUG — LOW (latent)
- **file:line:** preset.ts:452-454 and :820-821; accessibility.ts:64 (vs :119), contrast.ts:56 (vs :89), comparison.ts:48-52 (vs :84), harmony.ts:60 (vs :124), gradient.ts:55,68 (vs :128), mixer-v4.ts:35-45 (vs :72), budget.ts:202
- **claim:** typed dye names are resolved with `searchDyesByName/resolveColorInput(..., locale)` in the synchronous handler, before `initializeLocale(locale)` runs (it runs later in the `process*` function, or never for `/preset`). `getLocalizedDyeName` returns the English name when the locale instance is not loaded (bot-logic localization.ts:83-92), so a localized name only matches if an earlier request in the SAME isolate loaded that locale.
- **failing input -> outcome:** a `ja` user types "スノウホワイト" (instead of picking the autocomplete value, which is a bare stainID) on a cold isolate: "invalid color" / `preset.invalidDye`. `dye.ts` and `extractor color` call `initializeLocale` first, so behaviour is inconsistent across commands.
- **why tests miss it:** tests run in one process with locales already loaded. Covered: no.
- **origin:** MAIN.
- **fix direction:** `await initializeLocale(t.getLocale())` right after the translator is built (a cached, cheap call), as dye.ts:61 does.

### discord-handlers-09 — BUG — LOW (i18n)
- **file:line:** gradient.ts:185-190
- **claim:** the Start/End lines print `startColor.name` (the English `Dye.name` from `resolveColorInput`) while every step row below uses the localized name.
- **failing input -> outcome:** `/gradient` as `ja`/`de` with dye inputs: "Start: **Snow White**" above rows "スノウホワイト". Origin: MAIN. Covered: no.
- **fix direction:** `getLocalizedDyeName(startColor.itemID, startColor.name, locale)`.

### discord-handlers-10 — BUG — LOW
- **file:line:** extractor.ts:385-390 (`renderColorSheet`)
- **claim:** the catch has no logger parameter and answers a render/Discord failure with `errors.noMatchFound`, which is false (matches existed) and the exception is never logged. Outcome is marked `render`, but nothing records why.
- **failing input -> outcome:** resvg throws on a card: the user is told "no match found"; no log line exists. Origin: MAIN. Covered: no (no test makes `renderSvgToPng` reject for the color path; checked extractor.test.ts names only).
- **fix direction:** thread `logger`, log the error, answer `errors.generationFailed`.

## 3. POSITIVE
- `.chara` handling: `/glamour` and `/swatch` send only gear models/glasses id to api-worker (glamour.ts:56), never a name; the parse/resolve error text is run through `sanitizeEmbedText` before a PUBLIC edit (glamour.ts:168, swatch.ts:133); 4xx reason strings are relayed and 429 maps to `rate_limited` (glamour.ts:71-87, 164).
- `reviewCustomId` mirrors moderation-worker's grammar (no leading zeros, status word set, <=100 chars, legacy fallback) (preset-notifications.ts:83-114); author is a sanitized name, never a mention (FINDING-008).
- Typed preset/dye options never reach a URL path: UUID check or search query (preset.ts:953-958); `PresetAPIError` messages go through `getSafeMessageKey`.
- preview-image handler: UUID/key validation before authorization, moderator check before any API call, 409 -> retire buttons, `safeSendFollowUp` everywhere (preview-image.ts:141-148, 313-352).
- `/manual` embed limits (6000 total, 1024 field, 4096 description) are asserted for all 6 locales (manual.test.ts:410-430); `topic in TOPIC_KEYS` is safe only because the option is a Discord choice list.
- `/preferences set` batches writes through one `setPreferences` (BUG-029 stays fixed); `/stats` uses `return await` inside try.

## 4. REJECTED
- `manual.ts:458` `topic in TOPIC_KEYS` prototype lookup ("constructor"): the option is `choices`-restricted in schemas.ts:553-560, so Discord rejects other values.
- `preset.ts:817-841` edit dye position/gap handling: positions beyond the stored length append in order; result is 3-6 dyes and API-validated.
- `preset.ts:953` edit-by-typed-name picks another author's same-named approved preset: ends in `notOwner`, and the autocomplete value is the UUID. Cosmetic.
- `preferences.ts:723,788` unguarded `KV.put` in filters set/reset: a throw reaches the dispatcher's catch (command-trace handler-throw path); not a swallowed error.
- `budget.ts:410-413` logging `error.message` might include a world name (FINDING-011): could not confirm any upstream message echoes the world; not filed.
- `dye.ts:274` fallback "Item ID" prints `dye.id`: equals `itemID` after init (types dye.ts:51-55).
- `copy.ts` custom_id parsing (`Number` on parts): ids are minted by the bot, not user-editable; NaN not reachable.
- `/preset submit` `searchDyesByName(...)[0]` for a typed partial name: no exact-name shadowing exists in the 125-dye DB (checked: no dye name is a substring of an earlier-ordered dye name), and autocomplete sends stainIDs.
- `extractor.ts:449` `Number(colorsOption.value)` NaN: Discord integer option with min/max.
- Uncovered-risk check on coverage baseline: discord-worker 89.3/81.6/89.5/90.2, no handler flagged beyond the items above.

## 5. COVERED (22 files read; tests skimmed: glamour, preset-notifications, preset (notify), manual, preview-image)
apps/discord-worker/src/handlers/buttons/{copy,index,preview-image}.ts;
apps/discord-worker/src/handlers/commands/{about,accessibility,budget,changelog,comparison,contrast,dye,extractor,glamour,gradient,harmony,index,manual,mixer-v4,preferences,preset-notifications,preset,stats,swatch}.ts.
Cross-reads for confirmation: apps/discord-worker/src/index.ts (webhook 270-500, autocomplete 1090-1200), services/preset-api.ts, services/budget/universalis-client.ts, services/analytics.ts (getStats), apps/presets-api/src/handlers/presets.ts (835-885, 1055-1105), apps/presets-api/src/services/notification-service.ts:177-238, apps/moderation-worker/src/handlers/buttons/preset-moderation.ts (legacy ids), packages/bot-logic/src/commands/glamour.ts, input-resolution.ts, localization.ts.
