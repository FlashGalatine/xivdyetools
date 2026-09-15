# Security sprints 0–2 — implementation report

**Date:** 2026-09-15. **Branch:** `fix/security-audit-sprints-0-2`. **Base:** `71fc2233`. **Application-code endpoint:** `3095b8ce`.

All six findings are fixed and verified locally. The original audit was against `0332fcc5`; the refreshed base adds dependency updates and unrelated test corrections. Work took place in an isolated worktree. No push, merge, package publication, worker deployment, remote database write or real notification occurred.

The deployment-dependent findings remain **OPEN — fixed locally, deployment acceptance pending**. The [rollout runbook](../../operations/security-remediation-2026-09-15.md) records migration 0014, workflow holds, ordered release endpoints and post-deployment checks. The original audit evidence remains a historical snapshot; the evidence below records this implementation separately.

## Changes and commit boundaries

| Sprint / finding | Local result | Commit(s) |
|---|---|---|
| Audit baseline | Preserve the audit, evidence and authorized sprint plan | `fa3517d2` |
| 0 / FINDING-001 | Auth counts incoming bytes, cancels over-limit streams early and verifies original signature bytes; prepare both bot consumers | `ef555e57`, `0a357852`, `205f0be6` |
| 0 / FINDING-003 | Independently cap the GitHub webhook stream at 1 MiB before HMAC verification | `205f0be6` |
| 0 / FINDING-002 | API writes compare the exact pending image key; Discord buttons and signed requests carry that key; old buttons refresh the displayed image and require a second click | `3c07b6b9`, `247d368d`, `0b5d814c` |
| 1 / FINDING-004 | Owner writes compare authenticated owner and captured content revision; a database trigger covers every content/status writer | `74114ebf` |
| 1 / FINDING-005 | Status/revert writes compare the captured revision; reverts also compare the raw saved snapshot; successful change and audit insertion remain atomic | `6b7d1b3c` |
| 2 / FINDING-006 | Crawler metadata event contains only tool, normalized locale and crawler category | `3095b8ce` |

Prepared versions: auth **2.0.2**, Discord **5.5.4**, moderation **1.7.1**, presets-api **2.3.3**, OG **2.10.1**. The [version history and compatibility matrix](../../versions.md) distinguish prepared releases from deployed versions. Technical changelogs cover each significant step. Player-facing changelogs were omitted under the project's security-only change policy.

### Important behavior

- Missing or misleading Content-Length cannot bypass either stream cap. The auth tests use real Ed25519 signatures and exercise split/malformed UTF-8, exact boundaries, cancellation, tampering and negative configured limits.
- Image replacement between notification and click is safe, even without overlapping requests. A stale action returns 409, cannot approve a replacement and cannot delete its object. UUID-based button IDs fit Discord's 100-character limit.
- Legacy controls perform a read-and-refresh only. Lookup/message-edit failures remain retryable; the API still checks the key at the eventual write. There is no dead-letter replay dispatcher, so inserting failed-notification records is not a recovery strategy.
- Content revisions detect status changes that return to their starting value, same-millisecond writes, ownership transfers and concurrent owner edits. Votes, preview state and timestamp-only changes do not invalidate a content edit. The internal token is omitted from public preset responses.
- The revision trigger also covers older moderation-worker hide/restore SQL during migration rollout. Migration alone does not fix old API handlers; deploy the guarded handlers afterward. Keep the additive schema on rollback.
- A rejected stale revert inserts no audit row. A failed audit insert rolls back an otherwise successful revert. Existing dye-signature collision responses remain intact.

## Verification

All listed final commands exited **0**. Existing lint warnings and Turbo missing-output warnings remain; no check or coverage threshold was weakened.

