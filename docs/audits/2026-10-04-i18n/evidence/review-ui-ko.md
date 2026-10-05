# Review: ui-ko (Korean UI strings), i18n audit 2026-10-04

Reviewer: worker, slice `ui-ko`. Read-only; this is the only file written.

## Candidates (evidence)

### UKO-1 I18N P1 — web-app ko.json:451 `comparison.mCie76Caveat` (origin MAIN, unchanged since BASE)
ko: `바로 ΔE2000을 낙은 결함입니다.` "낙은" is not a Korean word; en is "the exact failure that produced ΔE2000" so the
verb is 낳은 (낳다 = produce). User-visible typo in the Comparison tool's CIE76 caveat. Fix: `낳은`.
Only the en changed BASE->HEAD (colour->color), so the ko typo was already there at BASE.

### UKO-2 I18N P2 — web-app ko.json:607 `budget.perPointNote` (origin MAIN, unchanged since BASE)
ko: `목표 가격에서 해당 행 가격을 뺌 값을` — ungrammatical ("뺌 값"); should be `뺀 값을`. Meaning is clear, wording is broken.

### UKO-3 TERM P2 — web-app ko.json:94/1229-1239 vs core ko.json `sheets` (origin MAIN)
Same game concepts, two names across surfaces. Core `sheets` = highlight `하이라이트`, tattoo/limbal `문신/홍채`, face paint `얼굴 페인트`.
- web `tools.character.highlightColors` (l.91) = `하이라이트 색상`, but `swatch.slotHighlights` / `swatch.palHighlight` (l.1229/1237),
  `swatch.absentHighlightsOff` (l.1245) and bot `card.slotHl` (bot ko.json:588) = `브릿지`.
- face paint: web `페이스 페인트` (tools.character.facePaintDark l.95, swatch.slotFacePaint) vs core `얼굴 페인트` vs bot
  `card.slotPaint` `페인트` (bot l.591) and bot manual.swatch.description / manual5.topics.characterFile.body (bot l.72, 690) `페인트`.
- limbal: web `tools.character.tattooColors` (l.94) = `문신/림발 색상` but `swatch.slotLimbal` (l.1232), `palTattoo` (l.1239),
  bot `card.slotLimbal` and the bot manual body = `림벌`. `림발` vs `림벌` are two spellings of one word inside web-app ko.json.
Dictionary has no row (sheets are core data), so which spelling is right is for the maintainer: core is the authority per brief
("a ... name must equal core's value"); the in-game Korean for the creator sheets is what core carries. Report as inconsistency.

### UKO-4 TERM P2 — web-app ko.json:1412 `glamour.sheet.privacy` (origin MAIN)
`이 복장별로` — "복장" is a third word for one outfit. Dictionary (Glamour Terms): the UI word for one outfit is `코디`
(`의상` is the policy-document register). The same file uses `코디` for the same concept (`swatch.equipHead` l.1218, `swatch.paletteTitle`,
`swatch.noDyedPieces`). Fix: `이 코디별로`.

### UKO-5 TERM P3 — web-app ko.json:1185-1186 `share.invalidDye`, `share.legacyLink` (origin MAIN)
`염색약` (2 occurrences) where every other surface and core `labels.dye` use `염료`. Two names for "dye" in one locale.
(`share.invalidDye` is in the delta only for the en spelling change.)

### UKO-6 TERM P3 — bot-logic ko.json:357-358, 686 (origin MAIN)
`preferences.keys.world` `마켓 서버`, `preferences.keys.market` `마켓 가격 표시`, `manual5.topics.spectrumPrices.body` `마켓 아이템`
use the loan `마켓`; the same bot file says `장터` for the Market Board (`budget.errors.*`, `manual.budget.description`) and web-app
`시장` (common.market l.125, budget.colBoard l.619) / bot `card.mkt` `시장`, `card.lBoardOnly` `시장만` for the board column.
Dictionary pins Market Board = `장터` and lists `마켓보드` as not the client's word; World = `서버` (so `마켓 서버` = "market world" is a loan+word
mix). Three names (장터 / 시장 / 마켓) for the market concept. The bare-noun `시장` is not on the dictionary's banned list (only `시장 게시판`),
so the column labels are unpinned; the `마켓` ones are the clear divergence.

