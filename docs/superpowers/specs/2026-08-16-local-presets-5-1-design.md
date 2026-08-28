# Local presets — the Collection Manager as an extension of Preset Palettes (web-app 5.1)

**Date:** 2026-08-16 · **App:** `apps/web-app` · **Target:** 5.1 (after the 5.0 merge) ·
**Status:** approved design, awaiting implementation plan ·
**Supersedes:** `2026-08-16-collection-manager-5-0-design.md` (removed).

## Problem

The 4.x Collection Manager is unreachable in the 5.0 shell (its invokers lived in the left-panel
DyeSelector that `v4-layout.ts` mounts and `renderRightPanel()` immediately clears). Today
`CollectionService` records are created by five tool actions (Save mix, Save swap, Save character
colours, Make a palette → Save to this device, ★ favorites) but cannot be renamed, edited or deleted
individually; only `kind: 'palette'` records are visible (Presets → Saved tab); Backup exports tool
configs only. Meanwhile the app already has a first-class notion of "a palette with a name,
description, categories and dyes" — the community preset — with cards, a detail page, an editor
form and a moderated publish path.

## Decisions (user, 2026-08-16)

1. A saved palette **is a preset that lives in the browser** — a *local preset* — not a separate
   "collection" concept. Same fields as a community preset; stored locally; shareable by JSON file
   and by self-contained share-link; publishable to the community later.
2. **Superset locally, community rules at publish**: locally 1–20 dyes and optional categories;
   the 3–6-dye / primary-category rules are enforced only when publishing or sharing to community.
   Existing 4.x collections migrate 1:1 with no data loss.
3. **Share-link is self-contained** (the URL carries the preset; no server, no account, no
   expiry). Unlisted community upload is out of scope.
4. **JSON export per preset and whole shelf**; one importer.
5. Budget's "Save swap" and Swatch's "Save character colours" **become local presets too**
   (origin tag; swap target kept as metadata). `CollectionService` keeps favorites only.
6. Home: **Presets → Saved tab** ("your shelf"). Tab name stays *Saved*; the records are called
   *local presets* in copy.
7. Editing reuses the **8S submission form** in a local mode — no second editor component.
8. Ships as **web-app 5.1**, in units (a)–(e) below.

## Design

### 1. Data model & service

```ts
interface LocalPreset {
  id: string;                       // 'lp_' + crypto.randomUUID()
  name: string;                     // 1–50 (trimmed)
  description: string;              // '' | ≤ 200
  dyes: DyeId[];                    // stainIDs 1–254, deduped, 1–20
  category_id?: PresetCategory;     // optional locally; required to publish
  secondary_categories: PresetCategory[]; // ≤ 2, distinct from category_id
  example_link?: string;            // same allowlist as presets-api (validated on publish only)
  previewImage?: { key: string };   // IndexedDB blob key (unit e); never localStorage
  origin: {
    kind: 'authored' | 'mixer' | 'swap' | 'character' | 'imported' | 'link' | 'clone';
    target?: DyeId;                 // swap: the dye being replaced
    sourceId?: number;              // clone: the community preset id
  };
  publishedId?: number;             // set after a successful publish
  createdAt: number; updatedAt: number;
}
```

New `src/services/local-preset-service.ts` — `localStorage` key `v5_local_presets`
(`{version: 1, presets, tombstones, lastModified}`), cap **200** presets, tombstones **200**
(`{id, deletedAt}`; `importData` honours them). API: `getAll`, `get`, `create(input)`, `update(id,
patch)`, `remove(id)` (tombstone), `duplicate(id)`, `subscribe(cb)`, `exportOne(id)`,
`exportAll()`, `importFile(json)`, `contentSignature(dyes,name)` (duplicate detection),
`validateForCommunity(preset)` → list of rule violations (3–6 dyes, primary category, example
link allowlist). Validation on every write: name, dyes (stainID guard identical to today's
`CollectionService.addDyeToCollection`), caps.

**Migration (one-time, on first `initialize()`):** every `CollectionService` record →
`LocalPreset` (`palette` → `origin.kind: 'authored'` unless its name matches the mixer's "A × B"
pattern (→ `'mixer'`); `swap` → `'swap'` + `target`; `character` → `'character'`); tombstones
carried over; then the `xivdyetools_collections` key is removed and `CollectionService`'s
collections API is deleted (favorites API stays; `subscribeFavorites` unchanged). The 4.x
PaletteService migration that already lives in `CollectionService` runs *before* this step, so a
4.x → 5.1 jump lands correctly. Existing write sites (`mixer-tool.ts saveCurrentMix`,
`budget-tool.ts saveSwapRecord`, `chara-import.ts` × 2) call `LocalPresetService.create` with the
matching origin.

`saved-presets-service.ts` (bookmarks/snapshots of community presets, cap 200) is unchanged.

### 2. The shelf: Presets → Saved tab

`v4/preset-tool.ts` Saved pool = local presets + community bookmarks (existing). Local records
render through the existing `v4-preset-card` with: a **Local** chip where the category chip sits
(category shown as a second chip when set), an **origin** chip (`Swap for {target}` /
`Character colours` / `From link` / `Imported` / `Copy of {name}`; none for authored/mixer),
`Published` chip when `publishedId` is set; no vote pill (`isFromAPI: false`); the save pill is
hidden for local records. Card kebab (local): **Edit · Duplicate · Export JSON · Copy share link ·
Publish to community · Delete** (16A `destructive: true` confirm → tombstone). Community and
bookmark cards gain **Duplicate to my shelf** (→ `origin.kind: 'clone'`, `sourceId`).
Toolbar (Saved tab only): **New preset** (creates "Untitled preset N", opens the editor; disabled
with a hint at the 200 cap) and **Import** (file button; the whole tab is also a drop target for
`.json`). Sort/search behave as in the gallery. Empty state: "Nothing on your shelf yet — New
preset, Import, or Save from Mixer / Budget / Swatch."

