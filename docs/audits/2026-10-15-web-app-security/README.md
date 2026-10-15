# Glamour Reader import security review — 2026-10-15

Focused follow-up to an accidental `.pose` drop into the Glamour Reader. Two deferred hardening items are recorded: one informational file-type rejection gap and one low-severity malformed-input handling issue. No exploitable-now issue was demonstrated, and no application source files were modified by the audit.

- **Status:** Draft for later scheduling; implementation has not started.
- **Source snapshot:** `main` / `origin/main` at `e4fd9fc0f5e45e398e14010e6894eed12d272dbc`.
- **Document branch:** `codex/glamour-import-audit`.
- **Scope:** Web character-file ingestion and display, core character parser, and the equipment API's request boundary. This is not a full application security or privacy audit.
- **Method:** Source inspection, bounded parser probes, independent review, and attempted focused tests; see the evidence notes for limitations.

| File | Purpose |
| --- | --- |
| [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) | Assessment, catalog, deferred work and acceptance criteria |
| [findings/](findings/) | Individual findings and their status |
| [evidence/review-notes.md](evidence/review-notes.md) | Source references, verification history and test limitations |
| [evidence/scripts/probe-chara-import.mjs](evidence/scripts/probe-chara-import.mjs) | Small, reusable parser probes; no network or writes |
| [evidence/parser-probes.json](evidence/parser-probes.json) | Captured results from the supplied files and synthetic cases |

## Top items

1. **FINDING-001 (INFO)** — web-app: reject unsupported file extensions before reading, using the shared loader for both import controls and both tools.
2. **FINDING-002 (LOW)** — core: bound malformed-field processing and diagnostic output; a small nested input currently produces a caught stack error.