| Check | Result |
|---|---|
| Auth and dependencies: build, type-check, lint, test | 4 tasks; 129 auth tests |
| Moderation worker and dependencies | 35 tasks; 639 worker tests |
| Discord worker and dependencies, final recovery slice | 35 tasks; 1,269 worker tests |
| Presets API and dependencies, final revert slice | 23 tasks; 809 API tests |
| OG worker and dependencies | 31 tasks; 451 worker tests |
| Whole graph: `pnpm turbo run build type-check lint test` | **62 tasks passed (41 cached); 10,966 tests passed** across all 17 workspaces |
| `pnpm type-check:scripts` | Passed |
| `pnpm test:scripts` | **107 tests passed** |
| `pnpm dead-code:check` | Passed with the existing exemption rules |
| `pnpm docs:check-versions` / `pnpm docs:check-links` | Passed after final report/runbook edits: 34 version claims and 875 links across 236 documents |
| Independent reviews | Each slice and the final integration review passed; release sequencing warning addressed in the runbook |

The new security regressions were observed failing before the corresponding production fixes. The auth suite additionally caught a negative-limit compatibility edge, and the gates caught TypeScript/lint cleanup; those were corrected before commits. Real SQLite/Hono tests execute production SQL with deterministic interleaved writes, including owner-transfer and ABA cases. The OG test stubs only log transport and unused Workers-only rendering; the crawler HTML route and metadata generation are real. Nine tests solely for the removed human-readable crawler-label helper were deleted with that now-unused helper.

The [verification summary](evidence/remediation/gates.txt) preserves commands, results and test totals. Full local console logs remain in the worktree's ignored `.superpowers/sdd/REMEDIATION_PLAN/` directory. Browser end-to-end and live worker probes were not run; no web-app behavior changed.

### Actual local D1 migration

Applied the full pre-migration schema from `3c07b6b9`, seeded a synthetic preset, and executed the actual `0014_add_content_revision.sql` using **Wrangler D1 --local**. The [local D1 evidence](evidence/remediation/local-d1.log), [seed](evidence/remediation/local-d1-seed.sql) and [verification SQL](evidence/remediation/local-d1-verify.sql) record:

- Existing row revision 0; a moderation write increments it to 1.
- An update expecting revision 0 changes zero rows; the following conditional audit insert also changes zero rows.
- An update expecting revision 1 changes one row; its audit insert changes one row.
- Vote/preview-only updates leave revision 2 unchanged; final audit count is 1.

This verifies local D1 trigger/changes behavior as well as the Node SQLite regressions. It does not claim migration or deployed-schema parity in beta/production.

### Gitleaks follow-up

Downloaded [Gitleaks v8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) from the official release and verified the Windows archive against its published SHA256 checksum before execution. The binary remains in ignored scratch; no global installation or scan upload occurred.

The final scans use this repository's `.gitleaks.toml`, `--redact=100` and `--exit-code=1`:

- Clean `git archive HEAD` export: **0 findings** in tracked source. Separate working-directory scans of apps, packages, docs, workflows and scripts also reported 0 findings.
- All locally available Git history (`--log-opts=--all`): **0 findings across 1,196 commits**.
- The initial unrestricted scratch-inclusive scan detected two examples in Gitleaks' downloaded README. They are scanner-distribution examples outside tracked project source. Final source scope excludes ignored scanner/build/dependency artifacts.

See [scanner provenance](evidence/remediation/gitleaks.md), [tree log](evidence/remediation/gitleaks-tree.log), [history log](evidence/remediation/gitleaks-history.log), and the redacted [tree](evidence/remediation/gitleaks-tree.json) / [history](evidence/remediation/gitleaks-history.json) reports. The original blocked files were preserved. This closes the original local scan coverage gap; it does not prove the absence of every secret or inspect remote-only refs, deployed credentials or storage.

## Remaining release work

Follow the [runbook](../../operations/security-remediation-2026-09-15.md): hold the explicitly named workflows, release the ordered commit ranges, publish auth through Actions/OIDC, apply migration 0014 before the dependent API deployment, verify every affected consumer, then restore workflow states. A branch push can deploy public beta workers; a main merge can independently deploy four auth consumers. Neither is authorized by this implementation task.

Only close each finding after its required deployment and bounded acceptance checks. No rotation is currently indicated by the completed local scans. Accepted KV availability trade-offs and unrelated audit backlogs remain outside this remediation scope.
