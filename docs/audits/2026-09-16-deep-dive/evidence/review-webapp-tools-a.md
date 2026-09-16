# Review: webapp-tools-a (web-app — Swatch / .chara import / Gradient / Comparison / Mixer)

Scope: `apps/web-app/src/components/{swatch-tool,glamour-list-actions,item-links-menu,chara-import,gradient-tool,comparison-tool,mixer-tool}.ts`,
`apps/web-app/src/shared/{glamour-markdown,item-links,clipboard,download-file,subrace-clan}.ts`,
`apps/web-app/src/services/{chara-resolve-service,mixer-blending-engine}.ts`.

## 1. Map

| Module | Role |
|---|---|
| `components/swatch-tool.ts` | Swatch Matcher tool: race/category sheets, forward + reverse dye matching, share URL, `.chara` mount point, result-card context actions |
| `components/chara-import.ts` | `.chara` file reader: parse, THIS CHARACTER sheet, DYES ON THIS GLAMOUR (Pieces/Dyes lens), item-links trigger, Copy list / Export .md, Make-a-palette |
| `components/glamour-list-actions.ts` | Lazy-loaded: builds the GPOSERS Markdown/HTML/plain-text payload from a resolved `.chara` + equipment answer |
| `components/item-links-menu.ts` | Lazy-loaded "Open in…" popup (Mirapri/GarlandTools/Teamcraft/GamerEscape/Lodestone), async facewear-base-name resolution |
| `shared/glamour-markdown.ts` | Pure GPOSERS template renderer (md/html/plain) |
| `shared/item-links.ts` | Pure URL builders for the 5 external databases; facewear block-of-12 arithmetic; explicitly no Eorzea Collection |
| `shared/clipboard.ts` | Plain + rich (WebKit-safe, promise-based `ClipboardItem`) clipboard writes |
| `shared/download-file.ts` | Anchor-click file download |
| `shared/subrace-clan.ts` | `SubRace` → `ClanKey` lookup table |
| `services/chara-resolve-service.ts` | `POST /v1/chara/resolve` client: timeout+abort, session cache, malformed-envelope guard |
| `components/gradient-tool.ts` | Gradient Builder: interpolation steps, market prices, share URL, export |
| `components/comparison-tool.ts` | Dye Comparison: up to 4 dyes, share URL, market prices |
| `components/mixer-tool.ts` | Dye Mixer: 2-3 slot blend, mixing field, share URL, result-card context actions |
| `services/mixer-blending-engine.ts` | Pure blend/distance/match functions used by mixer-tool |

## 2. Candidates

### webapp-tools-a-01 — BUG — HIGH — `swatch-tool.ts:2373-2416`, `mixer-tool.ts:2014-2077`
**Claim:** the result-card context menu's "Add to Comparison/Mixer/Accessibility", "See Harmonies" and "Budget" actions dispatch a `window` `CustomEvent('navigate-to-tool', …)` that **no code in the app listens for** — confirmed by `grep -r "navigate-to-tool" apps/web-app` (whole app, not just src): the only matches are the two dispatch sites themselves.

**Failing input → wrong outcome:** user opens a Swatch (or Mixer) match result's context menu → "Add to Comparison". `handleContextAction('add-comparison', dye)` fires `ToastService.success('Added to comparison!')` and dispatches the dead event. Comparison tool never receives the dye; no navigation happens. The toast tells the user it worked.

**Why tests miss it:** `swatch-tool.test.ts` and `mixer-tool.test.ts` have zero references to `context-action` / `handleContextAction` / `navigate-to-tool` (grepped both files, no matches).

**Covered by test:** No.

```ts
case 'add-comparison':
  window.dispatchEvent(
    new CustomEvent('navigate-to-tool', { detail: { toolId: 'comparison', dye } })
  );
  ToastService.success(LanguageService.t('harmony.addedToComparison'));
  break;
```

**Context:** this is exactly the class of bug `shared/tool-handoff.ts` was written to stop (BUG-018/BUG-012, documented in its own header) — `budget-tool.ts`, `gradient-tool.ts`, `harmony-tool.ts` and `v4/result-card.ts` all correctly call `handoffTo(tool, dye)` (grepped, 12 call sites). Swatch and Mixer are the two tools that still use the old, silently-dead event pattern — a regression that slipped back in after the tool-handoff consolidation, not caught because `webapp-v4-16` (result-card context menu untested) was already an open, un-investigated gap.

**Fix direction:** replace the five `window.dispatchEvent(new CustomEvent('navigate-to-tool', …))` blocks in both files with `handoffTo('comparison' | 'mixer' | 'accessibility' | 'harmony', dye)` from `@shared/tool-handoff` (already imported by four sibling tools); `'budget'` has no `HANDOFF_PARAM` entry today and needs one added or the case dropped.

