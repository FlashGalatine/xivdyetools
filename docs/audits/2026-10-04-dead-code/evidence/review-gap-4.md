# review-gap-4 (coverage gap: partial rejections refiled)

## Commands run
1. `git grep -n -w -E 'setLocaleFromPreference|preloadLocales|getPresetWithDyes' -- apps packages ':!*.test.ts' ':!**/__tests__/**'`
   -> core defs LocalizationService.ts:282,290(static),609,616(static), PresetService.ts:254; self-calls only (static -> getDefault().x at :291,:617).
   web-app hits are its own methods (hybrid-preset-service.ts:422, language-service.ts:365), unrelated to core. CHANGELOG/JSDoc hits only. No bot-logic/stoat-worker/discord-worker consumer.
2. Same grep restricted to tests: only core LocalizationService.test.ts / PresetService.test.ts (plus web-app LanguageService tests of its own method).
3. `git grep -n -w randomStainId -- apps packages` -> def dye.ts:72, comments (dye.ts:70, factories/index.ts:9, CHANGELOG), one test tests/factories/dye.test.ts:272 (the self-test). No other caller.
4. themes.css: extracted every class-like token containing gray|blue|yellow|red|white from tracked web-app non-CSS, non-test source (git grep -h -o ... | sort | uniq -c) and counted exact-token matches per themes.css selector. Zero-use tokens: bg-gray-100, bg-gray-900, dark:bg-gray-700/50, text-blue-600, text-blue-500, hover:bg-gray-200, dark:hover:bg-gray-700/50, text-yellow-600, dark:text-yellow-400, dark:text-red-400, dark:text-blue-400. Live (count>0): bg-gray-50, dark:bg-gray-700, dark:bg-gray-900, text-red-600 (shared/fatal-error.ts:60), hover:bg-gray-100 (dye-grid.ts:155), hover:bg-gray-300, etc.
5. `git grep -n -E 'text-yellow-600|...' -- apps/web-app/src ':!*.css'` -> only dye-grid.ts:170,336,343 `hover:text-yellow-600` (different class, variant-prefixed; not matched by `.text-yellow-600`).
6. themes.css is imported at apps/web-app/src/main.ts:10 (global, so scope is real; selectors are inert only because no markup emits the classes).

## Candidates
- cand-gap4-01 core LocalizationService.setLocaleFromPreference (instance :282 + static :290): prod=0 outside self-delegation; tests only (LocalizationService.test.ts:474-490,656). Published core API, no @public tag. Test-only; DEAD-018 trigger (next core major) is the natural removal point, so this belongs with DEAD-018 (KEEP until major) unless user wants tagging @public.
- cand-gap4-02 core LocalizationService.preloadLocales (:609 + static :616): same shape; tests only; BUG-058 changelog entry shows it was a deliberate fix, i.e. treated as supported API. KEEP-until-major (DEAD-018 family).
- cand-gap4-03 core PresetService.getPresetWithDyes (:254): no non-test caller anywhere (web-app has its own unrelated method); tested at PresetService.test.ts:551-590. Published API; CHANGELOG 689 documents contract. KEEP-until-major (DEAD-018 family).
- cand-gap4-04 test-utils randomStainId (factories/dye.ts:66-74): used only by its own self-test (dye.test.ts:272); explicitly documented "opt-in" after BUG-007. test-utils is workspace-private (no npm consumers) so delete is safe: remove fn, its test case, import at dye.test.ts:5, and the doc mentions (dye.ts:70, factories/index.ts:9, CHANGELOG note). Check `MAX_STAIN_ID` still used elsewhere in dye.ts before deleting. ~10 src lines + ~10 test.
- cand-gap4-05 web-app themes.css dead selectors (Dead CSS), all with zero emitters in markup/TS: lines 153 `.bg-gray-100`, 154 `.bg-gray-900`, 156 `.dark\:bg-gray-700\/50`, 194-195 `.text-blue-600/.text-blue-500` (whole rule 194-197), 200 `.hover\:bg-gray-200:hover`, 204 `.dark\:hover\:bg-gray-700\/50:hover`, 210-213 whole yellow-deviance rule, 216 `.dark\:text-red-400` (keep `.text-red-600`, live at shared/fatal-error.ts:60), 221-224 whole blue-deviance rule. Selector lists in shared rules must be trimmed, not whole-rule deleted, for 153/154/156/200/204/216. Caveats: matching is on literal tokens; dynamically concatenated class names or e2e/HTML fixtures not checked. Prior C8 note excluded 215-218 (text-red-600 live) - consistent. ~20 lines.

## Rejected / notes
- getSharedColors, getRaceSpecificColors, both getAvailableLocales, hexToRyb/rybToHex: stay under DEAD-018 KEEP (not re-filed).
- web-app LanguageService.preloadLocales / HybridPresetService.getPresetWithDyes: different symbols, not in scope.
- Revisit trigger for DEAD-018 (next core major): not evidenced as met here.
