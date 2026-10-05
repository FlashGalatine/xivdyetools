# Review: policy-zh (Simplified Chinese policy translations)

Scope: PRIVACY.zh.md and TERMS_OF_SERVICE.zh.md (apps/web-app), PRIVACY_POLICY.zh.md and TERMS_OF_SERVICE.zh.md (apps/discord-worker), each read sentence by sentence against the English file. All four carry the localized English-prevails notice with a link, and `Last updated` = 2026-09-28 in all (matches English and the parity run, evidence/policy-locale-parity.txt lines 6/12/18/24 "ok zh"). Result: **no claim-level divergence found**; 0 candidates. Handoffs below are notice-level.

## (1) Entry-point table / authz matrix
Not applicable: documentation-only review, no routes, commands or bindings were examined. Reachability: all four files are public repo documents (INTERNET-UNAUTH readers). The About modal links the viewer-locale variant (policy-documents.md table).

## Checklist from policy-documents.md "What the first translation pass taught" and where checked
| Pitfall | Where I checked | Result |
|---|---|---|
| Operator is one person, not a company (本公司/当社) | grep 本公司/公司/當社 across the four zh files: 0 hits; "我们" used throughout | clean |
| Modifier on wrong verb (licence survival, non-waivable consumer rights) | web ToS "Ending things" (已发布的预设在您离开后可能仍会保留在线上，依据上文所述的许可) and "Governing law" (您居住地法律赋予且该法律不允许放弃的消费者保护权利); bot ToS section 11 | both correct: survival is of the presets, waiver bound to the law of the residence place; tracks the 2026-09-20 English fix |
| CJK false friend 利用 | bot ToS section 4 "不试图滥用、利用或规避速率限制" | English says "abuse, exploit, or circumvent"; 利用 = exploit is the intended sense, not plain "use". No change of obligation |
| One word for two things (server) | bot privacy: Discord server = 服务器, World = 市场服务器 / 大区 (preferences row, PRIVACY_POLICY.zh.md:28); web privacy uses 服务器 for World, and 社区服务器 for the Discord server only in the ToS | bot clean; web acceptable (handoff 3) |
| Quoted UI labels stale | Checked against apps/web-app/src/locales/zh.json: about.privacyPolicy 隐私政策 (l.30), config.advancedSettings 高级设置 (l.225), resetSettings 重置设置 (l.226), enableAnalytics 启用分析 (l.237), showPrices 显示价格 (l.157), Glamour list 装备列表 (l.1398), Reset all 全部重置 (l.1412), openIn 在以下网站打开… (l.1276), extractor privacyNote 图像仅在浏览器中读取，绝不上传 (l.307) | all match exactly. Bot zh.json (packages/bot-logic) carries no privacy-claim strings except /swatch help "不会保存" (l.690) which agrees; commands in the bot docs are verbatim backticks |
| English can be the stale one (UI paths) | Same labels in en.json: Enable Analytics l.237, Reset all l.1412, Glamour list l.1398, Open in… l.1276 | English quotes are current |
| Game nouns need the dictionary | glamour=幻化 (ffxiv-terminology.md:264), tool title 幻化查看器 (zh.json:104), World=服务器 and Data Center=大区 (terminology 230-231); facewear 面部配饰 vs dictionary 脸部配饰 (line 57) | consistent with shipped UI; dictionary row inconsistent (handoff 4) |
| Gate forcing unnatural wording | 3 个月, 30 天, 180 天 are natural; "a dozen" rendered 约十几个 (digit-free) | clean |
| Ambiguous English | English fixed 2026-09-20; re-read both clauses | clean |
| Never hard-wrap CJK | paragraphs are one per line in all four files; 7 stray spaces remain after punctuation or before a link (handoff 2) | cosmetic only |

