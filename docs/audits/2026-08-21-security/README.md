# Security Audit — xivdyetools monorepo (2026-08-21)

Whole-monorepo security audit: 9 apps, 8 packages, CI workflows, wrangler configs, Pages headers, supply-chain policy. **Overall risk: MEDIUM** — 0 critical, 1 high, 9 medium, 26 low, ≈70 informational. No source files were modified by the audit.

| File | Purpose |
|---|---|
| [`SECURITY_AUDIT_REPORT.md`](SECURITY_AUDIT_REPORT.md) | Executive summary, findings tables, rejected suspicions, positive controls, remediation priority |
| [`AUDIT_MANIFEST.md`](AUDIT_MANIFEST.md) | Scope, commit, method, versions audited |
| [`findings/FINDING-001..036.md`](findings/) | One file per promoted finding (severity, CWE, file:line, evidence, exploit scenario, fix) |
| [`evidence/review-*.md`](evidence/) | Per-unit reviewer reports: oauth, presets-api, discord-worker(+bot-logic), moderation-worker, api-worker, og-worker+image-worker, web-app, packages, infra+stoat — each with route table / authorization matrix, positive controls, rejected items and file-coverage list |
| [`evidence/pnpm-audit.json`](evidence/pnpm-audit.json), [`pnpm-audit-summary.md`](evidence/pnpm-audit-summary.md) | Dependency scan (5 dev-only advisories) |
| [`evidence/potential-secrets.txt`](evidence/potential-secrets.txt), [`git-history-secrets.txt`](evidence/git-history-secrets.txt) | Secrets scans of the tree and of git history (clean; one revoked value in an old audit doc) |
| `recommendations/` | Reserved for the remediation plan (`remediation-planner` skill) |

## Top items
1. **FINDING-001 (HIGH)** — oauth: revocation blacklist expires at `exp` but `/auth/refresh` accepts tokens 24 h past `exp` → logged-out/leaked tokens re-mintable for up to 30 days.
2. **FINDING-003** — worker-kit KV rate limiter cannot throttle a fast client (KV 1 write/s/key) and fails open.
3. **FINDING-004** — image-worker decodes images with no dimension gate (decompression bomb).
4. **FINDING-005** — og-worker O(L³) text wrap on an unbounded URL param; no edge cache.
5. **FINDING-006/007** — moderation bot: autocomplete without moderator check; ban flow breaks on long names.
6. **FINDING-009/010** — CI action pinning/permissions; stale secret-rotation runbook that would rotate the wrong worker.
