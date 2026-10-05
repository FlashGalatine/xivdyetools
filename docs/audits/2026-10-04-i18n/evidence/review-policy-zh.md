# Review: policy-zh (Simplified Chinese policy documents)

Reviewer slice: `apps/web-app/PRIVACY.zh.md`, `apps/web-app/TERMS_OF_SERVICE.zh.md`,
`apps/discord-worker/PRIVACY_POLICY.zh.md`, `apps/discord-worker/TERMS_OF_SERVICE.zh.md` at HEAD, compared
against the HEAD English files for every hunk in the `*.main.diff` and `*.pr.diff` files.

## Candidates

| cand | prefix | tier | file:line | origin | claim |
|---|---|---|---|---|---|
| ZH-1 | I18N | P2 | apps/web-app/TERMS_OF_SERVICE.zh.md:11 | MAIN | English lists ten tools, including "Glamour Reader" (`TERMS_OF_SERVICE.md` "Ten tools run in your browser: ... Swatch Matcher, Glamour Reader, and the community Presets browser"). zh says `十个工具` but lists nine: `...色板匹配器，以及社区预设浏览器`. 幻化查看器 (web zh.json `tools.glamour.title`) is missing. |
| ZH-2 | TERM | P3 | apps/web-app/PRIVACY.zh.md:13 | PR#223 | One word for one role: "moderator" is `版主` once ("在版主批准后"), and `审核员` in the other 15 places in this file and in all other zh policy documents. |
| ZH-3 | TERM | P3 | apps/web-app/PRIVACY.zh.md:29 and apps/web-app/TERMS_OF_SERVICE.zh.md:21 | PR#223 / pre-BASE | "Sign out" is `登出` (`登出会删除会话令牌`; `即可登出`) but the UI label and PRIVACY.zh.md:104 use `退出登录` (web zh.json `config.logout`). Two words for one action. |

No English-side ambiguity candidates (locale en) beyond those already covered by the american-spelling sweep
(`colour`, `favourite`, `centre` in `PRIVACY.md` / `TERMS_OF_SERVICE.md` — `american-spelling-all.txt:436-445`; belongs to that slice).

## What I compared (changed sections only, sentence by sentence)

web-app PRIVACY (MAIN hunks: Last updated, tool list, `.chara` gear lookup, localStorage, Open in…; PR hunks: Images
exception and preview image, localStorage reset list, network item 3 account-record/author-name/vote/hold-for-review,
example link, "Community presets: what we keep" in full (daily limits 30 days, Discord channels, failed notifications
30/90 days, ban records 90 days, moderation log 12 months), Verify step 3, "Deleting your data" in full (30 days,
email, Discord DM, GitHub-issue warning, active-ban exception), Questions?). Retention numbers, hosts
(`api.xivdyetools.app`, `shots.xivdyetools.app`, `data.xivdyetools.app`, `auth.xivdyetools.app`), `doNotStore`,
email, invite URL, "XIVAuth User" + first 8 characters, WebP, `localStorage` / `IndexedDB`: all verbatim and equal.
web-app TERMS (MAIN: Ten tools, XIVAPI, dye-card links; PR: account-record name, example link): faithful except ZH-1.
discord-worker PRIVACY (MAIN: `.chara` row, Character Files section, XIVAPI row; PR: display name, preferences
timestamp, preset submissions retention, votes, Moderation Records, Discord row, deletion paragraph, Data Retention
table rows): faithful. discord-worker TERMS (MAIN: five feature bullets, item names, XIVAPI): faithful.

## Positive controls

- Nothing softened or dropped: "never", "绝不", "immediately", "at once" (立即), "not while a ban is active"
  (封禁生效期间除外), "does not delete your saved work", "the active-ban post/record is not deleted on request" all present.
- Operator is `我们` throughout; no `本公司` / `我司` in any of the four files.
- Every quoted UI label equals the HEAD value: 重置设置, 清除收藏夹, 清除已保存的调色板, 管理集合, 删除集合,
  我的提交, 全部重置 (`glamour.sheet.reset`), 装备列表 (`glamour.sheet.title`), 在以下网站打开… (`swatch.itemLinks.openIn`),
  启用分析, 高级设置, 关于 → 隐私政策, 图像仅在浏览器中读取，绝不上传 (`matcher.privacyNote`), 显示价格.
- Tool names equal `tools.*.title` in zh.json: 色板匹配器, 幻化查看器, 色彩和谐探索器, 预算建议, 无障碍检查器; the bot
  documents use the same 幻化查看器 as web zh.json and og-worker `OG_DECK` (`og-strings.test.ts:75`).
- Game nouns: 市场布告板, 服务器 / 大区, 面部配饰 (dictionary Equipment Slots row 16050), 染剂, 幻化; revert = 还原 and
  restore = 恢复, hide = 隐藏, unban = 解除封禁 are kept distinct, matching English revert/restore.
- One paragraph per line: scripted check found no hard wrap between CJK characters in any of the four files.
- Full-width punctuation and register (您) consistent; every variant carries the zh English-prevails notice.
- No sentence left in English other than hosts, product names, commands and quoted API values.

## Rejected

- `脸部配饰` (core locale, "Facewear" dye category) vs `面部配饰` (dictionary slot name, used in the policies and
  `swatch.facewearSlot`): policies refer to the slot, so the dictionary value is correct.
- 「」 vs “” quotation style mixing in PRIVACY.zh.md and bot docs: cosmetic and already split deliberately.
- zh policy 您 vs zh.json glamour.sheet 你: different surfaces, house register is not defined as one for zh.
- `Budget Alternatives` rendered `平价替代` in the bot TERMS feature list vs web `预算建议`: a feature bullet, not a
  tool name; bot zh.json uses 实惠的替代染剂 for the same command.
- Perspective API / doNotStore / curly quotes around “XIVAuth User”: wording only.

## Files covered

apps/web-app/PRIVACY.zh.md, TERMS_OF_SERVICE.zh.md (HEAD, changed sections) vs PRIVACY.md, TERMS_OF_SERVICE.md;
apps/discord-worker/PRIVACY_POLICY.zh.md, TERMS_OF_SERVICE.zh.md vs English; the eight web/bot `*.main.diff` /
`*.pr.diff` pairs; apps/web-app/src/locales/zh.json and en.json (labels); packages/bot-logic/src/i18n/locales/zh.json
(command names); docs/reference/ffxiv-terminology.md (facewear rows).
