# DEAD-028: discord-worker `scripts/test-font-rendering.ts` — unreferenced *and* factually wrong since the 2026-08-29 static-font swap; it would now exit 1 on a correct bundle — 76 lines

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/discord-worker · **Semver:** NONE · **Category:** Orphaned File / Legacy

## Location
- `apps/discord-worker/scripts/test-font-rendering.ts:26-34` — `REQUIRED_FONTS` still lists `SpaceGrotesk-VariableFont_wght.ttf` and `Onest-VariableFont_wght.ttf` in `src/fonts/`

## Evidence
- Zero references anywhere: `evidence/script-refs.txt` shows an empty row for `test-font-rendering` — no `package.json` script, no workflow, no doc. Its own header says "Run with: npx tsx scripts/test-font-rendering.ts".
- Its assertion is now false. PR #148 (2026-08-29) replaced the variable faces with static instances because resvg ignores variable fonts: `src/fonts/` holds `SpaceGrotesk-{Regular,SemiBold,Bold}.ttf` and `Onest-{Regular,SemiBold,Bold}.ttf`, and the two `*-VariableFont_wght.ttf` files moved to `scripts/font-sources/`. Running the script today reports "2 required font(s) missing" and exits 1.
- It has been superseded by real gates: `src/services/font-faces.test.ts` (the static instances) and `src/services/font-coverage.test.ts` (TTF `cmap` coverage of every runtime string), both in `test`.

## Fix
**REMOVE.** `git rm apps/discord-worker/scripts/test-font-rendering.ts`. Its one piece of unique knowledge — the fallback-chain ordering rationale (JP must precede SC; KR must follow SC) — already lives in `scripts/subset-cjk-fonts.py` and `fonts-src/README.md`; if `font-faces.test.ts` does not assert the chain order, add that assertion in the same commit rather than losing it.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-discord-worker`.

## Status
FIXED 2026-09-01 `192c81e1` — script deleted; the CJK fallback order it documented in prose is now asserted in `packages/svg/src/base.test.ts`.

