# FINDING-007: Ban flow fails for users with long display names (`custom_id` overflow) — abusers can self-exempt from the ecosystem's only ban path

## Severity
**MEDIUM** — availability failure of an abuse control: the moderation bot's confirm button and reason modal embed the base64url-encoded username in `custom_id`, which Discord caps at 100 chars; ≈17 CJK or ≈13 emoji characters (≈48 bytes) overflow it and Discord rejects the message, so the ban cannot be completed. Reviewer ID: MOD-2. Coordinator-verified.

## Category
CWE-20 Improper Input Validation · CWE-693 Protection Mechanism Failure

## Location
- `apps/moderation-worker/src/handlers/commands/preset.ts:487` — `custom_id: \`ban_confirm_${targetUserId}_${encodeBase64Url(user.username)}\``
- `apps/moderation-worker/src/handlers/buttons/ban-confirmation.ts:99` — `custom_id: \`ban_reason_modal_${targetUserId}_${encodeBase64Url(targetUsername)}\``

## Description
Prefix (12–17 chars) + snowflake (≤20) + separators leave ≤ 67 chars for base64url(username) ≈ 50 bytes; Discord display names may be 32 code points of CJK/emoji (96–128 bytes). Such a name makes Discord return 400 for the component/modal, and the moderator sees a generic failure.

## Impact
A user who expects moderation action can choose a long non-Latin display name and become un-bannable through the bot; moderators have no alternative ban UI.

## Recommendation
Do not carry the username in `custom_id`. Keep only the snowflake (`ban_confirm_<id>`) and re-resolve the display name from the preset author row at click time, or stash the pending ban context in KV keyed by interaction id with a short TTL. Add a length assertion for every generated `custom_id` (≤ 100).

## References
- Discord API: component `custom_id` max length 100
- Evidence: `../evidence/review-moderation-worker.md` (MOD-2)
