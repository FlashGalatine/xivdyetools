# DEAD-040: ResolveColorOptions Type in bot-logic

## Category
Unused Type

## Location
- `packages/bot-logic/src/resolve-color.ts`:
  - `ResolveColorOptions` type (~8 lines)

## Evidence
- Zero explicit imports across the entire monorepo.
- The type is the parameter type for `resolveColorInput()`, but TypeScript infers it structurally when callers pass option objects.
- Exported via the barrel file in `index.ts`.

## Why It Exists
Provides type documentation for the `resolveColorInput()` function's options parameter. Architecturally correct but never imported by name.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH for monorepo |
| **Runtime Impact** | NONE |
| **Build Impact** | None |
| **External Consumers** | Published npm package |

## Recommendation
**KEEP.** Parameter types for public functions should remain exported for consumers who want explicit typing.
