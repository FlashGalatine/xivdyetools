# Review: ui-zh (Simplified Chinese UI strings)

Reviewer slice: zh values in web-app, bot-logic and og-worker. Revisions: BASE 5c80fcba, MAIN 8ecb878f, HEAD preview.

## Candidates

### TERM-ZH-1 (P2) glamour.fact.dated = "旧版"
`apps/web-app/src/locales/zh.json:1394`. Origin MAIN. The tag marks an item whose English name starts with "Dated "
(`packages/core/src/services/chara/chara-twins.ts:85`). The game's own zh item names carry the prefix `过期`
(`apps/api-worker/src/chara/data/item-names.zh.json`: 1408 names start with `过期`, e.g. `过期青铜步兵剑`; none start with 旧版 or 旧式).
So the tag should read `过期`, so it matches the item name printed next to it. No dictionary row, so the cited source is the item-names data.
(ja `旧式` and ko `구형` look like the same issue; ko's own prefix in item-names.ko.json is `낡은`. Not my slice, flag for the ja/ko reviewer.)

### TERM-ZH-2 (P2) Facewear has a third name in the bot manual
`packages/bot-logic/src/i18n/locales/zh.json:146` (`manual5...facewearExcluded`): `**面部装备：** 面部装备颜色（如「红色」、「蓝色」）`.
Core category value is `脸部配饰` (`packages/core/src/data/locales/zh.json:153`); the slot label is `面部配饰` (dictionary, Equipment Slots row 16050);
the bot says `面部装备`. Origin MAIN (not in the delta; predates BASE). The sentence is about the Facewear dye category, so core's `脸部配饰` applies.
The word 装备 also reads as "gear", which is what the Glamour tool talks about.

### TERM-ZH-3 (P3) "facewear color" = 眼镜颜色
`apps/web-app/src/locales/zh.json:1262-1263` (`swatch.facewearColorTag`, `swatch.facewearColorUnknown`). Origin MAIN (en-only edit, zh untouched).
`眼镜` is "glasses"; the same file uses `面部配饰` for the slot (:1261) and the privacy note (:1205). Unpinned: dictionary has no row for the
phrase "facewear color". de (`Brillenfarbe`) and fr (`couleur de lunettes`) make the same narrowing; ja and ko say フェイスウェアカラー / 페이스웨어 색상.
Suggest `面部配饰颜色` once the maintainer pins it.

### TERM-ZH-4 (P3) three words for "same look" across surfaces
bot-logic `card.glamourLooks` "+{n} 同款" (:614), `card.glamourOneLook` "唯一" (:615, ambiguous: "unique" rather than "only one item has this look"),
`card.glamourStatusTwin` "替代" (:616), versus web-app `相同外观` / `同外观装备` / `以同外观装备代替` (zh.json:1383, 1385, 1357-ish rows).
Not wrong, but one concept (an item with the same model) has `同款`, `相同外观`, `同外观装备`, `替代`. Origin MAIN.

### I18N-ZH-5 (P3) label drift and spacing in the new Glamour sheet
`apps/web-app/src/locales/zh.json:1385` says `复制列表和导出 .md`; the real button is `导出为 .md` (:1265); the sheet button is `保存 .md` (:1414).
The text should quote the button (`导出为 .md`). Spacing before the counter 件: `{n}件` (:1383, :1400) vs `{n} 件` (verdict.seg*, card.glamourPieces).
Origin MAIN.

## En-only changes (delta rows with changed_locales = en)
Compared old en (BASE) with new en via `git diff -U0 5c80fcba HEAD`. Every en-only change is a British to American spelling edit
(colour/colours, behaviour, harbour, armour, recognise, localised); meaning unchanged, so no zh value is stale. This covers all of
accessibility.*, budget.*, comparison.*, config.*, harmony.marketFailBody, preset.dyesHint, preset.season-summer, share.*, swatch.* (absent*, blend, drop,
index, offGrid, palette, save, selSentence, slotError), welcome.*, advanced.behaviorTitle, and bot-logic card.colours*, card.manualLead,
card.swatchNoSlots, harmony wheel option, swatch description, manual5.* bodies. The one meaning edit with all locales changed,
`preset.privacyNote` (PR), has a zh value that carries every new clause (verified ID/name/XIVAuth/Discord link/no email).

## Positive controls
- All 13 equipment-slot zh values (web `swatch.gearSlot.*`, `swatch.facewearSlot`, bot `card.glamourSlot.*`) equal the dictionary Equipment Slots column
  (主手, 副手, 头部, 身体, 手臂, 腿部, 脚部, 耳部, 颈部, 腕部, 右指, 左指, 面部配饰).
- Glamour-the-outfit = `幻化` (dictionary Glamour Terms); tool name 幻化查看器 agrees across web `tools.glamour.title` (zh.json), og-strings.ts:113 and
  OG_DECK short name `幻化` (og-strings.ts:207); `card.glamourTitle` = 幻化. "Can't be a glamour" uses 无法用于幻化 (zh has no system-verb split).
- Placeholders: `{name}`, `{n}`, `{s}`, `{other}`, `{list}`, `{key}`, `{id}`, `{color}`, `{t}`, `{a}`, `{b}`, `{w}`, `{thr}`, `{dye}`, `{delta}`, `{subject}` identical to en on all 191 rows (scripted).
- Plural keys: every `_one` has an `_other` for zh, both grammatical (zh has no inflection; same text with {n}).
- Punctuation: no half-width , . : ; ? ! ( ) beside CJK in any delta zh value (scripted).
- Grand Company `大国防联军`, Hrothgar `硌狮族`, clans `中原之民`/`晨曦之民` agree with the existing zh vocabulary; Market Board `市场布告板`; Gil `金币`.
- Discord limits: longest command/option description is 34 chars (`commands.glamour.options.file.description`), limit 100; zh is never longer than en by char count on any delta row.
  Card text widths are measured by `fitText`/`textWidth` in `packages/svg/src/glamour-card.ts` (statusW, tracked slot), so no fixed-column overflow.
- og-embed zh `glamour.descriptionDefault` (og-embed.ts:316) and og-strings zh `glamour` name/sub are fluent, consistent with the web (获取方式, 染剂, 装备).
- Facewear slot vs Facewear category as two words is by design (dictionary Equipment Slots note), not filed.

## Rejected
- `glamour.fact.anyTribe` "所有种族": en says "tribe" but the rule is the race/gender mask (`chara-game-rules.ts`), game word 种族 is right; the en label is the loose one.
- `glamour.sheet.title` "装备列表" (en "Glamour list"): ja/ko/de/fr likewise say equipment list; consistent with `listCopied`.
- 「」 in bot-logic vs "" in web-app: per-surface style, bot uses 「」 throughout.
- Bare `和谐` in the harmony wheel option description (:726): bot-wide usage, not new.
- `你` (web new strings) vs `您` (bot, policies): zh register not pinned in the brief and mixed before BASE (web 14 / 13).
- `card.manualLead` "请试": terse but grammatical when followed by the command.
- `染色栏` for dye channels: no dictionary row, so unpinned; left alone.

## Covered
web-app.tsv (123 rows incl. glamour.* 77 keys) and bot-logic.tsv (68 rows) zh column; og-strings.ts and og-embed.ts zh blocks and their diffs; dictionary Glamour Terms,
Equipment Slots, Facewear Colors; core zh.json facewear entries; web-app and bot-logic zh.json at the cited lines; item-names.zh.json.
