# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2026-09-03

### BREAKING

- Requires `@xivdyetools/svg` **4.x**: `generatePresetSwatch` now takes required
  `authorLine` / `emptyLabel` and a `votesLabel` instead of `authorName` / `voteCount`.
- **15 locale keys removed** from all six files — `harmony.{complementary, analogous,
  triadic, splitComplementary, tetradic, square, monochromatic, invertedTetradic, compound,
  shades}` and `accessibility.{normalVision, protanopia, deuteranopia, tritanopia,
  achromatopsia}`. Anything reading them directly should call the new getters below.
  `harmony.title`, `harmony.baseColor` and `accessibility.allLenses` stay — they have no
  core counterpart.

### Fixed

- **The bot named harmonies and colour-vision types differently from the rest of the
  product** (TERM-001). It resolved them through its own locale keys while web-app
  (`harmony-generator.ts`) and og-worker (`translator.ts`) both used `@xivdyetools/core`,
  so Split-Complementary was 分裂補色 in the app and スプリット補色 in the bot, Tetradic
  四色配色 vs テトラード, Protanopia 제1색맹 vs 적색맹, Normal Vision "Normales Sehen" vs
  "Normale Sicht". Eleven concepts disagreed across ja/ko/zh/de. PR #159 had already made
  core the single harmony *algorithm*; this makes it the single *vocabulary*, including in
  Discord's own command-choice picker.
- Japanese and Chinese mixed full-width `：` and half-width `:` for the same "label: value"
  shape — `有効なオプション` appeared both ways — so two adjacent bot messages punctuated
  the same sentence differently (I18N-012). Normalized to full width in 25 strings.
  Code samples inside backticks (`` `/preferences set language:ja` ``) keep their ASCII
  colons: the rewrite is backtick-aware.
- French `preferences.methods` / `.blendingModes` capitalized only `ciede2000` while every
  sibling was lowercase; en and de capitalize all. Aligned 10 entries (I18N-012).

### Added

- `getLocalizedHarmonyType()` and `getLocalizedVisionType()` — the core-backed getters the
  fix above routes through, alongside the existing `getLocalizedCategory` /
  `getLocalizedAcquisition`.
- `preset.cardVotes` (plural-aware via `tc()`) — the preset card's votes line, which used
  to be `${voteCount}★` and drew as tofu because no bundled font has U+2605 (FONT-002).

## [3.2.0] - 2026-09-03

### Fixed

- **`/harmony` no longer answers your own dye.** `preventDuplicates` defaulted to `false`
  here while the Harmony Explorer defaults it `true`, and core's `excludeItemIDs` was only
  consulted on the de-duplication branch — so the base dye was never actually excluded on
  the bot. `/harmony monochromatic` (one `[0]` offset, whose ideal is the base colour)
  returned the base dye at ΔE 0 as its entire harmony. Fixed in core (4.2.0), and both
  `preventDuplicates` and `strictMatching` now default to what `DEFAULT_CONFIGS.harmony`
  defaults them to in the web app, which is the point of converging these surfaces at all.
- **`strict_matching` does something again.** The value was destructured and then discarded
  with `void`, so the registered Discord option was accepted and changed nothing; it is
  passed through as `usePerceptualMatching` now. `harmonyOptions` (`color_space`) stays
  discarded — `generateHarmonySlots` rotates hue in HSV and that IS the shared algorithm,
  so the option has been withdrawn from the command rather than left registered and inert.

### Changed — harmony convergence

- `/harmony` now selects dyes through `@xivdyetools/core`'s
  `generateHarmonySlots`, the web app's algorithm. It previously called a named
  `DyeService.find*Dyes()` per type; measured over all 125 dyes the two surfaces
  returned different dyes for 89–100 % of bases on every harmony type. The bot
  and the Harmony Explorer now answer the same question the same way.
- Dye filters apply to the **candidate pool** rather than to the finished list,
  so a slot answers "the nearest allowed dye to the ideal" instead of "the
  nearest allowed dye to one that was thrown away".
- An unrecognised harmony type is now refused with `NO_MATCHES` instead of
  silently falling through to a triadic card labelled with the unknown name.

### Added

- `compound` and `shades` harmony types, with localized names in all six
  locales. They exist because selection reads `HARMONY_OFFSETS` — a type is a row
  in that table, and no per-type finder method has to be written for a new one.

  **Deploying this needs a `register-commands` run**: the `/harmony type` choice
  list grows from 8 to 10.

## [3.1.0] - 2026-09-02

