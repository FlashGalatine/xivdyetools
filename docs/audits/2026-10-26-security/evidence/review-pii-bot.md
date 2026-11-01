# review-pii-bot: personal data in discord-worker, moderation-worker and presets-api

Reviewer key: `pii-bot` · 2026-10-26 · HEAD 13c386e5 · read-only. The governing promise is `apps/discord-worker/PRIVACY_POLICY.md`, read in full, plus the data lines of `TERMS_OF_SERVICE.md`.

Method: every bot-unit line in `evidence/pii-sinks.txt`, minus the plain-literal log calls, was opened and read at its file:line. I added `git grep` sweeps for log calls that take objects or interpolate values, for user, guild and channel ids in log contexts, for `console.*`, for KV, D1 and R2 writes, for `writeDataPoint`, and for the outbound bodies (Perspective, the Discord channel posts, image-worker, api-worker `/v1/chara/resolve`, the presets-api dead letters).

## Personal-data sink table

| Unit | Sink | Fields written | Policy row | Verdict |
|---|---|---|---|---|
| discord-worker | AE `writeDataPoint` (`services/analytics.ts:90-108`) | command, userId, `guild`/`dm`, answered, outcome class, subcommand or copy kind, locale bucket, `command`/`button`, latency | §2 Usage Analytics | matches |
| discord-worker | KV `stats:*` counters, `usertrack:{date}:{userId}` (`analytics.ts:190,231`) | counts; user id plus date, 30 d TTL | §2 / §8 | matches |
| discord-worker | KV `prefs:v1:{userId}` (`services/preferences.ts:348,409,673`) | fields in `types/preferences.ts:64-115` | §2 Preferences | matches; reset deletes the key (`preferences.ts:389-391`) |
| discord-worker | KV favorites v1 and v2 (`services/preset-favorites.ts:160-161`) | preset id and name | §2 | matches |
| discord-worker | KV `firstrun:v5:{userId}` (`index.ts:877-881`) | `1`, 180 d TTL | §2 | matches |
| discord-worker | KV `announced:v:<ver>` (`index.ts:782`) | `1` | n/a | no personal data |
| discord-worker | Logs that carry a user id (`index.ts:922,967`) | userId, command | §5 "two of them" | matches (exactly two in this unit) |
| discord-worker | All other log calls (≈70) | ids of presets and keys, counts, statuses, error objects, error names | §5 | no option values, guild or channel ids, or file data |
| discord-worker | `/glamour` → api-worker body (`handlers/commands/glamour.ts:56`) | `{gear:[{slot,base,variant,set?}], glasses?}`, no headers that identify the user | §3 Character Files | matches |
| discord-worker | image-worker body (`services/image-client.ts:48-58`) | `{url, maxDimension?}` | §3 Image Processing | internal only; image-worker does not echo the URL |
| discord-worker | Moderation-channel posts (`index.ts:379-412`, `preset-notifications.ts:180-197`) | preset text, sanitized author name, preset id | §5 Discord row | matches |
| discord-worker | Preview-image decision edit (`handlers/buttons/preview-image.ts:279,296-297`) | **moderator username** | §5 Discord row | **pii-bot-01** |
| moderation-worker | D1 `banned_users`, `moderation_log` (`services/ban-service.ts:365-400,501-511,602-611`) | target id, xivauth id, author name, moderator ids, reason, dates; name and reason blanked on unban | §2 Moderation Records / §8 | matches |
| moderation-worker | Channel posts (`ban-reason.ts:186-205`; `preset-moderation.ts:210-240`; `preset-rejection.ts:147-177,295-322`) | preset name, author name, reason, counts, **moderator username** | §5 Discord row | **pii-bot-01** |
| moderation-worker | Logs (`ban-reason.ts:228`, `commands/preset.ts:686`, `index.ts:247,365`) | target, moderator and invoker ids, counts | — | re-file of the 2026-10-03 rejection "moderation-worker logs user / moderator / target ids"; not re-filed |
| moderation-worker | KV | rate-limit fallback only (`middleware/rate-limit.ts:165-166`) | §2 | matches |
| presets-api | D1 `presets` INSERT (`services/preset-service.ts:392-418`) | text, dyes, tags, author id and name, `example_link`, secondary categories | §2 (bots never send `example_link`; web policy) | matches |
| presets-api | D1 `votes`, `submission_events`, `moderation_log` | user id, preset id, kind, moderator id, reason | §2 / §8 | matches |
| presets-api | D1 `failed_notifications` (`services/notification-service.ts:396-414`) | `toDeadLetterRecord` (type, preset id, status, revision) plus the error message (fixed strings from discord-worker, `index.ts:300-509`) | §8 | matches; deleted together with the preset (`handlers/presets.ts:456-468`) |
| presets-api | R2 `THUMBNAILS.put` (`services/preview-image-service.ts:155-166`) | WebP under a `presetId/uuid` key; no customMetadata | web policy | bots cannot upload |
| presets-api | Perspective body (`services/moderation-service.ts:252-268`) | preset name and description, `doNotStore: true`, key in a header | §6 | matches (positive control) |
| presets-api | Logs (≈35) | ids, counts, error objects, path without query string (`worker-kit logger.ts:83-86`) | — | no personal data |

