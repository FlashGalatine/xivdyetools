# Character-creation color sheets — the game's own wording (2026-10-05)

**Question:** what does each FFXIV client call the character creator's color palettes, word for
word? The Swatch Matcher, the Harmony Explorer's character sheets and the `/swatch` and `/glamour`
cards label every palette by name. Those names were written by hand three times, in three
different ways:
- core's `sheets` section, typed into `packages/core/scripts/build-locales.ts`;
- web-app's `tools.character.*`, `swatch.slot*`, `swatch.pal*` and `swatch.absent*` keys;
- bot-logic's `card.slot*` keys, the `/swatch` description and the `/manual` character-file topic.

The 2026-10-04 i18n audit found up to three names per palette within one file. It could not say
which was right: the limbal-ring noun had been unpinned since 2026-09-20.

**Outcome:** the client's labels below, tabled in the glossary
([Character-Creation Color Sheets](../../reference/ffxiv-terminology.md#character-creation-color-sheets)).
Apply them in core's generator, web-app and bot-logic. That is the 2026-10-04 i18n audit's
TERM-003, TERM-004 and TERM-021.

## Method

The character creator's menus are the `CharaMakeType` sheet:
- each of its 32 rows (16 clans × 2 genders) lists `CharaMakeStruct[]` entries;
- in each entry, `Customize` is the appearance index and `Menu` is a `Lobby` row holding the label.

The color palettes are Customize 8 (skin), 9 (eyes), 10 (hair), 13 (tattoos / limbal ring / ear clasps), 20 (lips) and 25 (face paint). Highlights (Customize 11) has no menu of its own: its labels are the hair-color screen's.

[`extract.py`](extract.py) reads every row and writes [`lobby-rows.json`](lobby-rows.json). It needs no key; XIVAPI only wants a User-Agent header.

**Sources:**
- **EN / JA / DE / FR:** XIVAPI v2 (`exdschema@2:rev:e773c41a`), the `CharaMakeType` and `Lobby` sheets.
- **KO:** the KR client dump, [`Ra-Workspace/ffxiv-datamining-ko@6be5d8ca`](https://github.com/Ra-Workspace/ffxiv-datamining-ko/tree/6be5d8cafd3450b7bcf4676d7d55bc2d7a4d6569) (patch 7.56h).
- **ZH:** the CN client dump, [`thewakingsands/ffxiv-datamining-cn@9ac8b57b`](https://github.com/thewakingsands/ffxiv-datamining-cn/tree/9ac8b57bd3f716262bd5c713e8678ee510b07fb8) (2026.09.15).

**Checks:**
1. **The menus are the same everywhere.** The KR and CN clients' `CharaMakeType` reference the same `Lobby` rows, per Customize index, as the global client.
2. **A second extraction agrees.** [`InfSein/ffxiv-datamining-mixed@e0c2c8f9`](https://github.com/InfSein/ffxiv-datamining-mixed/tree/e0c2c8f969019baade598294c030b675efb47bb5) (GLOBAL 7.56 hotfix 2, plus its `chs` folder) matches every EN / JA / DE / FR / ZH value: 0 differences in 115.
   - Korean has a single source.
3. **Independent re-derivation.** Two `opus` verifiers re-derived the table from the raw sources without seeing these values.
   - Both returned the same 23 values.
   - The one told to refute the row choice found no other creator color label in `Lobby` or `Addon`, and 0 differences between the global, KR and CN creator menus (32 rows × 28 slots).
   - It also showed that rows 237, 2129, 2122 and 2123 are tied to their palettes by context only (below).
4. **Positive control on the dumps.** They reproduce the races the glossary already pins: all eight ZH race names are identical.
   - The KO control found two errors in our data instead (*Other findings*).

## The palette labels (`Lobby`)

| Palette | Core key | Row | EN | JA | DE | FR | KO | ZH |
|---------|----------|-----|----|----|----|----|----|----|
| Skin | `skinColors` | 202 | Skin Color | 肌の色 | Hautfarbe | Couleur de peau | 피부색 | 肤色 |
| Hair | `hairColors` | 236 | Hair Color | 髪の色 | Haarfarbe | Couleur des cheveux | 머리 색 | 发色 |
| Highlights | `highlightColors` | 237 | Highlights | メッシュの色 | Strähnen | Reflets | 부분염색 색상 | 挑染 |
| Eyes | `eyeColors` | 245 | Eye Color | 瞳の色 | Augenfarbe | Couleur des yeux | 눈동자 색 | 瞳色 |
| Lips | `lipColorsDark` / `lipColorsLight` | 248 | Lip Color | 唇の色 | Lippenfarbe | Couleur des lèvres | 입술 색 | 唇色 |
| Tattoos | `tattooColors` | 1744 | Tattoo Color | 刺青の色 | Tattoofarbe | Couleur des tatouages | 문신 색 | 刺青颜色 |
| Limbal ring (Au Ra) | `tattooColors` | 1748 | Limbal Ring Color | 瞳の輪郭の色 | Farbe der äußeren Iris | Couleur du contour de l'iris | 눈동자 테두리 색 | 瞳孔轮廓颜色 |
| Ear clasps (Wildwood ♂ ♀, Keeper of the Moon ♀) | `tattooColors` | 1745 | Ear Clasp Color | 耳飾りの色 | Ohrschmuckfarbe | Couleur des boucles d'oreilles | 귀걸이 색 | 耳饰颜色 |
| Face paint | `facePaintColorsDark` / `facePaintColorsLight` | 250 | Face Paint Color | ペイントの色 | Farbe des Merkmals | Couleur du maquillage | 얼굴 치장 색 | 面妆颜色 |
| the darker half (lips, face paint) | `…Dark` | 2122 | Dark | 濃い | Dunkel | Opaque | 짙게 | 浓艳 |
| the lighter half (lips, face paint) | `…Light` | 2123 | Light | 薄い | Hell | Translucide | 옅게 | 清淡 |

**The features themselves:** the menu nouns beside their color menus.

| Feature | Row | EN | JA | DE | FR | KO | ZH |
|---------|-----|----|----|----|----|----|----|
| Tattoos | 1742 | Tattoos | 刺青 | Tattoos | Tatouages | 문신 | 刺青 |
| Limbal ring | 1746 | Limbal Ring | 瞳の輪郭 | Äußere Iris | Contour de l'iris | 눈동자 테두리 | 瞳孔轮廓 |
| Face paint | 249 | Face Paint | フェイスペイント | Merkmale | Maquillage | 얼굴 치장 | 面妆 |

**The color picker's own tabs** (rows 2120–2135, beside Previous / Current, Randomize, Pattern):

| Row | EN | JA | DE | FR | KO | ZH |
|-----|----|----|----|----|----|----|
| 2128 | Hair Color | 髪の色 | Haarfarbe | Couleur des cheveux | 머리 색 | 发色 |
| 2129 | Highlights | メッシュを入れる | Strähnen | Mèches colorées | 부분 염색 | 挑染 |
| 2124 | Eye Color | 両目の色 | Farbe der Augen | Couleur des yeux | 눈동자 색 | 双眼颜色 |
| 2125 | Odd Eyes | オッドアイにする | Verschiedene Augenfarben | Yeux vairons | 양쪽 눈 색을 서로 다르게 하기 | 虹膜异色 |

- **Two labels for highlights:**
  - **The menu noun (237)** names the palette: ja メッシュの色, fr Reflets, ko 부분염색 색상.
  - **The picker tab (2129)** is a toggle phrased as an action: ja メッシュを入れる "put in highlights", ko 부분 염색, fr Mèches colorées.
  - **Agreement:** de and zh use one word in both rows; ja's noun is メッシュ in both.
  - **For a palette name, use row 237.** In French, both Reflets and Mèches colorées are the client's.
- **Dark / Light (2122 / 2123) are tied to the lip and face-paint halves by context, not by a sheet link.**
  - No `CharaMakeType` row references them.
  - They sit beside 2127 "None" (fr *Incolore*), the no-lip-color option.
  - Every language words them as color intensity: fr **Opaque / Translucide** (never Foncé / Clair), ja 濃い / 薄い, ko 짙게 / 옅게, zh 浓艳 / 清淡.
  - `Addon`'s only other Dark / Light pairs (4187 / 4188, 4232 / 4233) read ダーク / ライト, a UI theme, so they are not the creator's.
- **Rows 237 and 2129 are not referenced by any creator menu either:** Customize 11 has no menu of its own. 237 is the color label and 2129 the on / off toggle.
- **German *Merkmal* is two things.** The client uses it for face paint (249 *Merkmale*, 250 *Farbe des Merkmals*) and for facial features (239 *Gesichtsmerkmale*, 240 *Farbe des Merkmals*), so a German label should make the face-paint context explicit.
- **Race variants of the same palette:**
  - Hrothgar's Customize 10 is **Fur Color** (row 1014: 体毛色, Fellfarbe, Couleur du pelage, 털 색깔, 毛色).
  - Hrothgar's Customize 20 is **Fur Pattern** (1013), not a lip palette.
  - The tattoo palette for Hrothgar ♂ ♀ (1750 / 1046) and Viera ♂ (1756) adds *ornaments* in four languages: 刺青や装飾の色, 문신 및 장식 색, 刺青与装饰颜色, and de Tattoo- und Verzierungsfarbe (1756 only). en and fr stay "Tattoo Color".

## What our labels say instead

| Locale | Ours (core `sheets`, web-app, bot) | The client |
|--------|-----------------------------------|------------|
| JA | ハイライト (core, web `swatch.slotHighlights`); タトゥー (core, web `tattooColors`); リンバル / リムバル / 角膜 (web, bot, core); リップカラー (web); 目の色 (core); ダーク / ライト (core) | メッシュ; 刺青; 瞳の輪郭; 唇の色; 瞳の色; 濃い / 薄い |
| DE | Strähnchen (core, web `tools.character`); Tätowierung (core); Limbus / Limbal-Ring / Limbalring (core, web, bot); Gesichtsbemalung / Schminke / BEMAL (core, web, bot); Highlights (bot) | Strähnen; Tattoo; Äußere Iris; Merkmal; Strähnen |
| FR | Limbe / limbal / Anneau limbal (core, web, bot); Peinture faciale / PEINT. (core, web, bot); (Foncé) / (Clair), (foncées) / (claires) (web, core) | Contour de l'iris; Maquillage; Opaque / Translucide |
| KO | 하이라이트 / 브릿지 (core, web, bot); 홍채 / 림발 / 림벌 (core, web, bot); 얼굴 페인트 / 페이스 페인트 / 페인트 (core, web, bot); (어두운) / (밝은), (다크) / (라이트) (core, web) | 부분 염색; 눈동자 테두리; 얼굴 치장; 짙게 / 옅게 |
| ZH | 纹身 (core, web `tattooColors`, bot card); 虹膜 / 轮环 / 角膜环 (core, web, bot); 面部彩绘 / 彩绘 (core, web, bot); 眼睛颜色 (core, web); （深）/（浅）, （深色）/（浅色）(core, web) | 刺青; 瞳孔轮廓; 面妆; 瞳色; 浓艳 / 清淡 |

**What was already the client's word:**
- web ja メッシュの色 and 刺青;
- web de Strähnen and Tattoo;
- core / web / bot zh 挑染;
- ko 문신;
- the eye, hair, skin and lip nouns in most locales.

## Other findings

**Korean race names (core, glossary).** The KR client writes Hyur **휴런** and Hrothgar **로스가르** (`Race` 1 and 7). Core's `races` (and so the glossary's *Playable Races* table) say 휴란 and 로스갈.

**Korean clan names (core).** 13 of core's 16 KO clans are not the client's. The `Tribe` sheet, rows 1–16:
- 중원 부족, 고원 부족, 숲 부족, 황혼 부족, 평원 부족, 사막 부족;
- 태양의 추종자, 달의 수호자;
- 바다늑대, 불꽃지킴이;
- 아우라 렌, 아우라 젤라;
- 맴도는 별, 떠도는 별;
- 라바 비에라, 비나 비에라.

Core has, for example, 미드랜더, 숲의 민, 불꽃 파수꾼, 렌, 헬리온 and 라바.

**Chinese clan names (core).** Four are not the client's:

| Clan | CN client | Core |
|------|-----------|------|
| Helions | 掠日之民 | 日光之民 |
| The Lost | 迷踪之民 | 迷失之民 |
| Rava | 密林之民 | 拉瓦族 |
| Veena | 山林之民 | 维纳族 |

**Why the clan names matter now:** the 2026-10-04 i18n audit's HC-001 fix would print core's clan names on the `/glamour` and `/swatch` cards. Fix core's names first (in its generator), then the glossary.

**Elezen ear clasps share the "tattoo" palette.** For Wildwood ♂ ♀ and Keeper of the Moon ♀, Customize 13 is labeled Ear Clasp Color. Core's key name `tattooColors` covers three features.

## Confidence

- **EN / JA / DE / FR:** read from the game data, then matched by a second, independent extraction.
- **ZH:** read from the CN client dump, matched by a second extraction.
- **KO:** read from one source, the KR client dump. That is the same source the glossary's *Equipment Slots* table rests on, and the menu structure agrees with the global client's.
- **Not checked in a running client:**
  - which of the two highlights strings each screen shows;
  - that the Dark / Light tabs are the lip and face-paint halves. No sheet links them; the neighboring rows, the wording and the palettes' two halves all point that way.
