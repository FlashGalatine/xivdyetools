# REFACTOR-005: swatch-tool.ts (3146 lines) and gradient-tool.ts (2755 lines): duplicated desktop/mobile selector code already drifts (mobile steps skip pinnedSteps.clear), a dead left panel and drawer, and a mojibake literal at gradient-tool.ts:825
**Priority:** LOW · **Effort:** HIGH · **Risk:** MEDIUM · **Deploy unit:** apps/web-app · **Origin:** MAIN · **Other units:** none

## Location
- `apps/web-app/src/components/swatch-tool.ts:1041`

## Evidence
- Reproduction: The mobile steps slider leaves stale pins where the desktop slider clears them. This is latent while V4 passes drawerContent: null.
- The drift is real. The desktop steps slider (gradient-tool.ts:895-906) calls pinnedSteps.clear(), while the mobile one (2428-2439) does not. V4 passes drawerContent: null and leftPanel === rightPanel, and renderRightPanel clears that element (973), so the mobile and left-panel copies are built and then discarded. The mojibake bullet at 825 is on main. No dead-code entry covers the panel or drawer removal.
  - Checked: gradient-tool.ts:895-906 vs 2428-2439 (clear() missing in mobile); v4-layout.ts:703-707 leftPanel=rightPanel=mainPanel, drawerContent:null; gradient-tool.ts:825 ' â€¢ ' (also at 8ecb878f); grep of dead-code catalog finds no renderLeftPanel/drawer entry
- Origin: git show 8ecb878f:apps/web-app/src/components/gradient-tool.ts line 825 is identical; git log 8ecb878f..HEAD on both files is empty

## Fix
- Build each selector/settings group from one shared builder, so state sync lives in one place. Drop the V4-dead left panel and drawer paths, and replace the mis-encoded literal with a real bullet (or the right escape).

## Status
FIX COMMITTED, NOT DEPLOYED — `51a058de` + `ccda155f` + `7c187084`: the v4-dead left panel and mobile drawer are removed from gradient-tool.ts and swatch-tool.ts, so one path remains (the drift goes with the duplicate); the mojibake literal went with the dead display. (branch `fix/remediation-2026-10-04-sprint29`, web-app 5.14.9; PR #255, open, stacked on #254).
