"""
Subset CJK fonts for the XIV Dye Tools Discord Worker.

Creates subsetted versions of Noto Sans SC and Noto Sans KR containing only
the glyphs needed for all localized text in the application. This keeps the
Cloudflare Worker bundle size manageable (~1.2 MiB for both fonts combined
instead of ~20 MiB for the full fonts).

Prerequisites:
  pip install fonttools

Usage:
  python scripts/subset-cjk-fonts.py

The script reads all locale JSON files from:
  - xivdyetools-core/src/data/locales/ (dye names, categories, labels, etc.)
  - src/locales/ (bot UI strings, titles, quality labels, etc.)

And produces:
  - src/fonts/NotoSansSC-Subset.ttf (Chinese ideographs + Japanese kana)
  - src/fonts/NotoSansKR-Subset.ttf (Korean Hangul syllables)

Source fonts must be present at:
  - src/fonts/NotoSansSC-Regular.ttf (download from Google Fonts: Noto Sans SC)
  - A downloaded NotoSansKR variable font (see NOTO_KR_URL below)

If new dyes are added or locale strings change, re-run this script and commit
the updated subset files.
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
WORKER_ROOT = os.path.dirname(SCRIPT_DIR)
PROJECT_ROOT = os.path.dirname(WORKER_ROOT)

CORE_LOCALES_DIR = os.path.join(PROJECT_ROOT, "xivdyetools-core", "src", "data", "locales")
BOT_LOCALES_DIR = os.path.join(WORKER_ROOT, "src", "locales")
FONTS_DIR = os.path.join(WORKER_ROOT, "src", "fonts")

SC_INPUT = os.path.join(FONTS_DIR, "NotoSansSC-Regular.ttf")
SC_OUTPUT = os.path.join(FONTS_DIR, "NotoSansSC-Subset.ttf")
KR_OUTPUT = os.path.join(FONTS_DIR, "NotoSansKR-Subset.ttf")

NOTO_KR_URL = "https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf"

LOCALE_LANGUAGES = ["ja", "ko", "zh", "de", "fr"]


# ============================================================================
# Character collection
# ============================================================================

def collect_all_characters():
    """Collect all unique characters from all locale sources."""
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
    for lang in LOCALE_LANGUAGES:
        path = os.path.join(CORE_LOCALES_DIR, f"{lang}.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                add_strings(json.load(f))
            print(f"  Core {lang}.json: loaded")
        else:
            print(f"  Core {lang}.json: not found (skipped)")

    # Bot UI locale files
    for lang in LOCALE_LANGUAGES:
        path = os.path.join(BOT_LOCALES_DIR, f"{lang}.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                add_strings(json.load(f))
            print(f"  Bot  {lang}.json: loaded")
        else:
            print(f"  Bot  {lang}.json: not found (skipped)")

    return codepoints


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
    if not os.path.exists(SC_INPUT):
        print(f"\nError: {SC_INPUT} not found.")
        print("Download Noto Sans SC Regular from: https://fonts.google.com/noto/specimen/Noto+Sans+SC")
        sys.exit(1)

    print(f"\n--- Noto Sans SC ---")
    print(f"Input: {os.path.getsize(SC_INPUT) / 1024:.1f} KiB")
    sc_size, sc_glyphs = subset_font(SC_INPUT, SC_OUTPUT, codepoints)
    print(f"Output: {sc_size / 1024:.1f} KiB ({sc_glyphs} glyphs)")

    # Subset Noto Sans KR
    # Look for the KR source font in several locations
    kr_candidates = [
        os.path.join(FONTS_DIR, "NotoSansKR-Variable.ttf"),
        os.path.join(FONTS_DIR, "NotoSansKR[wght].ttf"),
        os.path.join(FONTS_DIR, "NotoSansKR-Regular.ttf"),
    ]
    kr_input = next((p for p in kr_candidates if os.path.exists(p)), None)

    if not kr_input:
        print(f"\nNoto Sans KR source not found. Downloading...")
        import urllib.request
        kr_input = os.path.join(FONTS_DIR, "NotoSansKR-Variable.ttf")
        urllib.request.urlretrieve(NOTO_KR_URL, kr_input)
        print(f"Downloaded: {os.path.getsize(kr_input) / 1024:.1f} KiB")

    print(f"\n--- Noto Sans KR ---")
    print(f"Input: {os.path.getsize(kr_input) / 1024:.1f} KiB")
    kr_size, kr_glyphs = subset_font(kr_input, KR_OUTPUT, codepoints, fix_names={
        1: "Noto Sans KR",
        2: "Regular",
        4: "Noto Sans KR Regular",
        6: "NotoSansKR-Regular",
    })
    print(f"Output: {kr_size / 1024:.1f} KiB ({kr_glyphs} glyphs)")

    print(f"\nTotal CJK font overhead: {(sc_size + kr_size) / 1024:.1f} KiB")
    print("Done! Commit the updated subset files to the repository.")


if __name__ == "__main__":
    main()
