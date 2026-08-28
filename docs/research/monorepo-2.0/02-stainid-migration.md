# 02 — stainID Migration (making the Stain sheet row ID canonical)

> Part of [Monorepo 2.0 / Web-App 5.0 research](./README.md). Companion to [01 — Dye Data Format](./01-dye-data-format.md).

## Why

Future dyes may ship **without individual item IDs**. Post-7.5, a new dye color can exist purely as a Stain sheet row whose purchase resolves through a consolidated "Spectrum" dye item (`consolidationType` → itemID 52254/52255/52256). The game itself has always been stainID-primary: the `Stain` sheet (row ID = stainID) defines the color, and `StainTransient` maps stainID → purchasable item(s). Our ecosystem inverted that by making the *item* the primary key — an accident of having started from market-board data. The plugin ecosystem we interoperate with (Glamourer, Mare, Penumbra) is exclusively stainID-native.

**Useful invariant for the whole migration:** stainIDs are a byte (0–254, 0 = "no dye"; currently 1–125 in use) and item IDs start at 5729 — **the numeric ranges can never collide**, so mixed-era data is always mechanically distinguishable. api-worker already exploits this (`apps/api-worker/src/lib/validation.ts:50-55`).

## Current State

- `Dye.itemID` (`packages/types/src/dye/dye.ts:28`) is canonical; `Dye.stainID: number | null` (`:44`) exists but is documented as secondary.
- `Dye.id` is normalized to equal `itemID` in `DyeDatabase.initialize()` (`packages/core/src/services/dye/DyeDatabase.ts:227-229`) — **every `.id` touch is an itemID boundary too**.
- The 11 Facewear entries have `itemID: null` → synthetic negative IDs `-(1000 + nameHash)` (`DyeDatabase.ts:233-240`) **and** `stainID: null` — they are unreachable through any stainID scheme today (`DyeDatabase.ts:323-324` skips them when building `dyesByStainIdMap`).
- stainID lookups are implemented in core (`getByStainId` `DyeDatabase.ts:410-413`, `getDyesByStainIds` `:437-442`, `DyeService.getLocalizedDyeByStainId` `DyeService.ts:428-438`) but **only api-worker calls any of them** (3 sites: `apps/api-worker/src/lib/validation.ts:68`, `routes/dyes.ts:105`, `:182`). `getDyesByStainIds` and `getLocalizedDyeByStainId` have zero production callers. `stainID` appears nowhere in `packages/svg`, `packages/bot-logic`, or `apps/discord-worker`.

## Boundary Inventory

### A. In-memory lookups (easy, mechanical)

| Surface | Key sites |
|---------|-----------|
| Core DB index | `dyesByIdMap` (`DyeDatabase.ts:46`, populate `:308-319`), `getDyeById` (`:384-387`), `getDyesByIds` (`:418-424`) |
| DyeService façade | `DyeService.ts:103-104`, `:110-111`, `getLocalizedDyeById` `:405-415` |
| Localization API | `LocalizationService.getDyeName(itemID)` (`LocalizationService.ts:366`, `:373-374`); `TranslationProvider.ts:90-96` reads `localeData.dyeNames[String(itemID)]`; consolidated fallback `:111-116` |
| PresetService | resolves `presets.json` itemIDs via `getDyeById` (`PresetService.ts:273`, `:286`) |
| bot-logic | `getLocalizedDyeName(itemID, …)` (`bot-logic/src/localization.ts:81-85`) + every command handler passes `dye.itemID` (dye-info, harmony, match, comparison, mixer, gradient, accessibility; `input-resolution.ts:87,136,163,179`) |
| svg | `dye-info-card.ts:208` renders `dye.itemID` as a **user-visible "Item" row**; `budget-comparison.ts:111,284,403` labels keyed by itemID |
| og-worker | `dye-helpers.ts:27-29` builds `dyeByItemId` map; `og-data-generator.ts:82-84`; `translator.ts:28` |
| web-app | `mixer-tool.ts:604-609` — a **linear-scan `findDyeByItemId()`** (distrusts `getDyeById`); `swatch-tool.ts:493`; `budget-tool.ts` targetDyeId |
| discord/stoat | `favorites.ts:259`, `collection.ts:451`; `stoat-worker/src/services/dye-resolver.ts:68,100,111`, `response-formatter.ts:72-76` (prints itemID when `> 0`) |

