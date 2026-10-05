# Review: ui-ja (Japanese UI strings), i18n audit 2026-10-04

Reviewer slice: ja values in web-app, bot-logic, og-worker (ja blocks of og-strings.ts / og-embed.ts).
Tree: preview/integration-2026-10-04 (HEAD). Read-only; this is the only file written.

## Candidates

| id | tier | file:line (HEAD) | claim | evidence |
|---|---|---|---|---|
| TERM-JA-1 | P3 | apps/web-app/src/locales/ja.json:1360 vs :1219, :1255 | `glamour.verdict.explain` says `染色枠` for dye channels; `swatch.gearHint` and `swatch.equipCount` (same tool) say `チャンネル`. Two words for one concept. Unpinned in the dictionary: pick one (in-game wording needs a source). Origin MAIN. | :1360 "確認するのは染色枠、…"; :1219 "1部位に2チャンネル"; :1255 "{channels}チャンネル・{dyes}色" |
| TERM-JA-2 | P2 | apps/web-app/src/locales/ja.json:1412, :1415, :1399 | en says "for this outfit"; ja `glamour.sheet.privacy` reads "この装備ごとに保存されます" = "per this piece of gear", and `sheet.title` "Glamour list" is `装備リスト` (also listCopied/listCopyFailed/listExportFailed :1266-1268). Dictionary: one outfit = `ミラプリ` (docs/reference/ffxiv-terminology.md:264). A reader may think edits are saved per item. Suggest `このミラプリごとに`. Origin MAIN. | en.json same key; terminology.md:264 |
| TERM-JA-3 | P3 | apps/web-app/src/locales/ja.json:1374 vs :1377, :107 | "wear" has two verbs inside the Glamour tool: `装備できません` (blockedWear :1374, fixedWear :1371, segWear :1350) vs `着用できます` (otherWorks :1377, tools.glamour.lead :107). Pick one. Origin MAIN. | lines cited |
| TERM-JA-4 | P3 | packages/bot-logic/src/i18n/locales/ja.json:614-616 vs apps/web-app/src/locales/ja.json:1380, :1398 | One concept ("same look" / twin) has several names: web `同じ見た目` / `別アイテムで解決`, bot card `+{n} 同型` and `代替` (substitute); `同型` means "same model/type", not same look. `card.glamourOneLook` = bare `唯一` (en "ONE LOOK") loses "look". Cosmetic. Origin MAIN. | bot ja.json:614 "+{n} 同型", :615 "唯一", :616 "代替" |
| TERM-JA-5 | P3 | apps/web-app/src/locales/ja.json:94, :1232, :1239; packages/bot-logic/src/i18n/locales/ja.json:593 | Limbal ring: web `リンバル` (slotLimbal "リンバルリング", palTattoo "刺青 / リンバル") vs `リムバル` (tattooColors :94; bot slotLimbal :593 and manual5 characterFile body). Not in delta (exists at BASE). Which is the game's spelling is unpinned; the internal split is the defect. Origin MAIN. | lines cited; same at 5c80fcba |
| I18N-JA-6 | P3 | apps/web-app/src/locales/ja.json:1392-1393 | Chips `このキャラ可` / `このキャラ不可` clip キャラクター (written in full in neighbouring strings, e.g. :1374) and `不可` alone is terse for "NOT FOR THIS CHARACTER". Cosmetic. Origin MAIN. | en.json:1392-1393 |
| TERM-JA-7 | P3 | apps/web-app/src/locales/ja.json:1400, :1385, :1380 | Counter and list nouns drift inside the Glamour tool: `{n}点` (sheet.sub) vs `{n}部位` (verdict.seg*, card.*); `リストをコピー` (copyList :1264) vs `一覧のコピー` (picker.foot :1385) vs `一覧に書くもの` (:1380). Cosmetic. Origin MAIN. | lines cited |

