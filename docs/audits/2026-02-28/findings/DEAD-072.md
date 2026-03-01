# DEAD-072: @xivdyetools/color-blending — 5 Unused Exported Symbols

## Category
Unused Exports

## Location
- File(s): `packages/color-blending/src/index.ts`, `packages/color-blending/src/types.ts`, `packages/color-blending/src/blending.ts`
- Symbol(s): `RGB`, `LAB`, `HSL`, `BlendResult`, `getBlendingModeDescription`

## Evidence
Cross-referenced every import of `@xivdyetools/color-blending` across the monorepo:

**Consumed (5):** `blendColors`, `rgbToLab`, `BlendingMode`, `BLENDING_MODES`, `isValidBlendingMode`

**Unconsumed (5):**
| Symbol | Type | Notes |
|--------|------|-------|
| `RGB` | interface | `{ r, g, b }` — consumers use `@xivdyetools/types/RGB` or inline types |
| `LAB` | interface | `{ l, a, b }` — not imported externally |
| `HSL` | interface | `{ h, s, l }` — not imported externally |
| `BlendResult` | interface | `{ hex, rgb }` — return type of `blendColors()`, consumers infer it |
| `getBlendingModeDescription` | function | Returns description string for a mode — not consumed |

Consumers found:
- `packages/bot-logic/src/commands/mixer.ts` → `blendColors`, `BlendingMode`
- `packages/svg/src/comparison-grid.ts` → `rgbToLab`
- `packages/svg/src/dye-info-card.ts` → `rgbToLab`
- `apps/discord-worker/src/types/preferences.ts` → `BlendingMode`, `BLENDING_MODES`, `isValidBlendingMode`

## Why It Exists
The types (`RGB`, `LAB`, `HSL`, `BlendResult`) are the input/output types for the blending functions. `getBlendingModeDescription` provides human-readable descriptions of blending modes. These make the API self-documenting.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — unused today but part of the public API contract |
| **Blast Radius** | NONE — only 5 type+function exports |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | `RGB`/`LAB`/`HSL` could be used by future web-app mixer tool |

## Recommendation
**KEEP** — Intentional API surface

### Rationale
- Package is only 785 total lines (432 source) — minimal footprint
- Types are structurally essential to the exported functions' signatures
- `getBlendingModeDescription` is a logical companion to `BLENDING_MODES`
- No dead internal code, no deprecated markers, no commented-out blocks
- 0 maintenance burden — the package is clean and stable
