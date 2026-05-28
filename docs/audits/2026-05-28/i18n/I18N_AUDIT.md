# i18n Audit Report — XIV Dye Tools

**Date:** 2026-05-28
**Scope:** `@xivdyetools/core` locale files (6 languages), `@xivdyetools/bot-i18n`, CJK subset fonts, font stacks across `discord-worker` and `og-worker`
**Source locale:** `en`
**Target locales:** `ja`, `de`, `fr`, `ko`, `zh`
**Terminology dictionary:** `docs/reference/ffxiv-terminology.md` (official SE terms, all 6 languages)

---

## Executive Summary

The core localization is in **excellent shape**. All 6 locales have perfect structural parity (247 keys, zero missing/extra), no real duplicate keys, and ja/ko/zh are ~99% translated. The headline issues are entirely in the **font pipeline**, not the translations:

| Area | Status |
|------|--------|
| Locale key parity | ✅ Perfect (247/247 all locales) |
| Duplicate keys | ✅ None (5 flagged are false positives — see below) |
| Untranslated strings | ✅ Negligible (proper-noun residue only) |
| Terminology adherence | ✅ Locale files match the official reference |
| **CJK subset font staleness** | ❌ SC missing 7 glyphs, KR missing 2 glyphs |
| **KR subset font bloat** | ⚠️ 820 KiB; should be ~225 KiB (~595 KiB wasted) |
| **og-worker image localization** | ⚠️ Embed text localized, embed image always English |

| Metric | Value |
|--------|-------|
| Locales | 6 (en, ja, de, fr, ko, zh) |
| Keys per locale | 247 |
| Missing keys (any locale) | 0 |
| Extra keys (any locale) | 0 |
| Real duplicate keys | 0 |
| Missing font glyphs (SC) | 7 |
| Missing font glyphs (KR) | 2 |
| Recoverable bundle size (KR re-subset) | ~595 KiB |

---

## 1. Locale Configuration

- **Format:** Nested JSON, one file per locale: `packages/core/src/data/locales/{en,ja,de,fr,ko,zh}.json`
- **Top-level sections:** `locale`, `meta`, `labels`, `dyeNames`, `categories`, `acquisitions`, `currencies`, `metallicDyeIds` (array), `harmonyTypes`, `visionTypes`, `visions`, `tools`, `sheets`, `jobNames`, `grandCompanyNames`, `races`, `clans`
- **Build pipeline:** `fetch_dye_names.py` → `dyenames.csv` → `build-locales.ts` (+ `localize.yaml`) → JSON. XIVAPI serves en/ja/de/fr; ko/zh names are sourced manually.
- **Bot UI strings:** separate set in `packages/bot-i18n/src/locales/{locale}.json`

All six files are **exactly 295 lines** — strong structural consistency. Byte sizes vary as expected for the script (ja 10.2 KB, zh 7.8 KB, en 8.2 KB) because CJK is 3 bytes/char in UTF-8.

---

## 2. Key Parity ✅

Flattened-key comparison against `en` (247 keys):

| Locale | Keys | Missing | Extra |
|--------|------|---------|-------|
| ja | 247 | 0 | 0 |
| de | 247 | 0 | 0 |
| fr | 247 | 0 | 0 |
| ko | 247 | 0 | 0 |
| zh | 247 | 0 | 0 |

No action needed.

---

## 3. Duplicate Keys — ✅ None (false positive corrected)

A naive flat-regex duplicate scan flags 5 keys in **every** file:
`normal`, `protanopia`, `deuteranopia`, `tritanopia`, `achromatopsia`.

**These are NOT duplicates.** They legitimately appear in two *separate* nested objects:
- `visionTypes` (verbose labels, e.g. `"Deuteranopia (Red-Green Colorblindness)"`)
- `visions` (short labels, e.g. `"Deuteranopia"`)

