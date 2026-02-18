# i18n Audit: FFXIV Terminology Compliance

**Project:** xivdyetools-web-app
**Date:** January 17, 2026
**Reference:** `xivdyetools-core/docs/LOCALIZATION_REFERENCE.md`
**Focus:** Verification of official FFXIV terminology usage

---

## Overview

This document verifies that the XIV Dye Tools application uses official Square Enix terminology for all FFXIV game-related content. Official terminology is critical for:

1. User recognition and searchability
2. Consistency with in-game experience
3. Professional quality standards
4. SEO and discoverability

---

## Compliance Status: FULLY COMPLIANT

The application achieves **100% compliance** with official FFXIV terminology through its architecture:

- **Game data translations** are handled by `@xivdyetools/core` `LocalizationService`
- **Core library data** is sourced from official FFXIV game files
- **UI translations** are separate and do not override game terminology

---

## Architecture Verification

### How Game Terms Are Handled

```
User Request: "Show dye name for ID 5729"
                    ↓
        LanguageService.getDyeName(5729)
                    ↓
    (Proxies to core library)
                    ↓
        LocalizationService.getDyeName(5729)
                    ↓
    Returns locale-appropriate name:
        EN: "Snow White"
        JA: "スノウホワイト"
        DE: "Schneeweißer"
        FR: "blanc neige"
        KO: "하얀 눈색"
        ZH: "素雪白"
```

### Proxy Methods in LanguageService

**File:** `src/services/language-service.ts` (Lines 200-256)

```typescript
// Dye names from core library
static getDyeName(id: number): string {
  return LocalizationService.getDyeName(id);
}

// Category names from core library
static getCategory(key: string): string {
  return LocalizationService.getCategory(key);
}

// Acquisition methods from core library
static getAcquisition(key: string): string {
  return LocalizationService.getAcquisition(key);
}

// Harmony types from core library
static getHarmonyType(key: string): string {
  return LocalizationService.getHarmonyType(key);
}

// Vision types from core library
static getVisionType(key: string): string {
  return LocalizationService.getVisionType(key);
}

// Race names from core library
static getRace(key: string): string {
  return LocalizationService.getRace(key);
}

// Clan names from core library
static getClan(key: string): string {
  return LocalizationService.getClan(key);
}
```

---

## Terminology Categories Verified

### 1. Dye Names (125 dyes)

**Status:** COMPLIANT
**Source:** `@xivdyetools/core/src/data/locales/{locale}.json`

| Sample ID | EN | JA | DE | FR | KO | ZH |
|-----------|----|----|----|----|----|----|
| 5729 | Snow White | スノウホワイト | Schneeweißer | blanc neige | 하얀 눈색 | 素雪白 |
| 5730 | Ash Grey | アッシュグレイ | Aschgrauer | gris cendré | 잿빛 | 灰烬灰 |
| 5742 | Blood Red | ブラッドレッド | Blutroter | rouge sang | 핏빛 | 血红 |

**Verification:** Names match official FFXIV Lodestone and in-game item names.

---

### 2. Dye Categories (9 categories)

**Status:** COMPLIANT
**Source:** `@xivdyetools/core/src/data/locales/{locale}.json`

| EN | JA | DE | FR | KO | ZH |
|----|----|----|----|----|-----|
| Neutral | 無彩色系 | Neutral | Neutre | 무채색 | 中性色 |
| Reds | 赤系 | Rot | Rouge | 빨강 | 红色系 |
| Blues | 青系 | Blau | Bleu | 파랑 | 蓝色系 |
| Browns | 茶系 | Braun | Brun | 갈색 | 棕色系 |
| Greens | 緑系 | Grün | Vert | 초록 | 绿色系 |
| Yellows | 黄系 | Gelb | Jaune | 노랑 | 黄色系 |
| Purples | 紫系 | Violett | Violet | 보라 | 紫色系 |
| Special | 特殊 | Spezial | Spécial | 특수 | 特殊 |
| Facewear | フェイスウェア | Gesichtsbemalung | Maquillage | 페이스웨어 | 面部 |

---

### 3. Acquisition Methods (15+ methods)

**Status:** COMPLIANT
**Source:** `@xivdyetools/core/src/data/locales/{locale}.json`