### Authorization matrix (personal-data routes only)

| Route | Unauth | User JWT or bot | Owner | Moderator | Personal fields returned |
|---|---|---|---|---|---|
| presets-api `GET /presets`, `/:id`, `/featured` | approved only | approved, plus own non-approved | own | all | `author_discord_id` is stripped unless the caller is the owner, a moderator or a bot (`preset-service.ts:169-193`) |
| presets-api `GET /presets/mine` | 401 | own | — | — | own rows |
| presets-api `/moderation/*` | 401 | 403 | — | yes | moderator ids in `/history` |
| presets-api `POST/DELETE /votes/:id` | 401 | own vote | — | — | none |
| discord-worker `POST /` | Ed25519 | — | — | `MODERATOR_IDS` for preview-image buttons | — |
| discord-worker `POST /webhooks/preset-submission` | bearer + `timingSafeEqual` | — | — | — | — |
| moderation-worker `POST /` | Ed25519 + `MODERATOR_IDS` | — | — | yes | ban pickers show ids, ephemeral only |

## Candidates

- **pii-bot-01** (MEDIUM, INTERNET-AUTH): the moderator's Discord username is written into persistent posts in the moderation and submission-log channels. These are "Approved/Rejected/Reverted by {username}", "Banned By", and "Preview image approved/rejected by {moderator}". The §5 Discord row lists everything those posts show and does not name the moderator.
  - Fix: decide whether the name is needed for accountability. `moderation_log` already holds the moderator id. If it is needed, AMEND `apps/discord-worker/PRIVACY_POLICY.md` §5 Discord row and the five translations. If not, drop it from the posts (policy NONE).

## Positive controls

- AE blob layout. The guild id becomes only `guild`/`dm`, the locale is bucketed, the subcommand comes from the option type, and the copy kinds are an enum. No option value, hex, world, file name or error text is written (`analytics.ts:38-108`, `command-trace.ts:184-219,323-348`).
- Rate-limited requests and button clicks go to AE only, never to KV.
- discord-worker writes exactly two log lines with a user id, as §5 says. Budget logs `hasWorld` rather than the world (`budget.ts:365`). Preference errors log keys, types and lengths, never values (`preferences.ts:357-363`). The webhook logs the preset id, not its name (`index.ts:433`).
- `.chara`: the nickname is stripped at projection (`bot-logic swatch.ts:256-266`, `glamour.ts:432`). Failures log only the class and code (`failure-kind.ts:14-18`, `glamour.ts:485`). The handler logs the error enum only (`glamour.ts:176`, `swatch.ts:131`). The resolve body is gear plus glasses, with no headers that identify the user.
- Dead letters are reduced to `toDeadLetterRecord`. An insert failure logs the error name only. Rows are deleted together with the preset and pruned at 30/90 d.
- Perspective: `doNotStore: true`, the key in `x-goog-api-key`, status-only error logs.
- The ban post has no User ID field (`ban-reason.ts:194-197`). Name and reason are blanked on unban. The notification embed names the author by sanitized name, never a `<@id>`.
- Public preset responses strip `author_discord_id` for anonymous callers and non-owners.
- `[observability] enabled = false` is pinned top-level and under production in all three `wrangler.toml` files. `logUserAgent` is never enabled. presets-api logs the path without the query string.
- `/preferences reset` deletes the KV keys rather than writing an empty blob.

