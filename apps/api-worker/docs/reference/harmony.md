# Harmony

<p class="xdt-meta">4 endpoints · 5 colour wheels · 10 harmony types</p>

The Harmony Explorer, the Discord bot's `/harmony` and the share-link cards all pick their dyes with one selector, and since core 5.2.0 that selector measures its angles on a **colour wheel you choose**. These endpoints expose the wheels themselves and run the same selector for any base colour.

## The five wheels

| id | Tag | What it is |
|---|---|---|
| `rgb` | RGB | The screen wheel — and also the CMY print wheel, same circle, different names. The default, and what an absent `wheel` means everywhere in the suite. |
| `ryb` | RYB | The painter's wheel the harmony rules were written for. Red's complement is green. |
| `munsell` | MUNSELL | The evenly spaced perceptual hue circle behind Japan's JIS colour standard. Red's complement is blue-green. |
| `oklch-hue` | OKLCH·H | The screen wheel re-spaced so equal angles are equal perceived hue steps. Keeps the base's vividness and brightness. |
| `oklch-lightness` | OKLCH·L | Rotates hue at constant perceived lightness and colourfulness. Partners match the base's brightness; palettes lean toward mid-tones. |

The wheel is **material, not cosmetic**: across every dye × harmony slot the suite measured, choosing the RYB wheel changes the chosen partner dye 45% of the time (mean ΔE2000 of 15 between the two picks), and the constant-lightness OKLCH wheel changes it 62% of the time. Ids are the wire format everywhere — share URLs, the bot option, this API — and never change; the localized `name` does.

::: tip Munsell
MUNSELL is a registered trademark of Amazys Holding GmbH; this wheel is computed from published renotation data and is not affiliated with or endorsed by X-Rite or Pantone.
:::

## GET /v1/wheels

Every wheel, in the suite's display order (`rgb` first), with its short tag and localized name.

<EndpointCard
  endpoint="/v1/wheels"
  summary="The five colour wheels harmony angles can be measured on."
  fields="wheel"
  preview="/v1/wheels"
  :params="[
    { name: 'locale', in: 'query', default: 'en', description: 'en · ja · de · fr · ko · zh — localizes name', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] },
  ]"
/>

## GET /v1/wheels/:id

One wheel: its **ring paint** (`ringStops`, evenly spaced angles around the wheel as in-gamut hex colours — draw them as a conic gradient) and **where every dye sits on it** (`dyes[].wheelHue`, 0–360). Two dyes 180° apart on this list are complements *on this wheel*; the same pair on another wheel usually is not.

<EndpointCard
  endpoint="/v1/wheels/:id"
  summary="One wheel: its ring paint and where every dye sits on it."
  fields="wheelPosition"
  preview="/v1/wheels/ryb?stops=12"
  :params="[
    { name: 'id', in: 'path', required: true, default: 'ryb', description: 'Wheel id', options: ['rgb', 'ryb', 'munsell', 'oklch-hue', 'oklch-lightness'] },
    { name: 'stops', in: 'query', default: '72', description: 'How many ring colours to return, evenly spaced (3–360)' },
    { name: 'locale', in: 'query', default: 'en', description: 'en · ja · de · fr · ko · zh — adds localizedName to each dye', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] },
  ]"
/>

The response carries the wheel's own fields (`id`, `tag`, `name`, `isDefault`) alongside `ringStops` and `dyes`.

## GET /v1/harmony/types

The ten harmony types and the hue offsets each one measures from the base, in degrees. A type is a row in this table, nothing more — the same offsets apply on every wheel; the wheel decides what an angle *means*.

<EndpointCard
  endpoint="/v1/harmony/types"
  summary="The ten harmony types and their hue offsets."
  preview="/v1/harmony/types"
  :params="[
    { name: 'locale', in: 'query', default: 'en', description: 'en · ja · de · fr · ko · zh — localizes name', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] },
  ]"
/>

```json
{
  "success": true,
  "data": [
    { "id": "complementary", "offsets": [180], "name": "Complementary" },
    { "id": "analogous", "offsets": [30, 330], "name": "Analogous" },
    { "id": "triadic", "offsets": [120, 240], "name": "Triadic" },
    { "id": "split-complementary", "offsets": [150, 210], "name": "Split-Complementary" },
    ...
  ],
  "meta": { ... }
}
```

## GET /v1/harmony

