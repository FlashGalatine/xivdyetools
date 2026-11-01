# Security audit — xivdyetools whole monorepo (2026-10-26)

56 findings (1 MEDIUM, 31 LOW, 24 INFO; no CRITICAL or HIGH) across all 9 apps, 8 packages, CI and repository settings, the six-language policy documents and the new xivcharakit `.chara` reader. No credential exposure and no exploitable-now item: Sprint 0 holds only maintainer-only actions (Cloudflare and GitHub settings, an upstream report, a checklist edit, release tags), led by FINDING-054. All 2026-10-03 and 2026-10-15 fixes still hold except 2026-10-03/FINDING-023. **No source files were modified by the audit**, and no Fable agent was used.

| File | Purpose |
|---|---|
| [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) | The catalog: severity × exposure, policy edits, live-state checks, positive controls, rejected suspicions, remediation status |
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | Sprint plan written by `remediation-planner` |
| [findings/](findings/) | One file per finding (`FINDING-001`…`FINDING-056`) |
| [evidence/](evidence/) | Raw tool output, 46 per-reviewer `review-*.md`, workflow results, `candidates.json` (85) → `candidate-groups.json` (73) → `final-catalog.json`, live-probe captures, gitleaks provenance, and `scripts/` (collect, three workflow scripts, renderers) |

## Top items

> **Status 2026-10-31:** these items are as found on 2026-10-26. FINDING-054 and FINDING-028 are since FIXED, and FINDING-009 is PARTIAL; see the report's [Remediation status](SECURITY_AUDIT_REPORT.md#remediation-status) table.

1. **[FINDING-001](findings/FINDING-001.md) (MEDIUM)** — moderation-worker: the acting moderator's Discord username is written into persistent moderation and submission-log posts that neither privacy policy lists; the maintainer chose the code fix (drop the name).
2. **[FINDING-054](findings/FINDING-054.md) (LOW)** — api-worker: a stale dev script from 2026-08-10 is still public on `workers.dev` because the repo's `workers_dev = false` pin never reached the live script.
3. **[FINDING-002](findings/FINDING-002.md) (LOW)** — api-worker: XIVAPI search and Glasses bodies are read unbounded and item names are cached for 7 days with no length cap or control/bidi filtering.
4. **[FINDING-004](findings/FINDING-004.md) (LOW)** — oauth / worker-kit: per-IP limiters key on the full IPv6 address (IPv6 is on, Pseudo IPv4 off), so one /64 gets unlimited buckets.
5. **[FINDING-009](findings/FINDING-009.md) (LOW)** — web-app hosting: 522 + 240 superseded Pages deployments stay public under older CSPs; one old beta deployment serves no CSP, XFO or HSTS.
6. **[FINDING-028](findings/FINDING-028.md) (LOW)** — CI: 2026-10-03/FINDING-023 is still open; production and beta bot tokens remain repository-scope secrets.

## Reading the evidence

- Where an `evidence/review-*.md` file and the report or a `findings/` file disagree, the report and `findings/` are authoritative: the review files are raw reviewer output from before verification. Examples: pii-web-01 (rejected as G24), the moderator name rejected in `review-r2-policy-claims-second-pass.md` (filed as FINDING-001), tags-not-moderated rejected in `review-presets-api-services.md` (filed as FINDING-016), and presets-api-routes-02's unconfirmed precondition (rejected as G05; the live read also shows the `-dev` worker with workers.dev and previews off).
- A bare `FINDING-NNN` in `evidence/review-*.md` is an ID from an earlier audit that the reviewer was checking (the file's Scope line or the line itself names which audit). It never refers to this audit's `findings/`.
- Files under `findings/` are rendered summaries: each Evidence bullet is cut at a fixed length (marked `…`), and its Preconditions are appended to the same bullet. The full verifier text is in `evidence/workflow-verify-result.json` under the group ID that `evidence/final-catalog.json` maps to each FINDING-NNN. FINDING-050, FINDING-051 and FINDING-053 were restored from it on 2026-10-31.
