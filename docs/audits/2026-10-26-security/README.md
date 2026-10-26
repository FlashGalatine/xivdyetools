# Security audit — xivdyetools whole monorepo (2026-10-26)

56 findings (1 MEDIUM, 31 LOW, 24 INFO; no CRITICAL or HIGH) across all 9 apps, 8 packages, CI and repository settings, the six-language policy documents and the new xivcharakit `.chara` reader. No credential exposure and no exploitable-now item (Sprint 0 is empty). All 2026-10-03 and 2026-10-15 fixes still hold except 2026-10-03/FINDING-023. **No source files were modified by the audit**, and no Fable agent was used.

| File | Purpose |
|---|---|
| [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) | The catalog: severity × exposure, policy edits, live-state checks, positive controls, rejected suspicions, remediation status |
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | Sprint plan written by `remediation-planner` |
| [findings/](findings/) | One file per finding (`FINDING-001`…`FINDING-056`) |
| [evidence/](evidence/) | Raw tool output, 46 per-reviewer `review-*.md`, workflow results, `candidates.json` (85) → `candidate-groups.json` (73) → `final-catalog.json`, live-probe captures, gitleaks provenance, and `scripts/` (collect, three workflow scripts, renderers) |

## Top items

1. **[FINDING-001](findings/FINDING-001.md) (MEDIUM)** — moderation-worker: the acting moderator's Discord username is written into persistent moderation and submission-log posts that neither privacy policy lists; the maintainer chose the code fix (drop the name).
2. **[FINDING-054](findings/FINDING-054.md) (LOW)** — api-worker: a stale dev script from 2026-08-10 is still public on `workers.dev` because the repo's `workers_dev = false` pin never reached the live script.
3. **[FINDING-002](findings/FINDING-002.md) (LOW)** — api-worker: XIVAPI search and Glasses bodies are read unbounded and item names are cached for 7 days with no length cap or control/bidi filtering.
4. **[FINDING-004](findings/FINDING-004.md) (LOW)** — oauth / worker-kit: per-IP limiters key on the full IPv6 address (IPv6 is on, Pseudo IPv4 off), so one /64 gets unlimited buckets.
5. **[FINDING-009](findings/FINDING-009.md) (LOW)** — web-app hosting: 522 + 240 superseded Pages deployments stay public under older CSPs; one old beta deployment serves no CSP, XFO or HSTS.
6. **[FINDING-028](findings/FINDING-028.md) (LOW)** — CI: 2026-10-03/FINDING-023 is still open; production and beta bot tokens remain repository-scope secrets.
