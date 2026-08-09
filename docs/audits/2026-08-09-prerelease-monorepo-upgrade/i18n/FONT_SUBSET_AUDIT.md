# Font Subset Audit — 2026-08-09

**Scan date:** 2026-08-09
**Locale files scanned:** 18 (3 trees × 6 languages)
**Font files inventoried:** 41

---

# [FONT-001]: `discord-worker` CJK subsets are stale by 128 glyphs — CJK text renders as tofu

## Severity
**HIGH** — user-visible text corruption for three of six supported languages

## Deploy Unit
`discord-worker`

## Summary

`discord-worker`'s three CJK subset fonts are missing **128 codepoints that its own locale
files actually use**. Those characters cannot render and will appear as tofu (`□`) in every
generated PNG card.

| Font | Script | Needed | Covered | **Missing** |
|------|--------|-------:|--------:|------------:|
| `NotoSansSC-Subset.ttf` | zh CJK | 821 | 774 | **47** |
| `NotoSansJP-Subset.ttf` | ja CJK | 556 | 508 | **48** |
| `NotoSansKR-Subset.ttf` | ko Hangul | 489 | 456 | **33** |
| | | | | **128 total** |

**The sibling fonts do not rescue them.** The design record establishes SC as the fallback in
the ja chain (*"'Noto Sans JP' before 'Noto Sans SC' in the chain for ja locales only"*), so the
obvious question is whether the gaps are covered elsewhere in the stack. They are not:

- **34 of the 48** missing ja glyphs are absent from the SC subset too
- **45 of the 47** missing zh glyphs are absent from the JP subset too
- **All 33** missing ko glyphs are unrecoverable — `NotoSansKR-Subset.ttf` is the only Hangul
  font loaded

So at least **112 of 128** are hard failures with no fallback path.

## Scope — how the requirement set was derived

This matters, because a first pass got it wrong and reported ~1,500 missing glyphs.

`discord-worker`'s own subsetter defines its inputs:

```python
# apps/discord-worker/scripts/subset-cjk-fonts.py:47,49
CORE_LOCALES_DIR = …/"packages"/"core"/"src"/"data"/"locales"
BOT_LOCALES_DIR  = …/"packages"/"bot-logic"/"src"/"i18n"/"locales"
```

The requirement set above is therefore `core ∪ bot-logic` per language — **not** pooled with
`web-app`, whose strings this Worker never renders. The unscoped first pass is retained at
`evidence/font-subset-audit.txt` purely to document the correction; **`evidence/font-subset-scoped.txt`
is the authoritative result.**

## Evidence

```
### discord-worker  (sources: core locales + bot-logic locales)
  NotoSansSC-Subset.ttf      zh CJK     need=  821 covered=  774  MISSING 47
      且余你便划判剩及另号唯嘴填声头套宜宽带店弱录志戏戴挂描早暂期档母汇留略穿衡读跟跨边远阶际非；＝
  NotoSansJP-Subset.ttf      ja CJK     need=  556 covered=  508  MISSING 48
      信傍判到刺号同呼唯回基塗導履市帯幅店弱当彙従想来枠欄歴測満略番省瞳線緩記該読載輝違遠量降際非項＝
  NotoSansKR-Subset.ttf      ko Hangul  need=  489 covered=  456  MISSING 33
      곽께내느닙답따떨띠량룹릅릴멀며므밴번벌뿐섯싼워응읽졌짐차착참측활휘
```

Fallback verification:

```
discord-worker ja misses that the SC fallback ALSO lacks: 34/47
  傍判刺号呼唯塗導履帯幅店弱彙従枠欄歴測満略番線緩記該読載輝違遠際非項
discord-worker zh misses that the JP fallback ALSO lacks: 45/45
  且余你便划判剩及另号唯嘴填声头套宜宽带店弱录志戏戴挂描早暂期档母汇留略穿衡读跟跨…
```

## Impact

The missing characters are not exotic — they are common, high-frequency words that will appear
constantly in the bot's generated cards:

- ja: 読 (read) · 記 (record) · 線 (line) · 測 (measure) · 略 (abbreviate) · 遠 (far) · 違 (differ)
- zh: 你 (you) · 声 (sound) · 头 (head) · 读 (read) · 边 (edge) · 远 (far) · 期 (period)
- ko: 번 (number) · 차 (difference) · 활 (active) · 측 (side/measure) · 참 (reference)

Words like 測/读 ("measure"/"read") sit squarely in the vocabulary of a colour-*measurement*
tool. A ja, ko or zh user will see broken boxes in the middle of ordinary sentences on cards
from `/harmony`, `/comparison`, `/budget`, `/swatch` and the rest.

**Why the test suite cannot catch this:** `discord-worker` has 41 passing test files, but they
assert SVG *structure* — element presence, layout arithmetic, string content. Glyph coverage is
a property of the rasteriser + font binary, invisible to any assertion about the SVG string.

