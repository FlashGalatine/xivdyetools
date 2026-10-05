# DEAD-001: preset.moderation.{approved,approvedDesc,missingReason,rejected,rejectedDesc} in moderation-worker bot-i18n.ts are orphaned by PR #225 — 5 lines, 0 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/moderation-worker · **Semver:** NONE · **Category:** Orphan i18n · **Origin:** PR-#225

## Location
- `apps/moderation-worker/src/services/bot-i18n.ts:53` — preset.moderation.{approved,approvedDesc,missingReason,rejected,rejectedDesc}

## Evidence
- No reader anywhere at HEAD: every production t.t() key is a literal in handlers/commands/preset.ts, and none of these five keys appears. They were live at main (preset.ts:263-322) until PR #225's sendConfirmation rewrite removed the approve/reject handlers that read them.
  - Commands: git ls-files moderation-worker non-test | xargs grep '\bt\(|\.t\(' gives literal keys only, all in preset.ts, with none of the five.; git grep -w approvedDesc|rejectedDesc|missingReason across the repo (excluding docs/audits) finds only the definitions at bot-i18n.ts:54,55,57.; There are 0 test references.
- Origin: git grep at 8ecb878f: preset.ts:263,264,308,320,322 read all five keys. git log 8ecb878f..HEAD -S'preset.moderation.approvedDesc' and -S'preset.moderation.missingReason' both name c7fd9eba, and git merge-base --is-ancestor c7fd9eba 3a69828c (PR #225 head) returns yes. The diff replaces both handlers with sendConfirmation(ctx, presetId, 'approve'|'reject').

## Fix
**REMOVE.** Fold the deletion into PR #225 before the batch merge, or into an immediate follow-up. After the edit, check that preset.test.ts still asserts the live embed titles: a wrongly deleted neighbour key fails silently because t() returns the raw key.

Steps: Delete bot-i18n.ts:53-57 (approved, approvedDesc, missingReason, rejected, rejectedDesc), keeping accessDenied through missingId and stats onward. No test change. The older orphans in the same file (DEAD-030) are scheduled separately, after the batch merge. Then run pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker and pnpm dead-code:check.

## Status
FIX COMMITTED, NOT MERGED 2026-10-04 `ea264d49` — the five strings deleted on `fix/security-2026-10-03-sprint4` (PR #225); the moderation-worker gate passes (763 tests).
