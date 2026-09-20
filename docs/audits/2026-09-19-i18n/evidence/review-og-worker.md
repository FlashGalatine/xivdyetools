# i18n review — og-worker (2026-09-19)

## Scope / method

Read the reviewer brief, then `git log --since=2026-09-03 --stat -- apps/og-worker` (18
commits). New surface since the last audit is entirely the **harmony colour-wheel**
feature (`?wheel=`, 5928d7c3 / 4f0f20d8 / 0d82c5cb / ca9ae8f5) and the **mixer**
one-implementation-per-mode rename (1f4ba727 / d8fed13b). `og-strings.ts` and
`og-embed.ts` have **zero** commits since 2026-09-03 — the new wheel feature added no
new card/embed string tables, it only reused `getLocalizedColorWheelName` (core) and the
non-localized `COLOR_WHEEL_TAGS` identifier map (core, contract-tested
`/^[A-Z·-]+$/` in `registry.test.ts`).

## Module map traced

- `src/services/svg/harmony.ts` — deck (`baseName · harmonyName [· wheelName]`),
  footRight (`algoTag [· WHEEL_TAG]`), band roles/names/tags. Wheel name in the deck is
  `getLocalizedColorWheelName()` (core, 6-locale, en-fallback via
  `TranslationProvider.getColorWheelName`); footRight's wheel identifier is deliberately
  the non-localized tag (comment at harmony.ts:190-196: "never a translated word: the
  two cards have to be comparable across locales").
- `src/services/svg/mixer.ts` — no mode name is drawn on the card at all (mode only
  changes the blended hex); `algoTag` only.
- `src/og-data-generator.ts` — traced all 9 tool cases + root/fallback. `harmony` case
  (line 812-821) reads and validates `wheel` via `parseWheel`, threads it through both
  `appUrl`/`withWheel` (share URL) and the image URL. `withWheel` (line 130-137) elides
  the default exactly like `withAlgo`/`withMode`/`withLang` do.
- `src/services/translator.ts` — `getLocalizedColorWheelName` (line 50-52) is a thin
  wrapper over core's stateless `TranslationProvider`, same fallback chain
  (`requested → en → raw id`) as harmony-type/dye-name lookups.
- `src/services/font-coverage.test.ts` `stringsFor()` (line 148-158) spreads the ENTIRE
  core locale JSON (`{meta, locale, ...rest}` — `rest` includes `colorWheels`) plus
  `OG_DECK`/`TOOL_TAG`/`OG_DECK_LINE`/`OG_ROLE`. Colour-wheel names are covered
  automatically because they're part of the core locale blob, not because anyone added
  a line for them — confirmed by commit `ca9ae8f5` regenerating the JP/KR/SC subsets
  specifically "for the colour-wheel names".
- `src/services/og-embed.ts` (`OG_EMBED`) — harmony's crawler description
  (`harmony.description` / `harmony.descriptionNoDye`) has no wheel placeholder in any
  locale; a shared link on a non-default wheel unfurls a description that never says
  which wheel chose the dyes, while the picture beneath it does (footRight tag). Not a
  wrong-language defect, a completeness gap — see cand-1.

## Share-URL parameter parity (web-app → og-worker)

Cross-checked `apps/web-app/src/services/share-service.ts`'s `HarmonyShareParams` /
`ExtractorShareParams` against `apps/og-worker/src/og-params.ts` and
`og-data-generator.ts`'s per-tool cases:

- `wheel` (harmony): parsed, validated (`parseColorWheelId`, folds case), rendered
  localized in the deck, comparable tag in the footer, cache-keyed only on the route
  that reads it (`BUG-018` fix, `9963891f`). No gap.
- `perceptual` (harmony): web-app always emits it; og-worker never reads it
  (`OG_ALLOWED_QUERY_KEYS` excludes it by deliberate security ruling S7-R7/R10,
  documented in `harmony.ts:104-109` and `apps/og-worker/CLAUDE.md`). This is a
  data-accuracy trade-off already reasoned through, not an i18n defect — REJECTED.
- `colors` (extractor, restored 2026-09-17 web-app commit `3eaca5a7`): og-worker's
  `/extractor` crawler case and `/og/extractor/:colors.png` route already existed and
  needed no change — verified the exact grammar match (`EXTRACTOR_SHARE_COLOR` in
  web-app's `share-service.ts:196` is byte-identical to og-worker's parse regex in
  `og-data-generator.ts:905-906`). No gap.

## `?lang=` plumbing

`resolveLocale()` (`index.ts:548-552`) → core's `extractLocaleCode()`: case-folds and
strips region (`?lang=JA` → `ja`, `?lang=zh-CN` → `zh`), unknown → `en`. Matches the
documented cache-key collapsing rule ("`?lang=EN`, `?lang=en-US`, and a missing `lang`
all share the `en` card's entry"). `appUrl()`/`withLang()` are applied on all 15 `url:` /
`imageUrl:` sites in `og-data-generator.ts` (verified by reading every generator
function) — the 2026-09-03-era gap (`I18N-002`, root/fallback URLs) is already closed
and I found no new URL construction site added since that bypasses `withLang`.

## Findings

| cand-id | tier | file:line | locale(s) | claim | evidence |
|---|---|---|---|---|---|
| cand-1 | P3 | `apps/og-worker/src/services/og-embed.ts` (harmony.description / harmony.descriptionNoDye, all 6 blocks) | all | A shared harmony link on a non-default wheel (`?wheel=munsell`) unfurls a crawler description that never names the wheel, while the card image's footer does (`ΔE2000 · MUNS`) — description and picture disagree on completeness, not language | traced `generateHarmonyOGData` (`og-data-generator.ts:270-288`): `description: embed('harmony.description', locale, {harmony, dye, hex})` — no `wheel` var; compare to `harmony.ts:184-196` where the deck/footer DO carry it |
| cand-2 | ? / P3 | `apps/og-worker/src/services/svg/harmony.ts:184-187` | de, fr | `deck = ${baseName} · ${harmonyName} · ${wheelName}` can be long for German/French (`Split-Komplementär-Harmonie` + `OKLCH-Farbton (wahrnehmungsgleiche Abstände)`); `fit()` ellipsises so nothing overflows the frame, but a truncated deck could clip the wheel name to unreadable — not verified by rendering, flagging as unconfirmed | `band.ts` `fit()` (line 250-258) is the only guard; no dedicated test renders this specific long-string combination (`harmony.test.ts` wheel cases use short EN names) |

## POSITIVE (should not be re-filed)

- Colour-wheel name in the deck goes through core's stateless `TranslationProvider`
  (`translator.ts:50-52`), same requested→en→id fallback chain as harmony-type/dye
  names; all 5 wheel ids present and well-translated in all 6 core locale files
  (spot-checked, incl. French `RJB` — a real, correct localization of RYB, not a
  transliteration miss).
- `font-coverage.test.ts`'s `stringsFor()` picks up new core-locale keys (colour wheels)
  automatically via the whole-blob spread — no test maintenance was needed for the new
  vocabulary, and the JP/KR/SC subsets were regenerated for it (`ca9ae8f5`).
- `withWheel`/`withAlgo`/`withMode`/`withLang` all follow one default-elision pattern
  consistently, including the newest one (`wheel`) — cache-key and URL-echo hygiene kept
  pace with the new parameter.
- Extractor's restored share link (web-app 2026-09-17) required zero og-worker changes;
  the grammar the two sides agree on was already byte-identical.
- `?lang=` normalization (case fold, region strip, unknown→en) is correct and matches
  the documented cache-collapsing behaviour; no new URL-construction site bypasses
  `withLang`.
- `og:locale:alternate` / `hreflang` are correctly absent — there is one URL per card
  (locale selected by query param, not a per-locale path), so there is no alternate URL
  to declare; the same reasoning is already on record for web-app
  (`docs/audits/2026-08-20-web-app-i18n/FONT_SUBSET_AUDIT.md:52`).

## REJECTED (checked and dropped)

- `?perceptual=` silently ignored on harmony share links — deliberate security ruling
  (S7-R7/R10), documented inline, not an i18n defect.
- `footRight` wheel tag (`RYB`, `MUNS`, …) not localized — contract-tested
  non-localized identifier by design (`ColorWheel.ts` `COLOR_WHEEL_TAGS`,
  `registry.test.ts` pins the `^[A-Z·-]+$` shape); same house style as `ALGO_TAG`.
- Mixer mode name not drawn on the card — mode only changes the mix math, nothing to
  localize; consistent with "Spectral"-class deliberately-English tags already settled.
- `docs/reference` and locale-file structural parity — not re-diffed; brief says the
  gates cover this and `og-strings.test.ts` already pins `OG_EMBED` key/placeholder
  parity across all 6 locales.
- `extractLocaleCode('zh-CN')`'s stale JSDoc example (claims `null`, code actually
  returns `'zh'`) — lives in `packages/core`, not this unit; not filed here.

## COVERED

Files opened: `src/services/svg/harmony.ts`, `src/services/svg/mixer.ts`,
`src/og-data-generator.ts`, `src/og-params.ts`, `src/services/translator.ts`,
`src/services/og-embed.ts`, `src/services/og-strings.test.ts`,
`src/services/font-coverage.test.ts`, `src/index.ts` (locale/query-key sections),
`apps/og-worker/CLAUDE.md`, `apps/web-app/src/services/share-service.ts`,
`apps/web-app/src/components/extractor-tool.ts` (commit diff only),
`packages/core/src/services/localization/TranslationProvider.ts`,
`packages/core/src/services/LocalizationService.ts`,
`packages/core/src/services/dye/wheels/ColorWheel.ts`,
`packages/core/src/data/locales/{en,ja,de,fr,ko,zh}.json` (harmonyTypes + colorWheels
keys only, via script, not full diff). **14 files.**
