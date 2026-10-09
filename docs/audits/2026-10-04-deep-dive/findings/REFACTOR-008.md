# REFACTOR-008: Stale comments: ci.yml check-bundle-size scope, web-app vitest coverage-report baseline, orphaned docblock above asReferrers
**Priority:** LOW · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** root (CI/scripts) · **Origin:** MAIN · **Other units:** apps/web-app (comment only)

## Location
- `.github/workflows/ci.yml:256`

## Evidence
- Reproduction: Reader trusts ci.yml comment and believes web-app's bundle budget is not gated in CI
- ci.yml:256 says only discord-worker declares check-bundle-size, but apps/web-app/package.json:27 does too; vitest.config.ts:57 says 80/80/80/75 vs APP_BASELINE all 80 (coverage-report.ts:57 at main); check-dead-code.ts:643 docblock is orphaned. CLAUDE.md 'Not inside it' is accurate (local gate) - scope is the three comments.
  - Checked: ci.yml:256-261; apps/web-app/package.json:27; apps/web-app/vitest.config.ts:57; scripts/coverage-report.ts APP_BASELINE; check-dead-code.ts:643-648
- Origin: 8ecb878f: ci.yml:249 comment (shifted to :256 by 3a158847), web-app package.json:27 check-bundle-size, vitest.config.ts:57, coverage-report.ts:57, check-dead-code.ts:643

## Fix
- Update the three comments (name both web-app and discord-worker; match 80/80/80/80 or the intended target; delete the orphaned one-liner). No package publish.

## Status
FIX COMMITTED, NOT DEPLOYED — `26e43a64` (branch `fix/remediation-2026-10-04-sprint20`, root 2.3.2; PR #276, open, on PR #264).
