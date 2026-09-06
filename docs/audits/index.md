# Audit Archive

**Dated snapshots of every audit run against this codebase.** Each directory records what was
found on that date and, where a remediation followed, what was done. They are **frozen**: the
code has moved on since every one of them, and the findings are not re-checked. For the current
state of anything, read the live docs and the `CHANGELOG.md` of the workspace concerned.

Directories are named `YYYY-MM-DD` (older) or `YYYY-MM-DD-<topic>` (since August 2026). The
entry point in each is its `README.md` where one exists, otherwise the `00-…` summary or the
report named below.

| Date | Scope | Entry point |
|------|-------|-------------|
| 2025-12-15 | Security audit (monorepo predecessor repos) | [00_EXECUTIVE_SUMMARY.md](2025-12-15/00_EXECUTIVE_SUMMARY.md) |
| 2025-12-21 | Security audit, follow-up | [00_EXECUTIVE_SUMMARY.md](2025-12-21/00_EXECUTIVE_SUMMARY.md) |
| 2025-12-24 | Comprehensive code audit (optimisation, bugs, Workers, npm libraries) | [00-EXECUTIVE-SUMMARY.md](2025-12-24/00-EXECUTIVE-SUMMARY.md) |
| 2026-01-05 | Security audit, per project | [README.md](2026-01-05/README.md) |
| 2026-01-17 | i18n audit, web-app | [00-I18N-AUDIT-EXECUTIVE-SUMMARY.md](2026-01-17/00-I18N-AUDIT-EXECUTIVE-SUMMARY.md) |
| 2026-01-18 | CLAUDE.md audit | [claude-md-audit.md](2026-01-18/claude-md-audit.md) |
| 2026-01-19 | Deep-dive analysis | [DEEP_DIVE_REPORT.md](2026-01-19/DEEP_DIVE_REPORT.md) |
| 2026-01-20 | i18n audit, web-app (missing / unused keys, emoji) | [00-I18N-AUDIT-EXECUTIVE-SUMMARY.md](2026-01-20/00-I18N-AUDIT-EXECUTIVE-SUMMARY.md) |
| 2026-01-22 | Comprehensive audit of `@xivdyetools/core` 1.15.0 (security + deep dive) | [README.md](2026-01-22-core/README.md) |
| 2026-01-25 | Deep dive + security audit | [DEEP_DIVE_REPORT.md](2026-01-25/DEEP_DIVE_REPORT.md), [SECURITY_AUDIT_REPORT.md](2026-01-25/SECURITY_AUDIT_REPORT.md) |
| 2026-01-31 | i18n audit | [I18N_AUDIT_2026-01-31.md](2026-01-31/I18N_AUDIT_2026-01-31.md) |
| 2026-02-06 | Deep dive + security audit | [DEEP_DIVE_REPORT.md](2026-02-06/DEEP_DIVE_REPORT.md), [SECURITY_AUDIT_REPORT.md](2026-02-06/SECURITY_AUDIT_REPORT.md) |
| 2026-02-18 | Deep dive + security audit | [AUDIT_MANIFEST.md](2026-02-18/AUDIT_MANIFEST.md) |
| 2026-02-21 | Analysis + audit (core/types, Discord workers, presets-api/oauth) | [AUDIT_MANIFEST.md](2026-02-21/AUDIT_MANIFEST.md) |
| 2026-02-28 | Dead-code analysis | [DEAD_CODE_REPORT.md](2026-02-28/DEAD_CODE_REPORT.md) |
| 2026-03-18 | Deep-dive analysis | [DEEP_DIVE_REPORT.md](2026-03-18/DEEP_DIVE_REPORT.md) |
| 2026-04-07 | Combined deep dive + security audit | [DEEP_DIVE_REPORT.md](2026-04-07/DEEP_DIVE_REPORT.md) |
| 2026-04-28 | i18n audit (incl. font subsets) | [README.md](2026-04-28/README.md) |
| 2026-05-28 | Audit suite (deep dive, i18n, security) | [README.md](2026-05-28/README.md) |
| 2026-05-31 | Dead-code analysis | [DEAD_CODE_REPORT.md](2026-05-31/DEAD_CODE_REPORT.md) |
| 2026-07-18 | Deep-dive analysis + remediation plan (8 sprints, shipped July 2026) | [DEEP_DIVE_REPORT.md](2026-07-18/DEEP_DIVE_REPORT.md) |
| 2026-08-09 | Bot graphics redesign — design/implementation conformance | [findings.md](2026-08-09-bot-graphics-conformance/findings.md) |
| 2026-08-09 | Pre-release audit, Monorepo 2.0 / Web-App 5.0 | [README.md](2026-08-09-prerelease-monorepo-upgrade/README.md) |
| 2026-08-16 | Dead-code audit, web-app | [DEAD_CODE_REPORT.md](2026-08-16-web-app-dead-code/DEAD_CODE_REPORT.md) |
| 2026-08-18 | Dead-code audit, discord-worker + packages | [DEAD_CODE_REPORT.md](2026-08-18-discord-worker-dead-code/DEAD_CODE_REPORT.md) |
| 2026-08-18 | Dead-code audit, og-worker | [DEAD_CODE_REPORT.md](2026-08-18-og-worker-dead-code/DEAD_CODE_REPORT.md) |
| 2026-08-20 | i18n audit, discord-worker + dependent packages | [README.md](2026-08-20-discord-worker-i18n/README.md) |
| 2026-08-20 | i18n audit, og-worker | [I18N_AUDIT.md](2026-08-20-og-worker-i18n/I18N_AUDIT.md) |
| 2026-08-20 | i18n audit, web-app | [README.md](2026-08-20-web-app-i18n/README.md) |
| 2026-08-21 | Security audit, whole monorepo (36 findings, all remediated on the 5.0 branch) | [README.md](2026-08-21-security/README.md) |
| 2026-08-29 | Security audit, whole monorepo (31 findings, all remediated — PR #152) | [README.md](2026-08-29-security/README.md) |
| 2026-09-01 | Dead-code audit, whole monorepo (34 findings; led to the knip + reachability gates) | [README.md](2026-09-01-dead-code/README.md) |
| 2026-09-02 | Deep-dive analysis, whole monorepo (250 findings, 19 sprints — PR #158) | [README.md](2026-09-02-deep-dive/README.md) |
| 2026-09-03 | i18n audit, whole monorepo (17 findings — PR #162) | [README.md](2026-09-03-i18n/README.md) |
| 2026-09-05 | Documentation audit, whole repository (~600 findings across six sweeps; produced this index, the `docs/` reorganisation and the two docs CI gates) | [README.md](2026-09-05-documentation/README.md) |

## Conventions

- **Never edit a snapshot to make it current.** If a finding turns out to be wrong, the
  remediation record (a later audit, a CHANGELOG entry, or a PR) says so.
- New audits go in `YYYY-MM-DD-<topic>/` with a `README.md` and are added to the table above.
- The audit skills under `.claude/skills/` write here; their shared conventions are in
  `.claude/skills/audit-shared/`.
