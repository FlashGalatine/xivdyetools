# XIVAPI dye discovery and comparison Implementation Plan

**Status:** Draft, 2026-10-20. Implementation has not started.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give maintainers a manual command that discovers new Stain rows and reports differences against the bundled dye catalog, with reproducible evidence and no automatic data edits.

**Architecture:** A TypeScript maintenance command in `packages/core/scripts` enumerates the entire Stain sheet, validates a single pinned snapshot, and compares it with raw local source data. It saves raw pages, source inputs, provenance and JSON/Markdown reports in a new output directory. Offline replay validates those saved inputs and reproduces the comparison without contacting XIVAPI.

**Tech Stack:** Existing TypeScript, tsx, Vitest, csv-parse/sync and Node built-ins. No new dependencies or runtime exports. Keep the package's declared Node compatibility; do not depend on newer convenience APIs merely because the development machine supports them.

**Spec:** [Issue #322 research and decision matrix](README.md), [complete dye-list discovery](DYE_DISCOVERY.md), [source inventory](CODE_INVENTORY.md), and [captured discovery evidence](evidence/discovery/summary.json). These are the research requirements; the implementation choices below are proposals for review.

**Baseline:** `b98c8584a85f5dc50b4b4392c508cc627ef004d6`. Recheck the implementation seams when execution begins. This plan lives beside the requested Audit findings rather than in the default plans directory.

## Global Constraints

- Run only through an explicit maintenance command. Ordinary install, build, test, application startup and dye/localization access must remain free of new network requests.
- Enumerate from the start on every refresh, without a known-ID allowlist, maximum-known-ID shortcut or English-name search. Continue until a successful empty page, including after a short nonempty page.
- Resolve and record both game version and canonical schema revision; pin all subsequent pages. A failed or inconsistent scan is incomplete, never evidence that there are no new dyes.
- Treat nonzero rows with at least one nonblank global-language name as candidates for review, not proof of release or obtainability. Preserve row 0 and blank rows as evidence. Neither black Color=0 nor empty Item links disqualifies a named candidate.
- Preserve stainID, legacyItemID, locale keys (`legacyItemID ?? stainID`), consolidated market IDs, six locale sources, Facewear slugs and frozen negative-ID compatibility mappings.
- Report name/color differences without accepting them. Preserve regional names and leave unsupported acquisition claims unresolved. Do not infer category, acquisition, legacy identity or released status from a row.
- Save only to a new output directory. The command must not edit canonical JSON/CSV/locales, package metadata, source configuration or existing audit bundles.
- This implementation is tooling only. Worker caching, runtime metadata enrichment, automatic dye adoption and scheduled refreshes are separate changes.

## Review Focus

1. A lower-numbered blank row becomes named, a valid dye is black, or a candidate has no Item link: discovery must still report it (Task 1).
2. An HTTP 200 omits fields, pagination repeats a row, or a schema changes halfway through: terminate as incomplete (Tasks 1 and 2).
3. A dye has null legacyItemID or shares a consolidated item with many others: comparisons must remain stainID-keyed and preserve CSV compatibility (Task 1).
4. A server clamps the requested page size, stalls while sending the body, or supplies a long Retry-After: complete enumeration or fail explicitly within the local budget (Task 2).
5. An output path already exists, a capture has been altered, or writing is interrupted: no overwrite, network fallback or misleading complete report (Task 3).

## Proposed command and artifacts

Run commands from the repository root. The output path is required and resolved relative to that root, regardless of the package command's working directory.

```powershell
pnpm --filter @xivdyetools/core run audit:dyes --latest --out docs/audits/2026-10-20-dye-refresh
pnpm --filter @xivdyetools/core run audit:dyes --version 0874aee069e1e7c4 --schema exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb --out docs/audits/2026-10-20-dye-pinned
pnpm --filter @xivdyetools/core run audit:dyes --snapshot docs/audits/2026-10-20-dye-pinned --out docs/audits/2026-10-20-dye-replay
```

Exactly one mode is required: `--latest`, the complete `--version`/`--schema` pair, or `--snapshot`. Reject unknown/duplicate flags, mixed modes and partial pins before any fetch or output creation. Provide `--help`. Exit **0** means a complete report, including reports with differences; **1** means input, fetch, validation or filesystem failure; **2** means invalid CLI usage. Print the completion state, pins, candidate/difference counts and destination. A complete report with differences must not be described as a clean catalog.

In latest mode, the first page resolves the canonical pins and later requests use them. Explicit mode requires a concrete game key and canonical `exdschema@2:rev:...` identifier, not moving aliases. Pin mismatches reject the run. URL construction must use `URL`/`URLSearchParams`, a fixed `https://v2.xivapi.com/api/sheet/Stain` endpoint, `language=en`, and this tested projection:

```text
Name,Name@ja,Name@de,Name@fr,Color,Shade,SubOrder,IsMetallic,IsHousingApplicable,Item[].Name
```

A successful bundle contains:

| Path | Purpose |
|---|---|
| `manifest.json` | Format version 1, `status: complete`, captured/replayed timestamps, canonical pins, repository revision and dirty-state flag, request URLs/statuses/attempt counts, ordered page descriptors, SHA-256 hashes and byte counts for every input |
| `raw/stain-page-0001.json` etc. | Exact successful response bodies, including the terminal empty page |
| `inputs/dyes.json`, `inputs/dyenames.csv`, `inputs/rules.json` | Exact local input bytes; rules contain the metallic stain IDs and A/B/C consolidated IDs used for this comparison, with source paths/hashes in the manifest |
| `report.json` | Format version 1 and deterministic semantic comparison, sorted by numeric stainID, field and locale |
| `REPORT.md` | Human-readable equivalent, escaped table text, source references and explicit review-only wording |

Replay uses the bundle's saved local inputs as well as its raw pages, not today's working-tree data. It verifies hashes, sizes, pins, fields, page order and terminal completion, then reproduces `report.json` byte-for-byte. A fresh live/pinned run compares against today's local data. Provenance timestamps belong in the manifest, outside the deterministic report; Markdown links may differ between output locations.

## File map

All paths below are relative to the repository root. New modules are private tooling; no production barrel/export changes.

| File | Responsibility |
|---|---|
| `packages/core/scripts/stain-audit/model.ts` | Wire/local model validation, classification and shared capture/report types |
| `packages/core/scripts/stain-audit/compare.ts` | Pure source parsing and semantic comparison |
| `packages/core/scripts/stain-audit/fetch.ts` | Bounded sequential HTTP requests, pins and complete-sheet enumeration |
| `packages/core/scripts/stain-audit/output.ts` | Bundle serialization, integrity-checked replay and exclusive output creation |
| `packages/core/scripts/audit-dyes.ts` | CLI parsing, read-only local input loading and orchestration |
| `packages/core/scripts/stain-audit/{model,compare,fetch,output}.test.ts` | Focused offline unit tests |
| `packages/core/scripts/audit-dyes.test.ts` | Real CLI subprocess tests |
| `packages/core/scripts/stain-audit/fixtures/2026-10-20/` | Frozen three-page research capture, local JSON/CSV/rules, provenance and expected report |
| `packages/core/tsconfig.audit-dyes.json` | No-emit tooling/test type checking without widening the production build |
| `packages/core/eslint.audit-dyes.config.mjs` | Dedicated tooling lint configuration, avoiding root's global scripts ignore |
| `packages/core/package.json` | Manual command and integrated tooling checks |
| `packages/core/CLAUDE.md`, `docs/maintainer/adding-dyes.md` | Maintainer command, evidence interpretation and manual adoption workflow |

Release bookkeeping, if required when implemented: `packages/core/CHANGELOG.md`, core package version and the permitted central version tables. Do not change those during this planning task. Root Knip configuration should need no change: its package-script entry discovery can follow the CLI's imports; verify that before considering narrow configuration adjustments.

## Task 1: Validated local/upstream comparison

**Deliverable:** A pure, tested comparison that can distinguish candidate additions, source gaps and unresolved differences without modifying data.

**Files:** Create `model.ts`, `compare.ts`, their tests and the fixture directory from the file map. Add the dedicated type-check/lint configurations and companion commands in core's package.json with this task.

**Interfaces:** Define/export these private types in `model.ts`; runtime validation accepts `unknown`, not an unchecked cast.

- `GlobalLocale = 'en' | 'ja' | 'de' | 'fr'` and `Pins = { version: string; schema: string }`.
- `StainRow`: integer `stainID`, four raw `names`, integer `color`, `shade` and `subOrder`, boolean `isMetallic`/`isHousingApplicable`, and `items: { itemID: number; name: string }[]`.
- `StainPage`: `pins: Pins` and `rows: StainRow[]`.
- `DyeRules`: sorted metallic stain IDs and `consolidatedIds: { A: number | null; B: number | null; C: number | null }`.
- `LocalInputs`: UTF-8 source strings `dyesJson`, `namesCsv`, `rulesJson`. `LocalCatalog`: validated seven-field dyes, six-language CSV records keyed by the legacy-compatible locale key, and validated rules.
- `CompleteSnapshot`: `pins: Pins`, all validated `rows: StainRow[]`, and `complete: true`; create this only after whole-scan validation including the empty terminal page.
- `CapturedPage`: request URL, HTTP status, attempt count, raw UTF-8 body, and parsed `page: StainPage`. `Capture`: ordered `pages: CapturedPage[]` plus `snapshot: CompleteSnapshot`.
- `Comparison`: format version 1; counts; named candidate IDs; added candidate IDs; local IDs absent upstream; local IDs present but unnamed; excluded row classifications; source issues; and per-stain name/color/metallic/expected-item differences. Include all observed Item links as evidence, including links with no local expectation.

```typescript
validatePage(value: unknown, expectedPins?: Pins): StainPage
completeSnapshot(pages: readonly StainPage[]): CompleteSnapshot
classifyRow(row: StainRow): 'no-color' | 'blank' | 'candidate'
parseLocalCatalog(inputs: LocalInputs): LocalCatalog
compareStains(snapshot: CompleteSnapshot, catalog: LocalCatalog): Comparison
```

- [ ] **1. Write failing validation/classification tests.** Require every projected field and four name strings; Color must be an integer in `0..0xffffff`. Require nonnegative safe integer row/item IDs, valid booleans, Item relation identity (`sheet=Item`, matching `value`/`row_id`) and string Item names. Allow extra fields and any array length rather than assuming exactly two future Item slots. Reject duplicate/unordered IDs and missing fields. Whole-scan validation requires matching pins, exactly one empty page at the end, and no pages after it; sparse IDs are valid. Assert `classifyRow(namedBlackWithoutItems) === 'candidate'`, `classifyRow(row0WithTerebinth) === 'no-color'`, and all-four-blank names produce `blank` even when other fields are populated. Missing translations on a partially named row produce a review issue, not exclusion.
- [ ] **2. Write failing comparison tests.** Use sparse IDs and a newly named ID 126 below another existing high ID; assert it is added. Use null legacyItemID and two stains sharing one consolidated Item; assert separate stain records and correct locale keys. Reject malformed sources, duplicate stain/CSV keys and key collisions. Valid but missing/unknown CSV rows are source issues, not invented translations. Assert no mutations of deeply frozen inputs.
- [ ] **3. Freeze the measured baseline.** Copy the three raw discovery pages plus the current local JSON/CSV and minimal rules into the fixture directory; record original paths, source commit, pins and hashes. Assert 129 rows, 125 candidates, exclusion IDs `[0,126,127,128]`, no added/missing candidates, 22 color differences, zero metallic and consolidated-item differences. Assert three English JSON whitespace-only cases `[99,122,123]`; trimmed CSV en/ja match, de has 118 differences and fr has 125 case-only differences. These are fixture assertions, never production constants. Keep Korean/Chinese fixture bytes intact.
- [ ] **4. Run the new tests and observe an expected failure.** Run `pnpm --filter @xivdyetools/core exec vitest run scripts/stain-audit/model.test.ts scripts/stain-audit/compare.test.ts --coverage.enabled=false`. The initial failure must be the absent implementation/assertion, not unrelated setup.
- [ ] **5. Implement validation and comparison.** Parse CSV with existing `csv-parse/sync`, preserving raw text for whitespace reporting. Use `legacyItemID ?? stainID` only for the CSV join; use stainID for the comparison itself. Compare normalized hex, raw/trimmed names and exact trimmed text; label case-only differences without suppressing them. Compare metallic membership and expected consolidated Item presence; a legacy ID on a consolidated dye is compatibility metadata, not a required current purchase link. For unconsolidated dyes with a nonnull legacy ID, show whether that link is present; null has no inferred expectation. Do not map Shade to a local category or Item names to acquisition. Report ko/zh as not supplied by this upstream; for new candidates list those names and local classification/identity decisions as manual work.
- [ ] **6. Wire actual tooling checks.** Add `type-check:audit-dyes = tsc -p tsconfig.audit-dyes.json --noEmit` and `lint:audit-dyes = eslint --config eslint.audit-dyes.config.mjs scripts/stain-audit`. Include these in core's existing `type-check`/`lint`, retaining current source and Knip checks. The new tsconfig extends the root base, includes only these scripts/tests, uses Node types and noEmit, and does not inherit `rootDir: src`. The standalone ESLint config uses existing root ESLint dependencies and an explicit parser project pointing at that tsconfig; it must not import the root global scripts-ignore configuration. Verify rule coverage with `eslint --print-config` for a new helper and test.
- [ ] **7. Run the focused tests and companion type/lint checks to green.** No network. Existing src-only coverage thresholds do not measure these scripts; report test cases rather than claiming the tooling meets that coverage percentage. Keep this as an independently reviewable comparison change.

## Task 2: Complete, pinned, bounded enumeration

**Deliverable:** A tested fetcher that returns `Capture` only after the complete Stain sheet has been validated.

**Files:** Create `fetch.ts` and `fetch.test.ts`; consume Task 1's models and validators.

**Interfaces:** Define `FetchSelection = { mode: 'latest' } | { mode: 'pinned'; pins: Pins }` and injected `Transport = { fetch: typeof globalThis.fetch; now: () => number; sleep: (ms: number) => Promise<void> }` in `fetch.ts`.

```typescript
fetchStainCapture(selection: FetchSelection, transport: Transport): Promise<Capture>
```

- [ ] **1. Write failing pagination tests with injected responses.** Assert initial URL has no `rows` or `after`, subsequent `after` equals the last returned row ID, and all later pages carry the first canonical pins. Assert page lengths `[100,29,0]` finish in three calls; `[2,1,0]` also completes despite a requested limit of 100. Assert a short page alone never completes. Reject repeated/out-of-order rows, pin drift, empty-first-page catalog, HTTP 200 with wrong shapes and missing terminal page. Gaps between valid ordered IDs are allowed.
- [ ] **2. Write failing transport tests.** Use fake clocks/fetch and assert the exact bounds below: timeout during headers and streamed body; chunked oversized response; redirect rejection; 429 with seconds/date Retry-After; transient 503 then success; retry exhaustion; long Retry-After beyond remaining budget; cancellation of timed-out/oversized response bodies. Never wait real retry delays in tests. Assert permanent 4xx and schema/JSON errors do not retry.
- [ ] **3. Run the fetch tests to red.** Run `pnpm --filter @xivdyetools/core exec vitest run scripts/stain-audit/fetch.test.ts --coverage.enabled=false`.
- [ ] **4. Implement the sequential fetcher.** Proposed client limits: `limit=100`, at most 20 successful pages **including** the terminal empty page, 2 MiB decoded bytes per response, 15 seconds per attempt covering the entire body, three attempts per page, 250 ms between successful page requests and five minutes total run time. These are our safety bounds, not claimed XIVAPI quotas. Retry only transport failures, 429 and 5xx; use 1 s then 2 s backoff, honoring a valid Retry-After as a minimum. If the required wait plus next attempt cannot fit the remaining deadline, fail rather than retry earlier. Enforce a streaming byte counter even without Content-Length; reject redirects and malformed/non-JSON success responses. A cap hit throws an incomplete-scan error. Decode response bodies as strict UTF-8 so saved bytes and their hashes remain exact. Preserve successful raw pages and attempt counts in the returned capture; include failure page/cursor/pins in errors without manufacturing a successful bundle.
- [ ] **5. Run fetch, model and comparison tests plus tooling type/lint checks to green.** Verify zero real HTTP requests in the suite. Preserve the full scan rather than adding an incremental shortcut or a schedule.

## Task 3: Reviewable bundles, offline replay and maintainer handoff

**Deliverable:** The usable `audit:dyes` command, documented and covered by real subprocess tests; all mandatory gates cover its source.

**Files:** Create `output.ts`, `output.test.ts`, `audit-dyes.ts` and `audit-dyes.test.ts`. Complete the fixture's format-1 replay bundle. Modify core package scripts, core CLAUDE.md and the adding-dyes guide. Apply required release bookkeeping only during implementation.

**Interfaces:** Use Tasks 1 and 2 unchanged. In `output.ts`, define `BundleInputs = { capture: Capture; localInputs: LocalInputs }` and `Provenance` containing source revision/dirty state, source file hashes, operation mode and timestamps.

```typescript
readAuditBundle(directory: string): Promise<BundleInputs>
writeAuditBundle(directory: string, inputs: BundleInputs,
  comparison: Comparison, provenance: Provenance): Promise<void>
```

The CLI is the executable entry point, not a package export. Resolve core/repository paths from `import.meta.url`, not the caller's cwd. Read raw `src/data/dyes.json` and `dyenames.csv`; import only the pure `METALLIC_STAIN_IDS` and `CONSOLIDATED_IDS` configuration for `rules.json`. Do not import `build-locales.ts` (it runs and writes on import) or initialize DyeService to parse the source.

- [ ] **1. Write failing output/replay tests.** Assert same validated inputs produce identical report bytes; replay rejects bad hashes, inconsistent pins, missing/reordered/trailing pages, malformed local inputs and unknown manifest formats. Accept only the enumerated bundle-relative input paths; reject traversal and symlinks resolving outside the capture. Hash verification detects alteration but is not a claim of trusted authorship. Escape pipes/newlines/HTML in upstream report text. Assert existing output is unchanged and a simulated mid-write failure leaves no manifest claiming completion.
- [ ] **2. Write failing real CLI tests.** Follow `scripts/build-locales.test.ts`'s absolute tsx resolution and subprocess pattern, with an explicit 30-second subprocess timeout. Run help/invalid flags and fixture replay from a temporary cwd; prove repository-relative resolution and exit codes 0/1/2. Check stdout says differences require review, not catalog clean. Hash canonical source files and existing fixtures before/after. Preload a temporary test-only Node module in the subprocess that makes `globalThis.fetch` record an invocation and throw; assert replay succeeds with zero invocations. This exercises the real offline path without relying on the machine being disconnected.
- [ ] **3. Run output/CLI tests to red.** Run `pnpm --filter @xivdyetools/core exec vitest run scripts/stain-audit/output.test.ts scripts/audit-dyes.test.ts --coverage.enabled=false`.
- [ ] **4. Implement bundle writing/replay.** Validate all inputs before creating the output, create the final directory exclusively, write evidence and reports with exclusive file creation, and write the complete manifest **last**. On interruption, an unsealed directory may remain for diagnosis; it is not a successful report or replay source. Refuse it on a subsequent run and require a fresh destination. On fetch/validation failure, create no output directory and print an incomplete-scan error. Never overwrite or recursively clean an existing directory. Bound replay input reads by the same page limits and byte limits and a 2 MiB per-file limit for local inputs; this is comfortably above the measured sources.
- [ ] **5. Implement CLI orchestration and add `audit:dyes = tsx scripts/audit-dyes.ts`.** Enforce the mode/exit contract above. Live mode reads current local inputs and fetches; replay reads saved inputs with no live fallback. Both call the same parser/comparator/writer. Extend `lint:audit-dyes` to also pass `scripts/audit-dyes.ts scripts/audit-dyes.test.ts` now that those files exist. Validate local sources before fetching. Capture local file hashes plus config hashes and git revision/dirty state; if git metadata cannot be read, record it as unavailable rather than inventing a revision. Add a justified `@entrypoint` tag naming this manual command if the root reachability gate requires it. Helpers remain normally imported code; do not silence them with blanket public/ignore annotations.
- [ ] **6. Update maintainer documentation.** Add the three command forms and explain candidate review, replay semantics, exit codes and incomplete outputs. Replace tested-version advice to query StainTransient with `Stain.Item[]`, citing the pinned audit and noting schema evolution. Explain that the existing 22 color discrepancies and German/French naming conventions need a separate decision. Keep the existing manual JSON/CSV adoption and six-locale validation workflow; running the audit itself never calls generators. Record the command and its offline boundary in core CLAUDE.md.
- [ ] **7. Run all new tests, then the existing core suite and required gates below.** Review that normal build/test invokes no live capture and that new scripts remain outside `dist` and public exports. Confirm Knip discovers the manual command. The root dead-code scan uses tracked files: once changes are ready, stage only this task's paths before treating that gate as meaningful, and do not commit unrelated work.
- [ ] **8. Record the release decision and final diff.** Follow the repository's release mechanics against the then-current npm/core versions; reuse an existing unpublished release when applicable, otherwise a tooling-only patch is the proposed change. Add the core changelog entry and update central version tables only if needed. Do not create a user-facing announcement entry for this maintainer command. Publishing, deployment and merging are outside this implementation plan's execution scope. Keep commits scoped by deliverable when requested under the repository's commit workflow.

## Verification and completion

After focused tests pass, run these from the repository root in the implementation worktree:

```powershell
pnpm --filter @xivdyetools/core run type-check
pnpm --filter @xivdyetools/core run lint
pnpm --filter @xivdyetools/core exec vitest run --coverage.enabled=false
pnpm turbo run build type-check lint test --filter=...@xivdyetools/core
pnpm dead-code:check
pnpm type-check:scripts
pnpm test:scripts
pnpm workers:check-logs
pnpm docs:check-links
pnpm docs:check-versions
```

The Turbo filter includes core and its dependents. Run the repository's full `pnpm turbo run build type-check lint test` before any merge as required by the standing gate; that does not itself authorize a merge. Investigate new failures rather than broadening ignore lists. Root documentation gates exclude Audit bodies, so manually validate this plan's relative links as well.

- [ ] Offline replay of the frozen baseline yields the measured counts and identical semantic JSON; synthetic fixtures prove future additions and failure paths independently of those historical counts.
- [ ] Every partial/invalid scan exits nonzero without a complete manifest or a no-new-dyes claim. All successful captures include the terminal empty page.
- [ ] Production dye JSON, CSV, generated locales, identity configuration and Facewear data remain byte-identical after the audit command and its tests.
- [ ] No new dependencies, public exports, worker routes, scheduled jobs or runtime fetches are present. Type-check and lint actually inspect the new scripts.
- [ ] Record commands/results, any pre-existing failures and the release decision in the implementation handoff. A fresh live smoke run is optional and manual; it is not a CI gate or a required step to reproduce the historical counts.

## Follow-on decisions after this tool is available

The tool can support later adoption of reviewed new dyes, but adoption is a separate change requiring decisions about identity, category/acquisition, all six names and any color differences, followed by the existing data/consumer/font checks. Do not couple adoption to whether the upstream row is merely named.

Other issue #322 candidates retain their research ranking: evaluate shared-worker cache identity, conditional icon refresh and request coalescing in a separate API-worker plan; retain hybrid acquisition generation and local character palettes. No evidence in this audit supports replacing the latter with a runtime XIVAPI dependency.

## Draft self-review

Checked the plan against the research and discovery follow-up: full enumeration and future additions map to Tasks 1/2; pins, bounded failure and required-field validation to Task 2; immutable six-locale/identity inputs and unresolved colors/names to Task 1; provenance, raw capture, replay, output safety and maintainer workflow to Task 3. Each Review Focus case has an explicit test owner. The shared interface names are consistent across tasks. The scoped deliverables stop at reporting and do not silently choose the unresolved migration decisions.
