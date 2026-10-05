# Review gap-4: chara-sheet.ts full read + character-name surfaces

Origin of all candidates: MAIN unless stated (chara-sheet.ts is in the post-79a69d1f set; no open PR touches it).

## Map
| Module | Role |
|---|---|
| chara-sheet.ts:145 `saveCharacterColors` | one best dye per slot -> `kind:'character'` record named nickname / fileName / default |
| chara-sheet.ts:183 `CharaSheet` | init/destroy (subscribe to CharaSessionService), render, slot-card click -> `onSlotPick` |
| glamour-block.ts:1711 `localPaletteName` / :1728 `saveLocalPalette` | `kind:'palette'` record, same nickname fallback, with a suffix loop |
| collection-manager-modal.ts:21,510,527 | lists every kind, Export All, per-collection download |
| add-to-collection-menu.ts:41 | lists every kind (unfiltered) in each dye card's menu |
| preset-tool.ts:427 | Saved shelf = `kind==='palette'` only |

## Candidates

### gap4-01 BUG MEDIUM chara-sheet.ts:166 (origin MAIN)
Claim: a second "Save character colors" (or a prior palette with the same name) fails with the generic "save failed" toast, because `createCollection` rejects duplicate names and this path has no suffix loop (glamour-block.ts:1731-1738 has one).
Failing state: user clicks Save palette -> "Save to this device" with empty field (record named "Real Name", kind palette), then Save character colors (nickname "Real Name"); or clicks Save character colors twice.
Outcome: `createCollection` returns null (collection-service.ts:633-636), toast `errors.saveChangesFailed` at :168; nothing is saved and nothing says why. Same toast on the 50-collection cap (:644).
Tests miss it: chara-sheet.test.ts:131-143 is the happy path only. Covered: no.
```
const record = CollectionService.createCollection(name, undefined, { kind: 'character' });
if (!record) { ToastService.error(LanguageService.t('errors.saveChangesFailed')); return; }
```
Fix: reuse the `saveLocalPalette` suffix loop (extract a shared "uniqueCollectionName"), and distinguish the duplicate / cap cases in the toast.

### gap4-02 BUG LOW chara-sheet.ts:162-165 (origin MAIN)
Claim: `resolved.nickname ?? (fileName || default)` uses `??`, so an empty or whitespace Nickname wins over the fallback (parser keeps any string: chara-parser.ts:487). glamour-block.ts:1719 uses `||` for the same fallback.
Failing input: `.chara` with `"Nickname": ""` (or "   ").
Outcome: name "" -> trimmed empty -> createCollection returns null (collection-service.ts:627-630) -> "save failed" toast; the file card also renders a blank title (chara-file-card.ts:295, same `??`). The user can never save that character.
Tests miss it: no empty-nickname case. Covered: no.
Fix: normalise in the parser (`trim() || null`) or use `||` plus trim at both sites.