## Why It Happened

Subsets are derived artefacts of the locale files, so **every locale string change invalidates
them**. The 5.0 release added a large volume of new bot strings — band vocabulary, verdict
sentences, `/manual` topics, short keys, OFF-GRID slot words, first-run copy — and the subsetter
was not re-run afterwards.

`og-worker`'s subsets *were* re-cut (verified complete below). This is the same
one-surface-fixed-the-other-missed pattern the deep-dive audit identifies as this release's
dominant risk shape.

## Recommendation — re-run the existing subsetter

The tooling exists and is correct; it simply needs running:

```bash
pip install fonttools brotli
python apps/discord-worker/scripts/subset-cjk-fonts.py
```

The script downloads the variable source faces into `.font-sources/` if absent, collects
codepoints from `core` + `bot-logic` locales, and re-emits the three subsets.

**Verify afterwards** — do not assume the run succeeded:

```bash
python - <<'PY'
from fontTools.ttLib import TTFont
import json, os, glob
CJK=[(0x3000,0x303F),(0x3040,0x309F),(0x30A0,0x30FF),(0x4E00,0x9FFF),
     (0x3400,0x4DBF),(0xF900,0xFAFF),(0xFF00,0xFFEF)]
HAN=[(0xAC00,0xD7AF),(0x1100,0x11FF),(0x3130,0x318F)]
def walk(o,a):
    if isinstance(o,str): a.update(map(ord,o))
    elif isinstance(o,dict):
        for v in o.values(): walk(v,a)
    elif isinstance(o,list):
        for v in o: walk(v,a)
def need(lang,rs):
    a=set()
    for d in ("packages/core/src/data/locales","packages/bot-logic/src/i18n/locales"):
        walk(json.load(open(f"{d}/{lang}.json",encoding="utf-8")),a)
    return {c for c in a if any(x<=c<=y for x,y in rs)}
for lang,f,rs in [("zh","NotoSansSC",CJK),("ja","NotoSansJP",CJK),("ko","NotoSansKR",HAN)]:
    ft=TTFont(f"apps/discord-worker/src/fonts/{f}-Subset.ttf",lazy=True)
    cov=set(ft.getBestCmap()); ft.close()
    miss=need(lang,rs)-cov
    print(f"{f}: {'OK' if not miss else f'STILL MISSING {len(miss)}: ' + ''.join(map(chr,sorted(miss)[:40]))}")
PY
```

All three must print `OK`.

Then check the size budget — the design record allocates *"~1.3 MB"* for three CJK subsets:

```bash
ls -la apps/discord-worker/src/fonts/NotoSans{SC,JP,KR}-Subset.ttf
```

Current: SC 805.8 KiB + JP 545.9 KiB + KR 225.4 KiB = **1,577 KiB**, already over the stated
budget before adding 128 glyphs. Re-subsetting will also *drop* stale glyphs no longer used, so
the total may fall — but if it lands materially above ~1.6 MB, treat the budget as needing an
explicit re-decision rather than silently exceeding it. Cloudflare Workers have a bundle-size
limit, and fonts are the largest single contributor.

Finally, deploy — a re-subset only takes effect once the Worker ships:

```bash
pnpm --filter xivdyetools-discord-worker run deploy          # staging, verify a ja/ko/zh card
pnpm --filter xivdyetools-discord-worker run deploy:production
```

### Sequencing — this is the terminal sprint

**Font work must be scheduled last, after every other locale-touching change.** Subsets are
derived from the final character inventory, so any sprint that edits a locale string
invalidates them and forces a re-cut. Re-subsetting early means doing it twice.

Confirm before running that no other outstanding work adds bot strings — in particular the
`/preset` backend strings and the curated-preset locale keys (`preset.<id>.*`) the design record
lists as pending.

---

# [FONT-002]: `og-worker` subsets — VERIFIED COMPLETE, no action

Scoped to `og-worker`'s own subsetter inputs (`core` locales + `og-strings.ts` card strings):

| Font | Script | Needed | Covered | Missing |
|------|--------|-------:|--------:|--------:|
| `NotoSansSC-Subset.ttf` | zh CJK | 368 | 368 | **0** ✅ |
| `NotoSansKR-Subset.ttf` | ko Hangul | 272 | 272 | **0** ✅ |
| `NotoSansJP-Subset.ttf` | ja CJK | 183 | 173 | 10 — **false positive** |

The 10 apparent JP gaps (`匹取变提样渐觉设较预`) are **Simplified Chinese** characters. They
surfaced because `og-strings.ts` holds all six locales in one file, so the extraction could not
separate the ja strings from the zh ones. Verified directly: **all 10 are present in
`og-worker`'s SC subset**, which is the documented fallback in the ja chain.

**`og-worker` needs no font work.** Its subsets were re-cut for 5.0 and are current.

---

## Font File Inventory

