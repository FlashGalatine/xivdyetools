# TERM-004: web-app's config sidebar and its tool panels translate the same control label differently (12 concept groups)
**Tier:** P3 · **Locale(s):** ja de fr ko zh · **Deploy unit:** web-app · **Official term:** none — house vocabulary; pick one per concept

## Location
Same EN value, different non-EN value, both visible in one session (sidebar setting ↔ in-tool label):

| Concept (en) | Locale | `config.*` | tool key |
|---|---|---|---|
| Perceptual | de | `mixingLab` Wahrnehmung · `matchingOklab` Wahrnehmungsbasiert | `mixer.modelOklab` Perzeptuell |
| Paint | ja / zh | 絵具 / 颜料 | `mixer.modelRyb` 絵の具 / 颜料画 |
| Vision Types | ja / de | 視覚タイプ / Sichttypen | `accessibility.visionTypes` 色覚タイプ / Sehtypen |
| Harmony Type | ko | 조화 유형 | `harmony.harmonyType` 하모니 타입 |
| Harmony | ko | `tools.harmony.shortName` 조화 | `budget.handoffHarmony` 하모니 |
| Max Results | fr / ko | Résultats maximum / 최대 결과 수 | `mixer.maxResults` Résultats max / 최대 결과 |
| Weighted RGB | fr / zh | RVB pondéré / 加权RGB | `comparison.mRedmeanLabel` RGB pondéré / 加权 RGB |
| Spectrum | ja | `showSpectrum` スペクトル | `common.spectrum` スペクトラム |
| Europe | ja | `marketBoard.region.europe` ヨーロッパ | `swatch.itemLinks.lodestoneRegion.eu` 欧州 |
| Hair | ko | `swatch.slotHair` 머리카락 | `swatch.palHair` 머리 |
| No matching dyes found | de / ko | `matcher.*` …Farben… / 매칭되는… | `gradient.*` …Farbstoffe… / 일치하는… |
| (capitalization) | fr | `Afficher les prix`, `Espace colorimétrique`, `Types de vision` | `Afficher les Prix`, `Espace Colorimétrique`, `Types de Vision` |

## Evidence
- `evidence/same-en-groups-all.txt` — 35 divergent same-EN groups in web-app, 5 in bot-logic; the table keeps those that are the *same concept* (dropped: `Dark`/`Light` theme-vs-colour, `All`, `Save`, `Clear` — legitimately context-dependent).
- ko: the tool's own title is `색상 조화 탐색기` (`tools.harmony.title`), so 하모니 is the outlier. fr: the split is Title Case vs sentence case for the same label; French UI convention (and the official Lodestone) is sentence case.

## Fix
- One pass per locale choosing the `config.*` or tool form; longer-term, have the sidebar read the tool's key instead of owning a duplicate. Guardrail: run `tool-name-consistency.py --all` in `validate:i18n` with an allow-list for context-dependent pairs.

## Status
OPEN
