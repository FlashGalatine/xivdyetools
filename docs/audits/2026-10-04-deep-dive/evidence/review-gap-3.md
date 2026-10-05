# review-gap-3: duplicate moderation post + webhook edits rendered as kind 'new'

## Map
| Piece | Location | Fact |
|---|---|---|
| presets-api edit webhook | apps/presets-api/src/handlers/presets.ts:845-878 | payload `...rowToPreset(editedRow)` -> includes `previous_values` (preset-service.ts:66-76 parses it); no strip |
| presets-api submit webhook | presets.ts:1067-1092 | same spread (previous_values null on a new row) |
| transport | notification-service.ts:~190-205 | `JSON.stringify(payload)` unmodified, so previous_values is sent |
| discord-worker receiver | apps/discord-worker/src/index.ts:402-409 | `kind: 'new'` hardcoded; never reads previous_values (git grep: zero hits in discord-worker src) |
| type | apps/discord-worker/src/types/preset.ts (PresetSubmissionNotification) | `preset` declares no `previous_values`; payload is a bare `JSON.parse as` cast, so the field arrives untyped |
| builder | preset-notifications.ts:~120-224 | `kind==='edit'` adds diff (needs `original`) + Revert button; `kind:'new'` never does |
| bot-side edit post | commands/preset.ts:924, :1156-1172 | `kind:'edit'`, `original`, NO contentRevision -> legacy ids + Revert button |
| moderation refresh | apps/moderation-worker/src/handlers/review-message.ts:146-149 | Revert only when `previous_values` set (GET /moderation/:id returns it, moderation.ts:552) |

## Candidates

### gap3-01 (BUG, MEDIUM) preset-notifications.ts:214 / index.ts:402 (merged finding)
Claim: one coupled defect, one grade. Webhook posts every edit as kind 'new' (title "New Preset Pending", no diff, no Revert) although presets-api already ships previous_values; the only post that offers Revert is the bot-side legacy post, which is the duplicate.
Facts confirmed:
- notifyDiscordBot posts previous_values unstripped (presets.ts:858 spread; notification-service.ts body is the whole payload).
- discord-worker's type does not declare it and no code reads it (index.ts:402-409 sets kind 'new').
- Current state for a bot edit that lands pending: TWO posts. Webhook post = kind new, bound ids, Approve/Reject only. Bot post = kind edit, diff, legacy ids incl. Revert. A legacy click never acts, it refreshes to bound buttons (moderation-worker refreshReview; actionsFor adds Revert when previous_values).
- For a WEB-source edit only the webhook post exists, so there is no Revert and no diff at all (bot-side post is bot-only).
- Revert is only ever actionable when previous_values exists, i.e. only when an edit was flagged (presets.ts:713-722); a clean resubmission has none and correctly gets no Revert.
Failure: moderator sees a flagged edit as "New Preset Pending" with Approve/Reject only; the Revert target exists in the payload but is dropped. Delete the bot-side post (discord-core-01's fix) with no other change and the bound webhook message is the sole post: Revert is then reachable only after a stale/409 refresh, so the moderator cannot restore the clean snapshot from the channel.
Grade, conditioned on fix:
- Fix A (delete the bot-side post only): MEDIUM, and it promotes discord-handlers-02 / discord-core-05 to MEDIUM (they are LOW only while the legacy post survives).
- Fix B (keep webhook post, map previous_values -> kind 'edit' with bound ids and build `original` from previous_values, then delete the bot post): the whole cluster closes; severity of the residual drops to LOW (diff is vs the oldest clean snapshot, not the previous revision).
- Neither: the duplicate stays MEDIUM (operational noise, two embeds, one dead-ish).
Tests: none. preset-notifications.test.ts:64 covers the builder's 'edit' kind only; no test feeds a webhook payload with previous_values. Covered by test: no.
Origin: MAIN. Excerpt:
```
index.ts:402  kind: 'new', preset, contentRevision: preset.content_revision, extraFields: [...]
review-message.ts:148  return preset.previous_values ? ['approve','reject','revert'] : ['approve','reject'];
```
Fix direction (B): add `previous_values?: {name,description,tags,dyes}|null` to the discord-worker preset type; in index.ts use `kind: preset.previous_values ? 'edit' : 'new'`, `original: preset.previous_values && {id, ...previous_values}`; keep contentRevision; then remove notifyModerationChannel/notifyEditModerationChannel callers in preset.ts. Add a webhook test with previous_values. Note the Revert button then carries a bound id so a direct click works. Also decide the title for an edit with previous_values null (resubmission).

## Corrections to slice claims
- discord-handlers-02 "presets-api must start sending previous_values": wrong, it already does (presets.ts:858, rowToPreset). Only discord-worker must read it.
- discord-core-05 "refresh re-adds Revert": true only via the legacy bot post; LOW while that post exists, MEDIUM after Fix A alone.
- Double-post five filings (handlers-01, core-01, presets-handlers-01, presets-core-01, contract-revision-binding-01): same defect, merge into gap3-01.

## POSITIVE
- Bound ids and the legacy-click-refreshes-never-acts rule are sound.
- previous_values is write-once and revert is revision-bound server side.

## REJECTED
- 10240-byte webhook cap with previous_values doubling text: name/description are length-capped, payload stays far under (not verified exactly; no concrete failing input).
- Payload leaking previous_values to non-moderators: it goes only service-binding -> discord-worker, and discord-worker never renders it.

## COVERED (9 files)
presets-api handlers/presets.ts, services/preset-service.ts, services/notification-service.ts, handlers/moderation.ts; discord-worker index.ts, handlers/commands/preset-notifications.ts, handlers/commands/preset.ts, types/preset.ts; moderation-worker handlers/review-message.ts.