## Rejected

- **`Discord follow-up … failed` logs Discord's error `body`** (`discord-api.ts:270,315`; `index.ts:570`; `preset-notifications.ts:300`): Discord 4xx bodies carry error codes and field paths, not the submitted text. Not shown to echo content, so not filed.
- **The preview-image post falls back to `moderatorId`** (`preview-image.ts:279`): the fallback needs an absent username or one that sanitizes to nothing. Discord always sends `user.username`, which is limited to `[a-z0-9._]`, so the fallback is unreachable.
- **presets-api returns `author_discord_id` to bot callers** (`preset-service.ts:173-175`): this goes over the internal service binding only. discord-worker uses it solely for the owner check (`commands/preset.ts:782`) and never renders it.
- **The world name in the Universalis path and the Cache API key** (`universalis-client.ts:217`, `price-cache.ts:121`): a public server name, not tied to a user, and never logged.
- **The Discord CDN URL, which carries the channel id and file name, is sent to image-worker**: internal binding. image-worker errors are fixed strings and its log path has no query; it belongs to the image-worker reviewer.
- **The harmony `unknown colour wheel "<value>"` log** (`bot-logic harmony.ts:189`): discord-worker passes the option through `parseColorWheelId` first (`handlers/commands/harmony.ts:53`), so a raw value cannot reach it from the bot.
- **The moderation-worker logs the ids of non-moderators and ban targets**: a re-file of a 2026-10-03 rejected suspicion.
- **The bot sends `X-User-Discord-Name` on read-only presets-api calls**: an internal header that presets-api never logs or stores outside author-name writes.

## Not covered

- presets-api's web (JWT) path against `apps/web-app/PRIVACY.md`. I read it only where it shares bot code.
- Whether image-worker and api-worker log the inbound URL or body. That belongs to their own reviewers.
- The policy translations (`PRIVACY_POLICY.{ja,de,fr,ko,zh}.md`) for pii-bot-01.

## Files covered

44 files, all opened and read, in these directories:
- `apps/discord-worker/src/` (`index.ts`, `services/{analytics,command-trace,preferences,preset-favorites,preset-api,image-client}.ts`, `services/budget/{universalis-client,budget-calculator}.ts`, `handlers/commands/{glamour,budget,preferences,harmony,preset-notifications}.ts`, `handlers/buttons/{preview-image,copy}.ts`, `utils/{chara-attachment,discord-api}.ts`, `types/preferences.ts`)
- `apps/discord-worker/` (`PRIVACY_POLICY.md`, `TERMS_OF_SERVICE.md`, `wrangler.toml`)
- `apps/moderation-worker/src/` (`index.ts`, `services/{ban-service,preset-api}.ts`, `handlers/modals/ban-reason.ts`, `handlers/commands/preset.ts`, `handlers/buttons/preset-moderation.ts`, `types/modal.ts`), plus its `wrangler.toml`
- `apps/presets-api/src/` (`index.ts`, `services/{notification,moderation,preset,preview-image,rate-limit}-service.ts`, `handlers/presets.ts`, `middleware/{auth,ban-check}.ts`, `retention-job.ts`), plus its `wrangler.toml`
- `packages/worker-kit/src/middleware/logger.ts`
- `packages/bot-logic/src/commands/{glamour,harmony,failure-kind}.ts`
- `apps/api-worker/src/universalis/router.ts` (error bodies)
- `apps/image-worker/src/` (error strings)
