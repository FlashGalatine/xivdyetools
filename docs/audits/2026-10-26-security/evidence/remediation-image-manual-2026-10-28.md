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
