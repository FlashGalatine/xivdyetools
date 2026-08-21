# Character Equipment

Resolve the equipment model keys stored in an Anamnesis / Ktisis / Brio `.chara` file to in-game item names (six languages), icons, and their families of visually identical items. This is what powers **Swatch Matcher → Dyes on this glamour** in the web app.

**Base URL:** `https://data.xivdyetools.app/v1/chara`

::: tip Why model keys, not item IDs?
A `.chara` file never names the items a character wears — it stores each slot's `ModelBase` / `ModelVariant` (weapons add `ModelSet`), the lanes of the Item sheet's packed `ModelMain`. Those keys resolve deterministically, but the slot is a mandatory second key (one gear set shares a `ModelMain` across head/body/hands/legs/feet), and 35 % of keys are families of items that share one mesh (Augmented / Replica / +1 / role variants). This endpoint does that resolution once, server-side, and caches it per key.
:::

## POST /v1/chara/resolve

Resolve every worn piece of one character in a single call.

### Request body

```json
{
  "gear": [
    { "slot": "HeadGear", "base": 361, "variant": 5 },
    { "slot": "Body",     "base": 872, "variant": 2 },
    { "slot": "MainHand", "set": 634, "base": 19, "variant": 1 },
    { "slot": "OffHand",  "set": 698, "base": 149, "variant": 1 }
  ],
  "glasses": 40
}
```

| Field | Type | Notes |
|---|---|---|
| `gear` | array, required, ≤ 12 | One entry per **worn** slot. Empty slots (`base` 0) are rejected — send worn pieces only. |
| `gear[].slot` | string | `MainHand`, `OffHand`, `HeadGear`, `Body`, `Hands`, `Legs`, `Feet`, `Ears`, `Neck`, `Wrists`, `LeftRing`, `RightRing` — each at most once |
| `gear[].base` | integer 0–65535, required | The file's `ModelBase` |
| `gear[].variant` | integer 0–65535 | The file's `ModelVariant` (default 0) |
| `gear[].set` | integer 0–65535 | Weapon slots only — the file's `ModelSet` |
| `glasses` | integer 1–65535 | The file's `Glasses.GlassesId` (or bare `Glasses` integer). Omit or `0` for none. |

The body is the twelve small integers above and nothing else — no names, no appearance data, no screenshot.

### Response

```json
{
  "success": true,
  "data": {
    "version": "284bb7f44b9c0976",
    "items": {
      "HeadGear": {
        "itemId": 18085,
        "names": { "en": "Beech Mask of Casting", "ja": "ビーチキャスターマスク", "de": "Buchenmaske der Magie", "fr": "Masque d'incantateur en hêtre", "ko": "너도밤나무 마술사 가면", "zh": "山毛榉咏咒面具" },
        "iconId": 41716,
        "familySize": 1,
        "alternates": [],
        "viaMainHand": false
      },
      "Body": null,
      "MainHand": { "itemId": 49486, "names": { "en": "Runaway Bow", "…": "…" }, "iconId": 32065, "familySize": 1, "alternates": [], "viaMainHand": false },
      "OffHand":  { "itemId": 49486, "names": { "en": "Runaway Bow", "…": "…" }, "iconId": 32065, "familySize": 1, "alternates": [], "viaMainHand": true }
    },
    "glasses": { "id": 40, "names": { "en": "Black Rose-colored Spectacles", "…": "…" }, "iconId": 200018 }
  },
  "meta": { "requestId": "…", "apiVersion": "v1" }
}
```

