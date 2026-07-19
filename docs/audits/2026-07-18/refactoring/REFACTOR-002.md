# [REFACTOR-002]: Nine tool components duplicate the same lifecycle/pricing/panel scaffolding

## Priority
HIGH

## Category
Code duplication / missing shared abstraction

## Location
`apps/web-app/src/components/{extractor,swatch,gradient,comparison,accessibility,budget,harmony,mixer}-tool.ts` (3555 / 2567 / 2519 / 2484 / 2448 / 2308 / 1888 / 1874 lines) plus `v4/preset-tool.ts`

## Current State
Each BaseComponent tool re-implements, with drift, the same ~6 concerns:

1. **Subscription plumbing** — `languageUnsubscribe` / `configUnsubscribe` / `marketConfigUnsubscribe` fields + onMount subscribe + destroy cleanup in six tools (`accessibility-tool.ts:225-298`, `comparison-tool.ts:157-284`, `budget-tool.ts:193-277`, `extractor-tool.ts:189-459`, `gradient-tool.ts:165-393`, `swatch-tool.ts:212-302`, `mixer-tool.ts:165-676`), while harmony alone uses the `subs` SubscriptionManager (`harmony-tool.ts:301-401`) that exists precisely for this (`shared/subscription-manager.ts`).
2. **Price wiring** — two divergent patterns: getter delegation to `MarketBoardService.getAllPrices()` (`extractor-tool.ts:110-115`, `harmony-tool.ts:136-141`, `gradient-tool.ts:117-122`, `mixer-tool.ts:125-130`) vs. a local map copied from the `fetchPricesForDyes` return value (budget/swatch) — the latter produced BUG-010.
3. **`fetchPrices*` + card-price refresh** — near-identical per-tool methods (`harmony-tool.ts:1644-1684`, `extractor-tool.ts:2858-2890` + `:2950-2970`, `swatch-tool.ts:2283-2303`, `budget-tool.ts:1581-1599`).
4. **v4-result-card construction loops** — the same "create `v4-result-card`; set `data`; copy 7 `show*` display options; attach `context-action` listener" block in at least extractor (`:2805-2849`), swatch (`:1805-1822`), budget (`:1249-1260`, `:1395-1410`), harmony, gradient, mixer.
5. **Market panel/drawer assembly** — `buildMarketPanel` exists (used by extractor) but drawer variants still hand-roll `new MarketBoard(...)` + `setupMarketBoardListeners` (`swatch-tool.ts:895-925`, `mixer-tool.ts:516`, `comparison-tool.ts:439`).
6. **Mobile drawer CollapsiblePanel stacks** — the create-panel/init/setContent triple repeated per section (e.g. `budget-tool.ts:1605-1660`), mirrored in every tool's `renderDrawerContent`.

## Issues
- Bug fixes must be applied N times and drift (BUG-010 exists precisely because budget/swatch diverged from the getter pattern).
- 2,000-3,500-line components are hard to review; behavior-relevant logic is buried in boilerplate.
- Two competing price patterns means every new tool author must guess which to copy.
- Listener/subscription hygiene is re-audited per tool instead of guaranteed by the base.

## Proposed Refactoring
Incremental, in order of value:
1. Adopt `SubscriptionManager` (`shared/subscription-manager.ts`) in all tools; add a `protected subs` to `BaseComponent` and auto-`unsubscribeAll()` in `destroy()`.
2. Extract a `PricedResultsMixin`/helper owning: `showPrices`/`priceData` getters over `MarketBoardService`, a single `fetchPricesFor(dyes)` (delegating to the service), and `refreshCardPrices(cards)`.
3. Extract `renderResultCards(container, items, displayOptions, onContextAction)` producing the `v4-result-card` grid.
4. Fold drawer panel assembly into `services/tool-panel-builders.ts` (a `buildDrawerSections(spec[])` helper).

## Benefits
- BUG-010's class of mis-keyed price lookups becomes impossible (single implementation).
- Estimated 300-600 lines removed per tool (~2,500-4,000 lines total).
- New tools become mostly declarative; audits shrink to the shared modules.

## Effort Estimate
Medium-high: touches all nine tools, but each step is mechanical and independently shippable (1-2 days per step with test runs).

## Risk Assessment
Contained. Existing per-tool unit tests plus E2E cover the extracted behavior; steps 1 and 4 are pure mechanics. Step 2 changes budget/swatch behavior — intentionally, as it fixes BUG-010; verify against the consolidation-active price path. Recommend landing one tool per PR for steps 2-3.

> Source: evidence/web-frontends-analysis.md (2026-07-18 deep-dive, web-frontends area)

## Status

**PARTIAL (step 1 complete) 2026-07-19** — `BaseComponent` now owns a `protected subs: SubscriptionManager` and calls `unsubscribeAll()` in `destroy()`, guaranteeing subscription cleanup for every component. All seven hand-rolled tools (accessibility, budget, comparison, extractor, gradient, swatch, mixer) converted from per-service `xyzUnsubscribe` fields to `this.subs.add(...)`; harmony's private shadowing instance removed in favor of the base one. preset-tool is Lit-based (connectedCallback/disconnectedCallback) and out of step-1 scope — its cleanup was already correct. Steps 2-4 (PricedResultsMixin unifying the two price patterns, shared renderResultCards, drawer-panel builder) remain open — each is independently shippable and recommended one tool per PR per the original plan.