### UKO-7 TERM P3 — bot-logic ko.json:614 `card.glamourLooks` `+{n} 동형` (origin MAIN, new Glamour card)
`동형` (isomorphic, math/biology register) is not natural Korean for "same look"; the web tool says `같은 외형` for the same concept
(`glamour.row.twins`, `glamour.picker.head`) and the bot's own long form is `같은 외형으로 대체`. Similarly `card.glamourOneLook` `유일`
(bare "unique"). Suggest `+{n} 외형` / `외형 1개` style; narrow column so keep short. (ja `同型`, zh `同款` are the same pattern — not judged here.)

### UKO-8 I18N P3 — bot-logic ko.json:607-608 `card.glamourPieces_one/_other` `염색 {n}개` (origin MAIN)
en `{n} dyed piece(s)` counts pieces; ko `염색 {n}개` reads as "{n} dyes" and collides with `card.glamourDyes_*` = `염료 {n}종`
(l.611-612) and web `glamour.fact.dye` `염색 ×{n}` (l.1390, "DYE ×n"). Mixed 염색/염료 for count-of-dyes vs count-of-dyed-pieces.
Suggest `염색 장비 {n}개`.

## En-only changed rows (changed_locales = en)

All 54+12 `changed` rows with changed_locales = en were diffed against BASE (`5c80fcba`) — every one is a pure British->American spelling
change (colour->color, behaviour->behavior, armour->armor, harbour->harbor, recognise->recognize, localised->localized). No meaning change,
so no ko value is stale because of the en edit. Rows: accessibility.unit*/visionDesc*, advanced.behaviorTitle, budget.ledgerHead/perPointNote,
comparison.* (badgeSame, headSame, mCie76Caveat, mCiede2000Desc, mDistinguishDesc, mRedmeanCaveat, mRgbDesc, methodsLearnMore, subSame),
config.sampleAreaSizeTooltip, harmony.marketFailBody, preset.dyesHint, preset.season-summer.description, share.invalid*, swatch.* (absent*, blendNote,
characterDefaultName, characterSaved*, dropBody, facewearColor*, indexWinsNote, offGridNote, paletteNameHint, saveCharacter, selSentenceOffGrid,
slotError.*), welcome.*, bot card.colours*, card.manualLead, card.swatchNoSlots, commands.harmony.options.wheel, commands.swatch, manual5.topics.characterFile.body,
colorVision.name, contrast.body. I also read each ko value against the en: meaning matches (UKO-1/2 are the only faults found, both pre-existing).

## Rows where ko changed (checked against dictionary / core)
- `swatch.facewearSlot` 얼굴 소품; `swatch.gearSlot.{Ears,Hands,LeftRing,MainHand,Neck,OffHand,RightRing,Wrists}` and `card.glamourSlot.*` (13 slots incl. Head/Body/Legs/Feet):
  all equal the dictionary's Equipment Slots table (귀 / 손 / 왼쪽 손가락 / 주 무기 / 목 / 보조 무기 / 오른쪽 손가락 / 손목 / 머리 / 몸통 / 다리 / 발 / 얼굴 소품). OK.
- `preset.privacyNote` (PR): meaning matches en (account record, ID + name, XIVAuth character name, linked Discord ID, no email, nothing sold). OK.
- `tools.presets.title` 커뮤니티 프리셋 / shortName 프리셋: consistent with og-worker OG_DECK + TOOL_TAG. OK.
- `preset.colorCount` / `card.colours*` `{n}가지 색`: OK. `commands.preferences...clan` 부족 / 미드랜더 / 렌 equal core `clans`. OK.
- `swatch.charaHintGlamour` (PR): meaning matches; `저희` = operator (house register).

