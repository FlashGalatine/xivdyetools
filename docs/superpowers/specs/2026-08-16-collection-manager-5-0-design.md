# Collection Manager in the 5.0 shell — design

**Date:** 2026-08-16 · **App:** `apps/web-app` (5.0.0) · **Status:** approved design, awaiting implementation plan

## Problem

The 4.x Collection Manager (`src/components/collection-manager-modal.ts`, opened from the
DyeSelector's "Manage Collections" button; adds came from DyeGrid's per-swatch folder button →
`add-to-collection-menu.ts`) is unreachable in the 5.0 shell: `v4-layout.ts` hands every tool one
container for left/right/main panel and each tool's `renderRightPanel()` clears it, so the
DyeSelector built by `renderLeftPanel()` is constructed and immediately detached. Consequences today:

- `CollectionService` records can be **created** by five tool actions (Save mix, Save swap, Save
  character colours, Make a palette → Save to this device, ★ favorites) but never renamed, edited
  or deleted individually — only bulk-cleared from Advanced Options → Data.
- Only `kind: 'palette'` records are visible (Presets → Saved tab). `swap` and `character` records
  are written but no screen lists them.
- Advanced Options → Backup exports/imports tool configs only; favorites and collections cannot be
  moved between browsers.

## Decisions (user, 2026-08-16)

