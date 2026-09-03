import sys

files = """packages/svg/src/a11y-card.ts
packages/svg/src/base.ts
packages/svg/src/budget-ledger.ts
packages/svg/src/comparison-card.ts
packages/svg/src/contrast-card.ts
packages/svg/src/dye-info-card.ts
packages/svg/src/frame.ts
packages/svg/src/gradient.ts
packages/svg/src/harmony-card.ts
packages/svg/src/icons/tool-icons.ts
packages/svg/src/index.ts
packages/svg/src/mixer-card.ts
packages/svg/src/nearest-sheet.ts
packages/svg/src/palette-grid.ts
packages/svg/src/preset-swatch.ts
packages/svg/src/random-dyes-grid.ts
packages/svg/src/swatch-card.ts""".splitlines()

targets = {
    0x00B0: 'DEGREE SIGN °',
    0x00D7: 'MULTIPLICATION SIGN ×',
    0x2193: 'DOWN ARROW ↓',
    0x2194: 'LEFT-RIGHT ARROW ↔',
    0x2605: 'BLACK STAR ★',
    0xFF1A: 'FULLWIDTH COLON ：',
    0x00B7: 'MIDDLE DOT ·',
    0x2192: 'RIGHT ARROW →',
    0x0394: 'DELTA \u0394',
    0x03B1: 'ALPHA \u03b1',
    0x2264: 'LE \u2264',
    0x2265: 'GE \u2265',
    0x2013: 'EN DASH \u2013',
    0x2014: 'EM DASH \u2014',
    0x2022: 'BULLET \u2022',
    0x2026: 'ELLIPSIS \u2026',
}

root = "C:/dev/XIVProjects/xivdyetools/.claude/worktrees/i18n-audit-2026-09-03/"

out_lines = []
for fp in files:
    in_block_comment = False
    with open(root + fp, encoding='utf-8') as f:
        for lineno, raw in enumerate(f, 1):
            line = raw.rstrip('\n')
            stripped = line.strip()
            is_comment_line = False
            if in_block_comment:
                is_comment_line = True
                if '*/' in stripped:
                    in_block_comment = False
            elif stripped.startswith('/*'):
                is_comment_line = True
                if '*/' not in stripped:
                    in_block_comment = True
            elif stripped.startswith('*') or stripped.startswith('//'):
                is_comment_line = True

            if is_comment_line:
                continue

            for cp, label in targets.items():
                ch = chr(cp)
                if ch in line:
                    out_lines.append(f"{label}: {fp}:{lineno}: {stripped[:120]}")

with open(root + "docs/audits/2026-09-03-i18n/evidence/scripts/svg_glyphs_code_only.txt", "w", encoding="utf-8") as out:
    out.write("\n".join(out_lines))

print(f"Wrote {len(out_lines)} lines")
