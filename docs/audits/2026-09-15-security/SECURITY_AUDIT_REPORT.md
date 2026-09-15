# Security audit — xivdyetools (2026-09-15)

- **Branch/commit:** `main` @ `0332fcc5768a4477301ed5b15590eee16a772f87`.
- **Scope:** all 9 apps, 8 packages, CI/configuration, production dependencies, tracked secret patterns, and privacy-sensitive data flows.
- **Method:** tracked-file sweeps, per-unit security-boundary reviews, coordinator and independent candidate verification, bounded local reproductions, existing security tests, and a read-only check of GitHub production deployment restrictions.
- **Totals:** **6 findings: 3 MEDIUM, 3 LOW; no HIGH or CRITICAL confirmed.** No evidence of active exploitation was sought or established.
- **Sprint 0 priorities:** FINDING-001, FINDING-002, FINDING-003 — reachable issues to remediate individually before the normal backlog. This is priority classification, not a claim of a current attack.
- **Source changes:** none. Audit artifacts are the only new tracked-scope content. Ignored dependency build outputs were refreshed to run current-source tests.

## Severity × exposure

| Severity | INTERNET-UNAUTH | INTERNET-AUTH | INTERNAL | LOCAL | Total |
|---|---:|---:|---:|---:|---:|
| CRITICAL | 0 | 0 | 0 | 0 | 0 |
| HIGH | 0 | 0 | 0 | 0 | 0 |
| MEDIUM | 2 | 1 | 0 | 0 | 3 |
| LOW | 1 | 2 | 0 | 0 | 3 |
| Total | 3 | 3 | 0 | 0 | 6 |

## Catalog

| ID | Title | Sev | Exposure | Deploy unit | Rotation |
|---|---|---|---|---|---|
| [FINDING-001](findings/FINDING-001.md) | Discord verifier buffers full body before enforcing cap | MEDIUM | INTERNET-UNAUTH | auth; consumed by both Discord bots | NONE |
| [FINDING-002](findings/FINDING-002.md) | Stale preview approval can approve a replacement image | MEDIUM | INTERNET-AUTH | presets-api; discord-worker contract follow-up | NONE |
| [FINDING-003](findings/FINDING-003.md) | GitHub webhook independently buffers pre-authentication body | MEDIUM | INTERNET-UNAUTH | discord-worker | NONE |
| [FINDING-004](findings/FINDING-004.md) | Owner edit can overwrite a newer moderation state | LOW | INTERNET-AUTH | presets-api | NONE |
| [FINDING-005](findings/FINDING-005.md) | Stale moderator revert can undo a newer hide/rejection | LOW | INTERNET-AUTH | presets-api | NONE |
| [FINDING-006](findings/FINDING-006.md) | OG metadata logs emit raw UA and complete share URLs | LOW | INTERNET-UNAUTH | og-worker | NONE |

The image approval flaw is a **stale-action issue**: a sequential replacement between review and click is enough; fixing only overlapping database requests is insufficient. The two other preset findings concern distinct concurrent owner-edit and moderator-revert operations, with different authority and publication consequences.

The OG log finding is a LOW minimization/disclosure issue. Its log emission is confirmed, but retention is unverified; crawler User-Agent usually describes social-platform infrastructure. The opt-in analytics policy is not asserted to govern all operational logs.

## Evidence and validation

| Check | Result / scope |
|---|---|
| Production dependency advisories | `pnpm audit --prod --json` and high-severity summary: **0 known advisories**, 27 production dependencies; both exited 0 |
| Automated secrets: tree + history | **NOT RUN: Gitleaks binary unavailable.** Artifacts explicitly record BLOCKED; this audit does not claim a clean historical secret scan |
| Manual tracked secret patterns | 172 redacted matches; classification documented in [current secret-hit review](evidence/review-secret-hits.md); pattern matching is not a substitute for a secret scanner |
| PII inventory | 929 sink lines and 1,854 source lines reconciled through unit reviews and a cross-unit high-signal sweep; see raw inventories and per-unit coverage/limits |
| Local bounded reproductions | Full 1 MiB stream consumed before 100 KB Discord cap; actual preview UPDATE strings approved replacement K2 after review of K1; no production traffic |
| Auth and logger tests | 122 + 251 passed; see [verification](evidence/verification.md) |
| Further security tests | **957 total tests passed** across auth/logger, targeted presets/image/API tests, and full OAuth with its coverage gate; all final commands exit 0. Preserved initial stale-build/partial-coverage failures in [test summary](evidence/security-tests-summary.md) |
| Production deployment restriction | Live GitHub environment read: custom branch policy permits **only main**; both API reads exited 0 |

## Positive controls

