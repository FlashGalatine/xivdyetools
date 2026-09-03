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

The script reads:
  - packages/core/src/data/locales/ (dye names, categories, tool/harmony/vision names)
  - src/services/og-strings.ts (the worker's OWN card strings ×6 — deck names and
    one-liners, header tool tags, authored deck lines)

The second source is not optional. og-worker owns card strings that exist in no
locale JSON: a tool tag like 색각 or a deck line like "画像から5色" is authored in
og-strings.ts, and a subset built from core alone renders it as tofu whenever
the characters happen not to appear in a dye name.

Unlike the discord-worker subset, bot UI strings (packages/bot-i18n/) are
intentionally excluded: og-worker does not render bot responses.

And produces:
  - src/fonts/NotoSansSC-Subset.ttf (Chinese ideographs; fallback for everything)
  - src/fonts/NotoSansKR-Subset.ttf (Korean Hangul syllables)
  - src/fonts/NotoSansJP-Subset.ttf (Japanese kana + kanji, Japanese letterforms)

The JP subset exists because folding Japanese into the SC subset renders JA
text in Chinese letterforms (5.0 build prerequisite). Renderers put
'Noto Sans JP' before 'Noto Sans SC' in the chain for ja locales only.

Source fonts are looked up in the following order:
  1. src/fonts/ (local copy)
  2. ../discord-worker/src/fonts/ (shared source — discord-worker ships the full fonts)

