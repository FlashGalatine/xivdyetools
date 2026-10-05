# Review: og-worker + svg + fonts (2026-10-04 i18n audit)

Revisions: BASE 5c80fcba -> HEAD. No og-worker / svg / font change exists in MAIN..HEAD (open PRs
touch none of these paths), so every candidate below has origin MAIN (glamour card landed 975175da /
5f0763ec, 2026-09-28).

## Candidates

| id | tier | where | claim |
|---|---|---|---|
| FONT-1 | P3 | packages/svg/src/glamour-card.ts:211,237,239 | look-count line (`+{n} OPTIK` / `ONE LOOK` ...) is set at 10.5 px; the frame's type floor is `CARD_TYPE.label = 11` (frame.ts:9,34). It is the only sub-11 size in packages/svg. All six locales. |
| I18N-1 | P3 | packages/svg/src/glamour-card.ts:113-124 (wrapFoot) + bot-logic de `card.glamourFootShown_other` etc. | de worst case (n >= 10, twins and blocked both present) rendered by wrapFoot: line 2 `durch Zwilling benannt · 2 ohne L…` - second line ellipsises mid-word ("Lösung" -> "L…"). Line break also splits the count from its noun in every locale (`3 / durch Zwilling`, en `3 named from / a twin`). Embed carries the full list, so cosmetic. Width model = estimateTextWidth (approximate). |
| I18N-2 | P3 | packages/svg/src/glamour-card.ts:282 | status column width = measured width with no allowance for `letterSpacing: 0.6`; de `KEINE PROJ` and fr `NON MIRAGE` measure 68 px (statusW 68) so tracked ink is ~74 px, spilling ~6 px left into the 10 px gap. No truncation/overlap with the name (gap absorbs it). Informational. |
| I18N-3 | P3 | apps/og-worker/src/services/og-embed.ts:140 | de crawler text `mit Farbstoffen, ob das Spiel es tragen lässt, und Bezugsquelle` mixes a noun, a clause and a noun in one list; reads clumsily (en: "its dyes, whether the game lets it be worn, and where to get it"). |

## Checked and right

