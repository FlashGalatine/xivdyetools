# i18n Audit — discord-worker + bot-logic + core + svg (2026-08-20)

**Scope:** `apps/discord-worker` (53 non-test source files), `packages/bot-logic` (incl. `/i18n`), `packages/core` (locale data + `LocalizationService`), `packages/svg` (card generators) — on `monorepo-2.0-prep` at the 2026-08-20 tree.
**Source locale:** `en` · **Targets:** `ja de fr ko zh` · **Terminology dictionary:** `docs/reference/ffxiv-terminology.md`
**Method:** scripted locale-file analysis (parity, object-scoped duplicates, placeholders, identical-to-en), fontTools cmap coverage, scripted `t.t()`-key resolution against `en.json`, and two full manual sweeps of non-test source for hardcoded user-facing text. Static — **no code or locale files were modified**.
**Companions:** [FONT_SUBSET_AUDIT.md](FONT_SUBSET_AUDIT.md) · [HARDCODED_STRINGS.md](HARDCODED_STRINGS.md) · previous i18n audit [2026-05-28](../2026-05-28/i18n/I18N_AUDIT.md)

---

## Executive summary

The **translation data is excellent and the engine is sound** — every check the previous audit passed still passes. The gaps are all in the **code that sits between the translator and the user**: seven `t.t()` keys that do not exist (so users see raw dotted keys), an English-only dye-name input path, an entirely English Discord command surface, and a long tail of handler files that never call the translator.

| Area | Status |
|---|---|
| Locale key parity (bot-logic 374 leaves · core 222 leaves, ×6) | ✅ perfect — 0 missing, 0 extra, 0 duplicates, 0 placeholder mismatches, identical line counts |
| Terminology vs `ffxiv-terminology.md` | ✅ clean |
| `card.*` label vocabulary (91 keys) | ✅ 100 % keyed, 0 orphans, svg references zero keys (label-injection only) |
| **`t.t()` keys missing from `en.json`** | ❌ **7** — raw keys render in `/budget` and `/preset favorite` |
| **Dye-name input (autocomplete + typed)** | ❌ English-only; core's `searchByLocalizedName` unused by the bot |
| **Slash-command metadata** (`name_localizations`) | ❌ 0 of 17 commands / 152 descriptions / 166 choices |
| Hardcoded user-facing English in handlers | ⚠️ ~180 literals in 8 files (`/stats` ≈ 75, `/preset` ≈ 50) + rate-limit message |
| Locale-aware number/date formatting | ⚠️ `budget` correct; 10 bare `toLocaleString()`, 7 `toFixed()`, `%`/`:1` bypasses |
| CJK subset fonts | ⚠️ stale again (6 missing embed-only glyphs, 217 surplus), **no coverage gate** — see FONT_SUBSET_AUDIT |
| Currency lookup | ⚠️ `"Skybuilders' Scrips"` ≠ locale key `"Skybuilders Scrips"` — now user-visible (9 dyes) |

| Metric | Value |
|---|---|
| Locale files checked | 12 (6 bot-logic + 6 core) |
| Static `t.t()` call sites in discord-worker / distinct keys | 400 / 259 |
| Keys called but absent from `en.json` | **7** (11 call sites) |
| Commands / descriptions / choice labels registered English-only | 17 / 152 / 166 |
| Hardcoded user-facing literals (discord-worker) | ≈ 180 handlers + ≈ 14 services |
| Hardcoded literals (bot-logic error paths) | 12 (1 live, 11 latent) |
| Hardcoded literals rendered into SVG (svg) | 17 sites, 1 generator with no label surface |

---

## 1. Locale configuration

