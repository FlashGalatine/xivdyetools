# A-WEB remaining implementation — 2026-10-28

**State:** implementation prepared in web **5.16.4 PATCH**; fresh full-repository,
bundle/i18n/font gates and final Astra source/release review pass. This extends [draft PR #347](https://github.com/FlashGalatine/xivdyetools/pull/347)
from baseline `21d4ebe6`, retaining the earlier 14 security fixes. The maintainer reopened
all 23 deferred A-WEB rows and selected A-OG-COPY, then A-IMAGE, as the following sprints.
The filename companion already assigned to A-WEB under BUG-003 is included as well.
No production merge, publication, manual deployment or feature activation is selected.

## Implemented scope

| Finding | Prepared behavior |
|---|---|
| DEAD-001 | Correct stale character-flow comments and living documentation. |
| DEAD-006 | Remove the redundant issue-map entry; keep the generic warning fallback. |
| DEAD-007 | Include item-ID-zero dyes in both matching views; market filters remain intact. |
| DEAD-008 | Reuse shared character UI font constants. |
| DEAD-009 | Remove unused error status storage; preserve the class and diagnostic message. |
| DEAD-010 | Remove unused resolved-version storage; preserve response-envelope version validation. |
| DEAD-011 | Reject non-null worker dye objects and remove their unused reader. Preserve all other DTO guards, worker null assertions and page-side offline attachment. |
| DEAD-012 | Require the actual action host and submission callback; preserve placement, moveTo and submission behavior. |
| DEAD-013 | Remove inert spectral/dye-selector rules and stale fixture/docs; retain the deliberate generic vendor guard described below. |
| BUG-012 | Invalidate pending sheet opens and close an open sheet before adopting a different character session. |
| BUG-013 | Carry matching-method identity through all three export producers; use native precision/tags in exports and Swatch summaries/badges. |
| BUG-014 | Fence vote-cache writes across mutations and auth changes; reconcile silently restored auth before reading that cache. |
| BUG-015 | Restore settled Swatch cards and Share after locale rerender without reloading/rematching or leaking subscriptions. |
| BUG-016 | Cancel and late edit completion dismiss only their own modal; a committed edit still invokes its callback. |
| BUG-017 | Seed Accessibility display options from canonical configuration before initial results. |
| BUG-018 | Seed and subscribe to canonical Harmony type/count, retaining pin clearing and one generation through bridge echo. |
| BUG-019 | Apply complete supported Comparison display options to initial and live single/duel cards. |
| BUG-020 | Refresh displayed-dye prices after direct Comparison selection and completed Gradient calculation, including restoration and pin/clear paths. |
| BUG-021 | Preserve native nested Save/Vote keyboard actions while article Enter/Space still opens details. |
| BUG-022 | Disable End arming until Start exists, using the existing Start prompt; retain serialization and duplicate rules. |
| BUG-023 | Refresh Mine from the authoritative submissions response after editing; prevent older loads overwriting that result. |
| HC-001 | Localize all four fatal-screen sentences without depending on LanguageService, preserving safe English fallback and real Reload behavior. |
| TERM-001 | Correct five Korean Hue values to the established 색상, including the necessary particle 색상이. |
| BUG-003 companion | Keep the filename cap at 256 UTF-16 units while preserving complete surrogate pairs at its boundary. |

The original catalogs remain historical. Only finding Status sections and report/tracker
status rows are updated; findings remain OPEN pending production acceptance.

## Regression proof and review

Counts here describe each task at its recorded freeze point; the final repository run
below supersedes them as the combined-source gate.

| Group | Captured proof |
|---|---|
| Character/session cleanup | Seven valid initial behavioral failures plus a corrected four-case sheet-lifecycle RED. Restored **1,064 tests /15 files**; four independent reversals fail lifecycle, locale restoration, matching and DTO assertions, then restore exact bytes. |
| Presets | Initial **15 failed /128 passed**; restored five-file compatibility run **181 passed**. Five cache/auth/modal/Mine/keyboard reversals fail assertions and restore exact bytes. The subsequent auth-bootstrap correction has its own RED/reversal and **46-test** restored service run. |
| Controls | Initial eight behavioral failures, then actual pin/clear RED against an incomplete wrapper-only hook. Restored **313 tests /4 files**; ten separate seed/broadcast/fetch/arming reversals fail assertions and restore exact bytes. |
| Localization | Actual startup rejection reproduces ten failures across fatal-copy and terminology cases; restored **22/22**, including six locales and unsupported/empty/missing fallback. The combined reversal fails ten assertions and restores exact bytes. |
| Metric exports | **34 failed /445 passed** before implementation; restored **583 tests /9 files**, including export-sheet, Comparison, budget and tag parity compatibility. Ten independent precision/identity/producer/Swatch reversals fail assertions and restore exact bytes. |
| Filename cap | Real load/session boundary RED and original-slice reversal each fail one test; restored **53/53**. Exact-fit, crossing, many-emoji, short-name and retained ASCII cases pass. |

Independent ordinary review passes character, controls, localization, metrics, the filename
companion and the documented budget adjustment. Final Astra review also passes the combined
source, retained security boundaries and PATCH/stacked release plan. It identified
one narrow auth-bootstrap gap: the auth service restores persisted state without an initial
notification, so a constructor-only comparison snapshot could miss the first logout.
The corrected shared reconciliation runs before an authenticated cache lookup as well as
on notifications. Scoped re-review accepts the fix and confirms header construction stays
on the outgoing request path.

The regression reproduces that real startup ordering, then uses an explicitly synthetic
silent same-session restore to observe the stale cache through a public fetch/result.
It does not claim a production cross-login incorrect result: signed-out calls bypass the
cache and a later notified login already cleared it. Private cache fields are not asserted.

The first character compatibility run exposed stale action-host queries and two invalid
test expectations: the chosen stain was Soot Black, and cumulative ShareButton subscription
registrations differ from active subscriptions. Corrected tests retain clipboard/export,
privacy, real card/share and disposal assertions. The original failed runs remain recorded.
The initial deferred-sheet nickname expectation was invalid and is not counted as proof.

## Compatibility and cleanup decisions

- JSON adds normalized `matchingMethod`, retaining `entries[].deltaE` and legacy/default
  two-decimal behavior. JSON precision is at least the core metric precision, so OKLAB
  `0.004` survives; displayed distances use exact core precision and canonical method tags.
  Generic Delta labels remain where intended, with the method identified nearby.
- Empty Gradient End is unavailable until Start, preserving the existing dense endpoint
  representation without new translations or sparse storage.
- DEAD-013's generic vendor assignment and **30 KB** limit are intentionally retained as a
  future-dependency guard. The original finding itself distinguishes this dormant protection
  from dead rows. Removing it would send future chunks through the **60 KB** default.
  Two fresh builds around the actual cleanup produce **124 byte-identical files**; all
  **48 JavaScript chunks** have identical budget mappings and **22** retain the same default
  limit. No current chunk matches either removed row. The dormant vendor guard is retained,
  rather than described as removed dead code.
- Worker dye-null test bytes remain unchanged. Removing unused page dye readers does not
  relax the response boundary; actual non-null dye objects are rejected.
- The core BUG-003 cap remains 256 UTF-16 units, not 256 code points. Only a split trailing
  surrogate pair is withheld from the filename prefix. Admission size, capped reading,
  cancellation, telemetry and session publication remain unchanged.

No threshold, timeout, exclusion, bundle ceiling, translation exception, dependency,
lockfile, workflow, backend or policy changes are introduced by this remainder.
The existing pending web 5.16.4 release contains the technical and player-facing notes;
the root announcement changelog remains untouched. Private diagnostics and XIVAuth material
remain outside Git.

## Final gates and release handoff

| Final local gate | Result |
|---|---|
| Web/dependents build/type/lint | 9/9 tasks, 6 cached, exit 0. |
| Whole-graph build/type/lint | 45/45 tasks, 42 cached, exit 0. |
| Web type/lint after fixture correction | 8/8 tasks including prerequisites, 6 cached, exit 0. |
| Forced serial full-repository tests | **17,469 tests /604 files /17 workspaces**, 25/25 tasks, 0 cached, exit 0. |
| Configured web coverage | **4,542 tests /145 files**; **88.53% statements /79.15% branches /86.31% functions /89.94% lines**. |
| Build/bundle budget | **2.17/2.20 MB** one-locale JS payload; **2.46/2.73 MB** all-locale emitted JS; all limits pass. Final combined source has **23** default-limit chunks, versus 22 on both sides of the isolated cleanup proof. Removed prefixes remain absent. |
| i18n | 1,197 keys; structural and quality gates clean, 63 same-English groups with only the existing 19 allow-listed divergences. |
| Fonts | Both canonical subset scripts pass; 20 cmaps and all non-head tables match, six timestamp-only outputs restore exact original bytes. Discord **23/23** and OG **15/15** coverage/face/item-name tests pass. |

The initial full-graph attempt failed to import the hybrid-service test because its old,
always-signed-out auth mock omitted the real `getState`/`subscribe` contract. All 4,544 web
tests that collected passed, but that attempt was not a successful graph. An independent
TEST WRONG verdict led to adapting only the mock; its existing three assertions then pass,
and the subsequent pre-retirement full run passed every workspace. The final post-retirement
run in the table passes with the five obsolete tests removed. No production optional-method
guard or test-rule change masks the failure. Both attempts remain recorded privately.

The root reachability gate then caught a cleanup cascade: HC-001 removed the last production
caller of the English-only `ErrorHandler.createUserMessage`. Astra confirmed retirement of
that private method, its sole message table/import, and five obsolete tests. Logging,
normalization, reporting, clearing and their tests remain, as does the unrelated inspection
error map. A valid three-file baseline reversal makes the actual dead-code gate fail again;
exact fixed bytes restore, **43/43** focused startup/handler/constants tests pass, and the
reachability gate passes. Scoped Astra re-review accepts this single final cleanup wave.
The combined graph is refreshed after this retirement; the table reports the final **17,469**
tests. Earlier passing counts remain earlier-source evidence, rather than being relabeled.

The sandboxed local keyboard command stalled without a test summary and its owned process
was stopped. The same isolated two-case command under normal host permissions then passes
**2/2 real Chromium Enter/Space tests in 9.4 seconds**, with no retries or source changes.
The final full-graph refresh also uses normal host permissions after an unchanged core
fixture failed to rename its own temporary directory inside the restricted sandbox. That
unchanged file first passes **15/15** in the native permission context, followed by the
successful full run above. No TEMP/TMP/NODE_OPTIONS override, test skip or assertion change
is used; earlier restricted-context results remain recorded. Fresh pushed-commit Chromium
CI and actual automatic beta receipts are recorded in PR #347 before the next sprint.
No workflow is dispatched or rerun manually.

Root checks pass: **167 script tests**, script types, reachability (**642 production /641
test files**), **34** version claims, **1,063 links across 259 living documents**, and
logging disabled in all **seven** worker configurations. Existing exemption sets are unchanged.
Redacted staged/history secret scans pass before push; actual updated-head CI and automatic
beta receipts are recorded in PR #347.
The [Windows loader correction](../../2026-10-26-security/evidence/remediation-windows-loader-2026-10-28.md)
is retained. Full repository testing uses the default process environment and serial
workspace task orchestration, without relaxing Vitest assertions, timeouts or coverage.

The [earlier A-WEB security evidence](../../2026-10-26-security/evidence/remediation-web-security-2026-10-28.md)
retains its source-specific CI/beta receipts and historical failures. Inherited package
publication, migrations, provider/consumer sequencing and separate activation gates still
apply before production. Source preparation does not establish live production acceptance.