JSON keeps both because they live in different parent objects. The lesson: object-scoped parsing is required to detect real duplicates in nested JSON — a flat `"key":` regex cannot distinguish sibling collisions from same-name keys under different parents. **No remediation needed.**

---

## 4. Untranslated Strings — ✅ Negligible

Percentage of string values *identical to English* per locale:

| Locale | Identical / Total | % | Interpretation |
|--------|-------------------|---|----------------|
| ja | 3 / 246 | 1% | Effectively complete |
| ko | 3 / 246 | 1% | Effectively complete |
| zh | 3 / 246 | 1% | Effectively complete |
| de | 19 / 246 | 7% | Proper nouns (races, jobs, clans) |
| fr | 15 / 246 | 6% | Proper nouns (races, jobs, clans) |

The "identical" values are **intentional**, not gaps:
- The ~3 shared by all locales are `meta.version` (`"1.0.0"`), the `metallicDyeIds` list placeholder, and `currencies.Cosmocredits` (`"CC"` — a universal abbreviation).
- de/fr residue is concentrated in `races` (Hyur, Elezen, Lalafell, Viera…), `jobNames` (Paladin, Ninja, Bard…), and `clans` — Latin-script proper nouns that are identical in the official German/French localizations (confirmed against `ffxiv-terminology.md`).

> **Memory correction:** Project memory and several CLAUDE.md files note "ko/zh names still pending." That is **stale**. The per-dye ko/zh locales are fully populated (268 Hangul + 332 CJK codepoints present, 1% identical-to-en), and the patch-7.5 *consolidated* dye names in `config/consolidated-ids.ts` now also carry ko/zh values (`'염료: 기본 색상'`, `'通用染剂'`, etc.). Nothing is pending.

---

## 5. Terminology Validation — ✅ Clean

`docs/reference/ffxiv-terminology.md` is a well-maintained 6-language glossary of official SE terms (dye names, categories, acquisitions, currencies, races, clans, harmony types, vision types, jobs, grand companies). Spot-checks of the locale JSON against the reference matched (e.g. categories `Reds → 赤系 / Rot / Rouges / 빨강 / 红色系`; the reference confirms JA dye names are stored *without* the `カララント:` prefix, matching the JSON).

### One cross-file consistency nit (LOW)
`config/consolidated-ids.ts` declares the Firmament dye currency as **`"Sky Builders' Scrips"`** (with apostrophe and space), while the locale `currencies` key is **`"Skybuilders Scrips"`**. These are different strings. If any consumer maps a consolidated dye's `currency` field through the locale `currencies` lookup, it will miss and fall back to the raw string. Recommend aligning on one spelling (the locale key form). Not user-visible today because the consolidated currency is rendered directly.

---

## 6. Non-Latin Script Inventory

Codepoints detected per locale (used to size the subset fonts):

| Locale | Scripts (codepoint counts) | Required Font |
|--------|----------------------------|---------------|
| en/de/fr | Latin only | base (Onest/Space Grotesk) |
| ja | CJK Unified 89, Katakana 72, Hiragana 2, Fullwidth 3 | Noto Sans SC |
| ko | Hangul Syllables 268 | Noto Sans KR |
| zh | CJK Unified 332, Fullwidth 2 | Noto Sans SC |