| | bot-logic (`packages/bot-logic/src/i18n/locales/`) | core (`packages/core/src/data/locales/`) |
|---|---|---|
| Format | nested JSON, one file per locale | nested JSON, one file per locale |
| Sections | `meta common errors quality manual dye extractor gradient harmony mixer accessibility about preset budget preferences webhook previewImage matchImage matchImageHelp card firstRun changelog manual5` | `locale meta labels dyeNames(125, keyed by legacy itemID) categories acquisitions currencies harmonyTypes visionTypes visions tools sheets races clans` |
| Leaves / lines (all 6 identical) | 374 / 494 | 222 / 250 |
| Interpolation | `{name}` single-brace (`translator.ts:37`) — no `{{ }}` anywhere | n/a |
| Engine | `Translator` — locale → en → **raw key**; optional `logger.warn` on miss; **no plural support** | `TranslationProvider` → en → raw key |
| Gates | `locales.test.ts` (en ⊆ locale, one-way) + `__tests__/locale-orphans.test.ts` (en keys referenced in 4 consumer trees; bidirectional parity) | `LocaleLoader` / `TranslationProvider` tests |

**Not checked by any gate:** that a `t.t()` call site's key *exists* (the reverse direction of the orphan test) — that is exactly how F-01 survived.

## 2. Locale-file health (all ✅)

| Check | bot-logic | core |
|---|---|---|
| Missing / extra keys vs en | 0 / 0 in all 5 | 0 / 0 in all 5 |
| Object-scoped duplicate keys | 0 | 0 (the `visionTypes`/`visions` sibling names are not duplicates — see 2026-05-28 §3) |
| Placeholder set mismatch (`{var}`) | 0 | 0 |
| Type mismatches (string vs object) | 0 | 0 |
| Empty strings | `card.manualTail` = `""` in en/de/fr/zh — **intentional** (verb-final suffix, filled in ja ` をご覧ください` / ko ` 참고`) | 0 |
| Identical-to-en with words | ja 10 · ko 10 · zh 9 · de 21 · fr 21 — brand/abbreviation residue (`RGB`, `HSV`, `XIV Dye Tools`, `/about`, card tokens `SLOT/LIMBAL/BASE/EXACT/RATIO`, `Tags`, `Version`) | de 10 · fr 9 — proper nouns (`Lalafell`, `Viera`, `Gil`, clan names) |

Two nits only: `about.poweredBy` is untranslated in **de** (`Powered by Cloudflare Workers`) while ja/fr/ko/zh translate it; de `matchImageHelp.commonIssuesContent` opens a quote with `‚` (U+201A) and closes with `'` (should be `‚…‘` or `„…“`).

## 3. Terminology ✅

Spot-checks of `categories`, `acquisitions`, `currencies`, `races`, `clans`, `harmonyTypes` against `docs/reference/ffxiv-terminology.md` match. ja dye names are stored without the `カララント:` prefix as documented. The 2026-05-28 currency nit is now a real defect — see **F-07**.

---

## 4. Findings

Severity: **HIGH** = wrong/broken output for users today · **MED** = non-English users get English on a common path · **LOW** = polish, latent, or design choice to revisit.

### F-01 · HIGH · Seven `t.t()` keys do not exist → users see raw dotted keys

Verified by resolving all 400 static `t.t('…')` call sites in `apps/discord-worker/src` against `en.json` (scripted). `Translator.t()` returns the **raw key** on a miss (`translator.ts:80-83`), in every locale including English.

| Missing key | Call site | User sees |
|---|---|---|
| `budget.noWorldSet.title` / `.description` | `handlers/commands/budget.ts:170`, `:427` | `**budget.noWorldSet.title**` ¶ `budget.noWorldSet.description` — **the `/budget find` and `/budget quick` path when no world is set**, i.e. every first-time user |
| `budget.errors.missingWorld` | `budget.ts:375` | `budget.errors.missingWorld` (`/budget set_world` without a world) |
| `budget.errors.saveFailed` | `budget.ts:389` | `budget.errors.saveFailed` |
| `budget.errors.missingPreset` | `budget.ts:416` | `budget.errors.missingPreset` |
| `common.unknownError` | `preset.ts:1155`, `:1226`, `:1306` | catch-all for all three `/preset favorite` subcommands |
| `preset.errors.notFound` | `preset.ts:1127` | `preset.ts:316`/`:744` correctly use `preset.notFound` |

