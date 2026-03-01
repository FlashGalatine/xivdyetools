# DEAD-061: Entire utility module — zero external consumers

## Category
Unused Exports (Types)

## Location
- File(s): `packages/types/src/utility/index.ts`
- Line(s): 1–72 (entire file)
- Symbol(s): `Result<T,E>`, `AsyncResult<T,E>`, `Nullable<T>`, `Optional<T>`, `isOk` (function), `isErr` (function)

## Evidence
Monorepo-wide grep for each symbol, excluding `packages/types/`:

| Symbol | Hits | Notes |
|--------|------|-------|
| `Result` (as import) | 0 | Only in core's deprecated types barrel re-export |
| `AsyncResult` | 0 | web-app has `createAsyncResult` (unrelated local function) |
| `Nullable` | 0 | All hits are `.nullable()` (zod) or `NonNullable<>` (TS builtin) — false positives |
| `Optional` | 0 | All hits are the English word "optional" in comments |
| `isOk` | 0 | Only in core's deprecated types barrel re-export |
| `isErr` | 0 | All hits are `isUniversalisError` etc. — false positives |

The entire utility module was re-exported by `packages/core/src/types/index.ts` (deprecated), but even through that path, no consumer ever imported these symbols.

The module has a test file (`utility/index.test.ts`, 1,143 lines shared across types tests) that tests the runtime functions `isOk` and `isErr`.

## Why It Exists
The `Result` pattern (Rust-inspired) was scaffolded as a foundation for error handling across the ecosystem. However, the ecosystem adopted `AppError` (from `error/` module) and discriminated unions instead.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — extensive search with false-positive filtering |
| **Blast Radius** | NONE — zero consumers |
| **Reversibility** | EASY — self-contained module |
| **Hidden Consumers** | NONE |
| **Note** | Contains 2 runtime functions (`isOk`, `isErr`) — these are actual dead code, not just type definitions |

## Recommendation
**REMOVE** (defer to next minor version as it changes public API)

### Rationale
The utility module is a textbook example of speculative scaffolding. The Result pattern was never adopted; the ecosystem uses different error handling. All 6 symbols including 2 runtime functions have zero consumers. Removing the entire module cleanly eliminates 72 lines and simplifies the API surface.

### If Removing
1. Delete `src/utility/index.ts`
2. Delete `src/utility/index.test.ts`
3. Remove `./utility` entry from `package.json` exports map (if present)
4. Remove utility re-exports from `src/index.ts` barrel
5. Remove from core's deprecated re-export barrel
6. Run monorepo-wide `type-check`
