# i18n review — core-svg (packages/core + packages/svg)

Base: `origin/main` `e86c7404`. Diff range for "new since last audit": `cf79ac9f..HEAD`.

## Module map / what changed since 2026-09-03

- `packages/core/localize.yaml`: dropped dead `General_Purpose` (I18N-010, unused,
  confirmed zero references outside CHANGELOG.md); French `Metallic` collapsed from a
  3-item array to a single string (`build-locales.ts` only ever read `[0]`, so the
  *output* did not change, just removed dead array-handling code).
- `packages/core/dyenames.csv`: `30123` German name `Perlmutt-` → `Perlmutt` (I18N-007,
  already fixed in this diff, verified all 124 other German names against XIVAPI per
  the commit body).
- `packages/core/facewear-names.csv` (new file, I18N-008): 11 Facewear tint names ×
  6 locales, keyed by slug.
- `packages/core/scripts/build-locales.ts`: added `buildColorWheels()` (hardcoded
  per-locale table, 5 wheels) and `buildFacewearNames()` (CSV-driven); removed the
  French-array branch in `buildLabels()`.
- `packages/core/src/data/locales/*.json`: all six gained `colorWheels` (5 keys) and
  `facewearColors` (11 keys); `ja.json` also fixed `categories.Neutral` and
  `acquisitions."Dye Vendor"` (TERM-002, confirmed against
  `docs/reference/ffxiv-terminology.md:67`).
- `packages/core/src/services/LocalizationService.ts` /
  `services/localization/TranslationProvider.ts`: new `getColorWheelName()` and
  `getFacewearColorName()` getters.
- `packages/core/src/config/band-vocabulary.ts`: ΔEOK cuts recalibrated for the
  ΔEOK→ΔEOK2 metric change. Numeric only — bands render as a colour tone in
  `packages/svg`, never as a translated word, so this carries no i18n surface.
- `packages/svg`: `emitted-glyphs.ts` (new font-coverage scanner, I18N/FONT-002),
  `harmony-card.ts` gained an optional caller-supplied `wheelLabel`, `preset-swatch.ts`
  made `authorLine`/`emptyLabel` required and replaced the undrawable `${voteCount}★`
  with a caller-supplied `votesLabel` (I18N-011), `frame.ts`'s `measuredRow` now runs
  all three lead variants through `fitText` (previously only some were, so a CJK lead
  could overflow — I18N-011 again).

## Candidates

| cand-id | tier | file:line | locale(s) | one-line claim | evidence pointer |
|---|---|---|---|---|---|
| CS-01 | P2? | packages/core/src/services/DyeService.ts:342-352 | de, fr, ja | `searchByLocalizedName` folds only ASCII case (`.toLowerCase()`); a de/fr query typed without ß/accents (`weiss` for `Weiß`, `eclair` for `Éclair`-style names) or a half-width-kana ja query won't match a name that has one | read the method body; `git grep -n "normalize(" packages/core/src/services` returns nothing — no NFKC/case-fold anywhere in the search path |
| CS-02 | P3 | packages/core/src/services/localization/TranslationProvider.ts:263-267 | all | `getColorWheelName`'s final fallback returns the raw `id` (e.g. `"oklch-hue"`) unformatted, unlike the sibling `getHarmonyType`/`getVisionType`/`getFacewearColorName`, which all end in `this.formatKey(key)`; only reachable if a caller passes an id absent from both the requested locale and `en`, which can't happen with the current hardcoded 5-wheel table | read lines 236-267 side-by-side; `colorWheels` is a hardcoded literal per locale in `build-locales.ts`, always has all 5 ids in all 6 locales, so this is latent, not live |
| CS-03 | P3? | packages/core/scripts/build-locales.ts:268-285, 287-300 | all | `buildDyeNames`/`buildFacewearNames` silently fall back to English (or write nothing) on a missing/empty CSV cell — no `console.warn`, no thrown error — so a future bad paste (empty ko/zh cell) would ship silent English instead of failing the build | read both functions; confirmed via python scan of the current `dyenames.csv` that no cell is currently empty, so this is a generator-robustness gap, not a live defect |