History: `budget.ts` has referenced `budget.noWorldSet.title` since the monorepo migration (`79e945ac`, 2026-02-18) while the locale only ever had `budget.errors.noWorldSet` (a single string) — so this has been broken for six months. The 2026-08-18 orphan cleanup (`7c7e9013`) then correctly pruned `budget.errors.noWorldSet` as unreferenced. The favorites keys date from `96baf42f` (2026-05-08). Not a regression from the cleanup; a gap in its gate.

**Fix:** add the 7 keys to all six locale files (or repoint `preset.errors.notFound` → `preset.notFound`); add a **reverse gate** to `locale-orphans.test.ts` — every static `t.t('x.y')` literal in the 4 consumer trees must resolve in `en.json`. ~1 h.

### F-02 · HIGH · Dye-name input is English-only (autocomplete and typed)

- `index.ts:919` `getDyeAutocompleteChoices` and `services/budget/budget-calculator.ts:311` `getDyeAutocomplete` both call `dyeService.searchByName(query)` (English `nameLower` substring) and label choices `` `${dye.name} (${dye.hex})` `` / `` `${dye.name} (${dye.category})` `` — English name **and** English category.
- Typed input: `packages/bot-logic/src/input-resolution.ts:204` `resolveDyeInput` → `searchByName`; `budget-calculator.ts:302` `getDyeByName` likewise.
- Core already ships `DyeService.searchByLocalizedName(query, locale)` (`DyeService.ts:301`) that matches English **or** the locale's name — used only by `api-worker` (`routes/dyes.ts:56`).
- `getClanAutocompleteChoices` (`index.ts:950`) is English too, though core `clans`/`races` are localized.

Effect: a ja user typing `スノウ` gets no suggestions and `/dye info dye:スノウホワイト` resolves to nothing. Every command with a dye-name option is affected (`/dye`, `/harmony`, `/gradient`, `/mixer`, `/compare`, `/contrast`, `/accessibility`, `/budget`, `/preset submit|edit`).

**Fix:** resolve the locale in `handleAutocomplete` (it already has `interaction.locale` + KV), call `searchByLocalizedName`, label with `getLocalizedDyeName`/`getLocalizedCategory`; thread `locale` into `resolveDyeInput`/`getDyeByName`. Keep `value` as the English name/itemID so downstream resolution is unchanged. ~half day + tests.

### F-03 · HIGH (scope) · Slash-command surface is 100 % English

`commands/schemas.ts` registers **17 commands, 31 subcommands/groups, 104 options → 152 `description` strings, 27 `choices` arrays → 166 labels**; `name_localizations` / `description_localizations` appear **zero** times in the worker. A user with `/preferences set language:ja` gets Japanese embeds and cards but an English command picker, option tooltips and dropdowns.

Three choice lists duplicate data the runtime already localizes: `/preferences reset key` (16 labels ≙ `preferences.keys.*`, translated in all 6 files), `/dye list category` (8 ≙ `getLocalizedCategory`), `/budget quick preset` (5 dye names ≙ `getLocalizedDyeName`). The matching-method choice block is copy-pasted identically into 7 commands (36 entries). `/preferences set language` is the one list done right (native endonyms).

**Fix (phased):** (1) a `localize(key)` helper in `schemas.ts` that emits `description_localizations` from a new `commands.*` locale namespace for the 17 top-level descriptions + the 16 reset keys + categories (≈ 40 strings); (2) option descriptions; (3) choices. Discord caps descriptions at 100 chars per locale. Needs a `register-commands` run (CI on merge). ~1–2 days for full coverage; phase 1 is ~2 h.

### F-04 · MED · Rate-limit message is English with hand-rolled plural

