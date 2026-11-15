# review-policy-ko — Korean policy translation meaning review (2026-10-26, HEAD 13c386e5)

Reviewer key: `policy-ko` (deploy unit: policy translation ko). Method: read
`.agents/skills/audit-shared/policy-documents.md` ("What the first translation pass taught"), then
each English governing file and its `.ko.md` sibling in full, section by section; then the privacy
strings in `apps/web-app/src/locales/{en,ko}.json` and `packages/bot-logic/src/i18n/locales/{en,ko}.json`.
`evidence/policy-locale-parity.txt` reports `ok ko` for all four documents (lines 5, 11, 17, 23) and
`PASS — 0 problem group(s)`; this review covers item 6 (meaning) and item 7 (in-product copy).

## Module / section table

| Document (EN : KO lines) | Sections compared | Verdict |
|---|---|---|
| `apps/web-app/PRIVACY.md` (279) : `PRIVACY.ko.md` (117, one paragraph per line) | intro, Images, `.chara`, on-device storage (6 in-app controls), Network access 1-5, outbound links, presets retention (6 bullets), analytics (4 events, 5 dims, never-stored list), IP/logs, verify, deletion, questions | Same claims. All numbers (8 chars, 30/90 days, 12 months, 60 s, 120 s, ~3 months, 2026-10-05, 30-day SLA) and hosts verbatim. |
| `apps/web-app/TERMS_OF_SERVICE.md` : `.ko.md` | intro, tools, accounts, license, conduct, moderation, appeals (7 days), fair use, third parties, SE material, age 13, availability, warranty, liability, changes, ending, governing law, contact | Same claims; survival clause ko:108 and consumer-right clause ko:112 attach modifiers correctly. |
| `apps/discord-worker/PRIVACY_POLICY.md` : `.ko.md` | §1-§12 incl. both data tables, rate limiting, usage analytics table, moderation records, Do-NOT-collect list (9), image/.chara processing, use table, storage table, logs, third parties, rights, retention table (17 rows), children, transfers, changes | Same claims; row counts and retention values match. |
| `apps/discord-worker/TERMS_OF_SERVICE.md` : `.ko.md` | §1-§12 | Same claims. |
| web `ko.json` privacy strings | `about.privacyPolicy`:30, `config.analyticsDesc`:235, `extractor.privacyNote`:304, auth `privacyNote`:1018, `shotSlot`:982, `cfgStoredLocallyHint`:1093, `swatch.charaHint`:1166, `swatch.charaHintGlamour`:1167, glamour sheet `privacy`:1403 | One divergence: `swatch.charaHint` (candidate policy-ko-01). |
| bot `ko.json` | manual `.chara` body :712 ("read once ... not stored"), favorites :124, removed :221 | Same claims. |

UI labels the ko policy quotes, verified against current `ko.json`: 고급 설정 (:222), 설정 초기화
(:223), 즐겨찾기 지우기 (:227), 저장된 팔레트 지우기 (:229), 분석 활성화 (:234), 장터 활성화 (:157),
로그아웃 (:221), 내 제출물 (:858), 투표/투표함 (:988-989), XIV 염색 도구 정보 (:16), 정책 (:29),
개인정보처리방침 (:30), 장비 목록 (:1389), 모두 초기화 (:1404), 다음에서 열기… (:1249), and the quoted
extractor notice (`PRIVACY.ko.md:12` = `ko.json:304` exactly). All current.

## Candidates

- **policy-ko-01 (LOW, INTERNET-UNAUTH)** — `apps/web-app/src/locales/ko.json:1166` `swatch.charaHint`
  says "아무것도 전송하지 않습니다" (nothing is transmitted) where `en.json:1166` says "Nothing is
  uploaded". The hint is shown only on the Swatch Matcher (`swatch-tool.ts:1384` builds `CharaFileCard`
  without `sendsGearIds`; `chara-file-card.ts:108`), which never calls `/v1/chara/resolve`; but with
  analytics opted in, every load sends a `chara_parse` event (`chara-file-loader.ts:109,125`,
  accepted at `api-worker/src/telemetry/schema.ts:114`, disclosed in `PRIVACY.ko.md:75`). So the ko
  string promises more than the English when analytics is on; the payload is only `ok` + producer
  bucket, hence LOW. Precedent: the 2026-10-03 run routed the same de/fr wording to I18N handoff
  (`2026-10-03-security/evidence/handoffs.md:63,272`) while FINDING-012 was open; de :1166
  "Nichts wird übertragen", fr "Rien n'est envoyé", ja "送信はしません" still share it, zh "不会上传"
  matches English. Coordinator may merge or downgrade to I18N handoff.

