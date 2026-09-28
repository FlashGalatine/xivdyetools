# Equipment slot names — the game's own wording (2026-09-28)

**Question:** what does each FFXIV client call the equipment slots, word for word? The Glamour
Reader (web) and the `/glamour` card (bot) label every piece by its slot, and the labels had been
written by hand: some matched the game, some matched the market board's item categories, and some
matched neither.

**Outcome:** the apps now use the slot vocabulary below, tabled in the glossary
([Equipment Slots](../../reference/ffxiv-terminology.md#equipment-slots)). Adopted in PR #208
(web-app 5.13.0) and PR #210 (the `/glamour` bot, bot-logic 4.5.0).

## Method

The client's interface text is the `Addon` sheet. Its equipment-slot labels are rows 738–750, a
block the game reuses verbatim in four other places (rows 1373…, 11524…, 11960…, 12226…: the
Armoury Chest, the Fashion Report, the Glamour Plate editor, the Glamour Dresser) and lists again in
the portrait "visual discrepancy" message (row 14763), so the wording is one string the game uses
everywhere a slot is named.

- **EN / JA / DE / FR** — read from the game data through XIVAPI v2:
  `https://v2.xivapi.com/api/sheet/Addon?rows=738,739,740,741,742,744,745,746,747,748,749,750,16050&fields=Text&language=<en|ja|de|fr>`
- **ZH** (China client) — the same rows in the CN client dump:
  `https://raw.githubusercontent.com/thewakingsands/ffxiv-datamining-cn/master/Addon.csv`
- **KO** (Korea client) — the same rows in the KR client dump (current as of patch 7.56h,
  2026-09-15): `https://raw.githubusercontent.com/Ra-Workspace/ffxiv-datamining-ko/master/csv/Addon.csv`

Three research agents gathered the rows and screen context in parallel; every row cited here was
then re-fetched and checked by hand from the URLs above.

## The slot labels (`Addon`)

| Slot | Row | EN | JA | DE | FR | KO | ZH |
|------|-----|----|----|----|----|----|----|
| Main hand | 738 | Main Hand | メインアーム | Haupthand | Main directrice | 주 무기 | 主手 |
| Off hand | 739 | Off Hand | サブアーム | Nebenhand | Main non directrice | 보조 무기 | 副手 |
| Head | 740 | Head | 頭 | Kopf | Tête | 머리 | 头部 |
| Body | 741 | Body | 胴 | Rumpf | Torse | 몸통 | 身体 |
| Hands | 742 | Hands | 手 | Hände | Mains | 손 | 手臂 |
| Legs | 744 | Legs | 脚 | Beine | Jambes | 다리 | 腿部 |
| Feet | 745 | Feet | 足 | Füße | Pieds | 발 | 脚部 |
| Ears | 746 | Ears | 耳 | Ohren | Oreilles | 귀 | 耳部 |
| Neck | 747 | Neck | 首 | Hals | Cou | 목 | 颈部 |
| Wrists | 748 | Wrists | 腕 | Handgelenke | Poignets | 손목 | 腕部 |
| Right ring | 749 | Right Ring | 右指 | Finger (rechts) | Bague droite | 오른쪽 손가락 | 右指 |
| Left ring | 750 | Left Ring | 左指 | Finger (links) | Bague gauche | 왼쪽 손가락 | 左指 |
| Facewear | 16050 | Facewear | フェイスアクセサリー | Gesichtsaccessoires | Accessoires de visage | 얼굴 소품 | 面部配饰 |

Row 743 (Waist / 帯 / Taille / Ceinture / 허리 / 腰带) is the retired belt slot: no glamour can
use it, so the apps never label it.

## The second vocabulary: item categories (`ItemUICategory`)

Tooltips and the market board name an item's **type**, not its slot, with a different set of nouns:

| Row | EN | JA | DE | FR | KO | ZH |
|-----|----|----|----|----|----|----|
| 40 | Necklace | 首飾り | Halskette | Collier | 목걸이 | 项链 |
| 41 | Earrings | 耳飾り | Ohrring | Boucle d'oreille | 귀걸이 | 耳饰 |
| 42 | Bracelets | 腕輪 | Armreif | Bracelet | 팔찌 | 手镯 |
| 43 | Ring | 指輪 | Ring | Bague | 반지 | 戒指 |

Community wikis write this vocabulary when they list "slots" (e.g. the Console Games Wiki's
*Accessories* page), which is how it had leaked into our labels. Only the Korean categories are
corroborated by a live official page as well (guide.ff14.co.kr, *장비 투영*, playguide/view/154).

## What the old labels got wrong

| Locale | Before | Now | Why |
|--------|--------|-----|-----|
| EN | Weapon, Off hand, Earrings, Necklace, Bracelets, Left/Right ring | Main Hand, Off Hand, Ears, Neck, Wrists, Left/Right Ring | "Weapon" is no `Addon` string at all; the accessory nouns were the item categories |
| JA | 武器 | メインアーム | the rest already matched |
| DE | Waffe, Ohrringe, Halskette, Armbänder, Ring links/rechts | Haupthand, Ohren, Hals, Handgelenke, Finger (links/rechts) | `Armbänder` and `Ring links` match neither vocabulary |
| FR | Arme, Main gauche, Boucles d'oreilles, Collier, Bracelets, Anneau gauche/droit | Main directrice, Main non directrice, Oreilles, Cou, Poignets, Bague gauche/droite | `Main gauche` means *left hand*; `Anneau` matches neither vocabulary |
| KO | 무기, 보조무기, 귀걸이, 목걸이, 팔찌, 왼손/오른손 반지 | 주 무기, 보조 무기, 귀, 목, 손목, 왼쪽/오른쪽 손가락 | the panel word for a ring slot is 손가락 (finger), never 반지 |
| ZH | 武器, 手部, 耳饰, 项链, 手镯, 左/右戒指 | 主手, 手臂, 耳部, 颈部, 腕部, 左指/右指 | 武器 only appears inside category names; the Hands slot is 手臂 |

The facewear slot label changed too: German `Brille`, French `Lunettes` and Chinese `眼镜` (all
"glasses") became the game's row-16050 wording above.

## Other findings

- **No short forms exist.** Nothing in `Addon` abbreviates a slot (no "MH", "R. Ring", …). The bot
  card therefore sizes its slot column to the label instead of abbreviating.
- **Merged ring columns.** Screens that do not split the rings use a plural of their own: EN
  "Rings" (Glamour Dresser, row 12237) and "Fingers" (Glamour Plate, row 11970); ZH `戒指`; KO
  `손가락` (Armoury Chest, row 1384, which also calls the wrists tab `팔`, "arm"). The GPOSERS export
  writes "Rings" as its own form label, not as a game string.
- **Fashion Accessory** (rows 13671 / 13675: Modeaccessoires, Accessoires de mode, 패션 소품, 时尚配饰)
  is the umbrella-and-fan prop system, not a glamour slot. A `.chara` never carries one.
- **Two Japanese header rows fall back to English** ("FACE ACCESSORIES", row 16051; "FASHION
  ACCESSORIES", rows 13671/13675) — stylised window titles. The translated sibling (row 16050,
  `フェイスアクセサリー`) is the label.

## Confidence

EN/JA/DE/FR are read from the game data itself. ZH and KO rest on the community datamining dumps of
each regional client, which are internally consistent across all five `Addon` locations. No live
official page quotes the KO slot-panel wording verbatim, and the CN wiki (huijiwiki) and mirror
(cafemaker) refused automated fetches during this check, so both deserve a look in the running
client when convenient.