`services/rate-limiter.ts:206` — `You're using this command too quickly! Please wait **${seconds} second${seconds !== 1 ? 's' : ''}** …`, surfaced at `index.ts:640` for 13 of 17 commands. The most frequently seen untranslated string in the bot. **Fix:** `errors.rateLimited` exists in a `budget.errors` form; add a `common.rateLimited {seconds}` key and resolve the locale before formatting (`interaction.locale` is available at that point). ~30 min.

### F-05 · MED · Handlers that bypass the translator (≈ 180 literals)

Full inventory in [HARDCODED_STRINGS.md](HARDCODED_STRINGS.md). Headlines:

| File | Count | Notes |
|---|---|---|
| `handlers/commands/stats.ts` | ≈ 75 | All five renderers take `_t: Translator` and discard it; exactly one `t.t()` in the file. `/stats summary` is **public**. |
| `handlers/commands/preset.ts` | ≈ 50 | The whole `/preset favorite` feature, every error path (`'Failed to load presets.'`, `'No presets found.'`, `'Invalid command structure'`), field names `Name/Category/Dyes`, `${n} colors`, `by ${author}` / `'Official'`, and raw `response.error` from presets-api at `:526/:635/:842` |
| `types/preset.ts:117-137` `getSafeMessage()` | 7 | `'Permission denied.'`, `'Not found.'`, … shown via `preset.ts:570/:885` |
| `index.ts` | 5 | `:744` **the catch-all `'An error occurred while processing your command.'`** for every command failure; `:617`, `:735`, `:1073`, `:1091` |
| `handlers/buttons/copy.ts` | 4 + labels | zero `t.t()`; `'Invalid RGB format.'`, `**RGB Values:**`, button labels |
| `handlers/commands/preferences.ts:102-111` | 8 | `FILTER_OPTION_KEYS` labels (`'Metallic'`, `'Expensive (Pure White / Jet Black)'`…) rendered at `:228/:623/:668`; `:519` `'☀️ light'/'🌙 dark'`; `MATCHING_METHODS[].name/.description` and `BLENDING_MODES[].description` (`types/preferences.ts:148-157`) injected into translated validation sentences |
| `handlers/commands/extractor.ts:177,:193` | 2 | `'No subcommand provided'` / `Unknown subcommand:` — `errors.missingSubcommand`/`unknownSubcommand` exist and `dye.ts` uses them |
| `services/budget/universalis-client.ts:397` | 1 | `` `${dc.name} (${dc.region} Data Center)` `` — the world autocomplete label in 4 commands |
| `services/preferences.ts:525-546` | 4 | `'all commands'`, `'every generated card'`… under the translated `preferences.set.affects` |
| `handlers/commands/manual.ts:229-231` | 3 | link labels inside an otherwise-localized block |
| `handlers/buttons/index.ts:88` | 1 | `'This button is not recognized.'` |

**Fix:** mechanical extraction; `stats.ts` + `preset.ts` + `getSafeMessage` + router/button fallbacks ≈ 60 new keys. Suggest one PR per file. ~1–2 days.

### F-06 · MED · `GENERATION_FAILED` English passthrough on `/swatch` (+ 11 latent)

`packages/bot-logic/src/commands/*.ts` return `errorMessage: 'Failed to generate …'` literals on 12 paths; all have `errors.generationFailed` and a live `Translator` in scope. Eleven are masked because the worker substitutes its own `t.t('errors.generationFailed')`; **`swatch.ts:378` is not** — `apps/discord-worker/src/handlers/commands/swatch.ts:117` renders `result.errorMessage` verbatim, so `/swatch` is the one command whose generation failure is English for everyone (its three other failure paths are localized). `harmony.ts:334` also still says "harmony wheel". **Fix:** return `t.t('errors.generationFailed')` from bot-logic (12 one-liners), or make the worker ignore `errorMessage` uniformly. ~30 min.

