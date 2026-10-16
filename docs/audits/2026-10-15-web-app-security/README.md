# Glamour Reader import security review — web and Discord (2026-10-15)

Focused follow-up to an accidental `.pose` drop into the Glamour Reader, extended at the maintainer's request to Discord `/glamour` and its shared `/swatch` import path. Three deferred hardening items are recorded: two informational file-type rejection gaps and one low-severity shared-parser issue, now confirmed reachable in the Discord worker too. No exploitable-now issue was demonstrated, and no application source files were modified by the audit.

- **Status:** Remediated 2026-10-16. FINDING-002 by PR #315 (core 5.13.0); FINDING-001, FINDING-003 and the 8 KiB cap by PR #316 (core 5.14.0, web-app 5.15.5, bot-logic 4.10.0, discord-worker 5.8.15). See the report's [Remediation status](SECURITY_AUDIT_REPORT.md#remediation-status).
- **Source snapshot:** `main` / `origin/main` at `e4fd9fc0f5e45e398e14010e6894eed12d272dbc`.
- **Document branch:** `codex/glamour-import-audit`.
- **Scope:** Web character-file ingestion/display, Discord attachment download and command/output boundaries, shared core/bot-logic parsing, and the equipment API's request boundary. This is not a full application security or privacy audit.
- **Method:** Source inspection, bounded probes, independent review, and focused tests. The Discord follow-up passed 16 mocked probes and 215 tests after installing/building dependencies in the document worktree; the initial web review's limitations remain recorded.
- **Follow-up baseline:** Audit commit `c8cba17b`; application source remains the snapshot above. The folder keeps its original name to preserve finding links.
- **Size-policy follow-up:** At the maintainer's request, evaluate a dedicated 8 KiB (8,192-byte) `.chara` ceiling. Fresh measurement: 1,092 of 1,093 supplied corpus files fit; the only larger file carries nonempty `Base64Image`. This is a proposed resource limit, not a content-safety guarantee, and not a fix for the stack overflow in FINDING-002.
- **Pre-merge review (2026-10-16):** Claims re-verified against the unchanged snapshot. Line references, a missed third interpolation site, the web toast path and the cap's limits were corrected, and the maintainer's decisions recorded (`.chara` only; no `Base64Image` rule; 8,192 bytes; core diagnostics first). See the report's [Pre-merge review](SECURITY_AUDIT_REPORT.md#pre-merge-review-2026-10-16).

| File | Purpose |
| --- | --- |
| [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) | Assessment, catalog, deferred work and acceptance criteria |
| [findings/](findings/) | Individual findings and their status |
| [evidence/review-notes.md](evidence/review-notes.md) | Source references, verification history and test limitations |
| [evidence/scripts/probe-chara-import.mjs](evidence/scripts/probe-chara-import.mjs) | Small, reusable parser probes; no network or writes |
| [evidence/parser-probes.json](evidence/parser-probes.json) | Captured results from the supplied files and synthetic cases |
| [evidence/discord-review-notes.md](evidence/discord-review-notes.md) | Discord comparison, source map, test results and limits |
| [evidence/scripts/probe-discord-chara-import.mjs](evidence/scripts/probe-discord-chara-import.mjs) | Local attachment/command probes with all external calls mocked |
| [evidence/discord-parser-probes.json](evidence/discord-parser-probes.json) | Captured Discord helper and command results |
| [evidence/discord-focused-tests.txt](evidence/discord-focused-tests.txt) | 54 passing attachment/adapter tests |
| [evidence/bot-logic-focused-tests.txt](evidence/bot-logic-focused-tests.txt) | 161 passing command, identity and failure-classification tests |
| [evidence/size-cap-review-notes.md](evidence/size-cap-review-notes.md) | 8 KiB compatibility evidence, security limits and proposed implementation boundaries |
| [evidence/scripts/profile-chara-size-policy.mjs](evidence/scripts/profile-chara-size-policy.mjs) | Read-only corpus byte measurements and small policy probes |
| [evidence/chara-size-profile.json](evidence/chara-size-profile.json) | Captured statistics for 1,093 files and nine policy probes; no raw file payloads |

## Top items

1. **FINDING-001 (INFO)** — web-app: reject unsupported file extensions before reading, using the shared loader for both import controls and both tools.
2. **FINDING-002 (LOW)** — core: bound malformed-field processing and diagnostic output; a small nested input produces a caught stack error in the browser and in both Discord commands. Ship this shared fix first, then the proposed 8 KiB import ceilings; the cap alone does not remove the stack error.
3. **FINDING-003 (INFO)** — discord-worker: refuse unsupported attachment extensions before downloading; `/glamour` and `/swatch` share the same guard.
