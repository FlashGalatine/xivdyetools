# DEAD-015: getRemainingSubmissions in preset-submission-service.ts has no caller or test — 41 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Unused Export · **Origin:** MAIN

## Location
- `apps/web-app/src/services/preset-submission-service.ts:428` — PresetSubmissionServiceImpl.getRemainingSubmissions

## Evidence
- The only web-app hit is the declaration. Other hits are presets-api's own server function of the same name. Consumers (my-submissions-modal, preset-edit-form, preset-submission-form, preset-tool) call only submit/getMySubmissions/delete/editPreset.
  - Commands: git grep -n -w getRemainingSubmissions -- . : web-app only preset-submission-service.ts:428; rest is apps/presets-api server code/tests; git grep presetSubmissionService apps/web-app/src non-test: getMySubmissions/deletePreset/editPreset/submitPreset only
- Origin: Present and uncalled at 8ecb878f (git grep 8ecb878f returns the declaration only); no PR touched the file.

## Fix
**REMOVE.** PRESETS_API_URL and REQUEST_TIMEOUT stay in use (:236,:264,:311,:390). Leave presets-api GET /rate-limit (handlers/presets.ts:306) alone. It is a public route with no in-repo client after this, so file it as a separate presets-api follow-up.

Steps: Delete apps/web-app/src/services/preset-submission-service.ts lines 425-466 (docblock, method, trailing blank). No test changes. Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app and pnpm dead-code:check.

## Status
OPEN
