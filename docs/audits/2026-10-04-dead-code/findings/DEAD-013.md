# DEAD-013: getFeaturedPresets: HybridPresetService's has no caller and CommunityPresetService's is test-only — 33 source + 31 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `apps/web-app/src/services/hybrid-preset-service.ts:334` — HybridPresetService.getFeaturedPresets + CommunityPresetService.getFeaturedPresets

## Evidence
- The hybrid method has no caller. The community method is called only by the hybrid one and by community-preset-service.integration.test.ts:162-182. The e2e preset-gallery-api.spec.ts:136 only mocks the URL and nothing in the app requests it.
  - Commands: git grep -n -w getFeaturedPresets -- apps/web-app: hybrid :334,:343; community :333; integration test :162-175; e2e comment :133; git log -S'getFeaturedPresets(' -- apps/web-app/src: 7335387d removed last prod caller (featuredPresets = await hybridPresetService.getFeaturedPresets(4))
- Origin: 7335387d (v3 orphan removal) deleted the only production caller. File unchanged between 8ecb878f and HEAD (diff --stat).

## Fix
**REMOVE.** Leave presets-api GET /featured alone. It is a public route and becomes a separate presets-api follow-up, since after this no in-repo consumer remains (discord-worker's client was dropped in 2026-08-18-discord-worker-dead-code/DEAD-002).

Steps: Delete hybrid-preset-service.ts 331-352 and community-preset-service.ts 330-340. In community-preset-service.integration.test.ts delete the 'Featured Presets Tests' banner and describe at 158-182 (the method's only test). The msw handler and the e2e route that only served this method are DEAD-016, the next commit in the same pull request. Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app and pnpm dead-code:check.

## Status
OPEN
