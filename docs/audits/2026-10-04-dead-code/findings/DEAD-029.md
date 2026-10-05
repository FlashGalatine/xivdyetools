# DEAD-029: Legacy base64-username suffix parsing in ban-reason.ts:57-92 and ban-confirmation.ts:70-78 is unreachable: no emitter has produced the suffix since the 2026-08-21 FINDING-007 fix, and those flows are ephemeral — about 16 source lines, with a test-fixture rewrite
**Confidence:** MEDIUM · **Blast radius:** LOW · **Deploy unit:** apps/moderation-worker · **Semver:** NONE · **Category:** Legacy · **Origin:** MAIN

## Location
- `apps/moderation-worker/src/handlers/modals/ban-reason.ts:64` — legacyEncodedUsername / ban_confirm_ and ban_reason_modal_ base64 suffix parsing

## Evidence
- The only emitters are preset.ts:559 `ban_confirm_${targetUserId}` (an ephemeral flags:64 message) and ban-confirmation.ts:93 `ban_reason_modal_${targetUserId}` (a modal). Neither carries a suffix. A snowflake or UUID target contains no '_', so the split and decode only ever fire for pre-2026-08-21 ids.
  - Commands: git grep 'ban_confirm\|ban_reason_modal' (non-test, non-md): emitters only preset.ts:559 and ban-confirmation.ts:93, no suffix; preset.ts:571 flags: 64; main 8ecb878f: ban-reason.ts:61,83,85 and ban-confirmation.ts:77-78 identical
- Origin: git show 8ecb878f:apps/moderation-worker/src/handlers/modals/ban-reason.ts has legacyEncodedUsername at :61,:83,:85; git show 8ecb878f:.../ban-confirmation.ts has the separator split at :77-78

## Fix
**REMOVE WITH CAUTION.** MEDIUM confidence: an ephemeral message held open in a client for 6+ weeks cannot be fully excluded. That case fails gracefully: isBanTargetId rejects 'id_suffix' with 'Invalid button/modal data', and no wrong ban occurs. Removal is a test-fixture rewrite, not a deletion: about 15 tests use `_TestUser` or encoded suffixes as fixtures for unrelated behaviour.

Steps: 1. ban-reason.ts: replace lines 62-64 with `const targetUserId = idPart;`, delete lines 86-92 (the legacy decode block), the base64UrlDecode import at line 18 and the comment at lines 57-60, and fix the header pattern at line 6. 2. ban-confirmation.ts: replace lines 77-78 with `const targetUserId = idPart;`, trim the comment at lines 71-75, and fix the header at line 7. 3. ban-confirmation.test.ts: delete the legacy-specific tests ('underscore in username' ~148-165, 'special characters' ~203-220, 'still accepts a legacy custom_id' ~299-315), strip the `_${encodedUsername}` suffix from the remaining fixtures, and drop the base64UrlEncode import at line 10. The 'ban_confirm__TestUser' test at :99-114 now gets 'Invalid button data.' instead of 'Invalid target user'; update its expectation. 4. ban-reason.test.ts: delete the 'underscores in username' (633-678) and 'special characters' (730-775) tests; strip `_TestUser` / `_${encodedUsername}` from the fixtures at lines 81, 113, 206, 237, 390, 437, 507, 549, 595, 691, 790 and 839; change the expected error of the `ban_reason_modal__TestUser` test (line 175; it no longer hits !targetUserId); update the isBanReasonModal fixtures (881-882) if desired; and drop the base64UrlEncode import at line 6. In 'should return processing message and ban user' (:375-420) and 'should ban user and send success message' (:422-491), mock banService.getPresetAuthorName to return 'BadUser' / 'SpamUser': those names came only from the legacy suffix. 5. Run `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker`, then `pnpm dead-code:check`.

## Status
OPEN
