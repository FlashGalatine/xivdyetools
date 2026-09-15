# Candidate verification

Coordinator source checks were cross-checked by an independent Sol reviewer for the main candidates. Findings are at `0332fcc5768a4477301ed5b15590eee16a772f87`.

| Claim | Decision | Basis |
|---|---|---|
| Discord shared body cap runs after full buffering | CONFIRMED → FINDING-001, MEDIUM / INTERNET-UNAUTH | Public callers lack upstream stream cap; source plus bounded 1 MiB local stream probe |
| Stale preview approval approves replacement image | CONFIRMED → FINDING-002, MEDIUM / INTERNET-AUTH | Embedded image key is not carried by action; source plus actual UPDATE strings in local SQLite |
| GitHub webhook independently buffers pre-HMAC | CONFIRMED → FINDING-003, MEDIUM / INTERNET-UNAUTH | Coordinator and bot reviewer checked route's own Content-Length/text/size/HMAC ordering |
| Owner status update overwrites newer moderator state | CONFIRMED → FINDING-004, LOW / INTERNET-AUTH | Stale status drives a write with only ID predicate; limited to pending, not approval |
| Moderator revert overrides newer decision | CONFIRMED → FINDING-005, LOW / INTERNET-AUTH | Earlier snapshot plus unconditional approved write; privileged concurrent workflow |
| OG logs raw crawler UA/share URL | CONFIRMED → FINDING-006, LOW / INTERNET-UNAUTH | Explicit info emission outside minimized AE path; retention remains unverified. Final review narrows policy basis to disclosure/minimization: usage-analytics promises do not necessarily govern operational logs, and crawler UA is not necessarily an end user's UA |
| API KV fallback causes current production IP collection | REJECTED as live finding | Both tracked environments configure native limiter bindings; operational disclosure/misconfiguration caveat |
| Revocation fails open on KV outage | REJECTED as new finding | Explicit accepted availability choice in OAuth README; no refresh, one-hour sessions |
| Discord logs a pseudonymous user ID | REJECTED as automatic privacy violation | Policy lists this field and purposes; correct the overly broad no-identity-log assertion in initial reviewer prose |

## Verification commands

- Stream probe: `node node_modules/tsx/dist/cli.mjs docs/audits/2026-09-15-security/evidence/scripts/probe-auth-stream.ts`.
- Preview probe: `python docs/audits/2026-09-15-security/evidence/scripts/probe-preview-approval.py`.
- Auth: `pnpm --filter @xivdyetools/auth exec vitest run` (122 passed).
- Logger: `pnpm --filter @xivdyetools/logger exec vitest run` (251 passed).
- Further focused suites and their initial failure details: [security-tests-summary.md](security-tests-summary.md).

Source findings were discovered with tracked-file searches (`git grep`, or `git ls-files`-based scripts); bulk sweeps and commands live in `scripts/`. The untracked audit artifacts themselves were read directly. No attack traffic was sent to production.
