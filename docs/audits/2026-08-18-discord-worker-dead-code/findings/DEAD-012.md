# [DEAD-012]: bot-logic `color-math.ts` — a whole dead module (the surviving twin of the retired match-quality emoji ladder)

## Category
Orphaned Module

## Location
- `packages/bot-logic/src/color-math.ts` (72 lines): `getColorDistance`, `getMatchQualityInfo`, type `MatchQualityInfo`
- `packages/bot-logic/src/color-math.test.ts` (63 lines)
- `packages/bot-logic/src/index.ts` — 3 barrel lines
- Docs: `packages/bot-logic/CLAUDE.md` §"Shared types & helpers" documents both functions
- Related: `apps/discord-worker/src/handlers/commands/gradient.ts:176-180` re-implements a quality ladder inline with **different** thresholds (10/25/50) than core's `classifyMatchDistance` — the documented "single source of truth" is the dead one

## Evidence
`git grep -ln color-math` → only the module, its test and `index.ts`. `git grep -nw getColorDistance|getMatchQualityInfo` outside bot-logic → every hit is `ColorService.getColorDistance` (core) in web-app. The docblock's claim "used by match, mixer, and gradient commands" is false — `/match` was retired and neither mixer nor gradient import it. It is the bot-logic half of the emoji ladder that `DEPRECATIONS.md` says "left every surface" in 5.0 (discord-worker's half is `types/image.ts`, DEAD-003).

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — 3 files + 1 doc section; package is npm-published (semver-minor break for hypothetical external consumers; none known) |
| **Reversibility** | EASY |
| **Hidden Consumers** | stoat-worker imports only `executeDyeInfo`, `resolveDyeInput`, `LocaleCode` |

## Recommendation
**REMOVE** — and, as a follow-up, point `gradient.ts:176-180` at core's `classifyMatchDistance` so the bot and web-app agree on thresholds.

### If Removing
1. Delete `color-math.ts` + test; remove the 3 barrel lines; update CLAUDE.md.
2. `pnpm turbo run build test --filter=@xivdyetools/bot-logic --filter=xivdyetools-discord-worker`; bump bot-logic minor.
