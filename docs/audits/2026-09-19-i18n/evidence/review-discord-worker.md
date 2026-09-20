# i18n review — discord-worker

Base: `origin/main` `e86c7404`. Read-only review of `apps/discord-worker`.

## Module map read/grepped

- `src/handlers/commands/*.ts` (all 18: about, accessibility, budget, changelog, comparison,
  contrast, dye, extractor, gradient, harmony, manual, mixer-v4, preferences, preset,
  preset-notifications, stats, swatch) + their `.test.ts`
- `src/handlers/buttons/{copy,index,preview-image}.ts` + tests
- `src/commands/{registry,schemas,localize}.ts` + `localize.test.ts`
- `src/services/{font-coverage.test.ts,announcements.ts,preferences.ts,i18n.ts,bot-i18n.ts}`
- `packages/bot-logic/src/i18n/locales/{en,ja,de,fr,ko,zh}.json` (manual/manual5/matchImageHelp/
  card/preferences/about subtrees — parity + value diffs via a small python script, not full audit)
- `docs/audits/2026-09-19-i18n/evidence/hc-sentences-apps-discord-worker.txt` (collector output),
  cross-checked against the above

## Findings detail

**D-01 (P2)** `src/commands/localize.ts` `localizeOption()` (lines 183-195) recurses into
`option.options` and `option.choices` but never sets `out.description_localizations` on the
option itself, and `localizeCommands()` (201-209) only attaches `description_localizations` to
the top-level command. No code path ever sets `name_localizations` for a command, subcommand, or
option (only for *choice* values, via `choiceLocalizations`). `localize.test.ts`'s own assertion
(`countLocalizations` → `descriptions === commands.length`, i.e. 17) confirms this is the whole
count — every subcommand/option `description` in `schemas.ts` (151 `description:` fields total,
134 below top level — see `hc-sentences-apps-discord-worker.txt` lines 2-81) is English-only in
Discord's option-tooltip UI for every non-English Discord client locale. Command/subcommand names
themselves are also never localized (may be intentional, since Discord requires those to be
lowercase/pattern-matched identifiers, but no comment states this decision the way the `wheel`
choice comment does).

**D-02 (P2)** `src/commands/schemas.ts:554-561` — `/manual topic` choices (`📸 Image Matching
Tips`, `♿ Colour Vision`, `🔲 Contrast`, `📐 Matching Methods`, `🪙 Spectrum & Prices`, `👤
Character File`) are plain English literals. `src/commands/localize.ts`'s `choiceLocalizations()`
(96-181) has cases for `preferences`, `harmony`+`type`, `accessibility`/`a11y`+`vision`,
`budget`+`preset`, `dye`+`category` — no case for `manual`+`topic`. The embed *content* behind each
topic is fully localized (`manual5.topics.*` — verified parity across all 6 locale JSON files), but
the Discord command-picker dropdown that lets a user choose a topic stays English for every locale.

**D-03 (P2)** `src/handlers/commands/about.ts:32,136` — `BUILT_ON = 'Market prices from
Universalis · Paint mixing by spectral.js'` is a raw JS constant assigned directly to the embed
field `value` in `/about`, never routed through `t.t()`. The field *name* at line 135
(`t.t('about.builtOn')`) is localized, so a non-English user sees a translated label next to an
untranslated English sentence. Reached in the normal `/about` response, all locales.

**D-04 (P3, `?`)** `src/handlers/commands/extractor.ts:586` — `t.t('card.colours', { n:
matches.length })` renders `en:'{n} colours'`, `de:'{n} Farben'`, `fr:'{n} couleurs'` with no
singular form. `matches.length` is normally ≥3 (schema `colors` min_value 3 for `/extractor
image`), but `deduplicatePaletteResults` (lines 111-153) never changes the array length, only
reassigns duplicate slots — so the only way to reach n=1 is K-means collapsing to fewer live
clusters on a near-monochrome image (memory: "K-means empty clusters" from the 4A port). Contrast
with `preferences.ts:446-448`, which explicitly branches on `successes.length === 1` to a separate
singular key — the pattern `card.colours` should also use.

## Positives (verified, not just assumed)

- `manual5.topics.*` (name/body) present with correct keys in all 6 locale files; en/de/fr lengths
  (name ≤26 chars, body ≤362 chars) are far under Discord's embed title (256) and field-value
  (1024) limits — no truncation risk from the longest locales.
- `handlers/buttons/index.ts:73-85` resolves the *clicking* user's locale (KV pref → Discord
  `interaction.locale` → `en`) fresh on every button click before building `handleCopyRgb`/
  `handleCopyHsv` replies — a button click is a separate interaction from the command that
  produced the message, and this path re-resolves correctly rather than reusing a stale locale.
- `index.ts:1083` (`handleAutocomplete`) resolves locale the same way before dye-name
  autocomplete — matches the F-02 fix already credited in the 2026-08-20 audit.
- `services/font-coverage.test.ts` derives its "what can a card draw" string set by scanning core's
  `LocaleLoader` + bot-logic's locale JSON + `CONSOLIDATED_DYES` + `MATCHING_METHOD_TAGS` + a glyph
  scanner over `packages/svg/src` and `packages/bot-logic/src/commands` — not a hand-maintained
  list — so newly-added manual5/wheel/facewear strings are automatically in scope; nothing observed
  missing from it.
- `/changelog` (`changelog.ts`) chrome (`title`, `earlier`, `empty`, `notFound`) is fully keyed;
  only the release-note body text is (deliberately) English.
- `preferences.ts:446-448` correctly special-cases count===1 to a separate singular locale key
  instead of interpolating into a fixed-plural string.

## Rejected (checked, not filed)

- `/harmony wheel` choice names (`schemas.ts` `COLOR_WHEEL_LABELS`) are English-only by an explicit
  in-code decision ("follow the English-only convention `matching` already uses"); the wheel *name
  on the card* comes from core's `getColorWheelName` and is localized. Consistent with the
  do-not-refile ALGO_TAG/mixer-Spectral convention.
- `preview-image.ts`, `preset-notifications.ts`, `preset.ts:1078`, `index.ts` moderator paths all
  pin `createTranslator('en')` — explicitly commented "Moderator controls are English-only" in
  `preview-image.ts:76`; parallels the settled moderation-worker English-by-decision item.
- `/stats` embeds (`stats.ts`) hardcoded English titles/fields — explicitly on the do-not-refile
  list (admin dashboard).
- No `STRING_SELECT` (component type 3) components exist anywhere in discord-worker — the brief's
  "/manual select labels" concern does not apply; `/manual` uses a command-option choice list and
  plain embeds, no buttons/selects.
- `about.ts` `ATTRIBUTION` (Square Enix trademark disclaimer) left English — plausibly required
  verbatim as legal/trademark text; not filed as a defect, flagged only as uncertain in-file.
- Locale-file key parity (dup/missing/extra) for `manual`/`manual5`/`matchImageHelp` — checked
  programmatically, zero missing/extra keys across all 6 locales; already covered by the standing
  gates per the brief.

## Return table

See final reply.
