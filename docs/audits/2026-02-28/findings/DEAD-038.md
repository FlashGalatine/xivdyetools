# DEAD-038: Unused Input/Result Type Exports in bot-logic

## Category
Unused Type

## Location
- `packages/bot-logic/src/types.ts` and individual execute files:

### Input Types (~10)
- `HarmonyInput`, `DyeInfoInput`, `RandomInput`, `MixerInput`, `GradientInput`, `MatchInput`, `ComparisonInput`, `AccessibilityInput`

### Result Types (~10)
- `HarmonyResult`, `MixerResult`, `GradientResult`, `GradientStepResult`, `MatchResult`, `MatchEntry`, `ComparisonResult`, `AccessibilityResult`, `DyeInfoResult`, `RandomResult`

### Enum-like Types (~4)
- `HarmonyColorSpace`, `BlendingMode`, `MatchingMethod`, `MixerMatch`

**Total: ~24 type exports with zero external consumers**

## Evidence
For each type, searched across the entire monorepo (excluding bot-logic itself and test files):
- discord-worker: Zero explicit type imports from bot-logic. The worker calls `execute*()` functions and uses the return value structurally without importing result types.
- web-app: Zero imports (web-app uses @xivdyetools/core directly, not bot-logic).
- All other apps: Zero imports.

TypeScript's structural typing means consumers can use `Awaited<ReturnType<typeof executeHarmony>>` instead of importing `HarmonyResult`, which is exactly what discord-worker does.

## Why It Exists
bot-logic was designed as a fully typed SDK with explicit input/result contracts. The types are architecturally correct and well-defined — they simply have no consumers who import them by name.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH for monorepo; LOW for npm (these ARE the public API surface) |
| **Runtime Impact** | NONE (types are erased) |
| **Build Impact** | None |
| **External Consumers** | Published npm package — these types ARE the intended public API |

## Recommendation
**KEEP ALL.** These are the documented public API types of a published npm package. Having zero current consumers doesn't make them dead — they're the package's type contract. Consider whether discord-worker should adopt explicit type imports for better code clarity.
