# Security review — Glamour Reader file imports, web and Discord (2026-10-15)

- **Status:** Draft; deferred at the maintainer's request. No implementation, release or deployment is authorized by this document.
- **Branch/commit:** Inspected `main` at `e4fd9fc0f5e45e398e14010e6894eed12d272dbc`; documentation branch `codex/glamour-import-audit`.
- **Scope:** Web `glamour-tool.ts` → shared `CharaFileCard` → `loadCharaFile` → core parsing/resolution → session/display; Discord `/glamour` and `/swatch` → shared attachment guards → bot-logic/core → public response. The equipment API was inspected only for the data sent and its independent input guards.
- **Source versions:** web-app 5.15.4; core 5.12.0; api-worker 0.20.0; discord-worker 5.8.14; bot-logic 4.9.0. These are historical snapshot versions, not a current-version table.
- **Method:** Source review, bounded local probes, independent worker/verifier review, and focused tests. [Initial web evidence](evidence/review-notes.md); [Discord follow-up](evidence/discord-review-notes.md). The follow-up begins at audit commit `c8cba17b` with unchanged application source.
- **Totals:** 3 hardening findings: INFO × 2, LOW × 1. None is a demonstrated code-execution or arbitrary-file-upload exploit.
- **Sprint 0 — exploitable now:** None identified within this review's scope.

## Assessment

The drop zone accepts the browser's first dropped file and sends it to the loader without an extension check. The picker advertises `.chara,application/json`; this does not validate the file, and the drop handler does not consult it. That explains the visual acceptance followed by a parse error.

Both supplied `Trick & Treat Duo` `.pose` samples are JSON pose documents. The current parser rejects both because they contain no recognized character colour fields. A successful drop event therefore does not mean a successful character import.

For the web app, the relevant threat is a user being induced to import a crafted file into their own browser. That path parses data locally, renders imported labels/errors as text, and sends only extracted equipment model numbers and facewear IDs for item lookup. An attacker can also call the public equipment API directly; an extension check in the web app cannot replace server-side validation.

The confirmed residual concern is unnecessary work on malformed data and oversized diagnostics inside the existing file-size ceiling. A roughly 20 KB deeply nested invalid field produces a `RangeError` during diagnostic serialization. The web loader catches it. This review did not demonstrate a tab hang, persistent denial of service, cross-user compromise or server compromise.

### Discord follow-up

Discord is similarly permissive at the file-type boundary: its shared attachment helper checks presence, size and URL, but never the filename extension or MIME metadata. `/glamour` and `/swatch` therefore download an under-limit `.pose` from Discord before the parser refuses it. Local probes of the actual helper and command logic confirmed this for both supplied files, including copies renamed `.chara`.

The exposure differs materially from the web app: the user uploads to Discord, and the worker downloads and parses the file on Cloudflare. A command user can supply crafted input to this server-side parser. Interactions require Discord's valid signature, and commands pass a per-user rate check before dispatch (15/minute for these commands under the reviewed configuration). Download controls are stronger than the web file cap: **1 MiB counted from the response stream**, an exact HTTPS Discord-CDN host allowlist, a 10-second timeout and no redirect following.

The same 20,014-byte nested input is below that cap and reaches the shared parser. Both command functions catch the exception, return `PARSE_FAILED` with a fixed localized explanation, and log only `RangeError`; neither calls the equipment resolver. Catching the error contains the failure but cannot undo CPU or allocation already spent. FINDING-002 therefore now includes authenticated server-side exposure, with LOW severity retained on the demonstrated bounded/caught evidence. This is a reason to prioritize shared-parser hardening when scheduled, not evidence of a live service outage.

| Boundary | Web app | Discord `/glamour` and `/swatch` |
| --- | --- | --- |
| Unsupported extension rejected early | No | No |
| File parsing location | User's browser | Cloudflare worker after Discord upload |
| File ceiling | 20 MiB before local read | 1 MiB metadata check plus authoritative streamed download cap |
| Supplied pose-only samples | Rejected by parser | Rejected by parser; fixed command error |
| Nested malformed field | Caught loader failure | Caught `PARSE_FAILED`; no equipment lookup |
| Failure text | Parser reason displayed as plain text | Fixed localized explanation; 1,024-character sanitized adapter limit |
| Character name/producer display | Plain-text labels | Nickname omitted; only fixed known producer tokens displayed |

### Proposed 8 KiB ceiling

The maintainer requested a smaller character-file ceiling to exclude large image-bearing exports. A fresh, read-only profile of the supplied `CharaSamples` folder found **1,093 distinct files**, all accepted by the current core parser. The **1,092 files without nonempty `Base64Image` are 1,837–2,777 bytes**. The sole larger file is **3,128,021 bytes** and declares `Anamnesis Character File`, with a 2,898,324-character `Base64Image` value. Its image data was not decoded or authenticated. Discord's existing 1 MiB cap already refuses that particular file; the web cap admits it to parsing.

