# `.chara` Equipment Name Resolution — Feasibility Research

**Date:** 2026-08-16
**Scope:** Swatch Matcher `.chara` importer (`packages/core/src/services/chara/`, `apps/web-app/src/components/chara-import.ts`)
**Question:** Can the `ModelBase` / `ModelVariant` (and weapon `ModelSet`) values stored in a `.chara` file be turned into in-game equipment names — in the game's supported languages — so the "Dyes on this glamour" panel can label rows by item instead of by slot?
**Verdict:** **Yes — deterministically, with one XIVAPI v2 request per file, in en/ja/de/fr.** Korean and Chinese need a separate name source (same situation as dye names). Details, measurements and the recommended architecture follow.

> **Status (2026-08-20): IMPLEMENTED for web-app 5.0** (pulled forward from 5.1), as option B in §8 — `@xivdyetools/core` `chara-models.ts` + `gearModels[]`/`glassesId` on the parser; api-worker 0.7.0 `POST /v1/chara/resolve` + `GET /v1/chara/icon/:id` (`apps/api-worker/src/chara/`, ko/zh tables from `scripts/build-item-names.mjs`, docs at `developers.xivdyetools.app/reference/chara`); web-app `services/chara-resolve-service.ts` + the Turn 11 "Dyes on this glamour" block in `chara-import.ts` (11a Named rows default / 11c Dye-led behind a Pieces/Dyes toggle, five states). Of the §8.3 open questions: ko/zh refresh is manual-after-patch (script + commit); the zh live mirror was not used; the Glamourer off-hand suffix was not added (the posing-tool convention — weapon name, no suffix — was kept); icons ship via the api-worker proxy; patch-day invalidation is the `XIVAPI_VERSION` pin (also the cache namespace), rolled forward by hand.

Files in this folder:

| File | What |
|------|------|
| `README.md` | This document — findings, measurements, recommendation |
| `corpus-resolution-log.txt` | Raw output of resolving every gear key in the 47-file `CharaSamples/` corpus against v2.xivapi.com |
| `resolver-prototype.py` | The throw-away script that produced the log (documents the exact query grammar) |

---

## 1. TL;DR

