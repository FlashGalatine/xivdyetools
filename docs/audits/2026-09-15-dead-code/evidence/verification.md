# Verification record

Snapshot: `main@0332fcc5768a4477301ed5b15590eee16a772f87`. All reference counts use the tracked inventory. This audit changed only its own documentation/evidence folder.

## Candidate verdicts

An independent Sol verifier opened all five zero-test-reference web methods and confirmed each against direct/computed/inherited/test references. A second pass confirmed the eight worker candidates, distinguishing the header-helper cascade from independently unused code. A follow-up pass confirmed EmptyState/OfflineBanner candidates, image's inert environment member and the API test-only alias, and rejected removal of modal/toast reset helpers.

| IDs | Verdict | Deciding evidence |
|---|---|---|
| DEAD-001–005 | CONFIRMED | Only actual method declarations remain; comments and unrelated symbols do not count as callers |
| DEAD-006–007 | CONFIRMED | Only dedicated behavior tests call these APIs; construction and internal online/offline listeners provide live behavior |
| DEAD-008 | CONFIRMED | preferences.exhaustive.test.ts is the only executable caller; production reads whole preference objects |
| DEAD-009 | CONFIRMED, caution | Wrapper callers are test-only; live ban/unban batches statement builders with audit-log statements |
| DEAD-010 | CONFIRMED | Fetch wrappers have no production callers |
| DEAD-011 | CONFIRMED, conditional | Header helper is reachable only through the two removable wrappers; private header list is used only by it |
| DEAD-012–015 | CONFIRMED | Dedicated test-only behavior/types; surrounding translation, moderation and real response paths stay live |
| DEAD-016 | CONFIRMED | Source alias only supports a test; preserve key assertions by moving/inferring the type in that test |
| DEAD-017 | CONFIRMED | No Wrangler variable or production read; logger explicitly disables environment lookup |
| DEAD-018 | KEEP | Existing public core contract; current registry/external consumers not checked |
| DEAD-019 | KEEP | Planned feature scaffolding in parked app; live package consumers still counted |
| DEAD-020 | KEEP | Absent native bindings still select fallback implementations; no operational retirement evidence inspected |
| DEAD-021 | KEEP | 12 test files use the type for real handler response assertions |

The raw reviewer reports retain their preliminary estimates. The coordinator measured exact source/test syntax spans afterward. In particular, the sanitizeHeaders tests are lines 154–292; a preliminary range extending into live sanitizeErrorMessage tests was rejected. See `test-removal-spans.json` (527 lines), `syntax-survey.json` and `reference-evidence.txt`.

## Commands and results

- `collection-results.json`: full corrected command arguments, working directories, exits and raw log paths. Initial pnpm bootstrap EPERM failures and an initial PowerShell argument-variable mistake are preserved under `initial-bootstrap-failures/`; these did not execute the intended checks and are not code evidence.
- Root direct Knip: exit 1, only the documented two `.d.ts` files and web-app wrangler devDependency. Local web and both OG modes: exit 0.
- Custom gate: exit 0; 550 production/482 test files; 34 test-only, 4 convention-entry and 7 public exemptions.
- Direct unused-local/parameter TypeScript checks: 13 initially passed, 4 failed on stale dependency outputs (Discord, moderation, OG, bot-logic). The dependency-aware baseline rebuilt outputs, then all four direct reruns passed. All 17 final unit checks are clean; no source fix or relaxed compiler flag was used.
- Baseline `pnpm turbo run type-check lint test --continue --concurrency=2`: exit 0; 59/59 tasks, 16 cache hits, 2m21.513s. It is a baseline with caching, not an uncached test count or an explicit whole-app production build.
- Web i18n analyzer: all 1,128 keys used, no reported orphan. Bot locale suite: 72 tests in 4 files passed.
- `collection-final-results.json`: all 15 commands exit 0: 4 refreshed TypeScript runs, root script type-check, 107 script tests, both documentation gates and 7 Wrangler dry-run bundles.
- All bundle commands include `--dry-run` and use the default configured environment, with output in this audit's evidence folder. No production deployment was made or queried.

## Artifact checks

The final artifact validation command is `python docs/audits/2026-09-15-dead-code/evidence/scripts/validate.py`. It checks report/finding/plan ID parity, source/test count arithmetic, finding lengths, local links, reference source existence, file encoding, and the unchanged tracked worktree. Its saved result is `artifact-validation.json`.