Deep-dive remediation, Sprint 19 (docs/audits/2026-09-02-deep-dive, REFACTOR-001,
first half). Minor bump: new exports, no behaviour change to anything already
here.

### Added

**The locale layer both Discord bots were carrying privately.**
`apps/discord-worker/src/services/i18n.ts` and
`apps/moderation-worker/src/services/i18n.ts` each implemented `isValidLocale`,
`discordLocaleToLocaleCode`, the legacy `i18n:user:` reader and
`resolveUserLocale` — and moderation-worker declared its own `LocaleCode` union
and its own `SUPPORTED_LOCALES` on top. The copies drifted, and BUG-001 was the
result: only discord-worker's learned about the unified `prefs:v1:` preferences
blob, so a user who set their language through `/preferences` got every
moderation-bot string back in their Discord client locale — and could not
correct it, because that worker ships no language command. Both bots bind the
SAME production KV namespace, so there was never a reason for two readers of it.

`i18n/locale-resolution.ts` now owns it, exported from `@xivdyetools/bot-logic/i18n`:
`SUPPORTED_LOCALES`, `LocaleInfo`, `isValidLocale`, `discordLocaleToLocaleCode`,
`getLegacyLanguagePreference`, `resolveUserLocale`, plus the structural
`LocalePreferenceStore` and `LocaleResolutionLogger` (declared structurally so
this package still needs no `@cloudflare/workers-types` dependency — a real
`KVNamespace` satisfies the former).

`LOCALE_CODES` is also exported, and **`LocaleCode` is now derived from it**.
That closes the specific trap the audit named: moderation-worker declared the
union and the runtime array separately, and structural typing hid the gap, so
adding a seventh locale to the shared type would have compiled clean there and
been silently rejected at runtime. One list now feeds both.

### Fixed

**`discordLocaleToLocaleCode` returned a Function for an inherited key.** Both
forks looked the mapping up with `mapping[discordLocale] ?? null`, so
`'toString'` or `'constructor'` yielded `Object.prototype.toString` — from a
call declared `LocaleCode | null`, and `?? null` cannot catch it because the
inherited value is not nullish. Found by writing the first test this layer has
ever had; guarded with `Object.hasOwn`, the same fix FINDING-027 applied to help
topics.

Where the two copies disagreed, the louder behaviour won:
`getLegacyLanguagePreference` takes an optional logger and reports a KV failure
(moderation-worker's copy did; discord-worker's swallowed it silently). It still
resolves rather than throwing — locale resolution runs on every interaction and
must degrade the language, never the interaction.

### Tests

37 new cases covering the whole priority order and every failure mode: the
unified blob, the legacy key, the Discord locale, the English default, an
unsupported language in either store, a malformed blob, and a KV that throws on
every read. Removing the unified-blob step — BUG-001 exactly — reddens them.
Between them the two forked copies had one suite, and BUG-001 lived in the gap.

## [3.0.1] - 2026-09-02

### Fixed — 2026-09-02 deep-dive audit, Sprint 5

- **`/dye info`'s "+n more" line means something now** (pkg-svg-bot-logic-09). The count was
  `pool.length - drawn` over a four-entry pool and three drawn columns — the constant **1**, on
  every card ever rendered, with the `: ''` arm beside it unreachable. A player reads "+1 more" as
  "one further dye is near this one" when 121 others were ranked and the fourth simply was not
  drawn. It now counts further dyes still inside the **CLOSE** band (ΔE2000 ≤ 10, the match ramp's
  second cut), which is the question someone reading that line is actually asking.

  The threshold is measured, not guessed: against the real 125-dye set the EXACT cut (5) admits
  nothing at all — the tightest fourth-nearest neighbour anywhere is Ink Blue / Jet Black at 5.41 —
  so it would only have swapped one constant for another. At 10, forty dyes carry the line with n
  between 1 and 6 and eighty-five omit it; at the LOOSE cut (20) it fires for 122 of 125 with n as
  high as 33, which is noise rather than information.

- **`getLocalizedHarmonyType`'s English fallback table removed** (pkg-svg-bot-logic-08). It could
  never run: the key map covers all eight `HarmonyType`s so the lookup always returned first, and
  even on a missing key `Translator.t()` yields the raw key rather than `undefined`. The
  near-identical table in `getHarmonyTypeChoices` **stays** — that one is live, and deliberately
  English, because it feeds Discord's autocomplete choices.

- **`capGradientRows` runs once per `/gradient`, not twice** (pkg-svg-bot-logic-11). The second
  call recomputed the whole merge → filter → sort to read a `merged` count the first had already
  returned.

### Fixed — 2026-09-02 deep-dive audit

