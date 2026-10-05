# REFACTOR-001: Review custom_id grammar and status list duplicated across discord-worker, moderation-worker and presets-api with no parity check
**Priority:** LOW · **Effort:** MEDIUM · **Risk:** LOW · **Deploy unit:** apps/discord-worker · **Origin:** PR-#227 + PR-#225 + PR-#224 · **Other units:** apps/moderation-worker, apps/presets-api

## Location
- `apps/discord-worker/src/handlers/commands/preset-notifications.ts:78`

## Evidence
- Reproduction: Add a status to one list only -> discord-worker emits an id moderation-worker's parser rejects (or the reverse), with no failing test.
- The status set and id grammar are hand-copied: dw preset-notifications.ts:78-90 ('Keep in step'), dw test BOUND_ID_RE, mw review-custom-id.ts:76, mw preset-api.ts:48, presets-api moderation.ts:80. Nothing cross-checks them; each app tests only its own copy.
  - Checked: git grep REVIEW_STATUSES/STATUSES/REVIEWED_STATUSES; none exist at 8ecb878f; preset-notifications.test.ts:12-15 hardcodes its own regex copy.
- Origin: review-custom-id.ts not in 8ecb878f; REVIEW_STATUSES count 0 at 8ecb878f in dw preset-notifications.ts and mw preset-api.ts; REVIEWED_STATUSES absent from presets-api moderation.ts at 8ecb878f.

## Fix
- Export a builder/parser + status const from @xivdyetools/bot-logic (or a PresetStatus const array from @xivdyetools/types) -> needs a bot-logic/types publish, then consumer deploys; or a cheaper repo-level parity test reading the three files.

## Status
OPEN
