# Deep-dive analysis — whole monorepo (2026-10-26)

- **Branch/commit:** `codex/deep-i18n-audits-20261026` / `6da3ff5b047188e6f8c08be2ea47f99f02e7a8d1`; continuation of PRs #333/#334.
- **Scope:** eight packages, nine apps, root quality scripts; **650 code files / 169,904 original lines**, with no missing runtime-file reads in [source-coverage.json](evidence/source-coverage.json). Runtime/declaration review sometimes elided comments, static markup and style literals; original line counts are inventory sizes, not a claim to have reviewed every CSS literal. Generated tables were inspected structurally; test files were read around suspected gaps, not all in full.
- **Method:** source/caller/test tracing, independent verifier review, full unit gates, fresh coverage and a deferred-import reproduction. [Baseline details](evidence/verification-baseline.md) distinguish retries, cache reuse and limitations.
- **Totals:** 24 findings (20 LOW, 4 MEDIUM); 23 bugs and 1 optimization. No HIGH/CRITICAL; no separate structural-refactor finding justified. **Sprint 0 emergency:** none.
- **Status basis:** 0 fixed during analysis; every new finding OPEN. One previously OPEN optimization is carried forward with a qualified supersession; overlap with the security fan-out finding is one implementation task in the merged plan.

## Catalog — bugs

| ID | Title | Sev | Type | Deploy unit | Tested? |
|---|---|---|---|---|---|
| [BUG-001](findings/BUG-001.md) | Harmony hue-only selection prints angular degrees as the chosen matching metric | MEDIUM | Logic | packages/bot-logic | No regression assertion |
| [BUG-002](findings/BUG-002.md) | Swatch merges same-index eyes even when live extended colors differ | MEDIUM | Logic | packages/bot-logic | No regression assertion |
| [BUG-003](findings/BUG-003.md) | Character label cap can split a surrogate pair | LOW | Edge case | packages/core | No regression assertion |
| [BUG-004](findings/BUG-004.md) | Glamour embed truncation leaves oversized notes unbounded | LOW | Edge case | packages/bot-logic | No regression assertion |
| [BUG-005](findings/BUG-005.md) | Concurrent last-slot submissions can both be rolled back while consuming daily quota | LOW | Race | apps/presets-api | No regression assertion |
| [BUG-006](findings/BUG-006.md) | Changing only the primary category can retain that category in secondary_categories | LOW | Logic | apps/presets-api | No regression assertion |
| [BUG-007](findings/BUG-007.md) | New-preset response reports vote_count 0 after the author's auto-vote is committed | LOW | State | apps/presets-api | No regression assertion |
| [BUG-008](findings/BUG-008.md) | Concurrent preview replacements and preset deletion leave uploaded R2 objects orphaned | LOW | Race | apps/presets-api | No regression assertion |
| [BUG-009](findings/BUG-009.md) | Favorite list can exceed Discord's embed description limit for legal preset names | LOW | Edge case | apps/discord-worker | No regression assertion |
| [BUG-010](findings/BUG-010.md) | Favorite list presents transient API failures as permanently removed presets | LOW | Error handling | apps/discord-worker | No regression assertion |
| [BUG-011](findings/BUG-011.md) | Glamour adapter records failed Discord edits as successful commands | LOW | Error handling | apps/discord-worker | No regression assertion |
| [BUG-012](findings/BUG-012.md) | SWAP does not cancel an export sheet still waiting for its chunk | LOW | State | apps/web-app | No regression assertion |
| [BUG-013](findings/BUG-013.md) | Non-default match metrics lose units and precision in exports and swatch summaries | LOW | Logic | apps/web-app | No regression assertion |
| [BUG-014](findings/BUG-014.md) | A delayed vote check can repopulate invalidated cache after a vote succeeds | LOW | State | apps/web-app | No regression assertion |
| [BUG-015](findings/BUG-015.md) | A language switch empties settled Swatch matches and disables Share | MEDIUM | State | apps/web-app | No regression assertion |
| [BUG-016](findings/BUG-016.md) | A completed preset edit can dismiss a different modal | LOW | Race | apps/web-app | No regression assertion |
| [BUG-017](findings/BUG-017.md) | Accessibility ignores saved canonical display options until a setting changes | LOW | State | apps/web-app | No regression assertion |
| [BUG-018](findings/BUG-018.md) | Harmony ignores canonical harmony type on initialization and reset/import broadcasts | MEDIUM | State | apps/web-app | No regression assertion |
| [BUG-019](findings/BUG-019.md) | Comparison ignores the global Stain and Spectrum display switches | LOW | Logic | apps/web-app | No regression assertion |
| [BUG-020](findings/BUG-020.md) | Palette-driven Gradient and Comparison selections do not request their prices | LOW | Logic | apps/web-app | No regression assertion |
| [BUG-021](findings/BUG-021.md) | Preset card keyboard handling hijacks its Save and Vote buttons | LOW | Logic | apps/web-app | No regression assertion |
| [BUG-022](findings/BUG-022.md) | Arming an empty Gradient End slot still writes the picked dye into Start | LOW | State | apps/web-app | No regression assertion |
| [BUG-023](findings/BUG-023.md) | Editing a preset refreshes the public pool but leaves Mine and its edit baseline stale | LOW | State | apps/web-app | No regression assertion |

