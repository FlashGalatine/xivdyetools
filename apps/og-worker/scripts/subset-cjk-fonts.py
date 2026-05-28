"""
Subset CJK fonts for the XIV Dye Tools OG Worker.

Creates subsetted versions of Noto Sans SC and Noto Sans KR containing only
the glyphs needed for dye names rendered in OG preview images. This keeps the
Cloudflare Worker bundle size manageable (~700 KiB for both fonts combined
instead of ~20 MiB for the full fonts).

Prerequisites:
  pip install fonttools

Usage:
  python scripts/subset-cjk-fonts.py

The script reads locale JSON files from:
  - packages/core/src/data/locales/ (dye names, categories — all that og-worker renders)

Unlike the discord-worker subset, bot UI strings (packages/bot-i18n/) are
intentionally excluded: og-worker only renders dye names, not bot responses.

And produces:
  - src/fonts/NotoSansSC-Subset.ttf (Chinese ideographs + Japanese kana)
  - src/fonts/NotoSansKR-Subset.ttf (Korean Hangul syllables)

Source fonts are looked up in the following order:
  1. src/fonts/ (local copy)
  2. ../discord-worker/src/fonts/ (shared source — discord-worker ships the full fonts)

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

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKER_ROOT = os.path.dirname(SCRIPT_DIR)                      # apps/og-worker
APPS_DIR = os.path.dirname(WORKER_ROOT)                        # apps
MONOREPO_ROOT = os.path.dirname(APPS_DIR)                      # repo root

CORE_LOCALES_DIR = os.path.join(MONOREPO_ROOT, "packages", "core", "src", "data", "locales")
FONTS_DIR = os.path.join(WORKER_ROOT, "src", "fonts")

# Shared source fonts (full, ~10 MiB each) — stored in discord-worker to avoid duplication
DISCORD_FONTS_DIR = os.path.join(APPS_DIR, "discord-worker", "src", "fonts")

SC_INPUT_CANDIDATES = [
    os.path.join(FONTS_DIR, "NotoSansSC-Regular.ttf"),
    os.path.join(DISCORD_FONTS_DIR, "NotoSansSC-Regular.ttf"),
]
SC_OUTPUT = os.path.join(FONTS_DIR, "NotoSansSC-Subset.ttf")

KR_SOURCE_CANDIDATES = [
    os.path.join(FONTS_DIR, "NotoSansKR-Variable.ttf"),
    os.path.join(FONTS_DIR, "NotoSansKR[wght].ttf"),
    os.path.join(FONTS_DIR, "NotoSansKR-Regular.ttf"),
    os.path.join(DISCORD_FONTS_DIR, "NotoSansKR-Variable.ttf"),
    os.path.join(DISCORD_FONTS_DIR, "NotoSansKR[wght].ttf"),
    os.path.join(DISCORD_FONTS_DIR, "NotoSansKR-Regular.ttf"),
]
KR_OUTPUT = os.path.join(FONTS_DIR, "NotoSansKR-Subset.ttf")

NOTO_KR_URL = "https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf"

LOCALE_LANGUAGES = ["ja", "ko", "zh", "de", "fr"]


# ============================================================================
# Character collection
# ============================================================================

def collect_all_characters():
    """Collect all unique characters from core locale files (dye names only)."""
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

    for lang in LOCALE_LANGUAGES:
        path = os.path.join(CORE_LOCALES_DIR, f"{lang}.json")
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Core locale file not found: {path}\n"
                "Did the monorepo layout change? Update CORE_LOCALES_DIR."
            )
        with open(path, "r", encoding="utf-8") as f:
            add_strings(json.load(f))
        print(f"  Core {lang}.json: loaded")

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
    print("Collecting characters from core locale files...")
    codepoints = collect_all_characters()
    print_stats(codepoints)

    # Subset Noto Sans SC
    sc_input = next((p for p in SC_INPUT_CANDIDATES if os.path.exists(p)), None)
    if not sc_input:
        print(f"\nError: Noto Sans SC source not found.")
        print("Expected at one of:")
        for p in SC_INPUT_CANDIDATES:
            print(f"  {p}")
        print("Download from: https://fonts.google.com/noto/specimen/Noto+Sans+SC")
        sys.exit(1)

    print(f"\n--- Noto Sans SC ---")
    print(f"Source: {sc_input}")
    print(f"Input: {os.path.getsize(sc_input) / 1024:.1f} KiB")
    sc_size, sc_glyphs = subset_font(sc_input, SC_OUTPUT, codepoints)
    print(f"Output: {sc_size / 1024:.1f} KiB ({sc_glyphs} glyphs) -> {SC_OUTPUT}")

    # Subset Noto Sans KR
    kr_input = next((p for p in KR_SOURCE_CANDIDATES if os.path.exists(p)), None)

    if not kr_input:
        print(f"\nNoto Sans KR source not found. Downloading...")
        import urllib.request
        kr_input = os.path.join(FONTS_DIR, "NotoSansKR-Variable.ttf")
        urllib.request.urlretrieve(NOTO_KR_URL, kr_input)
        print(f"Downloaded: {os.path.getsize(kr_input) / 1024:.1f} KiB")

    # OPT-001: Scope KR to Hangul + ASCII only.
    # Korean dye names use zero CJK ideographs — the runtime font stack routes CJK
    # to Noto Sans SC — so this subset only needs Hangul syllables + basic ASCII.
    # Excluding unused Han glyphs saves ~595 KiB.
    kr_codepoints = {
        c for c in codepoints
        if c < 0x80 or 0xAC00 <= c <= 0xD7AF or 0x1100 <= c <= 0x11FF
    }

    print(f"\n--- Noto Sans KR ---")
    print(f"Source: {kr_input}")
    print(f"Input: {os.path.getsize(kr_input) / 1024:.1f} KiB")
    print(f"KR codepoints (Hangul+ASCII): {len(kr_codepoints)} (vs {len(codepoints)} full set)")
    kr_size, kr_glyphs = subset_font(kr_input, KR_OUTPUT, kr_codepoints, fix_names={
        1: "Noto Sans KR",
        2: "Regular",
        4: "Noto Sans KR Regular",
        6: "NotoSansKR-Regular",
    })
    print(f"Output: {kr_size / 1024:.1f} KiB ({kr_glyphs} glyphs) -> {KR_OUTPUT}")

    print(f"\nTotal CJK font overhead: {(sc_size + kr_size) / 1024:.1f} KiB")
    print("Done! Commit the updated subset files to the repository.")


if __name__ == "__main__":
    main()
