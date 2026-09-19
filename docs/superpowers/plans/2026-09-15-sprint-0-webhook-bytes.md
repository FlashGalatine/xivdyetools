# Sprint 0 completion: preserve GitHub webhook bytes

**Status:** implemented and locally verified; merged 2026-09-16 as PR #184 and deployed, with authenticated moderation acceptance still pending.

**Scope:** Sprint 0 of the 2026-09-15 coordinated dead-code cleanup plan. Its three security fixes already merged in [PR #183](https://github.com/FlashGalatine/xivdyetools/pull/183), with auth publication and production worker deployments. This follow-up completes FINDING-003's requirement to verify HMAC over the bounded original bytes. Later cleanup sprints are outside this change.

**Spec:** [FINDING-003](../../audits/2026-09-15-security/findings/FINDING-003.md). Keep the independent 1 MiB streamed-byte cap and early cancellation. Authenticate the exact received bytes before decoding text; preserve existing valid webhook behavior and short-secret compatibility.

## Tasks

1. Reproduce the remaining normalization issue using the real HMAC verifier: signatures over original BOM/malformed UTF-8 bytes must verify, while signatures over their normalized text must fail. Retain exact-cap, split-Unicode and cancellation tests.
2. Pass the bounded byte buffer to the existing verifier and decode only after successful authentication. Preserve its string input compatibility for existing callers/tests. No new dependency or shared-auth change.
3. Run the focused tests, worker/dependency gates, production bundle dry run, and required repository gates. Independently review the final change. Prepare a Discord patch release and synchronized version documentation.
4. Record the existing Sprint 0 deployments and remaining acceptance/release work. Keep changes on the isolated branch for review; this task does not merge or deploy the follow-up.

## Acceptance

- Oversized streamed requests stop at the first over-limit chunk and return 413 before HMAC.
- Correct raw-byte signatures pass; byte-altered requests fail even when text decoding produces the same string.
- The GitHub endpoint verifies real HMAC in regression tests, including exact-cap Unicode split across chunks.
- Existing Discord/auth and preview-image Sprint 0 controls remain covered.
- No production database, notification, workflow or deployment is changed by this follow-up.
