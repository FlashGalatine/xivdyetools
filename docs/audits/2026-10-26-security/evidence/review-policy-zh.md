# review-policy-zh — translation meaning review, locale `zh` (2026-10-26, HEAD 13c386e5)

Scope: meaning parity (policy-documents.md item 6) and in-product agreement (item 7) for the four
`zh` policy variants. The mechanical gate (items 1-5) already passes
(`evidence/policy-locale-parity.txt`: PASS, 0 problem groups). All four zh files were last committed
in 3aed1596 (2026-10-12T13:35:50-04:00), the same commit as their English governing files.

Result: **0 candidates.** Every section of all four documents was read in both languages, sentence
by sentence. No softened "never", no dropped right / opt-out / deletion path, no field listed in
English only, no changed number / host / command / retention period, no untranslated sentence, no
operator-as-company, and no misattached modifier in the liability, governing-law or survival clauses.

## Section table (document x section -> verdict)

| Document | Sections compared | Verdict |
|---|---|---|
| apps/web-app/PRIVACY.zh.md (117 lines) vs PRIVACY.md (279) | intro; Images and camera captures; Character files; What is stored on your device (6 bullets); IndexedDB; Network access (5 items); Links that take you to other sites; Community presets: what we keep (6 bullets); Usage analytics; IP address and logs (3 bullets); How to verify; Deleting your data; Questions | same claims |
| apps/web-app/TERMS_OF_SERVICE.zh.md (119) vs TERMS_OF_SERVICE.md (177) | intro; What the site does; Accounts; Community presets (ownership/license, conduct, moderation, appeals); Using the site fairly; Other people's services; Square Enix; Age; Availability; No warranty; Liability; Changes; Ending things; Governing law; Contact | same claims |
| apps/discord-worker/PRIVACY_POLICY.zh.md (223) vs PRIVACY_POLICY.md (223) | sections 1-12 including all tables (2 collected/provided, rate limiting, usage analytics, moderation records; 3 not-collected list, image and .chara processing; 4 use table; 5 storage table, security, operational logs; 6 third parties; 7 rights; 8 retention table 15 rows; 9-12) | same claims |
| apps/discord-worker/TERMS_OF_SERVICE.zh.md (148) vs TERMS_OF_SERVICE.md (148) | sections 1-12 | same claims |

Line-count differences on the web documents come from English hard wraps vs one-paragraph-per-line
CJK; heading and bullet counts match.

## Clauses read twice (lessons from the first translation pass)

- Survival: web TOS "Presets you published may stay up after you leave" -> zh:108
  `您发布的预设在您离开后可能仍会保留在线上，依据上文所述的许可` (the license-survival promise is intact; the
  2026-09-20 misattachment is fixed).
- Non-waivable consumer rights: web TOS zh:112 and bot TOS zh:136
  `本条款中的任何内容都不会剥夺您居住地法律赋予且该法律不允许放弃的消费者保护权利` (whose law = place of
  residence; non-waivability bound to that same law).
- Venue: web TOS zh:112 `您与我们均同意该管辖地`; bot TOS zh:134 `您同意该管辖地` (matches each English).
- Liability: web TOS zh:98 keeps "data, profits, or gil" (`数据、利润或金币`); bot TOS zh:104 matches.
- Operator: no 本公司 anywhere; operator is 我们 throughout.
- Rate limits: web TOS zh:57 `规避速率限制`; bot TOS zh:42 `不试图滥用、利用或规避速率限制`, where 利用
  correctly renders the English "exploit" (not the ja false friend).
- Server vs World: bot PRIVACY zh:22 `服务器 ID／频道 ID` (Discord guild, not stored) vs zh:28
  `默认市场服务器 / 大区` (World, stored) - the shipped label keeps them apart.
- Date-anchored claim: both privacy variants keep `在 2026-10-05 之后发布的帖子不会显示您的 Discord 用户 ID；在该日期当天或之前发布的帖子可能会显示`.

## In-product copy agreement (item 7)

