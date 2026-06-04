# DEAD-125: Empty modal-handler scaffolding + dead modal route

## Category
Dead Code Path / Scaffolding (Keep / Monitor)

## Location
- File(s): `apps/discord-worker/src/handlers/modals/index.ts` (10 lines), `apps/discord-worker/src/index.ts`
- Line(s): `modals/index.ts:10` (`export {}`); `index.ts:430` (call), `index.ts:922-933` (`handleModal` → fallback)

## Evidence
New finding. The modal handler module is an empty placeholder:
```ts
// handlers/modals/index.ts — entire file
/** ... This file remains for potential future modal handlers in the main worker. */
export {};
```
The interaction router still wires a modal path that can only ever reject:
```ts
index.ts:430   return handleModal(interaction, env, c.executionCtx, logger);
index.ts:922   async function handleModal(...) {
index.ts:933     return ephemeralResponse('Unknown modal submission.');   // no real branches
```
Modal submissions for moderation moved to `xivdyetools-moderation-worker`, so this worker handles **no** modals — the
`handleModal` body has no cases and always returns the "Unknown modal submission." fallback. The `modals/index.ts` file
exports nothing. This is intentional placeholder infrastructure (per its own comment), so it's KEEP/Monitor rather than a
delete-now.

## Why It Exists
Moderation modals were migrated out to the moderation worker; the empty module + fallback route were left in place as a
hook for future first-party modals.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — the module is empty and the route is unreachable-by-success |
| **Blast Radius** | LOW — removing it would also mean dropping the `INTERACTION_MODAL_SUBMIT` dispatch + `handleModal` |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None currently; the point of the stub is future use |

## Recommendation
**KEEP-MONITOR**

### Rationale
- Documented intentional scaffolding. Cheap to keep, but it should not linger forever — if no first-party modal lands, the
  empty module + `handleModal` fallback can be deleted and the modal dispatch removed.

### If Acting (later)
1. If a modal feature is planned soon, leave as-is. Otherwise delete `handlers/modals/index.ts`, the `handleModal`
   function, and its dispatch in `index.ts`; `pnpm --filter xivdyetools-discord-worker run type-check && run test`.