### B. Serialized / persisted (compat-critical)

1. **presets-api D1** — highest risk. `dyes TEXT` = JSON array of raw itemIDs (`apps/presets-api/schema.sql:35`); `dye_signature` = `JSON.stringify(sortedIds)` under a **partial UNIQUE index** (`schema.sql:45,84-86`; `preset-service.ts:36-39`; migrations 0004/0006); `previous_values` blobs also embed `dyes` (migration 0002). Validation only checks `id > 0` (`validation-service.ts:225`) — mixed-era rows would produce different signatures for the same palette, silently defeating dedup and the 409-recovery path (`handlers/presets.ts:555-560`). `dyes: number[]` also crosses the service binding to discord-worker (`notification-service.ts:21`).
2. **Locale pipeline keyed by itemID** — `dyenames.csv` → `build-locales.ts:274-286` → six `locales/*.json` with `dyeNames` keyed by itemID string → `TranslationProvider.ts:90-96`. **A dye with no itemID has no name key at all — this is the first thing that breaks on patch day.**
3. **web-app localStorage** — favorites/collections (`collection-service.ts:79-81`, arrays of itemIDs, `DATA_VERSION = '1.0.0'`), per-tool keys: `v3_accessibility_selected_dyes`, `v3_comparison_selected_dyes`, `v3_mixer_selected_dyes`, `v4_mixer_selected_dyes`, `v3_harmony_selected_dye`, `v3_budget_target`, `v4_swatch_target_dye`.
4. **Share URLs** — plain query params, all itemIDs: harmony `dye`, gradient `start`/`end`, mixer `dyeA/B/C`, comparison/accessibility `dyes` CSV, budget `dye` (`share-service.ts:47-91`). `SHARE_URL_VERSION = 1` exists (`:36`) **but nothing reads it** — old links have no defined fallback path. og-worker parses the *same* params independently (`og-data-generator.ts:459-519`) — the two decoders must change in lockstep or OG previews desync from page content.
5. **discord-worker KV** — `xivdye:favorites:v1:{userId}` / `xivdye:collections:v1:{userId}` (`user-storage.ts:32-33`) store itemID arrays; **the `v1` in the key prefix is a ready-made migration hook**. Emoji map `emoji-mapping.json` keyed by itemID string (`emoji.ts:9-19`; regenerated by `scripts/upload-emojis.ts:149-153`). Budget autocomplete round-trips `value: String(dye.itemID)` through Discord (`budget-calculator.ts:269`). Component custom_ids are clean (payloads live in Cache API, `component-context.ts:142-160`).
6. **api-worker public REST** (`data.xivdyetools.app`, anonymous, un-versioned-in-practice, has third-party Dalamud consumers): `GET /v1/dyes/:id` (range auto-detect, `routes/dyes.ts:195-237`), `/v1/dyes/stain/:stainId` (`:169-189`), `/v1/dyes/batch?idType=auto|item|stain` (`:89-117`), `/v1/dyes/consolidation-groups` (`:127-163`), `excludeIds` resolution (`validation.ts:79-91`). Response shape `ApiDye = { itemID, stainID, id, …, marketItemID }` (`dye-serializer.ts:11-55`). **Documented public promise: stainID is 1–125** (`apps/api-docs/reference/dyes.md:11-15,93-105`). The range partition treats 126–5728 as hard-invalid — widening the stain window to 254 reclassifies those IDs, a documented behavior change.
7. **Not affected:** `character_colors.json` (hex + index only), oauth (no dye IDs), moderation-worker custom_ids (preset UUIDs only).

### C. Must stay itemID (market reality)

Universalis speaks item IDs — this layer is *supposed* to be itemID-based and simply becomes the "resolution edge":