- `resolveCssColorName` returns `null` for inherited object keys (BUG-011). A colour
  named `constructor` or `__proto__` used to resolve to a function, so
  `/contrast dye1:constructor` threw inside the handler instead of answering with the
  localized "invalid colour" message.

## [3.0.0] - 2026-08-29

### ⚠️ BREAKING — chara-name privacy

`/swatch` no longer displays a character's name anywhere. `executeSwatch` no longer reads `character.nickname` (Ktisis nickname) or an attachment filename fallback — both the PNG card's title and the embed `title` in every branch now render the neutral, localized `card.swatchTitle` ("Character swatch" / DE/FR/JA/KO/ZH equivalents) instead. `SwatchResult.character` also no longer carries `nickname` (typed as `Omit<ResolvedCharaCharacter, 'nickname'>`). Players routinely name `.chara` exports "Firstname Lastname.chara" and use their real name as a Ktisis nickname; neither ever reaches a message or the returned character record now. Requires `@xivdyetools/svg` ≥ 3.0.0.

| Removed | Replacement |
|---|---|
| `SwatchInput.fileName?: string` | dropped — no replacement; the renderer never took a name |
| `SwatchResult.character: ResolvedCharaCharacter` | `character: Omit<ResolvedCharaCharacter, 'nickname'>` |

**Migration:** stop passing `fileName` into `SwatchInput`; if a caller read `result.character.nickname`, it must stop — the field is no longer present on the type or the runtime object.

### Fixed — 2026-08-29

- **`/dye` cards link somewhere real.** The share line was `https://xivdyetools.app/dye?stain=<stainID>`, but the web app has no `/dye` page and its share grammar reads `dye` / `dyes`, never `stain` — the link opened the app with nothing selected. It now points at the Comparison tool, the app's single-dye view: `https://xivdyetools.app/comparison?dyes=<stainID>`.
- The bot UI strings for `/preset` dye counts say "at least 3" / "3–6" in all six locales (presets-api 5.0 bounds; the bot enforced 2–5 before).

### Added — 2026-08-29

- **Every dye input accepts an id as well as a name.** `parseDyeIdInput` reads a bare number as a stainID (1–254) or a legacy item id (≥ 5729 — the ranges are disjoint), and `searchDyesByName`, `findDyeByName`, `resolveColorInput` and `resolveDyeInput` all route through it, so a dye option can carry a stainID (what the Discord autocomplete now sends), a legacy item id (what 4.x habits type), or a name in any of the six locales. `resolveColorInput` checks the id before hex, so `'101'` is Pure White while `'#101'` stays the colour — a bare 3-digit hex shorthand without `#` was the one ambiguity and it resolves in the id's favour.

## [2.1.0] - 2026-08-21

### Changed — 2026-08-22 (`/changelog` is bot-scoped)

- Locale strings `changelog.title` and `commands.changelog.description` (all six locales) now say the notes are the Discord bot's own — discord-worker's `/changelog` renders `apps/discord-worker/CHANGELOG-laymans.md` instead of the product-level root file. The zh description stays inside the SC font subset (`font-coverage.test.ts`).

### Added — 2026-08-21 security audit (FINDING-019)

- `escapeDiscordMarkdown()`, `sanitizeEmbedText(text, maxLength?)` and `ALLOWED_MENTIONS_NONE` (`src/discord-markdown.ts`): one sanitiser for every user-sourced string that lands in a bot-authored Discord message/embed — strips control / zero-width / bidi characters, collapses whitespace, defuses `@everyone` / `@here` / `<@…>` mentions, escapes inline markdown and masked links, caps length with an ellipsis. Both bots adopt it in their 2026-08-21 releases instead of re-implementing it.

### Added — 2026-08-20 i18n audit remediation

- `Translator.tc(key, count, vars?)` — count-aware lookup of `<key>_one` / `<key>_other` (falls back to the bare key). All six locale files carry both forms for `card.swatchFootKey`, `gradient.steps`, `card.gradVerdict`, `card.gradKeyCut`, `dye.search.foundCount` (replaces `foundCountPlural`) and `errors.rateLimited` (F-09).
- `searchDyesByName(query, locale)` / `findDyeByName(name, locale)` — English-or-localized dye lookup; `resolveColorInput` gains `options.locale`, `resolveDyeInput(input, locale)` (F-02).
- Every `execute*` input accepts `logger?: TranslatorLogger`, passed to `createTranslator` (F-13).
- ~160 new UI keys ×6 locales (`errors.*`, `copy.*`, `preset.*`, `preferences.*`, `stats.*`, `commands.<name>.description`, `budget.*`, `card.perDe`, `accessibility.allLenses`); the orphan gate enumerates the new template-key namespaces and a **reverse gate** now fails when a `t()`/`tc()` call site names a key en.json lacks (F-01).