- OAuth uses signed expiring state and PKCE, exact redirect allowlists, one-hour JWTs with HS256/issuer checks, and shared revocation. `/auth/refresh` is removed; missing required production security bindings refuse service.
- Both bots verify Discord signatures before parsing and check timestamp freshness. Moderator gates cover commands, autocomplete, buttons and modals; bot-to-API calls use v2 request-bound signatures and nonces.
- Presets routes enforce ownership/visibility, ban checks and moderator authority. D1 values are bound; storage keys are server-generated; uploads have type, byte and decoder-dimension gates. Perspective failure queues content and `doNotStore` is set.
- Image-worker is configured for service bindings only, with no public routes or preview URLs. Both decode paths check dimensions before Photon decoding; URL extraction restricts hosts and redirects, bytes and fetch duration.
- Public API and OG rendering validate inputs, canonicalize cache keys and escape HTML/XML; outbound API targets are fixed/allowlisted. User-specific/auth responses use no-store controls.
- Web telemetry is default-off, honors GPC and cross-tab opt-out, carries no persistent client identifier, and passes an enum/DB allowlist on the server. The OG finding concerns a separate explicit log, not Analytics Engine fields.
- Web CSP restricts scripts to self; reviewed dynamic HTML sinks escape user values. OAuth cleanup clears tokens and related state; `.chara` names are excluded from cards and telemetry; image data remains browser-local except the explicit community-preview upload.
- Shared logger handles nested secrets, aliases and cycles; User-Agent logging defaults off. Rate-limit failure logs use bucket class rather than raw client keys. Accepted rate-limit trade-offs are preserved.
- All 14 workflows use SHA-pinned actions and least-privilege default token permissions. Production environment branch policy is verified live; publishing uses OIDC, and beta credentials are separate. Dependency age/script policies and recurring audit gates are present.

## Rejected suspicions and residual risks

- **Revocation fails open during KV outages:** explicitly documented in `apps/oauth/README.md:56` and tested. A copied revoked token may work until its original expiry during an outage; this accepted availability trade-off is not a new finding.
- **KV rate-limit races/default fail-open:** accepted in `docs/architecture/security-trade-offs.md`; active client throttling normally uses native bindings. Telemetry specifically requests fail-closed handling.
- **API IP-keyed KV fallback as a current privacy leak:** both configured environments supply native limiter bindings. The fallback remains a misconfiguration/disclosure consideration, not proven normal-production collection.
- **Discord pseudonymous IDs in logs:** this field and its functional uses are listed in the bot policy. Mere ID emission is not automatically a new privacy finding; the initial blanket assertion that bot logs contain no raw identity was corrected. No concrete forbidden username/guild/channel/option-text sink was verified by the additional sweep.
- **Pending preview objects are directly readable by key:** current design explicitly controls publication of their URLs rather than object secrecy. FINDING-002 instead bypasses the review needed for public advertisement.
- **SQL injection, arbitrary outbound host selection, JWT algorithm confusion, hostile SVG text and telemetry schema/prototype injection:** investigated at the listed boundaries without a confirmed reachable exploit. This is not a proof that every line is vulnerability-free.
- **Manual dispatch bypasses production branch filters:** the live `production` environment permits only `main`, closing the apparent source-only gap.

## Limits

This is a source/configuration audit with local tests, not a penetration test or exhaustive formal verification. No live Worker requests, load tests, database records, personal data or credentials were inspected. Cloudflare token scopes, WAF controls, migrations, deployed bundle parity and log retention were not verified. Existing package tests and focused app suites cover specific controls; no whole-monorepo build/lint/test gate or browser end-to-end suite was run. Automated tree/history secret scanning remains outstanding.

## Pending rotation

No credential exposure requiring rotation was confirmed. The incomplete historical secret scan limits that conclusion.

| ID | Credential | Rotated? | Revoked? |
|---|---|---|---|
| None confirmed | — | N/A | N/A |

## Recommendations

1. Add stream-consumption assertions: rejecting after reading the entire body is not a memory cap.
2. Bind moderation actions to immutable content revisions and compare them in the final database write.
3. Test privacy requirements against emitted logs as well as analytics payloads.
4. Build workspace dependencies in topological order before direct app tests, so stale `dist` output cannot distort audit results.
5. Complete the configured Gitleaks tree/history scan when its binary is available; retain this audit's blocked status until fresh results exist.

## Remediation status

**Implementation follow-up (2026-09-15):** all six fixes passed local regression, unit and whole-graph checks; publication/deployment acceptance remains pending. See the [implementation report](IMPLEMENTATION_REPORT.md). Fresh Gitleaks tree/history scans also closed the original unavailable-tool gap. The audit evidence and limitations above describe the original audit run.

| ID | Status | Commit |
|---|---|---|
| FINDING-001 | OPEN — fixed locally; deploy pending | `ef555e57`, `0a357852`, `205f0be6` |
| FINDING-002 | OPEN — fixed locally; deploy pending | `3c07b6b9`, `247d368d`, `0b5d814c` |
| FINDING-003 | OPEN — fixed locally; deploy pending | `205f0be6` |
| FINDING-004 | OPEN — fixed locally; deploy pending | `74114ebf` |
| FINDING-005 | OPEN — fixed locally; deploy pending | `6b7d1b3c` |
| FINDING-006 | OPEN — fixed locally; deploy pending | `3095b8ce` |

## Next steps

Follow [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md). Fix implementation is a separate next step; no fix, rotation, commit, push or deployment was performed by this audit.
