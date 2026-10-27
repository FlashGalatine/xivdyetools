# FINDING-016: Tags and example_link are never content-moderated, so an approved preset can carry or gain arbitrary tag text without review or a daily cap; looping such edits also keeps moderator reject/revert returning STALE_REVIEW
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-693
**Related:** 2026-08-29-security PAPI-6 ("moderate tags" never landed)

## Location
- `apps/presets-api/src/handlers/presets.ts:653` — Tags and example_link are never content-moderated, so an approved preset can carry or gain arbitrary tag text without review or a daily cap; looping such edits also keeps moderator reject/revert returning STALE_REVIEW

## Evidence
- presets.ts:653-655 `const textChanged = (body.name !== undefined && body.name !== preset.name) || (body.description !== undefined && body.description !== preset.description);` ; :533-536 `case 'approved': return flaggedByThisEdit ? {pending,true} : { nextStatus: undefined, notifiesModerators: false };` ; :1031 `moderateContent(body.name, body.description, ...)` ; migrations/0014 trigger `AFTER UPDATE OF ... tags, ... example_link, secondary_categories`
- Reach: A logged-in user (web JWT or signed bot interaction) POSTs a preset with a clean name and description but offensive tags, which is auto-approved. Or the user PATCHes {"tags":[...]} / example_link on their own approved preset, which stays approved, sends no notification and uses no daily slot; repeating that about once a second bumps content_revision, so a moderator's reject or revert, bound to a revision read before the confirm click and modal, gets 409 STALE_REVIEW.
- The submit path moderates only name and description (presets.ts:1031-1036), and the edit path sets textChanged from name/description alone (presets.ts:653-655). reserveDailyEvent('text_edit') runs only inside if(textChanged) (:665-700), and ownerEditOutcome('approved', not flagged) writes no status and notifies nobody (:533-536). The TAG_PATTERN comment (validation-service.ts:157-159) confirms tags are never moderated, but the pattern still allows any letters, so slurs pass. The 0014 trigger bumps content_revision on changes to tags, example_link, category and secondary_categories, and moderator /status and /revert compare it (pres… Preconditions: The attacker needs a valid user identity that is not banned, and an approved preset of their own, which a clean name/description gets on submit. For the STALE_REVIEW part the attacker must keep sending edits faster than a moderator gets from the confirm click through the modal (well inside 100/min)…

## Fix
- Pass tags (joined) and the example_link path to moderateContent on submit and whenever they change on edit. Treat a tag or link change like a text change for the text_edit quota and for the approved→pending flip. Optionally let a moderator take down a preset without a revision check (a hide/flag action that is not bound to the reviewed revision).
- **Maintainer decision:** Product call: whether tags (and example_link edits) on approved presets go through text moderation and the daily text_edit slot, or the unmoderated-tags design is recorded in security-trade-offs.md.

## Status
OPEN — source prepared in A-PRESETS: extended tag/path moderation and safe link snapshots behind an explicit default-off flag; production consumer verification and a later activation-only PR remain required; [presets evidence](../evidence/remediation-presets-2026-10-27.md). Merge and production acceptance remain pending.
