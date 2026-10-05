# Review: webapp-v4-presets (12 files, ~7.2k lines)

Origin: `git diff 8ecb878f HEAD` on `apps/web-app/src/components/v4/` is empty, so every candidate is MAIN.

## Map
| Module | Role |
|---|---|
| preset-tool.ts (1228) | Gallery: tabs, pool slicing, load/search/sort, votes, saved shelf, popstate/deep link |
| preset-detail.ts (1120) | Detail view: vote check, prices, handoff, share/edit/delete |
| preset-card.ts | Gallery card (save/vote on face) |
| result-card.ts (1915) | Dye ticket + context menu + slot-replacement modal |
| display-options-v4 / dye-filters-v4 / toggle-switch-v4 / range-slider-v4 | Config controls |
| language-modal / theme-modal / share-button / base-lit-component | Modals, share, base class |

## Candidates

### webapp-v4-presets-01 BUG MEDIUM preset-tool.ts:541-584 (saved pool), :624-645 (reconcileTombstones)
Saving a local palette (`local-<id>`) breaks the Saved tab. Origin MAIN, tested no.
- Failing state: open the Saved tab, click Save on a local palette card (preset-card.ts:402-405 shows Save because `isFromAPI` is false and `isCurated` is false). `SavedPresetsService.toggle` stores a snapshot with id `local-x` (saved-presets-service.ts:138).
- Wrong outcome (a): `currentTabPool` 'saved' returns `savedList.map(savedToUnified)` AND `localPalettePool()`, so the same id renders twice. Rail counts double too (`categoryCount`).
- Wrong outcome (b): `reconcileTombstones` sees `local-x` absent from the API pool and not curated, so it calls `markDeleted(id, true)`. The user's own palette then shows the "Removed by its author" chip, and is hidden when keepDeleted is off.
- Tests miss it: preset-tool.test.ts has no saved or reconcile cases.
```ts
const live = new Set(this.presets.filter((p) => p.isFromAPI).map((p) => p.id));
for (const saved of this.savedList) {
  if (saved.isCurated) continue;
  const gone = !live.has(saved.id);   // local-* is never "live"
```
- Fix: skip `local-` ids in reconcile; dedupe saved against `localPalettePool` (or hide Save on local cards).

### webapp-v4-presets-02 BUG MEDIUM preset-tool.ts:672-700 (loadPresets), :1104-1112 (search debounce)
No supersede guard on `loadPresets`. Origin MAIN, tested no.
- Failing state: type "ab" (the 300ms debounce fires a load with search="a"), then change the query to "abc" or clear it. The slower earlier response resolves last, so `this.presets` holds the stale filtered pool while the box shows something else. `isLoading=false` also fires from the first response while the second is still pending.
- Worse: `reconcileTombstones` (:642) reads the current `this.searchQuery`, not the query the response was fetched with. A fetch with search="x" is in flight, the user clears the box, the response lands, the guard passes (query is now empty), and every saved community preset not matching "x" is tombstoned. The final state is a filtered pool with an empty box.
- Fix: capture a sequence number or the query at call time, drop stale results, and pass the fetched query to reconcile.

### webapp-v4-presets-03 BUG MEDIUM preset-tool.ts:845-872 (handleCardVote)
Any failed vote is reported as "already voted". Origin MAIN, tested no.
- `communityPresetService.voteForPreset` returns `success:false` with `errorCode` voteFailed, network or notLoggedIn (community-preset-service.ts:394-441) and never throws. The tool's `else` adds the id to `votedIds` and toasts `preset.alreadyVoted` without checking `already_voted` or `errorCode`.
- Failing input: API 500 or offline, so the card flips to "Voted", the toast says already voted, and the vote is not recorded.
- The un-vote branch ignores `success:false` entirely (no toast). The detail view handles both via `voteErrorMessage` (preset-detail.ts).
- Fix: branch on `result.already_voted`, else toast from `errorCode`; add a failure toast for removeVote.

