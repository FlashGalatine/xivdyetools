# Sprint 0 follow-up — 2026-09-15

## Scope and existing releases

The coordinated dead-code plan's Sprint 0 contains security FINDING-001, FINDING-003 and FINDING-002. A fresh GitHub check found them already implemented and released by the separate security-remediation task. This follow-up reuses that work and changes only the remaining GitHub raw-byte signature requirement. No later dead-code sprint is executed here.

[PR #183](https://github.com/FlashGalatine/xivdyetools/pull/183) merged at 17:24:34 UTC as `c40e7e63247b0342cdf5eb6ef0a1c46a58f3a4f2`. Its required pre-merge checks and [post-merge CI](https://github.com/FlashGalatine/xivdyetools/actions/runs/35001083016) passed. The following release logs were read again during this task; each run used that merge revision.

| Sprint 0 release | Verified result | Evidence |
|---|---|---|
| Shared auth | Published `@xivdyetools/auth@2.0.2` through Actions/OIDC | [Publication run](https://github.com/FlashGalatine/xivdyetools/actions/runs/35001132319) |
| Presets API | Production deployment succeeded; version ID `9fe2d7b9-9cda-4a77-98f0-d308f2f12bf4` | [Deployment run](https://github.com/FlashGalatine/xivdyetools/actions/runs/35001470713) |
| Moderation worker | Production deployment succeeded; version ID `9c4a623a-f497-445b-b293-2311239644d7` | [Deployment run](https://github.com/FlashGalatine/xivdyetools/actions/runs/35001651210) |
| Discord worker | Production deployment succeeded; version ID `a219f7b3-4588-4d31-b54b-9d8a8cdf6f6e` | [Deployment run](https://github.com/FlashGalatine/xivdyetools/actions/runs/35002232410) |

The original audit and implementation report are preserved as dated snapshots. Deployment success is distinct from interactive acceptance: the security-remediation task's completion record still left authenticated moderation acceptance pending.

## Remaining implementation gap

FINDING-003 explicitly requires HMAC over the bounded original bytes. The deployed route bounds the stream correctly but decodes it to text before the verifier re-encodes it. Text decoding removes a leading UTF-8 BOM and replaces malformed UTF-8. Consequently the verifier can authenticate bytes different from those received. This is a raw-byte contract gap; it does not establish an ability to create arbitrary valid webhook signatures.

The follow-up passes the bounded byte buffer to the existing HMAC verifier and decodes only after authentication. String callers remain supported. No new dependency, shared-auth release, schema migration or moderation contract change is needed. Real-HMAC endpoint regressions cover correct raw signatures, normalization-altered requests, exact-cap split Unicode, and rejection before HMAC above the byte cap.

## Verification and release status

Implementation is complete on `fix/sprint-0-webhook-bytes`, based on the merged revision above. An independent source/test review found no blocking correctness, security, scope or test-quality issues.

| Verification | Result |
|---|---|
| Regression before production edits | Four failures: correct raw-byte signatures returned 401; signatures over normalized text returned 200 |
| Focused endpoint and signature tests after the fix | 22 passed |
| `pnpm turbo run build type-check lint test --concurrency=2` | 62 tasks passed; 59 cached, three fresh Discord tasks; Discord suite: 1,273 tests passed |
| Discord coverage, unchanged thresholds | Statements 88.10%, branches 81.08%, functions 89.00%, lines 89.07% |
| `pnpm type-check:scripts` / `pnpm test:scripts` | Passed / 107 tests passed |
| `pnpm dead-code:check` | Passed |
| `pnpm docs:check-versions` / `pnpm docs:check-links` | Passed |
| Discord production `wrangler deploy --dry-run` | Passed; 2,283.12 KiB gzip; no deployment |

The first script-test attempt hit the Windows sandbox/user Git ownership mismatch; a process-scoped `safe.directory` entry for this exact worktree resolved it without changing global Git trust. Staging the new report then made it visible to the tracked-file link checker. No production code, test expectation, coverage threshold or gate was weakened to clear either setup issue. Existing lint warnings remain; lint reported zero errors.

The Discord patch is prepared in the [version register](../../versions.md). This follow-up has not been merged or deployed. After review and merge, deploy the Discord worker through its normal production workflow and verify the recorded revision and health response. Keep authenticated preview-image moderation acceptance open until an authorized moderator verifies matching, stale and legacy controls against a test preset. Do not close deployment-dependent findings solely from local tests or successful workflow status.
