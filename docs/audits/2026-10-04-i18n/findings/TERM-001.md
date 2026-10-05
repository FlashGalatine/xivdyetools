# TERM-001: Korean policy documents call the moderator two things: 운영자 and 조정자
**Tier:** P2 · **Locale(s):** ko · **Deploy unit:** apps/web-app + apps/discord-worker · **Term source:** none pinned: the UI says 모더레이터 (web `ko.json:1051`) · **Origin:** PR#223 (`PRIVACY.ko.md:13`) + MAIN

## Location
- 운영자: `apps/web-app/PRIVACY.ko.md:13` "운영자가 승인하면" (new in #223), web `TERMS_OF_SERVICE.ko.md:39,41`, bot `TERMS_OF_SERVICE.ko.md:57,59,67`
- 조정자: `apps/web-app/PRIVACY.ko.md:40,60-63,100`, bot `PRIVACY_POLICY.ko.md:31,57,58,116,118,192,194`

## Evidence
- Two words for one role on the same page. 운영자 also reads as "operator", and in these documents the operator is a separate, single person.

## Fix
- Pick one word, add it to the glossary, and use it in all four ko documents. Line 13 can be fixed inside #223 now (조정자, the word the rest of that file uses).

## Status
OPEN
