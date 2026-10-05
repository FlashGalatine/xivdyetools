# Review: gap-sheet-names-de-fr-zh (2026-10-04 i18n audit)

Authority: core `sheets` (packages/core/src/data/locales/{en,de,fr,zh}.json), cited by docs/reference/ffxiv-terminology.md:346. The dictionary has no per-word row for sheets, so which spelling is "right" is unpinned; core is the authority per brief and the defect is the split. All keys exist at MAIN and none appears in delta/*.tsv (origin MAIN). Format follows review-ui-ja/ko (TERM-JA-5, UKO-3); ja/ko not re-filed.

## Core `sheets` (de / fr / zh)
- highlight: Strähnchen / Mèches / 挑染
- tattoo-limbal: Tätowierung/Limbus / Tatouage/Limbe / 纹身/虹膜
- face paint dark|light: Gesichtsbemalung (dunkel|hell) / Peinture faciale (foncée|claire) / 面部彩绘（深|浅）
- lip: Lippenfarben / Couleurs des lèvres / 唇色; hair Haarfarben / Couleurs des cheveux / 发色; skin Hautfarben / Couleurs de peau / 肤色; eye Augenfarben / Couleurs des yeux / 眼睛颜色

## de (web = apps/web-app/src/locales/de.json, bot = packages/bot-logic/src/i18n/locales/de.json)
- Highlights: core Strähnchen; web :91 `Strähnchen-Farben`; web slotHighlights/palHighlight/absentHighlightsOff :1229/:1237/:1245 `Strähnen`; bot card.slotHl :588 `STRÄHN`; bot commands.swatch description :72 and manual5 characterFile body :690 `Highlights` (English loan). Four forms for one concept.
- Tattoo/limbal: core `Tätowierung/Limbus`; web :94 `Tattoo/Limbal-Farben`, slotTattoo :1231 `Tattoo`, slotLimbal :1232 `Limbal-Ring`, palTattoo :1239 `Tattoo / Limbal`; bot slotTattoo :592 `TÄTOW.`, slotLimbal :593 `LIMBUS`; bot :72/:690 `Tattoo/Limbalring`. `Limbal`/`Limbalring`/`Limbus` and `Tattoo`/`Tätowierung`/`TÄTOW.`.
- Face paint: core `Gesichtsbemalung`; web :95/:96 same, but slotFacePaint :1234, palFacepaint :1241, absentFacePaintOff :1246 `Schminke`; bot slotPaint :591 `BEMAL`; bot :72/:690 `Gesichtsbemalung`. `Schminke` = make-up, differs from core.
- Cosmetic: web :92/:93/:95/:96 capitalise `(Dunkel)`/`(Hell)`; core lower-case.

## fr
- Tattoo/limbal: core `Tatouage/Limbe`; web :94 `Couleurs de tatouage/limbal`, slotLimbal :1232 `Anneau limbal`, palTattoo :1239 `Tatouage / Limbal`; bot slotLimbal :593 `LIMBE`; bot :72/:690 `tatouage/anneau limbal`. `limbe`/`limbal`/`anneau limbal`.
- Gender agreement: web :92 `Couleurs de lèvres (Foncé)`, :93 `(Clair)`, :95 `Peinture faciale (Foncé)`, :96 `(Clair)`; core has `(foncées)`/`(claires)`/`(foncée)`/`(claire)`. Masculine singular on feminine nouns (grammar; also capitalised, and `de lèvres`/`de cheveux` vs core `des`).
- Face paint bot slotPaint :591 `PEINT.`, hair `CHEV.`, tattoo :592 `TATOU.` are truncations; highlights :588 `MÈCHE` is whole (dot style inconsistent).
- Highlights consistent (`Mèches`/`mèches` everywhere). Face paint consistent apart from the abbreviation.

## zh
- Tattoo: core `纹身`; web :94 `纹身`, but slotTattoo :1231 and palTattoo :1239 `刺青`; bot slotTattoo :592 and :72/:690 `纹身`. `刺青` vs `纹身` inside web zh.json.
- Limbal: core `虹膜`; web :94 `纹身/轮环颜色` (`轮环`), slotLimbal :1232 and palTattoo :1239 `角膜环`; bot slotLimbal :593 and :72/:690 `角膜环`. Three words (`虹膜`, `轮环`, `角膜环`) for one sheet half; `角膜` = cornea, core says iris.
- Highlights/face paint: `挑染`, `面部彩绘` consistent and equal to core; bot slotPaint :591 `彩绘` drops `面部` (short form, acceptable-looking but unpinned).
- Hair/skin tool labels `头发颜色`/`皮肤颜色` (web :89/:90) vs core `发色`/`肤色`; wording only, not a conflict.
- Slot: web slotError.noTribe/unknown :1329/:1330 and foot :1273 `栏位` vs bot swatchSlot :584, swatchFootKey, swatchSlotMissing :604 `部位` (web `部位` at :1256 = gear pieces). Cosmetic split.

## Policies (6 files)
Searched the de/fr/zh `PRIVACY.<lc>.md` and `PRIVACY_POLICY.<lc>.md` for every label above: none. Only `/swatch` (command name) and zh web policy `色板匹配器` (line 7, the tool name; tool-name territory, other slice).

## Short-form bot slot labels
bot-logic card.slot* (en `TATT.`, `HL`, `PAINT`, `LIMBAL`) are card column heads (packages/bot-logic/src/commands/swatch.ts:106-112). Neither the brief nor the dictionary declares them a design choice, so reported as P3.

## Positive controls
- fr/zh highlights and face paint equal core except noted; zh `面部彩绘（深色）` matches core structure.
- Eye/hair/skin/lip words equal core in de and fr.
- bot de/fr/zh swatch footer plurals present (`_one`/`_other`); no raw keys.

## Rejected
- web `…Colors` labels adding "Colors" (`Strähnchen-Farben`): a sensible composition, not a conflict beyond the core noun.
- zh policy `色板匹配器`: other slice.
- de `Slot`, fr `emplacement`: slot not a sheet concept.

## Files covered
core {en,de,fr,zh}.json `sheets`; web-app {en,de,fr,zh}.json (tools.character.*, swatch.*); bot-logic {en,de,fr,zh}.json (card.slot*, card.swatch*, commands.swatch, manual5 characterFile); 6 policy docs; delta tsv; review-ui-ja/ko; swatch.ts:106-112.
