# bot-logic i18n review — 2026-09-19

## Module map

- `packages/bot-logic/src/i18n/locales/{en,ja,de,fr,ko,zh}.json` — hand-edited UI strings.
  Diffed `cf79ac9f..HEAD`: 6 files, 485 insertions / 341 deletions, almost entirely the
  `/manual` key family (10 new topic entries: comparison, contrast, accessibility, budget,
  presetBrowse, presetShare, presetFavorite, changelog, stats; plus a rewrite of `extractor`,
  `harmony`, `mixer`, `gradient`, `swatch`, `preferences`, `dyeSearch`, `dyeInfo`, `dyeList`,
  `manualCmd`, `matchImageHelp`, and the two `manual5.topics` bodies for `matchingMethods` /
  `characterFile`), plus new `cardVotes_one`/`_other` plural keys and colon normalization
  (half-width `:` → full-width `：` in ja/zh non-code prose).
- `packages/bot-logic/src/i18n/translator.ts` — `Translator.t()` / `.tc()` engine.
- `packages/bot-logic/src/i18n/locale-resolution.ts` — Discord-locale → app-locale ladder.
- `packages/bot-logic/src/input-resolution.ts` — `resolveColorInput`/`resolveDyeInput`/
  `searchDyesByName`, locale-aware dye-name matching.
- `packages/bot-logic/src/i18n/locales.test.ts`, `__tests__/locale-orphans.test.ts`,
  `translator.test.ts`, `locale-resolution.test.ts` — the four gates.
- Light pass: `apps/moderation-worker/src/services/bot-i18n.ts` (still English-only by
  explicit code comment, `strings: LocaleData = enLocale`), `apps/stoat-worker/src/commands/
  info.ts:38` (`const locale: LocaleCode = 'en'; // TODO: resolve from user preferences` —
  unchanged, still parked).

## Method

`git diff cf79ac9f..HEAD -- packages/bot-logic/src/i18n/locales/<lc>.json` read in full for
all six locales. Game nouns (harmony types, colour wheels, dye categories) cross-checked
programmatically against `packages/core/src/data/locales/<lc>.json`. Placeholder parity
(`{x}` sets per key) checked programmatically across all ~620 keys × 6 locales — zero
mismatches. Half-width-punctuation-in-CJK-prose checked programmatically on every changed
ja/zh value; the only hits were digit ratios (`3:1`), code/backtick spans, and markdown list
markers (`1.`/`2.`) — all legitimate, none are prose punctuation bugs. `resolveDyeInput`/
`resolveColorInput` locale threading traced end-to-end from every discord-worker command
handler that calls it.

## Candidates

| cand-id | tier | file:line | locale(s) | claim | evidence |
|---|---|---|---|---|---|
| BL-01 | P3 | packages/bot-logic/src/i18n/locales/de.json:207 | de | `/about` embed's "powered by" field reads literal English "Powered by Cloudflare Workers" for German users; ja/fr/ko/zh all translated the phrase (keeping the Cloudflare Workers brand name, translating "powered by"/"propulsé par"/"기반"/"提供支持"). Pre-existing, not touched in this diff window. | read all 6 `about.poweredBy` values via `packages/bot-logic/src/i18n/locales/*.json` |
| BL-02 | P2 | packages/bot-logic/src/i18n/translator.ts:104 | fr | `tc(key, 0)` always resolves to the `_other` suffix (`count === 1 ? 'one' : 'other'`), but French CLDR treats 0 as singular. `preset.cardVotes` is called with `preset.vote_count` at `apps/discord-worker/src/handlers/commands/preset.ts:1010`, which is a real `0` for any unvoted preset (not `undefined` — only `undefined` skips the call) — a French user viewing a fresh preset's card sees "0 votes" (`cardVotes_other`) instead of the grammatically-correct "0 vote". `translator.test.ts` only asserts "_one for exactly 1, _other otherwise (en)" — no fr/CLDR-aware plural test exists. | read translator.ts tc(); traced preset.ts:1010 call site; read `translator.test.ts` plural test names |
| BL-03 | P3? | packages/bot-logic/src/i18n/locales/zh.json:625 vs ja/de/fr/ko:625 | zh | `/manual` topic heading `manual5.topics.spectrumPrices.name` is "染剂合并与价格" (Dye Consolidation & Prices) in zh, while ja/de/fr/ko all keep "Spectrum" transliterated/literal ("スペクトラムと価格" / "Spectrum & Preise" / "Spectrum et prix" / "스펙트럼과 가격") to match the in-game "Spectrum Dye" item family name. Unchanged in this diff (pre-existing); flagging as a cross-locale term inconsistency, not clearly wrong since zh's choice is arguably clearer. | read `manual5.topics.spectrumPrices.name` across all 6 locale files |