### Fixed

- Twelve `execute*` failure paths returned hardcoded English `errorMessage` strings (F-06); `/dye info` MKT row uses `CONSOLIDATED_DYES[].names[locale]` (F-10).

## [2.0.0] - 2026-08-16

> **1.4.0 and 1.5.0 were never published to npm** (the registry has 1.3.0). This release ships everything from those two entries — the `/i18n` subpath and the `inverted-tetradic` harmony type — together with the 5.0 command rewrite below. Consumers upgrading from 1.3.0 should read all three entries.

The 5.0 bot release: every `execute*` now renders a card from `@xivdyetools/svg` 2.0.0's frame system, embeds collapse to one line (the PNG is self-contained; nothing is printed twice and no instruction is ever burned into an image), distances are ΔE2000 throughout, and two new commands (`/contrast`, `/swatch`) join the roster while `/match` leaves it. Consumers on the branch: `apps/discord-worker` 5.0.0, `apps/stoat-worker`.

### ⚠️ BREAKING

- **`executeMatch` removed** with `MatchInput`, `MatchResult`, `MatchEntry` (`commands/match.ts` deleted). The v4 `/match` command is gone; colour → dye matching now lives in the `/extractor color` sheet, which discord-worker drives directly against `@xivdyetools/svg`'s `generateNearestSheet`.
- **`executeAccessibility` is pair-based and routes on `vision`.** `AccessibilityInput.visionTypes?: VisionType[]` is replaced by `vision?: VisionType | 'all'` (a named lens → 13D, `'all'`/absent → 13E, a single dye → 13H regardless); `dyes` takes one or two entries (the 3–6 dye contrast matrix moved to `executeContrast`); new `theme` and `commandLabel` (`'/ACCESSIBILITY'` or `'/A11Y'` — the chip prints what the user typed). `AccessibilityResult.mode` is now `'lens' | 'all' | 'solo'` (was `'simulation' | 'contrast'`). `VISION_TYPES` gains `'achromatopsia'` as a full member.
- **`RandomResult.dyeInfos` removed** (its `RandomDyeInfo` type left `@xivdyetools/svg`); `dyes` and `title` remain. `RandomInput.count` is clamped to `ROW_CAP` (5).
- **`GradientStepResult` no longer extends svg's deleted `GradientStep`** — it is now `{ hex, dyeName?, dyeId?, dye?, distance }` with `distance` a ΔE2000 (was raw RGB). `GradientResult` gains `omittedRows`.
- **`MixerResult` reshaped**: gains `svgString` (the 12F sweep card — the mixer's first image) and `sweep: MixerSweepStop[]`; `matches[].distance` is ΔE2000 (was raw RGB). `blendedHex` / `matches` still describe the 50 % blend for adapters that surface a single colour.
- **`HarmonyResult` / `DyeInfoResult` / `ComparisonResult` embeds are one line** — `embed.description` is now a share URL (`/dye?stain=…`, `/harmony?dye=…&harmony=…`) or the closest-pair line; the per-dye lists, `footer` strings and the `dye.info.detailedInfo` copy are gone. Adapters that parsed the description must stop.
- **Every card-producing input gains `theme?: 'dark' | 'light'`** (`HarmonyInput`, `DyeInfoInput`, `RandomInput`, `GradientInput`, `MixerInput`, `ComparisonInput`, `AccessibilityInput`, `ContrastInput`, `SwatchInput`) — pass the user's stored preference; the default is dark.
- **Locale namespaces removed** (×6): `match`, `favorites`, `collection`, `language` — the v4 commands they served were deleted. `matchImage` / `matchImageHelp` stay for the live `/extractor image` and `/manual` topic.
- **Dependencies**: `@xivdyetools/bot-i18n` and `@xivdyetools/color-blending` are no longer dependencies (absorbed into `@xivdyetools/bot-logic/i18n` and `@xivdyetools/core/blending`); the package now depends only on `@xivdyetools/core`, `@xivdyetools/svg` and `@xivdyetools/types`. Requires `@xivdyetools/svg` ≥ 2.0.0 and `@xivdyetools/core` ≥ 4.0.0.

**Migration:** import the translator from `@xivdyetools/bot-logic/i18n`; drop `executeMatch` call sites; pass `theme` from preferences into every `execute*`; render `result.svgString` for the mixer as well; read `AccessibilityResult.mode` against the new union; and re-run `register-commands` (the Discord schema for `/accessibility`, `/budget`, `/swatch`, `/preferences` and the new `/contrast`, `/a11y`, `/changelog` changed — see the discord-worker changelog).

### Added

- **`executeContrast`** (`commands/contrast.ts`) — the new `/contrast` command (WCAG 1.4.11): 2–4 dyes → every pair once, worst first, `contrastRatio` from svg/core; the pair count routes the frame (13A one pair / 13B ledger / 13C·1 log-axis plot). Bands are named by their ratio — AA/AAA letter grades left the bot. Types `ContrastInput`, `ContrastDyeInput`, `ContrastResult`.
- **`executeSwatch`** (`commands/swatch.ts`) — the new `/swatch` command over a `.chara` character file: core's `parseCharaFile` + `resolveCharaColors` (lazy `CharacterColorService`), live slots only, merged eyes as one row (`+LR`) or heterochromia as two (`+L` / `+R`), OFF GRID detection (index colour vs live float), the lip's composited blend, full-scan ΔE2000 matching, `order: 'slots' | 'hardest'` (past five live slots the SAFEST match drops so both orders show the same rows), and `slot:` routing to the 14J·2 nearest sheet with that slot's colour as target. The embed carries what the PNG leaves out (off-grid hex pairs, lip raw-vs-blend, gear-dye stainIDs, dropped slots). Types `SwatchInput`, `SwatchSlotOption`, `SwatchResult`. Tests run on core's vendored `.chara` fixture corpus (`commands/__fixtures__/chara-fixtures.ts`).
- **Gradient**: `capGradientRows(steps)` (exported) — the R1 cap in three stages shared by both 12H frames: merge adjacent same-dye steps (range lead, worst ΔE), drop rows at ΔE 0.0 by value never by position (a bare-hex endpoint stays), then keep the five widest gaps in step order with the omitted count in the embed. Stage 0 (12H·4): ≥ 4 steps resolving to ≤ 2 rows collapses the card to the verdict frame (`card.gradVerdict`).
- **Mixer**: `MIXER_SWEEP_RATIOS = [25, 40, 50, 65, 80]` and `MixerSweepStop` — the sweep replaces the hard-coded midpoint; the best landing is flagged `best: true` and named in the embed.
- **Harmony**: ideal hues per type derived via `ColorService.rotateHue` (an internal per-type offset table), each found dye paired with its nearest ideal, the slot's angle label (`-30` reads as `330°`), each slot scored in the **chosen** matching method (not always ΔE2000), and the weakest-slot verdict composed as `angle · name · value` (a label overran the row in German). Base dye stainID share URL in the embed.
- **Dye info**: nearest-4 by ΔE2000 over the non-Facewear pool (three drawn, "+1 more"), localized SRC value (acquisition · price · currency via the new helpers), MKT value naming the consolidated Spectrum item + itemID (`CONSOLIDATED_DYES`), stainID on the card and in the share URL.
- **Comparison**: seven readouts for the two-dye duel (ΔE2000 / ΔEOK / ΔE76 / REDMEAN / RGB / DIST% / RATIO), `abbreviateDyeName` from core for the four-dye axes, `stainID` in the meta line; the embed names the closest pair.
- **Localization**: `getLocalizedAcquisition(acquisition, locale)` and `getLocalizedCurrency(currency, locale)` (core `TranslationProvider` wrappers, same per-locale instance cache as `getLocalizedDyeName`). `ResolvedColor` carries `stainID` (dye emojis are stainID-keyed end to end).
- **i18n** (`/i18n` locales, ×6, authored per language): the `card.*` namespace (93 keys — chip labels STAIN/SRC/MKT/NEAREST, tier words, ideal/found/band keys, gradient verdict/legend, mixer ratio key, a11y lens/shift/separation labels + `a11yVerdict` / `worstNote`, contrast RATIO/bands/floor/plot keys, comparison tags/keys, budget ledger `lTarget` / `lBoardOnly` …, swatch slot shorts / OFF GRID / `footKey`, `derivedNote`); `accessibility.achromatopsia`; `harmony.invertedTetradic`; `preferences.keys.theme` + `preferences.errors.invalidTheme`; `firstRun.*`; `changelog.*` (the new `/changelog` command); `manual5.*` (five new `/manual` topics with learn-more leads); `about.dyes` / `builtOn` / `attribution` / `removedTitle` / `removedBody`; `previewImage.*` + `webhook.previewImagePending` (moderator review of preset preview images).
- **Tests**: new suites for `/contrast`, `/swatch`, gradient/harmony branch coverage, fallback branches and uninitialised-locale paths; coverage 94.6 % → 96.9 % statements with thresholds at the 90 % baseline.

### Changed

- **Dead-code gate wired into `lint`** (2026-08-18 audit follow-up 6). `pnpm run lint` now ends in `lint:dead` (`knip --directory ../.. --workspace packages/bot-logic`) against the repo-root `knip.jsonc`, with `includeEntryExports` on: a barrel export (`src/index.ts`, `src/i18n/index.ts`) that no workspace imports fails the lint unless its specifier carries a `/** @public */` JSDoc tag. 31 specifiers were tagged — the `*Input`/`*Result` contract types plus `HARMONY_TYPES`, `getHarmonyTypeChoices`, `VISION_TYPES`, `isValidDiscordSnowflake`, `isValidHex`/`normalizeHex`, `getLocalizedCurrency`, `LocaleData`, `TranslatorLogger`. Comments only — no runtime change.
- **`executeHarmony` / `executeGradient` default `matchingMethod` is `DEFAULT_MATCHING_METHOD` (ΔE2000)**, not `'oklab'` — the two places bot-logic still carried the retired v4 default. A caller that passes nothing now gets the suite default (the discord-worker handlers pass an explicit method anyway); `MixerInput.matchingMethod` doc corrected to match its real ΔE2000 default
- All `execute*` distances are ΔE2000 via `ColorService.getDistanceForMethod` (`getColorDistance` / `getMatchQualityInfo` in `color-math.ts` remain exported but no command uses them any more).
- `executeHarmony`, `executeDyeInfo`, `executeRandom`, `executeGradient`, `executeMixer`, `executeComparison`, `executeAccessibility` call the 5.0 generators (`generateHarmonyCard`, `generateDyeInfoCard` 11B, `generateRandomDyesGrid` 11B, `generateGradientCard`, `generateMixerCard`, `generateComparisonCard`, `generateA11yCard`) with translated `labels` and the user's `theme`.
- Accessibility simulation stays the Brettel path; separation is ΔE2000 between the **simulated** colours; the verdict sentence rides the embed (where it does not cost a lens row).
- `MODERATOR_IDS` grammar (`parseModeratorIds` / `isModeratorId` / `isValidDiscordSnowflake`) is unchanged and remains the single parser for both bot workers.
- Docs: `CLAUDE.md` / `README.md` synced to the 5.0 command list (`contrast.ts`, `swatch.ts`; `match.ts` gone) and the Tier 1 dependency set.

### Removed

- `commands/match.ts` (+ tests) and its barrel exports; the emoji match-quality labels in mixer/gradient embeds; the multi-line embed builders in every command; the `match` / `favorites` / `collection` / `language` locale namespaces.

### Removed (2026-08-18 dead-code audit)

- **245 unread keys pruned from all six `/i18n` locale files** (621 → 376 leaf keys each immediately after this task's prune; 374 once Task 7's later `meta.flag`/`meta.nativeName` trim is folded in; key-set parity preserved) — 209 orphans (never referenced outside a test file, across `packages/bot-logic/src`, `packages/svg/src`, `apps/discord-worker/src`, `apps/stoat-worker/src`) plus 36 test-only keys (referenced only from a test's mock translation table). Whole namespaces removed: `swatch.*` (37 — the 4.x `/swatch color|grid` shape, superseded by the `.chara`-driven 5.0 `/swatch`), `stats.*` (31 — controller ruling: `/stats` stays hard-coded English, not localized), `paletteGrid.*` (9), `preferences.descriptions.*` (14); `budget.*`, `mixer.*`, `preset.*`, `common.*`, `comparison.*`, `extractor.*` trimmed to their live subset. See `docs/audits/2026-08-18-discord-worker-dead-code/findings/DEAD-011.md`.
- Matching dead entries removed from test mock tables: `about.test.ts`'s `about.cmd.*` (17 keys, incl. the already-deleted v4 `/match`, `/favorites`, `/collection`, `/language`, `/stats`) and `about.categories.userData`; 14 `accessibility.*` mocks + `comparison.fails`/`comparison.title` in `accessibility.test.ts`/`comparison.test.ts`; `dye.random.descriptionUnique` in `dye.test.ts`; `preset.moderation.accessDenied` in `preset.test.ts`.
- `meta.locale` / `meta.name` / `meta.flag` / `meta.nativeName` were **kept at the time** (unlike the rest of the test-only/orphan set) — the whole `meta` block was required by `LocaleData` and asserted by `locales.test.ts`'s "valid meta block" check; `meta.flag` / `meta.nativeName` became genuinely dead once `Translator.getMeta()` itself was removed — see Task 7 below.
- New gate: `src/i18n/__tests__/locale-orphans.test.ts` — fails if any `en.json` key is unreachable (literal scan over the same four consumer trees, plus an explicit enumeration of the dynamic keys those trees build at runtime rather than a prefix allowlist: `accessibility.${lens}` for each of bot-logic's own `VISION_TYPES`, `preferences.keys.${key}` for discord-worker's `PREFERENCE_ORDER` plus the separate `filters` key, `manual5.topics.${topic}.{name,body}` for discord-worker's `TOPIC_KEYS`, and the exact `meta.locale`/`meta.name`) and asserts key-set parity across all six locales, so this class of drift cannot regrow silently.

### Removed (2026-08-18 dead-code audit, Task 7 — Wave 3a)

- **`color-math.ts` deleted** (DEAD-012, +its test, +3 barrel lines): `getColorDistance` / `getMatchQualityInfo` / `MatchQualityInfo` were a dead delegate to core's `ColorService.getColorDistance` / `classifyMatchDistance` — zero non-test callers (the docblock's "used by match, mixer, and gradient" claim was false; `/match` left the bot in 5.0 and neither mixer nor gradient imported it). `apps/discord-worker/src/handlers/commands/gradient.ts`'s inline quality ladder (distinct, off-by-one thresholds — `<10`/`<25`/`<50` vs. core's inclusive `<=10`/`<=25`/`<=50`) now calls `classifyMatchDistance` from `@xivdyetools/types` directly through a small `quality.*` locale-key map, so the bot and web app agree on match-quality boundaries; the `quality.*` keys stay live via that map.
- **`MixerResult` reshaped** (DEAD-013): `matches` (the "legacy shape" 50%-blend nearest-dye list), `blendedHex`, `inputDyes`, `MixerMatch`, and `MixerInput.count` are gone — `apps/discord-worker/src/handlers/commands/mixer-v4.ts` only ever read `svgString`/`embed`, and the `count`-sized extra nearest-dye search loop was pure wasted work per `/mixer` call. `sweep: MixerSweepStop[]` is kept (it feeds the 12F card's rows). discord-worker's own `count` resolution (`resolveCount`/`explicitCount`) and the `/mixer` command's `count` schema option are removed with it (the option existed solely to feed the deleted loop); the general `/preferences set count` preference (`resolveCount`, `PREFERENCE_DEFAULTS.count`, `UserPreferences.count`, `PreferenceKey`) is untouched — it is a separate, generically-documented preference outside this finding's scope, now simply without a production reader.
- **`Translator.getMeta()` deleted** (0 callers) along with `meta.flag` / `meta.nativeName` from `LocaleData` and all six `/i18n` locale files (`meta.locale` / `meta.name` are kept — `locales.test.ts`'s "valid meta block" check and the orphan gate's `META_KEYS` allowlist were narrowed to match, key-set parity preserved across all six locales).
- **3 redundant core-type re-exports removed from `src/index.ts`**: `HarmonyColorSpace`, `BlendingMode`, `MatchingMethod` — every consumer already imports them from `@xivdyetools/core` / `@xivdyetools/core/blending` directly. The matching pure pass-throughs in `commands/harmony.ts` (`export type { HarmonyColorSpace }`) and `commands/gradient.ts` (`export type { MatchingMethod }`) are deleted too (`commands/mixer.ts`'s `export type { BlendingMode, ResolvedColor }` is kept — `mixer.test.ts` imports `BlendingMode` from it directly).
- The `@xivdyetools/test-utils` devDependency removal (also listed in DEAD-013) shipped in Task 6.

### Removed (2026-08-18 dead-code audit, Task 13 — Wave 4a)

- **DEAD-037**: `commands/accessibility.ts`'s local `VISION_TYPES` (the 4 simulated colourblind lenses, typed against `@xivdyetools/svg`'s `VisionType`) gains a compile-time bidirectional check against `@xivdyetools/types`' 5-member `VisionType` union minus its `'normal'` baseline, so the two cannot silently drift apart. No data moved — the register's two `VISION_TYPES` copies (here and web-app's `accessibility-tool.ts`) have different element shapes and one excludes the baseline lens, so they were never a byte-identical duplicate to consolidate into a shared table.

## [1.5.0] - 2026-08-01

### Added

- `inverted-tetradic` harmony type on the `/harmony` command (mirror rectangle of tetradic, via core's new `findInvertedTetradicDyes`) with localized labels in all six bot locales. Requires re-running the slash-command registration to publish the new choice.

## [1.4.0] - 2026-07-30

Monorepo 2.0 Tier 1 package consolidation.

### Added

- Absorbed `@xivdyetools/bot-i18n` v1.2.1: the `Translator` engine, `LocaleCode` types, and the six bot-UI locale files now live at `@xivdyetools/bot-logic/i18n`. The standalone `@xivdyetools/bot-i18n` package is retired — the API is identical, only the import specifier changes.

## [1.3.0] - 2026-07-19

2026-07-18 audit remediation (Sprints 4 & 5).

### Added

- **`moderators` module** (BUG-073 / REFACTOR-010 partial): `parseModeratorIds` (whitespace/comma separators + Discord snowflake validation), `isModeratorId`, `isValidDiscordSnowflake` — one shared MODERATOR_IDS grammar consumed by both discord-worker and moderation-worker, ending the parser drift that could silently lock all moderators out.

### Changed

- **REFACTOR-004**: `getMatchQualityInfo` delegates to the shared `classifyMatchDistance` from `@xivdyetools/types`; emoji display metadata stays local.
- Match results are sorted by the displayed metric (Sprint 4) so the ordering shown in embeds matches the deltas printed on them.

## [1.2.0] - 2026-04-03

### Added

- `dyeFilters?: DyeTypeFilters` optional parameter on `MatchInput`, `HarmonyInput`, `GradientInput`, and `MixerInput` interfaces
- Dye filtering applied in all 4 execute functions when filters are provided
- 8 unit tests for filter integration

---

## [1.1.2] - 2026-03-01

### Added

- `@xivdyetools/types` as explicit dependency — previously relied on transitive resolution through `@xivdyetools/core`

### Changed

- Migrate `Dye` type imports across 8 files from `@xivdyetools/core` to `@xivdyetools/types`; `HarmonyOptions` and `HarmonyColorSpace` remain on core (DEAD-047 Phase 2)
- Remove `baseName` from `generateHarmonyWheel()` call — option removed from `@xivdyetools/svg` (DEAD-081)

## [1.1.1] - 2026-03-01

### Changed

- Removed `resolveCssColorName` from barrel export — internal helper, not part of public API (DEAD-036)
- Marked `HARMONY_TYPES` and `VISION_TYPES` constants as `@internal` (DEAD-037)
- Marked `EmbedData`, `EmbedField`, and `ResolveColorOptions` types as `@internal` (DEAD-038–040)
- Cleaned up stale REFACTOR-001/002 comment markers from `color-math.ts` and `index.ts` (DEAD-041)

## [1.1.0] - 2026-02-21

### Added

- Comprehensive test suite — 193 tests across 10 files covering input resolution, CSS colors, localization, and all 8 commands
- **REFACTOR-001**: New `color-math.ts` shared utility module with `getColorDistance()` delegating to `ColorService.getColorDistance()` from core
- **REFACTOR-002**: New `getMatchQualityInfo()` with consistent tiers and i18n key lookup, plus 9-test suite

### Changed

- **REFACTOR-001**: Consolidate duplicated `getColorDistance()` across match, mixer, and gradient commands into shared `color-math.ts`
- **REFACTOR-002**: Consolidate duplicated match quality thresholds across match, mixer, and gradient commands into shared `getMatchQualityInfo()`

## [1.0.0] - 2026-02-18

### Added

- Extracted platform-agnostic command logic from the Discord worker into a shared package
- `executeDyeInfo` — dye info card generation (SVG + embed data)
- `executeRandom` — random dyes grid generation
- `executeHarmony` — color harmony wheel with 7 harmony types
- `executeGradient` — gradient bar between two colors with configurable interpolation
- `executeMixer` — color blending with 6 modes (RGB, LAB, OKLAB, RYB, HSL, Spectral)
- `executeMatch` — find closest dyes to a target color
- `executeComparison` — side-by-side dye comparison grid
- `executeAccessibility` — colorblind simulation + WCAG contrast matrix
- Input resolution: `resolveColorInput`, `resolveDyeInput`, `isValidHex`, `normalizeHex`
- CSS color name resolution (148 standard CSS colors)
- Localization helpers: `initializeLocale`, `getLocalizedDyeName`, `getLocalizedCategory`
- Shared `EmbedData` / `EmbedField` types for platform-agnostic embed construction
- All commands return discriminated unions (`{ ok: true; ... } | { ok: false; error; errorMessage }`)

---

[1.0.0]: https://github.com/FlashGalatine/xivdyetools/releases/tag/bot-logic-v1.0.0