Detail page (`preset-detail.ts`) for a local preset: read-only palette list, description,
categories if set, `Swap for {target}` line for swap origin, the four **TAKE THIS PALETTE INTO**
handoffs (stainID lists — every origin works), and the kebab actions above.

### 3. One editor, two modes

`showPresetSubmissionForm` gains `mode: 'local' | 'community'` (default community, unchanged).
**Local mode:** title "Edit preset" / "New preset", same fields, validation = local rules (name
1–50, dyes 1–20, categories optional, description ≤ 200, example link format-checked only),
primary button **Save** → `LocalPresetService.update/create`; a passive rule strip lists what would
block publishing ("Community presets need 3–6 dyes and a category") without preventing Save.
Dye picking = the form's existing in-modal searchable list (add) + chips (remove); add ▲/▼ on
chips for reorder (both modes; harmless for community). **Publish** (kebab) opens the same form
in community mode prefilled from the local preset; strict validation as today; on 201/duplicate-200
the local record gets `publishedId` and a toast links to the community preset. Local copy remains.

### 4. Share-link (self-contained)

Grammar (5.0 stainID conventions, explicit params, no encoding):
`/presets/?dyes=102,51,90&name=<urlenc ≤50>&cat=aesthetics&sec=zones,appearance&desc=<urlenc ≤200>&v=1`
— `dyes` required (1–20 stainIDs, legacy itemIDs rejected loudly like every other tool), the rest
optional; picture never travels. `ShareService` gets `PresetShareParams` + `validateShareParams`
case (`dyes` non-empty stainIDs; `cat`/`sec` must be known slugs). Landing: the presets tool
detects `dyes` on load and shows a **Shared preset** detail (read-only, "shared with you" eyebrow)
with **Save to my shelf** (→ `origin.kind: 'link'`) and the handoffs; if the same content signature
already exists locally, the button says "Already on your shelf". `RouterService` `PRESERVED_PARAMS`
carries these params through the tool switch.

og-worker: `generateOGDataForTool('presets')` reads `dyes` (+ `name`) and renders the 15E band card
titled with the name (default title when absent); crawler intercept for `/presets/?dyes=` gets a real
`og:image` (closes the known "presets emits the generic card" gap). Links without `dyes` keep the
default card.

### 5. Files & Backup

- Single: `<slug(name)>.xivpreset.json` = `{ type: 'xivdyetools-preset', version: 1, exportedAt,
  preset: { name, description, dyes, category_id?, secondary_categories, example_link?,
  previewImage?: dataURL } }`. Multi (whole shelf): `{ type: 'xivdyetools-presets', version: 1,
  exportedAt, presets: [...] }`.
- Import (Saved tab button/drop, and Backup): validate shape + every rule above; map to local
  presets with `origin.kind: 'imported'`; skip exact duplicates (content signature), suffix name
  conflicts (`Name (2)`); honour tombstones; report counts in a toast (imported / skipped / errors).
- Advanced Options → **Backup**: export `{ version: 2, exportedAt, configs, favorites,
  localPresets, tombstones }`; import accepts v2, v1 (configs-only, today's file), and legacy
  `type: 'xivdyetools-collection'` files (through the migration mapper). Per-part failures don't
  abort the other parts. Data-section copy updated.

### 6. Delivery (web-app 5.1) — units

- **(a)** `LocalPresetService` + migration + write-site rewiring + Saved-tab listing (chips, kebab
  Edit/Duplicate/Delete, New preset) + submission form local mode (+ chip reorder) + detail page.
- **(b)** Export JSON (single/multi) + Import (Saved tab + drop) + Backup v2 (+ legacy shapes).
- **(c)** Share-link: `ShareService` preset grammar, Shared-preset landing + Save to my shelf,
  `PRESERVED_PARAMS`, og-worker presets card.
- **(d)** Publish flow: community-mode prefill from local, `publishedId`, Published chip; Duplicate
  to my shelf from community/bookmark cards.
- **(e)** Local preview picture: IndexedDB store keyed by preset id, shown on the card/detail,
  embedded as dataURL in single-file export, imported back; optional — ships last.

Cross-cutting: strings under `preset.local.*` (~30 keys: chips, kebab actions, editor mode
titles/rule strip, shared-preset landing, import/export toasts, empty state, cap) ×6 (en/de/ja
authored; fr/ko/zh drafted + native-review flag; parity test). Tests: `local-preset-service.test.ts`
(rules, caps, tombstones, migration from every CollectionService kind and from a 4.x PaletteService
store, signature dedupe, import shapes), `preset-tool` Saved-tab tests, submission-form local-mode
tests, `share-service` preset grammar tests, og-worker presets card test, backup round-trip tests;
E2E `e2e/collection-manager.spec.ts` rewritten: New → edit → reorder → export → import → share-link
→ Save to my shelf → publish (mocked API) → delete. Docs: `favorites-collections.md` (becomes
"Your shelf"), `projects/web-app/{tools,components}.md`, `share-service` section, og-worker
`CLAUDE.md` route table, web-app `CHANGELOG.md` 5.1.0.

Removed in (a): `collection-manager-modal.ts`, `add-to-collection-menu.ts`, DyeSelector's
"Manage Collections" button, DyeGrid's folder button, `CollectionService`'s collections API and
its `vitest.config.ts` coverage-exclude lines.

## Out of scope

Unlisted/server-side sharing; a dedicated Saved tool/route (8B); drawer-side "add to preset"
affordance; server sync between devices; editing a published community preset from its local
copy (publish creates/links, it does not sync); character-slot labels on character-origin presets.