### gap4-03 BUG MEDIUM chara-sheet.ts:162-166 (origin MAIN) - re-adjudication of webapp-glamour-03
Verdict: CONFIRMED as a policy defect, graded MEDIUM, not as a network leak. Nothing here is sent over the network (collection-service.ts has no fetch; `logger.info` at :174 is dev-only, shared/logger.ts:152). The brief's rule says names are "never sent or stored", and the shipped decision is narrower: PRIVACY.md:35-39 and the 2026-09 changelog allow an on-device fallback. That documented exception does not cover this path:
- PRIVACY.md:35-36 names only "a glamour or its palette" saved "without typing a name". The `Save character colors` record has no name field at all (chara-sheet.ts:162), so it is the nickname every time, not a fallback. The doc is incomplete for it.
- Surfaces holding the nickname for `kind:'character'`: Collection Manager list (collection-manager-modal.ts:21), Export All JSON (collection-service.ts:837-850, `getCollections()` unfiltered), per-collection download whose filename embeds it (collection-manager-modal.ts:535, `xivdyetools-<name>.json`), and every dye card's Add-to-collection menu (add-to-collection-menu.ts:41, unfiltered, so the real name shows in menus anywhere in the app, in screenshots and on stream). The Saved shelf excludes it (preset-tool.ts:427) and the community form never receives it.
- `kind:'palette'` (glamour-block.ts:1719) also reaches the Saved shelf (preset-tool.ts:427,713-716) and its detail share link carries only the id (preset-detail.ts:758), so no outbound path there; it is the same on-device exception, shown on a more public-looking surface (shelf cards, stream).
- The export JSON and filename are the one place the name can leave the device, through a user-initiated backup that users share (import/export is a feature).
Tests: chara-sheet.test.ts:139 and glamour-block-palette-name.test.ts:116 pin the nickname as the record name, so a fix has to change both.
Fix direction: name character records from the neutral localized `swatch.characterDefaultName` (+ unique suffix) and drop the nickname fallback for `kind:'palette'` too, or keep it and (a) say so in PRIVACY.md for the character record, (b) strip the name from the download filename. Decide with the maintainer: this contradicts the brief's rule but matches the documented exception.

### gap4-04 BUG LOW chara-sheet.ts:415-418 (origin MAIN)
Claim: the slot-card click listener calls `this.render()`, which `clearContainer`s and rebuilds every card, destroying the focused `<button>`.
Failing state: keyboard user tabs to a card and presses Enter/Space.
Outcome: focus drops to `<body>`/the shadow host; next Tab restarts from the top of the page and screen readers lose their place. (The swatch host may also re-render and re-create the sheet with `selectedSlot`.) Mouse users are unaffected.
Tests miss it: chara-sheet.test.ts asserts the ring only (:120-127), not `document/shadow activeElement`. Covered: no.
Fix: update the selection ring in place (toggle styles on the previous and new card, or `aria-pressed`), or restore focus to the new button after render. Cards also expose no `aria-pressed`/`aria-current` for the selected state.

## POSITIVE
- chara-sheet.ts destroy/unsubscribe path is clean; `init` re-subscription replaces `unsubscribe` only once (swatch-tool owns lifecycle).
- Community preset path does not read the nickname (glamour-block.ts:1706-1709), and `communityPaletteName` is pinned by tests.
- Unchecked `addDyeToCollection` results are safe here: stainIds are deduped (chara-sheet.ts:153) and the slot count (<= ~9) is under MAX_DYES_PER_COLLECTION=20, so no truncation can occur.
- `slice(0, 50)` matches MAX_COLLECTION_NAME_LENGTH; a >50 nickname is truncated, not rejected.
- Rendering uses textContent via `el()`; the nickname cannot inject markup on the sheet.

## REJECTED
- Nickname leaving via `logger.info` (chara-sheet.ts:174): dev-only (`isDev()` gate, shared/logger.ts:152).
- Nickname reaching a share/submit prefill: `communityPaletteName()` ignores it; the Saved shelf share link is id-only (preset-detail.ts:758).
- Per-dye `saveCollections()` writes (up to ~9 localStorage writes per save): negligible.
- Storage failure swallowed after success toast: `StorageService.setItem` behaviour, owned by the services slice, not this file.
- Per-click re-render recomputing `bestDye` for ~9 slots x 125 dyes: trivial cost.

## COVERED (7)
apps/web-app/src/components/chara-sheet.ts (full), glamour-block.ts:1690-1745, chara-file-card.ts:285-375, collection-manager-modal.ts:15-60,500-545, add-to-collection-menu.ts:36-70, collection-service.ts (create/add/export/get, :575-870), preset-tool.ts:410-430,700-740, preset-detail.ts:735-775, packages/core chara-parser.ts:105-130,487, apps/web-app/PRIVACY.md:20-50, chara-sheet.test.ts:120-143, glamour-block-palette-name.test.ts.
