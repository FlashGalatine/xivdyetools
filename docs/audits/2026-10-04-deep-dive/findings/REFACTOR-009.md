# REFACTOR-009: OPEN_ITEMS Phase 0 entry and DOMAIN_DEPRECATION inventory line numbers are stale
**Priority:** LOW · **Effort:** LOW · **Risk:** LOW · **Deploy unit:** root (CI/scripts) · **Origin:** MAIN · **Other units:** docs/operations

## Location
- `docs/operations/OPEN_ITEMS.md:91`

## Evidence
- Reproduction: A reader of OPEN_ITEMS sees Phase 0 not started; the inventory line numbers point at the wrong lines
- Confirmed in part. OPEN_ITEMS.md:91-92 still says '[ ] Start ... Phase 0', but Phase 0 checks 1-3 were recorded on 2026-08-09 and Phase 2 is partly done. The DOMAIN_DEPRECATION inventory line numbers 64/62/75 point at the wrong lines (the routes are at 72/72/110). The DEPLOY_ENVIRONMENTS.md:192,200 sub-claim is rejected: lines 210-212 label that block as the routes 'as they were moved' and point to DOMAIN_DEPRECATION for the current state. Impact is small because the Phase 2 steps go by route pattern, not line number.
  - Checked: docs/operations/OPEN_ITEMS.md:91-92; docs/operations/DOMAIN_DEPRECATION.md inventory rows vs grep (api-worker:110, presets-api:72, moderation-worker:72); DEPLOY_ENVIRONMENTS.md:210-212 disclaimer
- Origin: 8ecb878f:docs/operations/OPEN_ITEMS.md:81 has the same unchecked Phase 0 item. At main the api-worker inventory already said :75 while the route sat at :84. presets/moderation (62/64) were correct at main and moved through PR #224/#225/#229 (f1b54a0f, c7fd9eba, 1eaefd63).

## Fix
- In the PR that schedules Phase 2, tick or replace the OPEN_ITEMS entry with the next real step and drop or refresh the inventory line numbers (cite patterns instead). No package publish needed.

## Status
FIX COMMITTED, NOT DEPLOYED — `26e43a64` (branch `fix/remediation-2026-10-04-sprint20`, root 2.3.2; PR #276, open, on PR #264) strikes through the DOMAIN_DEPRECATION route-line citations. The OPEN_ITEMS half was fixed 2026-10-05 in `223b839f` (PR #228, merged in `fa25c0aa`).
