# DEAD-051: core LocalizationService.setLocaleFromPreference and preloadLocales are test-only published API — 52 source + 60 test lines
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/core · **Semver:** MAJOR · **Category:** Test-only · **Origin:** MAIN

## Location
- `packages/core/src/services/LocalizationService.ts:282` — LocalizationService.setLocaleFromPreference (instance :282, static :290)
- `packages/core/src/services/LocalizationService.ts:609` — LocalizationService.preloadLocales (instance :609 + static :616)

## Evidence
- Test-only. The only non-test hits are the definitions, the static-to-instance delegation at :291 and JSDoc examples. The gate misses it because of that self-reference (raw text). No consumer in web-app, discord-worker, bot-logic or stoat-worker.
  - Commands: git grep -n -w setLocaleFromPreference -- . ':!docs/audits/**': prod = defs :282,:290 + delegation :291 + JSDoc :161,:273; tests LocalizationService.test.ts:474-494,656-664; npm view @xivdyetools/core version gives 5.8.0; at fc11c8b2 the symbol is present at :282/:290
- Narrowed to preloadLocales. The getLabel half is DEAD-049. Core preloadLocales was already unreached in production at main: the web-app wrapper only calls its own loadWebAppTranslations, so this does not depend on DEAD-023/02. It is published API, so KEEP.
  - Commands: git grep -n -w preloadLocales -- apps packages: core :609/:616-617 (self-delegation) + core tests only; web-app :365-368 calls loadWebAppTranslations, not core; fc11c8b2 (core 5.8.0 = npm view version) contains both methods; LocalizationService exported from packages/core/src/index.ts:16 ('.' export)
- Re-verified independently in the completeness re-sweep: Test-only. Non-test hits are the definitions plus the static delegation at :617. web-app LanguageService.preloadLocales (language-service.ts:365) is a separate method that never calls core.
- Origin: `git grep -n -w setLocaleFromPreference 8ecb878f -- apps packages` gives the same defs and delegation at :282/:290/:291, and tests only. Present in published core 5.8.0 (fc11c8b2:LocalizationService.ts:282,290). The PRs do not touch the file (`git diff --stat 8ecb878f HEAD` is empty).

## Fix
**KEEP.** Published core API (`.` exports to dist/index.js, and the barrel exports LocalizationService). Revisit trigger: the next core major (2026-09-15-dead-code/DEAD-018 family). Until then, tag both methods `@public`, as getAvailableLocales already is, so the KEEP is explicit and no longer hidden by the self-reference. Removal cascades: resolveLocaleFromPreference (core barrel :20) loses its only production caller, and LocalePreference (packages/types) loses its last use.

Steps: At the core major: delete LocalizationService.ts 262-292 (instance JSDoc and body, plus the static) and the class-level @example at 153-162. Delete LocalizationService.test.ts 474-494 and 656-664. Then remove or `@public`-tag resolveLocaleFromPreference (LocalizationService.ts ~70-95, barrel index.ts:20) and decide on LocalePreference (packages/types). Add a core CHANGELOG entry. Run `pnpm turbo run build type-check lint test --filter=...@xivdyetools/core && pnpm dead-code:check`.

Steps (LocalizationService.preloadLocales (instance :609 + static :616)): At the next core major: 1. Delete packages/core/src/services/LocalizationService.ts:597-618 (JSDoc + instance + static preloadLocales). 2. In packages/core/src/services/__tests__/LocalizationService.test.ts, delete :619-628 (describe preloadLocales) and :711-730 (static preloadLocales tests with the BUG-058 comment). 3. Rewrite the setup calls in the 'clear() drops every loaded locale' test (:736-738) and the getColorWheelName beforeAll (:754) to await Promise.all(locales.map(l => LocalizationService.ensureLocaleLoaded(l))); ensureLocaleLoaded is public static at :258. 4. Bump the major and add a changelog entry. 5. Run pnpm turbo run build type-check lint test --filter=...@xivdyetools/core, then pnpm dead-code:check.

## Status
KEEP (register) — revisit on the trigger above
