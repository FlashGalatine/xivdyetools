# Review: policy-ko (Korean translations of the four policy documents)

Scope: apps/web-app/PRIVACY.ko.md, apps/web-app/TERMS_OF_SERVICE.ko.md, apps/discord-worker/PRIVACY_POLICY.ko.md, apps/discord-worker/TERMS_OF_SERVICE.ko.md, each read in full against its English governing file. Date on all eight files: 2026-09-28 / September 28, 2026 (same date in both). Mechanical parity (evidence/policy-locale-parity.txt) shows "ok ko" for all four. No code was run; this is a reading review.

## (1) Entry points / authz matrix
Not applicable: the unit under review is four static Markdown documents, with no routes, commands or bindings. Reach: public on GitHub. The web-app links them from the About modal (`about.privacyPolicy` / `about.termsOfService`, `about-modal.ts:445-459`). The bot policy is registered as a developer-portal URL that points at the English file, so a reader reaches the Korean file only from the repo listing. Anyone can read them (INTERNET-UNAUTH); nobody can call anything.

## Checklist: pitfalls from policy-documents.md "What the first translation pass taught"
| Pitfall | Where I checked | Result |
|---|---|---|
| Operator is one person, not a company (자사 / 당사 / 회사) | grep over all four ko files | none present; 저희 used throughout |
| Modifier on the wrong verb (survival, governing law, liability) | web ToS "종료" and "준거법"; bot ToS section 11; liability clauses in both ToS | correct: presets may stay up after you leave, under the licence; consumer-rights clause = 거주하는 지역의 법이 부여하고 그 법이 포기할 수 없도록 정한 (whose law and non-waivability both attached correctly) in both ToS |
| False friends (abuse / use / exploit) | bot ToS section 4 | 남용, 악용 또는 우회 = abuse, exploit, circumvent; correct |
| One word for two things (서버 for Discord server vs World) | web PRIVACY item 1 and never-stored list; bot PRIVACY preferences row | web uses 서버 for World, which is the shipped web label (ko.json:573 `"server": "서버:"`); bot uses 마켓 서버 (bot ko.json:357). In the bot policy 서버 means the Discord server or Cloudflare edge servers only; no collision |
| Quoted UI labels vs current ko.json | web: 가격 표시 (157), 고급 설정 (225), 설정 초기화 (226), 분석 활성화 (237), 다음에서 열기… (1276), 장비 목록 (1398), 모두 초기화 (1412), "이미지는 브라우저 안에서만 읽히며 업로드되지 않습니다" (307), About path "XIV 염색 도구 정보 → 개인정보처리방침" (about.title ko.json:15 + about.privacyPolicy :30) | all match current strings. Bot policy quotes only slash commands (verbatim) |
| English can be the stale one | same labels against en.json:30,157,225,226,237,1276,1398,1412 | English labels also current (Privacy, Show Prices, Advanced Settings, Enable Analytics, Open in…, Glamour list, Reset all) |
| Game nouns need the dictionary | Glamour Reader = 코디 리더 (ko.json:104), facewear = 얼굴 소품 (ffxiv-terminology.md:313), clan = 부족, World = 마켓 서버 / 서버 | consistent with dictionary and shipped labels; no 글래머 |
| Gate forcing unnatural wording (제3자 vs 제삼자) | grep | 제삼자 absent; "석 달" for "about three months" is digit-free as required |
| Ambiguous English fixed on 2026-09-20 | ToS governing law, bot ToS section 3 colour matching | both ko render the fixed English reading |
| Never hard-wrap CJK | script counting Hangul-to-Hangul line breaks | 0 in all four files |

## 2026-09-28 content change (2e4cb0cb), hunks read first
- web PRIVACY: Glamour Reader in tool list (present); gear lookup sentence with model numbers plus facewear id, XIVAPI receives only the numbers, names / acquisition / icons return from data.xivdyetools.app (all present, same recipients); Acquisition lines plus "Reset all" under localStorage (present, label matches); Open-in menu attributed to the Glamour Reader (present). Same claims.
- web ToS: XIVAPI bullet present; Saddlebag moved to the dye card (present). Glamour Reader missing from the "ten tools" list: handoff 1.
- bot PRIVACY: `.chara` files in the not-collected list, new "캐릭터 파일" subsection (download, in-memory, discard, never stored; only model numbers and facewear id to our API, nothing about the user), XIVAPI row: all present, same claims.
- bot ToS: seven new section 3 bullets with slash commands, section 6 item names plus XIVAPI: present.

## Per-document section tables
### apps/web-app/PRIVACY.ko.md (vs PRIVACY.md)
| § | verdict | note |
|---|---|---|
| Header / notice / intro | same claims | "complete list" closure kept |
| Images and camera | same claims | never leave device, never in storage, discarded on clear/close/reload |
| Character files | same claims | name never sent or shown; local-only fallback exception; model-number request unchanged |
| Stored on your device | same claims | list, "Reset settings", "Reset all" paths intact |
| Network access 1-5 | same claims | recipients, Perspective doNotStore, no account identity, deletion pointer, avatars via Discord CDN |
| Links to other sites | same claims | referrer suppressed; only item id or name in URL |
| Usage analytics | same claims | default off, GPC, server-side Sec-GPC discard, off stops immediately and discards unsent, 4 event kinds, five dimensions, never-stored list, about 3 months |
| IP address and logs | same claims | 60 s, 120 s KV fallback, never stored with anything, Workers Logs off on every worker |
| How to verify / Questions | same claims | |

