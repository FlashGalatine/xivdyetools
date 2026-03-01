# DEAD-081: @xivdyetools/svg — `baseName` Option Accepted but Never Rendered

## Category
Dead Code Paths

## Location
- File(s): `packages/svg/src/harmony-wheel.ts` (line 33)
- Symbol(s): `baseName` property of `HarmonyWheelOptions`

## Evidence
The `HarmonyWheelOptions` interface declares an optional `baseName` property:

```typescript
export interface HarmonyWheelOptions {
  baseColor: string;
  baseName?: string;       // <-- declared here
  harmonyType: string;
  dyes: HarmonyDye[];
  width?: number;
  height?: number;
}
```

However, `baseName` is never destructured or referenced in the `generateHarmonyWheel` function. It's accepted as part of the options object but completely ignored during SVG generation. Searching the entire file:

- The string `baseName` appears exactly **once** — in the interface declaration at line 33
- It is not destructured in the function parameters
- It does not appear in any SVG text element

## Why It Exists
Likely planned for displaying the base dye name on the harmony wheel visualization but never implemented.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — demonstrably unused within the function |
| **Blast Radius** | LOW — optional property; removing it won't break callers passing it |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Callers that pass `baseName` (e.g., bot-logic harmony.ts) would get a type error only if they object-literal-enforce extra properties |

## Recommendation
**REMOVE WITH CAUTION** — Either implement the rendering or remove the option

### Rationale
- Dead option is misleading — consumers expect it to have an effect
- If `baseName` should appear on the wheel (e.g., as a title or center label), implement it
- If it's not needed, remove the property from the interface

### If Removing
1. Check if `bot-logic/src/commands/harmony.ts` passes `baseName` to the options
2. If yes, remove from both the interface and the call site
3. If no, just remove from the interface
4. Run `npm test -- --run` to verify