| Field | Meaning |
|---|---|
| `version` | The XIVAPI game-version key the upstream answered with; `null` when the whole answer came from cache |
| `items.<slot>` | Present for every requested slot. **`null` = the key has no Item row** (NPC-only / prop models) — show the raw key, it is not an error. |
| `items.<slot>.itemId` | Item sheet row — the **lowest row_id** of the family |
| `items.<slot>.names` | `en` / `ja` / `de` / `fr` always (soft hyphens stripped); `ko` / `zh` when the regional tables know the item — fall back to `en` per item when absent |
| `items.<slot>.iconId` | For [`GET /v1/chara/icon/:iconId`](#get-v1-chara-icon-iconid); `null` when the row has none |
| `items.<slot>.familySize` | Rows sharing this (slot, key). `1` = unique. Every family member is visually identical — the file cannot tell them apart and neither can the game. |
| `items.<slot>.alternates` | The other family members (row_id ascending, at most 8), each `{ itemId, names }` |
| `items.OffHand.viaMainHand` | `true` when the off-hand key is the main-hand item's own `ModelSub` (quiver, focus, card holder, fist pair…) or the main-hand key itself — the row *is* the main weapon. Genuine off-hands (shields) resolve on their own and say `false`. |
| `glasses` | Present only when the request carried `glasses`; `null` when the row does not exist |

Names are never "cleaned": Augmented / Replica / +1 prefixes stay, because the naming is inconsistent across languages.

### Caching

- Each (slot, key) is cached at the edge for ~7 days, namespaced by the game-version pin, so twenty people importing the same glamour is one upstream XIVAPI search. An empty answer (no item row) is cached too.
- `X-Cache: HIT` means no upstream call was made for this request; `MISS` means at least one key was fetched.
- The POST response itself is `Cache-Control: no-store` — caching happens per key behind it, not on the envelope.

### Errors

| Status | `error` | When |
|---|---|---|
| `400` | `INVALID_BODY` | Not JSON / not an object |
| `400` | `VALIDATION_ERROR` | Bad slot, lane out of 0–65535, duplicate slot, empty piece, bad `glasses`, more than 12 entries — the message names the field |
| `413` | `INVALID_BODY` | Body over 8 KB |
| `503` | `UPSTREAM_UNAVAILABLE` | XIVAPI is down, timed out, or **re-indexing search after a game patch** (`details.upstreamStatus`). Retry later; treat as "names unavailable", never as a failed import — the dyes in the file are unaffected. |

## GET /v1/chara/icon/:iconId

The item's icon as PNG (the 80 px `_hr1` asset), proxied from XIVAPI and edge-cached.

```
GET https://data.xivdyetools.app/v1/chara/icon/41716
```

| Param | Type | Notes |
|---|---|---|
| `iconId` | integer 1–999999 | From `items.<slot>.iconId` or `glasses.iconId` |

Returns `image/png` with `Cache-Control: public, max-age=2592000, immutable` and an `X-Cache` header (`HIT` / `MISS`). `404 NOT_FOUND` when the upstream has no such asset; `503 UPSTREAM_UNAVAILABLE` when XIVAPI is down. A missing icon should cost the tile, not the row.

## Model key packing (for reference)

The request carries the raw lanes, but if you want to compute keys yourself (they are what the cache is keyed on):

```
armour / accessory  ModelMain = base | variant << 16
weapon              ModelMain = set  | base << 16 | variant << 32   (exceeds 2^32 — use BigInt)
```

`HeadGear {361, 5}` → `328041` → Item #18085 Beech Mask of Casting. `MainHand {634, 19, 1}` → `4296213114` → Item #49486 Runaway Bow; its `OffHand {698, 149, 1}` packs to that item's `ModelSub`, which is why it resolves *through* the main hand. `@xivdyetools/core` exports `gearModelKey`, `weaponModelKey` and `charaModelKey` for this.

## Languages

`en` / `ja` / `de` / `fr` come from XIVAPI v2 in the same call. Korean and Chinese come from build-time tables generated from the community regional datamining exports (`scripts/build-item-names.mjs` — equippable rows only, same Item row IDs as global). The regional clients can lag a patch by weeks or months, so a brand-new item may have no `ko` / `zh` key for a while; fall back to `en`.
