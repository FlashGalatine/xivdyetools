"""
Subset CJK fonts for the XIV Dye Tools Discord Worker.

Creates subsetted versions of Noto Sans SC, JP and KR containing only the
glyphs the application's localized text actually uses, instead of shipping
~37 MiB of full faces inside the Worker.

Prerequisites:
  pip install fonttools brotli

Usage:
  python scripts/subset-cjk-fonts.py

The script reads all locale JSON files from:
  - packages/core/src/data/locales/     (dye names, categories, labels, etc.)
  - packages/bot-logic/src/i18n/locales/ (bot UI strings, card vocabulary, etc.)

And produces:
  - src/fonts/NotoSansSC-Subset.ttf  CJK for ALL languages — SC is the terminal
                                     fallback in every chain, so it must carry
                                     the Japanese kanji too, not just Chinese
  - src/fonts/NotoSansJP-Subset.ttf  CJK in ja only — supplies Japanese
                                     letterforms ahead of SC for ja locales
  - src/fonts/NotoSansKR-Subset.ttf  Hangul + ASCII only (see OPT-001 below)

Source faces are looked up locally and downloaded on demand if absent; the
downloads land in scripts/.font-sources/, deliberately outside src/fonts so
wrangler never bundles a 10 MiB variable font into the Worker.

SIZE BUDGET: the three subsets total ~1.6 MiB raw / ~1.0 MiB gzipped, which is
roughly 38% of the Worker bundle. The binding constraint is Cloudflare's 3 MiB
*gzipped* Worker limit, NOT the "~1.3 MiB" raw figure quoted before 5.0 — that
predates NotoSansJP-Subset and was never revised when it was added. Measure
real headroom with `wrangler deploy --dry-run`, which reports the gzipped total.

If new dyes are added or locale strings change, re-run this script and commit
the updated subset files. Every locale edit invalidates these subsets: a
codepoint absent from its subset renders as tofu, and no test in the repo
catches it (the SVG suites assert structure, not glyph coverage).
"""

import os
import sys
import json
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

# ============================================================================
# Configuration
# ============================================================================

# Resolve paths relative to this script's location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKER_ROOT = os.path.dirname(SCRIPT_DIR)                      # apps/discord-worker
APPS_DIR = os.path.dirname(WORKER_ROOT)                        # apps
MONOREPO_ROOT = os.path.dirname(APPS_DIR)                      # repo root

CORE_LOCALES_DIR = os.path.join(MONOREPO_ROOT, "packages", "core", "src", "data", "locales")
# bot-i18n was absorbed into bot-logic (Monorepo 2.0 Tier 1)
BOT_LOCALES_DIR = os.path.join(MONOREPO_ROOT, "packages", "bot-logic", "src", "i18n", "locales")
FONTS_DIR = os.path.join(WORKER_ROOT, "src", "fonts")

# Downloaded full sources live OUTSIDE src/fonts — wrangler bundles **/*.ttf,
# and a 10 MiB variable source in src/fonts would ship inside the Worker.
SOURCES_DIR = os.path.join(SCRIPT_DIR, ".font-sources")

# The full faces checked into git, for the same reason SOURCES_DIR sits outside
# src/fonts. No candidate list may point inside FONTS_DIR.
FONTS_SRC_DIR = os.path.join(WORKER_ROOT, "fonts-src")

# VARIABLE FACES ONLY. The shipped subsets are cut from NotoSansSC[wght]. A
# static SC face (fonts-src/NotoSansSC-Regular.ttf, pre-5.0 era) used to be
# tracked here and would have silently swapped the face if a candidate ever
# pointed at it; it was removed in the 2026-08-18 dead-code audit (DEAD-008)
# since no candidate list referenced it. Falling through to the download
# keeps every machine on the same face.
#
# (Output is never byte-identical run to run: fontTools stamps head.modified
# with wall-clock time. Compare glyph coverage, not file hashes.)
SC_INPUT_CANDIDATES = [
    os.path.join(SOURCES_DIR, "NotoSansSC-Variable.ttf"),
    os.path.join(APPS_DIR, "og-worker", "scripts", ".font-sources", "NotoSansSC-Variable.ttf"),
]
SC_OUTPUT = os.path.join(FONTS_DIR, "NotoSansSC-Subset.ttf")
KR_OUTPUT = os.path.join(FONTS_DIR, "NotoSansKR-Subset.ttf")
JP_OUTPUT = os.path.join(FONTS_DIR, "NotoSansJP-Subset.ttf")

NOTO_KR_URL = "https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf"
NOTO_SC_URL = "https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"
NOTO_JP_URL = "https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"

