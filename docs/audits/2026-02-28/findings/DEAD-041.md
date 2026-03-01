# DEAD-041: REFACTOR Comment Markers in bot-logic

## Category
Cosmetic / Tech Debt Indicator

## Location
- `packages/bot-logic/src/` — 2 `// REFACTOR` or `// TODO: REFACTOR` comments

## Evidence
- Grep for `REFACTOR` across bot-logic source finds 2 occurrences.
- These are code comments, not executable code.
- They mark areas where the author intended future cleanup.

## Why It Exists
Standard development practice — leaving breadcrumbs for future refactoring passes.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | N/A — not code |
| **Runtime Impact** | NONE |
| **Build Impact** | NONE |
| **External Consumers** | None |

## Recommendation
**LOW PRIORITY.** Either address the refactoring or remove the stale comments. Not dead code per se, but included for completeness as tech debt markers discovered during analysis.