Choose a dye for every slot of a harmony. The base is a **dye** (`dye=` — itemID or stainID, auto-detected like `/v1/dyes/:id`) or **any colour** (`hex=`). For each offset of the harmony type the selector finds the ideal colour on the chosen wheel, then ranks every candidate dye against it: by the chosen ΔE `method` when `strict` (the default), or by plain hue distance in degrees when `strict=false`. The base dye is never chosen for a slot; the dye filters and `excludeIds` narrow the pool exactly as on `/v1/dyes`.

<EndpointCard
  endpoint="/v1/harmony"
  summary="A dye for every slot of a harmony, on the wheel you choose."
  fields="harmonySlot"
  preview="/v1/harmony?dye=13&type=triadic&wheel=ryb"
  :params="[
    { name: 'dye', in: 'query', default: '13', description: 'Base dye — itemID or stainID, auto-detected. Give dye or hex, not both' },
    { name: 'hex', in: 'query', description: 'Base colour — #RRGGBB or RRGGBB — when the base is not a dye' },
    { name: 'type', in: 'query', default: 'complementary', description: 'Harmony type', options: ['complementary', 'analogous', 'triadic', 'split-complementary', 'tetradic', 'inverted-tetradic', 'square', 'monochromatic', 'compound', 'shades'] },
    { name: 'wheel', in: 'query', default: 'rgb', description: 'Colour wheel the offsets are measured on', options: ['rgb', 'ryb', 'munsell', 'oklch-hue', 'oklch-lightness'] },
    { name: 'method', in: 'query', default: 'ciede2000', description: 'ΔE method the strict ranking uses', options: ['ciede2000', 'oklab', 'cie76', 'redmean', 'rgb', 'distinguish'] },
    { name: 'strict', in: 'query', default: 'true', description: 'Rank by ΔE against the ideal colour (true) or by hue angle alone (false)', options: ['true', 'false'] },
    { name: 'companions', in: 'query', default: '0', description: 'Runner-up dyes to return per slot (0–5)' },
    { name: 'preventDuplicates', in: 'query', default: 'false', description: 'Never choose one dye for two slots', options: ['true', 'false'] },
    { name: 'excludeIds', in: 'query', description: 'Comma-separated IDs to keep out of every slot (max 50; itemID or stainID)' },
    { name: 'locale', in: 'query', default: 'en', description: 'en · ja · de · fr · ko · zh', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] },
    { name: 'metallic', in: 'query', description: 'Only / never metallic dyes', options: ['true', 'false'] },
    { name: 'pastel', in: 'query', description: 'Only / never pastel dyes', options: ['true', 'false'] },
    { name: 'dark', in: 'query', description: 'Only / never dark dyes', options: ['true', 'false'] },
    { name: 'cosmic', in: 'query', description: 'Only / never Cosmic Exploration dyes', options: ['true', 'false'] },
    { name: 'ishgardian', in: 'query', description: 'Only / never Ishgardian dyes', options: ['true', 'false'] },
    { name: 'vendor', in: 'query', description: 'Only / never vendor-acquired dyes', options: ['true', 'false'] },
    { name: 'craft', in: 'query', description: 'Only / never crafted dyes', options: ['true', 'false'] },
    { name: 'expensive', in: 'query', description: 'Only / never premium-cost dyes', options: ['true', 'false'] },
  ]"
/>

```json
{
  "success": true,
  "data": {
    "base": { "hex": "#cc6c5e", "dye": { "stainID": 13, "name": "Coral Pink", ... } },
    "harmonyType": "triadic",
    "harmonyTypeName": "Triadic",
    "wheel": { "id": "ryb", "tag": "RYB", "name": "RYB (artist's)", "isDefault": false },
    "method": "ciede2000",
    "strict": true,
    "distanceUnit": "ciede2000",
    "baseWheelHue": 14.271,
    "slots": [
      { "index": 0, "offset": 120, "wheelHue": 134.271, "targetHue": 97.55, "targetHex": "#8ECC5E", "dye": { "name": "Moss Green", ... }, "distance": 6.1204, "companions": [] },
      { "index": 1, "offset": 240, "wheelHue": 254.271, "targetHue": 236.8, "targetHex": "#5E6ACC", "dye": { "name": "Lavender Purple", ... }, "distance": 8.4415, "companions": [] }
    ]
  },
  "meta": { ... }
}
```

Read a slot as: *the ideal is `targetHex`, sitting at `wheelHue` on the wheel; the nearest allowed dye is `dye`, `distance` away.* `distanceUnit` names the unit — the `method` when `strict`, `degrees` otherwise — so a client never compares a ΔE to an angle. A slot with no surviving candidate (filters that exclude every dye) comes back with `dye: null` and `distance: null` rather than an error.

Everything here is deterministic and edge-cached like the dye routes: one wheel × harmony × base is one cache entry for a day.
