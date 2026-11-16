# A-OG-COPY — source preparation, 2026-10-28

Scope: [I18N-002](../findings/I18N-002.md), based on A-WEB commit
`b14a6fd5e10b9537b3a2a013966ceb77075c6ea1`. Source preparation is distinct from
production acceptance; no main merge, npm publication or manual deployment is performed.

## Copy and regression proof

Both supported Harmony lists contain ten types. Change only the authored counts in the
six default-card subtitles: English **Six → Ten**, German **sechs → zehn**, French
**six → dix**, Japanese **6種類 → 10種類**, Korean **6가지 → 10가지**, Chinese
**六种 → 十种**. Every other runtime character is verified against the base. No new
translation is generated; unchanged prose is not independently native-speaker reviewed.
The historical design provenance is retained and qualified for this factual correction.
The old default-card unit fixture also adopts the already shipped Harmony Explorer title.

Twelve route cases use independent authored expectations and real requests to
`/og/harmony/default.png`: six inspect the generated SVG passed to the renderer, reconstruct
all subtitle text across wraps, and check the three-line, 374-pixel width and footer bounds;
six verify that the X frame still omits the subtitle.

- The initial gate could not collect without core/SVG build output in the new worktree.
  After building those dependencies, the actual pre-change baseline passes **201 tests
  across five files**. The collection error is retained separately.
- Before changing copy, the new regression fails for all **six** stale counts; the **six**
  X cases pass. Six separate count reversals each fail exactly their locale assertion,
  with **127** other route tests passing. Fixed source bytes are restored in `finally`.
- Restored source-focused checks pass **329 tests across six files**. The combined run
  initially reports **338 passing tests and one failing font case**: Chinese 十 is missing.
  This is a required glyph correction, rather than a waived font failure.

## Fonts and cache release

Both workers' canonical subset scripts run after the text is final. Of twenty inventoried
fonts, only OpenGraph's Noto Sans SC subset needs a content change: **U+5341 十 is added**
and now-unused **U+516D 六 is removed**. Five other byte changes are timestamp/checksum-only
with identical cmaps and non-head tables; they are restored to their exact original bytes.
Independent font review also finds unchanged outlines and horizontal metrics for all **705**
retained codepoints in the changed subset.
No Discord font binary changes are retained.

Use **OpenGraph 2.12.2 PATCH**. The earlier 2.12.1 security release already reached beta in
[A-SVG receipts](../../2026-10-26-security/evidence/remediation-svg-2026-10-27.md).
The worker's package version is its image-cache key version, so retaining 2.12.1 could serve
old cards for seven days. The bump retires those Worker-cache entries; browser and social
platform copies are not purged. The existing cache-key/package-version regression is retained.
The 2.12.1 security changelog entry is preserved.

## Verification and release boundaries

Whole-graph build/type/lint passes **45/45 tasks** (41 cached). The fresh forced serial test
run passes **17,481 tests across 604 files in all 17 workspaces**, **25/25 tasks**, zero cached.
The explicit OG string/role/fit/crawler/font gate passes **201 tests across five files**;
OG font coverage and actual static-face render checks pass **15 tests across two files**.
Discord font coverage/static-face checks pass **17 tests across two files**; combined font
checks total **32**. All six root gates pass: **167 script tests**, script types, reachability
(**642 production /641 test files**), **34 version claims**, **1,063 links across 259 living
documents**, and logging pinned off in all **seven** worker configurations. Configured
assertions, coverage and timeouts remain unchanged. The full suite uses normal host
permissions and the default process environment, as established by the A-WEB loader proof.

Task review and independent whole-branch source/font/cache review pass with no blocking
findings. Regression expectations remain independent of the production copy table; every
individual stale-count reversal fails. The original finding body is preserved byte-for-byte.

Fresh registry facts: core **5.15.0**, SVG **4.4.0**; main OpenGraph **2.12.0**. Production
still requires reviewed core **5.16.0**, then SVG **4.4.1** publication and the inherited
provider/consumer release gates. Feature pushes may run the existing automatic OG beta
workflow; exact source-head CI/deployment/card-smoke receipts are recorded in the sprint PR.
Source preparation does not close production acceptance. [Merged plan](../REMEDIATION_PLAN.md).
