# [DEAD-009]: `index.ts` carries a 65-line local `DiscordInteraction` that duplicates the exported one in `types/env.ts`

## Category
Duplicate (internal)

## Location
- `apps/discord-worker/src/index.ts:1028-1092` — local `interface DiscordInteraction` (~65 lines)
- `apps/discord-worker/src/types/env.ts:119` — `export interface DiscordInteraction` (comment: "Consolidated to avoid duplicate definitions across command handlers")
- Also `handlers/buttons/index.ts:20-50` and `handlers/buttons/copy.ts` carry local `ButtonInteraction` shapes

## Evidence
Both interfaces describe the same Discord payload; differences are minor (`type: InteractionType` required in the local one, `values?: string[]`). The `types/env.ts` version exists *specifically* to end this duplication.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH that it is a duplicate; MEDIUM that a straight swap type-checks without a small union tweak |
| **Blast Radius** | LOW — one file |
| **Reversibility** | EASY |
| **Hidden Consumers** | None (type-only) |

## Recommendation
**REFACTOR FIRST** — import `DiscordInteraction` from `./types/env.js`, reconcile the two field differences, delete the local copy; then consider folding the two `ButtonInteraction` shapes into it.