## Catalog — refactors

No standalone refactor is proposed merely because a file is large. Small extractions that prevent a confirmed bug ride with that bug; #334 already owns the migration cleanup.

## Catalog — optimizations

| ID | Title | Impact | Category | Deploy unit |
|---|---|---|---|---|
| [OPT-001](findings/OPT-001.md) | Favorite listing still fans out up to 50 individual preset API reads | LOW | I/O | apps/discord-worker |

## Gates and coverage

The baseline passed **62/62 tasks** (26 cached), **16,193 tests** across 17 units. Fresh coverage subsequently passed each of the 17 configured unit gates. Initial collection errors and successful narrow/full-unit retries are retained, rather than rewritten as a single successful run. Web `build:check` passed at **98.9%** of the one-locale payload budget. No production request or browser E2E suite was run.

| Unit | Statements % | Branches % | Functions % | Lines % |
|---|---|---|---|---|
| apps/api-worker | 95.28 | 92.25 | 94.94 | 95.94 |
| apps/discord-worker | 92.33 | 84.52 | 92.71 | 93.13 |
| apps/image-worker | 91.9 | 87.71 | 97.36 | 95.89 |
| apps/moderation-worker | 92.84 | 86.01 | 93.5 | 93.45 |
| apps/oauth | 95.76 | 92.23 | 93.75 | 96.21 |
| apps/og-worker | 97.91 | 94.19 | 100 | 98.23 |
| apps/presets-api | 95.54 | 91.43 | 97.11 | 96.33 |
| apps/stoat-worker | 99.33 | 90.36 | 97.91 | 99.63 |
| apps/web-app | 88.03 | 78.62 | 85.59 | 89.43 |
| packages/auth | 95.03 | 92.21 | 94.28 | 96.18 |
| packages/bot-logic | 99.47 | 96.64 | 100 | 99.76 |
| packages/core | 96.58 | 93.86 | 99.26 | 96.9 |
| packages/logger | 96.39 | 91.16 | 100 | 96.34 |
| packages/svg | 98.83 | 94.43 | 100 | 98.91 |
| packages/test-utils | 96.21 | 94.29 | 96.34 | 96.04 |
| packages/types | 98.71 | 100 | 100 | 98.55 |
| packages/worker-kit | 99.27 | 94.5 | 97.22 | 99.74 |

These percentages apply to each configured coverage include/exclude set. They do not establish correctness of the unasserted scenarios in the catalog. The stale export-sheet test passes by asserting the defect; it is not a remediation test passing on a fix.

## Positive controls

- Character-file byte limits, parse generations, worker protocol guards and teardown protect the normal import path; the identified export-sheet race is a distinct late import callback.
- Core normalizes library gender values before GPOSERS omission rules; off-grid match gating and valid color parity remain covered.
- Preset moderation binds status/revision and preview decisions to the exact image key; author upload replacement has a separate concurrency gap.
- OAuth binds PKCE to signed provider state; retention jobs propagate failures through `waitUntil`.
- Image decoding checks dimensions and frees separate Photon allocations; prior 16-bit memory accounting remains security-owned.
- API chara work is bounded/coalesced and registered to the owning request; fully cached responses intentionally permit null version.
- The published API/KEEP boundaries in #334 remain intact. A symbol being test-only in this repository does not authorize a breaking removal.
- Existing i18n, policy, dead-code and bundle gates remain meaningful controls; none was relaxed to make the audit pass.

## Rejected suspicions and limits