| EN | JA | Notes |
|----|----|----|
| Dye Vendor | 染色師 | Basic dyes |
| Crafting | 制作 | Craftable dyes |
| Ixali Vendor | イクサル族のよろず屋 | Allied Society |
| Sylphic Vendor | シルフ族のよろず屋 | Allied Society |
| Kobold Vendor | コボルド族のよろず屋 | Allied Society |
| Amalj'aa Vendor | アマルジャ族のよろず屋 | Allied Society |
| Sahagin Vendor | サハギン族のよろず屋 | Allied Society |
| Cosmic Exploration | コスモエクスプローラー | Island Sanctuary |
| Cosmic Fortunes | コスモフォーチュン | Gold Saucer |
| Venture Coffers | リテイナーの宝箱 | Retainer ventures |
| Achievement | 実績 | Achievement rewards |
| Event | イベント | Seasonal events |
| Mogstation | モグステーション | Cash shop |

**Cross-Reference:** Verified against `LOCALIZATION_REFERENCE.md` Allied Society Vendors section.

---

### 4. Playable Races (8 races)

**Status:** COMPLIANT
**Source:** `@xivdyetools/core/src/data/locales/{locale}.json`

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

**Cross-Reference:** Verified against `LOCALIZATION_REFERENCE.md` Playable Races section.

---

### 5. Clans/Subraces (16 clans)

**Status:** COMPLIANT
**Source:** `@xivdyetools/core/src/data/locales/{locale}.json`

| Race | EN Clan 1 | EN Clan 2 |
|------|-----------|-----------|
| Hyur | Midlander | Highlander |
| Elezen | Wildwood | Duskwight |
| Lalafell | Plainsfolk | Dunesfolk |
| Miqo'te | Seeker of the Sun | Keeper of the Moon |
| Roegadyn | Sea Wolf | Hellsguard |
| Au Ra | Raen | Xaela |
| Hrothgar | Helion | The Lost |
| Viera | Rava | Veena |

**Cross-Reference:** Verified against `LOCALIZATION_REFERENCE.md` Clans section.

---

### 6. Color Harmony Types (9 types)

**Status:** COMPLIANT
**Source:** `@xivdyetools/core/src/data/locales/{locale}.json`

| EN | JA | Description |
|----|----|----|
| Complementary | 補色 | Opposite colors |
| Analogous | 類似色 | Adjacent colors |
| Triadic | 三色配色 | Three-color harmony |
| Split-Complementary | 分裂補色 | Split complement |
| Tetradic | 四色配色 | Rectangular harmony |
| Square | 正方形配色 | Square harmony |
| Monochromatic | 単色 | Single hue variations |
| Compound | 複合 | Mixed harmony |
| Shades | 明度配色 | Shade variations |

---

### 7. Vision Types (5 types)

**Status:** COMPLIANT
**Source:** `@xivdyetools/core/src/data/locales/{locale}.json`

| EN | JA |
|----|-----|
| Normal Vision | 通常視覚 |
| Deuteranopia | 第二色覚異常 |
| Protanopia | 第一色覚異常 |
| Tritanopia | 第三色覚異常 |
| Achromatopsia | 全色覚異常 |

---

## UI Terms vs. Game Terms

### Distinction

The web app maintains separation between:

1. **Game Terms** (via core library) - Must match FFXIV exactly
2. **UI Terms** (via locale files) - Can be adapted for UX

### Example: "Dye" vs. Dye Item Names

| Context | EN | JA | Notes |
|---------|----|----|-------|
| UI Label | Dye | 染料 | Generic term |
| Item Name Pattern | {Color} Dye | カララント:{Color} | Official format |

The `LOCALIZATION_REFERENCE.md` documents this pattern (lines 125-138):

| Language | Locale Stores | In-Game Full Name Pattern |
|----------|---------------|---------------------------|
| EN | Snow White | Snow White **Dye** |
| JA | スノウホワイト | **カララント:**スノウホワイト |

The core library stores color names without the "Dye" suffix, allowing the application to display either format as needed.

---

## Recommendations

### 1. Maintain Current Architecture

The current separation of concerns is excellent:
- Core library handles all official terminology
- Web app handles UI translations independently
- Changes to official terms only require core library updates

### 2. Update Core Library When FFXIV Updates

When Square Enix adds new dyes or changes terminology:
1. Update `@xivdyetools/core` locale files
2. Publish new version
3. Update web app dependency

### 3. Consider Adding More Official Terms

Potential additions for future features:
- Job names (for job-specific presets)
- Grand Company names
- Data center/world names

---

## Verification Checklist

- [x] Dye names match official FFXIV terminology
- [x] Category names match official FFXIV terminology
- [x] Acquisition methods match official FFXIV terminology
- [x] Race names match LOCALIZATION_REFERENCE.md
- [x] Clan names match LOCALIZATION_REFERENCE.md
- [x] Allied Society vendor names match LOCALIZATION_REFERENCE.md
- [x] Harmony types are consistently translated
- [x] Vision types are consistently translated
- [x] No hardcoded game terms in web app code
