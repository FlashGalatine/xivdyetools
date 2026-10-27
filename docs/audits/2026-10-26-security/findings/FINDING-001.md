# FINDING-001: Acting moderator's Discord username is written into persistent moderation-channel and submission-log posts, and neither privacy policy's list of post contents mentions it
**Severity:** MEDIUM · **Exposure:** INTERNET-AUTH · **Deploy unit:** moderation-worker + discord-worker · **Rotation:** NONE · **Policy:** NONE — §8 decision 2026-10-26: drop the name from the code (Step 3a case 1); no policy edit unless the maintainer reverses this · **CWE:** CWE-359
**Grade note:** MEDIUM by the skill rule (an undisclosed personal field, "not argue they are low-risk"). Both verifiers and the calibration pass argued LOW: the data subject is a staff moderator acting in a private channel and the policy already lists moderator IDs. Same shape as 2026-10-03/FINDING-002; the maintainer kept MEDIUM and chose the code fix at the §8 gate on 2026-10-26.

## Location
- `apps/moderation-worker/src/handlers/buttons/preset-moderation.ts:220` — "Approved by ${safeModerator}" in the edited moderation-channel embed; `:234` the same name in the new submission-log post
- `apps/moderation-worker/src/handlers/modals/preset-rejection.ts:162,177,307,322` (reject, revert) and `src/handlers/modals/ban-reason.ts:200` ("Banned By")
- `apps/discord-worker/src/handlers/buttons/preview-image.ts:279,296-297` — preview-image decisions; falls back to the raw moderator ID when there is no username

## Evidence
- `preset-moderation.ts:220 { name: 'Action', value: \`Approved by ${safeModerator}\`, inline: false }` and `:234 description: \`Preset approved by ${safeModerator}\``. `PRIVACY_POLICY.md:116` lists the preset, author name, reason and count and leaves out any moderator name; the Moderation Records section (:57-58) names only moderator IDs in D1. The same twin text is in `apps/web-app/PRIVACY.md:147-157`.
- Reach: a moderator in `MODERATOR_IDS` clicks Approve, Reject or Revert, submits a ban modal, or decides on a preview image. The handler copies `interaction.member.user.username` into an edited moderation-channel embed and, for approve/reject/revert, a new submission-log post.
- Live state (read-only Cloudflare query 2026-10-26, [evidence](../evidence/live-state-cloudflare-2026-10-26.md)): `MODERATION_CHANNEL_ID` and `SUBMISSION_LOG_CHANNEL_ID` are both configured on `xivdyetools-discord-worker` and `xivdyetools-moderation-worker`, so the submission-log copy is live. Who can read those two channels (Discord permissions) is not visible from the repo or Cloudflare.

## Fix
- **Decided:** stop writing the moderator username into the moderation-channel embeds, the submission-log posts, the ban post and discord-worker's preview-image post; attribute decisions through `moderation_log` (moderator id) alone. Drop the preview-image fallback that prints the raw moderator ID (`preview-image.ts:279`) too, or keep it only where the policy already names moderator IDs. Update the locale keys `previewImage.approvedFooter` / `previewImage.rejectedFooter` and the review-message tests.
- No policy edit is needed once the name is gone (the existing text becomes true). If the maintainer later keeps the name instead, it becomes an AMEND: bot `PRIVACY_POLICY.md` §5 Discord row and web `PRIVACY.md` "Posts in our Discord server", six variants each, landing after the code.

## Status
OPEN — moderation decision-post name removal prepared 2026-10-27; the separate Discord preview-image companion and release/production acceptance remain pending. Database actor attribution is retained. [A-MODERATION evidence](../evidence/remediation-moderation-2026-10-27.md).