LOCALE_LANGUAGES = ["ja", "ko", "zh", "de", "fr"]


# ============================================================================
# Character collection
# ============================================================================

def collect_characters(languages):
    """Collect all unique characters from core + bot locale files for languages."""
    codepoints = set(range(0x20, 0x7F))  # Basic ASCII

    def add_strings(obj):
        if isinstance(obj, str):
            for ch in obj:
                codepoints.add(ord(ch))
        elif isinstance(obj, dict):
            for v in obj.values():
                add_strings(v)
        elif isinstance(obj, list):
            for item in obj:
                add_strings(item)

    # Core locale files
    for lang in languages:
        path = os.path.join(CORE_LOCALES_DIR, f"{lang}.json")
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Core locale file not found: {path}\n"
                "Did the monorepo layout change? Update CORE_LOCALES_DIR."
            )
        with open(path, "r", encoding="utf-8") as f:
            add_strings(json.load(f))
        print(f"  Core {lang}.json: loaded")

    # Bot UI locale files
    for lang in languages:
        path = os.path.join(BOT_LOCALES_DIR, f"{lang}.json")
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Bot UI locale file not found: {path}\n"
                "Did the discord-worker locale folder move? Update BOT_LOCALES_DIR."
            )
        with open(path, "r", encoding="utf-8") as f:
            add_strings(json.load(f))
        print(f"  Bot  {lang}.json: loaded")

    return codepoints


def collect_all_characters():
    """Collect all unique characters from all locale sources."""
    return collect_characters(LOCALE_LANGUAGES)


def download_font(url, dest):
    """Download a source font (google/fonts raw), returning the local path."""
    import urllib.request
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    print(f"Downloading {url} ...")
    urllib.request.urlretrieve(url, dest)
    print(f"Downloaded: {os.path.getsize(dest) / 1024:.1f} KiB -> {dest}")
    return dest


def print_stats(codepoints):
    """Print character set statistics."""
    hangul = sum(1 for c in codepoints if 0xAC00 <= c <= 0xD7AF)
    katakana = sum(1 for c in codepoints if 0x30A0 <= c <= 0x30FF)
    hiragana = sum(1 for c in codepoints if 0x3040 <= c <= 0x309F)
    cjk = sum(1 for c in codepoints if 0x4E00 <= c <= 0x9FFF)
    ascii_count = sum(1 for c in codepoints if 0x20 <= c <= 0x7E)

    print(f"\nTotal codepoints: {len(codepoints)}")
    print(f"  ASCII: {ascii_count}")
    print(f"  CJK Unified: {cjk}")
    print(f"  Hangul: {hangul}")
    print(f"  Katakana: {katakana}")
    print(f"  Hiragana: {hiragana}")
    print(f"  Other: {len(codepoints) - ascii_count - cjk - hangul - katakana - hiragana}")


# ============================================================================
# Font subsetting
# ============================================================================

def subset_font(input_path, output_path, codepoints, fix_names=None):
    """Subset a font to only include the given codepoints."""
    font = TTFont(input_path)

    options = Options()
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True

    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)

    # Fix name records for variable fonts
    if fix_names:
        for record in font['name'].names:
            if record.nameID in fix_names:
                record.string = fix_names[record.nameID]

    font.save(output_path)

    cmap = font.getBestCmap()
    glyph_count = len(cmap)
    font.close()

    return os.path.getsize(output_path), glyph_count


# ============================================================================
# Main
# ============================================================================

