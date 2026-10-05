# TERM-008: Chinese `glamour.fact.dated` "旧版"; the Chinese client prefixes Dated items 过期
**Tier:** P2 · **Locale(s):** zh · **Deploy unit:** apps/web-app · **Term source:** game data: the zh client's item-name prefix · **Origin:** MAIN

## Location
- `apps/web-app/src/locales/zh.json:1394`

## Evidence
- `apps/api-worker/src/chara/data/item-names.zh.json`: 1,408 names start 过期, none 旧版; #372 Dated Hempen Coif = 过期草布兜帽, printed next to the tag.
- ko 구형 is used by the ko client itself (220 names; another 402 use 낡은), so it is not filed. ja cannot be checked: the repo has no ja item-name table.

## Fix
- "过期".

## Status
OPEN