## POSITIVE controls

- English-prevails notice present and localized on all four ko files (line 3), linking the English file.
- Operator never rendered as a company: `git grep -E "자사|당사|회사|기업"` over the four ko files → no hit
  (rc=1); "저희" throughout. No 제삼자 respelling, no 글래머 (glamour = 코디).
- Every "never" kept strong: 절대 on character names (PRIVACY.ko:17-18), GPC (:69), never-stored list
  (:80), bot Do-NOT-collect list (PRIVACY_POLICY.ko:64-74), logs (:129).
- Every right / deletion path kept: in-app controls (PRIVACY.ko:25-30), deletion section incl. ban
  exception and 30-day SLA (:100-113); bot rights §7 and retention §8 row-for-row.
- Governing-law, liability and license-survival clauses read twice: web ToS ko:108/112, bot ToS
  ko:104/134/136 attach "after you leave", "the same law", "maximum extent permitted" to the right verbs.
- Date anchor is the fixed ISO date 2026-10-05 with the go-live day handled ("당일 또는 그 이전").
- Cross-links target ko siblings, backticked labels unchanged (per DOC-073).

## REJECTED

- `PRIVACY.ko.md:80` "서버 이름" for "world names" (and :38 "서버 또는 데이터 센터") — 서버 is the official
  KO term for World (`docs/reference/ffxiv-terminology.md:288-292`); the never-stored claim stays true
  under either reading (no Discord-server or world name is in telemetry). i18n handoff at most.
- `PRIVACY.ko.md:63` moderation log names "사용자" where English says "account" — same subject, no
  commitment change. i18n handoff.
- `TERMS_OF_SERVICE.ko.md:80` "정보 제공 목적으로만" adds "only" to the Square Enix data-use sentence —
  narrows our own use, no user-data claim; the bot ToS English (:79) already says "only". i18n handoff.
- `PRIVACY_POLICY.ko.md:30` "다른 내용은 담지 않습니다" (no *other* content) for "carries no content" —
  the marker itself is the only content; same claim.
- `PRIVACY.ko.md:88` bolds **60초** (English unbolded) — typography.
- `ko.json:982` shotSlot "링크만 저장" (only the link saved) for "LINKED, NOT UPLOADED" — same meaning.
- `PRIVACY.ko.md:103-104` add the button labels 투표/투표함 and bold 로그아웃 — current labels, helpful,
  no claim change.

## FILES COVERED

17 files: `apps/web-app/{PRIVACY,PRIVACY.ko,TERMS_OF_SERVICE,TERMS_OF_SERVICE.ko}.md`,
`apps/discord-worker/{PRIVACY_POLICY,PRIVACY_POLICY.ko,TERMS_OF_SERVICE,TERMS_OF_SERVICE.ko}.md`,
`apps/web-app/src/locales/{en,ko}.json` (privacy/label keys), `packages/bot-logic/src/i18n/locales/{en,ko}.json`
(privacy/data keys), `apps/web-app/src/components/{chara-file-card,swatch-tool}.ts` (hint selection),
`apps/web-app/src/services/chara-file-loader.ts`, `apps/api-worker/src/telemetry/schema.ts`,
`.agents/skills/audit-shared/policy-documents.md`, `docs/reference/ffxiv-terminology.md`.
Directories: apps/web-app, apps/web-app/src/{locales,components,services}, apps/discord-worker,
packages/bot-logic/src/i18n/locales, apps/api-worker/src/telemetry, .agents/skills/audit-shared, docs/reference.
