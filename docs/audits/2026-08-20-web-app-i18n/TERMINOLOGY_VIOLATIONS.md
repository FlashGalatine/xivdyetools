# Terminology Report — web-app locales vs the FFXIV terminology dictionary

**Date:** 2026-08-20 · **Branch:** `monorepo-2.0-prep` @ `1cbb303e`
**Dictionary:** `docs/reference/ffxiv-terminology.md` (84 EN terms × 5 languages) cross-checked against the **runtime** source `packages/core/src/data/locales/*.json` (the doc and the runtime disagree in one cell — see "Dictionary drift" at the end)
**Locales checked:** `apps/web-app/src/locales/{de,fr,ja,ko,zh}.json`
**Evidence:** `evidence/terminology-vs-dictionary.txt`

---

## Summary

| Class | Count | Severity |
|-------|-------|----------|
| Genuine official-term violation (game noun spelled wrong) | **1** | 🟡 Medium |
| Two vocabularies on screen at once — web-app `config.*` / `colorPalette.*` disagree with core `harmonyTypes` / `visionTypes` / `categories` that render in the same tool | **58 cells** (ja 16 · ko 15 · de 14 · zh 8 · fr 5) | 🟡 Medium (consistency) — and see TERM-002 for why 14 of the 58 are actually a **bug**, not a vocabulary choice |
| Official compound term paraphrased ("Venture Coffer" → "Truhe"/"Kiste"/"coffre"/"상자" instead of Schatzkiste / Trouvaille / 보물상자) | 5 strings | 🟢 Low |
| Grand Company name with article dropped (de `Legion der Unsterblichen` vs official `Die Legion der Unsterblichen`) | 1 | ⚪ Info — defensible as a preset name |

Races, jobs, clans, Grand Companies, currencies and acquisition names are otherwise **correct** everywhere they appear in the web-app tree (the only race-name miss is TERM-001). Dye names never appear in the web-app locale files — they come from core at runtime, as the dictionary prescribes.

---

## TERM-001 · ko `swatch.absentFurPattern` — wrong Hrothgar

| | |
|-|-|
| **Key** | `swatch.absentFurPattern` |
| **Current (ko)** | `로스가르에서는 이 값이 모피 무늬이며 색이 아닙니다` |
| **Official term** | Hrothgar = **로스갈** (dictionary § Playable Races; core `races.Hrothgar`) |
| **Fix** | `로스갈에서는 이 값이 모피 무늬이며 색이 아닙니다` |

