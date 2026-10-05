# Review: moderation-worker (deep-dive 2026-10-04)

Branch preview/integration-2026-10-04 @80262a2f. Whole worker read; PR-#225 is the only open PR touching it.

## Map
| Module | Role |
|---|---|
| src/index.ts | Hono app, env gate, Ed25519, routing, autocomplete, rate-limit call sites |
| handlers/commands/preset.ts | /preset moderate (pending/approve/reject/stats), ban_user, unban_user |
| handlers/buttons/preset-moderation.ts | approve/reject/revert buttons, revision-bound; legacy ids refresh |
| handlers/modals/preset-rejection.ts | reject/revert reason modals -> presets-api |
| handlers/modals/ban-reason.ts, buttons/ban-confirmation.ts | ban flow |
| handlers/review-message.ts | refreshReview / buildReviewEmbed / buildReviewButtons |
| utils/review-custom-id.ts | strict parser/builder (<=100 chars) |
| services/preset-api.ts | signed service-binding client, 409 -> PresetReviewConflictError |
| services/ban-service.ts | D1 batches: ban/unban + moderation_log + restoreGuard |
| middleware/rate-limit.ts | native RL_* tiers, KV fallback |
| wrangler.toml | dev/prod blocks, observability off, RL namespaces 1031-1034 (unique in repo) |

## Candidates

