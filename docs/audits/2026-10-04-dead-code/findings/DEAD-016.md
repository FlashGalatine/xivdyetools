# DEAD-016: web-app: the msw mocks for /presets/featured and /presets/rate-limit and the e2e /featured route only serve removed methods — 34 test lines
**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Stale Test · **Origin:** MAIN · **Cascade of:** DEAD-013, DEAD-015

## Location
- `apps/web-app/src/__tests__/mocks/handlers.ts:162` — msw GET /presets/featured (:162-166) + GET /presets/rate-limit (:296-308) handlers
- `apps/web-app/e2e/preset-gallery-api.spec.ts:129` — page.route('**/api/v1/presets/featured') + its ordering comment (:129-141)

## Evidence
- The /featured handler's only consumer is community-preset-service.integration.test.ts:162-182, which exercises an already-confirmed-dead method. Nothing calls getRemainingSubmissions or fetches /rate-limit in any test, and msw's first-match :id GET at :169 shadows that handler anyway.
  - Commands: git grep -w getFeaturedPresets/getRemainingSubmissions -- . -> web-app: only defs (community:333, hybrid:334/343, submission:428) + integration test:162-175; git grep 'presets/rate-limit' apps/web-app -> handlers.ts:297 + preset-submission-service.ts:441 only; handlers.ts order: http.get presets/:id at :169 precedes /mine :283 and /rate-limit :297
- Nothing in web-app requests /featured at runtime, because hybrid.getFeaturedPresets has no caller. The route is unreached, and the comment at :129-135 describes a code path that no longer runs.
  - Commands: git grep -w getFeaturedPresets -- apps/web-app -> defs + integration test + this comment (:133) only; no caller of hybrid.getFeaturedPresets; git grep -i featured apps/web-app/e2e -> only spec:132-136 and a doc bullet in preset-browser.spec.ts:18 (no route)
- Origin: git grep -c at 8ecb878f gives the same hits in handlers.ts (2), integration test (3), community/hybrid/submission services (2 each). git log 8ecb878f..HEAD on these web-app files shows no commits (the only hit is f1b54a0f, presets-api handlers).

## Fix
**REMOVE.** Delete in the same change as the confirmed HybridPresetService/CommunityPresetService.getFeaturedPresets and PresetSubmissionServiceImpl.getRemainingSubmissions removals. Do not land it alone, or the integration test loses its mock while the method still exists.

Steps: 1. apps/web-app/src/__tests__/mocks/handlers.ts: delete :162-167 (featured handler and blank) and :296-309 (rate-limit handler and blank). 2. apps/web-app/e2e/preset-gallery-api.spec.ts: delete :129-142 (the 7-line comment, the page.route('**/api/v1/presets/featured') block and the trailing blank), and the 'Featured section' doc line at e2e/preset-browser.spec.ts:18. 3. pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app && pnpm dead-code:check, then pnpm --filter xivdyetools-web-app exec playwright test e2e/preset-gallery-api.spec.ts --reporter=list (port 5173 free; the gate does not run e2e).

Sequencing: Lands in the same pull request as DEAD-013 and DEAD-015, as the commit after them: the handlers mock endpoints whose only callers those two findings remove.

## Status
REMOVED, NOT DEPLOYED — `e5a612b5` (branch `fix/remediation-2026-10-04-sprint4`, web-app 5.14.2; PR #245, open, stacked on #244).