If new dyes are added or locale strings change, re-run this script and commit
the updated subset files.
"""

import os
import re
import sys
import json
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options
from fontTools.varLib.instancer import instantiateVariableFont

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKER_ROOT = os.path.dirname(SCRIPT_DIR)                      # apps/og-worker
APPS_DIR = os.path.dirname(WORKER_ROOT)                        # apps
MONOREPO_ROOT = os.path.dirname(APPS_DIR)                      # repo root

CORE_LOCALES_DIR = os.path.join(MONOREPO_ROOT, "packages", "core", "src", "data", "locales")
OG_STRINGS_TS = os.path.join(WORKER_ROOT, "src", "services", "og-strings.ts")
FONTS_DIR = os.path.join(WORKER_ROOT, "src", "fonts")
# Downloaded full sources live OUTSIDE src/fonts — wrangler bundles **/*.ttf,
# and a 10 MiB variable source in src/fonts would ship inside the Worker.
SOURCES_DIR = os.path.join(SCRIPT_DIR, ".font-sources")

# Full source fonts (~10-17 MiB each) are downloaded into SOURCES_DIR on first
# run — the ONLY place they live. (Older revisions also probed src/fonts and
# discord-worker/src/fonts, but both ship subsets, and a subset is not a
# valid source for a subset.)

SC_INPUT_CANDIDATES = [
    os.path.join(SOURCES_DIR, "NotoSansSC-Variable.ttf"),
]
SC_OUTPUT = os.path.join(FONTS_DIR, "NotoSansSC-Subset.ttf")

KR_SOURCE_CANDIDATES = [
    os.path.join(SOURCES_DIR, "NotoSansKR-Variable.ttf"),
]
KR_OUTPUT = os.path.join(FONTS_DIR, "NotoSansKR-Subset.ttf")

NOTO_KR_URL = "https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf"
NOTO_SC_URL = "https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"
NOTO_JP_URL = "https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"

JP_SOURCE_CANDIDATES = [
    os.path.join(SOURCES_DIR, "NotoSansJP-Variable.ttf"),
]
JP_OUTPUT = os.path.join(FONTS_DIR, "NotoSansJP-Subset.ttf")

LOCALE_LANGUAGES = ["ja", "ko", "zh", "de", "fr"]


# ============================================================================
# Character collection
# ============================================================================

def collect_characters(languages):
    """Collect all unique characters from core locale files for the given languages."""
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

    return codepoints


# Each ×6 table in og-strings.ts opens a locale block at two-space indent and
# closes it at the same indent — `  ja: {` ... `  },`. The file is ours and
# Prettier-formatted, so this is stable; it fails loudly if it ever is not.
OG_LOCALE_BLOCK = re.compile(
    r"^  (en|de|fr|ja|ko|zh): \{$(.*?)^  \},$",
    re.MULTILINE | re.DOTALL,
)


def collect_og_card_characters(languages):
    """
    Collect characters from the worker's OWN card strings, per locale.

    Returns {lang: {codepoints}}. These strings exist in no locale JSON — a
    subset built without them renders tofu on any card whose tag or deck line
    uses a character no dye name happens to contain.
    """
    if not os.path.exists(OG_STRINGS_TS):
        raise FileNotFoundError(
            f"Card strings not found: {OG_STRINGS_TS}\n"
            "Did the worker layout change? Update OG_STRINGS_TS."
        )
    with open(OG_STRINGS_TS, "r", encoding="utf-8") as f:
        source = f.read()

    blocks = OG_LOCALE_BLOCK.findall(source)
    if not blocks:
        raise ValueError(
            f"No locale blocks parsed from {OG_STRINGS_TS}.\n"
            "The ×6 table layout changed — fix OG_LOCALE_BLOCK before shipping, "
            "or the subsets will silently under-cover the card strings."
        )

    per_lang = {lang: set() for lang in languages}
    seen = set()
    for lang, body in blocks:
        seen.add(lang)
        if lang not in per_lang:
            continue
        for ch in body:
            per_lang[lang].add(ord(ch))

    missing = {"en", "de", "fr", "ja", "ko", "zh"} - seen
    if missing:
        raise ValueError(
            f"Card strings parsed, but these locales never appeared: {sorted(missing)}.\n"
            "A ×6 table is incomplete or the layout changed."
        )

    for lang in languages:
        print(f"  og-strings.ts [{lang}]: {len(per_lang[lang])} codepoints")
    return per_lang


def collect_all_characters():
    """Every character og-worker can render: core locale data + its own cards."""
    codepoints = collect_characters(LOCALE_LANGUAGES)
    for chars in collect_og_card_characters(LOCALE_LANGUAGES).values():
        codepoints |= chars
    return codepoints


def download_font(url, dest):
    """Download a source font (google/fonts raw), returning the local path."""
    import urllib.request
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

#: Weight the CJK subsets are pinned to (see FONT-001 note in subset_font).
STATIC_WEIGHT = 400


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

    # FONT-001: pin the variable face to a static instance.
    #
    # resvg (fontdb) cannot move a variable font's axis — it renders the
    # DEFAULT instance and silently ignores `font-weight`. Noto Sans JP/SC/KR
    # ship as variable fonts whose wght default is 100 (Thin), so every
    # `font-weight="600"/"700"` the cards emit rendered CJK hairline-thin while
    # the Latin runs beside it were correctly weighted. PR #148 fixed exactly
    # this for Space Grotesk / Onest but instanced only those two families;
    # subsetting preserves fvar, so the CJK faces stayed variable.
    #
    # One weight, not three: the three subsets are already ~1.0 MiB gzipped of
    # the Worker's 3 MiB budget, so a Regular/SemiBold/Bold set per family would
    # not fit. STATIC_WEIGHT 400 is the readable, neutral choice — CJK in a bold
    # heading renders Regular rather than Thin. Real bold CJK needs the fonts
    # moved out of the bundle first (see FONT-001 in
    # docs/audits/2026-09-03-i18n/).
    if "fvar" in font:
        font = instantiateVariableFont(
            font, {"wght": STATIC_WEIGHT}, inplace=False, updateFontNames=False
        )
        os2 = font["OS/2"]
        os2.usWeightClass = STATIC_WEIGHT
        os2.fsSelection = (os2.fsSelection & ~(1 << 5) & ~(1 << 0)) | (1 << 6)  # regular
        font["head"].macStyle &= ~(1 << 0)  # not bold

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
        print(f"\nNoto Sans SC source not found. Downloading...")
        os.makedirs(SOURCES_DIR, exist_ok=True)
        sc_input = download_font(NOTO_SC_URL, os.path.join(SOURCES_DIR, "NotoSansSC-Variable.ttf"))

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
        os.makedirs(SOURCES_DIR, exist_ok=True)
        kr_input = download_font(NOTO_KR_URL, os.path.join(SOURCES_DIR, "NotoSansKR-Variable.ttf"))

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

    # Subset Noto Sans JP — Japanese letterforms for ja locales (5.0).
    # Scoped to the characters ja.json actually uses (+ASCII); SC remains the
    # fallback for anything else, so the chain 'Noto Sans JP, Noto Sans SC'
    # renders JA text with Japanese forms without growing the SC subset.
    jp_input = next((p for p in JP_SOURCE_CANDIDATES if os.path.exists(p)), None)
    if not jp_input:
        print(f"\nNoto Sans JP source not found. Downloading...")
        os.makedirs(SOURCES_DIR, exist_ok=True)
        jp_input = download_font(NOTO_JP_URL, os.path.join(SOURCES_DIR, "NotoSansJP-Variable.ttf"))

    print("\nCollecting Japanese characters (ja.json + the JA card strings)...")
    jp_codepoints = collect_characters(["ja"]) | collect_og_card_characters(["ja"])["ja"]

    print(f"\n--- Noto Sans JP ---")
    print(f"Source: {jp_input}")
    print(f"Input: {os.path.getsize(jp_input) / 1024:.1f} KiB")
    print(f"JP codepoints: {len(jp_codepoints)}")
    jp_size, jp_glyphs = subset_font(jp_input, JP_OUTPUT, jp_codepoints, fix_names={
        1: "Noto Sans JP",
        2: "Regular",
        4: "Noto Sans JP Regular",
        6: "NotoSansJP-Regular",
    })
    print(f"Output: {jp_size / 1024:.1f} KiB ({jp_glyphs} glyphs) -> {JP_OUTPUT}")

    total = sc_size + kr_size + jp_size
    print(f"\nTotal CJK font overhead: {total / 1024:.1f} KiB (budget ~1.3 MiB)")
    print("Done! Commit the updated subset files to the repository.")


if __name__ == "__main__":
    main()
