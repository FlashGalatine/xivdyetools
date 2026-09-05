# FFXIV Terminology Reference

**Official Square Enix terminology used throughout XIV Dye Tools**

All game terms are sourced from official FFXIV game data and localized across 6 languages. These terms are stored in `@xivdyetools/core/src/data/locales/{locale}.json` and served through the `LocalizationService` API.

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
| `brass` | Brass | ブラス | Messing | Laiton | 황동색 | 黄铜色 |
| `purple` | Purple | パープル | Violett | Violet | 보라색 | 紫色 |
| `brown` | Brown | ブラウン | Braun | Marron | 갈색 | 棕色 |

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
| Hyur | ヒューラン | Hyuran | Hyuran | 휴란 | 人族 |
| Elezen | エレゼン | Elezen | Élézéen | 엘레젠 | 精灵族 |
| Lalafell | ララフェル | Lalafell | Lalafell | 라라펠 | 拉拉菲尔族 |
| Miqo'te | ミコッテ | Miqo'te | Miqo'te | 미코테 | 猫魅族 |
| Roegadyn | ルガディン | Roegadyn | Roegadyn | 루가딘 | 鲁加族 |
| Au Ra | アウラ | Au Ra | Ao Ra | 아우라 | 敖龙族 |
| Hrothgar | ロスガル | Hrothgar | Hrothgar | 로스갈 | 硌狮族 |
| Viera | ヴィエラ | Viera | Viéra | 비에라 | 维埃拉族 |

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

## Other locale sections

Each locale file has a `locale` string plus fifteen sections. Those not tabled above:

| Key | Entries | What it holds |
|-----|---------|---------------|
| `meta` | 3 | Build metadata — `version`, `generated` timestamp, `dyeCount` |
| `labels` | 7 | Dye trait labels: `dye`, `dark`, `metallic`, `pastel`, `cosmic`, `cosmicExploration`, `cosmicFortunes` |
| `visions` | 5 | Short vision-type labels (see above) |
| `tools` | 6 | Tool display names: Harmony Explorer, Gradient Builder, Dye Mixer, Swatch Matcher, Dye Comparison, Accessibility Checker |
| `sheets` | 9 | Character-creation colour-sheet names: eye, highlight, lip (dark/light), tattoo/limbal, face paint (dark/light), hair, skin |

There is **no** `jobNames` or `grandCompanyNames` section — job and Grand Company names are not
part of this dataset, because nothing in the toolset renders them.

---

## Maintenance

When Square Enix adds new dyes or changes terminology:

1. Update `@xivdyetools/core` locale JSON files
2. Run `pnpm turbo run build test --filter=@xivdyetools/core`
3. Publish new core version
4. Update consuming apps

**See also:** [Glossary](glossary.md) for color theory and application-specific terms.