A user who has just imported a Hrothgar `.chara` file sees the race name spelled differently in this hint than on the slot card directly above it (which uses core's `getRace()`).

---

## TERM-002 · `colorPalette.{reds,blues,browns,greens,yellows,purples}` — 14 cells differ from core, and the keys never render anyway

The palette drawer (`components/v4/dye-palette-drawer.ts:50-61`) maps category → `colorPalette.*` keys, but the map is keyed `White/Grey/Black/Brown/Red/Orange/Yellow/Green/Blue/Purple/Pink` while the runtime `Dye.category` values are `Blues/Browns/Greens/Neutral/Purples/Reds/Special/Yellows`. **No key ever matches**, so `LanguageService.t('Blues')` logs `Translation not found` and the drawer shows the raw English category in every locale. (Catalogued as **HC-V4-001** in `HARDCODED_STRINGS.md`.)

Consequence for terminology: the 14 divergent cells below are moot — the right fix is to render `LanguageService.getCategory(category)` (core's vocabulary, which `dye-grid.ts:205`, `dye-search-box.ts:197` and `dye-card-renderer.ts:153` already use) and **delete** `colorPalette.{whites,grays,blacks,browns,reds,oranges,yellows,greens,blues,purples,pinks}` (11 keys × 6 locales). Deleting them will trip the `i18n:unused` orphan gate only if the map is left behind — remove both together.

| Key | de (web) / de (core) | ja (web) / ja (core) | ko (web) / ko (core) |
|-----|----------------------|----------------------|----------------------|
| reds | Rottöne / **Rot** | レッド系 / **赤系** | 레드 / **빨강** |
| blues | Blautöne / **Blau** | ブルー系 / **青系** | 블루 / **파랑** |
| browns | Brauntöne / **Braun** | ブラウン系 / **茶系** | 브라운 / **갈색** |
| greens | Grüntöne / **Grün** | グリーン系 / **緑系** | 그린 / **녹색** |
| yellows | Gelbtöne / **Gelb** | イエロー系 / **黄系** | 옐로우 / **노랑** |
| purples | Lilatöne / **Violett** | パープル系 / **紫系** | 퍼플 / **보라** |

(fr and zh already match core.)

---

## TERM-003 · `config.{triadic,tetradic,square,monochromatic,compound,shades,splitComplementary}` — harmony names differ between the config sidebar and the result panel

`config-sidebar.ts:944-957` labels the harmony `<select>` with `config.*` (web-app locale). `harmony-generator.ts:99` and `v4-color-wheel.ts:384` label the result cards and the wheel with `LanguageService.getHarmonyType()` (core locale). Both are on screen at the same time in the Harmony tool, so a Japanese user picks **トライアド** in the sidebar and gets cards titled **三色配色**.

| Key | de web / core | ja web / core | ko web / core | zh web / core |
|-----|---------------|---------------|---------------|---------------|
| triadic | — | トライアド / **三色配色** | — | 三色 / **三角配色** |
| tetradic | — | テトラード / **四色配色** | 사원색 / **사색** | 四色 / **四色配色** |
| square | — | スクエア / **正方形配色** | — | 正方形 / **正方形配色** |
| monochromatic | — | モノクロマティック / **単色** | — | — |
| compound | Verbund / **Zusammengesetzt** | コンパウンド / **複合** | — | — |
| shades | — | — (both シェード) | — | 色调 / **明暗** |
| splitComplementary | Gespalten-Komplementär / **Geteiltes Komplement** | — | 분할 보색 / **분리보색** | — |

**Fix (recommended):** have the sidebar call `LanguageService.getHarmonyType(value)` for the option labels and delete `config.{complementary,analogous,triadic,splitComplementary,tetradic,square,monochromatic,compound,shades}` (9 keys × 6). Alternative: copy core's values into `config.*` — keeps the duplicate keys but removes the on-screen contradiction. Either way the vocabulary should have one owner; core already is that owner for the Discord bot and the OG cards.

---

## TERM-004 · `config.{deuteranopia,protanopia,tritanopia,achromatopsia}` — vision-type names differ between sidebar and tool

Same shape: `config-sidebar.ts:1170-1194` uses `config.*`; `accessibility-tool.ts:720/831/1371/1815` uses `getVisionType()`.

| Key | ja web / core | ko web / core | zh web / core |
|-----|---------------|---------------|---------------|
| deuteranopia | 第二色覚異常 / **2型色覚（赤緑色盲）** | 녹색맹 / **제2색맹 (적록색맹)** | 绿色盲 / **绿色盲（红绿色盲）** |
| protanopia | 第一色覚異常 / **1型色覚（赤緑色盲）** | 적색맹 / **제1색맹 (적록색맹)** | 红色盲 / **红色盲（红绿色盲）** |
| tritanopia | 第三色覚異常 / **3型色覚（青黄色盲）** | 청색맹 / **제3색맹 (청황색맹)** | 蓝色盲 / **蓝色盲（蓝黄色盲）** |
| achromatopsia | 全色覚異常 / **全色盲** | — | — |

Here the core strings carry a parenthetical that is too long for a toggle label, so the sidebar's short form is a legitimate design choice — but the *head* term should match (ja: core says 2型色覚, sidebar says 第二色覚異常; ko: 제2색맹 vs 녹색맹). Recommended: align the head noun to core's, keep the short form. en/de/fr already do exactly this (same head noun, parenthetical dropped).

---

## TERM-005 · "Venture Coffer" paraphrased (Low)

Official: de **Gehilfen-Schatzkiste** (label **Schatzkiste**), fr **Trouvaille de servant** (label **Trouvaille**), ko **집사의 보물상자** (label **보물상자**).

| Key | Locale | Current | Note |
|-----|--------|---------|------|
| `filters.excludeCoffers` | de | Truhen-Farbstoffe ausschließen | "Truhen" ≠ Schatzkiste |
| `filters.excludeCoffers` | fr | Exclure les Teintures de Coffres | "Coffres" ≠ Trouvaille |
| `preset.cfgHideUnbuyableDesc` | de | Blendet Handwerks- und Kistenfarben aus | "Kisten" |
| `preset.cfgHideUnbuyableDesc` | fr | …artisanales ou de coffre | "coffre" |
| `preset.cfgHideUnbuyableDesc` | ko | 제작·상자 한정 염료가 필요한 팔레트 제외 | "상자" |
| `budget.offText` | fr | …teintures de coffre de mission… | "coffre de mission" |

These are readable paraphrases; whether to force the official noun into a filter label is a translator call. The budget tool's own tier tag renders "COFFER" verbatim (HC-BUD-010), so the surface is already inconsistent.

---

## Dictionary drift (fix the doc, not the code)

`docs/reference/ffxiv-terminology.md` § Color Harmony Types lists ja **Shades = 明度配色**, but `packages/core/src/data/locales/ja.json` ships **シェード**, and the web-app's `config.shades` also says シェード. The runtime is the source of truth; the doc row is stale. (The doc also omits `invertedTetradic`, which core has.)

---

## Terms not in the dictionary worth a translator's eye

| Key(s) | Value | Why |
|--------|-------|-----|
| `tools.character.evercoldNotice*` (ja/ko/zh) | "Evercold" left in Latin script | The 8.0 expansion name will have an official ja/ko/zh rendering once announced; the string is dated "2027年1月" so it will be on screen for months. |
| `preset.gateBrowseNote` (ja/ko/zh) | アカウント不要。 / 계정 불필요. / 无需账号。 | Drops the second clause "no rate limit" that en/de/fr keep — meaning loss, not terminology. |
| `config.mixingOklab/Ryb/Hsl` (fr) | ` Perceptuel moderne` etc. | **Leading space** in all three values — a typo, visible as a mis-aligned option label. |