## POSITIVE (correct, do not re-file)

- The 5 new `colorWheels` names are present and distinct (not English, not copied from ja) in all six locales, and follow each locale's existing parenthesis convention exactly (full-width `（）` in ja/zh matching `visionTypes`/`sheets`, half-width `(...)` with a leading space in ko matching its own siblings) — verified by walking every string in all six `colorWheels` + comparing to `visionTypes`/`sheets` in the same file.
- All 11 `facewearColors` names are present, distinct per locale, and the ko/zh sets are internally consistent (every ko value ends in `색`, every zh value ends in `色`, matching the sibling-suffix pattern the brief calls out).
- `dyenames.csv` has zero empty cells, zero duplicate localized names within any one locale's `dyeNames` (would break reverse lookup), and zero non-English cell that is byte-identical to the English cell, across all 125 dyes × 5 non-en locales (checked by script against the generated JSON, not just the CSV).
- The pervasive trailing-space pattern in `dyenames.csv`'s English/German columns (~120 rows, e.g. `'Snow White '`, `'Schneeweißer '`) never reaches output — `build-locales.ts`'s `csv-parse` call passes `trim: true`, confirmed against the generated `en.json`/`de.json` (`5729` → `"Snow White"` / `"Schneeweißer"`, no trailing space).
- `preset-swatch.ts`'s I18N-011 fix is correctly consumed: `apps/discord-worker/src/handlers/commands/preset.ts:1003-1011` passes localized `authorLine` (`t.t('preset.byAuthor'…)`/`t.t('preset.official')`), `emptyLabel`, `votesLabel`, and a `dyeName` resolver — no English literal reaches the card.
- `harmony-card.ts`'s new `wheelLabel` is caller-localized end to end: `packages/bot-logic/src/commands/harmony.ts:309` calls `getLocalizedColorWheelName(wheel, locale)`, not a hardcoded string, and is `fitText`-truncated against the CJK/German-aware `estimateTextWidth`.
- ja's `categories.Neutral` (ニュートラル → 無彩色系) and `acquisitions."Dye Vendor"` (染料販売業者 → 染色師) fixes match `docs/reference/ffxiv-terminology.md:67` exactly and are backed by a documented rationale in `packages/core/CHANGELOG.md`.

## REJECTED (checked and dropped)

- Trailing whitespace on ~120 `dyenames.csv` English/German cells — cosmetic source formatting, trimmed by the generator, does not reach any output (see POSITIVE above).
- `band-vocabulary.ts` ΔEOK cut recalibration — pure numeric tier boundaries; `packages/svg` renders tiers as a colour tone (`comparison-card.ts:88-89`, `:112`), never as a localized word, so there is no i18n surface to review here.
- French `Metallic` yaml array → single string — the generator only ever read index `[0]` before this change, so the emitted `labels.metallic` value is unchanged; this is dead-code removal, not a content change.
- German `facewearColors.gold` = `"Gold"` (identical to English) — deliberate, documented with a reason in `packages/core/CHANGELOG.md` (mirrors web-app's identical-value allowlist pattern), matches the do-not-re-file rule.
- `Perlmutt-` trailing hyphen — already fixed in this diff (I18N-007), not re-filed.

## COVERED

~20 files read/diffed directly: `localize.yaml`, `dyenames.csv`, `facewear-names.csv`,
`build-locales.ts`, all 6 `src/data/locales/*.json`, `band-vocabulary.ts` (+ its parity
test), `LocalizationService.ts`, `TranslationProvider.ts` (+ 2 test files),
`DyeService.ts`, `ffxiv-terminology.md`, `emitted-glyphs.ts`, `harmony-card.ts`,
`preset-swatch.ts`, `swatch-card.ts`, `frame.ts`, `base.ts`, `comparison-card.ts`,
`packages/core/CHANGELOG.md`; plus 2 cross-surface call-site checks
(`apps/discord-worker/src/handlers/commands/preset.ts`,
`packages/bot-logic/src/commands/harmony.ts`) to confirm svg's new required/optional
params are fed localized values, not English literals.
