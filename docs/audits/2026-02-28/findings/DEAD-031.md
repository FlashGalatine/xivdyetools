# DEAD-031: Legacy Command Markers (discord-worker)

## Category
Legacy Code (Keep / Monitor)

## Location
- `apps/discord-worker/src/index.ts` — 8 commands annotated with `// legacy` or `// Legacy` comments
- Various handler files in `src/handlers/commands/` referenced by these routes

## Evidence
The main dispatch switch in `src/index.ts` has comments marking certain commands as legacy:
- Several commands retain V3-era naming or parameter patterns
- All are still **functional** — they respond to user interactions
- They are routed and executed at runtime

## Why It Exists
During the V4 migration, some commands were carried forward with "legacy" annotations indicating they should eventually be refactored or replaced with bot-logic equivalents.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | LOW — these are **live, functional** commands |
| **Runtime Impact** | HIGH if removed — would break user-facing features |
| **Build Impact** | N/A |
| **External Consumers** | Discord users actively invoking these commands |

## Recommendation
**DO NOT REMOVE.** Track as tech debt for future migration to bot-logic patterns. The "legacy" marker is informational, not an indication of dead code. Included in this audit for completeness and to distinguish from truly dead code like DEAD-022 (mixer handler that is exported but never routed).
