# Verification baseline

Snapshot: `6da3ff5b047188e6f8c08be2ea47f99f02e7a8d1`, branch `codex/deep-i18n-audits-20261026`.
PR #334 already contains PR #333. Its runtime tree matches main `13c386e5`; both preceding PRs add audit documentation. These audits review that combined tree. No application source, version, locale, font, lockfile or deployment configuration was changed.

| Check | Result | Evidence |
|---|---|---|
| Frozen install | Pass; Windows package-store sandbox denial resolved by approved retry | `install.txt` |
| `pnpm turbo run build type-check lint test --concurrency=2` | Exit 0; 62/62 tasks, 26 cached; 16,193 tests passed across 17 units | `gates-baseline.txt`, `gate-summary.txt` |
| Fresh coverage, all 17 units | Every unit ultimately passed its configured coverage gate; three collection commands and two narrow diagnostic retries, described below | `coverage-run.txt`, `coverage-remaining.txt`, `coverage-moderation-recheck.txt`, `coverage-baseline.json` |
| Web `build:check` | Pass; one-locale JS payload 2.17 MiB / 2.20 MiB, 98.9% of budget | `web-bundle.txt` |
| Deferred export-sheet reproduction | 1/1 passed while asserting the observed stale-sheet defect; this is evidence of a bug, not a fix | `repro-web.txt`, `scripts/repro-web.test.ts`, `scripts/run-repro.ps1` |
| New audit secret scan | Both folders passed Gitleaks 8.30.1 with repository configuration and full redaction | Each folder's `gitleaks.txt` and `gitleaks.json` |

## Coverage collection and limits

The first fresh coverage command stopped at core's symlink-test setup: Windows sandbox `EPERM` on `fs.rename`, before the assertion. A narrow sandbox retry reproduced it; the same 15-test file outside the sandbox passed unchanged (`core-symlink-recheck.txt`, `core-symlink-unsandboxed.txt`). The remaining nine incomplete units were then run outside the sandbox with `--continue=always`. A moderation-worker test timed out during dynamic app import under concurrent coverage; its narrow retry passed, followed by the entire 757-test unit with coverage unchanged. The first two whole collection commands therefore have nonzero exits; they must not be described as single green runs. No tests, timeouts or thresholds were altered.

`coverage-baseline.json` was collected after all successful unit runs. Percentages describe configured include/exclude sets, not every tracked line; core excludes generated data, for example. A prior cached coverage artifact is not used to claim a fresh measurement. No browser E2E suite, production fault injection, package publishing, command registration or deployment was performed.

## Reproducibility

`scripts/collect.py` records the tracked code inventory, hotspot list, pattern lead list, versions and coverage summaries. Individual reviewer ledgers distinguish executable/declaration reads (comments sometimes elided), structured-data inspection and targeted test reads. The i18n audit separately records six-language gates, exact font input codepoints, runtime command-payload and regional-font probes. The full test logs intentionally retain expected error-path fixture output; an `ERROR` word in those logs does not by itself indicate a failed test.

All findings remain OPEN. This is an audit and planning change; remediation requires the maintainer's next explicit instruction.

For Git review, saved text artifacts were normalized to UTF-8/LF, removing ANSI terminal decoration and trailing whitespace with `scripts/normalize-logs.py`. Windows PowerShell's initial UTF-16 logs are therefore readable text rather than binary Git blobs; diagnostic lines, outcomes and failed-attempt evidence are retained.
