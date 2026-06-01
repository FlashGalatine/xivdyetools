# Font Subset Audit — XIV Dye Tools

**Scan Date:** 2026-05-28
**Locale sources scanned:** `packages/core/src/data/locales/` + `packages/bot-i18n/src/locales/` (ja, ko, zh, de, fr) — the exact inputs of `subset-cjk-fonts.py`
**Font files analyzed:** `apps/discord-worker/src/fonts/` and `apps/og-worker/src/fonts/`

---

## Font File Inventory

| Font File | Worker | Type | Size | cmap codepoints | Notes |
|-----------|--------|------|------|-----------------|-------|
| NotoSansSC-Regular.ttf | discord | Full source | 10.3 MiB | — | Subsetting source (not bundled) |
| NotoSansKR-Variable.ttf | discord | Full source | 9.9 MiB | — | Subsetting source (not bundled) |
| **NotoSansSC-Subset.ttf** | discord | Subset | **473 KiB** | 1,179 (1,059 CJK) | Bundled into Worker |
| **NotoSansKR-Subset.ttf** | discord | Subset | **801 KiB** | 1,400 (459 Hangul + 821 CJK) | Bundled — **bloated** |
| Onest-VariableFont_wght.ttf | both | Full | 120 KiB | Latin | Body/labels |
| SpaceGrotesk-VariableFont_wght.ttf | both | Full | 131 KiB | Latin | Headers |
| Habibi-Regular.ttf | both | Full | 33 KiB | Latin | Hex codes |

(og-worker bundles **only** the three Latin fonts — no CJK.)

---

## Non-Latin Script Summary

| Script | Codepoints needed | Locales | Covering font |
|--------|-------------------|---------|---------------|
| CJK Unified Ideographs | (part of 1,061 CJK-range) | ja, zh | Noto Sans SC |
| Katakana / Hiragana | (part of 1,061) | ja | Noto Sans SC |
| CJK Symbols / Fullwidth | (part of 1,061) | ja, zh | Noto Sans SC |
| Hangul Syllables | 458 | ko | Noto Sans KR |
| Latin Extended-A/B | a few | de, fr | Onest (base) — ✅ covered |

**Totals:** 1,061 CJK-range codepoints, 458 Hangul-range codepoints (core + bot-i18n combined).

---

## Finding F-1 — Stale subsets: 9 missing glyphs ❌

The committed subset fonts do not cover all characters present in the current locale files. These glyphs will render as **tofu (□)** in Discord bot images:

### NotoSansSC-Subset.ttf — covers 1,054 / 1,061, **missing 7**
| Char | Codepoint | Likely source |
|------|-----------|---------------|
| 差 | U+5DEE | "色差"/difference (zh) |
| 挑 | U+6311 | zh UI string |
| 测 | U+6D4B | "测试"/test, "检测" (zh) |
| 睛 | U+775B | "眼睛"/eye — eye-color sheet (zh) |
| 膜 | U+819C | limbal/membrane (zh) |
| 辅 | U+8F85 | "辅助"/assist (zh) |
| ／ | U+FF0F | fullwidth slash |

### NotoSansKR-Subset.ttf — covers 456 / 458, **missing 2**
| Char | Codepoint | Likely source |
|------|-----------|---------------|
| 믹 | U+BBF9 | "믹서"/Mixer (ko bot UI) |
| 빌 | U+BE4C | "빌더"/Builder (ko bot UI) |

**Root cause:** locale strings were edited after the last subset run (subset files date 2026-04-28). The subsetting script itself is correct for these glyphs — it simply needs to be re-run.

**Remediation:**
```bash
cd apps/discord-worker
pip install fonttools          # if not present
python scripts/subset-cjk-fonts.py
# commit the regenerated src/fonts/NotoSansSC-Subset.ttf + NotoSansKR-Subset.ttf
```

---

## Finding F-2 — KR subset bloat: ~595 KiB recoverable ⚠️

`NotoSansKR-Subset.ttf` is **801 KiB** with a cmap of 1,400 codepoints — of which **821 are CJK Han ideographs**. Korean locale text uses **zero** CJK ideographs (only Hangul). Those 821 glyphs are pure dead weight.

### Root cause
[`subset-cjk-fonts.py:193`](../../../apps/discord-worker/scripts/subset-cjk-fonts.py#L193):
```python
kr_size, kr_glyphs = subset_font(kr_input, KR_OUTPUT, codepoints, fix_names={...})
#                                                     ^^^^^^^^^^
# `codepoints` is the UNION of all characters from all locales (incl. all ja/zh CJK).
```
Both SC and KR are subset with the same `codepoints` set. The SC font escapes the problem because Noto Sans SC has no Hangul glyphs to pull in — but Noto Sans KR *does* ship Hanja, so it greedily keeps every requested CJK ideograph. Meanwhile the runtime font stack (`getFontWithCjkFallback`) routes CJK to Noto Sans SC, so the KR copies are never used.

### Verified impact
A correctly-scoped KR subset (Hangul + ASCII only) was generated empirically:

| | Current | Corrected (Hangul+ASCII) |
|---|---------|--------------------------|
| Size | 801 KiB | **~225 KiB** |
| Savings | — | **~595 KiB** |

### Remediation
Give the KR subsetter only the codepoints it can actually use. Minimal patch:
```python
# Compute a KR-specific set: ASCII + Hangul ranges only
HANGUL = lambda c: 0xAC00 <= c <= 0xD7AF or 0x1100 <= c <= 0x11FF
kr_codepoints = {c for c in codepoints if c < 0x80 or HANGUL(c)}
kr_size, kr_glyphs = subset_font(kr_input, KR_OUTPUT, kr_codepoints, fix_names={...})
```
(Equivalently, keep CJK Symbols/Punctuation if any Korean string uses them — none do today.)

---

## Finding F-3 — og-worker has no CJK fonts (latent) ⚠️

og-worker bundles only Latin fonts. Today its PNG cards render English `dye.name`, so there is no active tofu. **But** if image dye-name localization is added later (see I18N_AUDIT §8), CJK/Hangul would render as tofu until the SC + KR subsets are bundled here too. Track as a prerequisite for any future "localized OG image" work.

---

## Subset Staleness Table

| Font | Needed (range) | In font (range) | Missing | Stale/unused (range) | Verdict |
|------|----------------|-----------------|---------|----------------------|---------|
| NotoSansSC-Subset | 1,061 CJK | 1,059 CJK | 7 | ~616 | Re-subset (stale) |
| NotoSansKR-Subset | 458 Hangul | 459 Hangul | 2 | 821 CJK + ~193 Hangul | Re-subset + de-bloat |

---

## Recommendation: prevent recurrence

Add a lightweight CI step (Python, fontTools already a dev dependency of the subset workflow) that:
1. Collects codepoints from the same locale sources the subset script reads.
2. Loads each committed subset's cmap.
3. Fails the build if any needed codepoint is missing.

This converts "someone forgot to re-run the subset script" from a silent production tofu bug into a red CI check.

> No fonts were modified by this audit; all sizes and coverage numbers were measured against the committed files.
