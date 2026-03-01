# DEAD-037: Unused Constant Exports in bot-logic

## Category
Unused Export

## Location
- `packages/bot-logic/src/constants.ts` (or equivalent):
  - `HARMONY_TYPES` — array of harmony color scheme types
  - `VISION_TYPES` — array of color vision deficiency types

## Evidence
Monorepo-wide search:
- `HARMONY_TYPES`: Zero imports in discord-worker, web-app, or any other consumer. Only referenced in bot-logic internal tests.
- `VISION_TYPES`: Same pattern — zero external imports.

Both are exported via bot-logic's `index.ts` barrel.

## Why It Exists
These constants define the valid options for `/harmony` and `/accessibility` commands. They were exported to allow consumers to enumerate valid choices (e.g., for Discord command option choices). In practice, the Discord command registration hardcodes the choices directly.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH for monorepo; MEDIUM for npm |
| **Runtime Impact** | NONE |
| **Build Impact** | Negligible |
| **External Consumers** | Published npm package |

## Recommendation
**KEEP** but consider whether these should be part of the public API. They're useful reference constants but have no active consumers. Add `@internal` JSDoc if they're not intended for external use.
