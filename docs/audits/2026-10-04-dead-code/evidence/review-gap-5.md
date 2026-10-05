# review-gap-5: presets-api /featured and /rate-limit cascade

Commands (all from preview worktree, tracked files only):
- `git grep -n -i featured -- apps/web-app/src apps/discord-worker/src apps/moderation-worker/src packages/bot-logic/src`
  -> non-test hits: community-preset-service.ts:331-336, hybrid-preset-service.ts:332-346 only; tests: mocks/handlers.ts:162-165, community-preset-service.integration.test.ts:159-175.
- `git grep -n 'presets/rate-limit' -- 'apps/*/src'` -> preset-submission-service.ts:441 only (plus mocks/handlers.ts:297, test tail).
- `git grep -n 'getRemainingSubmissions' -- apps packages` -> web-app method (preset-submission-service.ts:428) has ZERO callers and zero tests; presets-api's same-named service fn is live (handlers/presets.ts:317).
- `git grep -n 'getFeaturedPresets' -- apps packages` -> no caller of hybrid.getFeaturedPresets (hybrid-preset-service.ts:334) anywhere, tests included.
- `git grep -n 'presets/featured|presets/rate-limit|/featured' -- api-worker discord/moderation/og/stoat workers, web-app e2e+functions, packages, docs/user-guides, developer-guides, projects` -> no other client. e2e/preset-gallery-api.spec.ts:136 mocks /featured (stale, see below). discord-worker CHANGELOG:749 records its own getFeaturedPresets client removed (DEAD-002).

Verdict on the routes: both are DOCUMENTED PUBLIC API, KEEP (route-level), analogous to /moderation/:id/history.
- Documented in 5 places: docs/architecture/api-contracts.md:178 and :201, apps/presets-api/README.md:16,18, docs/projects/presets-api/endpoints.md:119,204, docs/projects/presets-api/overview.md:89, apps/presets-api/CLAUDE.md:106,223,235.
- Tested server-side: presets-api/tests/handlers/presets.test.ts:218 and :285; service tests preset-service.test.ts:347, rate-limit-service.test.ts:158.
- presets-api is the public REST API at api.xivdyetools.app (published contract; third-party clients cannot be seen in-repo). /featured also named in CHANGELOG 2.x privacy notes (author_discord_id handling), so it is part of a stated response-shape contract. Deleting the routes is a breaking API change -> needs a deprecation decision, not a dead-code cleanup.
- Caveat: README.md:16 says "Curated featured presets" but CLAUDE.md:223 says no is_curated filter (top 10 by votes). Doc inaccuracy, not dead code.

Candidates (cascade, web-app side; routes themselves not candidates):
- cand-gap5-01 is the already-confirmed removal set; this file only adds its test tail below.

Web-app test/mocks tail to delete together with the confirmed removals:
1. apps/web-app/src/__tests__/mocks/handlers.ts:162-166 (msw GET /presets/featured) - sole consumer is the integration test below.
2. apps/web-app/src/services/__tests__/community-preset-service.integration.test.ts:159-~180 (`describe('getFeaturedPresets')`, 2 tests).
3. apps/web-app/src/__tests__/mocks/handlers.ts:297 (msw GET /presets/rate-limit): NO test calls getRemainingSubmissions (zero references), so the handler is already orphaned; verify no test hits the URL via fetch before removing (grep showed none).
4. apps/web-app/e2e/preset-gallery-api.spec.ts:127-141 (page.route '**/api/v1/presets/featured' plus its comment): hybrid.getFeaturedPresets has no caller, so the comment's claim that the "featured path" is exercised is false; stale after removal.
5. hybrid-preset-service.ts:332-348 and community-preset-service.ts:331-337 (the methods themselves; cache key 'presets:featured' goes with them - check the cache-key constant is not shared), preset-submission-service.ts:425-~455.
