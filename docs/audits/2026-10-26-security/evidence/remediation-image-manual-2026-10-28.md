# A-IMAGE — bot-manual companion, 2026-10-28

This source-only companion changes `matchImageHelp.fileLimitsContent` in all six authored
bot locale files from **10** to **5**, preserving every other character and each existing
unit convention (including French `Mo`). No translation is generated. Discord's manual
renders this value directly; its generic localized image-size rejection remains unchanged.

The companion is a separate deploy unit from image-worker. It prepares truthful help for
the reviewed A-IMAGE mitigation's 5 MiB encoded-input cap; it does not deploy that mitigation
or establish aggregate memory safety. The image finding remains OPEN/PARTIAL pending its
platform acceptance gate.

Fresh registry check: `@xivdyetools/bot-logic` **4.11.0**; local pending **4.12.0**. Fold this
numeric documentation correction into the complete reviewed 4.12.0 source before publication.
If 4.12.0 is published first, recheck and prepare an appropriate patch rather than reusing
that published version. No extra version bump or empty font release is prepared here.

## Verification

The exact six-value diff is checked against the base: no other locale key or prose changes.
Existing locale checks pass **113 tests across five files** after dependency builds.
The first focused attempt could not resolve the unbuilt core entry; its failure is retained
separately from the successful retry. Whole-graph static checks pass **45/45 tasks**
(35 cached); forced serial tests pass **17,481 tests across 604 files in all 17 workspaces**,
**25/25 tasks**, zero cached. Both canonical font generators pass; all twenty font cmaps
and non-head tables match and six timestamp-only outputs are restored to exact original
bytes. Font coverage/static-face checks pass **32 tests**. All six root checks pass,
including **167** script tests. Independent source/release review passes. No new tests
mirror the six numeric edits, and no existing assertions, timeouts, skips or coverage
requirements are relaxed.

## Automatic beta test correction

Initial source `14f859af` passes all four CI jobs and 169 Chromium tests. Its automatic
Discord beta test step fails **1 /1,821** tests before deployment or guild registration:
the cross-button throttle regression unconditionally expects German plural `Sekunden`,
while the real minute-aligned window legitimately has one second remaining and returns
`1 Sekunde`. Both deployment and registration are skipped; this is not a successful beta.

The test-resolver verifier classifies **TEST WRONG**. A controlled `Date.now() =119,999`
reproduces the exact singular/plural failure; fixing that fixture to **90,000** yields
30 seconds remaining and passes the original plural assertion. The spy is restored in
`finally`. All 31st-request blocking, dispatch/tracking counts, shared key, localized text
and ephemeral-response assertions remain unchanged. No production rate-limit code,
threshold, locale wording, timeout or skip is changed. The test-only correction folds into
Discord's existing pending **5.9.7** changelog; there is no new runtime release or version bump.
Post-correction checks pass: **157** file tests, **1,821** Discord tests, **10/10** static
tasks, and a fresh forced full graph of **17,481 tests /604 files /17 workspaces**, **25/25**
tasks, zero cached. Fresh automatic beta receipts remain pending the corrected head's push
and are recorded in the PR after completion.

## Production sequencing

Both source changes must be reviewed and gated. Publish and verify the complete eligible
bot-logic package, deploy and verify the corrected Discord manual, then activate the lower
image-worker cap. Preserve the inherited core/SVG publication and provider/consumer gates.

**Package publication is not a deployment hold:** bot-logic path changes trigger both
Discord and moderation production workflows, which bundle workspace source. Any production
approval hold used for sequencing must be separately authorized and verified; none is assumed
or changed here. There is no main merge, npm publication, manual deployment, command
registration, policy edit or activation in this preparation. Existing automatic feature-branch
beta workflows may run after push; their exact-head receipts are recorded in the companion PR.