| File | Type | Size | Glyphs | Status |
|------|------|-----:|-------:|--------|
| `discord-worker/src/fonts/NotoSansSC-Subset.ttf` | subset | 805.8 KiB | 1,183 | ⚠️ 47 missing |
| `discord-worker/src/fonts/NotoSansJP-Subset.ttf` | subset | 545.9 KiB | 614 | ⚠️ 48 missing |
| `discord-worker/src/fonts/NotoSansKR-Subset.ttf` | subset | 225.4 KiB | 553 | ⚠️ 33 missing |
| `discord-worker/src/fonts/FragmentMono-Regular.ttf` | full | 122.4 KiB | 487 | ✅ |
| `discord-worker/src/fonts/Onest-VariableFont_wght.ttf` | full | 120.5 KiB | 470 | ✅ |
| `discord-worker/src/fonts/SpaceGrotesk-VariableFont_wght.ttf` | full | 131.0 KiB | 735 | ✅ |
| `og-worker/src/fonts/NotoSansSC-Subset.ttf` | subset | 576.6 KiB | 709 | ✅ complete |
| `og-worker/src/fonts/NotoSansJP-Subset.ttf` | subset | 382.4 KiB | 341 | ✅ complete |
| `og-worker/src/fonts/NotoSansKR-Subset.ttf` | subset | 186.8 KiB | 404 | ✅ complete |
| `og-worker/src/fonts/FragmentMono-Regular.ttf` | full | 122.4 KiB | 487 | ✅ |
| `og-worker/src/fonts/Onest-VariableFont_wght.ttf` | full | 120.5 KiB | 470 | ✅ |
| `og-worker/src/fonts/SpaceGrotesk-VariableFont_wght.ttf` | full | 131.0 KiB | 735 | ✅ |
| `discord-worker/fonts-src/NotoSansSC-Regular.ttf` | **full source** | 10.1 MiB | 30,890 | build input, not shipped |
| `discord-worker/fonts-src/NotoSansKR-Variable.ttf` | **full source** | 9.9 MiB | 23,174 | build input, not shipped |
| `web-app/fonts/*` (28 files: Cinzel, Lexend, Habibi) | orphaned | 640 KiB | — | ❌ unreferenced → `DEAD-002` |
| `web-app/public/fonts/habibi-…woff2` | served | 14.2 KiB | — | ⚠️ retired face, still live → `BUG-002` |

**Note:** `discord-worker/fonts-src/` holds the 20 MiB full source faces. Confirm they are
excluded from the Worker bundle — they are inputs to `subset-cjk-fonts.py`, not runtime assets.
The subsetter also writes to `.font-sources/`, which should be gitignored.

---

## Font Stack Validation

| Context | Stack | CJK fallback | Status |
|---------|-------|--------------|--------|
| `discord-worker` SVG | Onest / Space Grotesk / Fragment Mono + SC·JP·KR subsets | ✅ present | ⚠️ subsets stale (FONT-001) |
| `og-worker` SVG | same chain, JP before SC for ja | ✅ present | ✅ OK |
| `web-app` body (`globals.css:64`) | `Onest, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif` | ❌ none | ⚠️ falls through to system default |
| `web-app` headings (`globals.css:41`) | `Space Grotesk, -apple-system, …, sans-serif` | ❌ none | ⚠️ same |
| `web-app` numeric (`globals.css:27`) | `Habibi, serif !important` | ❌ none | ❌ retired face → `BUG-002` |
| `web-app` `v4-layout.css:29` | `Segoe UI, Tahoma, Geneva, Verdana` | ❌ none | ⚠️ bypasses design system → `REFACTOR-004` |

**On the web-app CJK gap:** unlike the SVG surfaces, where a missing glyph is unrecoverable
tofu, the browser falls back to a system CJK font automatically. Rendering is therefore
*correct but unspecified* — it varies by OS. This is a lower-priority hardening item, not a
defect: add an explicit CJK family to the body and heading stacks so ja/ko/zh rendering is a
decision rather than an accident. Fold it into
[REFACTOR-002](../refactoring/REFACTOR-002.md)'s font consolidation.

---

## Recommendations

1. **Re-run `apps/discord-worker/scripts/subset-cjk-fonts.py`** and verify with the script
   above. This is the audit's only user-visible i18n defect. **Schedule it last**, after every
   other locale-touching change.
2. **Do not touch `og-worker`'s fonts** — verified complete.
3. **Automate the coverage check in CI.** Stale subsets are structurally recurring: every locale
   edit invalidates them, and nothing currently fails when they drift. A CI step that fails when
   a locale codepoint is absent from its subset would have caught this the day the 5.0 strings
   landed.
4. **Re-decide or confirm the ~1.3 MB CJK budget** — the three subsets already total 1,577 KiB.
5. **Add explicit CJK families to the web-app stacks** as part of `REFACTOR-002`.
