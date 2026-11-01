# DEAD-023: SwatchResult.character and its legacy ResolvedCharaSlot back-mapping are read by no adapter — ~324 lines
**Confidence:** HIGH · **Blast radius:** MEDIUM · **Deploy unit:** bot-logic (published @xivdyetools/bot-logic 4.11.0) · **Semver:** MAJOR · **Category:** Legacy

## Location
- `packages/bot-logic/src/commands/swatch.ts:33-34,90-110,270-373,403-406,539,632`
- `packages/bot-logic/src/index.ts:128`
- `packages/bot-logic/src/commands/swatch-library.test.ts:88-102,270-406 (rewrite),545-728 (§2),845`

## Evidence
- git grep -w SwatchCharacter|toSwatchCharacter|toLegacySlot|legacyError|LEGACY_* (excl. audits): prod hits only swatch.ts + index.ts:128 (@public); rest are tests/CHANGELOG/docs. git grep executeSwatch: only adapter is apps/discord-worker/src/handlers/commands/swatch.ts:123, which reads ok/error/errorMessage/svgString/embed only (L124-157). stoat-worker: no executeSwatch call (parser.ts:50 lists 'swatch' only). In swatch.ts `character` is only built at L406 and returned at L539/L632. bot-logic is the only prod user of ResolvedCharaSlot outside core (web-app hits are tests). npm view: 4.11.0 == latest == local; git log -S: field since ac701b32, SwatchCharacter since 1e124e6c; CHANGELOG 4.11.0 says shape kept on…
- The claim holds: no in-repo adapter reads result.character, and its whole legacy back-mapping exists only to fill that field. But SwatchResult and SwatchCharacter are @public exports of published bot-logic 4.11.0, and the changelog deliberately kept their shape. Removing them is a MAJOR change. Tests in §1 also use character.slots[].verdict as their oracle, so those assertions need rewriting before the removal. Deprecate first, then remove in the next major.
- Still live: None in the repo (the discord-worker adapter at swatch.ts:123-157 ignores the field). npm consumers of published 4.11.0 are unknown.

## Fix
- **REFACTOR FIRST** — 4.x minor: add @deprecated to SwatchResult.character and SwatchCharacter (MINOR). bot-logic 5.0.0: delete swatch.ts:90-102, the character field (109-110), 270-373, the toSwatchCharacter call (403,406) and `character` in both returns; drop ResolvedCharaSlot/ResolvedCharaCharacter imports; remove index.ts:128; delete swatch-library.test.ts:88-102 + §2 (keep/move the card-row asserts at 716-728); re-pin §1 verdict asserts (270-406) and canary 845 on card/embed; edit swatch.test.ts 251-257,318-322,364-365,438. Gate: pnpm turbo run build type-check lint test…
- Prerequisite: First ship @deprecated tags in a 4.x minor. Then rewrite swatch-library.test.ts §1 (lines 270-406) and the privacy canary (line 845) to assert on the card and embed instead of character.slots.
- Cascade: Removing the mapping removes bot-logic's only production use of core's ResolvedCharaSlot and its legacy verdict, inertReason and error unions. That clears one blocker to retiring core's legacy resolver types; glamour.ts still uses ResolvedCharaCharacter field types. A mapping throw currently surfaces as PARSE_FAILED, and that path goes away with it. Two docs need updating: docs/versions.md:571 and bot-logic CLAUDE.m…
- Published: @xivdyetools/bot-logic 4.11.0 is published (npm latest = local). index.ts:127-128 exports SwatchResult and SwatchCharacter as @public, so removing them is MAJOR and adding @deprecated is MINOR.
- **Maintainer decision:** Cut bot-logic 5.0.0 to drop SwatchResult.character (cancel the removal if an npm consumer of result.character turns up).

## Status
OPEN
