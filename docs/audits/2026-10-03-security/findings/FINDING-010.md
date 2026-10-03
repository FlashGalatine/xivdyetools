# FINDING-010: PRIVACY.md §What is stored on your device says 'Reset settings' clears favourites, collections, Acquisition edits and the session token; resetAllConfigs() only rewrites tool-config defaults
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/PRIVACY.md §What is stored on your device — variants: `apps/web-app/PRIVACY.md`, `apps/web-app/PRIVACY.ja.md`, `apps/web-app/PRIVACY.ko.md`, `apps/web-app/PRIVACY.zh.md`, `apps/web-app/PRIVACY.de.md`, `apps/web-app/PRIVACY.fr.md` · **CWE:** CWE-1059
**Reconcile case:** 3 (Step 3a)

## Location
- apps/web-app/PRIVACY.md:44-48 — lists collections, Acquisition rewrites and the session token, then says "Reset settings" in Advanced Settings clears it (same claim at PRIVACY.ja.md:22 and the other siblings)
- apps/web-app/src/components/advanced-options-panel.ts:237-241 — the Reset Settings action calls only configController.resetAllConfigs() and dispatches 'settings-reset'
- apps/web-app/src/services/config-controller.ts:381-385 — resetAllConfigs() loops CONFIG_KEYS (global..swatch, 12 tool configs) through resetConfig()

## Evidence
- PRIVACY.md:47-48: 'your community-presets session token. Nothing here is a tracking identifier. "Reset settings" in Advanced Settings and your browser's site-data controls clear it.'
- resetAllConfigs(): void { for (const key of CONFIG_KEYS) { this.resetConfig(key); } } — resetConfig only writes each config key's defaults back to storage (config-controller.ts:367-385)
- grep 'settings-reset' over src (excluding tests) finds only the dispatch (advanced-options-panel.ts:240) and two comments (advanced-options-panel.ts:372, v4-layout.ts:280), so nothing listens for it. StorageService.clear() (storage-service.ts:142-148) has no production caller.

## Fix
- Edit the sentence in PRIVACY.md and its five siblings to match the code: "Reset settings" restores tool settings to their defaults; Advanced Settings also has separate actions to clear favorites and saved palettes; signing out removes the session token; the browser's site-data controls clear everything.
- Optional code alternative, which would also need the policy wording checked: add a real "Clear all local data" action that wipes the xivdyetools_* keys, then point the policy at it.

## Status
OPEN
