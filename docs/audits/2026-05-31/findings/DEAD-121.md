# DEAD-121: types/preset.ts deprecated re-export shims (migration debt)

## Category
Legacy/Deprecated

## Location
- File(s): `apps/discord-worker/src/types/preset.ts`
- Symbol(s): 4 `@deprecated` re-export blocks (L14-25, L27-35, L37-46, L48-52) re-exporting 15 types from
  `@xivdyetools/types` (`PresetStatus`, `PresetCategory`, `CommunityPreset`, `PresetFilters`, `PresetSubmitResponse`, …)

## Evidence
New finding. Each block carries the JSDoc:
```ts
/** @deprecated Import directly from '@xivdyetools/types' instead.
 *  These re-exports will be removed in the next major version. */
```
Unlike a dead re-export, **most of these are still actively consumed via the deprecated path**:
- `handlers/commands/preset.ts:37-43` imports `CommunityPreset`, `PresetCategory` from `../../types/preset.js`.
- `services/preset-api.ts:18-28` imports 9 of them (`PresetSubmitResponse`, `PresetSubmission`, `PresetEditRequest`,
  `PresetEditResponse`, `VoteResponse`, `ModerationStats`, `ModerationLogEntry`, `PresetFilters`, `CategoryMeta`).

So this is **migration debt**, not dead code — the same pattern as Feb's DEAD-018 / DEAD-047 in other packages. The one
exception is `PresetPreviousValues` (L24), which has **zero** consumers and is delete-now under **DEAD-118**.

## Why It Exists
A back-compat convenience: when preset types were centralized into `@xivdyetools/types`, discord-worker kept local
re-exports so existing imports wouldn't break. The deprecation marker was added but the import migration was deferred.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH that the block is *deprecated-but-used* (verified consumers), so NOT a delete-now |
| **Blast Radius** | MEDIUM — removing the re-exports requires migrating ~2 files' imports to `@xivdyetools/types` |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | The project-specific types in the same file (`PresetNotificationPayload`, `PresetAPIError`, `CATEGORY_DISPLAY`, `STATUS_DISPLAY`) are live — keep them |

## Recommendation
**KEEP-MONITOR** (migrate then remove at next major)

### Rationale
- These shields existing imports; deleting them now would be a churny cross-file change for no behavior gain.
- The clean fix is the migration the JSDoc already prescribes — schedule it with the "next major" bump.

### If Acting (later)
1. Repoint `handlers/commands/preset.ts` and `services/preset-api.ts` type imports to `@xivdyetools/types` directly.
2. Delete the 4 deprecated re-export blocks (keep the project-specific section below them).
3. `pnpm --filter xivdyetools-discord-worker run type-check`. Add a removal-target version to the JSDoc until then.
