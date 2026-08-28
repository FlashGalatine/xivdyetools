# [DEAD-020]: The committed CJK font subsets carry 99 glyphs (≈45 KB) for FFXIV job names the worker never renders

## Category
Stale Code (bundled asset)

## Location
- `src/fonts/NotoSansJP-Subset.ttf`, `NotoSansKR-Subset.ttf`, `NotoSansSC-Subset.ttf`

## Evidence
`scripts/subset-cjk-fonts.py` re-run against HEAD and compared **by cmap** (byte hashes are meaningless — fonttools rewrites `head.modified` on every run); full table in `evidence/font-subset-regen.txt`:

| Font | committed | regenerated | added | removed | bytes |
|---|---|---|---|---|---|
| JP | 341 | 306 | 0 | 35 | 391,628 → 375,436 |
| KR | 404 | 392 | 0 | 12 | 191,324 → 188,368 |
| SC | 709 | 657 | 0 | 52 | 590,420 → 564,388 |

Nothing is *missing* (added = 0 → **no tofu risk**), so this is not urgent. The surplus glyphs are job names — 侍 samurai, 忍 ninja, 竜騎士 dragoon, 黒魔道士 black mage, 召喚士 summoner, 学者 scholar, 占星術師 astrologian, 踊り子 dancer, 吟遊詩人 bard, 機工士 machinist, 暗黒騎士 dark knight, 白魔道士 white mage, 賢者 sage, 蛇 viper… — evidently collected from a locale section the script no longer reads (or core no longer ships). og-worker draws dye names, tool tags and deck lines only.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | NONE (subset shrinks; every currently-rendered glyph remains) |
| **Reversibility** | EASY (git) |

## Recommendation
**REMOVE (regenerate)** — run the script and commit the three files (~45 KB off the bundle). Low priority on its own; fold into the next string change that requires a regen anyway. The regenerated files were reverted after this audit so the tree stayed clean.