Recommend **8 KiB = 8,192 bytes for the complete `.chara` file**, enforced before the web read and against actual Discord download bytes. A literal decimal 8 KB (8,000 bytes) rejects the same single corpus file; the proposed exact boundary is 8,192 bytes so implementation and translated messages agree. This corpus supports that compatibility choice, not a guarantee that every legitimate or future export fits. Extra whitespace and metadata count toward the limit too.

Size does **not** prove that an image claim is authentic or absent. A 94-byte synthetic file with non-image text in `Base64Image` passes both the proposed size check and the current parser. The parser reads JSON but omits that field from its output; it does not decode or render its contents. If the intended policy is to reject every file carrying embedded image data, add a separate rule rejecting nonempty `Base64Image` strings and non-string/non-null values, while accepting missing/null/empty placeholders. This is a proposed companion decision for remediation, not a demonstrated image-execution vulnerability. Producer declarations and apparent age are not security checks.

The lower ceiling would reject the recorded 20,014-byte nested diagnostic case before parsing, but smaller malformed inputs still require field/depth/diagnostic bounds. [Measurements, nine probes and verification](evidence/size-cap-review-notes.md) document the recommendation. Current application limits remain the values in the comparison table; no runtime behavior changed.

## Catalog

| ID | Title | Severity | Exposure | Deploy unit | Rotation |
| --- | --- | --- | --- | --- | --- |
| [FINDING-001](findings/FINDING-001.md) | Shared loader reads unsupported file types before rejecting their contents | INFO | INTERNET-UNAUTH; requires user import, browser-local effect | web-app | NONE |
| [FINDING-002](findings/FINDING-002.md) | Malformed fields have no processing or diagnostic budgets | LOW | INTERNET-UNAUTH via user-assisted web import; INTERNET-AUTH via Discord commands | core | NONE |
| [FINDING-003](findings/FINDING-003.md) | Discord attachment helper downloads unsupported file types | INFO | INTERNET-AUTH; Discord command user, signed interaction | discord-worker | NONE |

The original web exposure describes user-assisted local parsing. Discord adds a server parser reachable by a command user through signed interactions; the signature authenticates Discord's request, not the safety of the attached file. Other core consumers were not assessed; do not extrapolate this impact rating to them without inspection. Per-user limits are a mitigation, not a global workload guarantee or a claim that limiter failures are fail-closed.

## Positive controls

- The loader enforces **20 MiB before `file.text()`**. It does not read an arbitrarily large file first and check afterward.
- The parser uses `JSON.parse`, checks the top-level object, and requires a recognized colour key. Both supplied pose-only samples are rejected.
- Parsing constructs selected output fields rather than merging arbitrary input properties. Enum lookups use own-property checks; a bounded prototype-pollution probe left global prototypes unchanged.
- Imported names, producer labels, filenames and failure messages use `textContent` in the inspected UI paths.
- Failed parsing does not publish a new character session; existing session state is preserved.
- Equipment requests contain extracted model numbers and facewear IDs, not the original file, nickname or image data. Enabled telemetry separately records an allowlisted parse outcome and producer category.
- The equipment API independently validates slots, duplicates, item count and uint16 values, and enforces an **8 KiB streamed request-body cap**.
- Discord attachment downloads use the 1 MiB streamed cap, exact HTTPS CDN host allowlist, timeout and manual redirect mode; a redirect response is refused.
- Both bot command functions return fixed localized parse errors and log only exception class/code. Adapters additionally sanitize/cap error text and default outbound messages to no mentions.
- Bot cards omit nicknames and filenames and display only known producer tokens. The inspected adapters do not serialize the internal parsed character into a Discord response.

## Rejected suspicions and compatibility constraints

- **The supplied poses become valid characters:** rejected by direct source probes.
- **A successful web drop executes the file or uploads it wholesale:** no such path was found in the inspected web code. Discord's separate flow does upload the file to Discord and download it to the worker.
- **HTML in imported labels is directly interpreted as markup:** inspected labels and error messages use text rendering.
- **Extension or MIME checking alone would secure imports:** filenames can be changed and MIME metadata is not trustworthy. Content and server checks remain necessary.
- **Require an exact producer declaration:** unsuitable; key-based parsing intentionally supports different Anamnesis, Ktisis and Brio exports.
- **An all-empty parsed character is automatically a security defect:** not established. `{"Skintone":null}` currently yields empty slots; decide any stricter validity policy separately against sparse legitimate exports.
- **The Discord signature makes a user's attachment trusted:** false; valid command users can still supply malformed files. Content/resource guards remain necessary.
- **Discord publishes the parser's quoted field values or stack error:** direct command probes returned fixed localized text and short class/code logs, with zero equipment calls after parse failure.
- **An 8 KiB file cannot carry spoofed image data:** false; small `Base64Image` values pass a size check. Size restriction and any explicit no-image policy are distinct controls.

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
- Adopt the proposed 8 KiB character-import ceilings described below and evaluate depth limits at the appropriate boundary. A depth check after `JSON.parse` does not prevent parsing allocation; do not claim that it does. At the maintainer's request, preserving large embedded-image exports is no longer a remediation requirement; record the deliberate compatibility change and explain the refusal.
- Add small deterministic tests for nested malformed fields, excessive comma-separated components, long metadata and bounded errors. Avoid stress tests large enough to destabilize developer machines.
- Preserve legitimate Anamnesis/Ktisis/Brio fixtures, sparse-file behavior unless deliberately changed, prototype defenses, plain-text display, and API numeric-only requests.
- Regress both bot command functions against malformed fields that fit the new cap; oversized inputs must be rejected before parsing. Assert fixed localized errors, bounded class/code-only logs, no gear-resolution call and no successful render result after rejection. Preserve the worker's independent streamed-byte enforcement using the proposed new limit.
- Schedule this shared-parser work ahead of the early-extension UX improvements: it protects both browser and server consumers. Reassess severity if realistic Worker CPU/memory testing demonstrates a wider effect.

