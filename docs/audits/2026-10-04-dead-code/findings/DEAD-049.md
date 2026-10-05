# DEAD-049: core: getToolName and getLabel, with the `tools`/`labels` locale sections, have no consumer outside core's tests — about 257 source + 100 test lines
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/core · **Semver:** MAJOR · **Category:** Dead Path · **Origin:** MAIN

## Location
- `packages/core/src/services/LocalizationService.ts:499` — getToolName / locale `tools` section / ToolKey
- `packages/core/src/services/LocalizationService.ts:349` — getLabel / locale `labels` section / buildLabels

## Evidence
- getToolName (LocalizationService :499/:507 and TranslationProvider :354) has no caller outside core tests. og-worker's getToolName (og-data-generator.ts:179) is an unrelated local function. Nothing reads the `tools` locale section or ToolKey outside core.
  - Commands: git grep -w getToolName|ToolKey over apps/packages, non-test and non-md: core LocalizationService/TranslationProvider, types index.ts:145 and localization/index.ts:54, and og-worker's own local getToolName. git grep '\btools\b' finds no reader of LocaleData.tools outside TranslationProvider.ts:357-363.
- getLabel (LocalizationService :349/:356 and TranslationProvider :62) has no production caller. Its only non-core caller is web-app LanguageService.getLabel (language-service.ts:263), and only language-service.test.ts:233 calls that wrapper. However, the `labels` data section is load-bearing: LocaleLoader.ts:97 rejects a locale without it.
  - Commands: git grep '\.getLabel\(' and -w getLabel over apps/packages, non-test: core LocalizationService/TranslationProvider, web-app language-service.ts:263-264, and unrelated private share-button.ts:331. git grep '.labels' finds no reader besides TranslationProvider and LocaleLoader.ts:97 (shape check).
- Origin: Core is unchanged 8ecb878f..HEAD and e24741c6 (5.8.0). ToolKey and LocaleData.tools are present in types at 0d82c5cb (types 3.2.0, the version npm has). No PR in pr-delta touches them.

## Fix
**KEEP.** Already @deprecated I18N-003 with removal at a core major. The trigger (next core major, plus a types major for ToolKey/LocaleData.tools) is not met. TranslationProvider.getToolName (:340-354) is not deprecated, and its docblock still claims og-worker uses it. Add @deprecated there in the next core minor.

Steps: At a core major. getToolName: 1. Delete LocalizationService.ts:489-509 and TranslationProvider.ts:~336-370. 2. In build-locales.ts delete buildTools (:815-~870) and the `tools:` line (:250), then regenerate the locales (`tools` is optional, so LocaleLoader needs no change). 3. Prune the getToolName tests in LocalizationService.test.ts, TranslationProvider.test.ts and TranslationProvider.optional-sections.test.ts. The types half (ToolKey, LocaleData.tools) is DEAD-050, in the types major that follows. getLabel, in the same change set: 4. Delete LocalizationService.ts:343-358 and TranslationProvider.ts:49-82, and change LocaleLoader.ts:97 so it stops requiring `labels`. 5. In build-locales.ts delete buildLabels and fallbackLabels (:258-307) and the `labels` lines (:227/:241), plus localize.yaml `labels`; regenerate. 6. In types (same types major as DEAD-050), make LocaleData.labels optional or remove it, and delete TranslationKey (localization/index.ts:17-~30) and its barrel line index.ts:142. 7. Confirm DEAD-023 has landed: it removes web-app's LanguageService.getLabel wrapper, which would otherwise break. 8. pnpm turbo run build type-check lint test --filter=...@xivdyetools/core && pnpm dead-code:check.

## Status
KEEP (register) — revisit on the trigger above