## Glamour tool (new keys, all added at MAIN)
Name agrees everywhere: web `tools.glamour.title` `코디 리더` + shortName `코디` (ko.json:104-105); og-worker OG_DECK ko `코디 리더`, TOOL_TAG `코디`,
og-embed `glamour.descriptionDefault` (no tool name, uses `장비`); bot `card.glamourTitle` `코디`, `commands.glamour.description` `코디로 읽기`, `manual.glamour.description` `코디`.
Matches dictionary (`코디 리더` / `코디`). "Can't be a glamour" = `투영할 수 없음` / `투영 불가` everywhere (not 코디) as the dictionary requires.
Grand Company = `총사령부` throughout. Placeholders, `_one/_other` pairs present on all 12 + 9 plural groups; ko has no singular/plural difference so identical pairs are correct.

## Positive controls
- Placeholder parity en vs ko over ALL 1197 web-app and 706 bot-logic keys: zero mismatches (script compared `{name}` sets); key sets identical.
- No ko value equals its en value except codes/brands (footer.disclaimer, ΔEOK2 · OKLab, Garland/Teamcraft/GamerEscape/Mirapri link names, "XIV Dye Tools", PNG/JPG list).
- No full-width CJK punctuation (，。、) in any ko value — correct: Korean uses ASCII `, . :` (brief's "full-width" rule is read as ja/zh only).
- Discord limits: longest `commands.*` ko string is 41 chars (limit 100); no ko/en length ratio above 2.0 on any key with en >= 8 chars (bot), nor any web-app key with en >= 6 chars.
  Card columns widen for long verdict/slot text (svg `glamour-card.test.ts` 14 tests green, `svg-glamour.txt`).
- Market Board = 장터 in all board-named keys (gate `market-board-term.txt`: web 6/6, bot 5/5); harmony.marketFailBody 장터 OK.
- Hue 색상, Hrothgar 로스갈 (core races), Midlander 미드랜더 / Raen 렌 (core clans) OK.
- og-strings ko diff (OG_DECK glamour name+sub, TOOL_TAG glamour 코디) and og-embed ko diff (`glamour.descriptionDefault`) read in context at HEAD (og-strings.ts:91-102/190-201, og-embed.ts:254-): natural, consistent with web, no half-English.

## Rejected
- `glamour.sheet.title` ko `장비 목록` for en "Glamour list": ja 装備リスト / de Ausrüstungsliste / fr Liste d'équipement / zh 装备列表 do the same — deliberate cross-locale reading ("equipment list"), not a ko fault. (Cross-locale: en says Glamour list.)
- `glamour.fact.anyTribe` `모든 종족` while en says "tribe": ja/fr/zh also say race; gear restrictions are by race; `swatch.*` 부족 is the clan. Fine.
- `comparison.subSame` / matchImageHelp `가슴 방어구` for "chest piece": colloquial item wording, not the slot label.
- `tools.harmony.title` ko `조화 탐색기` (web, og) vs core `tools.harmony` `하모니 익스플로러`: brief says tool names come from OG_DECK/web, never core `tools.*`; web/og agree.
- web `tools.swatch.shortName` `견본` vs og TOOL_TAG swatch `색상 대조`: pre-BASE, not in delta, third-order.
- `manual5.topics.spectrumPrices.body` `창천가 진흥권` / stray `염료:` label (core: Firmament `창천 거리`, Skybuilders Scrips `진흥권`): unpinned, awkward but the meaning survives; P3 at most.
- ko `—` / ` — ` mix, `glamour.sheet.countBlank` `{n} 빈칸` word order: cosmetic.

## Covered
`docs/audits/2026-10-04-i18n/evidence/delta/web-app.tsv` (122 rows) and `bot-logic.tsv` (67 rows), every ko value; BASE en for the 66 en-only rows;
`og-strings.ts` and `og-embed.ts` main diffs + HEAD ko blocks; `docs/reference/ffxiv-terminology.md` Glamour Terms + Equipment Slots; core ko.json
(sheets, races, clans, categories, labels, acquisitions, currencies, tools); full-file placeholder / length / identical-to-en sweeps on web-app and bot-logic ko.json
(scripts in `$TEMP`, nothing in the tree).