### apps/web-app/TERMS_OF_SERVICE.ko.md
| § | verdict | note |
|---|---|---|
| Intro, Accounts | same claims | no password seen or stored; provider ID plus username; revoke at provider |
| What the site does | same claims, one list item missing | handoff 1 |
| Community presets, Moderation, Appeals (7 days) | same claims | hold-when-uncertain preserved |
| Fair use, Other services, Square Enix, Age, Availability | same claims | |
| Warranty, Liability, Changes, Ending, Governing law, Contact | same claims | see pitfall table for survival and waiver clauses |

### apps/discord-worker/PRIVACY_POLICY.ko.md
| § | verdict | note |
|---|---|---|
| 1 Introduction | same claims | |
| 2 Data collected (4 tables) | same claims | all rows; retention values (180 d, 30 d, 60/120 s, 3 months) equal |
| 3 Not collected, Image / Character files | same claims | |
| 4 Use, 5 Storage, Security, Operational logs | same claims | two log lines carry the user id; Workers Logs off |
| 6 Third parties | same claims | XIVAPI row added; Perspective still listed |
| 7 Rights | same claims | /preferences show, reset, reset key:<preference>, /preset favorite list/remove, email and Discord paths, 30 days |
| 8 Retention, 9-12 | same claims | |

### apps/discord-worker/TERMS_OF_SERVICE.ko.md
| § | verdict | note |
|---|---|---|
| 1-3 | same claims | 11 bullets, commands verbatim |
| 4-5 | same claims | |
| 6-10 | same claims | |
| 11 Governing law | same claims | |
| 12 Contact | same claims | |

## In-product copy vs ko policy
web ko.json `privacyNote` (307) says images are read in the browser and never uploaded: same as policy. `analyticsDesc` (238): anonymous, no identifiers, no images: consistent. `sheet.privacy` (1411): edits kept on this device per outfit, name never in list, file never saved: consistent. Login `privacyNote` (1033) says "display name": handoff 3. Bot ko.json:690 says the .chara file is read once and not stored: consistent with the bot policy.

## (2) Positive controls
- All four ko files open (line 3) with the translated "convenience translation, English prevails" notice and a link to the English file.
- Every opt-out / deletion path quoted in the web document (고급 설정 → 분석 활성화, 설정 초기화, 모두 초기화) matches the shipped label; every bot command and the email / Discord deletion path is verbatim.
- No "never" promise or closure sentence was softened anywhere.

## (3) Rejected
- 서버 for "world" in web PRIVACY never-stored list: it is the shipped web label (ko.json:573), not a divergence.
- 운영자 used for "moderators" in web ToS: reads as moderators in context; not the operator-as-company pitfall.
- 석 달 for "about three months": equivalent, intentionally digit-free.
- Bot policy 저희 서버 for "our servers": means Cloudflare edge / our infrastructure, same as English.

## (4) Files covered
The four ko files and four English files above in full; `git show 2e4cb0cb` for the four English files; apps/web-app/src/locales/ko.json and en.json (header, about, settings, glamour sheet, privacyNote strings); packages/bot-logic/src/i18n/locales/ko.json (greps for glamour / world / server / privacy); docs/reference/ffxiv-terminology.md (lines 57, 313); apps/web-app/src/components/about-modal.ts (445-459); .agents/skills/audit-shared/policy-documents.md; DEPRECATIONS.md (Perspective); evidence/policy-locale-parity.txt.

## (5) Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| (none) | | | | No claim-level divergence found in the Korean variants. |

## (6) Handoffs
1. DOC: apps/web-app/TERMS_OF_SERVICE.ko.md "이 사이트가 하는 일" says 열 가지 도구 but lists nine; 코디 리더 (Glamour Reader) is missing between 스와치 매처 and 커뮤니티 프리셋 브라우저. English lists it. Service description only, no data or rights claim. Fix as part of a six-file edit with date bump (check ja/zh/de/fr too).
2. DOC: the Perspective API is listed in web PRIVACY item 3 and bot PRIVACY section 6 (all languages) but the service shuts down 2026-12-31 (DEPRECATIONS.md:10-15); expect a six-file edit when the code removes it.
3. DOC: web ko.json:1033 says 표시 이름 ("display name") and 투고한 팔레트; the policies say 사용자 이름 (username) and 프리셋. en.json:1033 has the same "display name" wording, so this is an in-product vs policy terminology gap, not Korean-only.
4. I18N: web ko docs use 운영자 for moderators and 관리자 for the maintainer; consistent enough, note only if the glossary wants one word each.
5. I18N: bot PRIVACY ko "사용 통계 구간" (bucket) and "원격 측정" (telemetry) read stiffly; optional polish.
