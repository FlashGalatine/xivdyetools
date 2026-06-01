# DEAD-091: auth-button.ts (cascade from DEAD-086)

## Category
Orphaned File (cascade)

## Location
- File(s): `src/components/auth-button.ts` (357 lines)
- Symbol(s): `AuthButton` class

## Evidence
`auth-button.ts` has exactly **one** importer in the whole codebase:
```typescript
// src/components/preset-tool.ts:14
import { AuthButton } from '@components/auth-button';
```
and `preset-tool.ts` is itself fully orphaned (DEAD-086). So `auth-button.ts` is **transitively dead** — alive only because a
dead file references it. The v4 shell renders auth UI via `v4/config-sidebar.ts` (which has its own `.auth-buttons` CSS, an
unrelated construct), not this component.

- Git: last meaningful commit **2026-04-29** (a later touch than the rest of the v3 stack — likely a sweep, not a feature).

## Why It Exists
The v3 Discord login button used by the v3 preset tool. The v4 redesign moved auth into the config sidebar.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — sole importer is the orphaned `preset-tool.ts` |
| **Blast Radius** | NONE once DEAD-086 is removed |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — `auth-service.ts` (the live auth logic) is separate and unaffected |

## Recommendation
**REMOVE** (after DEAD-086)

### Rationale
- 357 lines removed. Classic cascade: deleting one orphan exposes the next.

### If Removing
1. Remove DEAD-086 (`preset-tool.ts`) first.
2. Delete `src/components/auth-button.ts`.
3. Confirm `src/services/auth-service.ts` is untouched (it is the live auth path).
4. `pnpm --filter xivdyetools-web-app run type-check && run test`.
