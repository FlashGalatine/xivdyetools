# DEAD-012: GlamourBlock code paths for a missing host (no actionsHost or onSubmitPalette) — ~7 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Dead Path

## Location
- `apps/web-app/src/components/glamour-block.ts:234-242,289,306-311,325,359,567-573,1774-1792`
- `apps/web-app/src/components/glamour-tool.ts:35,79,109,146-149`
- `tests: apps/web-app/src/components/__tests__/glamour-block.test.ts:184,428,749-751,1437, glamour-block-item-links.test.ts:154, glamour-block-palette-name.test.ts:81, chara-collection-privacy.test.ts:189`

## Evidence
- git grep 'new GlamourBlock|\.moveTo\(' apps packages: only prod construction glamour-tool.ts:146 (passes onSubmitPalette + actionsHost) and prod moveTo glamour-tool.ts:109 (passes actions). actionsHost assigned at :79 in render() before blockContainer exists; syncBlock returns early at :141 when container null, so host is always set. GlamourBlockCallbacks has no importer outside glamour-block.ts; glamour-tool imports only `type GlamourBlock`. swatch-tool.ts:1374 + tools.md confirm the Swatch Matcher host left in 5.13.0. Host-less form is used only by tests: glamour-block.test.ts:184,1437,428 (moveTo w/o host), 749-751 (copy-list inside block), item-links:154, palette-name:81, privacy:189. App unpublished, so n…
- The only production host always supplies both callbacks, so the header-actions fallback and the conditional Submit button never run in production. Only tests reach them, and those tests depend on the host-less form, so they have to be changed first. The net source saving is small, about 7 lines.
- Still live: None in production. The host-less form is reached only by the vitest suites listed under files.

## Fix
- **REFACTOR FIRST** — 1) Tests first: give each test GlamourBlock a host div + vi.fn() submit spy (glamour-block.test.ts:184,1437; item-links:154; palette-name:81; privacy:189), pass a host to moveTo at :428, and move the copy-list/export-markdown queries at :749-751 to the host. 2) glamour-block.ts: make both callbacks required, drop `= {}` at :289, make moveTo's actionsHost required, drop the else-branch at :571-573 and the `if (onSubmitPalette)` wrapper at :1774/:1792, and trim the comment at :238-239. 3) glamour-tool.ts:148: pass a non-null host instead of `?? undefined`…
- Prerequisite: Refactor the test suites to pass a host element and an onSubmitPalette spy before the callbacks are made required.
- Cascade: Six test call sites switch to a host plus a spy, and the assertions at glamour-block.test.ts:749-751 move to the host element. glamour-tool.ts:148 drops `?? undefined`, which means the actionsHost field (now HTMLElement|null) has to be narrowed or asserted. No change outside web-app.

## Status
OPEN
