# Review: discord-core (apps/discord-worker router, schemas, types, utils, scripts, wrangler)

Branch preview/integration-2026-10-04 @80262a2f. Read-only review; no tests run.

## 1. Map

| Module | Role |
|---|---|
| `src/index.ts` (1410 l) | Hono app: CORS, request-id, logger, env-validation (fatal 500), security headers; routes `GET /health`, `POST /webhooks/preset-submission` (:258), `POST /webhooks/github` (:519), `POST /` (:732) -> `handleCommand` (:834), `handleAutocomplete` (:1027), `handleComponent` (:1333), `handleModal` (:1378); `onError` (:1400) |
| `/webhooks/preset-submission` | Bearer + timingSafeEqual, 10 KiB capped read, `submission` (pending -> moderation embed via `sendModerationNotification`; approved -> submission log) and `preview_image` (moderation channel, `previewimg_*` ids, 96-97 chars) |
| `/webhooks/github` | HMAC over raw bytes, 1 MiB cap, pinned repo, KV memo `announced:v:<ver>` |
| `src/commands/schemas.ts` | 18 command schemas (PR #227 drops `/stats preferences`) |
| `src/commands/registry.ts`, `localize.ts` | roster of record; description/choice localizations (register script only) |
| `src/types/{env,preset,preferences,github,budget}.ts` | Env, payload types, `isValidPreviewImageKey` (78 chars), clan tables |
| `src/utils/discord-api.ts` | sendFollowUp / editOriginal / sendMessage, 5-10 s timeouts, no-ping allowed_mentions |
| `src/utils/{env-validation,read-text-capped,chara-attachment,github-verify,sanitize,text,brand,response}.ts` | validation (RL_* + 32-char webhook floor in production), capped reads, CDN allowlist, HMAC, sanitizers |
| `scripts/*` | register-commands (PUT bulk), upload-emojis, gen-option-description-keys, check-bundle-size, font tooling |
| `wrangler.toml` | beta top-level block, production env, 6 `[[ratelimits]]` per env, observability off, one route (PR #227) |

## 2. Candidates

### discord-core-01 | BUG | MEDIUM | `apps/discord-worker/src/index.ts:402` (with `handlers/commands/preset.ts:576,924`; `apps/presets-api/src/handlers/presets.ts:1088-1091`)
- Claim: a preset submitted or edited through the bot is announced twice. The `/preset submit|edit` handler posts its own moderation embed, and presets-api also POSTs the webhook for every submission regardless of `auth.authSource` (the payload merely carries `source: 'bot'`), which index.ts:402 turns into a second embed. The approved path double-posts the submission log the same way (`preset.ts:571` `notifySubmissionChannel` plus index.ts:446-504).
- Failing input: `/preset submit` with a flagged text (status pending) and `MODERATION_CHANNEL_ID` set -> two embeds in the moderation channel for one preset. The bot-side one has no revision (legacy `preset_approve_<uuid>` ids, which moderation-worker answers with a refresh), the webhook one has revision-bound ids. An auto-approved bot submission writes two "new preset" entries to the submission log.
- Why tests miss it: index.test.ts exercises the webhook alone and preset.test.ts exercises the handler alone, so nothing crosses the two. Covered by a test: no, and the handler tests assert the bot-side post, which cements it.
- Origin: MAIN (confirms the lead). PR #227 makes it more visible, because the bot-side copy is now the legacy-id one.
- Excerpt:
  ```
  // preset.ts:574  if (!isApproved && env.MODERATION_CHANNEL_ID) await notifyModerationChannel(env, preset, logger);
  // presets-api presets.ts:1091  waitUntil(notifyDiscordBot(c.env, submissionPayload, ...))   // no source filter
  // index.ts:402   if (preset.status === 'pending' && env.MODERATION_CHANNEL_ID) { sendModerationNotification(...kind:'new'...) }
  ```
- Fix direction: keep exactly one poster. Preferably delete `notifyModerationChannel` / `notifyEditModerationChannel` / `notifySubmissionChannel` from preset.ts, since the webhook path carries the revision and is retried and dead-lettered by presets-api. The alternative is to skip `source === 'bot'` in the webhook, but that loses the revision binding and the retry machinery.

### discord-core-02 | BUG | LOW | `apps/discord-worker/src/index.ts:907-911` and `:810-816`
- Claim: the first-run notice posts a follow-up on `interaction.token` from a `waitUntil` that starts before the handler has returned its initial callback. The KV flag is written before the send.
- Failing state: a new user's first command. `maybeSendFirstRunNotice` does `KV.get`, `KV.put`, `KV.get` and then `sendFollowUp`, while the handler's callback is still in flight. Discord rejects a follow-up on an unacknowledged token (404/400), which is logged as a warn only. If it wins the race against a deferred ack, Discord attaches the first follow-up to the "thinking" slot, so the ephemeral notice can become the response message and the later `editOriginalResponse` edits that ephemeral message, turning a public card private.
- Outcome: the 5.0 notice is lost permanently (the flag is already set for 180 days) or the response visibility flips. Which of the two depends on timing, so confidence is moderate.
- Why tests miss it: the only test (index.test.ts:1839) asserts the KV put TTL, never the ordering relative to the response or the follow-up's outcome. Covered: no.
- Origin: MAIN.
- Fix direction: send the notice only after the handler's response has been returned, for example chain it on the trace drain / `finishCommandTrace`, or write the flag only when `response.ok`.

### discord-core-03 | BUG | MEDIUM | `apps/discord-worker/src/index.ts:1290-1307`
- Claim: the favourites name back-fill turns any failed preset lookup into a permanent UUID display name. `getPreset` returns null only on 404 and throws for 5xx, timeout and 429, but the call site does `.catch(() => null)` and then `name = resolved[i]?.name ?? missing[i].id`, which is persisted. The `!e.name` filter never selects that entry again.
- Failing input: a legacy v1 favourites user types in `/preset favorite remove` while presets-api times out or answers 5xx -> every unresolved entry is saved as `{ id, name: <uuid> }`. From then on the autocomplete shows UUIDs and the text filter cannot match them. Nothing ever refreshes the entry.
- Secondary: names are denormalised at add time and never refreshed on a rename. The back-fill also writes the whole list after a multi-second fan-out, so a concurrent `favorite add` can be lost (KV read-modify-write).
- Why tests miss it: no test drives this router path (see 04). Covered: no.
- Origin: MAIN (OPT-007 follow-up code).
- Excerpt:
  ```
  const resolved = await Promise.all(missing.map((e) => presetApi.getPreset(env, e.id).catch(() => null)));
  missing[i].name = resolved[i]?.name ?? missing[i].id;
  await savePresetFavoriteEntries(env.KV, userId, entries, logger);
  ```
- Fix direction: persist only names from successful lookups. A 404 may fall back to a placeholder; a thrown error must leave `name` empty and skip the write for that entry.

### discord-core-04 | UNTESTED | LOW | `apps/discord-worker/src/index.ts:1076-1148`
- Behaviour that should be caught: the subcommand-group walk (`/preset favorite remove`), the favourites back-fill including the BUG-028 "KV put rejection must not blank the choices" fix, `getClanAutocompleteChoices`, and the `/preferences world` branch. None of them is exercised through `app.fetch`: index.test.ts has no `clan`, `favorite` or `getWorldAutocomplete` case, and `github-body-limit.test.ts:84` only mocks `preset-favorites`.
- Failing state: a refactor of the group walk (the `break outer` logic), or a regression of BUG-028, would pass the suite.
- Origin: MAIN.
- Fix direction: add four router-level autocomplete cases, including one where `savePresetFavoriteEntries` rejects and one where `getPreset` throws (which would also pin 03).

### discord-core-05 | BUG | LOW | `apps/discord-worker/src/index.ts:404-409`
- Claim: the webhook always renders `kind: 'new'`, though presets-api also sends this payload type for edits (`presets.ts:857-863`, with `previous_values` on the preset). Moderators get a "New preset pending" embed with no diff and no Revert button for web edits. The bot-side edit post has Revert, but only on legacy ids (refresh-only).
- Outcome: Revert is not offered on the first post of an edit. Recovery is through the refresh message, because moderation-worker's `review-message.ts:148` re-adds Revert when `previous_values` is set. Hence LOW.
- Covered by a test: no. Origin: MAIN, made more visible by PR #227.
- Fix direction: when `preset.previous_values` is present, build `kind: 'edit'` with the bound ids.

### discord-core-06 | BUG | LOW | `apps/discord-worker/scripts/upload-emojis.ts:214-251`
- Claim: with an artwork change (`artworkChanged`), emojis are deleted one by one but the mapping file is written only at the very end. A failure part-way (429 loop, network, 5xx) leaves `emoji-mapping.json` pointing at deleted emoji ids.
- Failing state: re-upload run for the production app dies at dye 60 -> the committed mapping still holds old ids, now deleted, and cards/embeds show literal `:name:` text. The next run recovers, since the slot is still on the old artwork tag.
- Origin: MAIN. Operational, manual script, documented as deferred for production. Covered: no.
- Fix direction: write the mapping incrementally, or upload before deleting (names are unique, so use a temporary name).

### discord-core-07 | REFACTOR | LOW | `apps/discord-worker/src/index.ts:1137`
- `presetApi.searchPresetsForAutocomplete(env, query, { status: 'approved' })` omits `logger`, so its internal `catch` returns `[]` with no log line. Every presets-api autocomplete failure is invisible, while the user-presets path logs. Pass `logger`. Origin: MAIN.

## 3. POSITIVE (do not re-file)
- Webhook auth ordering: secret configured -> production 32-char floor (503) -> `timingSafeEqual` -> capped stream read -> parse (index.ts:262-314). Both webhook byte caps are stream-counted.
- GitHub route: HMAC runs over raw bytes before decoding, the repo is pinned and compared only, a ping answers before the body is parsed, the memo is written after a successful send and a KV write failure is swallowed deliberately (:670-717).
- Env validation runs on every request and the production-only error prefix is shared between producer and consumer (env-validation.ts:24, index.ts:213-222). The short webhook secret is intentionally non-fatal.
- `previewimg_*` custom ids are provably within 100 chars (key is exactly 78, `isValidPreviewImageKey`); autocomplete choices are capped at 25, names at 100, values are stainIDs/UUIDs.
- chara-attachment: https + Discord CDN allowlist, `redirect: 'manual'`, 10 s timeout, streamed byte cap (does not trust `size`).
- Every outbound Discord payload carries `allowed_mentions: { parse: [] }` and timeouts (discord-api.ts); `safe*` helpers are throw-safe.
- Dye names in webhook embeds go through stainID first, itemID second, and the English default needs no singleton state (`bot-logic localization.ts:83`).
- Schemas: harmony/wheel choices are derived from core with exhaustive `Record` typing; localize.ts only attaches resolved, <=100-char localizations and the 8,000-char cap is tested.

## 4. REJECTED
- Webhook `timestamp: preset.created_at` space-vs-ISO risk: presets-api writes `new Date().toISOString()` (preset-service.ts:389), so it is valid.
- GitHub memo TOCTOU / KV eventual consistency: one delivery per push, a redelivery is manual and minutes later; the double post needs two simultaneous deliveries.
- Tags field overflow in webhook embed: 10 tags x 30 chars, sanitised, stays under 1024.
- `cutOnLineBoundary` with `tail.length > budget` returns more than `budget`: callers pass constants far smaller than the budget; latent only.
- Early env-validation 500 skips the security-headers middleware: JSON error body, cosmetic.
- `editOriginalResponse` cannot clear `content` with an empty string: no caller needs it (grep).
- Autocomplete `focusedOption.value as string` for numeric options: no autocomplete-enabled integer option exists.
- Preview-image branch posting with the main bot token while submissions use `MODERATION_BOT_TOKEN`: deliberate and documented (index.ts:340-343).
- `contentLength` NaN in the GitHub route: `NaN > max` is false and the stream cap still applies.

## 5. COVERED (30 files read; tests skimmed: index.test.ts outline, schemas/localize/registry test outlines)
apps/discord-worker/: CLAUDE.md, package.json, wrangler.toml, scripts/{check-bundle-size.mjs,gen-option-description-keys.ts,register-commands.ts,upload-emojis.ts} (font .py/.ttf files not read), src/index.ts, src/commands/{localize,registry,schemas}.ts (schemas read through the preset/budget sections plus option scans), src/test-utils.ts, src/test-utils.integration.ts, src/types/{budget,env,github,preferences,preset}.ts, src/utils/{brand,chara-attachment,discord-api,env-validation,github-verify,read-text-capped,response,sanitize,text}.ts. Also read for confirmation: src/handlers/commands/{preset.ts,preset-notifications.ts} (excerpts), src/services/{preset-api.ts,i18n.ts}, packages/bot-logic/src/localization.ts, apps/presets-api/src/{handlers/presets.ts,services/preset-service.ts,services/notification-service.ts}.
