# FINDING-030: Repository security settings: SHA pinning not enforced, all actions allowed, Dependabot alerts and security updates off, no code scanning; ci.yml's --prod --audit-level high job is the only advisory watcher
**Severity:** INFO · **Exposure:** LOCAL · **Deploy unit:** CI · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-693
**Related:** 2026-08-29 INF-04 (audit-level residual); docs/operations/OPEN_ITEMS.md §1

## Location
- `.github/workflows/ci.yml:73`: the nightly/CI `audit` job runs `pnpm audit --prod --audit-level high`. It is the only in-repo advisory check.
- GitHub repo settings (actions/permissions, dependabot, code-scanning): `sha_pinning_required` false, `allowed_actions` all, Dependabot alerts and security updates disabled, no CodeQL analysis.
- `docs/operations/OPEN_ITEMS.md:26`: 'Dependabot alerts + security updates: ON' is still an unchecked item (found off on 2026-09-05).

## Evidence
- `ci.yml:62-73`: the `audit:` job, named 'Security audit (production dependencies)', ends with `- run: pnpm audit --prod --audit-level high`. Dev dependencies and moderate advisories never fail it.
- `evidence/gh-settings-2026-10-03.txt` (coordinator, read-only, 2026-10-03): `actions/permissions` → `allowed_actions: all`, `sha_pinning_required: false`; `vulnerability-alerts` → 404 "Vulnerability alerts are disabled"; `code-scanning/alerts` → 404 "no analysis found".
- Mitigating context: all 56 `uses:` lines are 40-hex SHA-pinned today, and `dependabot.yml` bumps both the npm and github-actions ecosystems monthly. This is a future-regression and detection gap, not an exploitable issue now. The `--audit-level high` part repeats 2026-08-29 INF-04.

## Fix
- Settings → Actions: turn on `sha_pinning_required` (or restrict `allowed_actions` to `selected` with the 6 actions in use), so a future unpinned `uses:` fails.
- Turn on Dependabot alerts and security updates (closes OPEN_ITEMS.md:26). Consider CodeQL default setup for the TS sources.
- Optionally add a non-blocking nightly `pnpm audit --audit-level moderate` (no `--prod`) step, so dev and moderate advisories are reported.

## Status
OPEN — the in-repo part (non-blocking full-tree audit step) is in `3a158847` (branch `fix/security-2026-10-03-sprint11`; PR #233, draft). Settings (maintainer): turn on `sha_pinning_required`, Dependabot alerts and security updates; CodeQL default setup is optional. Re-read with `gh api`.