Every UI label the zh web policy quotes exists verbatim in apps/web-app/src/locales/zh.json:
about.about `关于 XIV 染色工具` (:9), about.policiesLabel `政策` (:29), about.privacyPolicy `隐私政策` (:30),
config.enableMarketBoard `启用市场布告板` (:157), config.logout `退出登录` (:221),
config.advancedSettings `高级设置` (:222), resetSettings `重置设置` (:223), clearFavorites `清除收藏夹` (:227),
clearPalettes `清除已保存的调色板` (:229), enableAnalytics `启用分析` (:234),
matcher.privacyNote `图像仅在浏览器中读取，绝不上传。` (:304, quoted verbatim in PRIVACY.zh.md:12),
preset.mySubmissions `我的提交` (:858), preset.voted `已投票` (:989), glamour openIn `在以下网站打开…` (:1249),
glamour sheet title `装备列表` (:1389), reset `全部重置` (:1404).

Privacy strings compared EN vs ZH (scratch: web-zh-privacy.txt, bot-zh-privacy.txt in the session
scratchpad): config.analyticsDesc, preset.privacyNote, preset.fieldLinkHint, preset.cfgStoredLocallyHint,
swatch.charaHint, swatch.charaHintGlamour, glamour.sheet.privacy, glamour.sheet.cardNote; bot
manual5.topics.characterFile.body, firstRun.body, manual.preferences/budget. All make the same claim
as the zh policy variant (e.g. charaHintGlamour `只有其型号编号和面部配饰 ID 会发送到我们的 API。角色名和颜色都留在本机。`
= PRIVACY.zh.md:19; bot `文件仅为生成回复读取一次，不会保存` = PRIVACY_POLICY.zh.md:86-90).

## POSITIVE controls

- English-prevails notice present and localized on line 3 of all four zh files, linking the English file.
- Cross-links stay in zh (`PRIVACY.zh.md`, `../discord-worker/PRIVACY_POLICY.zh.md`, `../web-app/TERMS_OF_SERVICE.zh.md`) with backticked labels unchanged (DOC-073 convention).
- All retention numbers (60 s, 120 s, 30 / 90 days, 12 months, 180 days, 3 months, 50 favorites, 8 characters, 13 years, 7 days) and hosts identical.
- Every "never" in the privacy variants is rendered categorically (绝不 / 绝不会 / 永远不); none softened to "usually not".
- The 2026-09-20 zh corrections (operator, survival clause, Discord server vs World, CJK hard wraps) all hold.

## REJECTED items

| Claim | Reason |
|---|---|
| PRIVACY.zh.md:38 renders "the world or data center you chose" as `您选择的物品 ID 以及所在的服务器或大区` (World as 服务器, "chose" read as "where you are") | i18n handoff: same data sent to the same host; 服务器 = World is the terminology row (docs/reference/ffxiv-terminology.md:288) |
| PRIVACY.zh.md:80 never-stored list says `角色或服务器名称` for "character or world names" (服务器 could be read as Discord server) | i18n handoff: the claim is true under both readings (no Discord server name is stored with events either); terminology row 288 |
| PRIVACY.zh.md:103-104 add UI hints `（此时显示为**已投票**）即可取消` and `点击**退出登录**` not in the English | i18n handoff: labels match zh.json preset.voted / logout; no new commitment or right |
| zh.json glamour.sheet.privacy renders "never in the list ... never saved" as `不会出现在列表中 ... 也不会被保存` | i18n handoff: 不会 is a categorical negative, not a softening |
| TERMS_OF_SERVICE.zh.md:98 "GIL" -> `金币` | terminology row 106 (Gil zh = 金币) |
| Bot TOS zh:42 uses 利用 | correct here: English says "exploit"; the false-friend lesson is ja-only |

## FILES COVERED

12 files: apps/web-app/{PRIVACY.md, PRIVACY.zh.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.zh.md,
src/locales/en.json, src/locales/zh.json}; apps/discord-worker/{PRIVACY_POLICY.md, PRIVACY_POLICY.zh.md,
TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.zh.md}; packages/bot-logic/src/i18n/locales/{en.json, zh.json}
(read via key-filtered extraction); plus .agents/skills/audit-shared/policy-documents.md and
docs/reference/ffxiv-terminology.md for the rules.
Directories: apps/web-app/, apps/web-app/src/locales/, apps/discord-worker/, packages/bot-logic/src/i18n/locales/.