### F-07 · MED · Currency key mismatch — Firmament dyes show English currency in every locale

`packages/core/src/config/dye-vocabulary.ts:58` derives `Dye.currency = "Skybuilders' Scrips"` (apostrophe) for the 9 `The Firmament` dyes; the locale `currencies` key is `"Skybuilders Scrips"`. `TranslationProvider.getCurrency` (`:198-214`) misses both the locale and the en table and returns the raw string, so `bot-logic/commands/dye-info.ts:95` (`SRC` row on the `/dye info` card) prints `100 Skybuilders' Scrips` for ja/de/fr/ko/zh instead of `振興券` / `Scheine` / `Assignats` / `진흥권` / `振兴票`. The 2026-05-28 audit flagged this as "not user-visible"; schema v2 (2026-07-31) made it visible by deriving `currency` from this table. `consolidated-ids.ts:72` has the same spelling. **Fix:** align `dye-vocabulary.ts` + `consolidated-ids.ts` on the locale-key spelling (or add an alias key). 5 min + a test asserting every `ACQUISITION_META[].currency` is a `currencies` key.

### F-08 · LOW–MED · Locale-aware number/date formatting is partial

`packages/svg/src/base.ts:267-281` provides `grp()`/`num()` (per-locale separators); only `budget.ts` uses them. Elsewhere:
- `preferences.ts:244` `` `Last updated: ${new Date(…).toLocaleString()}` `` — no locale arg (runtime default = en-US) **and** an English label, on every `/preferences show`.
- `stats.ts` ×9 `toLocaleString()` no-arg; `toFixed()` at `stats.ts` ×6, `extractor.ts:341` (`ΔE` to 1 dp with `.` in de/fr).
- `svg/contrast-card.ts:122,:242,:425` ratio `toFixed` → `4.53:1` with `.` in de/fr; axis labels `3 / 4.5 / 7`, `1:1`, `21:1` fixed (`:378-397`); `mixer-card.ts:130,:140` and `palette-grid.ts:194` `%` strings bypass `num()`.
- `budget.ts:229` `` `${grp(v)} GIL` `` — unit position/spacing fixed (ja convention `1,000ギル`); `:295` `perDeLabel: 'GIL/ΔE'` passed as a card column header beside `t.t('card.*')` siblings.
- `Intl.NumberFormat`/`Intl.DateTimeFormat`: zero uses in the worker. `timestamp:` fields correctly use `toISOString()`.

### F-09 · LOW · Plural forms baked into strings; engine has no plural support

`Translator` has no count-aware rule; the only plural handling is a two-branch ternary at `dye.ts:128-129` (`dye.search.foundCount` / `foundCountPlural`). Reachable wrong outputs: `card.swatchFootKey` `"{s} of {n} slots"` → **"1 of 1 slots"** (`swatch.ts:322`); `gradient.steps` `"{count} Steps"` → "1 Steps" (fr/de same); `card.gradVerdict` `"… resolve to {k} dyes"` with k = 1; `card.gradKeyCut` k = 1; rate-limit `second(s)` (F-04). Cheap fix: `_one`/`_other` key convention + a 6-line `tc(key, count)` helper; ja/ko/zh keep one form.

### F-10 · LOW (design) · Consolidated market-item names are `.names.en` everywhere

`CONSOLIDATED_DYES[type].names` carries ja/de/fr/ko/zh (`core/config/consolidated-ids.ts:50-82`) but both consumers read `.names.en`: `bot-logic/commands/dye-info.ts:73` (MKT row — the code comment says "the Spectrum item name stays verbatim EN, like a command choice value") and `discord-worker/services/budget/budget-calculator.ts:250` (group label → `budget.ts:260` `tier`, rendered beside a **localized** acquisition tier). The first is documented intent; the second reads as an oversight. A ja user searching the market board types the ja item name, so the EN-verbatim argument is weaker than for command tokens. Decide once, apply to both. If localized, add `consolidated-ids.ts` to the font-subset inputs (its 28 CJK chars are covered today only by coincidence).