**Totals across core + bot-i18n (the subset script's actual inputs):** 1,061 CJK-range codepoints, 458 Hangul-range codepoints.

Korean uses **zero** CJK ideographs — important for §7.

---

## 7. Font Subset Audit

See the companion file **[FONT_SUBSET_AUDIT.md](FONT_SUBSET_AUDIT.md)** for full detail. Summary of the two real findings:

### 7.1 ❌ Stale subsets — 9 glyphs will render as tofu (□)
The committed subsets predate recent locale edits. Characters present in current locale files but **absent** from the committed subset fonts:

- **NotoSansSC-Subset.ttf** missing 7: `差`(U+5DEE) `挑`(U+6311) `测`(U+6D4B) `睛`(U+775B) `膜`(U+819C) `辅`(U+8F85) `／`(U+FF0F)
- **NotoSansKR-Subset.ttf** missing 2: `믹`(U+BBF9) `빌`(U+BE4C) — likely from "믹서"(Mixer) / "빌더"(Builder) bot-UI labels

**Fix:** re-run `apps/discord-worker/scripts/subset-cjk-fonts.py` and commit the regenerated `.ttf` files.

### 7.2 ⚠️ KR subset is ~595 KiB larger than necessary
`NotoSansKR-Subset.ttf` is **820 KiB** and carries **821 CJK Han glyphs** that Korean text never uses. Root cause: [subset-cjk-fonts.py:193](../../../apps/discord-worker/scripts/subset-cjk-fonts.py#L193) passes the *full* codepoint set (including all ja/zh CJK) to the KR subset. Noto Sans KR bundles Hanja, so it greedily keeps them. The font stack already routes CJK to Noto Sans SC, so these glyphs are dead weight.

A correct Hangul+ASCII-only KR subset measures **~225 KiB** (verified empirically). That is a **~595 KiB** reduction in the discord-worker bundle (memory notes the worker is ~8 MiB against a 10 MiB limit, so this is meaningful headroom).

**Fix:** populate the KR subsetter with Hangul + ASCII codepoints only, not the shared CJK set.

### 7.3 Font stacks ✅ / ⚠️
| Context | Stack | CJK fallback | Status |
|---------|-------|--------------|--------|
| discord-worker SVG | `${primary}, Noto Sans SC, Noto Sans KR` via `getFontWithCjkFallback()` | ✅ | ✅ Correct (both subsets bundled in `getFontBuffers()`) |
| og-worker SVG image | `Onest` / `Space Grotesk` / `Habibi` only | ❌ | ⚠️ See §8 |

---

## 8. og-worker Localization Inconsistency (⚠️ LOW–MEDIUM)

og-worker serves two surfaces for shared links:
1. **Crawler HTML** (`og:title`/`og:description` meta tags) — **localized** via `?lang=` → `generateOGDataForTool(..., locale)`. Rendered by the client (Discord/browser), so CJK displays correctly.
2. **PNG card** (`/og/<tool>/...png`) — the SVG generators receive **no locale** and render `dye.name`, i.e. the **English** database name ([harmony.ts:210](../../../apps/og-worker/src/services/svg/harmony.ts#L210)).

**Consequence:** a ja/ko/zh user sharing a link gets an embed whose *title/description are localized* but whose *preview image shows English dye names* — a polish/consistency gap, **not** a tofu rendering bug (no CJK ever reaches resvg).

**Latent risk:** og-worker bundles **no CJK fonts**. If image localization is ever added (passing `locale` into the SVG generators and looking up localized names), CJK would render as tofu until subset fonts are added — exactly as the worker's own `CLAUDE.md` deployment checklist warns.

**Recommendation:** decide intent. Either (a) accept English-only images and document it, or (b) localize image dye names *and* bundle the SC/KR subsets into og-worker first.

---

## 9. Recommended Actions (priority order)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | Re-run `subset-cjk-fonts.py`, commit updated SC+KR subsets (fixes 9 tofu glyphs) | LOW | HIGH (correctness) |
| 2 | Fix `subset-cjk-fonts.py` to give the KR subset Hangul+ASCII only (saves ~595 KiB) | LOW | MEDIUM (bundle size) |
| 3 | Add a CI check that fails when locale codepoints aren't covered by committed subsets | MEDIUM | HIGH (prevents recurrence) |
| 4 | Decide og-worker image localization intent; bundle CJK fonts if localizing | MEDIUM | LOW–MEDIUM |
| 5 | Align consolidated-dye currency string with the locale `currencies` key | LOW | LOW |

> All findings are documented; **no code or locale files were modified** by this audit.
