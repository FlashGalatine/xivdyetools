# DEAD-005: Comments and README describe the legacy parser's errors and value echoes
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** bot-logic + discord-worker (comment/README only; no runtime change) · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/discord-worker/src/handlers/commands/swatch.ts:7-10,14-17,132-135`
- `apps/discord-worker/src/handlers/commands/glamour.ts:177-178`
- `apps/discord-worker/src/handlers/commands/swatch.test.ts:9-10 (missed by reviewer)`

## Evidence
- bot-logic chara-identity.ts:46-51 readCharaForTools = resolveCharaForTools(inspectCharaForTools(src)); swatch.ts:405-418/glamour.ts:444-450 log failureKind and return a fixed localized errorMessage. xivcharakit dist/errors.d.ts: CharaInputError(code) with a fixed messages table (no values); chunk-I7NJZCWD.js:32 name="CharaInputError". Tests assert '\S+ DUPLICATE_KEY' (swatch.test.ts:519, swatch-library.test.ts:868, glamour*.test 486/954), none 'AppError INVALID_INPUT'. 'key presence not TypeName…never Base64Image' rule list is from legacy core chara-parser.ts:50; git grep parseCharaFile in bot-logic/discord-worker src = tests only. Extra stale sites: discord-worker swatch.test.ts:9, bot-logic CLAUDE.md:178.
- Production no longer calls the legacy parser. The library's refusals are a CharaInputError carrying a fixed code and a fixed message, and bot-logic always returns a localized fixed errorMessage. So the comments about the parser echoing field VALUES, the AppError INVALID_INPUT README example and the legacy rule list are all stale. The comments are worth correcting: they misstate the privacy rationale. The caution is to keep the sanitiser calls as defense in depth. This is a docs-only change in the published bot-logic README, with no API change, so semver is NONE. Refuter's narrowing: Part of the claim does not hold. The rule list in swatch.ts:7-10 still describes the library reader that core's facade wraps: key presence, gamma on the floats, activation gating, and Base64Image omitted by default. It is not a legacy-only rule set. The value-echo rationale and the AppError INVALID_INPUT README example are stal…

## Fix
- **REMOVE WITH CAUTION** — Reword only, nothing deleted: swatch.ts header 7-10 -> 'reads via core's library-backed facade (inspectCharaForTools)'; swatch.ts 14-17, 132-135, glamour.ts 177-178, swatch.test.ts 9-10 -> 'reader refusals carry fixed codes; bot-logic relays no parser text; sanitiser kept as defense in depth'. README.md:67 -> '[swatch] parse failed: CharaInputError DUPLICATE_KEY'. failure-kind.ts:6-7 and CLAUDE.md:178 -> drop 'the .chara parser quotes field values'. Keep every sanitizeEmbedText call. Gate: pnpm turbo run build type-check lint test --filter=...@xivdyetoo…
- Cascade: None. The sanitizeEmbedText calls and the failureKind behavior stay. The CHANGELOG entries are historical (apps/discord-worker/CHANGELOG.md:1136,1171; packages/bot-logic/CHANGELOG.md:726) and the docs/audits pii-sources snapshots are frozen, so neither should be edited.

## Status
OPEN — source prepared; release pending. [A-BOT-LOGIC evidence](../../2026-10-26-security/evidence/remediation-bot-logic-2026-10-27.md).