### moderation-worker-01 BUG LOW - stale "Error" fields survive into the success embed
preset-moderation.ts:210-225 (approve) and preset-rejection.ts:515-531 (reject) build the resolved embed with `...(originalEmbed.fields || [])`.
The failure paths (preset-moderation.ts:252-271, preset-rejection.ts:559-578) append an `Error` field to the SAME message and deliberately keep the buttons live.
Failing state: approve fails once (presets-api 5xx) -> message gains "Error: Failed to approve"; moderator retries and succeeds -> title "Preset Approved" with the old Error field still attached. Repeated failures also grow fields toward Discord's 25 cap (the edit then 400s, silently).
Tests: not covered (success tests start from a clean embed). Origin MAIN (PR-#225 touched the files).
Excerpt: `fields: [...(originalEmbed.fields || []), { name: 'Action', value: ... }]`
Fix: drop any prior field named `Error` before spreading (and replace, not append, on repeat failure).

### moderation-worker-02 BUG LOW - a losing double-click overwrites the resolution embed
review-message.ts:305-318 + preset-moderation.ts:242-246. Two clicks on Approve/Reject (double click, or two moderators) both get DEFERRED_UPDATE. Click 1 commits; click 2 gets STALE_REVIEW (status pending -> approved) and refreshReview re-fetches and edits the message to a fresh "now approved, nothing left to review" embed with `components: []`.
Click 2's edit does one more round trip than click 1's, so it normally lands last: "Approved by X" / the rejection "Reason" field are replaced by a text-only embed. Attribution survives only in moderation_log and the optional submission-log channel.
Tests: preset-rejection-review.test.ts:331 pins the "nothing left" refresh but never asserts the winner's attribution survives. Origin PR-#225.
Fix: when actionsFor(current.preset) is empty, keep the original embed and append a field (or skip the edit when the message already carries a resolution).

### moderation-worker-03 BUG LOW - stale usage footer advertises a removed option
bot-i18n.ts:61 footerTextOnly = "Use /preset moderate approve <id> or reject <id> <reason>", rendered by preset.ts:213-215 on every non-image pending list. FINDING-017 removed the `reason` option (register-commands.ts:72 defines only action + preset_id) and reject now opens a modal.
Failing state: moderator follows the footer and looks for a reason argument that does not exist. preset.test.ts:446 pins the stale string, so the test locks the bug in. CLAUDE.md also says the queue embed has approve/reject buttons; handlePendingAction (preset.ts:217-230) renders none. Origin PR-#225.
Fix: reword to "Use /preset moderate approve <id> or reject <id>" and update the test and CLAUDE.md.

### moderation-worker-04 BUG LOW - refreshed review embed hides the dye list
review-message.ts:221 renders only "**Dyes:** N colors". Refresh-and-reclick replaces the original embed (which listed the dyes) and the moderator is told to "review the refreshed message", yet content_revision also bumps on a dye edit. A moderator re-approving after a refresh cannot see which dyes they approve. Origin PR-#225. Tests: not covered. Fix: list dye names/hex in a bounded field.

### moderation-worker-05 BUG LOW - ban reason not trimmed (rejection path is)
ban-reason.ts:267 `reason.length < 10` vs preset-rejection.ts:485 `reason.trim().length`. A whitespace-only reason passes and is stored in banned_users.reason and moderation_log (the accountability record) and posted. Tests: not covered. Origin MAIN. Fix: trim; share MIN_REJECTION_REASON_LENGTH.

### moderation-worker-06 OPT LOW - two wasted KV reads before every slash command ack
index.ts:250 -> bot-i18n.ts:208 resolveUserLocale(kv, ...) -> bot-logic locale-resolution.ts:148 reads prefs:v1:<id> then the legacy i18n:user: key. The Translator then discards the locale (bot-i18n.ts:150-153, I18N-009) and CLAUDE.md says the KV round-trip was removed. It sits on the pre-defer path of the 3 s ack. Only effect is a log string. Fix: new Translator('en', logger) directly. Origin PR-#225 (I18N-009).

### moderation-worker-07 REFACTOR LOW - four divergent hand-written interaction types
DiscordInteraction exists in index.ts:604 and types/env.ts (different shapes), plus ButtonInteraction x3 (buttons/index.ts, preset-moderation.ts, ban-confirmation.ts) and ModalInteraction. Only some declare message.flags, which editReviewMessage (review-message.ts:193) relies on to choose the ephemeral webhook path; index.ts's copy has no flags on message, so tsc cannot catch a regression. Fix: one shared type in types/.

## POSITIVE
- review-custom-id.ts: longest-prefix-first, strict uuid/integer/status, <=100 chars (max built id about 82); every legacy or 409 path refreshes and never acts (preset-moderation.ts:157,338,359; modals 478,597).
- Ban/unban are a single db.batch with log rows; unban log is gated on changes()>0; restoreGuard shared by UPDATE and log; real-SQLite test.
- presets-api contract matches (GET /moderation/:id shape, 409 codes, expected_revision/expected_status; moderation.ts:85-130,540-562).
- Moderator auth on every button/modal/command/autocomplete; channel gate on slash commands; native RL tiers required in prod; observability off and pinned in both wrangler blocks.
- All outbound Discord/presets-api calls carry timeouts and are throw-safe.
- XIVAuth UUID targets handled in both id columns and every read.

## REJECTED
- Cross-app button routing: discord-worker posts with MODERATION_BOT_TOKEN (preset-notifications.ts:72), so safeEditMessage with this worker's token edits its own messages; ephemeral path uses the webhook.
- Missing `components` on error edits: intentional (buttons stay for retry).
- Self-ban / banning a moderator: no guard, but it affects only preset access; product call.
- searchPresetAuthors non-aggregated author_name / unguarded fallback query: caught at index.ts:486.
- isPresetAuthorBanned TOCTOU before approve: millisecond window.
- safe-json prototype-key rejection and depth 10: real Discord payloads stay below depth 8.
- moderatorIdsCache latch: secret rotation redeploys, new isolate.
- Dev worker bound to production D1/KV: documented, routeless, workers_dev=false.
- Unban restores every hidden preset: only the ban path writes `hidden` anywhere in apps/.
- moderation-worker-11 (rejected author not notified): open by decision.

## COVERED
31 files: the whole slice list (package.json, scripts/register-commands.ts, every src non-test file, wrangler.toml). Tests only grepped (preset.test.ts:446, preset-rejection-review.test.ts:331, ban-service.sqlite.test.ts exists). Cross-read: apps/presets-api/src/handlers/moderation.ts, packages/worker-kit cloudflare.ts, discord-worker preset-notifications.ts:72.
