# DEAD-116: response.ts test-only builders (autocompleteResponse [new] + embedResponse [continues DEAD-026])

> **STATUS: RESOLVED** (verified 2026-06-15) — executed in `106e94f` (2026-06-04), merged to main via `fbc065f`; the flagged files/symbols are no longer in the tree.

## Category
Unused Export

## Location
- File(s): `apps/discord-worker/src/utils/response.ts`
- Symbol(s): `embedResponse` (L116), `autocompleteResponse` (L137)

## Evidence
`utils/response.ts` is a **live** module — `messageResponse`, `ephemeralResponse`, `deferredResponse`, `errorEmbed`,
`pongResponse` are used throughout. But two of its builders are referenced **only** by `src/utils/response.test.ts`:
```
response.ts:116 export function embedResponse(embed, components?)      → only response.test.ts:9,136-158
response.ts:137 export function autocompleteResponse(choices)          → only response.test.ts:11,184-199
```
- `embedResponse` was already flagged in **2026-02-28 DEAD-026** and is still present → this is its continuation.
- `autocompleteResponse` is a **new** finding: the autocomplete path in `src/index.ts` builds the response inline
  (`Response.json({ type: APPLICATION_COMMAND_AUTOCOMPLETE_RESULT, data: { choices } })`) instead of calling this helper.

## Why It Exists
Convenience builders added to the response toolkit. Handlers settled on `messageResponse` (with embeds inline) and an
inline autocomplete response, so these two never gained a production caller.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — both confirmed test-only |
| **Blast Radius** | LOW — two functions in an otherwise-live file |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — private app; not re-exported |

## Recommendation
**REMOVE** (both)

### Rationale
- Closes the `embedResponse` half of DEAD-026 and removes its newly-found sibling in the same file.
- Keeps `utils/response.ts` to the builders that handlers actually use.

### If Removing
1. Delete `embedResponse` and `autocompleteResponse` from `src/utils/response.ts` (and any now-unused embed/action-row types they pulled in).
2. Remove their `describe` blocks + imports from `response.test.ts`.
3. `pnpm --filter xivdyetools-discord-worker run type-check && run test`.
