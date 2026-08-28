# i18n Audit — discord-worker + dependent packages, 2026-08-20

Static audit (no code modified) of `apps/discord-worker`, `packages/bot-logic`, `packages/core` (locale data) and `packages/svg` on `monorepo-2.0-prep`.

| Report | Headline |
|---|---|
| [I18N_AUDIT.md](I18N_AUDIT.md) | Translation data perfect (12/12 files in parity); **7 `t.t()` keys don't exist** (raw keys on `/budget` first-run + `/preset favorite`); dye-name input English-only; 0 command localizations; `/stats` + `/preset` bypass the translator; Firmament currency key mismatch now user-visible |
| [HARDCODED_STRINGS.md](HARDCODED_STRINGS.md) | File-by-file inventory with `file:line` + quoted strings, the 166-label command-choice table, and the key list to add |
| [FONT_SUBSET_AUDIT.md](FONT_SUBSET_AUDIT.md) | Subsets stale again (6 missing embed-only glyphs, 217 surplus), **no coverage gate** (3rd audit in a row), `preset-swatch` on a stack without Noto Sans JP, Δ/α absent from the Latin faces |

## Top actions (one sprint)

1. Add the 7 missing keys ×6 + reverse key-existence gate (F-01)
2. Localized dye autocomplete / `resolveDyeInput(locale)` via core `searchByLocalizedName` (F-02)
3. Fix `"Skybuilders' Scrips"` → `"Skybuilders Scrips"` in `dye-vocabulary.ts` + `consolidated-ids.ts` (F-07)
4. Localize the rate-limit message (F-04) and `/swatch` generation error (F-06)
5. Re-cut CJK subsets; port og-worker `font-coverage.test.ts`; add JP to `base.ts FONTS` (F-17)

Then the coverage work: extract `stats.ts` / `preset.ts` / router fallbacks (F-05, ≈ 60 keys) and phase-1 `description_localizations` (F-03).

## Healthy — don't regress
Locale parity + orphan gates · `card.*` 100 % injected · `budget.ts` as the model handler (`grp/num`, every label keyed) · locale-resolution ladder · `manualLead/manualTail` verb-final pattern.

## Remediation status — 2026-08-21 (all 13 actions done, on `monorepo-2.0-prep`)

| Action | Finding | Commit |
|---|---|---|
| 1 | F-01 missing keys + reverse gate | `8cc40c13` |
| 2 | F-02 localized dye autocomplete / input | `a53b0d94` |
| 3 | F-07 Skybuilders currency key | `f9ad62d5` |
| 4 | F-04 rate-limit message | `b1dcfd55` |
| 5 | F-06 bot-logic errorMessage | `78d4be62` |
| 6 | F-17 subsets re-cut, font-coverage gate, JP in base.ts | `bb9a0313` |
| 7 | F-05 a–d router/buttons/copy/preset-API · preferences · preset · stats | `6185a10d` `d70b67f7` `0f8ce291` `689f431c` |
| 8 | F-03 phase-1 command localizations | `102a5520` |
| 9 | F-08 number formatting, card.perDe | `75329d3c` |
| 10 | F-09 `Translator.tc()` plurals | `5b6ef618` |
| 11 | F-10 consolidated names localized | `226c2715` |
| 12 | F-11 preset swatch labels/lang | `349276e0` |
| 13 | F-13 loggers, dead fallbacks | `71301da7` |

Left open by design: the four `/stats` admin dashboards (operator-English, documented in the file), raw presets-api `response.error` strings on three `/preset` paths (server-generated), `/changelog` + announcement bodies (English markdown source), F-03 phase 2 (option descriptions, remaining choice lists), the `zh-TW → zh` fold, the clan autocomplete labels. `register-commands` must run (CI on merge) for F-03 to reach Discord.