### F-11 · LOW · `generatePresetSwatch` has no locale at all

`packages/svg/src/preset-swatch.ts` is the only generator with **no `labels`/`lang` input**: raw `dye.name` (`:253`), `` `by ${authorName}` `` (`:205`), `'Official'` (`:207`), `'No valid dyes in this preset'` (`:298`), and it is the only card still on `base.ts FONTS` (no `Noto Sans JP` — see FONT_SUBSET_AUDIT §5). Consumed by `discord-worker/handlers/commands/preset.ts` only. Either port it to `frame.ts` primitives with a `labels` object, or accept it as the one English card and say so.

### F-12 · LOW · Remaining hardcoded text inside SVG generators

`dye-info-card.ts:156-159` `HEX/RGB/HSV/LAB` row labels (not in `DyeInfoLabels`; `common.rgb/hsv` exist); `comparison-card.ts:171` `'ΔE2000'` verdict unit; `contrast-card.ts` axis labels and `:1` formatter (F-08); `harmony-card.ts:251/:351` `→ ↓` glyphs (documented); `frame.ts:352` `xivdyetools.app` (brand). `bot-logic/commands/harmony.ts:134-144` carries a dead English `formats` table after a complete `keyMap` → `t.t()`; `getHarmonyTypeChoices` (`:342`) is English by design (Discord choice metadata, ties to F-03). Tier words, band names, slot names, method tags are all correctly injected.

### F-13 · LOW · Translator / localization contract hazards

- `Translator.t()` returns the raw key on a miss and `createTranslator(locale)` is called **without a logger** at every bot-logic site (`accessibility.ts:132`, `comparison.ts:82`, `contrast.ts:62`, `dye-info.ts:83/181`, `gradient.ts:248`, `harmony.ts:169`, `mixer.ts:100`, `swatch.ts:175`) → misses are silent (how F-01 stayed hidden).
- `gradient.ts:197` `t.t('gradient.colorSpace') || 'Color Space'` — dead fallback encoding a false contract (`t()` is never falsy).
- `bot-logic/localization.ts` getters are sync over an async-populated cache: a caller that forgets `await initializeLocale(locale)` gets English silently; a failed `ja` load falls back to loading `en` and leaves the `ja` slot empty → English for the isolate's lifetime.
- `discordLocaleToLocaleCode` folds `zh-TW` → `zh` (Simplified); ~20 other Discord locales → `en` (expected).
- `services/preferences.ts:384` returns `reason: 'invalidTheme'` with no matching `case`/key → generic `preferences.validation.error`.

### F-14 · LOW · Glue, casing, and spliced clauses

Hardcoded `: ` / `•` / `—` / `→` between translated fragments (`harmony.ts:166`, `gradient.ts:195-199`, `preferences.ts:331/346/366`, `budget.ts:318`, `changelog.ts:99`); `preferences.ts:211` `.toLowerCase()` on a translated string; `swatch.ts:60,:97` English `file too large (…)` / `download failed (…)` spliced into `card.swatchParseError`; `preset-notifications.ts` half `adminT.t()` / half literal. The `card.manualLead` + literal + `card.manualTail` split (`extractor.ts:567`, `swatch.ts:364`) is the **correct** pattern — copy it.

### F-15 · LOW (latent) · Facewear colour names have no localization anywhere

`core/data/facewear_colors.json` (11 entries) carries English `name` only; no locale file keys them. Currently moot — every bot command filters `category !== 'Facewear'` and `facewearColors` has no non-test importer in bot-logic/svg/discord-worker — but the suite has no slot to put them if that changes.

### F-16 · INFO · Deliberate English surfaces (documented, no action)

