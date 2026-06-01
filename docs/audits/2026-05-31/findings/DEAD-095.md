# DEAD-095: language-selector.ts (v3, test-only)

## Category
Stale Test Code / Orphaned-in-Production

## Location
- File(s): `src/components/language-selector.ts` (267 lines),
  `src/components/__tests__/language-selector.test.ts` (271 lines)
- Symbol(s): `LanguageSelector` class

## Evidence
Only its own test imports the source (`__tests__/language-selector.test.ts:22: import { LanguageSelector } from '../language-selector'`).
No production module imports it. Language selection in v4 is handled by `v4/language-modal.ts`. The underlying
`services/language-service.ts` remains live.

- Git: last meaningful commit **2026-02-18** (frozen at the migration commit).

## Why It Exists
The v3 inline language selector. The v4 redesign moved language selection into a modal (`v4/language-modal.ts`).

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — sole importer is its own test; live replacement is `v4/language-modal.ts` |
| **Blast Radius** | NONE — `language-service.ts` is separate and stays |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE** (source + test together)

### Rationale
- 538 lines removed (267 source + 271 test).

### If Removing
1. Delete `src/components/language-selector.ts` and its test.
2. Confirm `services/language-service.ts` is untouched.
3. `pnpm --filter xivdyetools-web-app run test && run type-check`.
