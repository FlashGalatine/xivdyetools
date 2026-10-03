# Review: policy-ja (Japanese translations of the four policy documents)

Scope: apps/web-app/PRIVACY.ja.md, TERMS_OF_SERVICE.ja.md; apps/discord-worker/PRIVACY_POLICY.ja.md, TERMS_OF_SERVICE.ja.md, each read sentence by sentence against its English file. Read-only; no probe scripts.

## (1) Entry points / authz matrix
Not applicable. This is a document-meaning review, not a code unit. The entry points are the four documents, reached from the About modal (web, `about.privacyPolicy` / `about.termsOfService`) and the Discord developer-portal URL (bot, English file only). No code was changed or reviewed. Authz: public documents, anyone can read them.

## Pitfall checklist (policy-documents.md, "What the first translation pass taught")
| Pitfall | Where checked | Result |
|---|---|---|
| Operator is one person, not a company (ja 当社) | grep for 当社 and 弊社 over all four files | 0 hits. 運営者 used throughout. One residue: web PRIVACY.ja.md:36 "フォントは自社ホスト" (自社 = "our company"); handoff only, no claim change |
| Modifier on wrong verb (survival, governing law, liability) | web ToS 利用の終了, 準拠法, 責任の制限; bot ToS sections 10 and 11 | "Presets you published may stay up after you leave" is rendered correctly (公開したプリセットは、ユーザーが離れた後も…ライセンスの下で残ることがあります). Consumer-protection clause: 居住地の法律が付与し、放棄することを認めていない = law of residence, non-waivable; same claim as English in both ToS |
| False friends: 利用 = plain "use" | bot ToS section 4 | "abuse, exploit, or circumvent rate limits" is 悪用、不正利用、回避; no extra duty not to "use" limits. OK |
| One word for two things (server vs World, batch vs collection) | bot PRIVACY sections 2, 3, 5; web PRIVACY analytics | Discord server = サーバー (ID not stored); World = ワールド (stored preference); telemetry batch = バッチ, saved collections = コレクション. No collision |
| Quoted UI labels vs current ja.json | web PRIVACY.ja.md quotes | All match apps/web-app/src/locales/ja.json: 詳細設定 (:225), 設定をリセット (:226), 分析を有効にする (:237), 価格を表示 (:157), 画像はブラウザ内で処理され、送信されません。(:307), 開く… (:1276), 装備リスト (:1398), すべてリセット (:1412), XIV 染色ツールについて → プライバシー (:16, :30), ミラプリリーダー (:104). Bot policy quotes no ja UI label; its commands are verbatim |
| English can be the stale one (UI paths) | English "Advanced Settings", "Enable Analytics", "Show Prices", "Glamour list", "Reset all", "Open in…", About → Privacy vs en.json | All match en.json (:225, :237, :157, :1398, :1412, :1276, :16/:30). The English description of the Palette Extractor notice paraphrases en.json:307 "Images are read in your browser and never uploaded." Not stale |
| Game nouns need the dictionary | glamour terms vs docs/reference/ffxiv-terminology.md:247-263 | No グラマー anywhere. "Glamour Reader" = ミラプリリーダー matches shipped ja.json:104. "dye" = カララント throughout |
| Gate forcing unnatural wording | digit words | 十数個 for "a dozen" (web PRIVACY.ja.md gear bullet): digit-free; "a dozen" is exactly 12, 十数個 is 11-19 (handoff) |
| Ambiguous English costs translations | bot ToS section 3 ("or to colors extracted from an image"), consumer-protection clause | Both fixed in English 2026-09-20; ja renders the fixed readings |
| Never hard-wrap CJK | line structure of all four files | One paragraph per line; no mid-sentence breaks seen (parity script also passes) |

