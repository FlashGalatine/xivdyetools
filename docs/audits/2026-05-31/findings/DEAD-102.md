# DEAD-102: shared/utils.ts — tested-but-unused helper grab-bag

## Category
Unused Export

## Location
- File(s): `src/shared/utils.ts` (+ `src/shared/__tests__/utils.test.ts`)
- Symbol(s): ~30 generic helpers (see list)

## Evidence
A large set of generic helpers in `utils.ts` are exported and thoroughly unit-tested, but **never called by any production
module** (whole-word grep across non-test src finds references only in `utils.test.ts`):

```
isEven isOdd isNumber isString isObject isNullish toRadians toDegrees lerp
formatNumber repeatString slugify camelToTitle sleep withTimeout deepClone
mergeObjects groupBy chunk flatten intersection filterNulls sortByProperty
isValidEmail isValidURL isValidHexColor isValidHSV isValidRGB escapeHTML
(+ DebouncedFunction type)
```
`utils.ts` also exports **live** helpers (e.g. `clearContainer`, `debounce`) used across components — those stay. Note
`escapeHTML` (this file) is unreferenced in prod; verify which escaping path components actually use before removing it.

⚠️ **Heuristic finding — confirm each symbol with `tsc --noEmit --noUnusedLocals` after removal.** A green test suite here is
*not* evidence of use; it is the very thing keeping these dead.

## Why It Exists
A classic "utility library" accretion: generic helpers added speculatively (and dutifully tested) but the app standardised on a
smaller subset. The unit tests gave the appearance of healthy, used code.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM-HIGH — zero prod references; confirm per-symbol with tsc |
| **Blast Radius** | LOW — internal app surface only (web-app is a leaf; nothing external imports these) |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Possible type-only usage; tsc will reveal. Keep any helper that turns out to be used. |

## Recommendation
**REMOVE** (per-symbol, source + corresponding test cases) — after tsc confirmation

### Rationale
- Several hundred lines of source + test removable; shrinks the helper surface to what the app uses.

### If Removing
1. For each helper above, delete the export + its `describe`/`it` block in `utils.test.ts`.
2. Run `pnpm --filter xivdyetools-web-app run type-check` — any reference will surface as a compile error; restore that one.
3. `pnpm --filter xivdyetools-web-app run test`.
