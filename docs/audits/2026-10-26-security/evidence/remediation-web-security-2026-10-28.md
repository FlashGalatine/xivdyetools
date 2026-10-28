# A-WEB security preparation — 2026-10-28

**State:** all 14 security rows implemented for web **5.16.4 PATCH** on isolated branch
`codex/sprint9-web-security-20261028`, based on `cf22202d` (A-DISCORD companion draft #346).
Final web-scoped verification passes; source publication and CI receipts are pending. Local whole-graph
validation is outstanding because of the Windows runner failures recorded below. This completes the
selected implementation scope; all nonsecurity A-WEB rows remain deferred. Findings remain
OPEN until production acceptance. No production release is selected.

## Scope and maintainer decisions

The maintainer approved all three recommended choices on 2026-10-28; the original
[security plan](../REMEDIATION_PLAN.md#decisions-needed-at-the-8-gate) and
[merged plan](../../2026-10-26-i18n/REMEDIATION_PLAN.md#sprint-a-web--appsweb-app) record them.

| Finding | Implemented behavior |
|---|---|
| FINDING-003 | New Swatch character-color saves use the existing current-language generic default and uniqueness numbering. Existing records are untouched. All six privacy variants accurately describe old names, unnamed glamour/palette fallback and available deletion controls. |
| FINDING-006 | Six sign-in notes say browsing needs no account, without promising unlimited requests. Limiter unchanged. |
| FINDING-007 | Six policies distinguish palette collections from saved community presets and explain their separate removal controls. |
| FINDING-010 | Six policies disclose at most 27 small equipment/facewear integers plus 12 fixed slot names. Transmission unchanged. |
| FINDING-011 | Production connect-src is exactly self plus api/auth/data.xivdyetools.app, pinned by equality. All other directives and image hosts remain intact. |
| FINDING-012 | Six Terms accept the provider and Discord ID or displayed author name, together with the preset name. |
| FINDING-013 | Six Terms disclose Discord display name with username fallback. |
| FINDING-026 | Approved six-language amendment: signed-out browsing sends no account information; signed-in preset opening sends the token for the existing vote check, which stores no view record. Timing, caching and UI unchanged. |
| FINDING-027 (web) | Six policies attach snapshot eligibility to editing a published preset and preserve retention across later held edits. Bot half is prepared in A-DISCORD. |
| FINDING-033 | German, French and Japanese say other people, without narrowing to players/users. |
| FINDING-034 | German example-link caption restores the linked/not-uploaded assurance. |
| FINDING-041 | Edit form adopts stored preview URLs through the shared HTTPS read guard; removal and new upload behavior retained. |
| FINDING-045 | Worker success DTO accepts null or one of the 16 actual clans before adoption. |
| FINDING-048 | Resolve JSON is unknown, then rebuilt from validated requested-slot/glasses fields before cache/rendering. Invalid rows become null; valid extended family/rule/acquisition metadata survives. |

Exactly seven locale JSON values change: `preset.gateBrowseNote` in six languages and German
`preset.shotSlot`. No new keys, placeholders or exceptions. All twelve web Privacy/Terms files
are dated **2026-10-28**. Perspective-sunset statements remain unchanged pending key deletion.
Version tables, technical changelog, player notes and the living CSP description reflect this
patch. The root announcement changelog is untouched.

## Regression proof and reviews

- First runtime group (041/045/048): genuine RED **38 assertion failures /467 passes**; restored
  GREEN **656/656 across nine suites**, including existing Glamour consumers. Three independently
  typed mutants compile, fail assertions and restore exact source hashes.
- Approved naming/CSP group: genuine RED **8 assertion failures /48 passes**; restored GREEN
  **56/56**. Nickname fallback mutant compiles and fails four assertions. A valid CSP with an
  extra host fails its exact-set assertion. Each original source restores byte-for-byte before
  final LF formatting and green TypeScript/ESLint/tests.
- Total: **four typed runtime mutants plus one valid-CSP mutant**, each assertion-killed and
  independently restored. No coverage thresholds, exclusions, budgets or gate rules are weakened.
- Independent ordinary reviews pass the original runtime group and all eight earlier copy rows.
  Snapshot-trigger scope and Japanese/Korean appeal grouping ambiguities were clarified and
  re-reviewed. Approved six-language character-save/vote-check copy and release notes also pass;
  approved-runtime review also passes. The final Astra review accepts all 14 security source
  findings and the PATCH/stacked release plan; it does not claim production acceptance.
- Structural policy parity and locale key/placeholder/order/quality gates pass without new
  exceptions. Both canonical CJK subset scripts were rerun. All 20 cmaps match the baseline;
  the six regenerated subsets differ only in head timestamps/checksums, confirmed against
  original bytes and every non-head table, so their exact original binaries were restored.
  Discord/OG font suites pass **17 +15 tests**. No font or OG-version change is needed.

## Verification record and Windows limitation

- Whole-graph build/types/lint: **45/45 tasks**, **42 cached**, exit 0.
- Build/budget, i18n, policy parity, script tests/types, versions (**34**), living-doc links
  (**1,063/259 documents**), reachability (**642 production /639 test files**) and seven-worker
  logging pins pass. Audit additions' relative links are checked separately.
- Bundle gate: visitor JS **2.17/2.20 MB (98.9%)**, all-locale JS **2.46/2.73 MB (89.9%)**.
  Existing limits and the 22 default-limit chunks remain unchanged.
- The first whole-graph test run stops on an unchanged SVG index-export test's 5-second timeout.
  The isolated file then passes **11/11**, and the unchanged full SVG unit passes **562/562**.
- A lower-concurrency retry reaches presets-api but fails to load 43 suite files through Vite
  `/@fs/` module paths despite the targets existing. A direct short-temp auth probe passes
  **49/49**; changing to the original temp path reproduces the import failure. Full-unit attempts
  still fail. Safe instrumentation shows Node **22.21.0**, no Bun and the intended temp path;
  the precise loader cause remains unresolved. No source/dependency/test/timeout change is justified.
- The final security reviewer accepts a draft PR and fresh affected Linux CI as preparation
  delivery, provided these local failures remain disclosed. **Whole-graph test validation remains
  outstanding.** CI's `...[HEAD^]` filter will verify the affected web scope; its always-run
  presets Wrangler check does not establish a presets-api or whole-graph test pass.

Final configured web suite exits **0**: **4,483/4,483 tests across 144 files**, with V8 coverage
**88.06% statements /78.81% branches /85.64% functions /89.46% lines**. Fresh web TypeScript
and the added privacy-test file's ESLint checks also exit 0. The full suite exposed five stale
assertions requiring the old imported names; an independent TEST WRONG verdict led to updating
only the Swatch expectations and generic-label cap fixture. All original logging canaries and
Glamour naming cases remain, with additional saved-name exclusions; scoped re-review passes.
Actual affected Linux CI and Playwright receipts will be recorded after publication.
The earlier partial-scope **4,480/144** web gate precedes approved naming/CSP additions and is
not relabeled as final. The early baseline collector's lost exit/concurrent coverage-lock attempt
was superseded by the captured successful partial gate; neither erases the graph failures above.

## Release handoff and limits

This is an app PATCH; no published package source/version, dependency, lockfile, workflow,
backend data store, OAuth feature flag or binding-only activation changes. The inherited package,
OAuth/migration/provider/consumer release gates remain. Registry inventory on 2026-10-28 shows
local core **5.16.0** versus published **5.15.0**, SVG **4.4.1** versus **4.4.0**, and bot-logic
**4.12.0** versus **4.11.0**; types **3.3.0** and logger **2.3.0** already match. Verify complete
reviewed package publication and deployment ordering before production. Automatic workspace beta
builds do not establish that publication gate or production acceptance.

New security tests and local checks establish preparation, not live production CSP or data
removal. After production deployment, verify actual served headers, new generic naming with old
records retained, local deletion boundaries and authenticated vote-state behavior. Preserve
existing saved data; do not mutate production accounts just to collect evidence.

A non-main source push selects the repository's automatic web beta workflow. Actual source CI,
beta and smoke-test receipts will be recorded after that run; no workflow dispatch/rerun is
selected. No manual deploy, package publish, main merge or command registration is selected.
Private XIVAuth material remains outside Git and outside this worktree's scope.