## 2e4cb0cb (Glamour Reader content change) hunks, read first
- Web PRIVACY: Glamour Reader named among on-device tools (ja intro lists ミラプリリーダー); gear lookup says model numbers plus facewear id, "not the dyes", XIVAPI named, "sent the numbers and nothing about you", reply carries names, where obtained, icons (ja gear bullet has all of it; カララントは含まれません); Acquisition lines under localStorage and "Reset all" in the Glamour list (ja: 入手方法の行, 装備リスト, すべてリセット); "Open in…" belongs to the Glamour Reader (ja ok). Same claims.
- Web ToS: XIVAPI row present (ja), glamour-piece vs dye-card link split present (ja). Same claims. The tool list was NOT updated (see handoff DOC 1).
- Bot PRIVACY: `.chara` not-collected bullet, Character Files subsection (4 steps, /glamour sends model numbers and facewear id to our API, XIVAPI lookup, nothing about you), XIVAPI third-party row: all present in ja with the same claims.
- Bot ToS: section 3 seven new bullets with commands verbatim, section 6 "dye and item names", XIVAPI paragraph: all present in ja.

## Per-document section tables
### apps/web-app/PRIVACY.ja.md
| § | verdict | note |
|---|---|---|
| Intro (on-device tools, "complete list") | same claims | Closure claim kept: 以下の項目がその完全な一覧 |
| Images and camera captures | same claims | never leave device, never written to storage, discarded; notice is text not link; About → Privacy label correct |
| Character files | same claims | name never sent, field starts empty, local-only fallback nickname then file name, deletable; gear-lookup payload exactly as English |
| What is stored on your device | same claims | localStorage list incl. Acquisition lines and token; no tracking identifier; Reset settings (Advanced Settings) vs Reset all (Glamour list) kept distinct; IndexedDB = price cache only, old image copy deleted |
| Network access (1-5 and links) | same claims | five first-party uses, Perspective `doNotStore`, no identity sent, account record on sign-in, avatars and shots hosts, og-worker sees URL only, referrer suppressed |
| Usage analytics | same claims | off by default, GPC wins, server rejects `Sec-GPC`, stop and discard on off, four event kinds, five dimensions, "never stored" list complete, allowlist, about three months |
| Your IP address and logs | same claims | 60 s window, Cloudflare rate-limit service, KV fallback 120 s, never stored with actions, Workers Logs off on every worker, promise to say so first |
| How to verify / Questions | same claims | |
### apps/web-app/TERMS_OF_SERVICE.ja.md
| § | verdict | note |
|---|---|---|
| Intro | same claims | |
| What the site does | divergence (descriptive) | "Ten tools" but only nine named; Glamour Reader missing. Handoff DOC 1 |
| Accounts | same claims | no password seen or stored; provider ID and username; revoke and tell us; suspension |
| Community presets (ownership, licence, conduct, moderation, appeals) | same claims | licence non-exclusive, royalty-free, within ecosystem, no sale or onward licence; fail-closed moderation kept; 7 days; removal path to PRIVACY |
| Using the site fairly | same claims | |
| Other people's services | same claims | XIVAPI row and link split present |
| Square Enix / Age / Availability / No warranty / Liability / Changes | same claims | 13 or local minimum, whichever higher; local-only saves unrecoverable; damages caps incl. gil |
| Ending things / Governing law / Contact | same claims | survival clause correct; NC law and venue; non-waivable consumer rights tied to place of residence |
### apps/discord-worker/PRIVACY_POLICY.ja.md
| § | verdict | note |
|---|---|---|
| 1 Introduction | same claims | |
| 2 Data We Collect (auto, provided, rate limit, analytics) | same claims | User ID incl. daily marker and counted-never-listed; username; locale bucket; Guild/Channel not stored, only guild/dm; 50 favourites; 180 days; fallback 120 s with User ID in key; no IP; analytics rows incl. 3 months, 30-day KV keys, `usertrack:{date}:{userId}`; not editable per user |
| 3 Not collected, Image, Character Files | same claims | closure list intact incl. `.chara` and character names; steps and XIVAPI disclosure present |
| 4 How we use | same claims | |
| 5 Storage, security, operational logs | same claims | two log lines carry User ID; Workers Logs off; policy updated first |
| 6 Third parties | same claims | Universalis, XIVAPI, Perspective (optional), no sale "for marketing" |
| 7 Rights | same claims | `/preferences show`, `/preferences reset [key:]`, `/preset favorite list|remove`, flag not user-manageable, 30 days, email subject, Discord DM |
| 8 Retention | same claims | all eleven rows, numbers equal English |
| 9-12 Children, transfers, changes, contact | same claims | |
### apps/discord-worker/TERMS_OF_SERVICE.ja.md
| § | verdict | note |
|---|---|---|
| 1-3 | same claims | all 11 features, commands verbatim |
| 4 Conduct, rate limits | same claims | |
| 5 Moderation, appeal | same claims | immediate publish plus audit log; flagged or unresolved held; 7 days |
| 6 IP, third parties, content licence | same claims | |
| 7-10 Warranty, liability, changes, termination | same claims | |
| 11-12 Governing law, contact | same claims | consumer-rights clause correct |

