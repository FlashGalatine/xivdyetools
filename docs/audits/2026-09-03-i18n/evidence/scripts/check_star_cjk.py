from fontTools.ttLib import TTFont

root = "C:/dev/XIVProjects/xivdyetools/.claude/worktrees/i18n-audit-2026-09-03/"

fonts = [
    "apps/discord-worker/src/fonts/NotoSansJP-Subset.ttf",
    "apps/discord-worker/src/fonts/NotoSansSC-Subset.ttf",
    "apps/discord-worker/src/fonts/NotoSansKR-Subset.ttf",
]

targets = {0x2605: 'BLACK STAR', 0x0394: 'DELTA'}

lines = []
for fp in fonts:
    font = TTFont(root + fp, lazy=True)
    cmap = font.getBestCmap()
    fname = fp.split('/')[-1]
    for cp, label in targets.items():
        present = cp in cmap
        lines.append(f"{fname}: {label} (U+{cp:04X}): {'YES' if present else 'MISSING'}")

with open(root + "docs/audits/2026-09-03-i18n/evidence/scripts/star_cjk_results.txt", "w", encoding="utf-8") as out:
    out.write("\n".join(lines))
print("done")
