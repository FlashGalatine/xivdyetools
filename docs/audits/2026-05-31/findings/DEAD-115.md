# DEAD-115: emoji.ts test-only exports (getDyeEmojiOrFallback, hasDyeEmoji, getEmojiCount)

## Category
Unused Export

## Location
- File(s): `apps/discord-worker/src/services/emoji.ts`
- Symbol(s): `getDyeEmojiOrFallback` (L26), `hasDyeEmoji` (L38), `getEmojiCount` (L45)

## Evidence
New finding (not in the Feb audit). Monorepo-wide grep shows each of these three exports is referenced **only** by
`src/services/emoji.test.ts`:
```
emoji.ts:26  export function getDyeEmojiOrFallback(itemId, _hex?) → only emoji.test.ts:7,34-41
emoji.ts:38  export function hasDyeEmoji(itemId)                  → only emoji.test.ts:8,45-54
emoji.ts:45  export function getEmojiCount()                     → only emoji.test.ts:9,58-60
```
The live export from this module is `getDyeEmoji(itemId)` (L18), which has ~16 production callers (e.g.
`handlers/commands/preset.ts:33`). The three siblings were never wired into any handler. Note `getDyeEmojiOrFallback`
takes an unused `_hex?` parameter and just returns the 🎨 fallback — it was built for a richer fallback that never shipped.

## Why It Exists
Helper surface added alongside `getDyeEmoji` for a planned "graceful fallback / coverage introspection" path. Handlers
only ever needed the plain lookup, so the extras became tested-but-unused.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero production consumers; only test references |
| **Blast Radius** | LOW — isolated to emoji.ts + its test |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — private app; not re-exported from any barrel |

## Recommendation
**REMOVE**

### Rationale
- Removes ~25 lines of source + the corresponding `describe` blocks in `emoji.test.ts`.
- Leaves the single live `getDyeEmoji` as the module's clear, minimal surface.

### If Removing
1. Delete the three functions from `src/services/emoji.ts`.
2. Remove their `describe('getDyeEmojiOrFallback'|'hasDyeEmoji'|'getEmojiCount')` blocks + imports from `emoji.test.ts`.
3. `pnpm --filter xivdyetools-discord-worker run type-check && run test`.
