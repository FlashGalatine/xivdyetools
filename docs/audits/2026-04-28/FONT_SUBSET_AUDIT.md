# Font Subset Audit

**Date:** 2026-04-28
**Scope:** CJK font subsetting for SVG → PNG rendering in Cloudflare Workers

## Font Inventory

| Path | Size | Purpose | Bundled into |
|------|-----:|---------|--------------|
| [discord-worker/src/fonts/SpaceGrotesk-VariableFont_wght.ttf](../../../apps/discord-worker/src/fonts/SpaceGrotesk-VariableFont_wght.ttf) | 131 KiB | Headers (Latin) | discord-worker, og-worker |
| [discord-worker/src/fonts/Onest-VariableFont_wght.ttf](../../../apps/discord-worker/src/fonts/Onest-VariableFont_wght.ttf) | 120 KiB | Body (Latin) | discord-worker, og-worker |
| [discord-worker/src/fonts/Habibi-Regular.ttf](../../../apps/discord-worker/src/fonts/Habibi-Regular.ttf) | 33 KiB | Hex codes | discord-worker, og-worker |
| [discord-worker/src/fonts/NotoSansSC-Regular.ttf](../../../apps/discord-worker/src/fonts/NotoSansSC-Regular.ttf) | **10.1 MiB** | Source (full) for SC subset | NOT bundled (source only) |
| [discord-worker/src/fonts/NotoSansSC-Subset.ttf](../../../apps/discord-worker/src/fonts/NotoSansSC-Subset.ttf) | **481 KiB** | CJK ideographs + kana subset | discord-worker only |
| [discord-worker/src/fonts/NotoSansKR-Variable.ttf](../../../apps/discord-worker/src/fonts/NotoSansKR-Variable.ttf) | **10.4 MiB** | Source (full) for KR subset | NOT bundled (source only) |
| [discord-worker/src/fonts/NotoSansKR-Subset.ttf](../../../apps/discord-worker/src/fonts/NotoSansKR-Subset.ttf) | **814 KiB** | Hangul subset | discord-worker only |

The two 10 MiB source fonts are kept in the repo for re-running the subsetter; they should not be bundled into the Worker.

## Codepoint Demand (all locale stores combined)

| Script block | Range | Codepoints needed | Source locales |
|--------------|-------|------------------:|----------------|
| Basic ASCII | U+0020–007E | 95 | all |
| Latin Extended-A | U+0100–017F | 0 | — |
| CJK Symbols & Punctuation | U+3000–303F | 6 | ja, zh |
| Hiragana | U+3040–309F | 57 | ja |
| Katakana | U+30A0–30FF | 77 | ja |
| CJK Unified Ideographs | U+4E00–9FFF | **1,124** | ja (482), zh (911) |
| CJK Extension A | U+3400–4DBF | 0 | — |
| Hangul Syllables | U+AC00–D7AF | **561** | ko |
| Fullwidth Forms | U+FF00–FFEF | 7 | ja, zh |
| **Total non-Latin** | | **~1,832** | |

Per-locale breakdown:

| Locale | CJK | Hangul | Kana |
|--------|----:|-------:|-----:|
| ja | 482 | 0 | 134 |
| ko | 0 | 561 | 0 |
| zh | 911 | 0 | 0 |
| de | 0 | 0 | 0 |
| fr | 0 | 0 | 0 |

ja and zh share many CJK ideographs but `(482 ∪ 911) = 1124`, so total unique is just 1,124 — about 49% overlap between ja and zh.

## Subset Status

