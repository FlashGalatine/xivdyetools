# DEAD-039: EmbedData/EmbedField Types in bot-logic

## Category
Unused Type

## Location
- `packages/bot-logic/src/types.ts`:
  - `EmbedData` interface (~10 lines)
  - `EmbedField` interface (~5 lines)

## Evidence
- Zero imports from any consumer outside bot-logic.
- Used internally by `execute-dye-info.ts` and `execute-comparison.ts` to structure embed-like response objects.
- discord-worker consumes the result objects structurally — it accesses `.embeds[0].fields` without importing the `EmbedField` type.

## Why It Exists
bot-logic produces platform-agnostic "embed" structures (title, description, fields, color) that map to Discord embeds but aren't Discord-specific. These types define that structure.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH for monorepo |
| **Runtime Impact** | NONE |
| **Build Impact** | None |
| **External Consumers** | Published npm package |

## Recommendation
**KEEP.** Same reasoning as DEAD-038 — these are part of the package's type contract. The lack of explicit imports is a code style issue, not dead code.
