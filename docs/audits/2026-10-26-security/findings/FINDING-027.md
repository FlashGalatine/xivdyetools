# FINDING-027: Pre-edit snapshot disclosure is broader than the code: a snapshot is taken only when the edited preset is approved
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** web-app + discord-worker (policy text only; presets-api code is correct) · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/PRIVACY.md section 3 "Community presets" (line 95-98); CORRECT apps/discord-worker/PRIVACY_POLICY.md section 2 "Information You Provide", Preset Submissi… · **CWE:** n/a

## Location
- `apps/presets-api/src/handlers/presets.ts:737` — Pre-edit snapshot disclosure is broader than the code: a snapshot is taken only when the edited preset is approved

## Evidence
- presets.ts:737 `if (preset.status === 'approved' && !preset.previous_values) {`; preset-service.ts:484 `status = 'approved', previous_values = NULL` (revert only)
- Reach: A signed-in author (web JWT or bot-signed request) sends PATCH /api/v1/presets/:id with a new name or description that fails moderation (flagged, or the Perspective check is unavailable). If the stored status is pending, rejected or flagged, no previous_values is written, but both policies say the pre-edit version is kept.
- presets.ts:737 writes the write-once snapshot only when `preset.status === 'approved' && !preset.previous_values`. Pending, rejected and flagged edits store none (BUG-003 follow-up, pinned by tests/handlers/edit-snapshot.test.ts). preset-service.ts:697-699 writes previous_values only when the handler passes one, and preset-service.ts:484 (revert) is the only path that clears it, so "kept until a moderator restores it or the preset is deleted" is accurate. Neither policy says the snapshot depends on status: PRIVACY.md:95-98 and PRIVACY_POLICY.md:31 claim more storage than happens, which is harmless but false. Preconditions: The author must be signed in and must edit the text of a preset that is not approved, and the edit must fail moderation. Rows written before the approved-only rule may still hold a snapshot taken from a pending or rejected state, so the policy is true for those older rows.
- Live state the repo cannot show: Whether production D1 still holds snapshots taken before the rule from non-approved states (SELECT id, status FROM presets WHERE previous_values IS NOT NULL). This does not change the verdict.

## Fix
- Narrow both sentences to edits of a published (approved) preset, for example "if our automatic check holds an edit of a published preset's name or description for review, the version from before the first such edit ...". Change no code.
- Policy detail: CORRECT apps/web-app/PRIVACY.md section 3 "Community presets" (line 95-98); CORRECT apps/discord-worker/PRIVACY_POLICY.md section 2 "Information You Provide", Preset Submissions row (line 31)
- Policy variants to edit (all in one commit, all `Last updated` lines bumped): apps/web-app/PRIVACY.ja.md, PRIVACY.de.md, PRIVACY.fr.md, PRIVACY.ko.md, PRIVACY.zh.md (same Community presets paragraph); apps/discord-worker/PRIVACY_POLICY.ja.md, PRIVACY_POLICY.de.md, PRIVACY_POLICY.fr.md, PRIVACY_POLICY.ko.md, PRIVACY_POLICY.zh.md (Preset Submissions row). No locales/*.json key carries this text: a git grep of apps/*/src/locales and packages JSON found none.

## Status
OPEN — security-only A-WEB implementation and reviews prepared in web 5.16.4; local full-repository verification and affected CI/beta pass; prerequisite publication and production acceptance remain release gates. [A-WEB evidence](../evidence/remediation-web-security-2026-10-28.md). Bot half is prepared in [A-DISCORD](../evidence/remediation-discord-2026-10-27.md).
