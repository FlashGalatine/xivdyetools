# i18n Audit — 2026-04-28

Comprehensive internationalization audit of the xivdyetools monorepo across all 6 supported languages (en, ja, de, fr, ko, zh).

## Reports

- **[I18N_AUDIT.md](./I18N_AUDIT.md)** — Main report with executive summary and prioritized recommendations
- **[LOCALE_PARITY.md](./LOCALE_PARITY.md)** — Key/path parity comparison across all 18 locale files
- **[FONT_SUBSET_AUDIT.md](./FONT_SUBSET_AUDIT.md)** — CJK font subsetting status, including a critical bug
- **[HARDCODED_STRINGS.md](./HARDCODED_STRINGS.md)** — Hardcoded English strings outside the i18n system

## TL;DR

| Finding | Severity |
|---------|----------|
| **All 18 locale files have perfect structural parity** (605/1119/243 paths matched across all 6 languages) | OK |
| **Subset script `subset-cjk-fonts.py` has stale path** — silently skips core dye-name characters since the monorepo restructure | **HIGH** |
| KR subset is 814 KiB (5× larger than documented 155 KiB); likely contains stale glyphs and unnecessary layout features | MED |
| og-worker hardcodes English `TOOL_NAMES`/`HARMONY_NAMES`/`VISION_NAMES`/`SHEET_NAMES` — every social-media link preview is English regardless of `?lang=` | MED |
| og-worker bundles no CJK fonts; future OG localization will need them | DEFERRED |
| **2 confirmed defects**: `themes.sugarRiot` in web-app/de.json (`Sugar Riot` → `Zuckerschock`) and web-app/ko.json (`슈가` → `슈거` spelling) — verified via Garland Tools BNpcName lookup and SE Korea official FB | LOW |
| `themes.sugarRiot` in zh.json kept English correctly — patch 7.2 not yet on CN client; do not fan-translate | DEFERRED |
| `labels.metallic` in core/de.json — verify against FFXIV German client | LOW |

## Top 3 Actions

1. Fix path bug in [`apps/discord-worker/scripts/subset-cjk-fonts.py:46`](../../../apps/discord-worker/scripts/subset-cjk-fonts.py#L46) (`xivdyetools-core` → `packages/core`) and replace silent skip with a hard error
2. Re-run subsetter, verify with the script in [I18N_AUDIT §9](./I18N_AUDIT.md#9-verification-script-run-after-fix-1), commit refreshed font subsets
3. Localize og-worker hardcoded display names by sourcing from existing locale JSON
