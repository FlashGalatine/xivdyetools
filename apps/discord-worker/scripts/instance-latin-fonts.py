"""
Instance the brand faces (Space Grotesk, Onest) as static Regular / SemiBold / Bold.

resvg — the renderer inside the Discord and OG Workers — cannot move a
variable font's axes: one variable file exposes exactly its default instance,
so every `font-weight` in the card system rendered at that single weight
(Space Grotesk's default instance is Light 300; Onest's is Regular 400). The
Workers therefore bundle static instances, one file per weight the cards use:

    <app>/src/fonts/SpaceGrotesk-Regular.ttf   wght 400
    <app>/src/fonts/SpaceGrotesk-SemiBold.ttf  wght 600
    <app>/src/fonts/SpaceGrotesk-Bold.ttf      wght 700
    <app>/src/fonts/Onest-Regular.ttf          wght 400
    <app>/src/fonts/Onest-SemiBold.ttf         wght 600
    <app>/src/fonts/Onest-Bold.ttf             wght 700

Sources are the two variable files, tracked in scripts/font-sources/ (they
no longer ship). Each instance gets a name table that any font database
resolves to the plain family — ID 1/16 = "Space Grotesk" / "Onest", ID 2/17 =
the style — and an OS/2 usWeightClass of its weight, which is what resvg's
fontdb matches `font-weight` against.

Prerequisites:
  pip install fonttools

Usage:
  python scripts/instance-latin-fonts.py                 # apps/discord-worker/src/fonts
  python scripts/instance-latin-fonts.py --app og-worker # apps/og-worker/src/fonts

`src/services/font-faces.test.ts` (each app) renders 400 / 600 / 700 through
the real resvg-wasm and fails if any two weights come out identical.
"""

import argparse
import os
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
APPS = os.path.abspath(os.path.join(HERE, "..", ".."))
SOURCES = os.path.join(HERE, "font-sources")

FAMILIES = {
    "SpaceGrotesk": "Space Grotesk",
    "Onest": "Onest",
}
STYLES = [
    (400, "Regular"),
    (600, "SemiBold"),
    (700, "Bold"),
]

# OS/2 fsSelection bits
FS_REGULAR = 1 << 6
FS_BOLD = 1 << 5
FS_ITALIC = 1 << 0
# head.macStyle bits
MAC_BOLD = 1 << 0


def set_names(font: TTFont, family: str, style: str) -> None:
    """Rewrite the naming table so every consumer sees the plain family + style."""
    name = font["name"]
    ps_family = family.replace(" ", "")
    full = family if style == "Regular" else f"{family} {style}"
    records = {
        1: family,
        2: style,
        3: f"{family} {style};static instance",
        4: full,
        6: f"{ps_family}-{style}",
        16: family,
        17: style,
    }
    for name_id in records:
        name.removeNames(nameID=name_id)
    for name_id, value in records.items():
        name.setName(value, name_id, 3, 1, 0x409)  # Windows, Unicode BMP, en-US
        name.setName(value, name_id, 1, 0, 0)  # Macintosh Roman, English


def instance(source: str, family: str, weight: int, style: str, out: str) -> None:
    vf = TTFont(source)
    static = instantiateVariableFont(vf, {"wght": weight}, inplace=False, updateFontNames=False)
    set_names(static, family, style)
    os2 = static["OS/2"]
    os2.usWeightClass = weight
    os2.fsSelection &= ~(FS_REGULAR | FS_BOLD | FS_ITALIC)
    os2.fsSelection |= FS_BOLD if weight >= 700 else FS_REGULAR
    head = static["head"]
    head.macStyle = (head.macStyle | MAC_BOLD) if weight >= 700 else (head.macStyle & ~MAC_BOLD)
    static.save(out)
    print(f"  {os.path.basename(out):32} wght {weight}  {os.path.getsize(out) / 1024:6.1f} KiB")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--app", default="discord-worker", choices=["discord-worker", "og-worker"])
    args = parser.parse_args()

    out_dir = os.path.join(APPS, args.app, "src", "fonts")
    if not os.path.isdir(out_dir):
        print(f"no such font directory: {out_dir}", file=sys.stderr)
        return 1

    print(f"-> {os.path.relpath(out_dir, APPS)}")
    for file_stem, family in FAMILIES.items():
        source = os.path.join(SOURCES, f"{file_stem}-VariableFont_wght.ttf")
        if not os.path.isfile(source):
            print(f"missing source {source}", file=sys.stderr)
            return 1
        for weight, style in STYLES:
            instance(source, family, weight, style, os.path.join(out_dir, f"{file_stem}-{style}.ttf"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