- Every card-drawn glamour string comes from a table: OG_DECK.glamour (og-strings.ts:48,61,74,87,100,113), TOOL_TAG.glamour (147,159,171,183,195,207); six locales each, key sets equal. Default-card name/sub = OG_DECK; methodTag null on glamour (index.ts:641), so no `ΔE2000` literal. `/GLAMOUR` chip is the command name (verbatim), `xivdyetools.app` is a URL.
- glamour-card.ts has no English literal: slot, look, status, title, charSub, footKey are all passed in (GlamourCardOptions/Row); bot-logic `card.glamour*` supplies them in six locales (de keys read: bot-logic de.json:606-655, incl. glamourSlot x12).
- OG_DECK.glamour.name == web-app `tools.glamour.title` in all six (en Glamour Reader, de Projektionsleser, fr Lecteur de mirages, ja ミラプリリーダー, ko 코디 리더, zh 幻化查看器; web-app locales line 104). TOOL_TAG matches dictionary glamour word (de PROJEKTION, fr MIRAGE, ja ミラプリ, ko 코디, zh 幻化). No false-friend (グラマー / 글래머 / 时装).
- Crawler: og-data-generator.ts:928-931 `toolDefault('glamour')` -> title = site(OG_DECK name) (localized), description `glamour.descriptionDefault` present in all six (og-embed.ts:96,140,184,228,272,316); url via appUrl(..., locale) and imageUrl via withLang -> `?lang=` carried. No glamour share grammar exists (a .chara never leaves the browser), so there is no web-app share URL to check; EmbedKey type forces all six blocks.
- House register: de `du` (Lade/liste), fr `vous` (Chargez/listez) in deck subs.
- Fit (estimateTextWidth, scratch script in $TEMP, 11 px mono / 14 px body): longest slot name fr `MAIN NON DIRECTRICE` 145 px tracked, 129.6 px untracked -> fits LEAD_MAX 132 untracked (fallback works); de `FINGER (RECHTS)` 114; ja/ko/zh <= 94. Longest status 68 px <= STATUS_MAX 72. Title fits in all six at n=12 (de 249, fr 242 of ~290 px; titleExtra drops first when not). Footer wrap: en/fr/ja/ko/zh fit two lines untruncated at 12 pieces; de truncates only in the n>=10 + both clauses case (I18N-1).
- default-card.ts wrapSub (CJK breaks at any char, 3-line cap, ellipsis) covers the longest glamour sub; og font tests pass.
- Fonts: og-worker font-coverage stringsFor() lists core locale + OG_DECK + TOOL_TAG + OG_DECK_LINE + OG_ROLE (font-coverage.test.ts:148-158) = every `  xx: {` card table incl. the new glamour keys; test green (_gate-summary og-i18n 147 pass). discord-worker stringsFor() = core + bot-logic (minus `commands.*.options`) + CONSOLIDATED_DYES + method tags; test green (99 pass), so the card.glamour* strings are covered. emittedGlyphs scan adds glamour-card's `頭` (CJK-only, JP/SC carry it).
- Staleness: og subsets re-cut in the same commit as the last og-strings change (2026-09-28 08:38:46). Discord subsets 2026-09-28 08:40:46 = same time as the last bot-logic ko content commit (c4e128bb). The only later bot-logic locale change (d1fdb89a, 2026-10-04) is 3 DELETED lines per locale (`/stats preferences` description, admin-only, not drawn) -> nothing new to cut; at most a few surplus glyphs. delta/bot-logic.tsv drawn keys (card.glamour*) all predate the re-cut.
- Sizes (font-sizes.txt): discord SC 502,612 B = 490.8 KiB (< 500), JP 335,660 = 327.8 KiB (< 500), KR 144,736 = 141.3 KiB (< 300); og SC 335.9, JP 220.9, KR 112.2 KiB. No threshold breached. NOTE: discord SC headroom to 500 KiB is only ~9 KiB - the next CJK-heavy bot string batch will likely cross it.
- font-union-analysis: og tofu 0, subsets surplus 0. Discord "58 needed but in no face" is the analysis script not excluding `commands.*.options.*.description` (and the stats-subcommand descriptions) which the gate and subset script deliberately exclude (Discord renders them in its own UI): the listed 二 五 伴 侣 健 康 ... 蛋 ひ occur only at bot-logic ja.json:1006,1249 / zh.json:729,738,809,955,1255 (option/subcommand descriptions). Not tofu. KR/JP "missing" CJK punctuation (、。「」，；！（）) is carried by the SC face (union covers it).

## Rejected

- Discord font-coverage-manual "44 missing from SC": false positive (above).
- web-app share-service.ts:339 `'Affordable dye alternatives for your glamour.'` and sibling English descriptions: pre-existing, outside this slice, not glamour-specific, and glamour has no share path; left to the web-app reviewer.
- ja deck sub `染色` vs `カララント` elsewhere in og-embed: per-surface house style, not filed. ko `염색` (dyeing) alongside `염료` (dye) in the glamour sub reads as the noun for a dye job; no dictionary row to cite.
- Fixed-width slot "names give way" truncation of long fr item names (nameMax ~110 px): documented design trade-off with tests.
- og JP face "missing" U+FF0C: zh/ko-only punctuation, SC carries it.

## Files covered

apps/og-worker/src/{index.ts, og-data-generator.ts, types.ts, services/og-embed.ts, services/og-strings.ts, services/svg/default-card.ts, services/font-coverage.test.ts}; packages/svg/src/{glamour-card.ts, frame.ts (CARD_TYPE, textWidth, fitText), base.ts (estimateTextWidth), icons/tool-icons.ts}; apps/discord-worker/src/services/font-coverage{,.test}.ts; bot-logic de/en/fr/ja/ko/zh `card.glamour*` (via scratch measure); web-app locales line 104 x6; evidence: font-sizes, font-union-analysis, font-coverage-manual, font-vs-locale-mtimes, svg-glamour, svg-literal-glyphs, delta/bot-logic.tsv header, hc-sentences-apps-og-worker (3 hits, all renderer.ts error strings: internal error messages / 500 body, not card text).
