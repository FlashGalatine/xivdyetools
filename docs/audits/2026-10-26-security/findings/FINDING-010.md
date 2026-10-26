# FINDING-010: Privacy policy says the .chara resolve request carries "a dozen small integers"; it carries up to 27 plus 12 slot labels
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** web-app (policy text only) · **Rotation:** NONE · **Policy:** CORRECT apps/web-app/PRIVACY.md section "What leaves your device" (.chara / Glamour Reader bullet), with the same bullet in every locale sibling · **CWE:** CWE-451

## Location
- `apps/web-app/PRIVACY.md:43` — Privacy policy says the .chara resolve request carries "a dozen small integers"; it carries up to 27 plus 12 slot labels

## Evidence
- PRIVACY.md:41-43 "the equipment model numbers from the file and the id of its facewear (a dozen small integers per file)"; chara-models.ts:24-32 CharaGearModel { slot; set?; base; variant }; chara-resolve-service.ts:181 const body = { gear: sendable }; body.glasses = glasses.
- Reach: Any visitor who drops a .chara file into the Glamour Reader triggers glamour-block.ts:394 resolveCharaEquipment, which POSTs {gear: sendable, glasses?} to data.xivdyetools.app/v1/chara/resolve (chara-resolve-service.ts:181-192). The parser (chara-parser.ts:557-570) emits one model per worn slot: armour {slot, base, variant}, weapons {slot, set, base, variant}.
- With all 12 slots worn, the body holds 10x2 + 2x3 = 26 lane integers plus the glasses id, so 27 integers and 12 fixed slot-name enums; api-worker router.ts:89 allows up to 12 gear entries. The policy's kind of data (model numbers + facewear id, no name, colors or dyes) is accurate, and the slot names are game-enum labels, not personal data, so nothing undisclosed is collected. Only the count is understated by more than 2x ("a dozen"; ja 十数個, ko 십여 개, zh 十几个, de "ein Dutzend", fr "une douzaine"), which makes it false-but-harmless policy text: LOW (the reviewer filed it as INFO). Preconditions: The user loads a .chara file with gear worn. The count is smaller when slots are empty (parser skips unworn slots) or out of uint16 range (isSendable filter).

## Fix
- Reword the parenthetical in all six PRIVACY files, e.g. "(two or three small integers per worn slot, labeled with the slot name, plus the facewear id: at most about 27 per file)". No code change needed.
- Policy variants to edit (all in one commit, all `Last updated` lines bumped): apps/web-app/PRIVACY.md:43; apps/web-app/PRIVACY.ja.md:19; apps/web-app/PRIVACY.de.md:47; apps/web-app/PRIVACY.fr.md:51; apps/web-app/PRIVACY.ko.md:19; apps/web-app/PRIVACY.zh.md:19. The locales/*.json key glamour charaHintGlamour (line 1167 in each) names model numbers + facewear ID without a count, so it is accurate and needs no edit.

## Status
OPEN