def main():
    print("Collecting characters from all locale files...")
    codepoints = collect_all_characters()
    print_stats(codepoints)

    # Subset Noto Sans SC
    sc_input = next((p for p in SC_INPUT_CANDIDATES if os.path.exists(p)), None)
    if not sc_input:
        print("\nNoto Sans SC source not found. Downloading...")
        sc_input = download_font(NOTO_SC_URL, os.path.join(SOURCES_DIR, "NotoSansSC-Variable.ttf"))

    print(f"\n--- Noto Sans SC ---")
    print(f"Input: {os.path.getsize(sc_input) / 1024:.1f} KiB")
    # FONT-001 (2026-08-10): SC was the only face without fix_names, so subsetting
    # the variable source left nameID 1 = "Noto Sans SC Thin" (the wght axis default
    # is 100). Rendering still worked because resvg's fontdb prefers the typographic
    # family in nameID 16, which was already correct — but any consumer that matches
    # on nameID 1 would fail to find "Noto Sans SC". JP and KR have always been
    # fixed up here; SC was simply missed.
    sc_size, sc_glyphs = subset_font(sc_input, SC_OUTPUT, codepoints, fix_names={
        1: "Noto Sans SC",
        2: "Regular",
        4: "Noto Sans SC Regular",
        6: "NotoSansSC-Regular",
    })
    print(f"Output: {sc_size / 1024:.1f} KiB ({sc_glyphs} glyphs)")

    # Subset Noto Sans KR
    # Look for the KR source font in several locations
    # fonts-src/NotoSansKR-Variable.ttf is tracked in git and byte-identical to
    # og-worker's gitignored copy, so listing it lets a fresh clone cut the same
    # glyph set without a 10 MiB download.
    kr_candidates = [
        os.path.join(SOURCES_DIR, "NotoSansKR-Variable.ttf"),
        os.path.join(FONTS_SRC_DIR, "NotoSansKR-Variable.ttf"),
        os.path.join(APPS_DIR, "og-worker", "scripts", ".font-sources", "NotoSansKR-Variable.ttf"),
    ]
    kr_input = next((p for p in kr_candidates if os.path.exists(p)), None)

    if not kr_input:
        print(f"\nNoto Sans KR source not found. Downloading...")
        kr_input = download_font(NOTO_KR_URL, os.path.join(SOURCES_DIR, "NotoSansKR-Variable.ttf"))

    # OPT-001: Scope KR to Hangul + ASCII only.
    # Noto Sans KR ships Hanja, so passing the full codepoint set (which includes all
    # ja/zh CJK ideographs) caused it to retain ~821 unused Han glyphs (~595 KiB of dead
    # weight). Korean locale text uses zero CJK ideographs — the runtime font stack routes
    # CJK to Noto Sans SC — so this subset only needs Hangul syllables, Hangul Jamo, and
    # basic ASCII.
    kr_codepoints = {
        c for c in codepoints
        if c < 0x80 or 0xAC00 <= c <= 0xD7AF or 0x1100 <= c <= 0x11FF
    }

    print(f"\n--- Noto Sans KR ---")
    print(f"Input: {os.path.getsize(kr_input) / 1024:.1f} KiB")
    print(f"KR codepoints (Hangul+ASCII): {len(kr_codepoints)} (vs {len(codepoints)} full set)")
    kr_size, kr_glyphs = subset_font(kr_input, KR_OUTPUT, kr_codepoints, fix_names={
        1: "Noto Sans KR",
        2: "Regular",
        4: "Noto Sans KR Regular",
        6: "NotoSansKR-Regular",
    })
    print(f"Output: {kr_size / 1024:.1f} KiB ({kr_glyphs} glyphs)")

    # Subset Noto Sans JP — Japanese letterforms for ja locales (5.0).
    # Scoped to the characters ja text actually uses (+ASCII); SC remains the
    # fallback, so the ja chain 'Noto Sans JP, Noto Sans SC' renders Japanese
    # letterforms without growing the SC subset.
    jp_candidates = [
        os.path.join(SOURCES_DIR, "NotoSansJP-Variable.ttf"),
        os.path.join(APPS_DIR, "og-worker", "scripts", ".font-sources", "NotoSansJP-Variable.ttf"),
    ]
    jp_input = next((p for p in jp_candidates if os.path.exists(p)), None)
    if not jp_input:
        print("\nNoto Sans JP source not found. Downloading...")
        jp_input = download_font(NOTO_JP_URL, os.path.join(SOURCES_DIR, "NotoSansJP-Variable.ttf"))

    print("\nCollecting Japanese characters (core + bot ja.json)...")
    jp_codepoints = collect_characters(["ja"])

    print(f"\n--- Noto Sans JP ---")
    print(f"Input: {os.path.getsize(jp_input) / 1024:.1f} KiB")
    print(f"JP codepoints: {len(jp_codepoints)}")
    jp_size, jp_glyphs = subset_font(jp_input, JP_OUTPUT, jp_codepoints, fix_names={
        1: "Noto Sans JP",
        2: "Regular",
        4: "Noto Sans JP Regular",
        6: "NotoSansJP-Regular",
    })
    print(f"Output: {jp_size / 1024:.1f} KiB ({jp_glyphs} glyphs)")

    total = sc_size + kr_size + jp_size
    print(f"\nTotal CJK font overhead: {total / 1024:.1f} KiB raw")
    print("These compress to roughly 60% in the Worker bundle. The real ceiling is")
    print("Cloudflare's 3,072 KiB GZIPPED Worker limit — measure it with:")
    print("  npx wrangler deploy --dry-run")
    print("Done! Commit the updated subset files to the repository.")


if __name__ == "__main__":
    main()
