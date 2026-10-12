# Korean (ko) policy translations: meaning review (2026-10-11)

Method: each variant read in full against its English file at HEAD 42c35e87 (served 16a6123f is identical for these files). Quoted UI labels checked against apps/web-app/src/locales/ko.json and packages/bot-logic/src/i18n/locales/ko.json. Game nouns checked against docs/reference/ffxiv-terminology.md and glossary.md (moderator = 조정자 in policy documents, glossary.md:114).

Checks that passed on all four files: English-prevails notice at line 3, links the English file; no 자사/당사/회사 (operator voiced as 저희); no 글래머 (policies use 의상 for one outfit, 코디 리더 only as the tool name, as terminology.md prescribes); 얼굴 소품 for facewear; 장터 for Market Board; 조정자 for moderator; no hard-wrapped paragraph; command names, hostnames, storage names, retention numbers (30/60/90/120 s/180 days/12 months/7 days/13), section numbers and cross-reference headings (*사용 분석*, *조정 기록*, *데이터 보관*, *사용자의 권리*, *데이터 삭제*, *커뮤니티 프리셋: 저희가 보관하는 정보*) verbatim or matching the translated headings; North Carolina governing-law clauses, liability, survival and consumer-protection clauses read twice, modifiers attach correctly.

Quoted UI labels verified against web-app ko.json: XIV 염색 도구 정보 (L9/L16), 정책 (L29), 개인정보처리방침 (L30), 이미지는 브라우저 안에서만 읽히며 업로드되지 않습니다. (L303), 고급 설정 (L221), 설정 초기화 (L222), 즐겨찾기 지우기 (L226), 저장된 팔레트 지우기 (L228), 컬렉션 관리 (L748), 컬렉션 삭제 (L730), 분석 활성화 (L233), 장터 활성화 (L156), 내 제출물 (L858), 장비 목록 (L1367), 모두 초기화 (L1382), 다음에서 열기… (L1243), 투표/투표함 (L982-983 region), 로그아웃 (L220), tool names (L41-101). Bot exclusion categories 메탈릭/파스텔/다크/코스모/이슈가르드/고가/상인/제작, 부족 (clan) and 마켓 서버 (world) match bot-logic ko.json L406-413, L356-358.

## apps/web-app/PRIVACY.ko.md vs PRIVACY.md
Sections compared (all): intro; Images and camera captures; Character files; What is stored on your device; Network access (items 1-5, links to other sites, example links); Community presets: what we keep (daily limits, Discord posts, failed notifications, ban records, moderation log); Usage analytics; Your IP address and logs; How to verify; Deleting your data; Questions.
Result: every section present and equivalent. No dropped obligation, no added claim, no weaker or stronger clause. 2026-10-05 cutoff, Sec-GPC/GPC rule, doNotStore note, ban-lift clearing rule, 8-character XIVAuth fallback name all match. Findings: cand 01 (cross-links go to English), cand 02 (서버 used for three things).

## apps/web-app/TERMS_OF_SERVICE.ko.md vs TERMS_OF_SERVICE.md
Sections compared: intro; What the site does; Accounts; Community presets (ownership, conduct, moderation, appeals); Using the site fairly; Other people's services; Square Enix material; Age; Availability; No warranty; Limits on liability; Changes; Ending things; Governing law; Contact.
Result: meaning equivalent throughout; 길(Gil) matches terminology.md:106. Finding: cand 01 only (L5, L13, L51 link PRIVACY.md / bot terms in English).

## apps/discord-worker/PRIVACY_POLICY.ko.md vs PRIVACY_POLICY.md
Sections compared: 1-12 and the closing acknowledgement, including all four tables (collected data, usage analytics, storage, retention) row by row.
Result: equivalent; every table row, failure class and retention period matches. No findings.

## apps/discord-worker/TERMS_OF_SERVICE.ko.md vs TERMS_OF_SERVICE.md
Sections compared: 1-12 and closing acknowledgement.
Result: equivalent. Finding: cand 01 only (L7 links the English privacy policy and web terms).

No handoff-security claim differences were found.
