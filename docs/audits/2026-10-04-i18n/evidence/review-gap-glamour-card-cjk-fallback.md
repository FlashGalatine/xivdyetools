# Review: gap-glamour-card-cjk-fallback (/glamour card English fallback for item names)

## Mechanism (HEAD)
- `packages/bot-logic/src/commands/glamour.ts:431` puts `canDraw(p.name) ? p.name : p.nameEn` on each card row;
  `nameEn = picked.names.en` (`:277`). `canDraw` doc at `:99-104` states the design: card falls back to English, embed keeps the localized name.
- `apps/discord-worker/src/handlers/commands/glamour.ts:149-150`: `canDraw: (text) => filterToRenderable(text).dropped === 0`.
- `font-coverage.ts` `filterToRenderable`: a codepoint is drawable if it is in the **union of the cmaps of all ten bundled TTFs** (or tab/LF/CR/space). Not per-locale: the union is 2,486 codepoints. Whole-name rule: one undrawable codepoint sends the whole name to English.
- Embed keeps the localized name: `glamour.ts:451` (`glasses = localName(...)`), `gposersList(pieces, glasses)` uses `p.name` (`:325`), notes use `plain(p.name)` (`:457-469`). Confirmed. Test `packages/bot-logic/src/commands/glamour.test.ts:225-238` asserts card = English and embed contains the ja name.
- `subset-cjk-fonts.py:103-170` inputs: core locale JSON, bot UI locale JSON, `consolidated-ids.ts` names. No item names, so subsets (JP 644, SC 1,234, KR 594 codepoints) hold only dye/UI vocabulary.

## Measurement (fontTools, subset cmaps read from `apps/discord-worker/src/fonts`)
Corpus = `apps/api-worker/src/chara/data/item-names.{ko,zh}.json`; its meta says these are equippable rows only (`equippable` 28,993), so (a) already is the equipment-only set.

| locale | names | undrawable by union rule (fall back to EN) | share |
|---|---|---|---|
| ko | 28,986 | 18,120 | **62.5%** |
| zh | 28,992 | 28,223 | **97.3%** |
| ja | no item-name corpus in the tree | not measurable | n/a |

- KR face alone / SC face alone give the same counts as the union, so which face covers which locale does not change the result.
- Missing: 363 distinct Hangul syllables (ko), 1,171 distinct hanzi (zh), e.g. ko 걸 살 찌 왕 국, zh 敌 裤 靴 咒 长.
- ja: only 4 real ja item names exist in tests (`ヘンプコイフ`, `ヴィエラ・脚甲`, `エンペラーリング`, `ローズ`); all drawable. That is too few to give a rate. Evidence the rate will not be small: the union lacks 48 of the 168 basic kana (e.g. ふ ひ ね ぬ ろ ゆ ゲ ゾ ヌ ヨ ヲ ヶ) and most kanji outside dye vocabulary (probe: 輪 呪 杖 missing). ja kanji names (rings, staves, "…の杖") will fall back; katakana-only names mostly will not.
- Caveat: percentages are per catalog item, not weighted by what players actually wear.

## Decision record search
- `git grep BUG-030`: BUG-030 (2026-09-02 deep dive) is the `/preset` user-text tofu; `font-coverage.ts` header and `discord-worker/CHANGELOG.md:569` describe render-what-you-can + embed-carries-original for `/preset`. Nothing records the `/glamour` item-name fallback rate or accepts it; the glamour-reader spec/plan (`docs/superpowers/specs/2026-09-27-glamour-reader-design.md`, plans) say nothing about it. Only the `canDraw` doc comment and the one unit test state the behavior.
- The glamour-reader work also never asked for item names in the subsets (CHANGELOG:149 re-cut only for card strings).

## Origin
`git log 8ecb878f..HEAD` on the four files: empty. Origin MAIN; introduced with `/glamour` in `bfd393e7`.

## Verdict
I18N P2 (not P3 FONT: no tofu is drawn, the fallback works as designed). A `/glamour` card in ko is 62% English item names and in zh 97% English, with the localized name only in the embed; no record accepts this. Remedies: add item-name codepoints to the subsets (size cap, discord-worker 3 MiB gzip; zh needs +1,171 hanzi, ko +363 Hangul), or record the English card as accepted with these numbers.

## Positive controls
- The fallback is fail-safe: no tofu, localized name kept in embed, test covers it.
- Union-vs-own-face check done (identical results). Latin item names always drawable.

## Rejected
- "Union counts incorrectly across locales": it is deliberate and result-neutral here.

## Files covered
`packages/bot-logic/src/commands/glamour.ts` (+test), `apps/discord-worker/src/handlers/commands/glamour.ts` (+test), `services/font-coverage.ts`, `scripts/subset-cjk-fonts.py`, the three Subset TTFs and all ten fonts' cmaps, `apps/api-worker/src/chara/data/item-names.{ko,zh,meta}.json`, `regional-names.ts`, CHANGELOGs, audit docs for BUG-030.