### 3. Early rejection in the shared Discord attachment helper — FINDING-003

- Apply the agreed supported-extension policy to `attachment.filename` before deferring/downloading, with a localized ephemeral refusal for both `/glamour` and `/swatch`.
- Treat MIME metadata as advisory; do not reject a legitimate `.chara` solely because Discord reports a generic or absent MIME type. Do not rely on the CDN URL suffix as the file-type decision.
- Test `.pose`, `.png`, misleading suffixes, uppercase `.CHARA`, renamed pose contents and missing MIME metadata. Assert refused filenames cause no fetch, API lookup or render work.
- Preserve the host/scheme allowlist, timeout, redirect refusal, stream cap, failure classification, name omission and no-mention output defaults. Early worker rejection cannot undo the user's existing upload to Discord.

### 4. Character-file ceiling and image-field policy — supports FINDING-002

- Use a dedicated `.chara` limit of **8,192 bytes**, applied to the complete original file without stripping fields or compacting it to gain admission. Accept exactly 8,192 bytes at the size gate and reject 8,193; passing the gate still requires valid content.
- Web: enforce before `file.text()` in the shared loader for both tools. Do not lower the shared `MAX_USER_FILE_BYTES` constant, which also serves image uploads; keep the Palette Extractor's existing image allowance. Preserve the previous character session on rejection.
- Discord: apply the same limit to attachment metadata and the streamed CDN response, including absent or misleading declared sizes. Keep scheme/host restrictions, timeout, redirect refusal and early localized ephemeral errors. The user has already uploaded to Discord before this guard runs.
- Use byte counts, not JavaScript string length. Update dedicated size wording in all six web and bot locales; merely lowering `MAX_FILE_BYTES` would currently display `0.0078125 MB` in the bot. Update living guides and tests when behavior changes.
- Proposed companion policy: refuse nonempty `Base64Image` and invalid non-string/non-null values with a localized explanation; permit missing/null/empty placeholders. Decide this explicitly when scheduling implementation. Do not decode images to determine eligibility, and do not reject by `TypeName` or purported producer age.
- Add boundary cases at 8,191/8,192/8,193 bytes, multibyte text, the oversized image-bearing export represented by a safe synthetic fixture, small spoofed image fields, and normal Anamnesis/Ktisis/Brio fixtures. Keep extension/content checks and bounded parser diagnostics; do not equate this cap with safety or close FINDING-002 based on it alone.
- Document the supported file policy and explain that oversized exports need an image-free, sufficiently small export. The corpus samples are compatibility evidence only; do not commit users' raw files or automatically rewrite their originals.

### 5. Verify before closing

- Recheck these findings against the then-current branch; line numbers and implementations may have changed.
- Install/build dependencies in the implementation worktree, then rerun focused parser, loader, file-card and API boundary suites. Resolve the recorded setup failures before claiming a clean test run.
- Run the required checks for changed units and affected consumers, including locale checks for new UI text. Apply release/version/changelog requirements when implementation scope is known.
- Close each finding only with passing regression evidence and a recorded implementation commit. No fix work has begun here.

## Pending rotation

None identified; no exposed credential was found in this focused path review.

## Pending policy edits

None proposed by these three findings. Existing web and Discord character-file privacy wording was checked for the reviewed flows; the bot policy explicitly describes downloading and parsing files on Cloudflare. This is not a certification of all policies, translations or data flows. Keep raw file data and unrestricted metadata out of telemetry while fixing these issues.

## Remediation status

| ID | Status | Commit |
| --- | --- | --- |
| FINDING-001 | OPEN — deferred; implementation not started | — |
| FINDING-002 | OPEN — deferred; implementation not started | — |
| FINDING-003 | OPEN — deferred; implementation not started | — |

## Next steps

When this work is scheduled, use the catalog and acceptance criteria to prepare the scoped remediation plan and confirm any format-compatibility decisions. This document creates no reminder, deadline or recurring task.

## External guidance

- [MDN: `accept` is a file-picker hint, not validation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/accept).
- [OWASP: layered file validation and resource limits](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). Apply the guidance to each boundary: the web import reads locally, while Discord imports involve a Discord upload and a worker download.