- Feminine/Female robe mismatch: facade normalization makes the rule reachable with the expected value.
- Null API version on a full cache hit: explicit contract; the client currently requests unversioned icons.
- Duplicate stored categories do not multiply SQL category counts; that finding is limited to the effective category invariant and display.
- Failed favorite lookups do not delete KV favorites; the defect is an incorrect response and omitted results.
- Dormant Stoat reaction context eviction and internal-only image input probes were not refilled as new user-facing bugs.
- Large files, bounded loops over 125 dyes, deliberate cache TTLs, published exports and accepted deprecations are not standalone performance/dead-code findings.
- Huge glamour-note overflow requires abnormal upstream or injected names; normal content was not demonstrated to exceed the budget.
- Reviewer ledgers and verification returns preserve additional rejected leads and exact test gaps. Static race schedules are distinguished from the executed UI reproduction; no live D1/R2 race or production Discord delivery fault was induced.

## Recommendations

- Add regression assertions at the rendered payload/state boundary for every confirmed bug.
- Compare effective state after partial edits; use conditional database writes and explicit cleanup for concurrent object replacements.
- Treat failed delivery and failed lookups as distinct outcomes rather than success or permanent removal.
- Centralize metric formatting on the selected metric's identity and precision.
- Refresh asynchronous caches and views with generation/identity guards across reset, locale changes and mutation completion.
- Measure favorite service-call counts before/after the shared security/optimization task; preserve order and partial-failure semantics.

## Remediation status

| ID | Status | Commit |
|---|---|---|
| [BUG-001](findings/BUG-001.md) | OPEN — source prepared; release pending | [A-BOT-LOGIC evidence](../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md) |
| [BUG-002](findings/BUG-002.md) | OPEN — source prepared; release pending | [A-BOT-LOGIC evidence](../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md) |
| [BUG-003](findings/BUG-003.md) | OPEN — source prepared; release pending | [A-CORE evidence](../2026-10-26-xivcharakit-dead-code/evidence/remediation-core-2026-10-27.md) |
| [BUG-004](findings/BUG-004.md) | OPEN — source prepared; release pending | [A-BOT-LOGIC evidence](../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md) |
| [BUG-005](findings/BUG-005.md) | OPEN — source prepared; release pending | [A-PRESETS evidence](../2026-10-26-security/evidence/remediation-presets-2026-10-27.md) |
| [BUG-006](findings/BUG-006.md) | OPEN — source prepared; release pending | [A-PRESETS evidence](../2026-10-26-security/evidence/remediation-presets-2026-10-27.md) |
| [BUG-007](findings/BUG-007.md) | OPEN — source prepared; release pending | [A-PRESETS evidence](../2026-10-26-security/evidence/remediation-presets-2026-10-27.md) |
| [BUG-008](findings/BUG-008.md) | OPEN — source prepared; release pending | [A-PRESETS evidence](../2026-10-26-security/evidence/remediation-presets-2026-10-27.md) |
| [BUG-009](findings/BUG-009.md) | OPEN — complete escaped favorite lines/notices budgeted and delivery checked in prepared A-DISCORD source; release pending. | [A-DISCORD evidence](../2026-10-26-security/evidence/remediation-discord-2026-10-27.md) |
| [OPT-001](findings/OPT-001.md) | OPEN | — |
| [BUG-010](findings/BUG-010.md) | OPEN — exact batch found/missing classification and visible/traced service failure prepared; release pending. | [A-DISCORD evidence](../2026-10-26-security/evidence/remediation-discord-2026-10-27.md) |
| [BUG-011](findings/BUG-011.md) | OPEN — checked Glamour delivery, unserved failure and one short fallback prepared; release pending. | [A-DISCORD evidence](../2026-10-26-security/evidence/remediation-discord-2026-10-27.md) |
| [BUG-012](findings/BUG-012.md) | OPEN | — |
| [BUG-013](findings/BUG-013.md) | OPEN | — |
| [BUG-014](findings/BUG-014.md) | OPEN | — |
| [BUG-015](findings/BUG-015.md) | OPEN | — |
| [BUG-016](findings/BUG-016.md) | OPEN | — |
| [BUG-017](findings/BUG-017.md) | OPEN | — |
| [BUG-018](findings/BUG-018.md) | OPEN | — |
| [BUG-019](findings/BUG-019.md) | OPEN | — |
| [BUG-020](findings/BUG-020.md) | OPEN | — |
| [BUG-021](findings/BUG-021.md) | OPEN | — |
| [BUG-022](findings/BUG-022.md) | OPEN | — |
| [BUG-023](findings/BUG-023.md) | OPEN | — |

## Next steps

Use the [merged remediation plan](../2026-10-26-i18n/REMEDIATION_PLAN.md). It supersedes scheduling in the preceding security/dead-code plans while keeping those snapshots unchanged. The maintainer's review-first decision remains in force; this audit makes no source, publish, deployment or policy change.