1. **Home:** Presets → **Saved** tab is the shelf (the 8A spec's "saved shelf"; 8B/8C stay parked).
2. **Scope:** 4.x parity **plus** dye editing — rename/re-describe, delete (tombstone), add/remove/
   reorder dyes, **New palette**; all three kinds listed with kind badges.
3. **Backup:** fold favorites + collections into Advanced Options → Backup (one file); no per-record
   export button (the export sheet already covers "copy this palette").
4. **Editor:** a 16A `panel` modal (right slide-over), not detail-page edit mode or inline cards.
5. Dead 4.x code (`collection-manager-modal.ts`, `add-to-collection-menu.ts` and their two
   unreachable call sites) is removed.

## Design

### 1. Data & service (`src/services/collection-service.ts`)

No storage-schema change (`DATA_VERSION` stays `2.0.0`); caps unchanged (50 records, 20 dyes each,
name ≤ 50, description ≤ 200, favorites 40, tombstones 200). Existing API used as-is:
`createCollection`, `deleteCollection` (tombstone), `addDyeToCollection`, `removeDyeFromCollection`,
`reorderCollectionDyes`, `getCollections`, `subscribeCollections`, `exportAll`, `importData`.

One additive change: `updateCollection(id, patch)` accepts an optional `dyes: DyeId[]` so the editor
commits an edited list atomically. Rules: every entry a stainID (1–254, reject otherwise — same
guard as `addDyeToCollection`), deduplicated preserving first occurrence, length 1–20 (0 rejected;
>20 rejected). `updatedAt` bumps; subscribers notified once. `kind` and `target` are never editable.

### 2. Saved tab = the shelf (`src/components/v4/preset-tool.ts`, `preset-card.ts`)

- The Saved pool wraps **all** `CollectionService` records, not only `kind: 'palette'`
  (`localPaletteToUnified` → `localRecordToUnified`, carrying `kind` and `target`).
- Cards for local records show a **kind badge** (Palette / Swap → *target dye name* / Character) in
  place of the category chip; the vote pill stays hidden (`isFromAPI: false`); the save pill is
  hidden for local records (they are not community presets).
- Card kebab (local records only): **Edit** → opens the editor; **Delete** → 16A destructive
  confirm (`destructive: true`) → `deleteCollection(id)` (tombstoned). Saved-preset snapshots
  (`saved-presets-service`) keep their existing kebab; nothing there changes.
- Saved-tab toolbar gains **New palette** (respects `canCreateCollection()`; disabled with a
  hint at the 50 cap): creates `createCollection(defaultName, '', {kind: 'palette'})` with a
  unique "Untitled palette N" name and immediately opens the editor on it.
- Empty state copy: "Nothing saved yet — Save mix, Save swap, Save character colours or New palette."
- Detail page (`preset-detail.ts`) stays read-only for local records; its four "TAKE THIS PALETTE
  INTO" handoffs work for every kind (they are stainID lists). Swap records additionally show the
  target dye as the first entry of the palette list with a "TARGET" label.

### 3. Editor: `src/components/v4/saved-record-editor.ts` (new)

A `ModalService` modal, `variant: 'panel'`, `panelWidth: 480`, `type: 'custom'`, opened via an
exported `showSavedRecordEditor(recordId)` (mirrors `showPresetSubmissionForm`). Light DOM
(`#modal-root`) → Tailwind is available, but follow the 8S forms' inline-style conventions for
parity.

Layout (top → bottom):
- Eyebrow: kind word (PALETTE / SWAP / CHARACTER); title "Edit saved palette" (kind-aware).
- **Name** input (required, ≤ 50, live `n/50`), **Description** textarea (≤ 200, live count).
- **Dyes** section: ordered chip list — swatch, localized dye name (`getByStainId` + locale),
  ▲ / ▼ move buttons (disabled at ends), ×  remove. Swap records show the `target` as a locked
  first chip (no move/remove) and the count excludes it. Count line `n / 20`.
- **Add dye**: a searchable dye list identical in behaviour to the 8S submit form's picker
  (search by localized name, click adds; already-present dyes shown disabled). Disabled at 20.
- Footer: **Cancel** (discards; if dirty → 16A confirm "Discard changes?") and **Save** (disabled
  until valid: name non-empty after trim, 1–20 dyes). Save → `updateCollection(id, {name,
  description, dyes})` → close → toast "Saved".
- Keyboard: Esc = Cancel path; Enter in the name field = Save when valid.

Removed: `collection-manager-modal.ts`, `add-to-collection-menu.ts`, DyeSelector's
"Manage Collections" button (`dye-selector.ts:513-525`) and DyeGrid's folder button
(`dye-grid.ts:286-300`), plus their `vitest.config.ts` coverage-exclude lines.

### 4. Backup (`src/components/advanced-options-panel.ts`)

Export writes one JSON file:
```json
{ "version": 2, "exportedAt": "<ISO>", "configs": <ToolConfigMap export>, "collections": <CollectionExport> }
```
Import: detects shape — v2 → configs to `ConfigController`, `collections` to
`CollectionService.importData()` (tombstone- and cap-aware; name conflicts suffixed `_imported_N` as
today); a v1 file (configs-only, today's shape) still imports configs alone. Result toast reports
counts ("Settings restored · 12 palettes · 18 favorites"); errors per part do not abort the other.
Data-section copy updated to say Backup includes favorites and saved palettes.

### 5. Strings ×6 (`src/locales/*.json`, new `saved.*` namespace)

≈ 20 keys: `saved.kind.palette|swap|character`, `saved.newPalette`, `saved.untitled` ("Untitled
palette"), `saved.edit`, `saved.delete`, `saved.deleteConfirm.{title,body,confirm}`,
`saved.editor.{title,eyebrow,name,description,dyes,addDye,search,count,target,save,cancel,discardTitle,discardBody,saved}`,
`saved.empty`, `saved.capReached`. en/de/ja authored; fr/ko/zh drafted with the usual
native-review flag; the locale-parity test enforces all six.

### 6. Testing & docs

- Unit: `saved-record-editor.test.ts` (validation, reorder, add/remove, save payload, cancel/dirty
  confirm, swap target locked); `preset-tool` Saved-tab tests (all kinds listed with badges, New
  palette creates + opens editor, delete tombstones, cap disables New palette);
  `advanced-options-panel` backup round-trip (v1 + v2, per-part failure isolation);
  `collection-service` `updateCollection({dyes})` rules.
- E2E: `e2e/collection-manager.spec.ts` rewritten to create → edit (rename, add, reorder,
  remove) → delete a palette through the Saved tab, and a backup export/import round-trip.
- Docs: `docs/user-guides/web-app/favorites-collections.md`, `docs/projects/web-app/components.md`
  + `tools.md` (presets section), web-app `CHANGELOG.md` 5.0.0 entry (or 5.1 if this ships after
  the merge).

## Out of scope

Drawer-side "add to collection" affordance; a dedicated Saved tool/route (8B); server sync;
per-record export/import; editing `kind`/`target`; character-slot labels on character records.