- `CONSOLIDATED_IDS` / `getMarketItemID()` (`consolidated-ids.ts:35-39,109-117`), `APIService.fetchPrices*`
- web-app market-board fan-out map `marketItemID → original itemIDs[]` (`market-board-service.ts:347-362`), Facewear guard `:307`
- discord budget pipeline (`budget-calculator.ts:96-143,253-269`), `universalis-client.ts:250`
- `EXPENSIVE_DYE_IDS` filter (`api-worker/src/lib/validation.ts:11,363`), `marketItemID` in every API response (`dye-serializer.ts:53`)
- universalis-proxy upstream regex `^[\d,]+$` rejects negatives

No XIVAPI icon/item URLs are built from itemIDs anywhere; the only itemID→asset map is the Discord emoji map (re-keyable at regeneration time).

## Target Model

```
stainID (byte, canonical)          ── identity, lookups, serialization, interop
   ├─ name/locales                 ── keyed by stainID (re-keyed pipeline)
   ├─ consolidationType A|B|C|null ── purchase-resolution class
   └─ resolveMarketItemID(stainID) ── stainID → { consolidated itemID | legacy itemID | none }
legacyItemID (number | null)       ── for pre-7.5 dyes; display/back-compat only
```

This mirrors the game exactly: `Stain` sheet = identity, `StainTransient` = item resolution. New dyes with no item of their own are just `{ stainID, consolidationType, legacyItemID: null }`.

**Recommendation — retire `Dye.id` entirely in Monorepo 2.0.** Its only meaning today is "alias of itemID" (`DyeDatabase.ts:227-229`). Flipping its meaning to stainID would be a silent landmine for every consumer; deleting it forces each call site to choose `stainID` or `legacyItemID`/`marketItemID` explicitly, and the compiler finds them all.

### Plugin-ecosystem alignment (verified against Glamourer/Penumbra source)

Facts from `C:\dev\ClonedProjects\Glamourer` (branch `origin/testing`), `Glamourer.Api`, and `Penumbra.GameData` that constrain our target model:

- `StainId` is a **byte** strong-type (`Penumbra.GameData/Structs/IdTypes.cs:90-94`); Glamourer.Api deliberately has zero dependencies and passes stains as raw `byte` / `IReadOnlyList<byte>` (`Api/IGlamourerApiItems.cs:17`).
- **Two dye channels per slot** since Dawntrail: `StainIds(Stain1, Stain2)` (`IdTypes.cs:96-189`); designs serialize them as JSON keys `"Stain"` / `"Stain2"` (`Glamourer/Designs/DesignBase.cs:284-288`); the clipboard format is base64(version byte + deflate(JSON)) of the same object. **Dye *item* IDs (5729 …) appear nowhere in any Glamourer payload, ever** — the only `ItemId` key is the gear piece.
- **Stain 0 = "no dye"** and is excluded from the stain dictionary (`DictStain.cs:24` filters `Color != 0`); validation resets an invalid pair to unstained (`ItemManager.cs:285-296`). Our v2 schema should likewise treat 0 as a sentinel, never a dye.
- Glamourer consumes exactly four Stain columns — `RowId`, `Name`, `Color` (BGR→RGBA), `IsMetallic`→`Gloss` — and **never reads `StainTransient`**: the stain↔item bridge is solely our concern, which is precisely why our toolkit (market prices) exists alongside the plugins.
- **Glasses/facewear have no stain system at all** (bonus-slot serialization carries no dye; the UI tooltip literally reads "Glasses do not support dyes whatsoever"); their coloring is a separate RGB material system ("Advanced Dyes"). This independently confirms the Facewear decision below: facewear colors do not belong in stainID space.
- Interop opportunity for v5: since designs and IPC speak `Stain`/`Stain2` bytes, a stainID-first XIV Dye Tools can natively import/export Glamourer design snippets — impossible to do losslessly while our canonical key is the itemID.

### The Facewear decision (✅ decided 2026-07-30: option (b) — separate collection)

Facewear colors are **not stains** — the game models them separately, and they have neither itemID nor stainID. Options considered:

| Option | Mechanics | Verdict |
|--------|-----------|---------|
| (a) Synthetic negative stainIDs | Mirror today's negative-itemID hack | Works but perpetuates the hack; leaks fake IDs into serialized data forever |
| (b) Separate entity type | Facewear colors leave the `Dye` collection; tools that support them accept a discriminated union (`Dye \| FacewearColor`) with a distinct ID space (e.g. `fw:gold` or small ints in a separate namespace) | **✅ Decided 2026-07-30.** Honest model; keeps the stainID space clean for Glamourer/Mare interop; k-d tree already excludes them |
| (c) Reserved high range | e.g. stainID 200+ synthetic | Collides with future real stains — the sheet already reaches 125 and grows every patch |