## In-product copy agreement (ja.json)
- apps/web-app/src/locales/ja.json:1033 (sign-in privacyNote: account record with ID and username, display name shown, no character data, no email, nothing sold), :1204 (.chara parsed on device, not sent), :1411 (edits stored on device per outfit, name not in list, file not stored), :307: all agree with PRIVACY.ja.md.
- packages/bot-logic/src/i18n/locales/ja.json:690 (/swatch file read once, not stored): agrees with the bot policy section 3.
- ja.json:1204 says nothing is sent while the policy discloses the model-number lookup; en.json:1204 says "Nothing is uploaded" the same way and the file itself is indeed not uploaded, so this is not Japanese-specific.

## (2) Positive controls
- evidence/policy-locale-parity.txt shows ja ok for all four documents.
- All four ja files open with the English-prevails notice linking the English file (line 3 in each).
- Last-updated date is 2026-09-28 in all four ja files, equal to English.
- No 当社 anywhere; every quoted UI label equals current ja.json.

## (3) Rejected items
- ja.json:1204 "送信はしません" vs gear-lookup disclosure: same wording in en.json; not a ja divergence.
- 十数個 for "a dozen": range, not a promise; handoff only.
- 任意 on Perspective: English also says optional.
- Consumer-protection clause lacks an explicit "same law" subject in ja: grammar still binds both verbs to the residence law, same meaning.
- Code-side truth of claims (rate-limit TTLs, Workers Logs off, etc.) not re-verified here; this review covers translation drift only.

## (4) Files covered
apps/web-app/PRIVACY.md, PRIVACY.ja.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.ja.md; apps/discord-worker/PRIVACY_POLICY.md, PRIVACY_POLICY.ja.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.ja.md; .agents/skills/audit-shared/policy-documents.md; git show 2e4cb0cb for the four English files; apps/web-app/src/locales/ja.json and en.json (cited lines); packages/bot-logic/src/i18n/locales/ja.json and en.json (:690); docs/reference/ffxiv-terminology.md (:247-263); evidence/policy-locale-parity.txt.

## (5) Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| (none) | | | | No claim-level divergence found in the four Japanese documents |

## (6) Handoffs
- DOC: apps/web-app/TERMS_OF_SERVICE.ja.md ("サイトの機能"): says ten tools (十のツール) but lists nine; ミラプリリーダー is missing between スウォッチマッチャー and コミュニティのプリセット. The English lists the Glamour Reader (added 2026-09-27/28). Descriptive, not a data claim, but the count and list disagree and PRIVACY.ja.md names the Reader. Check the other locales' ToS for the same omission.
- I18N: apps/web-app/PRIVACY.ja.md:36 "フォントは自社ホストです" uses 自社 (company register); use 運営者 wording.
- I18N: web PRIVACY.ja.md gear bullet "十数個" for "a dozen"; 約12個 if the digit gate allows, otherwise leave.
- I18N: bot PRIVACY_POLICY.ja.md stray spaces: "Cloudflareの Analytics Engine" (analytics table and retention table), "Discordユーザー ID" (section 5 logs) vs "DiscordユーザーID" elsewhere.
- I18N: bot PRIVACY_POLICY.ja.md section 1 defines 「運営者の」 as a term, awkward; drop it.
- DOC: no promise-changing edit is needed in any Japanese file, so no six-file policy edit is required on account of ja.
