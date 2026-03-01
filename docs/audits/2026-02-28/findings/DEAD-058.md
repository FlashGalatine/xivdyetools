# DEAD-058: 7 unused auth response sub-types

## Category
Unused Exports (Types)

## Location
- File(s): `packages/types/src/auth/response.ts`
- Line(s): 14–145
- Symbol(s): `AuthSuccessResponse`, `AuthErrorResponse`, `RefreshSuccessResponse`, `RefreshErrorResponse`, `UserInfoData`, `UserInfoSuccessResponse`, `UserInfoErrorResponse`

## Evidence
Monorepo-wide grep returns **zero** import hits for all 7 symbols. Consumers (primarily `apps/oauth`) import only the union types:
- `AuthResponse` — used in oauth app
- `RefreshResponse` — used in oauth app
- `UserInfoResponse` — used in oauth app

`UserInfoData` is defined (L110) and used only as a field type within `UserInfoSuccessResponse` (L121). Neither the sub-types nor `UserInfoData` are ever imported by any consumer.

The `AuthUser` interface (L14 of the same file) IS actively consumed by `test-utils` and `core`.

## Why They Exist
Same pattern as DEAD-057: discriminated union sub-types that consumers never need directly.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero imports monorepo-wide |
| **Blast Radius** | NONE — union type aliases still reference them internally |
| **Reversibility** | EASY — types only |
| **Hidden Consumers** | UNLIKELY |

## Recommendation
**MARK @internal**

### Rationale
Remove from barrel exports. Keep definitions in `response.ts` where they compose the union types.

### If Removing from Barrel
1. Remove the 7 symbols from `src/auth/index.ts` re-exports
2. Remove corresponding re-exports from `src/index.ts`
3. Keep `AuthUser`, `AuthResponse`, `RefreshResponse`, `UserInfoResponse` in barrel (actively consumed)
