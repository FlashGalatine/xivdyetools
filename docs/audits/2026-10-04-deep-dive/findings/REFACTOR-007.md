# REFACTOR-007: logger orphaned MAX_STRINGIFY_NODES JSDoc sits above AUTH_SCHEMES
**Priority:** LOW · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** packages/logger · **Origin:** MAIN

## Location
- `packages/logger/src/core/base-logger.ts:598`

## Evidence
- The S10-R18 MAX_STRINGIFY_NODES JSDoc at base-logger.ts:598-609 is directly followed by a second JSDoc and then const AUTH_SCHEMES at :633. The constant it describes is declared at :730 with no doc, so IDE hover and readers attach the budget text to nothing. Cosmetic.
  - Checked: base-logger.ts:598-633 and :730
- Origin: git show 8ecb878f:base-logger.ts has the S10-R18 doc at :599, AUTH_SCHEMES at :633, MAX_STRINGIFY_NODES at :730

## Fix
- Move the doc block down onto const MAX_STRINGIFY_NODES at :730. Doc-only, so no consumer deploy needed; it ships with the next logger publish.

## Status
OPEN
