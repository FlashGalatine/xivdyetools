# REFACTOR-003: budget-calculator.ts mirrors the svg ledger geometry with literals (350-43-27, 24, 40, 32, 47) instead of the exported LEDGER_* constants
**Priority:** LOW · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** apps/discord-worker · **Origin:** MAIN · **Other units:** packages/svg

## Location
- `apps/discord-worker/src/services/budget/budget-calculator.ts:52`

## Evidence
- Reproduction: raise LEDGER_ROW_H in budget-ledger.ts -> calculator still packs rows at 40 px, card exceeds 350, cardShell clamps, footer/mark off canvas
- Calculator :52-56 hardcodes the six numbers that budget-ledger.ts:107-116 owns. It uses them at :235/:243 to pack rows. Four of the constants are already exported from the barrel (index.ts:207-215) and go unused. GROUP_H and ROW_H barrel re-exports were removed by 2026-08-18-discord-worker-dead-code/DEAD-015 because nothing imported them. Nothing tests parity.
  - Checked: apps/discord-worker/src/services/budget/budget-calculator.ts:52-56,235,243; packages/svg/src/budget-ledger.ts:107-116; packages/svg/src/index.ts:207-215; packages/svg/CHANGELOG.md:242 (2026-10-04-dead-code/DEAD-015)
- Origin: git show 8ecb878f:apps/discord-worker/src/services/budget/budget-calculator.ts has `350 - 43 - 27` at :52; no diff since 8ecb878f

## Fix
- Option A: import the 4 exported LEDGER_* constants and re-export GROUP_H/ROW_H (justified now that a real consumer exists). Needs an svg publish, then consumer deploys.
Option B (no publish): add a discord-worker parity test that renders generateBudgetLedger at the calculator's maximum packing and asserts height <= 350.

## Status
FIX COMMITTED, NOT DEPLOYED — `4d7df6c2` re-exports the ledger heights; `07c69bce` packs the ledger with them and takes the footer height from the key lines the card draws. (branch `fix/remediation-2026-10-04-sprint14`, svg 4.4.0 + bot-logic 4.8.1 + discord-worker 5.8.6; PR #259, open, on PR #258).
