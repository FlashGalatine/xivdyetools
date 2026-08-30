# Security Audit — xivdyetools monorepo (2026-08-29)

Whole-monorepo security audit (scope `all`): 9 apps, 8 packages, CI workflows, wrangler configs, Pages headers, supply-chain policy, and — new this cycle — a personal-data (PII) reconciliation of every analytics datapoint, storage write and structured log against the project's privacy promises. Follow-up to `docs/audits/2026-08-21-security/` (36 findings, all fixed 2026-08-21); the delta since that audit is 153 commits / 594 files (5.0 merge day, web + bot analytics, .chara name privacy, resvg fonts). **No source files were modified by the audit.**

- **Branch / commit:** `security-audit-2026-08-29` @ `4c213248` (= `main`, `origin/main`)
- **Method:** automated evidence (`pnpm audit --prod`, gitleaks 8.30.1 tree + history, secret-pattern grep, wrangler surface, PII sink/source inventory) → nine parallel per-unit reviewers with the skill checklist → coordinator verification of every candidate at `file:line` → catalog → `remediation-planner`.
- **Unit versions audited:** api-worker 0.9.0 · discord-worker 5.0.1 · image-worker 1.1.0 · moderation-worker 1.5.0 · oauth 2.7.0 · og-worker 2.3.0 · presets-api 2.1.0 · stoat-worker 0.2.2 · web-app 5.0.0 · auth 1.4.0 · bot-logic 3.0.0 · core 4.0.1 · logger 2.1.0 · svg 3.0.0 · test-utils 1.2.0 · types 2.0.0 · worker-kit 1.1.0

| File | Purpose |
|---|---|
| [`SECURITY_AUDIT_REPORT.md`](SECURITY_AUDIT_REPORT.md) | The catalog: severity × exposure table, Sprint 0, rotation table, positive controls, rejected suspicions, remediation status |
| [`findings/`](findings/) | One file per finding (`FINDING-001…`) |
| [`evidence/REVIEWER_BRIEF.md`](evidence/REVIEWER_BRIEF.md) | The brief every per-unit reviewer worked from (checklist, accepted trade-offs, output contract) |
| [`evidence/review-*.md`](evidence/) | Per-unit reviewer reports: route table + authz matrix, candidates, positive controls, rejected items, files covered |
| [`evidence/scripts/`](evidence/scripts/) | The sweep scripts actually run (`01-pnpm-audit` … `05-gitleaks`) |
| [`evidence/pnpm-audit*.{json,txt}`](evidence/) | Dependency scan — 0 advisories |
| [`evidence/gitleaks-{tree,history}.json`](evidence/) | Secret scan of the tree and of 866 commits with the repo's `.gitleaks.toml` — 0 leaks |
| [`evidence/potential-secrets.txt`](evidence/potential-secrets.txt) | Secret-shaped literals grep (56 hits; all test fixtures / docs / redaction comments) |
| [`evidence/wrangler-surface.txt`](evidence/wrangler-surface.txt) | Routes, `workers_dev`, `[vars]`, `.dev.vars` ignore check |
| [`evidence/pii-sinks.txt`](evidence/pii-sinks.txt), [`pii-sources.txt`](evidence/pii-sources.txt) | Personal-data inventory inputs (sinks: datapoints, KV/D1/R2 writes, logs, beacons; sources: IP/UA/username/… fields) |
| [`evidence/delta-*.txt`](evidence/), [`commits-since-last-audit.txt`](evidence/commits-since-last-audit.txt) | What changed since the 2026-08-21 audit |
| `REMEDIATION_PLAN.md` | Written by `remediation-planner` |

**Result:** 31 findings — 0 critical, 0 high, 9 medium, 22 low (+ 36 informational items kept in the reviewer reports). **Overall risk: MEDIUM.** All 36 findings of the 2026-08-21 audit were confirmed fixed, test-guarded and un-regressed. The theme this cycle is privacy drift: 13 findings are data collected, stored, shipped to a third party or logged that the two privacy documents do not disclose — or explicitly promise not to do. Nothing needs rotation except a conditional re-scope of the CI Cloudflare token.

## Top items
1. **FINDING-001 (MED)** — oauth: every XIVAuth login persists the user's full FFXIV character roster (names, worlds, Lodestone ids); nothing reads it, nothing discloses it.
2. **FINDING-004 / 005 (MED)** — presets-api: any edit to a non-approved preset re-queues it and pings moderators with no cap; content moderation fails open whenever Google Perspective errors or rate-limits, and runs before the edit cap.
3. **FINDING-003 (MED)** — oauth: `/auth/refresh` has no client in the codebase, yet keeps a copied token re-mintable for 30 days and escapes the victim's logout.
4. **FINDING-006 / 007 / 008 (MED)** — undisclosed processors and records: preset text goes to Google Perspective without `doNotStore` (web guide silent); bot rate-limit counters keyed by Discord id live in Upstash Redis (policy says KV); the bot policy omits two live records and cites commands removed in 5.0.
5. **FINDING-009 (MED)** — web-app: uploaded / pasted / camera images are persisted to IndexedDB and restored on the next visit, while the guide says they are discarded on reload.
6. **FINDING-010 / 014 / 015 (LOW)** — code vs promise: User-Agent logged on three workers incl. the telemetry endpoint (not retained today — Workers Logs are off everywhere, verified); `/v1/telemetry` accepts any Origin and a client-asserted `env`; the v1→v2 bot-signature rollover was never finished although its gate is met.
