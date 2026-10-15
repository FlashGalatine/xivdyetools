# Security review — Glamour Reader file imports (2026-10-15)

- **Status:** Draft; deferred at the maintainer's request. No implementation, release or deployment is authorized by this document.
- **Branch/commit:** Inspected `main` at `e4fd9fc0f5e45e398e14010e6894eed12d272dbc`; documentation branch `codex/glamour-import-audit`.
- **Scope:** `glamour-tool.ts` → shared `CharaFileCard` → `loadCharaFile` → core parsing/resolution → character session and display. The equipment API was inspected only for the data sent and its independent input guards.
- **Source versions:** web-app 5.15.4; core 5.12.0; api-worker 0.20.0. These are historical snapshot versions, not a current-version table.
- **Method:** Source review, bounded local probes, independent worker/verifier review, and focused test attempts. [Evidence and limitations](evidence/review-notes.md).
- **Totals:** 2 hardening findings: INFO × 1, LOW × 1. Neither is a demonstrated code-execution or arbitrary-file-upload exploit.
- **Sprint 0 — exploitable now:** None identified within this review's scope.

## Assessment

The drop zone accepts the browser's first dropped file and sends it to the loader without an extension check. The picker advertises `.chara,application/json`; this does not validate the file, and the drop handler does not consult it. That explains the visual acceptance followed by a parse error.

Both supplied `Trick & Treat Duo` `.pose` samples are JSON pose documents. The current parser rejects both because they contain no recognized character colour fields. A successful drop event therefore does not mean a successful character import.

The relevant threat is a user being induced to import a crafted file into their own browser. The reviewed path parses data locally, renders imported labels/errors as text, and sends only extracted equipment model numbers and facewear IDs for item lookup. An attacker can also call the public equipment API directly; an extension check in the web app cannot replace server-side validation.

The confirmed residual concern is unnecessary work on malformed data and oversized diagnostics inside the existing file-size ceiling. A roughly 20 KB deeply nested invalid field produces a `RangeError` during diagnostic serialization. The web loader catches it. This review did not demonstrate a tab hang, persistent denial of service, cross-user compromise or server compromise.

## Catalog

| ID | Title | Severity | Exposure | Deploy unit | Rotation |
| --- | --- | --- | --- | --- | --- |
| [FINDING-001](findings/FINDING-001.md) | Shared loader reads unsupported file types before rejecting their contents | INFO | INTERNET-UNAUTH; requires user import, browser-local effect | web-app | NONE |
| [FINDING-002](findings/FINDING-002.md) | Malformed fields have no local processing or diagnostic budgets | LOW | INTERNET-UNAUTH through web import; requires user action | core | NONE |

Exposure labels describe availability through the public web app, not a remotely triggerable server parser. Other core consumers were not assessed; do not extrapolate this impact rating to them without inspection.

## Positive controls

- The loader enforces **20 MiB before `file.text()`**. It does not read an arbitrarily large file first and check afterward.
- The parser uses `JSON.parse`, checks the top-level object, and requires a recognized colour key. Both supplied pose-only samples are rejected.
- Parsing constructs selected output fields rather than merging arbitrary input properties. Enum lookups use own-property checks; a bounded prototype-pollution probe left global prototypes unchanged.
- Imported names, producer labels, filenames and failure messages use `textContent` in the inspected UI paths.
- Failed parsing does not publish a new character session; existing session state is preserved.
- Equipment requests contain extracted model numbers and facewear IDs, not the original file, nickname or image data. Enabled telemetry separately records an allowlisted parse outcome and producer category.
- The equipment API independently validates slots, duplicates, item count and uint16 values, and enforces an **8 KiB streamed request-body cap**.

## Rejected suspicions and compatibility constraints

- **The supplied poses become valid characters:** rejected by direct source probes.
- **A successful drop executes the file or uploads it wholesale:** no such path was found in the inspected code.
- **HTML in imported labels is directly interpreted as markup:** inspected labels and error messages use text rendering.
- **Extension or MIME checking alone would secure imports:** filenames can be changed and MIME metadata is not trustworthy. Content and server checks remain necessary.
- **Require an exact producer declaration:** unsuitable; key-based parsing intentionally supports different Anamnesis, Ktisis and Brio exports.
- **An all-empty parsed character is automatically a security defect:** not established. `{"Skintone":null}` currently yields empty slots; decide any stricter validity policy separately against sparse legitimate exports.

## Deferred work and acceptance criteria

### 1. Early rejection in the shared web loader — FINDING-001

- Decide whether `.json` imports are intentionally supported. The current picker includes `application/json`; do not silently remove a supported format. The default proposal is `.chara` only, case-insensitive.
- Validate the filename extension before reading, for both Choose file and drag-and-drop. Return a distinct unsupported-type result and show a localized explanation in all six locales.
- Keep the size and content checks. Renaming a pose to `.chara` must still fail content validation.
- Test unsupported `.pose`, uppercase `.CHARA`, misleading suffixes, empty MIME metadata on a valid `.chara`, and both UI entry points. Assert an unsupported file's `text()` is never called and an existing session remains intact.
- Cover both Glamour Reader and Swatch Matcher because the file card and loader are shared.

### 2. Bounded parsing and diagnostics in core — FINDING-002

- Replace whole-value serialization in error messages with a bounded, depth-safe description. Errors must remain useful without echoing arbitrary input at full length.
- Bound float-colour field length and component processing before splitting/mapping all segments. Bound retained/displayed metadata where justified by real exports.
- Evaluate whole-document size/depth limits at the appropriate boundary. A depth check after `JSON.parse` does not prevent parsing allocation; do not claim that it does. Preserve legitimate embedded-image exports even though image data is not used by this feature.
- Add small deterministic tests for nested malformed fields, excessive comma-separated components, long metadata and bounded errors. Avoid stress tests large enough to destabilize developer machines.
- Preserve legitimate Anamnesis/Ktisis/Brio fixtures, sparse-file behavior unless deliberately changed, prototype defenses, plain-text display, and API numeric-only requests.

### 3. Verify before closing

- Recheck these findings against the then-current branch; line numbers and implementations may have changed.
- Install/build dependencies in the implementation worktree, then rerun focused parser, loader, file-card and API boundary suites. Resolve the recorded setup failures before claiming a clean test run.
- Run the required checks for changed units and affected consumers, including locale checks for new UI text. Apply release/version/changelog requirements when implementation scope is known.
- Close each finding only with passing regression evidence and a recorded implementation commit. No fix work has begun here.

## Pending rotation

None identified; no exposed credential was found in this focused path review.

## Pending policy edits

None proposed by these two findings. Existing character-file privacy wording was checked for the reviewed flow; this is not a certification of all policies, translations or data flows. Keep raw file data and unrestricted metadata out of telemetry while fixing these issues.

## Remediation status

| ID | Status | Commit |
| --- | --- | --- |
| FINDING-001 | OPEN — deferred; implementation not started | — |
| FINDING-002 | OPEN — deferred; implementation not started | — |

## Next steps

When this work is scheduled, use the catalog and acceptance criteria to prepare the scoped remediation plan and confirm any format-compatibility decisions. This document creates no reminder, deadline or recurring task.

## External guidance

- [MDN: `accept` is a file-picker hint, not validation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/accept).
- [OWASP: layered file validation and resource limits](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). Server-upload/storage controls apply only where a file is actually uploaded; this path reads the file locally.
