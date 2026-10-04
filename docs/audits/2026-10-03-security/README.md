# Security audit — xivdyetools (2026-10-03)

Whole-monorepo security and privacy-policy audit: **31 confirmed findings — 1 HIGH, 4 MEDIUM, 21 LOW, 5 INFO** — across 9 apps, 8 packages, CI / GitHub settings and the four policy documents in six languages. **No source files modified by the audit.** One item is exploitable now (Sprint 0: FINDING-001, the beta origin serves no CSP / X-Frame-Options / HSTS). No credential was exposed: gitleaks (tree + 1,511 commits), GitHub secret scanning and `pnpm audit --prod` are all clean. Twelve findings carry a policy edit; eight are AMENDs, which are new public commitments that need the maintainer's yes.

- **Branch/commit:** `claude/security-audit-96f7ce` @ `0ab33466c2e184e433b05aeb96cbe46e88f0e041` (= `main`). Previous audit [2026-09-15-security](../2026-09-15-security/README.md) @ `0332fcc5`; 378 commits since ([delta](evidence/delta-since-last-audit.txt)).
- **Method:** automated evidence → 35 per-unit / cross-cutting / policy reviews → per-candidate verifier + adversarial refuter → completeness critic (2 gap rounds) → calibration → coordinator reconciliation → verifier-tier translation re-read → live read-only probes. Details in the report's header and *Evidence and validation*.
- **Unit versions:** [evidence/versions.txt](evidence/versions.txt). **Build state for reproductions:** `pnpm install --frozen-lockfile` and `pnpm turbo run build --filter='./packages/*'` both exit 0 ([log](evidence/packages-build.txt)).

**Publication hold:** lifted for FINDING-001 on 2026-10-03, when it went live on beta, the `curl -sI` probe passed, and it merged as `b89629d9`. `FlashGalatine/xivdyetools` is public, and the folder still holds working detail for findings that are not yet deployed.

| File | Purpose |
|---|---|
| [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) | Catalog, severity × exposure, Sprint 0, pending rotation and policy edits, positive controls, rejected suspicions, recommendations, limits, status |
| [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) | Sprint plan from `remediation-planner` |
| [findings/](findings/) | FINDING-001 … FINDING-031, one file each |
| [evidence/](evidence/) | Raw scans, the 35 `review-*.md`, workflow results, live probes, handoffs, scripts used ([evidence/scripts/](evidence/scripts/)) |

## Top items

1. **FINDING-001 (MEDIUM, Sprint 0)** — web-app: beta.xivdyetools.app has served no CSP, X-Frame-Options, HSTS or Permissions-Policy since 2026-08-09, while it signs users in with production JWTs.
2. **FINDING-002 (HIGH, confirmed at the §8 gate)** — discord-worker: `/budget` log lines carry command option values that bot policy §5 promises are never logged.
3. **FINDING-004 (MEDIUM)** — web-app + oauth: the sign-in note says "No character data", but XIVAuth sign-in stores and publishes the verified character name and stores a linked Discord id (a regression of 2026-08-29/FINDING-002's copy fix).
4. **FINDING-003 (MEDIUM)** — web-app: PRIVACY.md says images never leave the device; the optional preset preview image is uploaded and stored.
5. **FINDING-005 (MEDIUM)** — moderation-worker + presets-api: ban and moderation-log records (username copy, free-text reason) are kept indefinitely and appear in neither policy.
6. **FINDING-019 (LOW, dated)** — presets-api: once the Perspective key is removed (planned by 2026-12-31) every preset auto-approves, because the local word list holds no profanity.