With (b) decided, doc 01's schema splits into `dyes.json` + `facewear_colors.json`, and every backfill below needs the **one-time mapping** from today's synthetic negative itemIDs → facewear IDs (the negative IDs are name-hash-derived, `-(1000 + Σ charCode)`, so the mapping is computable from the current database and should be frozen as a static table before any conversion runs — it must not depend on re-running the hash against renamed entries). Serialized locations that can contain a negative ID today: web-app favorites/collections and per-tool localStorage keys, discord-worker KV favorites/collections, and api-worker's `< 0` range handling (`validation.ts:50-55`) — `/v1` keeps accepting them frozen; `/v2` uses the new facewear ID space. Share URLs cannot carry Facewear entries today (facewear is excluded from the market/share tools), but verify during implementation.

## Phased Plan

**Phase 0 — core enablement (non-breaking).**
Re-key the locale pipeline to stainID (`dyenames.csv` gains/uses a stainID key; `build-locales.ts` emits `dyeNames` keyed by stainID; `TranslationProvider` accepts stainID). Source names from the **Stain sheet** instead of the Item sheet — stain names *are* the bare color names, which eliminates the fragile "Dye"-prefix stripping (incl. the U+FF1A variant) entirely (see doc 03 §replacement workflow). Introduce the v2 `Dye` shape (doc 01) with non-null `stainID`, `legacyItemID`, and no `id`. Add stainID plumbing to `svg` and `bot-logic` (currently zero usage). Fix `mixer-tool.ts:604-609`'s linear scan while touching it.

**Phase 1 — internal persistence (self-owned, lazy-convertible).**
web-app: bump `collection-service` `DATA_VERSION`, convert on read (`itemID ≥ 5729 → map to stainID; negative → Facewear mapping`); same on-read conversion for the seven per-tool keys. discord-worker: bump KV prefix `v1 → v2`, lazy convert. Regenerate the emoji map keyed by stainID. Share URLs: emit `v=2` + stainID params; make `parseUrl` finally branch on `v` (v-absent/1 = itemID semantics — old links keep working); **deploy og-worker's parser change in the same release**.

**Phase 2 — presets D1 (atomic backfill).**
One migration transaction: rewrite `dyes` arrays itemID→stainID, recompute every `dye_signature`, rewrite `previous_values` blobs, and version the signature format (e.g. `s2:[…]` prefix or an `id_kind` column) so mixed-era rows are impossible rather than merely unlikely. Update `validatePresetDyes` to enforce the stain range (currently only `> 0`), the seeder (`scripts/migrate-presets.ts`), `presets.json` itself, and the notification payload consumers in discord-worker.

**Phase 3 — public API (versioned, slow lane).**
api-worker gains `/v2` with stainID-primary semantics; `/v1` freezes with today's contract (its 1–125 promise and range partition stay as-documented). `consolidation-groups`, `batch`, and `match` get v2 forms; api-docs updated with a deprecation window. This is the only phase with external consumers, so it goes last and lives longest in overlap.

**Standing rule:** market/price code converts at the edge via `resolveMarketItemID(stainID)` and below that line everything stays itemID — that layer is Universalis's contract, not ours.

## Top 5 Risks (ranked)

1. **D1 `dye_signature` uniqueness** — mixed-era signatures silently defeat dedup; must be atomic with `previous_values` and a format discriminator.
2. **Locale `dyeNames` keying** — the concrete patch-day breakage for itemID-less dyes; re-key first, everything else depends on it.
3. **api-worker's public range partition + documented 1–125 promise** — third-party consumers; requires versioning, not mutation.
4. **Share-URL / og-worker decoder lockstep** — two services parse the same params; version param exists but is currently write-only.
5. **Facewear has no home in stainID space** — ✅ *resolved 2026-07-30:* separate entity type (option b). Remaining work item: freeze the negative-ID → facewear-ID mapping table before the D1/KV/localStorage backfills run.