---

### webapp-tools-a-02 — BUG — MEDIUM — `swatch-tool.ts:1545-1549`
**Claim:** the Make-a-palette → "Submit to Community" dynamic import has no failure handling.

**Failing input → wrong outcome:** the `preset-submission-form` chunk fails to load (transient network blip, or a stale HTML shell requesting a chunk hash that a just-completed deploy removed — the "Pages asset cache poisoning" class of event this repo has hit before). The click produces an unhandled promise rejection and the button visibly does nothing — no toast, no retry, no log line a user's report could be matched to.

**Why tests miss it:** no mock ever makes `import('@components/preset-submission-form')` reject, so the path is never exercised; grepped `swatch-tool.test.ts` for `preset-submission-form` / `onSubmitPalette` — no matches.

**Covered by test:** No.

```ts
onSubmitPalette: (dyes, name) => {
  void import('@components/preset-submission-form').then(({ showPresetSubmissionForm }) => {
    showPresetSubmissionForm(undefined, { dyes, name });
  });
},
```

Contrast with `chara-import.ts`'s own lazy imports (`item-links-menu`, `glamour-list-actions`), both of which `.catch()` and surface a toast/fallback state — this is the one dynamic import in scope that skipped that pattern.

**Fix direction:** add `.catch((error) => { logger.warn(...); ToastService.error(...); })` matching the sibling lazy-load call sites in the same file.

---

