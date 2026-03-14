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

## Acquisition Methods

**Source:** `locales/{locale}.json` → `acquisitions`

| EN | JA | DE | FR | KO | ZH |
|----|----|----|----|----|-----|
| Dye Vendor | 染色師 | Farbstoffverkäufer | Vendeur de teinture | 염료 판매상 | 染剂商人 |
| Crafting | 制作 | Handwerker | Artisanat | 제작 | 制作 |
| Ixali Vendor | イクサル族のよろず屋 | Ixal-Händler | Vendeur ixal | 익살 상인 | 鸟人商人 |
| Sylphic Vendor | シルフ族のよろず屋 | Sylphen-Händlerin | Vendeur sylphe | 실프 상인 | 妖精商人 |
| Amalj'aa Vendor | アマルジャ族のよろず屋 | Amalj'aa-Händler | Vendeur amalj'aa | 아말쟈 상인 | 阿马尔贾商人 |
| Sahagin Vendor | サハギン族のよろず屋 | Sahagin-Händler | Vendeur sahuagin | 사하긴 상인 | 鱼人商人 |
| Kobold Vendor | コボルド族のよろず屋 | Kobold-Händler | Vendeur kobold | 코볼드 상인 | 钴铁商人 |
| Cosmic Exploration | コスモエクスプローラー | Kosmo-Erkundung | l'exploration cosmique | 코스모 탐사 | 宇宙探索 |
| Cosmic Fortunes | コスモフォーチュン | Kosmo-Glück | Roue de la fortune cosmique | 코스모 행운 | 宇宙幸运 |
| Venture Coffers | リテイナーの宝箱 | Gehilfen-Schatzkiste | Trouvaille de servant | 집사의 보물상자 | 雇员宝箱 |
| Facewear Collection | フェイスウェアコレクション | Gesichtsschmuck-Sammlung | Collection accessoires faciaux | 페이스웨어 컬렉션 | 脸部配饰收藏 |

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
| Hrothgar | Helion | The Lost | ヘリオン | ロスト |
| Viera | Rava | Veena | ラヴァ・ヴィエラ | ヴィナ・ヴィエラ |

---

## Color Harmony Types (9 types)

**Source:** `locales/{locale}.json` → `harmonyTypes`

| EN | JA | DE | FR | KO | ZH |
|----|----|----|----|----|-----|
| Complementary | 補色 | Komplementär | Complémentaire | 보색 | 互补色 |
| Analogous | 類似色 | Analog | Analogue | 유사색 | 类似色 |
| Triadic | 三色配色 | Triadisch | Triadique | 삼원색 | 三角配色 |
| Split Complementary | 分裂補色 | Geteiltes Komplement | Complémentaire divisé | 분리보색 | 分裂互补 |
| Tetradic | 四色配色 | Tetradisch | Tétradique | 사색 | 四色配色 |
| Square | 正方形配色 | Quadrat | Carré | 정사각형 | 正方形配色 |
| Monochromatic | 単色 | Monochromatisch | Monochromatique | 단색 | 单色 |
| Compound | 複合 | Zusammengesetzt | Composé | 복합 | 复合 |
| Shades | 明度配色 | Schattierungen | Nuances | 명암 | 明暗 |

---

## Vision Types (5 types)

**Source:** `locales/{locale}.json` → `visionTypes`

| EN | JA | DE | FR | KO | ZH |
|----|----|----|----|----|-----|
| Normal Vision | 通常視覚 | Normales Sehen | Vision normale | 정상 시력 | 正常视觉 |
| Deuteranopia | 第二色覚異常 | Deuteranopie | Deutéranopie | 제2색맹 | 绿色盲 |
| Protanopia | 第一色覚異常 | Protanopie | Protanopie | 제1색맹 | 红色盲 |
| Tritanopia | 第三色覚異常 | Tritanopie | Tritanopie | 제3색맹 | 蓝色盲 |
| Achromatopsia | 全色覚異常 | Achromatopsie | Achromatopsie | 전색맹 | 全色盲 |

---

## Jobs (21 combat jobs)

**Source:** `locales/{locale}.json` → `jobNames`

| EN | JA | DE | FR | KO | ZH |
|----|----|----|----|----|-----|
| Paladin | ナイト | Paladin | Paladin | 나이트 | 骑士 |
| Warrior | 戦士 | Krieger | Guerrier | 전사 | 战士 |
| Dark Knight | 暗黒騎士 | Dunkelritter | Chevalier noir | 암흑기사 | 暗黑骑士 |
| Gunbreaker | ガンブレイカー | Revolverklinge | Pistosabreur | 건브레이커 | 绝枪战士 |
| White Mage | 白魔道士 | Weißmagier | Mage blanc | 백마도사 | 白魔法师 |
| Scholar | 学者 | Gelehrter | Érudit | 학자 | 学者 |
| Astrologian | 占星術師 | Astrologe | Astromancien | 점성술사 | 占星术士 |
| Sage | 賢者 | Weiser | Sage | 현자 | 贤者 |
| Monk | モンク | Mönch | Moine | 몽크 | 武僧 |
| Dragoon | 竜騎士 | Dragoon | Chevalier dragon | 용기사 | 龙骑士 |
| Ninja | 忍者 | Ninja | Ninja | 닌자 | 忍者 |
| Samurai | 侍 | Samurai | Samouraï | 사무라이 | 武士 |
| Reaper | リーパー | Schnitter | Faucheur | 리퍼 | 钐镰客 |
| Viper | ヴァイパー | Viper | Rôdeur vipère | 바이퍼 | 蝰蛇剑士 |
| Bard | 吟遊詩人 | Barde | Barde | 음유시인 | 吟游诗人 |
| Machinist | 機工士 | Maschinist | Machiniste | 기공사 | 机工士 |
| Dancer | 踊り子 | Tänzer | Danseur | 무도가 | 舞者 |
| Black Mage | 黒魔道士 | Schwarzmagier | Mage noir | 흑마도사 | 黑魔法师 |
| Summoner | 召喚士 | Beschwörer | Invocateur | 소환사 | 召唤师 |
| Red Mage | 赤魔道士 | Rotmagier | Mage rouge | 적마도사 | 赤魔法师 |
| Pictomancer | ピクトマンサー | Piktomant | Pictomancien | 픽토맨서 | 绘灵法师 |
| Blue Mage | 青魔道士 | Blaumagier | Mage bleu | 청마도사 | 青魔法师 |

---

## Grand Companies (3)

**Source:** `locales/{locale}.json` → `grandCompanyNames`

| EN | JA | DE | FR | KO | ZH |
|----|----|----|----|----|-----|
| The Maelstrom | 黒渦団 | Der Mahlstrom | Le Maelstrom | 흑와단 | 黑涡团 |
| Order of the Twin Adder | 双蛇党 | Die Bruderschaft der Morgenviper | L'ordre des Deux Vipères | 쌍사당 | 双蛇党 |
| Immortal Flames | 不滅隊 | Die Legion der Unsterblichen | Les Immortels | 불멸대 | 恒辉队 |

---

## Maintenance

When Square Enix adds new dyes, jobs, or changes terminology:

1. Update `@xivdyetools/core` locale JSON files
2. Run `pnpm turbo run build test --filter=@xivdyetools/core`
3. Publish new core version
4. Update consuming apps

**See also:** [Glossary](glossary.md) for color theory and application-specific terms.