## What I checked
- Every row of delta/web-app.tsv (122 rows) and delta/bot-logic.tsv (67 rows). BASE en values pulled with `git show 5c80fcba:<json>` for every `changed` row.
- en-only changed rows: ALL are spelling-only (colour->color, behaviour, armour->armor, harbour->harbor, recognise, localised). No meaning change, so no ja value is stale. Rows with real changes, each re-read: `swatch.gearSlot.*` (Weapon->Main Hand, Earrings->Ears, Necklace->Neck, Bracelets->Wrists; ja already slot-style or updated to `メインアーム`, `サブアーム`, `フェイスアクセサリー`), `tools.presets.title` (Preset Palettes -> Community Presets; ja `コミュニティプリセット` equals OG_DECK presets name), `preset.privacyNote` (ja carries every new clause: XIVAuth character name, Discord ID link, no email).
- Placeholders: programmatic en-vs-ja comparison of `{x}` sets over every delta key in both files: 0 mismatches; 0 untranslated (only `manual.glamour.name` = command text, allowed). Key sets en/ja identical (1197 web-app, 706 bot-logic).
- Plurals: every `_one`/`_other` pair added (`glamour.verdict.seg*`, `card.glamour{Dyes,Pieces,Worn,Foot*}`) exists in ja and is grammatical (ja forms identical).
- Punctuation: full-width `（）：、。` used in all new ja; `·` and `——` separators match the existing house pattern.
- Slot names vs dictionary Equipment Slots (terminology.md:299-313): web `swatch.gearSlot.*` and bot `card.glamourSlot.*` equal the table for all 12 slots, plus `swatch.facewearSlot` `フェイスアクセサリー`. Core `フェイスウェア` (colour/category word) stays separate (`facewearColorTag`), as the dictionary says.
- Glamour tool name: web `tools.glamour.title` `ミラプリリーダー` / short `ミラプリ` (ja.json:104-105) = OG_DECK `ミラプリリーダー` (og-strings.ts:87) = TOOL_TAG `ミラプリ` (:183) = dictionary line 280. Bot `card.glamourTitle` `ミラプリ`. "can't be a glamour" keeps `投影できない` / `投影不可` as the dictionary requires. No `グラマー` anywhere in ja.
- og-embed ja `glamour.descriptionDefault` and og-strings ja `glamour` deck sub: meaning matches en; カララント/染料 split is per-surface house style (not filed).
- Length (measured): all Discord ja command/option descriptions/names max 41 chars (limit 100); no ja string over 1000 chars; every new Glamour ja value is shorter than en except `card.glamourStatusOk` `問題なし` (4 vs 2; the card sizes the status column from measured text width, packages/svg/src/glamour-card.ts:217-221, so no overflow risk). No length finding.

## Positive controls
- The placeholder comparison flagged nothing but would print on a dropped `{n}`; the same script printed `SAME` for `manual.glamour.name`, proving the untranslated check fires.
- Re-derived the spelling-only classification by diffing BASE vs HEAD en for all `changed` rows rather than trusting the tsv.

## Rejected
- `装備リスト` as a standalone dictionary violation: only the "this outfit" sentence (TERM-JA-2) is a defect.
- `染料` (og) vs `カララント` (web/bot): house style per brief.
- OG TOOL_TAG swatch `カラー照合` vs web shortName `見本`; OG budget `予算` vs web `予算提案`: pre-existing, not in this delta, tags are short card labels.
- `全種族` for ANY TRIBE: item restrictions are by race in the game; fine.
- Discord font "missing" `ひ` `，` `；`: carried by the SC face per brief, font reviewer's slice.
- `itemLinks.mirapri` "Mirapri": site name, verbatim.
- `card.glamourStatusDye` `染色不可` for en "DYES": en is the terse one; ja meaning matches the row.

## Files covered
apps/web-app/src/locales/ja.json (and en.json), packages/bot-logic/src/i18n/locales/ja.json (+en), packages/core/src/data/locales/ja.json (term lookups), docs/reference/ffxiv-terminology.md (Market, Glamour, Equipment Slots), delta/web-app.tsv, delta/bot-logic.tsv, delta/diffs og-strings.ts.main.diff and og-embed.ts.main.diff, apps/og-worker/src/services/og-strings.ts + og-embed.ts (HEAD ja blocks), packages/bot-logic/src/commands/glamour.ts, packages/svg/src/glamour-card.ts (width logic), evidence tool-name-consistency / font-coverage-manual.
