# REFACTOR-002: `getMatchQuality` / `getMatchQualityLabel` Duplicated with Variations

## Priority
MEDIUM

## Category
Code Duplication / Inconsistency

## Location
- Files: `packages/bot-logic/src/commands/match.ts`, `mixer.ts`, `gradient.ts`, `packages/svg/src/palette-grid.ts`
- Scope: Function-level

## Current State
Each command has its own version with slightly different signatures and return types:

| File | Returns | Includes Emoji |
|------|---------|---------------|
| match.ts | `{ emoji, label }` | Yes |
| mixer.ts | `string` (combined) | Yes |
| gradient.ts | `string` (label only) | No |
| palette-grid.ts | `MatchQuality` object | No |

All four use the same distance thresholds (15/30/60/100) but format the output differently.

## Proposed Refactoring
Create a single `getMatchQuality()` that returns a structured object:

```typescript
interface MatchQuality {
  key: 'exact' | 'excellent' | 'good' | 'fair' | 'poor';
  label: string;
  emoji: string;
}

export function getMatchQuality(distance: number): MatchQuality { ... }
```

Callers can pick what they need: `quality.emoji + quality.label` or just `quality.label`.

## Benefits
- Consistent thresholds across all commands
- Single place to adjust quality labels for i18n

## Effort Estimate
LOW

## Risk Assessment
Low — behavioral change limited to formatting.
