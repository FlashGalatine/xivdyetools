# XIVAPI dye audit implementation handoff

**Date:** 2026-10-20

**Status:** Implemented, independently reviewed and verified on the feature branch.

**Issue:** [#322](https://github.com/FlashGalatine/xivdyetools/issues/322)

**Plan:** [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)

## Delivered behavior

The manual `pnpm --filter @xivdyetools/core run audit:dyes` command enumerates the complete Stain sheet, reports differences against raw local dye sources, and saves replayable evidence. Choose `--latest`, both `--version` and `--schema`, or `--snapshot`; all modes require `--out` pointing at a new directory with an existing parent. Paths are repository-relative. The [maintainer guide](../../maintainer/adding-dyes.md#discovering-and-comparing-dyes-with-xivapi) gives complete examples and exit codes.

Full scans start without a known-ID filter and continue through short pages until a successful empty page. Canonical game/schema pins, field shapes, increasing IDs, retries, whole-body timeouts, streamed response bytes and total requests/time are checked. Named nonzero rows are candidates even when black or lacking Item links; row 0 and blank rows are preserved as evidence.

`report.json` and `REPORT.md` expose new candidates with their names/color/flags/Item links, absent or newly unnamed local dyes, six-locale source gaps, and review-only name/color/metallic/expected-item differences. Reports accept no changes and infer no acquisition or release eligibility. Existing dye JSON/CSV/locales, compatibility identities, Facewear data and runtime exports are unchanged relative to the PR base.

Bundles contain raw pages, exact local inputs/rules, provenance, hashes and reports. Exclusive writes protect existing destinations, and the complete manifest is written last. Replay validates file paths, bounds, hashes, pins, pagination and semantic output, uses the saved local inputs, and has no live fallback. The fixture's scoped Git attributes preserve exact JSON/CSV bytes on Windows and Linux.

The scripts have dedicated type-check and ESLint configurations wired into core's normal gates. Production build inputs/exports remain unchanged. No new dependencies, scheduled jobs or runtime requests were introduced.

## Commits and integration

| Step | Commit |
|---|---|
| Research, raw evidence and approved plan | `6c9505b5` |
| Validated comparison and frozen baseline | `7ee2f64` |
| Complete pinned fetcher | `bafc2494` |
| CLI, bundles, replay, docs and tooling integration | `9163e297` |
| Merge current main, preserving its dependency updates and Poetics fix | `626531a5` |

The original research baseline remains `b98c8584a85f5dc50b4b4392c508cc627ef004d6`. Implementation was integrated with main at `0cf9d00c79f4d669fc76e72a0d39ecd46e071f69`; the historical research does not retroactively include that later Poetics change. The CSV-header regression fix and this handoff follow those commits in the branch history.

## Verification

- The frozen snapshot reproduces 129 rows, 125 candidates, no additions, 22 color discrepancies, zero metallic/consolidated-item discrepancies and the measured global-name differences.
- Full core suite after the review fix: **2,772 tests**, including **79 audit tests**. The baseline's counts are fixture assertions, not production constants.
- Final post-fix full graph: **62/62 tasks passed** on current main and its updated lockfile.
- Root type-check for scripts, script self-tests, dead-code reachability, docs links/versions and worker logging gates passed.
- A real pnpm replay produced the same semantic JSON. CLI subprocess tests block fetch through inherited `NODE_OPTIONS`, positively verify live-mode blocking, and hash all six locale files, canonical sources, Facewear identities and frozen bundle inputs before/after.
- Committed fixture blobs match every manifest byte count and SHA-256 digest, independently of working-tree newline settings.
- Gitleaks staged and outgoing-commit scans found no secrets. The portable scanner was fetched from the [official release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1), and the archive SHA-256 was checked against its published checksum file.

Commands used from the repository root:

```powershell
pnpm turbo run build type-check lint test --concurrency=2
pnpm type-check:scripts
pnpm test:scripts
pnpm dead-code:check
pnpm docs:check-links
pnpm docs:check-versions
pnpm workers:check-logs
pnpm --filter @xivdyetools/core run audit:dyes --snapshot packages/core/scripts/stain-audit/fixtures/2026-10-20/bundle --out .superpowers/sdd/IMPLEMENTATION_PLAN/manual-replay
```

One earlier high-concurrency graph run timed out in moderation-worker's existing `env-validation-gate.test.ts` case for missing RL_COMMAND. Its isolated rerun passed, followed by complete passing graph runs with concurrency 2; no timeout/assertion was relaxed.

During initial CLI-test development, a `--require` fetch blocker covered tsx's launcher but did not reach its child, causing read-only live requests. The boundary was diagnosed and corrected with inherited `NODE_OPTIONS`; the final tests prove the child blocks all three attempted live calls and that replay makes none. Fixture request metadata is explicitly documented as reconstructed offline test input; the actual research observations remain in the [original discovery manifest](evidence/discovery/manifest.json).

## Final review and fix

One fresh verifier reviewed the whole net branch diff using `gpt-6.1-sol / xhigh`, resolved under the project's ordinary-verification policy. Implementation itself was native. The review confirmed the five planned input/failure classes and found no Critical/Important issue. It identified one Minor: an empty names CSV skips csv-parse's header callback and was accepted as zero rows.

The coordinator included that gap in the required preflight fix pass: missing headers now fail before a catalog can be used for fetching/output; valid header-only CSV still produces explicit source gaps. A regression test was observed failing before the guard and passing afterward. No review findings remain deferred.

## Execution decisions

These record the ledger's decisions and the boundaries the reviewer deliberately did not judge:

1. Keep shared maintenance types in the planned model module and transport types beside the fetcher, with no public exports. A mistaken interface assumption would be an integration error checked by types/tests.
2. Continue in the existing isolated research worktree and stage only this task's paths. A mistaken ownership assumption would mix unrelated changes; the scoped commits and clean checkout checks guard that boundary.
3. Require an actual CSV header during preflight, preserving valid header-only input. Headerless input is refused consistently with the documented schema.
4. Live availability and future schema behavior remain unguaranteed. Explicit scans validate pins and fail incomplete; CI replays recorded evidence. Later upstream changes may require adapting this maintenance tool.
5. Existing color/name differences remain reviewed migration decisions. Maintainers still adjudicate them rather than automatically rewriting the catalog.
6. Numeric sheet differences establish no rendered-color fidelity. Visual calibration remains a separate investigation.
7. Acquisition and release eligibility stay manual: named rows are candidates. Human review remains necessary before adoption.
8. Automatic adoption stays excluded. Maintainers still make reviewed source updates through the existing six-locale/identity workflow.
9. Runtime caching and other deferred issue #322 proposals need separate plans. Their existing limitations remain unchanged by this command.

## Release and follow-up

The npm registry reported core `5.12.0` while the repository already carried unpublished `5.14.0`, checked again after integration. Per release mechanics, the private tooling entry was folded into that existing pending changelog rather than adding another version bump. No central version tables, public announcement entry, publishing, merge-to-main or deployment action was added by this feature.

Reviewed new-dye adoption and API-worker cache improvements remain separate changes. The research's 22 color discrepancies and German/French naming conventions are reported for adjudication; Korean/Chinese sources remain manual. Acquisition generation and local character palettes retain their documented ownership.
