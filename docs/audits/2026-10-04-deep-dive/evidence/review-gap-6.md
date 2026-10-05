# review-gap-6: tests that cannot fail (completeness-critic gap)

## Map
| File | Hits opened | Verdict |
|---|---|---|
| components/__tests__/mixer-tool.test.ts | 23 | lifecycle/accept tests vacuous; no language-switch test; getConfig mocked `{}` (:206) |
| components/__tests__/harmony-tool.test.ts | 12 | LanguageService.subscribe no-op (:127); setConfig display/strict tests vacuous |
| components/__tests__/budget-tool.test.ts | 10 | render tests tautological (:466-490); getConfig mocked `{}` (:242) |
| components/__tests__/extractor-tool.test.ts | 8 | adequate: language-switch test invokes real subscribers (:810) |
| components/__tests__/comparison-tool.test.ts | 9 | no language-switch test; selectDye/clearDyes accept-only |
| services/__tests__/api-service-wrapper.test.ts | 6 | typeof only at :48-49,:132; clearCache :89 vacuous |
| services/__tests__/config-controller.test.ts | 5 | each not.toThrow is paired with a state assertion; fine |
| services/__tests__/dye-service-wrapper.test.ts | 5 | typeof only (:39,:149-152) |
| services/__tests__/language-service.test.ts | 4 | :100 weak, others paired |
| services/__tests__/keyboard-service.test.ts | 4 | :179 vacuous; rest ok |
| discord-worker handlers/commands/index.test.ts | 4 | deliberate single smoke + dispatch-drift test; rejected |

## Candidates

### gap6-01 UNTESTED MEDIUM
- harmony-tool.test.ts:127 (+ :99, :192-211)
- Claim: every web-app tool test mocks `LanguageService.subscribe` as `vi.fn().mockReturnValue(() => {})` and none invokes the captured callback (grep `subscribe).mock` finds only harmony :1178, the router listener). The language-switch path in harmony-tool.ts:313, mixer-tool.ts:608, budget-tool.ts:267 and comparison-tool.ts is unexercised.
- Failing input: switch locale while results are on screen -> harmony grid empties, mixer resultsSection is display:none, comparison results rebuild empty.
- Would have caught: a2-01 (harmony), the mixer language `update()` finding (a2-0x, mixer-tool.ts:607), tools-b-01 (comparison renderContent). Extractor shows the right shape at extractor-tool.test.ts:810-821: collect all subscribe calls, invoke each, assert results survive.
- Covered by a test: no. Origin MAIN.
- Fix: one test per tool: select dyes, run `mock.calls` subscribers, `flush()`, assert the result cards/grid/matches are still present and visible.

### gap6-02 UNTESTED MEDIUM
- mixer-tool.test.ts:206 and budget-tool.test.ts:242
- Claim: the ConfigController mock's `getConfig` always returns `{}`, so mount-time seeding from persisted config is never tested.
- Failing input: persisted dyeFilters / displayOptions (showHue=false, showStain=false) -> tool mounts with defaults.
- Would have caught: a2-02 (mixer/budget never seed dyeFiltersConfig, mixer-tool.ts:188) and a2-03 (budget displayOptions reset, budget-tool.ts:201). Neither test file has any assertion containing showHue/dyeFilters/getConfig-with-data (grep).
- Covered: no. Origin MAIN.
- Fix: mockReturnValueOnce a non-default config before mount; assert the rendered cards/filters reflect it.

### gap6-03 UNTESTED LOW
- budget-tool.test.ts:466-490
- Claim: "should render left panel/right panel/drawer content" assert `expect(leftPanel).not.toBeNull()` on elements the test itself created at :425-429; they pass for any implementation, including an empty render.
- Failing input: init() renders nothing -> still green.
- Covered: no. Origin MAIN.
- Fix: assert a known child (market board, results container, match-line slider).

### gap6-04 UNTESTED LOW
- mixer-tool.test.ts:915, :937-939, :989 ; harmony-tool.test.ts:858-882 ; budget-tool.test.ts:510 ; extractor-tool.test.ts:484-501
- Claim: titles promise behaviour but the only assertion is not.toThrow():
  - mixer ":915 accepts a maxResults change" (result count unchecked);
  - ":937 displayOptions change and identical repeat" (the field-equality guard is unobserved);
  - ":989 ignores market fields when `_tool` marker absent" (nothing about market state asserted);
  - harmony ":882 accepts a showNames/showHex/showRgb/showHsv/strictMatching change" (no card or regeneration assertion; :858 asserts only the storage write, not that harmonies regenerated against the new type);
  - budget ":510 accept config via setConfig maxDeltaE:12" (matchLine unchecked, unlike the next test);
  - extractor ":501 applies several keys in one call".
- Failing input: removing the whole branch of setConfig keeps each green.
- Origin MAIN. Fix: assert the observable (re-render, card prop, calls to getAllDyes as the mixer :893 test already does).

### gap6-05 UNTESTED LOW
- keyboard-service.test.ts:179 (also :212)
- Claim: "should handle theme toggle error gracefully" wraps `document.dispatchEvent` in not.toThrow(). `dispatchEvent` never propagates a listener exception (jsdom reports it on window), so this passes even with the try/catch removed from the handler.
- Failing input: handler loses its try/catch -> still green.
- Origin MAIN. Fix: spy on the logger/console error or assert subsequent shortcuts still work.

### gap6-06 UNTESTED LOW
- api-service-wrapper.test.ts:48-49,:132 ; dye-service-wrapper.test.ts:39,:149-152
- Claim: typeof-function checks on a wrapper over core; they cannot fail for any change the compiler already admits. `resolves.not.toThrow()` at api-service-wrapper.test.ts:89 and :472 passes for any resolved value (the :472 test mocks keys() to reject, so only "does not reject" is shown; the cache state afterwards is not asserted).
- Origin MAIN. Fix: delete the typeof tests (type-check covers them) or call the method and assert a result.

## POSITIVE
- extractor-tool.test.ts:810 invokes every captured subscriber and asserts the palette survives (model for gap6-01).
- mixer-tool.test.ts:880-905 already converted not.toThrow tests to getAllDyes-call assertions (webapp-tools-a-13).
- api-service-wrapper.test.ts:311 and discord-worker index.test.ts:29 document the fixed vacuous patterns.
- config-controller.test.ts: not.toThrow always followed by a state or listener assertion.

## REJECTED
- discord-worker handlers/commands/index.test.ts:40-42: one deliberate load-the-barrel smoke assertion, with the dispatch-drift test beside it (:48). Not a defect.
- config-controller.test.ts:285,:355,:562,:773,:792: each has a companion assertion (listener called, getConfig value, isValidConfigKey false).
- language-service.test.ts:117 typeof plus listener-count assertion; :100 `resolves.not.toThrow` does fail on a rejected setLocale, so it has some power; :264/:268 preloadLocales are weak but low value.
- extractor/comparison destroy() not.toThrow tests: lifecycle smoke tests, acceptable.

## COVERED
11 test files opened (grep of every hit plus surrounding context): the 11 files in the Map.
