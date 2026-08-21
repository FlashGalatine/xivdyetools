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
