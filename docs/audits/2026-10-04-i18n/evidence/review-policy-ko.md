# Review: policy-ko (Korean policy documents), 2026-10-04

Revisions: BASE 5c80fcba, MAIN 8ecb878f, HEAD preview. Reviewer read the English and ko HEAD files in full for
web-app PRIVACY + TERMS_OF_SERVICE and discord-worker PRIVACY_POLICY, the discord-worker TERMS_OF_SERVICE ko diff
and surrounding lines, plus all eight *.main.diff / *.pr.diff pairs for these documents.

## Candidates

| id | tier | file:line | claim |
|---|---|---|---|
| I18N-1 | P3 | apps/web-app/TERMS_OF_SERVICE.ko.md:11 | Says `열 가지 도구` (ten) but lists nine: Glamour Reader (`코디 리더`) missing; English TERMS_OF_SERVICE.md:15-17 names it. Origin MAIN (BASE->MAIN changed 아홉 to 열 without adding the item). |
| TERM-1 | P2 | apps/web-app/PRIVACY.ko.md:13 and :40/:60/:62/:63 vs apps/web-app/TERMS_OF_SERVICE.ko.md:39,41 and apps/discord-worker/TERMS_OF_SERVICE.ko.md:57,59,67 | "Moderator" has two names: `조정자` (PRIVACY ko x6, Discord PRIVACY ko x7) vs `운영자` (both TERMS, plus PRIVACY.ko.md:13 `운영자가 승인하면`). `운영자` is also the word for "the operator" (house trap: operator is one person), so a reader can take moderators as the operator. Moderator is unpinned in the dictionary; bot-logic ko.json:465 uses `{moderator} 님`. Origin PR#223 for PRIVACY.ko.md:13, MAIN for the TERMS lines. |
| I18N-2 | P3 | apps/web-app/PRIVACY.ko.md:60 and apps/discord-worker/PRIVACY_POLICY.ko.md:116 | `숨겨진 사용자의 프리셋 수` parses as "the hidden user's preset count"; English "how many of your presets were hidden" = `숨겨진 프리셋의 수`. Modifier on the wrong noun, same facts. Origin PR#230 (web), PR#227 (bot). |
| TERM-2 | P3 | apps/web-app/PRIVACY.ko.md:30 | `해당 복장의` for "that outfit"; the rest of the ko policies use `의상` (documented policy register, ffxiv-terminology.md:275-278). Two words for one concept. Origin PR#223. |
| TERM-3 | P3 | apps/discord-worker/PRIVACY_POLICY.ko.md:28 | `기본 마켓 서버 / 데이터 센터` for "default world / data center": World is `서버` (dictionary), `마켓` is not a pinned word (Market Board = `장터`). Unchanged since BASE (not in the delta). Origin MAIN. |
| I18N-3 | P3 (locale `en`) | apps/web-app/PRIVACY.md:157-158 and apps/discord-worker/PRIVACY_POLICY.md:187 | English-side ambiguity: "after 90 days if nobody does" / "90 days if unresolved" does not say 90 days from when. The ko (`PRIVACY.ko.md:61`, `PRIVACY_POLICY.ko.md:189`) and presumably the other locales copy the ambiguity. Origin PR#230 / PR#227. Suggested: "90 days after it was created". |

## Checked and right (positive controls)

- Last updated dates agree with English (web privacy/terms 2026-10-04; bot privacy 2026-10-04 = October 4, 2026; bot terms 2026-09-28 = September 28, 2026). All four carry the ko English-prevails notice.
- Every quoted UI label equals the current `apps/web-app/src/locales/ko.json` value: `about.title`, `about.privacyPolicy` (XIV 염색 도구 정보 -> 개인정보처리방침), `config.advancedSettings`, `resetSettings`, `clearFavorites`, `clearPalettes`, `collections.manageCollections` / `deleteCollection`, `preset.mySubmissions`, `preset.vote` / `voted` (투표 / 투표함), `config.enableAnalytics`, `config.showPrices`, `swatch.itemLinks.openIn`, `glamour.sheet.title` (장비 목록), `glamour.sheet.reset` (모두 초기화), `auth logout`, and the Extractor `privacyNote` sentence verbatim (ko.json:307).
- Glamour Reader = `코디 리더` (dictionary ffxiv-terminology.md:280); Facewear slot = `얼굴 소품` (dictionary row 313); `의상` for the policy register (dictionary 275-278).
- Retention numbers verbatim in every changed passage: 30 days (daily limits, failed notifications, deletion requests), 90 days (failed notification, ban record), 12 months, 60 s / 120 s, 180 days, 7 days. Hosts/names verbatim: api/auth/shots/data.xivdyetools.app, XIVAPI, Perspective `doNotStore`, "XIVAuth User" + first 8 characters, email, Discord invite, `/glamour`, `/swatch`.
- No claim softened or added in the PR#223 / #230 / #227 hunks: ban-active exceptions, deletion paths (My Submissions, vote toggle, sign-out, private request route), "posts made since Last updated do not show your Discord user ID; older posts may", ban-record clearing (name and reason at once, record after 90 days), moderation-log 12 months / preset lifetime, XIVAuth->Discord migration of presets/votes/limits, vote-on-submit, pre-edit version retention all match sentence by sentence.
- Operator voice is `저희` / `저희 자체` (never 자사/당사). One paragraph per line: no hard wraps in any of the four files (script check; only list items follow each other). No English-only lines (only the copyright line, discord TERMS:75, by design). Register `합니다` throughout.

## Rejected

- ko `"이에 국한되지 않습니다"` in web TERMS:92 (no-warranty): English has no "without limitation" but "including" is open-ended in legal English; same meaning.
- Added `(**투표** / **투표함**)` in PRIVACY.ko.md:103: extra detail, labels exist and are correct, no promise change.
- `서버` for Discord server (`저희 Discord 서버`), our servers (:88) and World (:38, :80): every Discord use is qualified by `Discord`; World = `서버` is the dictionary choice. Not filed.
- 블렌드 vs 혼합 for blend: the locale JSON itself mixes both; not a policy defect.
- `조정` (adjustment) as the word for moderation: unpinned in the dictionary (ko.json uses 검토); folded into TERM-1 as a pointer, no "right word" asserted.
- Discord PRIVACY ko:28 category names (메탈릭, 파스텔 ...) are filter names, not core category names; unchanged since BASE.

## Files covered

apps/web-app/PRIVACY.ko.md (all 117 lines), apps/web-app/TERMS_OF_SERVICE.ko.md (all), apps/discord-worker/PRIVACY_POLICY.ko.md (all), apps/discord-worker/TERMS_OF_SERVICE.ko.md (lines 20-100 + diff); English HEAD counterparts and the matching *.main.diff / *.pr.diff in evidence/delta/diffs/ (web PRIVACY, web TERMS, bot PRIVACY, bot TERMS main); docs/reference/ffxiv-terminology.md; apps/web-app/src/locales/ko.json; packages/core ko locale (categories, clans, Facewear).