1. **The encoding is trivial and lossless.** The Item sheet stores model IDs as one packed `uint64` per hand (`ModelMain`, `ModelSub`), four little-endian 16-bit lanes (SaintCoinach's `Quad`). The `.chara` fields are those lanes:
   - **Armor / accessories:** `ModelMain = ModelBase | (ModelVariant << 16)`
   - **Weapons:** `ModelMain = ModelSet | (ModelBase << 16) | (ModelVariant << 32)`
   - Worked example — Beech Mask of Casting: `.chara` `HeadGear {361, 5}` → `5 << 16 | 361 = 328041` = Item#18085 `ModelMain`. Runaway Bow: `MainHand {634, 19, 1}` → `4296213114` = Item#49486 `ModelMain`; its `OffHand {698, 149, 1}` = that item's `ModelSub`.
2. **XIVAPI v2 search can filter on the packed value directly** (`+ModelMain=328041`), including 64-bit weapon values, and returns `Name@ja/@de/@fr` in the same call. One nested-group query resolves all 12 slots of a file in **a single request** (§4.3).
3. **The slot is a mandatory second key.** A gear *set* shares one `ModelMain` across head/body/hands/legs/feet — `ModelMain=328041` alone returns five items. Adding `+EquipSlotCategory.Head=1` makes it exact.
4. **Corpus result: 273 / 273 distinct gear keys resolved (0 misses), 41 / 41 weapons, all Glasses IDs.** 35 % of gear keys and 37 % of weapons are *ambiguous* — but every ambiguity is a family of **visually identical** items (Augmented / +1 / +2 / Replica / "of Fending|Slaying|Aiming|Healing|Casting" accessory variants / Common vs. Exclusive / Dated / Idealized). For a dye tool this is cosmetic, and every existing posing tool just shows the first (lowest-ID) match.
5. **Off-hands must be resolved *through* the main hand.** Two-hander off-hands (quiver, aetherotransformer, card holder, focus, sheathe…) are the main weapon's `ModelSub`, and some are shared by hundreds of weapons (the MCH aetherotransformer 2099/1/1 matches 347 guns). Only genuine off-hand items (shields, PLD swords' partners) resolve on their own `ModelMain`.
6. **Languages:** XIVAPI v2 serves **en / ja / de / fr** for the global client; ko / zh are not available from it at all. But the CN/KR datamining exports (`ffxiv-datamining-cn` / `-ko`, or Teamcraft's flat `ko-items.json` / `zh-items.json`) use **the same Item row IDs as global** and currently name all but 1 (zh) / 7 (ko) of the 28 963 equippable items — so a build-time `itemId → {ko, zh}` table gives us all six languages (§7.1).
7. **Recommended architecture:** resolve on **api-worker** (KV-cached, one endpoint, all six languages, no CSP change, no third-party dependency in the browser) rather than calling XIVAPI from the SPA. See §8.

---

## 2. What the file actually contains

`.chara` is a JSON document written by Anamnesis (`Anamnesis/Files/CharacterFile.cs`, TypeName `"Anamnesis Character File"`), Ktisis (`Ktisis/Data/Files/CharaFile.cs`, TypeName `"Ktisis Character File"`, `FileVersion 1`; the older `AnamCharaFile.cs` wrote `"Ktisis/Anamnesis Character File"`), and Brio (reads/writes the Anamnesis shape via `Brio/Files/AnamnesisCharaFile.cs`). The three schemas are field-for-field the same for equipment.

Per-slot records (from `Galatine-Folklore.chara`):

```jsonc
"MainHand": { "Color": "0, 0, 0", "Scale": "0, 0, 0",
              "ModelSet": 634, "ModelBase": 19, "ModelVariant": 1, "DyeId": 0, "DyeId2": 0 },
"OffHand":  { ..., "ModelSet": 698, "ModelBase": 149, "ModelVariant": 1, ... },
"HeadGear": { "ModelBase": 361, "ModelVariant": 5, "DyeId": 1,  "DyeId2": 0 },
"Body":     { "ModelBase": 872, "ModelVariant": 2, "DyeId": 56, "DyeId2": 33 },
"Hands":    { "ModelBase": 757, "ModelVariant": 1, "DyeId": 105, "DyeId2": 0 },
"Legs":     { "ModelBase": 804, "ModelVariant": 4, "DyeId": 33, "DyeId2": 55 },
"Feet":     { "ModelBase": 376, "ModelVariant": 1, ... },
"Ears":     { "ModelBase": 135, "ModelVariant": 2, ... },
"Neck" … "RightRing": { "ModelBase": 0, "ModelVariant": 0, ... },   // empty
"Glasses":  { "GlassesId": 0 }
```

How the producers fill them (Ktisis `WeaponSave(WeaponModelId from)`: `ModelSet = from.Id; ModelBase = from.Type; ModelVariant = from.Variant;` — `ItemSave(EquipmentModelId from)`: `ModelBase = from.Id; ModelVariant = from.Variant`). In game-file terms: gear `ModelBase` is the `e0361` set number and `ModelVariant` the material variant; weapon `ModelSet` is `w0634`, `ModelBase` is the `b0019` body, `ModelVariant` the variant.

### 2.1 Producer quirks measured on the 47-file `CharaSamples/` corpus

| Quirk | Producers | Frequency | Handling |
|-------|-----------|-----------|----------|
| `ModelBase` + `ModelVariant` present on every gear slot | all (Anamnesis 28, Ktisis 5, Ktisis/Anamnesis 4, untyped 10) | 47 / 47 | — |
| `MainHand` / `OffHand` is `null` | Anamnesis | 1 file | treat as empty |
| `Glasses` is a **bare integer** (`"Glasses": 40`) rather than `{ "GlassesId": 40 }` | `Ktisis/Anamnesis Character File` (Brio-era Ktisis) | 4 / 47 | accept both shapes |
| `Glasses` absent | Anamnesis (older) | 10 / 47 | no facewear |
| **`OffHand` duplicates `MainHand`** (`301/31/1` for both hands on The Emperor's New Fists) instead of the sub-model `351/31/1` | Anamnesis | 2 / 47 | resolve off-hand through the main-hand item first (§5.2) |
| Weapon record has no `DyeId2` | Anamnesis (older) | 6 / 47 | already tolerated by parser |
| Armor with `ModelVariant = 0` and `ModelBase ≠ 0` | — | 0 in corpus, **0 rows in Item.csv** | not a real case |

The current parser (`chara-parser.ts`) already reads these records but only emits **dyed channels** (`gearDyes`, stain ID > 0); the model IDs are skipped. Adding a `gearModels[]` array (slot, set/base/variant, or `null` when `ModelBase == 0`) is a ~20-line change with no behavioural impact on existing consumers.

---

## 3. The encoding — Item.ModelMain / ModelSub

The Item sheet (`Item.csv` columns 11–12, `ModelMain`, `ModelSub`) stores each model reference as a `uint64`. SaintCoinach types it as `Quad` (`SaintCoinach/Xiv/Quad.cs`):

```csharp
public struct Quad {
    public short Value1; public short Value2; public short Value3; public short Value4;
    public Quad(long data) {
        Value1 = (short)data;         Value2 = (short)(data >> 16);
        Value3 = (short)(data >> 32); Value4 = (short)(data >> 48);
    }
}
```

The posing tools decode it slot-dependently — Ktisis `Ktisis/GameData/Excel/ItemSheet.cs`:

```csharp
public class ItemModel(ulong var, bool isWep = false) {
    public ushort Id      = (ushort)var;
    public ushort Base    = (ushort)(isWep ? var >> 16 : 0);
    public ushort Variant = (ushort)(isWep ? var >> 32 : var >> 16);
```

Anamnesis `LuminaExtensions.GetModel(ulong val, bool isWeapon, …)` is identical; its inverse (`ExcelPageExtensions.ConvertToModel`) is `set | base << (set != 0 ? 16 : 0) | variant << (set != 0 ? 32 : 16)`. Brio masks the client-struct value with `& 0x0000FFFFFFFFFFFF` (weapon) / `& 0x00FFFFFF` (gear) — the top lanes are the stain bytes in memory, which the `.chara` writes out separately as `DyeId`/`DyeId2`.

So, in TypeScript (weapon values exceed 2^32 → use BigInt or compose the decimal string):

```ts
const gearKey   = (base: number, variant: number) => base | (variant << 16);              // fits in 32 bits
const weaponKey = (set: number, base: number, variant: number) =>
  (BigInt(variant) << 32n) | BigInt(base << 16 | set);                                     // 4296213114n
```

Verified against live data (see §4): `gearKey(361,5) = 328041` ⇔ Item#18085; `weaponKey(634,19,1) = 4296213114` ⇔ Item#49486.

---

## 4. XIVAPI v2 — verified query behaviour

Backend is boilmaster (`xivapi/boilmaster`), schema `exdschema@2`, live version at time of writing `284bb7f44b9c0976` = `7.55x2` / `latest` (43 versions listed by `/api/version`, back to 7.0). OpenAPI: `c:/dev/XIVProjects/api-1.yaml` (`/search`, `/sheet/{sheet}/{row}`, `/asset`, `/version`).

### 4.1 Field shape

`GET /api/sheet/Item/18085?fields=Name,ModelMain,ModelSub,EquipSlotCategory` →

```json
{"row_id":18085,"fields":{"Name":"Beech Mask of Casting","ModelMain":328041,"ModelSub":0,
 "EquipSlotCategory":{"value":3,"sheet":"EquipSlotCategory","row_id":3,
   "fields":{"Body":0,"Ears":0,"Feet":0,"FingerL":0,"FingerR":0,"Gloves":0,"Head":1,"Legs":0,
             "MainHand":0,"Neck":0,"OffHand":0,"SoulCrystal":0,"Waist":0,"Wrists":0}}}}
```

`ModelMain` is exposed as the **raw packed integer** — no struct decoding by the schema — which is exactly what makes equality search possible. `EquipSlotCategory` is a relation whose sub-fields are the per-slot booleans (`Head`, `Body`, `Gloves`, `Legs`, `Feet`, `Ears`, `Neck`, `Wrists`, `FingerL`, `FingerR`, `MainHand`, `OffHand`, `Waist`, `SoulCrystal`).

### 4.2 The query

```
GET /api/search?sheets=Item
    &query=+ModelMain=328041 +EquipSlotCategory.Head=1
    &fields=Name,Name@ja,Name@de,Name@fr,Icon.id,ModelMain,ModelSub
```

- `+clause` = required; `Foo.Bar=1` reaches into the relation; `Name@ja` selects a language per field (the `language=` query param sets the default for unsuffixed fields).
- **Without the slot clause** `+ModelMain=328041` returns 5 rows (18085–18089: the whole "of Casting" set — mask, chestwrap, armlets, culottes, sandals). With it: exactly one.
- 64-bit values work: `+ModelMain=4296213114 +EquipSlotCategory.MainHand=1` → `49486 Runaway Bow`.
- Rings: ring items have `FingerL = FingerR = 1`, so `LeftRing` → `FingerL=1`, `RightRing` → `FingerR=1` both hit.
- OR-groups batch cleanly: `+EquipSlotCategory.Head=1 +(ModelMain=1 ModelMain=2 …)` — 40 values per request was tested with no pagination.

### 4.3 One request per file

Nested required groups are supported, so an entire `.chara` resolves in **one** call:

```
query=+((+EquipSlotCategory.Head=1  +ModelMain=328041)
        (+EquipSlotCategory.Body=1  +ModelMain=131944)
        (+EquipSlotCategory.Gloves=1 +ModelMain=66293)
        (+EquipSlotCategory.Legs=1  +ModelMain=262948)
        (+EquipSlotCategory.Feet=1  +ModelMain=65912)
        (+EquipSlotCategory.Ears=1  +ModelMain=131207)
        (+EquipSlotCategory.MainHand=1 +ModelMain=4296213114))
&fields=Name,Name@ja,Name@de,Name@fr,ModelMain,ModelSub,EquipSlotCategory.value,Icon.id&limit=100
```

returned all seven items (row_id, slot value, `ModelMain`, en | de | fr):

```
15461  8  65912       Gnath Legs                            | Gnath-Füße                        | Pattes de Vathe
18085  3  328041      Beech Mask of Casting                 | Buchenmaske der Magie             | Masque d'incantateur en hêtre
35464  9  131207      Ophiotauroskin Earrings of Gathering  | Ophiotauros-Ohrringe des Eifers   | Boucles d'oreilles des ressources en cuir d'ophiotauros
36823  5  66293       Archfiend Gauntlets                   | Erzfeind-Pan­zer­hand­schu­he         | Gantelets de seigneur élémentaire
42040  7  262948      Mountain Linen Longkilt of Healing    | Bergleinen-Rock der Heilung       | Jupon de soigneur en lin des montagnes
44616  4  131944      Clouddark Chiton of Striking          | Dunkelwolken-Chiton des Schlagens | Chiton d'agresseur de la nuée obscure
49486 13  4296213114  Runaway Bow                           | Geistergleis-Bogen                | Arc de Glasya-Labolas
```

The caller re-associates results to slots by (`EquipSlotCategory` booleans × `ModelMain`). Ambiguous keys just come back as several rows with the same `ModelMain`.

> **This is the whole Galatine-Folklore file.** The screenshot's "Riversbreath Longbow" was stale — that item is `601/95/1` (`ModelMain 4301193817`, sub `698/106/1`); the file's `634/19/1` + `698/149/1` is Runaway Bow's `ModelMain` + `ModelSub`, which the user has since confirmed is the equipped weapon.

### 4.4 Operational facts (measured)

| Fact | Value | Consequence |
|------|-------|-------------|
| CORS | `access-control-allow-origin: *` | Browser calls are possible |
| Edge caching | `cf-cache-status: DYNAMIC` on every response | Every lookup hits origin — cache on our side |
| Bot rule | default `Python-urllib` UA → **403**; `curl` and a custom UA → 200 | Server-side callers must send a real `User-Agent` |
| `limit` | silently capped at **500** | Batches > 500 rows need the `cursor` |
| Web-app CSP | `connect-src 'self' https://universalis.app https://*.workers.dev https://*.xivdyetools.app` | Direct browser calls need `https://v2.xivapi.com` added to `public/_headers` — or go through api-worker |
| German names | contain U+00AD soft hyphens (`Erzfeind-Pan­zer­hand­schu­he`) | Strip `\u00AD` before display/compare (same issue our dye locale pipeline already handles) |
| Version pinning | `version=` accepts `latest` or a key like `284bb7f44b9c0976`; `schema=exdschema@2:rev:<hash>` | Pin the schema rev in production so a field rename can't break the parser silently |

Rate limits / fair-use and index lag are covered by the second-agent report in §7.

---

## 5. Resolution rules (from the corpus + the posing tools' source)

### 5.1 Ambiguity is a feature of the data, not a bug

Full corpus run (`corpus-resolution-log.txt`):

| Slot | distinct keys | unresolved | ambiguous |
|------|--------------:|-----------:|----------:|
| Head | 38 | 0 | 12 |
| Body | 44 | 0 | 9 |
| Gloves | 33 | 0 | 6 |
| Legs | 43 | 0 | 11 |
| Feet | 41 | 0 | 7 |
| Ears | 28 | 0 | 14 |
| Neck | 11 | 0 | 7 |
| Wrists | 8 | 0 | 8 |
| FingerL | 14 | 0 | 10 |
| FingerR | 13 | 0 | 11 |
| **Gear total** | **273** | **0** | **95 (35 %)** |
| Weapons (MainHand) | 41 | 0 | 15 (37 %) |

Whole-sheet numbers (`ffxiv-datamining` `Item.csv` @ 7.55h2): 52 799 items, 28 963 equippable with a model, **18 311 distinct (slot, ModelMain) keys, 5 596 (31 %) ambiguous** — the corpus is representative.

Every ambiguity family observed is one of:

| Family | Example |
|--------|---------|
| Augmented / +1 / +2 / Ornate | `Diadochos Jacket of Fending` / `Ornate …` / `Augmented …` |
| Replica / Antiquated / Anemos… (relic lines) | `Bravura` / `Bravura Replica`; `Antiquated Constellation Armlets` / `Constellation Armlets` / `+1` / `+2` / `Anemos …` |
| Job-role accessory variants | `Ronkan Necklace of Fending|Slaying|Aiming|Healing|Casting` (5–16 rows) |
| Common / Exclusive / Dated / Idealized / Weathered | `Housemaid's Brim` / `Loyal Housemaid's Brim`; `Dated Silver Earrings` + 15 more |
| Gendered names | `Star of the Nezha Lord` / `… Lady` |
| Sky Pirate / Sunstreak / Replica Sky Pirate | three names, one model |

All members of a family share the *exact* mesh and material — the `.chara` cannot distinguish them and neither can the game renderer. The three posing tools all pick **the first matching Item row in sheet order (lowest row_id)** and show one name (Ktisis `EquipmentEditorTab.UpdateSlot` `foreach … break;`, Anamnesis `ItemUtility.ItemSearch` first hit of `ItemsByModel[model]`, Brio `ModelDatabase … FirstOrDefault`). Anamnesis has one hard-coded preference: for wrists it skips names starting `"Promise of"` so The Emperor's New Bracelet wins.

**Recommendation:** display the lowest-row_id name and expose the alternates as a tooltip/expander ("+9 identical"), sorting candidates by (`row_id` asc). Do **not** try to be clever with "Augmented"/"Replica" stripping — the naming is inconsistent across languages.

### 5.2 Off-hands

| OffHand triple in file | Correct resolution | Evidence |
|------------------------|--------------------|----------|
| equals main-hand item's `ModelSub` | the main-hand item (paired sub-model: quiver, card holder, focus, sheathe, aetherotransformer, second fist/dagger/glaive) | 13 / 16 corpus off-hands: `698/149/1` → Runaway Bow, `2199/1/38` → Owlliege Star Globe, `2951/25/1` → Chocobo Brush… |
| equals main-hand `ModelMain` (producer wrote MainHand twice) | the main-hand item | 2 Anamnesis files, Emperor's New Fists `301/31/1` |
| otherwise | search `+EquipSlotCategory.OffHand=1 +ModelMain=<key>` (shields, PLD off-hands, tools) | `112/1/1` → Asphodelos Shield |

Do **not** resolve an off-hand independently by `+EquipSlotCategory.MainHand=1 +ModelSub=<key>` first: the MCH aetherotransformer `2099/1/1` matches **347** weapons. Resolve the main hand, then check `ModelSub` equality.

Labelling: Ktisis, Anamnesis and Brio show a paired off-hand under the **weapon's own name with no suffix**. The "(Quiver)" the screenshot shows comes from Glamourer / Penumbra.GameData (`FullEquipType.OffhandTypeSuffix`: `BowOff => " (Quiver)"`, `GunOff => " (Aetherotransformer)"`, `OrreryOff => " (Card Holder)"`, `RapierOff => " (Focus)"`, `KatanaOff => " (Sheathe)"`, `Palette => " (Palette)"`, fists/daggers/glaives/twinfangs → `" (Offhand)"`). If we want that suffix it is a small localised map keyed on the weapon's `ItemUICategory` (e.g. 4 = Archer's Arm → quiver) — nice-to-have, not required.

### 5.3 Empty and special models

| Situation | Data | Display |
|-----------|------|---------|
| `ModelBase == 0` (weapons: `ModelSet == 0` too) | no Item; in-game the slot is empty (body/legs show smallclothes) | "Nothing" / "—" (Ktisis "Empty", Anamnesis "None") — the current panel already labels these as undyed slots |
| The Emperor's New Robe / Hat / Gloves / Breeches / Boots | `279/1` in every armor slot (invisible model) | resolves normally to the item (Item#10033 etc.) — but note **the same `279/1` key resolves in all five slots**, so a set of Emperor's items is 5 correct hits |
| Emperor's New accessories | `53/1` — collides with the *Promise of …* bracelets (7 items) | lowest-id rule picks `Promise of Innocence` (8693); Anamnesis special-cases this. Cosmetic |
| Smallclothes body (NPC) | `9903/1` | no Item row → "Unknown"; Anamnesis/Brio hard-code "Smallclothes Body (NPC)" |
| Invisible NPC body/head | `6121/254` (Anamnesis) / `6121/12` (Brio) | no Item row |
| NPC-only / prop models | no Item row | Anamnesis ships a hand-written `Equipment.json` (1 313 entries), Brio `Props.json`, Ktisis `props.json`. **Out of scope** — 0 hits in our corpus; show "Unknown model 1234/5" |
| Glasses (facewear) | `GlassesId` **is** the `Glasses` sheet row_id | `GET /api/sheet/Glasses/40?fields=Name,Name@ja,Name@de,Name@fr,Icon` → "Black Rose-colored Spectacles" / ローズカラースペクタクルズ:ブラック / Rosarote Brille - Schwarz / Lunettes roses (noires); row 0 = none. Corpus IDs seen: 40, 160, 198, 205, 207, 208, 303, 307, 328 |

### 5.4 Bonus: icons

`Icon` on both sheets returns `{ id, path, path_hr1 }` (Runaway Bow: `ui/icon/032000/032065.tex`), servable as PNG via `GET /api/asset?path=ui/icon/032000/032065_hr1.tex&format=png`. If icons are wanted, they must be proxied/cached by api-worker (or `img-src` extended) — the CSP currently allows only self, data:, blob:, Discord CDN and shots.xivdyetools.app.

---

## 6. Which sheet columns matter (for a build-time table)

If we ever pre-build a lookup instead of (or in front of) live search, the columns are: `#` (row_id), `Name` (per language file), `ModelMain`, `ModelSub`, `EquipSlotCategory` (→ `EquipSlotCategory.csv` for the slot booleans), `ItemUICategory` (for off-hand suffixes), `Icon`. `ffxiv-datamining` (`C:/dev/xivapi/ffxiv-datamining/csv/{en,ja,de,fr}/Item.csv`, updated for 7.55h2 on 2026-08-14) is the canonical CSV export; its `cn/`, `ko/`, `tc/` directories are uninitialised git submodules (see §7.1).

Measured sizes of such a table (equippable rows only, minified JSON):

| Artefact | raw | gzip |
|----------|----:|-----:|
| `"<slotcat>:<ModelMain>" → [row_id…]` map (18 311 keys) | 432 KB | 129 KB |
| Names, one language (`row_id → name`, 28 963 rows) | 1.0–1.5 MB | 199–214 KB each |
| Names, en+ja+de+fr | 4.8 MB | 720 KB |

→ Too heavy to ship in the SPA bundle (vendor-core is already 1.2 MB raw and the tool has a per-chunk budget), fine as a KV/R2-backed dataset behind api-worker, borderline as a lazily fetched static JSON (~330 KB gz for map + one language).

---

## 7. Languages beyond en/ja/de/fr, and XIVAPI operational notes

### 7.1 Korean and Chinese names — measured

XIVAPI v2 enumerates `chs`/`cht`/`kr` in `SchemaLanguage` but the global client "does not provide any data for them" (OpenAPI doc). The community datamining exports of the regional clients do, and — crucially — **their Item row IDs are identical to global's**, so a global `row_id` from XIVAPI indexes them directly:

| Source | Format | Rows | Freshness (checked 2026-08-16) | Equippable items **without** a name (of 28 963) |
|--------|--------|-----:|--------------------------------|------------------------------------------------:|
| `thewakingsands/ffxiv-datamining-cn` `Item.csv` (raw.githubusercontent, 19.0 MB) | SaintCoinach 3-header CSV (`key`, names, types); `Name` col; `Model{Main}` printed as the Quad lanes `"361, 5, 0, 0"` | 52 801 (max id 52 800) | commit 2026-08-08 "ver 2026.08.05.0000.0000" | **1** (id 33146 — blank in English too) |
| `Ra-Workspace/ffxiv-datamining-ko` `csv/Item.csv` (19.6 MB) | same | 52 801 | commit 2026-08-07 "Patch v7.55h (2026.08.05.0000.0000)" | **7** (33146 + the six region-restricted *Far Eastern Schoolboy's/Schoolgirl's* items 24599–24604) |

Spot-check of the seven Galatine-Folklore items — every one has a name in both:

| row_id | en | zh (CN) | ko |
|-------:|----|---------|----|
| 18085 | Beech Mask of Casting | 山毛榉咏咒面具 | 너도밤나무 마술사 가면 |
| 44616 | Clouddark Chiton of Striking | 黯云强袭长衣 | 어둠의 구름 타격대 키톤 |
| 36823 | Archfiend Gauntlets | 魔首手铠 | 마왕 건틀릿 |
| 42040 | Mountain Linen Longkilt of Healing | 高山亚麻治愈长裙 | 산아마 치유사 장치마 |
| 15461 | Gnath Legs | 骨颚长靴 | 그나스 발 |
| 35464 | Ophiotauroskin Earrings of Gathering | 蛇牛革大地耳坠 | 오피오타우로스 채집가 귀걸이 |
| 49486 | Runaway Bow | 狂奔之弓 | 글라시아 라볼라스 활 |

Caveats: (a) at time of writing the CN/KR builds carry the same `2026.08.05` version string as global 7.55h, but historically the regional clients lag global by months — brand-new-patch items may have **no** ko/zh name for a while, so the resolver must fall back to `en` per item, exactly as the dye-name pipeline does; (b) these are third-party GitHub exports with no SLA — consume them at **build time** (a script that emits `row_id → {ko, zh}` for equippable rows only, ~200 KB gz each, checked into api-worker or pushed to KV), never at request time; (c) `Name` values may carry SaintCoinach's inline tag markup in rare rows — strip anything in `<…>`.

Alternative ko/zh sources evaluated (second research agent, verified live 2026-08-16):

| Source | Status | Use |
|--------|--------|-----|
| **Teamcraft** `libs/data/src/lib/json/ko/ko-items.json` and `zh/zh-items.json` (raw.githubusercontent, `staging` branch) | flat `{"<itemId>":{"ko":"…"}}`, 51 128 / 51 118 entries, max id 52 712 — built from the same two CSVs; Teamcraft's UI falls back `i18nName[lang] ‖ i18nName.en` when a regional row is missing | **easiest build-time input** — already ID-keyed JSON, no CSV parsing |
| **`https://xivapi-v2.xivcdn.com/`** — ffcafe's boilmaster fork (`thewakingsands/boilmaster`, branch `cn`) | live; serves chs + ja/en/de/fr; `Name@lang(chs)` works; CORS `*`; **no `version` param, no assets, `/api/version` 404s**, no SLA | possible live zh source; identical query grammar to v2 (so the §4.3 query works there for zh) — but unpinnable |
| `cafemaker.wakingsands.com` (v1 mirror) | **dead** (Cloudflare 530; repo says "NO LONGER MAINTAINED") | — |
| Garland Tools | `garlandtools.org` en/ja/de/fr only; CN fork `garlandtools.cn/db/doc/item/chs/3/<id>.json` live with CORS `*` | not needed |
| Korean live API | **none exists** (ffcafe fork documents an Actoz config but no public instance) | ko must be build-time |

Note on the local clone: `C:/dev/xivapi/ffxiv-datamining` mounts the CN/KO/TC repos as **git submodules** at `csv/cn`, `csv/ko`, `csv/tc` — the directories are empty only because the submodules were never initialised (`git submodule update --init csv/ko csv/cn`).

### 7.2 XIVAPI v2 operational notes (second-agent report, verified live)

- **Backend:** `ackwell/boilmaster` (AGPL-3.0; the `xivapi/boilmaster` URL 404s). Live instance reports `boilmaster 1-78f6523` (main HEAD, 2026-08-14). Docs at `https://v2.xivapi.com/docs/{welcome,guides/concepts,guides/pinning,guides/search,migrate}/`, OpenAPI at `/api/openapi.json`.
- **Rate limits:** **none published** for v2 — not in the docs, the OpenAPI, or `boilmaster.toml` (which has no rate-limit config; `http.rs` only adds `CorsLayer::permissive()`), and no `RateLimit-*`/`Retry-After` headers. Welcome page: "if you … intend to use XIVAPI in a production environment, it's recommended you join the Discord server". Treat as best-effort fair use with no SLA → cache aggressively on our side (another argument for option B in §8).
- **CORS:** `access-control-allow-origin: *`, `-expose-headers: *`; preflight allows `*` methods/headers. Browser calls are technically fine.
- **Versions:** `/api/version` lists `{key, names[]}`; `latest` re-points automatically (Thaliak polled every 3600 s). Concepts guide: "a change of game version should be considered a 'major' update in semver terms."
- **Search lag after a patch — the important one:** search is a separate SQLite ingestion. Until it finishes, `/api/search` returns **HTTP 503 `unavailable: search for this version is not ready`** while `/api/sheet/*` already works. boilmaster's own code has the TODO "setting latest _now_ would leave end-consumers pointing at an uningested tag." → **pin `version=<key>`** in production and roll forward deliberately (poll `/api/version`, probe search on the new key, then switch); on 503 keep serving the previous key.
- **Search limits:** `limit.default = 100`, `limit.max = 500` (silently clamped, matches our probe); cursor pagination via `next` UUID, cursor TTL 1 h absolute / 5 min idle. 64-bit equality is supported by design (query parser emits `Number::U64`; SQLite index uses `BigUnsigned`) — matches our `ModelMain=4296213114` probe.
- **Schema pinning:** default is "most recent schema for the requested game version" (`2:ver:request`); every response echoes the resolved `schema` (currently `exdschema@2:rev:83e965d091116f895d5b17573cc5d12909a5f407`) and the docs recommend pinning that value. Bare `schema=exdschema@2` returned a 500 — use the full `@2:rev:<sha>` form. EXDSchema field renames land unannounced (docs' own example `Unknown0` → `NeolobbyId`), so pin **both** `version` and `schema` for anything shipped.
- **Languages:** config `[read.language] exclude = ["chs","cht","kr"]`; `Name@lang(chs)` → 400 `invalid or unsupported language`. Only ja/en/de/fr.
- **v1 (`xivapi.com`)** is currently returning HTTP 500 — nothing should depend on it.

---

## 8. Recommendation

### 8.1 Where to resolve

| Option | Pros | Cons |
|--------|------|------|
| **A. Browser → v2.xivapi.com directly** | zero infra; one request per file; en/ja/de/fr | CSP change (`connect-src`), third-party availability/rate-limit exposure per user, no ko/zh, no caching (`DYNAMIC`), item names in the wrong language for ko/zh users |
| **B. api-worker endpoint** (recommended) `POST /v1/chara/resolve` `{ slots: {...12 slots + glasses} }` → `{ slot → { itemId, names{en,ja,de,fr,ko?,zh?}, alternates[], iconId } }` | one call, KV-cached per key (keys are tiny: `H:328041`), all six languages from one place, no CSP change (`*.xivdyetools.app` already allowed), same pattern as the Universalis proxy; XIVAPI called server-side with a real UA and per-key caching so 20 users importing the same glam = 1 upstream call | new endpoint + KV namespace; version-refresh policy needed after patches |
| **C. Build-time table in the app** | offline, deterministic; ko/zh come free from the same pipeline | 130 KB gz map + ~200 KB gz per language, blows the tool's chunk budget unless lazily fetched; a rebuild + redeploy of the *web-app* every patch |

**Choose B.** Concretely:

1. `@xivdyetools/core` `chara-parser.ts`: emit `gearModels: CharaGearModel[]` (`{ slot, set?, base, variant }`, omitted when `base == 0`; accept `Glasses` as int **or** `{GlassesId}`; tolerate `null` hand records) and put the packing helpers (`gearModelKey`, `weaponModelKey`) next to it with tests against the seven verified pairs in §4.3.
2. `api-worker`: `chara/resolve` route → builds the §4.3 nested query, calls XIVAPI once, splits results by slot, applies §5.2 off-hand rules, resolves `Glasses` by row, caches per `(slot,key)` (TTL ~7 d, invalidated on a `/api/version` change), merges ko/zh from whatever §7 settles on. api-worker already has the cache-and-coalesce plumbing for exactly this shape of upstream call — `src/universalis/services/cached-fetch.ts` (`cachedFetch`, `X-Cache` headers) behind the absorbed Universalis proxy — so the new route is mostly query-building plus that helper; the only KV namespace today is `RATE_LIMIT`, so per-key persistence beyond the Cache API would need a second binding.
   Version policy: pin `version=<key>` + `schema=exdschema@2:rev:<sha>`; after a patch, probe search on the new key (it 503s until ingested) before switching. ko/zh: a build script pulls Teamcraft's `ko-items.json` / `zh-items.json` (or the two CSVs), keeps equippable rows only, and ships them with the worker (~200 KB gz each) — merged per item with `en` fallback.
3. `chara-import.ts` `renderGlamour()`: the row's slot tag stays (mono, unlocalised), the second line becomes `itemName · dye1 + dye2`; ambiguous → `title` lists alternates; unresolved → keep today's slot-only row. Names come in the app language, falling back to en.

### 8.2 Correctness rules to encode (tests)

- gear key = `base | variant << 16`; weapon key = `set | base << 16 | variant << 32` (BigInt).
- slot filter is mandatory; rings use `FingerL`/`FingerR`.
- off-hand: main-hand `ModelSub` match → main-hand item; equals main-hand `ModelMain` → main-hand item; else `OffHand` search.
- ambiguity → lowest `row_id`, keep alternates.
- `base == 0` → empty; no rows → "unknown model", never an error.
- strip U+00AD from names.

### 8.3 Open questions

- ko/zh refresh cadence — the regional exports are at global parity today but have lagged by months before; decide whether the build script runs on a schedule or on each api-worker deploy.
- Whether zh should additionally use the live `xivapi-v2.xivcdn.com` mirror (identical grammar, unpinnable) instead of the table.
- Whether to surface the Glamourer-style off-hand suffix (needs `ItemUICategory` → suffix map ×6 languages).
- Icon display (needs `img-src` or an api-worker proxy).
- KV invalidation on patch day: poll `/api/version` `latest` key.

---

## 9. Sources

- OpenAPI: `c:/dev/XIVProjects/api-1.yaml` (`/search`, `/sheet`, `/asset`, `/version`; `QueryString`, `SchemaLanguage` = none/ja/en/de/fr/chs/cht/kr — "the global game client acknowledges the existence of `chs` and `kr`, however does not provide any data for them")
- Live probes against `https://v2.xivapi.com/api/*` on 2026-08-16 (version `284bb7f44b9c0976` = 7.55x2), reproduced by `resolver-prototype.py`
- SaintCoinach `SaintCoinach/Xiv/Quad.cs` (packing); `ffxiv-datamining/csv/{en,ja,de,fr}/Item.csv` @ 7.55h2 (sizing)
- Ktisis: `Ktisis/Data/Files/CharaFile.cs`, `Ktisis/GameData/Excel/ItemSheet.cs`, `Ktisis/Interface/Components/Chara/EquipmentEditorTab.cs`, `Types/WeaponInfo.cs`
- Anamnesis: `Anamnesis/Files/CharacterFile.cs`, `Extensions/LuminaExtensions.cs`, `GameData/Sheets/RowParserExtensions.cs`, `Actor/Utilities/ItemUtility.cs`, `Data/Equipment.json`
- Brio: `Brio/Files/AnamnesisCharaFile.cs`, `Brio/Resources/Extra/ModelDatabase.cs`, `SpecialAppearances.cs`
- Penumbra.GameData: `Structs/EquipItem.cs` (`FromOffhand`), `Enums/FullEquipType.cs` (`OffhandTypeSuffix`)
- boilmaster: `https://github.com/ackwell/boilmaster` (`boilmaster.toml` — `limit.max = 500`, `[read.language] exclude`, `[version] interval`; `bm_search/src/error.rs` — 503 while ingesting); docs `https://v2.xivapi.com/docs/guides/{concepts,pinning,search}/`
- ko/zh: `https://github.com/thewakingsands/ffxiv-datamining-cn` (`Item.csv`), `https://github.com/Ra-Workspace/ffxiv-datamining-ko` (`csv/Item.csv`), Teamcraft `https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/staging/libs/data/src/lib/json/{ko/ko-items,zh/zh-items}.json`; live CN mirror `https://xivapi-v2.xivcdn.com/` (`thewakingsands/boilmaster` branch `cn`)
- Corpus: `c:/dev/XIVProjects/CharaSamples/*.chara` (47 parseable files)