## 2e4cb0cb hunks (2026-09-28 Glamour Reader change), zh side
| Hunk | zh location | Verdict |
|---|---|---|
| web PRIVACY intro adds Glamour Reader | PRIVACY.zh.md:7 (幻化查看器) | same |
| gear lookup: model numbers + facewear id, XIVAPI, names/acquisition/icons from data.xivdyetools.app | PRIVACY.zh.md:19 | same: "不携带文件本身、名称、颜色或染剂"; XIVAPI "只会收到这些编号" |
| localStorage lists rewritten Acquisition lines; "Reset all" | PRIVACY.zh.md:25 | same; labels match zh.json |
| "Open in…" menu belongs to Glamour Reader | PRIVACY.zh.md:40 | same |
| web ToS XIVAPI added; Saddlebag moved to dye card | TERMS_OF_SERVICE.zh.md (Other people's services) | same |
| bot PRIVACY Character Files, `.chara` in not-collected list, XIVAPI row | PRIVACY_POLICY.zh.md (sections 3 and 6) | same |
| bot ToS section 3 five bullets, game data "item names", XIVAPI line | TERMS_OF_SERVICE.zh.md sections 3 and 6 | same |
| web ToS "Ten tools" list gains Glamour Reader | TERMS_OF_SERVICE.zh.md:14 | not updated (handoff 1) |

## (2) Positive controls
- zh keeps every "never/not" promise as 绝不/不会/永远不: images never leave device (PRIVACY.zh.md:11), character name never sent (:16), IP never stored with anything you did, `.chara` and images never stored (PRIVACY_POLICY.zh.md section 3).
- Opt-out and deletion paths intact: Advanced Settings analytics switch, GPC, 重置设置 / 全部重置, `/preferences reset`, `/preset favorite remove`, email + Discord deletion route with the 30-day deadline, "cannot be deleted per user in Analytics Engine" kept.
- Retention numbers and recipients identical (60/120 s, 30 d, 180 d, 3 months, 30/90 d, 7 days), Perspective `doNotStore` kept, third-party table identical.
- In-product zh copy (zh.json l.307, 1033, 1108, 1204, 1411) makes the same promises as the zh policy.

## (3) Rejected items
- Company wording (本公司 etc.): none present.
- Bot privacy "Direct messages" rendered 私信内容: equivalent in intent; the `dm` flag disclosure is unchanged.
- Web ToS "automate ... in a way that degrades": modifier correctly bound.
- 利用 for "exploit": correct sense.
- "a dozen" -> 约十几个: slightly looser than 12, not a commitment.
- "vendor-sold" -> 商店: ambiguous label, not a promise (handoff 5).
- Web PRIVACY "角色或服务器名称": 服务器 = World, no Discord-server collision in that sentence.

## (4) Files covered
apps/web-app/PRIVACY.md, PRIVACY.zh.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.zh.md; apps/discord-worker/PRIVACY_POLICY.md, PRIVACY_POLICY.zh.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.zh.md; .agents/skills/audit-shared/policy-documents.md; git show 2e4cb0cb (four English docs) and the e15928b2 message; apps/web-app/src/locales/zh.json and en.json (privacy, analytics, glamour, about keys); packages/bot-logic/src/i18n/locales/zh.json and en.json (privacy grep); docs/reference/ffxiv-terminology.md (glamour, facewear, World/Data Center rows); evidence/policy-locale-parity.txt.

## Per-document section tables
### apps/web-app/PRIVACY.zh.md
| § | verdict | note |
|---|---|---|
| Notice + header | same claims | date 2026-09-28 |
| Intro (closure claim "complete list") | same claims | 下方的各节就是完整的清单 |
| Images and camera | same claims | notice quote matches zh.json:307 |
| Character files (3 bullets) | same claims | newly translated bullet 3 checked word by word |
| What is stored on your device | same claims | labels match |
| Network access 1-5 | same claims | 120-s, Perspective, doNotStore, Discord CDN intact |
| Links to other sites | same claims | referrer suppression kept |
| Usage analytics | same claims | GPC, Sec-GPC, five dimensions, 3 months, never-stored list complete |
| IP and logs | same claims | 60 s, 120 s, Workers Logs off |
| How to verify / Questions | same claims | |

### apps/web-app/TERMS_OF_SERVICE.zh.md
| § | verdict | note |
|---|---|---|
| Intro, What the site does | same claims | list omits Glamour Reader though count says ten (handoff 1) |
| Accounts | same claims | |
| Community presets / moderation / appeals | same claims | 7 days; held-for-human on uncertainty preserved |
| Fair use, Other services, Square Enix, Age | same claims | XIVAPI added |
| Availability, Warranty, Liability, Changes | same claims | |
| Ending things, Governing law, Contact | same claims | modifiers correct |

### apps/discord-worker/PRIVACY_POLICY.zh.md
| § | verdict | note |
|---|---|---|
| 2 data tables, rate limiting, analytics | same claims | every field, TTL and "never" preserved |
| 3 not collected, image + character files | same claims | closure list identical (9 bullets) |
| 4-6 uses, storage, logs, third parties | same claims | |
| 7 rights, 8 retention | same claims | |
| 1, 9-12 | same claims | |

### apps/discord-worker/TERMS_OF_SERVICE.zh.md
| § | verdict | note |
|---|---|---|
| 1-12 | same claims | |

## (5) Candidate table
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| (none) | | | | no claim-level divergence in zh |

## (6) Handoffs
1. DOC: apps/web-app/TERMS_OF_SERVICE.zh.md:14 says 十个工具 but lists nine; the Glamour Reader (幻化查看器) is missing from the list (English lists it). Commit e15928b2 changed only the count and deferred the list to a native reviewer.
2. I18N: stray ASCII spaces after CJK punctuation or before a link: apps/web-app/PRIVACY.zh.md:33,40,57,59; apps/web-app/TERMS_OF_SERVICE.zh.md:5; apps/discord-worker/PRIVACY_POLICY.zh.md:187.
3. I18N: web PRIVACY.zh uses 服务器 for World; consider 市场服务器 in the market-price sentence as the bot policy does.
4. I18N: docs/reference/ffxiv-terminology.md:57 gives Facewear zh 脸部配饰, while core data (line 313) and the policies use 面部配饰; reconcile.
5. I18N: apps/discord-worker/PRIVACY_POLICY.zh.md:28 renders "vendor-sold" as 商店; check against the exclude-category labels in bot zh.json.
6. DOC: English web PRIVACY points to "the Questions? section" for account removal, but that section only says open an issue or ask on Discord; no stated procedure or deadline for the web account record (all six languages inherit it; not a zh divergence).
