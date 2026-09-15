# Security audit — xivdyetools (2026-09-15)

Whole-monorepo security audit: **6 confirmed findings — 3 medium and 3 low**, across 9 apps, 8 packages, CI/configuration and privacy-sensitive data flows. **No source files modified by the audit.** The final security test runs passed 957 tests; the production dependency scan found no known advisories. Gitleaks was unavailable, so automated tree/history secret scanning remains a documented limitation.

- Branch/commit: `main` @ `0332fcc5768a4477301ed5b15590eee16a772f87`.
- Method: tracked-file sweeps, per-unit source review, local reproductions, candidate verification, findings catalog and remediation plan.
- Baseline: 2026-08-29 audit README and positive/rejected controls; accepted architectural trade-offs checked against current source.
- Unit versions: [captured version inventory](evidence/versions.txt). All claims describe this source snapshot unless explicitly identified as a live configuration check.

| File | Purpose |
|---|---|
| [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) | Catalog, severity/exposure totals, controls, rejected suspicions, limits and status |
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | Independent urgent fixes, deployment dependencies, later concurrency and privacy work |
| [evidence/](evidence/) | Scans, reviewer coverage, reproduction scripts and results |
| [findings/](findings/) | Confirmed findings |

## Top items

1. **FINDING-001 (MEDIUM)** — auth: enforce the Discord body cap while reading, before buffering oversized unauthenticated requests.
2. **FINDING-002 (MEDIUM)** — presets-api: bind approvals to the exact preview image the moderator reviewed.
3. **FINDING-003 (MEDIUM)** — discord-worker: independently bound the GitHub webhook body before HMAC verification.
4. **FINDING-004 / FINDING-005 (LOW)** — presets-api: preserve newer moderator decisions when owner edits or reverts finish late.
5. **FINDING-006 (LOW)** — og-worker: remove raw crawler User-Agent and complete share URLs from normal logs.

No fixes, commits, pushes, rotations or deployments were performed. The three medium findings are the plan's Sprint 0 priorities; active exploitation was not assessed.

## Implementation follow-up — 2026-09-15

The original audit above is followed by [completed local sprints 0–2](IMPLEMENTATION_REPORT.md): six fixes, separate significant-step commits, 10,966 passing whole-graph tests and 107 passing script tests. Gitleaks tracked-tree and available-history scans now report no findings. Deployment-dependent statuses remain open until the [ordered rollout and acceptance checks](../../operations/security-remediation-2026-09-15.md) occur. No remote deployment, publication or push was performed during implementation.
