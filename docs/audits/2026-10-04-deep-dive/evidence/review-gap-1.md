# review-gap-1: dyeFilters mount seeding (sibling of webapp-tools-a2-03)

## Map
| Config type (tool-config-types.ts) | dyeFilters field | Tool | Seeds at mount? |
|---|---|---|---|
| HarmonyConfig :60 | yes | harmony-tool.ts:339 | YES |
| ExtractorConfig :82 | yes | extractor-tool.ts:315 | YES |
| GradientConfig :139 | yes | gradient-tool.ts:240-256 | NO |
| MixerConfig :166 | yes | mixer-tool.ts:188 | NO (a2-03, already filed) |
| BudgetConfig :220 | yes | budget-tool.ts:201 | NO (a2-03, already filed) |
| SwatchConfig :251 | yes | swatch-tool.ts:246,374-400 | NO (reads only 'market' at mount) |
| GlobalConfig :34 | yes | sidebar only (config-sidebar.ts:757) | n/a |
| Accessibility :88, Comparison :107, Presets :190 | NONE | n/a | by design |

## Candidates

### gap1-01 BUG MEDIUM — gradient-tool.ts:243-256 (also swatch-tool.ts:246/374-400); origin MAIN
Claim: GradientTool and SwatchTool never seed `dyeFiltersConfig` from persisted config at mount, so saved dye filters are ignored until the sidebar next changes them. Same family as webapp-tools-a2-03 (mixer, budget): four of the six dyeFilters-bearing tools skip it.
Trace (static, read not run):
- Constructor seeds displayOptions/matchingMethod/preventDuplicates from `getConfig('gradient')` (gradient-tool.ts:242-249) but `dyeFiltersConfig` stays at field init `{ ...DEFAULT_DYE_FILTERS }` (:175). The only other write is setConfig (:613-620).
- ConfigController.subscribe (config-controller.ts:346-361) only registers a listener, no initial call. notifyListeners fires only from setConfig (:334), resetConfig (:373) and a cross-tab storage event (:247).
- v4-layout.ts calls tool.setConfig only from the sidebar `config-change` event (:186-192). Sidebar dye-filter events emit key `dyeFilters.${filter}` (config-sidebar.ts:912), so even that path never hits `config.dyeFilters` in the tool's setConfig; filters arrive solely through the controller broadcast (config-sidebar.ts:893-907, which persists to all six tools).
- Matching loop (gradient-tool.ts:1859,1864,1894) then uses DEFAULT_DYE_FILTERS (nothing excluded).
Failing state: user sets "exclude metallic" in the sidebar (persisted for gradient via :907), reloads, opens Gradient, picks two endpoints. Steps include metallic dyes; the sidebar shows the filter on. It self-corrects only after the user toggles any filter. Swatch is the same (field :246, applied :2807-2818, no mount read).
Tests: not covered. swatch-tool.test.ts:723-731 only drives setConfig with not.toThrow; no gradient/swatch test seeds a persisted filter before construction.
Excerpt:
    const gradientConfig = configController.getConfig('gradient');
    this.displayOptions = gradientConfig.displayOptions ?? { ...DEFAULT_DISPLAY_OPTIONS };
    this.matchingMethod = normalizeMatchingMethod(gradientConfig.matchingMethod ?? 'ciede2000');
    this.preventDuplicates = gradientConfig.preventDuplicates ?? true;
    // (no dyeFilters)
Fix: add `this.dyeFiltersConfig = gradientConfig.dyeFilters ?? { ...DEFAULT_DYE_FILTERS }` in gradient, swatch, mixer, budget constructors (harmony-tool.ts:339 is the model), plus a shared "seed persisted config" test per tool. Fix the whole family together.

### gap1-02 UNTESTED MEDIUM — components/__tests__/gradient-tool.test.ts, swatch-tool.test.ts; origin MAIN
No test constructs a tool with a non-default persisted dyeFilters and asserts matching excludes dyes; swatch-tool.test.ts:723 only asserts not.toThrow. The mount-seeding gap in gap1-01 would be caught by any such test. Fix: persist `{excludeMetallic:true}` via ConfigController before constructing, run the matcher, assert no metallic result.

## POSITIVE
- harmony-tool.ts:339 and extractor-tool.ts:315 seed dyeFilters from persisted config correctly.
- Subscribed setConfig paths do apply live sidebar changes (gradient :613-620).

## REJECTED
- "Comparison and accessibility have no dyeFilters handling": their config types (tool-config-types.ts:88,107) have no dyeFilters field and the sidebar broadcast list (config-sidebar.ts:899-906) excludes them. By design, not a defect.
- Sidebar `dyeFilters.${filter}` key never matching tool setConfig `config.dyeFilters` (v4-layout.ts:192): harmless since controller subscription delivers the full object.
- Empirical reload run not performed (read-only brief; no dev server); finding rests on a complete static trace of every call path into dyeFiltersConfig.

## COVERED (7)
apps/web-app/src/components/gradient-tool.ts, swatch-tool.ts, harmony-tool.ts, extractor-tool.ts, mixer-tool.ts (grep/ctor), budget-tool.ts (grep/ctor), components/v4-layout.ts, components/v4/config-sidebar.ts, services/config-controller.ts, shared/tool-config-types.ts, __tests__/swatch-tool.test.ts (grep).