7 `createTranslator('en')` sites for admin/moderation notifications (`preview-image.ts:123/:159`, `preset-notifications.ts:73`, `preset.ts:983`, `index.ts:223/:288/:334`) — the two `preview-image` sites reply to an interactive moderator, so they are borderline; `services/announcements.ts` + `/changelog` body text come from English `CHANGELOG-laymans.md`; `LENS_SHORT` / `MATCHING_METHOD_TAGS` / `charSub` tribe line are documented identifiers; `/preferences set language` endonyms.

### F-17 · see FONT_SUBSET_AUDIT · Subsets stale, no gate, JP missing from `base.ts`, Δ/α not in Latin faces

---

## 5. What is healthy (don't regress)

- 12/12 locale files in perfect parity; bidirectional parity + orphan gates exist and pass.
- Every `card.*` label reaches svg via injection; svg itself references no keys; tier/band/slot/method vocab fully keyed.
- `budget.ts` is the model handler: `grp()/num()` with locale, every card label via `t.t('card.*')`, `getLocalizedAcquisition` for tiers.
- Locale resolution ladder (unified prefs → legacy → Discord → en) is correct, tested, and fails soft; five commands implement the guest fallback properly.
- The `manualLead`/`manualTail` split handles verb-final languages correctly.
- KR subset bloat (2026-05-28 #1) is fixed; FONT-001 nameID fix present.

---

## 6. Recommended actions (priority order)

| # | Action | Finding | Effort | Impact |
|---|---|---|---|---|
| 1 | Add the 7 missing keys ×6 locales; add reverse key-existence gate to `locale-orphans.test.ts` | F-01 | 1 h | **HIGH** — raw keys on `/budget` first-run path |
| 2 | Localized dye autocomplete + `resolveDyeInput(locale)` via `searchByLocalizedName` | F-02 | ½ day | **HIGH** — non-EN users can't type dye names |
| 3 | Fix `"Skybuilders' Scrips"` spelling + test every `ACQUISITION_META` currency is a locale key | F-07 | 15 min | MED |
| 4 | Localize rate-limit message (+ `{seconds}` key) | F-04 | 30 min | MED — most-seen string |
| 5 | `/swatch` + 11 bot-logic `errorMessage` → `t.t('errors.generationFailed')` | F-06 | 30 min | MED |
| 6 | Re-run `subset-cjk-fonts.py`; port og-worker `font-coverage.test.ts`; add JP to `base.ts FONTS` | F-17 | 1.5 h | prevents 4th recurrence |
| 7 | Extract `stats.ts`, `preset.ts`, `getSafeMessage`, router/button fallbacks, `FILTER_OPTION_KEYS`, `Data Center`, `extractor` subcommand errors (≈ 60 keys) | F-05 | 1–2 days | MED |
| 8 | Phase-1 `description_localizations` for 17 commands + reset keys + categories | F-03 | 2 h (phase 1) | MED–HIGH reach |
| 9 | `preferences.ts:244` date → `Intl.DateTimeFormat(locale)` + key; `extractor.ts:341` → `num()`; `%`/`:1` → `num()`; `GIL/ΔE` → `card.*` | F-08 | 2 h | LOW–MED |
| 10 | `_one/_other` plural helper; fix `swatchFootKey`, `gradient.steps`, `gradVerdict` | F-09 | 2 h | LOW |
| 11 | Decide consolidated-name policy; apply to both consumers; add file to subset inputs if localized | F-10 | 1 h | LOW |
| 12 | Give `preset-swatch` a `labels`/`lang` surface (or document EN-only) | F-11 | 2 h | LOW |
| 13 | Pass a logger to every `createTranslator` in bot-logic; remove `|| 'Color Space'`; `invalidTheme` case | F-13 | 30 min | hygiene |

Items 1–6 fit in one sprint and remove every HIGH/MED user-visible defect; 7–8 are the larger localisation-coverage work; 9–13 are polish.

> All findings are documented only; **no code or locale files were modified** by this audit.