### webapp-tools-a-03 — REFACTOR (Generic: stale naming) — LOW — `gradient-tool.ts:293,492`
**Claim:** two log lines still say `[MixerTool]` after the v4 rename (`mixer-tool.ts` → `gradient-tool.ts`, noted in the file's own header comment line 4: "V4 Renamed: mixer-tool.ts → gradient-tool.ts"). `destroy()`'s log literally reads `logger.info('[MixerTool] Destroyed')` inside `GradientTool.destroy()`.

**Failing input → wrong outcome:** not a functional bug, but every gradient-tool storage-migration and destroy log line misattributes to the wrong component in production logs/telemetry triage — someone chasing a `[MixerTool] Destroyed` log while investigating the real `MixerTool` (which is a different, still-live class in `mixer-tool.ts`) will look in the wrong file.

**Covered by test:** not applicable (log text).

**Fix direction:** `logger.info('[GradientTool] Migrated dye selection from old storage format')` / `logger.info('[GradientTool] Destroyed')`.

---

### webapp-tools-a-04 — UNTESTED — `swatch-tool.ts:2373-2424`, `mixer-tool.ts:2014-2085`
**Behaviour the missing tests were meant to catch:** that a context-menu action actually reaches its target tool (i.e., `handoffTo`/navigation is invoked with the right stainID) — not just that `handleContextAction` runs without throwing. This is the direct test gap that let `webapp-tools-a-01` land and is the concrete instance of the already-open `webapp-v4-16` (result-card context menu untested) risk — noting it has grown: it now covers a confirmed dead path, not just an unverified one.

---

### webapp-tools-a-05 — UNTESTED — `components/__tests__/swatch-tool.test.ts:684-688`
**Claim:** `it('accepts a dye and does not throw before colours load', ...)` asserts only `expect(() => tool!.selectDye(dye as never)).not.toThrow()`.

**Behaviour the test cannot catch:** whether `selectDye` actually sets `reverseDyeHex`/`reverseDyeName` to the *passed* dye's own hex/name, or whether `performReverseMatch()` scores against the *current* palette rather than a stale one — a swapped-argument bug (e.g. passing `dye.name` where `dye.hex` is expected) or a reversed sort comparator would both still pass this test. (The sibling test two cases down, `'re-runs the reverse match when the sheet changes underneath it'`, does assert real state, so the suite is not blind everywhere — just on this one entry test.)

**Fix direction:** assert `reverseMatchedSwatches`/`reverseDyeHex` (or the rendered ranked list) after the call, not just the absence of a throw.

## 3. POSITIVE

- `shared/clipboard.ts` correctly builds the `ClipboardItem` with promise-valued flavours and starts `navigator.clipboard.write` synchronously inside the click for the WebKit user-activation constraint — `chara-import.ts`'s `copyList()` uses it exactly as documented (start the write in the click, hand the content over as a promise that resolves after the lazy chunk lands).
- `components/item-links-menu.ts` and `chara-import.ts`'s `startResolve()` both guard every async continuation with a monotonically bumped token (`openToken` / `resolved !== this.resolved`) plus `AbortController`, so a fast lens-toggle or file-swap while a network resolve is in flight cannot paint a stale answer over a newer one.
- `shared/item-links.ts` never builds an Eorzea Collection link and documents exactly why (own auto-increment id space, silent wrong-item risk, challenge-protected API) — this is the one deep-dive item explicitly called out to check, and it is correctly absent.
- `services/chara-resolve-service.ts` combines a caller `AbortSignal` with a 12s `AbortSignal.timeout` via `AbortSignal.any`, and treats every failure mode (network throw, non-2xx, unparsable JSON, malformed envelope shape) as `CharaResolveUnavailableError` rather than letting any of them surface as an uncaught rejection or a half-populated result.
- `shared/glamour-markdown.ts` and `glamour-list-actions.ts` correctly keep the character's own nickname out of the community-submission path (`communityPaletteName()` uses only the typed draft) while allowing it as a local-only fallback name (`localPaletteName()`, `saveCharacterRecord()`) — consistent with the `.chara` name-privacy rule.
- `gradient-tool.ts`, `harmony-tool.ts` (referenced), `budget-tool.ts` (referenced) and `v4/result-card.ts` all route hand-offs through `shared/tool-handoff.ts`'s `handoffTo()`, which sends stainID only and refuses a custom (no-stainID) dye rather than mis-encoding it — this is the healthy version of the pattern `webapp-tools-a-01` found broken elsewhere.
- Share-URL loading in `swatch-tool.ts`, `gradient-tool.ts` and `comparison-tool.ts` consistently resolves shared dye params through `ShareService.resolveSharedDye` (stainID) rather than raw itemID lookups, and `mixer-tool.ts`'s own local-storage round trip (`dye.id`, itemID-equal) is kept separate from its share-URL path (`dye.stainID`) — the two id spaces are not crossed.

## 4. REJECTED

- `mixer-blending-engine.ts:162` `excludeIds.includes(dye.id)` looked like a stainID/itemID mix-up at first glance — checked: `Dye.id` is documented (`packages/types/src/dye/dye.ts:50-57`) to always equal `itemID` post-init, and every caller (`mixer-tool.ts:279`) builds `excludeIds` from the same `.id` field, so the space is internally consistent; not a bug.
- `gradient-tool.ts` / `comparison-tool.ts` async price-fetch handlers (`fetchPricesForDisplayedDyes`, `fetchAndUpdatePrices`) don't check `isDestroyed` after `await` — checked: the re-render calls they make afterward either read live service state (idempotent) or write into a possibly-detached DOM subtree, neither of which throws or corrupts shared state; this is a widespread, accepted pattern across the whole tool suite, not a new regression.
- `chara-import.ts`'s `FACEWEAR_NAME_PATTERNS` builds a `RegExp` directly from `facewearColors[].name` — checked the 11 names in `packages/core/src/data/facewear_colors.json`: all plain words (Silver, Gold, Black, …), no regex metacharacters, so no injection/crash risk today; would need re-checking only if a name with punctuation were ever added.
- `services/chara-resolve-service.ts`'s `sessionCache` doesn't dedupe two *concurrent* identical in-flight requests (only completed ones) — real but low-value: at most one duplicate POST per file drop, not a correctness bug; not filed as OPT given the "short lists only" instruction and higher-value candidates above.
- `comparison-tool.ts:2476` comment "Load dyes by itemID" over a loop that actually resolves stainIDs via `ShareService.resolveSharedDye` — stale comment, but the code itself is correct (matches the 5.0 stainID share grammar); too minor to file given the instruction to prefer real defects.

## 5. COVERED

19 files read. Full read (start to end): `components/swatch-tool.ts` (3142 lines), `components/chara-import.ts` (2171 lines), `components/glamour-list-actions.ts`, `components/item-links-menu.ts`, `shared/glamour-markdown.ts`, `shared/item-links.ts`, `shared/clipboard.ts`, `shared/download-file.ts`, `shared/subrace-clan.ts`, `services/chara-resolve-service.ts`, `services/mixer-blending-engine.ts`, `shared/tool-handoff.ts`, `components/base-component.ts`. Substantially read (all risk-pattern sections named in the brief — lifecycle/destroy, storage load/save, share-URL load, context-action handlers, dynamic imports, price-fetch races — plus a full-file grep sweep for `addEventListener`/`navigate-to-tool`/`JSON.parse`/`import(`/`stainID`/`itemID`) but not every line: `components/gradient-tool.ts` (2755 lines), `components/comparison-tool.ts` (2519 lines), `components/mixer-tool.ts` (2214 lines). Cross-referenced: `packages/types/src/dye/dye.ts`, `packages/core/src/data/facewear_colors.json`.
