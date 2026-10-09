# FFXIV Terminology Reference

**Official Square Enix terminology used throughout XIV Dye Tools**

All game terms are sourced from official FFXIV game data and localized across 6 languages. These terms are stored in `@xivdyetools/core/src/data/locales/{locale}.json` and served through the `LocalizationService` API. The one exception is tabled under [Market and Server Terms](#market-and-server-terms-3): three nouns core does not carry, which the apps write by hand.

---

## Architecture

Game terminology flows through a layered localization system:

```
@xivdyetools/core locale JSON files
        ↓
TranslationProvider (fallback chain: requested locale → EN → formatted key)
        ↓
LocalizationService (facade with current locale state)
        ↓
LanguageService (web-app proxy) / Bot commands (Discord worker)
```

**Key principle:** Game terms are never hardcoded in application code. All official terminology is sourced from the core library's locale data.

---

## Dye Names (125 dyes)

**Source:** `locales/{locale}.json` → `dyeNames` (keyed by item ID)

| Sample ID | EN | JA | DE | FR | KO | ZH |
|-----------|----|----|----|----|----|----|
| 5729 | Snow White | スノウホワイト | Schneeweißer | blanc neige | 하얀 눈색 | 素雪白 |
| 5742 | Blood Red | ブラッドレッド | Blutroter | rouge sang | 선홍색 | 鲜血红 |
| 13116 | Metallic Silver | メタリックシルバー | Metallic silberner | argent brillant | 반짝이는 은색 | 闪耀银 |
| 30116 | Ruby Red | ルビーレッド | Rubinroter | rouge rubis | 홍옥색 | 宝石红 |
| 48163 | Neon Pink | ネオンピンク | Neonpinker | rose néon | 형광 분홍색 | 霓虹粉 |

Names match official FFXIV Lodestone and in-game item names. The core library stores color names without the "Dye" suffix (EN) or "カララント:" prefix (JA).

---

## Dye Categories (9 categories)

**Source:** `locales/{locale}.json` → `categories`

| EN | JA | DE | FR | KO | ZH |
|----|----|----|----|----|-----|
| Neutral | 無彩色系 | Neutral | Neutre | 중성 | 中性 |
| Reds | 赤系 | Rot | Rouges | 빨강 | 红色系 |
| Blues | 青系 | Blau | Bleus | 파랑 | 蓝色系 |
| Browns | 茶系 | Braun | Marrons | 갈색 | 棕色系 |
| Greens | 緑系 | Grün | Verts | 녹색 | 绿色系 |
| Yellows | 黄系 | Gelb | Jaunes | 노랑 | 黄色系 |
| Purples | 紫系 | Violett | Violets | 보라 | 紫色系 |
| Special | 特殊 | Spezial | Spécial | 특수 | 特殊 |
| Facewear | フェイスウェア | Gesichtsschmuck | Accessoires faciaux | 페이스웨어 | 脸部配饰 |

- **The Facewear row is core's data, not the game's word.** フェイスウェア, Gesichtsschmuck,
  Accessoires faciaux, 페이스웨어 and 脸部配饰 appear in no client's `Addon` sheet, and every
  region's 7.0 patch notes use the slot word instead; even zh differs (the client writes 面部配饰).
  The client has one word for facewear: the slot label, `Addon` row 16050, in
  [Equipment Slots](#equipment-slots) (フェイスアクセサリー, Gesichtsaccessoires, Accessoires de visage,
  얼굴 소품, 面部配饰). **That is the apps' facewear term.** Never copy this row into UI text.
  - The row is typed by hand in `packages/core/scripts/build-locales.ts` (`buildCategories`), so a
    correction goes there, never into the generated JSON. The same goes for *Facewear Collection*
    under [Acquisition Methods](#acquisition-methods-7).
  - No dye has carried the Facewear category since schema v2, so no shipped data makes the apps
    render this row.

---

## Acquisition Methods (7)

**Source:** `locales/{locale}.json` → `acquisitions`

| EN | JA | DE | FR | KO | ZH |
|----|----|----|----|----|-----|
| Dye Vendor | 染色師 | Farbstoffverkäufer | Vendeur de teinture | 염료 판매상 | 染剂商人 |
| Crafting | 製作 | Handwerker | Artisanat | 제작 | 制作 |
| Cosmic Exploration | コスモエクスプローラー | Kosmo-Erkundung | l'exploration cosmique | 코스모 탐사 | 宇宙探索 |
| Cosmic Fortunes | コスモフォーチュン | Kosmo-Glück | Roue de la fortune cosmique | 코스모 행운 | 宇宙幸运 |
| The Firmament | 蒼天街 | Himmelsstadt | Azurée | 창천 거리 | 天穹街 |
| Venture Coffers | リテイナーの宝箱 | Gehilfen-Schatzkiste | Trouvaille de servant | 집사의 보물상자 | 雇员宝箱 |
| Facewear Collection | フェイスウェアコレクション | Gesichtsschmuck-Sammlung | Collection accessoires faciaux | 페이스웨어 컬렉션 | 脸部配饰收藏 |

The Allied Society / Beast Tribe vendor rows (Ixali, Sylphic, Amalj'aa, Sahagin, Kobold) were
retired by the Patch 7.5 dye consolidation — those vendors no longer carry dyes, and the keys
are gone from the locale data.

**Facewear Collection is not the client's wording either.** It is built on the same invented
facewear words as the *Dye Categories* row (see the note there). The collection's own name in
the client has not been researched, so this table pins no replacement. No dye has carried this
acquisition since schema v2, so no shipped data makes the apps render the row.

---

## Currencies

**Source:** `locales/{locale}.json` → `currencies`

Display labels used in the result card for vendor costs. These are abbreviated for space where appropriate.

| Key | EN | JA | DE | FR | KO | ZH |
|-----|----|----|----|----|----|----|
| Gil | Gil | ギル | Gil | Gil | 길 | 金币 |
| Skybuilders Scrips | Scrips | 振興券 | Scheine | Assignats | 진흥권 | 振兴票 |
| Cosmocredits | CC | CC | CC | CC | CC | CC |
| Venture Coffer | Coffer | 宝箱 | Schatzkiste | Trouvaille | 보물상자 | 宝箱 |
| Red Pigment | Red Pigment | レッドピグメント | Rote Farbpigmente | Pigment rouge | 빨간색 안료 | 红色色素 |
| Blue Pigment | Blue Pigment | ブルーピグメント | Blaue Farbpigmente | Pigment bleu | 파란색 안료 | 蓝色色素 |
| Yellow Pigment | Yellow Pigment | イエローピグメント | Gelbe Farbpigmente | Pigment jaune | 노란색 안료 | 黄色色素 |
| Green Pigment | Green Pigment | グリーンピグメント | Grüne Farbpigmente | Pigment vert | 초록색 안료 | 绿色色素 |
| Brown Pigment | Brown Pigment | ブラウンピグメント | Braune Farbpigmente | Pigment brun | 갈색 안료 | 棕色色素 |
| Purple Pigment | Purple Pigment | パープルピグメント | Violette Farbpigmente | Pigment violet | 보라색 안료 | 紫色色素 |
| Planet-specific Credit | Credit | クレジット | Kredit | Crédit | 크레딧 | 信用点 |

---

## Facewear Colors (11)

**Source:** `locales/{locale}.json` → `facewearColors`

The 11 Facewear colours are **not dyes** — they live in `facewear_colors.json` / the
`facewearColors` export, keyed by a string slug, with no stainID and no market presence.

| Key | EN | JA | DE | FR | KO | ZH |
|-----|----|----|----|----|----|----|
| `silver` | Silver | シルバー | Silber | Argent | 은색 | 银色 |
| `gold` | Gold | ゴールド | Gold | Or | 금색 | 金色 |
| `black` | Black | ブラック | Schwarz | Noir | 검은색 | 黑色 |
| `white` | White | ホワイト | Weiß | Blanc | 흰색 | 白色 |
| `grey` | Grey | グレー | Grau | Gris | 회색 | 灰色 |
| `red` | Red | レッド | Rot | Rouge | 빨간색 | 红色 |
| `blue` | Blue | ブルー | Blau | Bleu | 파란색 | 蓝色 |
| `green` | Green | グリーン | Grün | Vert | 초록색 | 绿色 |
| `brass` | Brass | ブラス | Messing | Bronze | 구리색 | 铜色 |
| `purple` | Purple | パープル | Violett | Violet | 보라색 | 紫色 |
| `brown` | Brown | ブラウン | Braun | Marron | 갈색 | 棕色 |

- **Checked against the client's `Glasses` sheet** (all 745 rows, read 2026-10-05). Each facewear
  item names its color in its description: *A piece of silver facewear.* / カラー：シルバーのフェイスアクセサリー
  / *Silbernes Gesichtsaccessoire* / *Un accessoire de visage de couleur argent.* / 은색 얼굴 소품 /
  银色的面部配饰。
  - **Sources:** XIVAPI v2 (version `541c0c12e07da325`) for EN / JA / DE / FR; the KR client dump
    [`Ra-Workspace/ffxiv-datamining-ko@6be5d8ca`](https://github.com/Ra-Workspace/ffxiv-datamining-ko/tree/6be5d8cafd3450b7bcf4676d7d55bc2d7a4d6569)
    and the CN client dump
    [`thewakingsands/ffxiv-datamining-cn@9ac8b57b`](https://github.com/thewakingsands/ffxiv-datamining-cn/tree/9ac8b57bd3f716262bd5c713e8678ee510b07fb8)
    for KO / ZH. These are the versions the
    [character-sheet research](../research/2026-10-05-character-sheet-terms/README.md) read.
- **Brass** is fr **bronze**, ko **구리색** and zh **铜色** in the client: all 61 Brass rows say so
  (*Lunettes ovales (bronze)*, *de couleur bronze*; 구리색 얼굴 소품; 铜色的面部配饰, with item names
  prefixed 铜框 on 34 rows and 铜色 on 27).
  - Core 5.8.2 corrected Laiton, 황동색 and 黄铜色, which are not the client's. The clients do say
    황동 / 黄铜 for the *material*: the Brass Goggles item is 황동 고글 / 黄铜护目镜 (its brass-colored
    version: 구리색 황동 고글 / 铜框黄铜护目镜). The color is 구리색 / 铜色, so do not revert.
  - French is capitalized here like the other ten French names; the client writes it in lower case
    inside item names and descriptions.
  - EN has one outlier: row 154, *Bronze Brass Goggles*, is "A piece of bronze facewear."; the other
    60 say brass. The other five languages word it like every other Brass row.
- **The other ten colors are the client's words** in every language. French uses the masculine
  form (Noir, Blanc); the client agrees the adjective with *lunettes* or *couleur* (*noires*,
  *de couleur noire*).

---

## Color Wheels (5)

**Source:** `locales/{locale}.json` → `colorWheels`

The wheel a harmony is rotated on. Exposed publicly as `GET /v1/wheels`.

| Key | EN | JA | DE | FR | KO | ZH |
|-----|----|----|----|----|----|----|
| `rgb` | RGB (screen) | RGB（画面） | RGB (Bildschirm) | RVB (écran) | RGB (화면) | RGB（屏幕） |
| `ryb` | RYB (artist's) | RYB（画家の色相環） | RYB (Malerfarbkreis) | RJB (roue des peintres) | RYB (화가의 색상환) | RYB（画家色环） |
| `munsell` | Munsell (JIS) | マンセル（JIS） | Munsell (JIS) | Munsell (JIS) | 먼셀 (JIS) | 孟塞尔（JIS） |
| `oklch-hue` | OKLCH hue (perceptual spacing) | OKLCH 色相（知覚的な間隔） | OKLCH-Farbton (wahrnehmungsgleiche Abstände) | Teinte OKLCH (espacement perceptuel) | OKLCH 색상 (지각적 간격) | OKLCH 色相（感知均匀间距） |
| `oklch-lightness` | OKLCH lightness (keeps brightness) | OKLCH 明度（明るさを保持） | OKLCH-Helligkeit (behält die Helligkeit) | Luminosité OKLCH (conserve la luminosité) | OKLCH 명도 (밝기 유지) | OKLCH 明度（保持亮度） |

---

## Playable Races (8 races)

**Source:** `locales/{locale}.json` → `races`

| EN | JA | DE | FR | KO | ZH |
|----|----|----|----|----|-----|
| Hyur | ヒューラン | Hyuran | Hyuran | 휴런 | 人族 |
| Elezen | エレゼン | Elezen | Élézéen | 엘레젠 | 精灵族 |
| Lalafell | ララフェル | Lalafell | Lalafell | 라라펠 | 拉拉菲尔族 |
| Miqo'te | ミコッテ | Miqo'te | Miqo'te | 미코테 | 猫魅族 |
| Roegadyn | ルガディン | Roegadyn | Roegadyn | 루가딘 | 鲁加族 |
| Au Ra | アウラ | Au Ra | Ao Ra | 아우라 | 敖龙族 |
| Hrothgar | ロスガル | Hrothgar | Hrothgar | 로스가르 | 硌狮族 |
| Viera | ヴィエラ | Viera | Viéra | 비에라 | 维埃拉族 |

The KO and ZH columns are checked against the KR and CN clients' `Race` sheets (core 5.8.1 corrected
KO Hyur and Hrothgar, which had been 휴란 and 로스갈; [character-sheet research](../research/2026-10-05-character-sheet-terms/README.md#other-findings)).

---

## Clans / Subraces (16 clans)

**Source:** `locales/{locale}.json` → `clans`

| Race | EN Clan 1 | EN Clan 2 | JA Clan 1 | JA Clan 2 |
|------|-----------|-----------|-----------|-----------|
| Hyur | Midlander | Highlander | ミッドランダー | ハイランダー |
| Elezen | Wildwood | Duskwight | フォレスター | シェーダー |
| Lalafell | Plainsfolk | Dunesfolk | プレーンフォーク | デューンフォーク |
| Miqo'te | Seeker of the Sun | Keeper of the Moon | サンシーカー | ムーンキーパー |
| Roegadyn | Sea Wolf | Hellsguard | ゼーヴォルフ | ローエンガルデ |
| Au Ra | Raen | Xaela | アウラ・レン | アウラ・ゼラ |
| Hrothgar | Helions | The Lost | ヘリオン | ロスト |
| Viera | Rava | Veena | ラヴァ・ヴィエラ | ヴィナ・ヴィエラ |

| Race | KO Clan 1 | KO Clan 2 | ZH Clan 1 | ZH Clan 2 |
|------|-----------|-----------|-----------|-----------|
| Hyur | 중원 부족 | 고원 부족 | 中原之民 | 高地之民 |
| Elezen | 숲 부족 | 황혼 부족 | 森林之民 | 黑影之民 |
| Lalafell | 평원 부족 | 사막 부족 | 平原之民 | 沙漠之民 |
| Miqo'te | 태양의 추종자 | 달의 수호자 | 逐日之民 | 护月之民 |
| Roegadyn | 바다늑대 | 불꽃지킴이 | 北洋之民 | 红焰之民 |
| Au Ra | 아우라 렌 | 아우라 젤라 | 晨曦之民 | 暮晖之民 |
| Hrothgar | 맴도는 별 | 떠도는 별 | 掠日之民 | 迷踪之民 |
| Viera | 라바 비에라 | 비나 비에라 | 密林之民 | 山林之民 |

- **Read from the KR and CN clients' `Tribe` sheets** (rows 1–16; [character-sheet research](../research/2026-10-05-character-sheet-terms/README.md#other-findings)).
- **Core 5.8.1 corrected 13 KO and 4 ZH names.** The old KO forms 미드랜더, 숲의 민, 불꽃 파수꾼, 렌, 헬리온 and 라바, and the old ZH forms 日光之民, 迷失之民, 拉瓦族 and 维纳族, are not the client's.

---

## Color Harmony Types (10)

**Source:** `locales/{locale}.json` → `harmonyTypes`

| Key | EN | JA | DE | FR | KO | ZH |
|-----|----|----|----|----|----|----|
| `complementary` | Complementary | 補色 | Komplementär | Complémentaire | 보색 | 互补色 |
| `analogous` | Analogous | 類似色 | Analog | Analogue | 유사색 | 类似色 |
| `triadic` | Triadic | 三色配色 | Triadisch | Triadique | 삼원색 | 三角配色 |
| `splitComplementary` | Split-Complementary | 分裂補色 | Geteiltes Komplement | Complémentaire divisé | 분리보색 | 分裂互补 |
| `tetradic` | Tetradic | 四色配色 | Tetradisch | Tétradique | 사색 | 四色配色 |
| `invertedTetradic` | Inverted Tetradic | 逆四色配色 | Invertiert-Tetradisch | Tétradique inversé | 반전 사색 | 逆四色配色 |
| `square` | Square | 正方形配色 | Quadrat | Carré | 정사각형 | 正方形配色 |
| `monochromatic` | Monochromatic | 単色 | Monochromatisch | Monochromatique | 단색 | 单色 |
| `compound` | Compound | 複合 | Zusammengesetzt | Composé | 복합 | 复合 |
| `shades` | Shades | シェード | Schattierungen | Nuances | 명암 | 明暗 |

---

## Vision Types (5)

**Source:** `locales/{locale}.json` → `visionTypes`

Reproduced verbatim, parenthetical clarifiers included — the strings are what the accessibility
cards render, and JA/ZH deliberately differ in how they gloss the condition.

| Key | EN | JA | DE | FR | KO | ZH |
|-----|----|----|----|----|----|----|
| `normal` | Normal Vision | 正常視覚 | Normales Sehen | Vision normale | 정상 시력 | 正常视觉 |
| `deuteranopia` | Deuteranopia (Red-Green Colorblindness) | 2型色覚（赤緑色盲） | Deuteranopie (Rot-Grün-Farbenblindheit) | Deutéranopie (Daltonisme rouge-vert) | 제2색맹 (적록색맹) | 绿色盲（红绿色盲） |
| `protanopia` | Protanopia (Red-Green Colorblindness) | 1型色覚（赤緑色盲） | Protanopie (Rot-Grün-Farbenblindheit) | Protanopie (Daltonisme rouge-vert) | 제1색맹 (적록색맹) | 红色盲（红绿色盲） |
| `tritanopia` | Tritanopia (Blue-Yellow Colorblindness) | 3型色覚（青黄色盲） | Tritanopie (Blau-Gelb-Farbenblindheit) | Tritanopie (Daltonisme bleu-jaune) | 제3색맹 (청황색맹) | 蓝色盲（蓝黄色盲） |
| `achromatopsia` | Achromatopsia (Total Colorblindness) | 全色盲 | Achromatopsie (Totale Farbenblindheit) | Achromatopsie (Daltonisme total) | 전색맹 | 全色盲 |

`visions` is a parallel 5-key section holding the short labels used where the parenthetical
would not fit.

---

## Market and Server Terms (3)

**Source:** none in `@xivdyetools/core` — these nouns are not part of the generated locale data.
They are written by hand in `apps/web-app/src/locales/*.json`, in
`packages/bot-logic/src/i18n/locales/*.json` and in the Privacy / Terms documents, so this table
is the only thing pinning them. Each value is the term the game client of that language uses,
taken from the publisher's own site on 2026-09-19 (sources and confidence:
[2026-09-19 i18n audit — official terms research](../audits/2026-09-19-i18n/evidence/official-terms-research.md)).
All six Korean and Chinese values were then read verbatim from the raw pages on 2026-09-20 — the
Korean and Chinese official sites render client-side or sit behind a summarizing fetch, so they
were checked from full-page captures and in a real browser rather than trusted from a summary.

| EN | JA | DE | FR | KO | ZH |
|----|----|----|----|----|----|
| Market Board | マーケットボード | Marktbrett | tableau des ventes | 장터 | 市场布告板 |
| World | ワールド | Welt | Monde | 서버 | 服务器 |
| Data Center | データセンター | Datenzentrum | centre de données | 데이터 센터 | 大区 |

- **The Korean and Chinese clients do not say "World".** Both publishers call the unit a *server*
  (`서버`, `服务器`), and the Chinese client calls a Data Center a `大区`. `월드` / `世界` /
  `数据中心` are glosses of the Global term and are not used here.
- Rejected forms, so they are not reintroduced: FR `tableau des marchés` (on no official page);
  KO `시장 게시판` and `마켓보드`; ZH `市场板` (player shorthand) and `市场版` (a typo found in no source).
- Korean has **two official forms and both are right**: `장터` is the feature — the official guide
  is titled 장터 ("장터란?", "장터 기능", "장터 위치") — and `장터 게시판` is the in-game map label of
  the board object itself. The apps mean the feature and its prices ("Market Board prices", "Enable
  Market Board"), so they say `장터`; use `장터 게시판` only for the physical board.
- French capitalizes `Monde` as a game noun (`Tous les Mondes`) and keeps `tableau des ventes` and
  `centre de données` lower-case in running text; German capitalizes all three as ordinary nouns.

---

## Glamour Terms

**Source:** none in `@xivdyetools/core` — written by hand in the web-app and bot-logic locale
files and in the Privacy / Terms documents, so this table is what pins them. Values are the terms
each language's game client and publisher use, researched 2026-09-20 (sources, quotes and
confidence:
[2026-09-19 i18n audit — glamour research](../audits/2026-09-19-i18n/evidence/official-terms-research-glamour.md)).

"Glamour" is three things, and no language uses one word for all three:

| EN | JA | DE | FR | KO | ZH |
|----|----|----|----|----|----|
| Glamours (the system) | 武具投影 | Projektion | mirage | 장비 투영 | 武具投影 |
| Glamour Prism | ミラージュプリズム | Projektionsprisma | prisme mirage | 환상의 프리즘 | 幻象棱晶 |
| Glamour Dresser | ミラージュドレッサー | Projektionskommode | coiffeuse mirage | 환상의 옷장 | 投影台 |
| Glamour Plate | ミラージュプレート | Projektionsplatte | planche mirage | 투영세트 | 投影模板 |
| Glamour Dispeller | ミラージュディスペラー | Entprojizierungskristall | dissipateur de mirage | 해제의 프리즘 | 驱幻晶 |
| **a glamour (one outfit)** — what this toolset means by the word | ミラプリ | Projektion | mirage | 코디 | 幻化 |

- **The last row is the one the apps use** ("Dyes on this glamour", "glamour palette", "a glamour
  page"). German `Projektion` is **feminine** (*diese Projektion*, *eine Projektion*); French
  `mirage` is **masculine** (*ce mirage*, *un mirage* — never *cette mirage*).
- **Two false friends, never to be used:** Japanese `グラマー` and Korean `글래머` both mean a
  voluptuous figure in everyday speech. Neither appears in any official FFXIV text.
- Not the client's word, so not used either: German `Mirage` and `Glamour` (the latter survives in
  one marketing banner only), French `glamour`, Chinese `时装`.
- Japanese `ミラプリ` is player shorthand that Square Enix's own campaigns use; the formal Play
  Guide noun for a saved look is `コーディネート` — use that in a formal register (the policies).
- Korean has **no official noun** for one outfit: official copy says `의상` / `스타일`, the genre is
  `패션` (*패션 콘테스트*, *패션 체크* — so "glamour enthusiasts" is *패션 애호가*), and players say
  `코디` / `룩`. `코디` is the house choice for one outfit in the UI; the Privacy / Terms documents
  use the official-register `의상` — the same split as Japanese `ミラプリ` (UI) and `コーディネート`
  (policies).
- **The Glamour Reader is named from the last row too**: `ミラプリリーダー`, `Projektionsleser`,
  `Lecteur de mirages`, `코디 리더`, `幻化查看器` (short: `ミラプリ` / `Projektion` / `Mirage` /
  `코디` / `幻化`), on the web, the OG card and the `/glamour` card. An item that "can't be a
  glamour" fails the system's check, so Japanese and Korean keep the system's verb there:
  `投影できない`, `투영할 수 없음` / `투영 불가`, never `코디`.
- The compounds do not follow one template (`Entprojizierungskristall`, *dissipateur **de**
  mirage*) — look each one up rather than deriving it.

### Dye channels (two dyes per piece since 7.0)

**No client has a noun for "dye channel".** Every language numbers the two channels instead: the
Item Dyeing window's tabs are Addon 15970 / 15971, and the tooltip and Glamour Plate forms are
12796 / 12797 (XIVAPI v2 for en/ja/de/fr, the KR and CN client dumps; researched 2026-10-05 for
the 2026-10-04 i18n audit's TERM-016).

| EN | JA | DE | FR | KO | ZH |
|----|----|----|----|----|----|
| Dye 1 / Dye 2 | 染色1 / 染色2 | Farbe 1 / Farbe 2 | Teinture 1 / Teinture 2 | 염색 1 / 염색 2 | 染色1 / 染色2 |
| **counting them** (the 7.0 patch notes) | 2ヵ所 (「2ヵ所染色」) | an zwei Stellen | deux parties | 2부분 | 2处 |

- **Name a single channel by its number**, as the client does: *Dye 1*, `染色1`.
- **Japanese:** count with `ヵ所` (`染色{n}ヵ所`) and say `染色できる箇所` for the idea. Never
  `チャンネル` (in the client it is only a chat channel) and never `染色枠` (no client text uses it).
  `部位` is the client's word for an equipment slot (`装備枠` / `部位`), not for a dye channel.
- The other languages' existing UI words (`channel`, `Kanal`, `canal`, `채널` / `염색 채널`,
  `通道` / `染色通道`) are house words, not client words. Only the Japanese one was checked against
  the client's other uses. Keep one per language: ko `염색 칸` and zh `染色栏` were unified onto
  them in 5.14.4.

---

## Equipment Slots

**Source:** none in `@xivdyetools/core` — written by hand in web-app `swatch.gearSlot.*` /
`swatch.facewearSlot` (the Glamour Reader's rows) and bot-logic `card.glamourSlot.*` (the `/glamour`
card, uppercased where the script has case). Values are the game client's own strings, the `Addon`
sheet's slot labels, read 2026-09-28 from the game data (XIVAPI v2 for EN/JA/DE/FR, the CN and KR
client dumps for ZH/KO; rows, URLs and confidence:
[equipment slot research](../research/2026-09-28-equipment-slot-terms/README.md)).

| Slot | Addon row | EN | JA | DE | FR | KO | ZH |
|------|-----------|----|----|----|----|----|----|
| Main hand | 738 | Main Hand | メインアーム | Haupthand | Main directrice | 주 무기 | 主手 |
| Off hand | 739 | Off Hand | サブアーム | Nebenhand | Main non directrice | 보조 무기 | 副手 |
| Head | 740 | Head | 頭 | Kopf | Tête | 머리 | 头部 |
| Body | 741 | Body | 胴 | Rumpf | Torse | 몸통 | 身体 |
| Hands | 742 | Hands | 手 | Hände | Mains | 손 | 手臂 |
| Legs | 744 | Legs | 脚 | Beine | Jambes | 다리 | 腿部 |
| Feet | 745 | Feet | 足 | Füße | Pieds | 발 | 脚部 |
| Ears | 746 | Ears | 耳 | Ohren | Oreilles | 귀 | 耳部 |
| Neck | 747 | Neck | 首 | Hals | Cou | 목 | 颈部 |
| Wrists | 748 | Wrists | 腕 | Handgelenke | Poignets | 손목 | 腕部 |
| Right ring | 749 | Right Ring | 右指 | Finger (rechts) | Bague droite | 오른쪽 손가락 | 右指 |
| Left ring | 750 | Left Ring | 左指 | Finger (links) | Bague gauche | 왼쪽 손가락 | 左指 |
| Facewear | 16050 | Facewear | フェイスアクセサリー | Gesichtsaccessoires | Accessoires de visage | 얼굴 소품 | 面部配饰 |

- **A slot is not an item type.** The game has a second vocabulary for what an item *is* — the
  tooltip and market-board categories (`ItemUICategory` 40–43): Necklace / Earrings / Bracelets /
  Ring; 首飾り / 耳飾り / 腕輪 / 指輪; Halskette / Ohrring / Armreif / Ring; Collier / Boucle
  d'oreille / Bracelet / Bague; 목걸이 / 귀걸이 / 팔찌 / 반지; 项链 / 耳饰 / 手镯 / 戒指. Labels that
  name **where a piece is worn** use the slot table above; never mix the two.
- **The game has no short forms.** Nothing abbreviates a slot, so neither do the apps — the bot
  card widens its slot column instead of inventing one (`반지(우)`, `RING R` and `NEBENH.` were ours).
- The ring slot is a **finger** in the slot vocabulary of German (`Finger (rechts)`), Korean
  (`손가락`) and Chinese / Japanese (`右指`); French uses `Bague`. `Anneau`, `Ring links` and
  `반지` for a slot match neither vocabulary.
- **Facewear is the slot's label (row 16050), and it is the client's only word for facewear.**
  - **Sources:** the 7.0 patch notes of every region use it:
    [EN](https://na.finalfantasyxiv.com/lodestone/topics/detail/d7db61f938f9cea65e4c5cd261918edb036b3004/),
    [JA](https://jp.finalfantasyxiv.com/lodestone/topics/detail/1e6473f5a6210bc7f81a6f41507095e2b939fa5d/),
    [DE](https://de.finalfantasyxiv.com/lodestone/topics/detail/9a1d2364c6f0fed72a164f3252a59073f7d0c4fc/),
    [FR](https://fr.finalfantasyxiv.com/lodestone/topics/detail/dfacdc73285bfbeca1d9abf632440e46d1c9a99d/),
    [KO](https://www.ff14.co.kr/news/notice/view/2603),
    [ZH](https://ff.web.sdo.com/web8/index.html#/newstab/newscont/365381). The client's label for
    a facewear piece's name uses it too (`Addon` 3645: facewear name, フェイスアクセサリー名,
    Gesichtsaccessoire-Name, nom de l'accessoire de visage, 얼굴 소품 이름, 面部配饰名).
  - **Use it wherever the apps say facewear:** the slot, the color tag (the table below) and help
    text. Core's [Dye Categories](#dye-categories-9-categories) row (フェイスウェア, Gesichtsschmuck,
    Accessoires faciaux, 페이스웨어, 脸部配饰) is not a client word in any language; see the note there.
  - **Grammar:**
    - ja always ends in ー;
    - de **das** Gesichtsaccessoire is neuter (genitive *des Gesichtsaccessoires*); the slot label
      is its plural;
    - fr **l'**accessoire de visage is masculine (*un accessoire de visage*); the slot label is its
      plural;
    - ko writes the label with a space (얼굴 소품); the patch notes' text command, /얼굴소품, has none.
  - **Not the client's word, so not used:**
    - "glasses": de Brille, fr lunettes, zh 眼镜. They come from the Dawntrail special site's
      marketing prose, and the slot also holds eyepatches, goggles and visors;
    - the transliterations ja フェイスウェア and ko 페이스웨어.
- **Not slots:** Waist (row 743, retired — no glamour uses it) and Fashion Accessory (the umbrella
  and fan prop system; a `.chara` never carries one).
- **The GPOSERS export is not game UI.** It writes the English submission form's own labels (Main
  Hand, Earrings, Necklace, Bracelets, Right Ring, Rings, Facewear) in every language, like any
  document format.

**The facewear color.** This table is for a label that names the color of a worn facewear piece:
the Glamour Reader's facewear tag (`swatch.facewearColorTag` / `facewearColorUnknown`). The client
strings were read on 2026-10-05 from the sources named under [Facewear Colors](#facewear-colors-11).

| Label | Source | EN | JA | DE | FR | KO | ZH |
|-------|--------|----|----|----|----|----|----|
| Color (the facewear menu's color label) | `Addon` 16054 | Color | カラー | Farbe | Couleur | 색상 | 颜色 |
| A colored piece (item description, silver shown) | `Glasses` | A piece of silver facewear. | カラー：シルバーのフェイスアクセサリー | Silbernes Gesichtsaccessoire | Un accessoire de visage de couleur argent. | 은색 얼굴 소품 | 银色的面部配饰。 |
| **Facewear color**, the tag (house wording) | 16050 + 16054 | facewear color | フェイスアクセサリーカラー | Farbe des Gesichtsaccessoires | couleur de l'accessoire de visage | 얼굴 소품 색상 | 面部配饰颜色 |

- **The client has no string for "facewear color".** The last row is ours, built from two client
  words: the slot label (16050) and the color label (16054). The color name in front of it comes
  from [Facewear Colors](#facewear-colors-11). Capitalize the first word where the tag starts a
  label.
- **Not used:** the "glasses" compounds (de Brillenfarbe, fr couleur de lunettes, zh 眼镜颜色) and the
  transliterations (ja フェイスウェアカラー, ko 페이스웨어 색상), for the reasons in the Facewear bullet
  above.

---

## Character-Creation Color Sheets

**Source:** the character creator's own labels, the game client's `Lobby` sheet rows that its
`CharaMakeType` menus point to.
- **Read on 2026-10-05:** XIVAPI v2 for EN / JA / DE / FR, and the CN and KR client dumps for ZH / KO.
- **Checks:** a second extraction matched every value it covers. Rows, URLs, race variants and confidence: [character-sheet research](../research/2026-10-05-character-sheet-terms/README.md).
- **Core follows this table.** Its `sheets` section is generated from `buildSheets` in `packages/core/scripts/build-locales.ts`, which was rewritten from this table (TERM-021, 2026-10-04 remediation), and `packages/core/scripts/build-locales.test.ts` pins every locale's values plus the words ruled out below. This table is still what pins the words: change one here first, then in the generator, never in the generated JSON. Core's English stays house wording (*Tattoo/Limbal*, *Face Paint (Dark)*), not the client's. Three things in core are deliberate rather than a single row's label:
  - `tattooColors` is the house form described under *One palette, three features* below.
  - The face-paint keys take the **feature** name (row 249 in the second table: フェイスペイント, Maquillage, 얼굴 치장, 面妆) plus the Dark / Light label, everywhere except German. German takes the palette label (250, *Farbe des Merkmals*) because the client also calls facial features *Merkmale*.
  - The plural *colors* nouns in de / fr (*Augenfarben*, *Couleurs des yeux*) are house style around the client's noun.

| Palette | Core key | Row | EN | JA | DE | FR | KO | ZH |
|---------|----------|-----|----|----|----|----|----|----|
| Skin | `skinColors` | 202 | Skin Color | 肌の色 | Hautfarbe | Couleur de peau | 피부색 | 肤色 |
| Hair | `hairColors` | 236 | Hair Color | 髪の色 | Haarfarbe | Couleur des cheveux | 머리 색 | 发色 |
| Hair (Hrothgar) | `hairColors` | 1014 | Fur Color | 体毛色 | Fellfarbe | Couleur du pelage | 털 색깔 | 毛色 |
| Highlights | `highlightColors` | 237 | Highlights | メッシュの色 | Strähnen | Reflets | 부분염색 색상 | 挑染 |
| Eyes | `eyeColors` | 245 | Eye Color | 瞳の色 | Augenfarbe | Couleur des yeux | 눈동자 색 | 瞳色 |
| Lips | `lipColorsDark` / `…Light` | 248 | Lip Color | 唇の色 | Lippenfarbe | Couleur des lèvres | 입술 색 | 唇色 |
| Tattoos | `tattooColors` | 1744 | Tattoo Color | 刺青の色 | Tattoofarbe | Couleur des tatouages | 문신 색 | 刺青颜色 |
| Limbal ring (Au Ra) | `tattooColors` | 1748 | Limbal Ring Color | 瞳の輪郭の色 | Farbe der äußeren Iris | Couleur du contour de l'iris | 눈동자 테두리 색 | 瞳孔轮廓颜色 |
| Face paint | `facePaintColorsDark` / `…Light` | 250 | Face Paint Color | ペイントの色 | Farbe des Merkmals | Couleur du maquillage | 얼굴 치장 색 | 面妆颜色 |
| Darker half (lips, face paint) | `…Dark` | 2122 | Dark | 濃い | Dunkel | Opaque | 짙게 | 浓艳 |
| Lighter half (lips, face paint) | `…Light` | 2123 | Light | 薄い | Hell | Translucide | 옅게 | 清淡 |

**The features themselves**, for a label that names the feature rather than its palette:

| Feature | Row | EN | JA | DE | FR | KO | ZH |
|---------|-----|----|----|----|----|----|----|
| Tattoos | 1742 | Tattoos | 刺青 | Tattoos | Tatouages | 문신 | 刺青 |
| Limbal ring | 1746 | Limbal Ring | 瞳の輪郭 | Äußere Iris | Contour de l'iris | 눈동자 테두리 | 瞳孔轮廓 |
| Face paint | 249 | Face Paint | フェイスペイント | Merkmale | Maquillage | 얼굴 치장 | 面妆 |
| Fur pattern (Hrothgar) | 1013 | Fur Pattern | 体毛柄 | Fellzeichnung | Motif du pelage | 털 무늬 | 毛纹 |

- **The limbal ring is the iris's outline** in the five non-English client languages (瞳の輪郭, Äußere Iris, Contour de l'iris, 눈동자 테두리, 瞳孔轮廓). Not the client's word, so not used:
  - transliterations: ja リンバル / リムバル, ko 림발 / 림벌, de Limbal-Ring;
  - anatomical terms: de Limbus, fr Limbe / limbal;
  - organ names: ja 角膜 (cornea), ko 홍채 and zh 虹膜 (iris);
  - zh 角膜环 / 轮环.
- **Face paint is not "paint" in German or French:**
  - de **Merkmale** / *Farbe des Merkmals*, never Gesichtsbemalung or Schminke. The German client also uses *Merkmal* for facial features (*Gesichtsmerkmale*), so keep the face-paint context explicit;
  - fr **Maquillage**, never Peinture faciale;
  - also ko **얼굴 치장**, never 얼굴 페인트 / 페이스 페인트, and zh **面妆**, never 面部彩绘 / 彩绘.
- **Tattoos are 刺青** in Japanese and Chinese, never タトゥー / 纹身.
- **Highlights:**
  - ja **メッシュ**, never ハイライト;
  - ko **부분염색**, never 하이라이트 / 브릿지 (row 237 writes it solid; the picker tab, row 2129, writes 부분 염색);
  - de **Strähnen**, never Strähnchen / Highlights;
  - the color picker's highlights toggle (row 2129) reads fr *Mèches colorées*, so fr has two client words. Reflets is the palette's own label; Mèches colorées is also official.
- **Dark / Light:** the color picker's labels for the two halves of the lip and face-paint palettes.
  - That pairing comes from context (their neighbors and wording); no sheet links them.
  - French is **Opaque / Translucide**, never Foncé / Clair.
  - The other languages: ja 濃い / 薄い, ko 짙게 / 옅게, zh 浓艳 / 清淡.
- **Eyes:** the palette is ja **瞳の色** and zh **瞳色**; 目の色 / 眼睛颜色, which core carried before TERM-021, are not the client's. The picker tab for both eyes says 両目の色 / 双眼颜色 (row 2124), and its heterochromia toggle Odd Eyes says オッドアイにする / 虹膜异色 (row 2125).
- **One palette, three features.** Core's `tattooColors` is labeled by race:
  - Tattoo Color (most clans);
  - Limbal Ring Color (Au Ra);
  - Ear Clasp Color (Wildwood ♂ ♀ and Keeper of the Moon ♀: 耳飾りの色, Ohrschmuckfarbe, Couleur des boucles d'oreilles, 귀걸이 색, 耳饰颜色).
  - The client has no name for the palette as a whole. Ours, *Tattoo / Limbal Ring*, is a house choice built from the first two labels; it leaves out the ear clasps. Outside English the label joins the two halves with ` / ` (spaces, ASCII slash), never the fullwidth `／`: ja 刺青 / 瞳の輪郭, de Tattoo / Äußere Iris, fr Tatouage / Contour de l'iris, ko 문신 / 눈동자 테두리, zh 刺青 / 瞳孔轮廓. This rule is for the standalone label only; ／ inside Japanese running prose is ordinary punctuation and not covered by it. The research note has the Hrothgar and Viera variants ("tattoos and ornaments" in four languages).
- **Hrothgar has no hair or lip palette:**
  - Customize 10 is **Fur Color** (row 1014). It labels the palette core keys `hairColors` for Helions and The Lost.
  - Customize 20 is **Fur Pattern** (row 1013). It takes the lip slot and is not a color, so a Hrothgar file's lip value names a pattern.
  - Fur Color is in the palette table and Fur Pattern in the feature table above, both read from [`lobby-rows.json`](../research/2026-10-05-character-sheet-terms/lobby-rows.json) (`text`). Not the client's word, so not used for the pattern: 毛皮の模様, Fellmuster, motif de fourrure, 모피 무늬, 毛皮花纹.

---

## Other locale sections

Each locale file has a `locale` string plus fifteen sections. Those not tabled above:

| Key | Entries | What it holds |
|-----|---------|---------------|
| `meta` | 3 | Build metadata — `version`, `generated` timestamp, `dyeCount` |
| `labels` | 7 | Dye trait labels: `dye`, `dark`, `metallic`, `pastel`, `cosmic`, `cosmicExploration`, `cosmicFortunes` |
| `visions` | 5 | Short vision-type labels (see above) |
| `tools` | 6 | Tool display names: Harmony Explorer, Gradient Builder, Dye Mixer, Swatch Matcher, Dye Comparison, Accessibility Checker |
| `sheets` | 9 | Character-creation colour-sheet names: eye, highlight, lip (dark/light), tattoo/limbal, face paint (dark/light), hair, skin. Generated from `buildSheets`, which follows [Character-Creation Color Sheets](#character-creation-color-sheets) |

There is **no** `jobNames` or `grandCompanyNames` section — job and Grand Company names are not
part of this dataset, because nothing in the toolset renders them.

---

## Maintenance

When Square Enix adds new dyes or changes terminology:

1. Update the sources in `packages/core`, never the generated locale JSON: `dyenames.csv` or
   `facewear-names.csv` for names, `localize.yaml` for labels, and the tables in
   `scripts/build-locales.ts` for every other section. A new or renamed dye or Facewear color
   also changes `src/data/dyes.json` or `src/data/facewear_colors.json`: the build exits 1 until
   the CSV names exactly the same entries, with the same English names.
2. Run `pnpm turbo run build test --filter=@xivdyetools/core` (`build` regenerates the locale JSON)
3. Publish new core version
4. Update consuming apps

**See also:** [Glossary](glossary.md) for color theory and application-specific terms.