### webapp-v4-presets-04 BUG MEDIUM preset-detail.ts:646-653 (+ community-preset-service.ts:522-535)
A failed vote check zeroes the vote count. Origin MAIN, tested no (the test covers the race, not the failure value).
- `hasVoted()` returns `{has_voted:false, vote_count:0}` on non-OK or network error. `checkVoteStatus` applies `result.vote_count` whenever it is `!== undefined`, so `currentVoteCount` becomes 0.
- Failing state: an authenticated user opens a 12-vote preset while the check endpoint 429s or 500s. The votes badge disappears (gated on `currentVoteCount > 0`) and the button reads "Vote · 0" until a later vote.
- Fix: have the service signal failure (e.g. an undefined count), or skip the overwrite unless the call succeeded.

### webapp-v4-presets-05 BUG LOW preset-tool.ts:915-921 (handleVoteUpdate) vs :208 (votedIds)
List and detail vote state drift. Origin MAIN, tested no.
- `handleVoteUpdate` updates counts only. Vote in the detail, go back: the card shows "Vote". Vote in the list, un-vote in the detail: `votedIds` still holds the id, the card shows "Voted", and a click calls `removeVote`, which fails silently (see -03).
- Fix: sync `votedIds` from the detail's event (add a `voted` flag to the event detail).

### webapp-v4-presets-06 BUG LOW result-card.ts:1125-1132 (handleMenuClick, handleSelectClick), :1456-1480
Two context menus can be open at once. Origin MAIN, tested no.
- Both handlers call `stopPropagation()`, so the `document` click listener never runs for another card's menu or primary button. Open card A's menu, click card B's menu button: A stays open and both pop up.
- Fix: dispatch a card-menu-open event, or close on `composedPath` instead of stopping propagation.

### webapp-v4-presets-07 BUG LOW preset-tool.ts:735-770 (categoryCount), :1007 (tab counts)
Counts disagree with the lists. Origin MAIN, tested no.
- Community `categoryCount` ignores `feedBlend` and `feedHideUnbuyable`. The Saved count ignores `keepDeleted` and the search query on the saved half. The Saved tab badge (`savedList.length`) excludes local palettes that the tab shows.
- Failing state: feedBlend on or keepDeleted off, so the rail reads "Zones 5" over a list of 3.

### webapp-v4-presets-08 OPT LOW preset-tool.ts:1104-1112, :380-386
Search and sort changes always refetch the network pool and flash the spinner, even on the Saved and Mine tabs. Those pools are local (Saved filters locally; Mine ignores the query), and `sortBy` is never applied to saved, mine or local pools, so the Sort button does nothing there.
Fix: refetch only for community and official, and apply sort and search to the local pools.

### webapp-v4-presets-09 UNTESTED MEDIUM apps/web-app/src/components/v4/__tests__/preset-tool.test.ts
The file covers only popstate, deep-link and debounce teardown. `reconcileTombstones` (the BUG-020 full-page guard), vote handling, tab pools and savedFirst are untested. Candidates -01 to -05 live there.

## POSITIVE
- result-card: `getMarketItemID(dye)` for external links, itemID-keyed storage consistent with the receiving tools, a DOM-built slot modal (no innerHTML), listener teardown present.
- preset-tool/detail: the popstate and deep-link `_restoreSeq` guards, the BUG-026 vote-check generation, and the 50-row `PRESET_PAGE_LIMIT` reconcile guard are correct.
- Read-path sanitizers (`sanitizeExampleLink`, `sanitizePreviewImageUrl`) are applied on every route, including saved snapshots.
- Language, theme, share, filter and display components unsubscribe and clear timers on disconnect.

## REJECTED
- ageText ISO-vs-space timestamp: presets-api writes `toISOString()` (preset-service.ts:389, 433), so no NaN.
- range-slider `.value` set before `min/max/step`: every caller (config-sidebar) uses integer steps within 0-100, so it is latent only.
- result-card `getDyeName(dye.id)`: `Dye.id` equals `itemID` (types dye.ts:51-57).
- language-modal/theme-modal stuck `modalId`: `ModalService` dismiss paths all invoke `onClose`.
- Handoff URL param names in preset-detail: outside the slice and consistent with `HANDOFF_PARAM`.
- Duplicate checkVoteStatus/price fetch on mount (connectedCallback plus `updated`): wasteful, not wrong.

## COVERED (12)
All 12 files in webapp-v4-presets.txt, read in full (CSS blocks skimmed). Tests skimmed: preset-tool.test.ts, preset-detail.test.ts. Supporting reads: community-preset-service.ts, saved-presets-service.ts, hybrid-preset-service.ts, tool-handoff.ts, example-link.ts, modal-service.ts.
