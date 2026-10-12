# Review: zh (Simplified Chinese) policy translations, 2026-10-11

Method: each variant read in full against its governing English file (HEAD 42c35e87 == served 16a6123f for these files), section by section; every quoted UI label checked against `apps/web-app/src/locales/zh.json` and `packages/bot-logic/src/i18n/locales/zh.json`; game nouns against `docs/reference/ffxiv-terminology.md` and `glossary.md` (moderator = zh 审核员 pinned for policy text, glossary.md:114).

Global checks (all four files): localized English-prevails notice with link to the English file at line 3 (PASS); one paragraph per line, no hard-wrapped CJK (PASS, scripted check); operator wording (我们, never 本公司; grep for 公司/本公司: 0 hits) PASS; 利用 appears twice, both as "exploit / use as a tool" (TOS.zh web:60, discord TOS:42) which is correct zh; retention numbers, hostnames, storage names, command names, section numbers verbatim PASS; 2026-10-05 go-live date named, not tied to "Last updated" PASS; facewear = 面部配饰 and glamour = 幻化 match terminology doc PASS.

## 1. apps/web-app/PRIVACY.zh.md vs PRIVACY.md
Sections: intro; Images and camera captures; Character files; What is stored on your device; Network access (items 1-5); Links that take you to other sites (incl. example links); Community presets: what we keep (7 bullets); Usage analytics; Your IP address and logs; How to verify; Deleting your data; Questions.
- Intro, Images, Character files, stored-on-device: equivalent. Labels verified: 关于 XIV 染色工具 (zh.json:9), 政策/隐私政策 (29-30), 重置设置/清除收藏夹/清除已保存的调色板 (222-228), 管理集合/删除集合 (748/730), 装备列表/全部重置 (1367/1382), 启用市场布告板 (156), 启用分析 (233), 我的提交 (858), 退出登录 (220), 在以下网站打开… (1243), privacy note (303). All current.
- Network access item 3 (the longest paragraph): every clause present (account record at sign-in, name fallbacks, ban exception on name update, Discord-link migration, vote semantics, pre-edit version retention, Perspective doNotStore, CDN). Equivalent.
- What we keep: 30/30/90/90/12-month figures, the 2026-10-05 Discord-ID cutoff, ban-record fields all match.
- Analytics, IP/logs, Deleting: equivalent (60 s, 120 s, ~3 months, 30 days).
- Findings: cand-01 (collections term), cand-02 (vote button label), cand-03 (DevTools labels), cand-04 (stray spaces), cand-05 (服务器 two meanings).

## 2. apps/web-app/TERMS_OF_SERVICE.zh.md vs TERMS_OF_SERVICE.md
Sections: intro; What the site does; Accounts; Community presets (ownership, conduct, moderation, appeals); Using the site fairly; Other people's services; Square Enix material; Age; Availability; No warranty; Limits on liability; Changes; Ending things; Governing law; Contact.
- Governing law, liability (gil kept as 金币), survival ("may stay up after you leave, under the licence above") and courts-located-in-NC modifier all attach to the right word. 7-day appeals, age 13, licence non-exclusive/royalty-free preserved.
- Findings: cand-01 (收藏集 for collections, lines 11, 88), cand-04 (line 5 spacing).

## 3. apps/discord-worker/PRIVACY_POLICY.zh.md vs PRIVACY_POLICY.md
Sections 1-12 and the footer line: same numbering, tables keep the same rows and retention cells (60/120 s, 30 d, 180 d, 3 months, 90 d, 12 months). Commands verbatim (`/preferences reset key:<preference>`, `/preset favorite add|list|remove`). 默认市场服务器 / 大区 uses the shipped 市场服务器 (bot zh.json:358). Dye-category labels 金属/粉彩/暗色/宇宙/伊修加德/高价/商店/制作 match bot zh.json:406-413. 我的提交 matches the web label. Equivalent throughout.
- Findings: cand-04 (line 202 spacing).

## 4. apps/discord-worker/TERMS_OF_SERVICE.zh.md vs TERMS_OF_SERVICE.md
Sections 1-12 and footer: equivalent. Feature list uses shipped harmony names 互补色/类似色/三角配色 (core zh.json:178-180). Governing law, liability, termination, modifications correct. No findings.
