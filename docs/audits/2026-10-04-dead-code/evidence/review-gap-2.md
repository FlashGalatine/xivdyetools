# review-gap-2: web-app LanguageService test-only statics

Commands (all from the preview-2026-10-04 worktree, tracked files only):
1. `git grep -n -E "LanguageService\.(getLabel|preloadLocales|clearCache|isReady)" -- apps/web-app ':!docs/audits'` -> 18 hits, ALL in apps/web-app/src/services/__tests__/language-service.test.ts (getLabel :233; preloadLocales :264,:268,:436,:451; clearCache :274,:377,:465,:577,:734,:808,:829,:854,:878,:894; isReady :282,:947). Same grep with `grep -v language-service.test.ts` -> 0 hits.
2. `git grep -n -E "= LanguageService\b|LanguageService\[" -- apps/web-app` -> 0 (no aliasing).
3. `git grep -n -E "\.(isReady|clearCache)\(" -- apps/web-app/src apps/web-app/e2e ':!*.test.ts'` -> only APIService/communityService clearCache (different classes), no LanguageService caller.
4. `git grep -n -E "\.getLabel\(|\.preloadLocales\(" -- apps packages ':!docs/audits' ':!*.md' ':!*.test.ts' ':!*/coverage/*'` -> only web-app language-service.ts:264 (calls LocalizationService.getLabel), core LocalizationService.ts:140 (JSDoc), :350,:357,:617 (internal delegation), TranslationProvider.ts:58 (JSDoc). share-button.ts:347 is its own private getLabel. No preloadLocales caller outside core's own static->instance delegation and tests.
5. `git grep -n -E "getLabel|preloadLocales" -- apps/stoat-worker packages/bot-logic` -> 0 (stoat is not a consumer).
6. `grep -n -E "language-service|LocalizationService|getLabel|preloadLocales" evidence/dead-code-check.txt` -> only the @public exemption of LocalizationService.getAvailableLocales; none of the four are tagged, so the gate does not know about them.
7. Why the gate missed them: check-dead-code matches member names on raw text; `getLabel`, `clearCache`, `isReady`, `preloadLocales` also appear as names in other production files (share-button.ts:331/347, api-service-wrapper.ts:247, auth-service.ts:772, core LocalizationService), which reads as a "reference". Name-collision under-report, not a real consumer.

Findings
- language-service.ts:263 static getLabel(key) is a pure forwarder to LocalizationService.getLabel; production callers 0, tests 1 (:233).
- language-service.ts:365 static preloadLocales loads webAppTranslations only; production callers 0, tests 4 call sites (:264,:268 trivial resolves-not-throw; :436,:451 assert cache effects). Note `initialize()`/`setLocale` load locales on their own, so this is an unshipped convenience.
- language-service.ts:377 clearCache / :384 isReady: tests only, but they are reset/observation hooks over real state (webAppTranslations.clear(), isInitialized). clearCache is the beforeEach reset used 10x; isReady reads the init flag. Accepted-hook class: KEEP.
- Core dependency: after the web-app getLabel wrapper is removed, packages/core LocalizationService.getLabel (instance :349, static :356) and preloadLocales (instance :609, static :616) have zero in-repo production callers (only core's own LocalizationService.test.ts :455-532,:675,:717-737,:754). core is published, so this is published-API-without-consumer (DEAD-018 family, trigger: next core major), not deletable now. TranslationProvider.getLabel stays live (used by the instance method). The "getLabel / labels section" core finding needs the web-app wrapper gone first but is still bounded by the core-major trigger.
- DEAD-018 trigger status: NOT met (no core major planned in the preview).

Rejected
- clearCache, isReady: accepted reset/observation hooks (see above).
- TranslationProvider.getLabel: live through LocalizationService.getLabel instance method.
- share-button.ts getLabel: unrelated private method.
