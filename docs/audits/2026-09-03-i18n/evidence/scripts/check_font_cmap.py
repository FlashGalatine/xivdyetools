from fontTools.ttLib import TTFont

root = "C:/dev/XIVProjects/xivdyetools/.claude/worktrees/i18n-audit-2026-09-03/"

fonts = [
    "apps/discord-worker/src/fonts/FragmentMono-Regular.ttf",
    "apps/discord-worker/src/fonts/Onest-Regular.ttf",
    "apps/discord-worker/src/fonts/Onest-SemiBold.ttf",
    "apps/discord-worker/src/fonts/Onest-Bold.ttf",
    "apps/discord-worker/src/fonts/SpaceGrotesk-Regular.ttf",
    "apps/discord-worker/src/fonts/SpaceGrotesk-SemiBold.ttf",
    "apps/discord-worker/src/fonts/SpaceGrotesk-Bold.ttf",
]

# glyphs actually drawn as literals by packages/svg source (verified, non-comment)
glyphs = {
    0x00B7: 'MIDDLE DOT ·',
    0x2014: 'EM DASH \u2014',
    0x0394: 'DELTA \u0394',
    0x2026: 'ELLIPSIS \u2026',
    0x00B0: 'DEGREE SIGN \u00b0',
    0x2192: 'RIGHT ARROW \u2192',
    0x2193: 'DOWN ARROW \u2193',
    0x2605: 'BLACK STAR \u2605',
    0x2022: 'BULLET \u2022',
}

results = {}  # cp -> {font: bool}
for fp in fonts:
    font = TTFont(root + fp, lazy=True)
    cmap = font.getBestCmap()
    fname = fp.split('/')[-1]
    for cp, label in glyphs.items():
        results.setdefault(cp, {})
        results[cp][fname] = cp in cmap

lines = []
header = "codepoint".ljust(22) + "".join(f.split('/')[-1].replace('.ttf','').ljust(24) for f in fonts)
lines.append(header)
for cp, label in glyphs.items():
    row = label.ljust(22)
    for fp in fonts:
        fname = fp.split('/')[-1]
        present = results[cp][fname]
        row += ("YES".ljust(24) if present else "MISSING".ljust(24))
    lines.append(row)

with open(root + "docs/audits/2026-09-03-i18n/evidence/scripts/font_cmap_results.txt", "w", encoding="utf-8") as out:
    out.write("\n".join(lines))
print("done", len(lines))