| File | Actual size | Documented size | Verdict |
|------|------------:|----------------:|---------|
| `NotoSansSC-Subset.ttf` | 481 KiB | 222 KiB ([fonts.ts:34](../../../apps/discord-worker/src/services/fonts.ts#L34)) | 2.2× larger than docs claim |
| `NotoSansKR-Subset.ttf` | 814 KiB | 155 KiB ([fonts.ts:38](../../../apps/discord-worker/src/services/fonts.ts#L38)) | 5.3× larger than docs claim |

Without `fontTools` installed in the audit environment, exact glyph counts can't be verified directly — but the **size discrepancy** combined with the **broken subsetter path** (see below) suggests the subsets in tree may have been generated from a different inventory than today's locale files.

## CRITICAL: Subset Script Broken Path

[apps/discord-worker/scripts/subset-cjk-fonts.py:42-46](../../../apps/discord-worker/scripts/subset-cjk-fonts.py#L42-L46):

```python
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKER_ROOT = os.path.dirname(SCRIPT_DIR)               # apps/discord-worker
PROJECT_ROOT = os.path.dirname(WORKER_ROOT)             # apps/

CORE_LOCALES_DIR = os.path.join(PROJECT_ROOT, "xivdyetools-core", "src", "data", "locales")
# ↑ Resolves to apps/xivdyetools-core/... which doesn't exist
```

When the monorepo was restructured (per memory log), `xivdyetools-core` moved to `packages/core/`. The script wasn't updated. At line 81:

```python
if os.path.exists(path):
    with open(path, "r", encoding="utf-8") as f:
        add_strings(json.load(f))
    print(f"  Core {lang}.json: loaded")
else:
    print(f"  Core {lang}.json: not found (skipped)")  # ← Always lands here
```

So today, running the script silently produces a subset containing **only bot UI characters** — none of the dye name CJK glyphs that are the primary reason CJK fonts are bundled.

### Why current subsets still work (probably)

The 481 KiB and 814 KiB subsets in the repo have file mtimes of `Mar 2 21:33` (2 months ago). They were likely generated **before** the monorepo restructure, when the path was correct. Until the script is re-run, the existing subsets retain their old (correct) coverage.

### When this becomes a tofu incident

Any of these scenarios trigger the bug:

1. New dye added to `colors_xiv.json` with a CJK name not in current subsets
2. Locale strings in `dyenames.csv` updated with new characters
3. Maintainer "refreshes" subsets after a CSV change → new subsets are bot-UI-only → all dye names render as tofu

The Patch 7.5 dye consolidation (per memory: "ko/zh names still pending") could trigger this within a few weeks once those names land.

### Fix

```python
# apps/discord-worker/scripts/subset-cjk-fonts.py:42-46
- SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
- WORKER_ROOT = os.path.dirname(SCRIPT_DIR)
- PROJECT_ROOT = os.path.dirname(WORKER_ROOT)
- CORE_LOCALES_DIR = os.path.join(PROJECT_ROOT, "xivdyetools-core", "src", "data", "locales")
+ SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
+ WORKER_ROOT = os.path.dirname(SCRIPT_DIR)
+ MONOREPO_ROOT = os.path.dirname(os.path.dirname(WORKER_ROOT))
+ CORE_LOCALES_DIR = os.path.join(MONOREPO_ROOT, "packages", "core", "src", "data", "locales")
```

Then change the silent skip into a hard error:

```python
# In collect_all_characters():
- if os.path.exists(path):
-     with open(path, "r", encoding="utf-8") as f:
-         add_strings(json.load(f))
-     print(f"  Core {lang}.json: loaded")
- else:
-     print(f"  Core {lang}.json: not found (skipped)")
+ if not os.path.exists(path):
+     raise FileNotFoundError(
+         f"Locale file not found: {path}\n"
+         "Did the monorepo layout change? Update CORE_LOCALES_DIR."
+     )
+ with open(path, "r", encoding="utf-8") as f:
+     add_strings(json.load(f))
+ print(f"  Core {lang}.json: loaded")
```

## Optional: Shrink the KR Subset

[subset-cjk-fonts.py:127](../../../apps/discord-worker/scripts/subset-cjk-fonts.py#L127):

```python
options.layout_features = ['*']
options.name_IDs = ['*']
options.notdef_outline = True
```

For Hangul precomposed syllables (U+AC00–D7AF), most layout features (kerning, ligatures, contextual alternates) provide little benefit because each syllable is rendered as an atomic glyph. Consider:

```python
# More aggressive subsetting for KR (test before deploying)
options.layout_features = ['kern']  # keep kerning, drop the rest
options.name_IDs = [1, 2, 4, 6]      # essential name table records only
options.glyph_names = False
options.legacy_kern = False
```

This often reduces Hangul subsets by 50–70%. Test that text still renders correctly via `pnpm --filter xivdyetools-discord-worker run dev` and a sample SVG render.

Worker bundle is currently ~8 MiB (10 MiB ceiling per memory). KR subset reduction from 814 KiB → ~250 KiB would free ~570 KiB of headroom.

## Font Stack Validation

| Context | Renderer | Font stack | CJK-safe |
|---------|----------|------------|----------|
| discord-worker SVGs | resvg-wasm | `Onest, Noto Sans SC, Noto Sans KR` (`FONTS.primaryCjk`) via [packages/svg/src/base.ts](../../../packages/svg/src/base.ts) | YES |
| discord-worker SVGs (headers) | resvg-wasm | `Space Grotesk, Noto Sans SC, Noto Sans KR` (`FONTS.headerCjk`) | YES |
| og-worker SVGs | resvg-wasm | `Space Grotesk` / `Onest` (no CJK fallback in og-worker fonts.ts) | NO — but content is hardcoded English so no current breakage |
| og-worker fallback HTML | browser | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | Browser handles fallback to system CJK fonts |
| web-app | browser | `Cinzel`, `Lexend`, `Habibi`, `Lexend Giga` (Latin only) | Browser handles fallback to system CJK fonts |

## Recommendations

1. **(HIGH)** Fix path in [subset-cjk-fonts.py:46](../../../apps/discord-worker/scripts/subset-cjk-fonts.py#L46)
2. **(HIGH)** Replace silent skip with hard error
3. **(HIGH)** Re-run subsetter; verify with the script in [I18N_AUDIT.md §9](./I18N_AUDIT.md#9-verification-script-run-after-fix-1); commit new subsets
4. **(MED)** Update doc comments in [services/fonts.ts:34,38](../../../apps/discord-worker/src/services/fonts.ts#L34) to reflect actual subset sizes
5. **(LOW)** Investigate trimming KR subset's layout features to recover bundle headroom
6. **(DEFERRED)** Bundle CJK fonts into og-worker if/when OG previews get localized