## POSITIVE

- `/manual` harmony-type list, colour-wheel names, and dye-category names in every one of
  ja/de/fr/ko/zh now match `packages/core/src/data/locales/<lc>.json` exactly — verified
  programmatically (e.g. ja: 補色/類似色/三色配色/…/シェード; ko: 보색/유사색/…/명암; de:
  Komplementär/…/Schattierungen all identical to core).
- Placeholder parity is perfect: every `{x}` in every en.json value is present, with the
  same name, in all five other locales (checked all ~620×6 leaf strings programmatically).
- `{topic}`/`{topics}` in `matchImageHelp.matchQualityRatingsContent` and
  `manual.manualCmd.description` are filled with **emoji** (from `MANUAL_TOPICS[].emoji`),
  not text — `apps/discord-worker/src/handlers/commands/manual.ts:108,277` — so there is no
  untranslated-topic-name risk despite the literal English word "topic"/"{topics}" sitting
  next to it in the source string.
- Localized dye-name input resolution (`resolveColorInput`/`resolveDyeInput` →
  `searchDyesByName`, `packages/bot-logic/src/input-resolution.ts:53-67`) is correctly
  locale-threaded from every discord-worker command handler (`comparison.ts`, `contrast.ts`,
  `extractor.ts`, `gradient.ts`, `harmony.ts`, `mixer-v4.ts`, `accessibility.ts`) via
  `t.getLocale()` — a Japanese/German/etc. user typing a localized dye name will match.
- French `card.offGridShort` = "HORS G." (abbreviated, unlike ja/de/ko/zh's full-length
  equivalents) is intentional and matches the just-updated `manual5.topics.characterFile.body`
  prose ("marquées HORS G.") — commit `e94f8fd4`'s "HORS G." fix; not a truncation bug.
- ja/zh punctuation in all changed `/manual` prose correctly uses full-width `：`/`。`/`、`
  (colons were bulk-converted from half-width in this diff); no half-width punctuation
  leaked into real CJK sentences (only into ratios/code/list markers, which is correct).
- `discordLocaleToLocaleCode` (`locale-resolution.ts:90`) correctly maps `zh-TW`→zh, `zh-CN`→zh,
  `en-GB`→en, and falls through unmapped locales (`pt-BR`, `es-ES`, `ru`) to the next rung
  rather than silently mis-mapping — confirmed by `locale-resolution.test.ts`.

## REJECTED

- Command-syntax literals (`` `/comparison <dye1> <dye2> [dye3] [dye4]` `` etc.) identical
  across all 6 locales — deliberate: Discord option names are fixed ASCII identifiers, not
  translatable prose (matches the do-not-refile "codes/tags" rule).
- `matchImageHelp.supportedFormatsContent` ("PNG/JPG/JPEG/GIF/WebP/BMP") identical across
  all locales — file-format names, not translatable.
- `about.title` "XIV Dye Tools Bot" / `firstRun.title` "XIV Dye Tools 5.0" identical across
  all locales — product name, deliberately untranslated (matches brand-name carve-out).
- ja/zh half-width-punctuation grep hits were all inside ratios (`3:1`), backtick code
  spans, or markdown numbered-list markers (`**1. 画像分析**`) — not sentence punctuation.
- moderation-worker / stoat-worker: no locale-relevant commits since `cf79ac9f`; both
  confirmed still in their settled states by direct source read, not just changelog trust.
- `resolveDyeInput` in `input-resolution.ts` has no direct discord-worker call site (only
  stoat-worker and re-exports) — not a bug, discord-worker command handlers all go through
  the locale-aware `resolveColorInput` wrapper instead.

## COVERED

6 locale JSON files (en/ja/de/fr/ko/zh) fully diffed and read; 4 i18n engine/gate source
files read in full; 2 settled-status app files spot-checked; ~15 discord-worker command
handler call sites grepped/read for locale threading.
