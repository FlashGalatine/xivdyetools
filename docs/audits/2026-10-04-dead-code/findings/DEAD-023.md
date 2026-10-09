# DEAD-023: web-app LanguageService.getLabel and preloadLocales are test-only — 17 source + 43 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `apps/web-app/src/services/language-service.ts:263` — LanguageService.getLabel
- `apps/web-app/src/services/language-service.ts:365` — LanguageService.preloadLocales

## Evidence
- Static forwarder to core LocalizationService.getLabel. Its only caller is language-service.test.ts:233. share-button.ts:331/347 is an unrelated private getLabel. There is no bracket or alias access, and stoat-worker has 0 references.
  - Commands: git grep -n -w getLabel -- apps packages: in web-app, only language-service.ts:263-264 (decl), test :231-233, and share-button's own private method; git grep -E '(Language|Localization)Service\[' -> 0; no '= LanguageService' alias; scripts/.github/e2e -> 0
- No production caller. Its only references are 4 call sites in language-service.test.ts (:264, :268, :436, :451). initialize/setLocale load translations through loadWebAppTranslations (:95, :103), which stays live after removal.
  - Commands: git grep -n -w preloadLocales -- apps packages: web-app hits are only the decl :365 and test :261-268, :430-451; the rest are core-internal; loadWebAppTranslations callers :95, :103 (live), :368 (this method); bracket/alias access 0; stoat 0
- Origin: git grep -w getLabel 8ecb878f shows language-service.ts:263 already present with no prod caller; git log 8ecb878f..HEAD -- language-service.ts is empty (no open PR touches it)

## Fix
**REMOVE.** Remove this before the core getLabel/labels removal (DEAD-049), or in the same change. The wrapper references LocalizationService.getLabel and Parameters<typeof LocalizationService.getLabel>, so removing core first breaks web-app type-check.

Steps: 1. Delete apps/web-app/src/services/language-service.ts:260-265 (JSDoc + static getLabel). 2. Delete the describe('getLabel') block at apps/web-app/src/services/__tests__/language-service.test.ts:231-235. 3. Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app, then pnpm dead-code:check. Land with or before the core getLabel removal.

Steps (LanguageService.preloadLocales): 1. Delete apps/web-app/src/services/language-service.ts:361-371 (JSDoc + static preloadLocales). 2. In apps/web-app/src/services/__tests__/language-service.test.ts, delete describe('preloadLocales') at :261-270 and the inner describe('preloadLocales behavior') at :430-457, keeping the parent describe. 3. Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app, then pnpm dead-code:check.

## Status
REMOVED, NOT DEPLOYED — `057cba2f` (branch `fix/remediation-2026-10-04-sprint23`, web-app 5.14.7; PR #253, open, stacked on #252).
