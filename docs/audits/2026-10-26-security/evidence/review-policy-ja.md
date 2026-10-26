# review-policy-ja — translation meaning review, locale `ja` (2026-10-26, HEAD 13c386e5)

Scope: the four governing English policy documents and their `ja` siblings, read in full section
by section (not sampled), plus the privacy-bearing strings of `apps/web-app/src/locales/ja.json`
and `packages/bot-logic/src/i18n/locales/ja.json` against `en.json` and the ja policy variants.
Mechanical parity (evidence/policy-locale-parity.txt) is PASS for all four ja files; this pass is
item 6 (meaning) and item 7 (in-product copy) of `.agents/skills/audit-shared/policy-documents.md`.

Result: **0 candidates.** No ja variant promises more or less than the English about data,
retention, rights, deletion paths, third parties, liability, survival or governing law. Every
divergence found is wording/terminology (i18n handoff, listed under REJECTED).

## Module table (document x section -> verdict)

| Document (en : ja lines) | Sections compared | Verdict |
|---|---|---|
| apps/web-app/PRIVACY.md (1-279) : PRIVACY.ja.md (1-117) | intro, Images, Character files, Stored on device (6 bullets), Network access (items 1-5, every sentence of item 3), Links to other sites (3 paras, 9-site example-link list), What we keep (5 bullets), Analytics (4 events, 5 dimensions, never-stored list), IP/logs (3 bullets), How to verify, Deleting your data, Questions | same claims |
| apps/web-app/TERMS_OF_SERVICE.md (1-177) : TERMS_OF_SERVICE.ja.md (1-119) | What the site does, Accounts (5), Community presets (license, conduct, moderation, appeals 7 days), Using fairly (4), Other services (5), Square Enix, Age 13, Availability, No warranty, Liability, Changes, Ending things (license survival), Governing law (NC, consumer-rights carve-out), Contact | same claims |
| apps/discord-worker/PRIVACY_POLICY.md (1-223) : PRIVACY_POLICY.ja.md (1-225) | §1-§12; tables §2 (4 + 5 rows; 8 excluded categories), rate limit (4), analytics (3 rows, failure-class list), moderation records, §3 (9 never-collected + image + .chara steps), §4 (8 rows), §5 (4 rows, security, operational logs), §6 (5 services), §7 rights/deletion 30 days, §8 (15 rows), §9-§11 | same claims |
| apps/discord-worker/TERMS_OF_SERVICE.md (1-148) : TERMS_OF_SERVICE.ja.md (1-148) | §1-§12 incl. §4 conduct (5), §5 moderation/appeal 7 days, §6 IP/license, §7-§8 warranty/liability, §10 termination, §11 governing law + carve-out | same claims |
| web-app en.json : ja.json privacy strings | about.privacyPolicy:30, extractor privacyNote:304, analyticsDesc:235, preset privacyNote:1018, cfgStoredLocallyHint:1093, charaHint:1166, charaHintGlamour:1167, glamour list privacy:1403, cardNote:1406, signinBlurb:1006, gate notes:1009-1015 | consistent with PRIVACY.ja.md |
| bot-logic en.json : ja.json | manual5.topics.characterFile.body ("一度だけ読み取られ、保存されません"), manual.stats.description, image/upload strings | consistent with PRIVACY_POLICY.ja.md §3 |

Authz matrix: not applicable (documents, no routes).

## Clause checks the skill names, by name

- Operator vs company: ja uses 運営者 / 当サービス throughout; no 当社 in any of the four files. Bot privacy §1 (PRIVACY_POLICY.ja.md:9) defines 運営者 explicitly.
- Wrong-verb modifiers: survival clause web TOS.ja:108 "公開したプリセットは、ユーザーが離れた後も上記のライセンスの下で残ることがあります" = presets you published may stay up after you leave (correct attachment). Carve-out web TOS.ja:112 / bot TOS.ja:136 "ユーザーの居住地の法律が付与し、放棄することを認めていない消費者保護の権利" = right granted by, and non-waivable under, the law of the user's residence (correct). Liability web TOS.ja:98 / bot TOS.ja:104 scope "本サイト/本Botの利用から生じる" correct.
- 利用 false friend: bot TOS.ja:42 "レート制限を悪用、不正利用、または回避しようとしないこと"; web TOS.ja:57 "レート制限を回避すること" — no bare 利用 binding the user to "use" rate limits.
- Server vs World: サーバー is only the Discord server; FFXIV World is ワールド (PRIVACY.ja.md:38, :80); bot privacy row 22 "サーバーやチャンネルのID" = guild id (not stored), consistent.
- Batch vs collection: telemetry バッチ (PRIVACY.ja.md:69, :71, :78) vs saved コレクション (:18, :23) kept distinct.
- Quoted UI labels verified against current ja.json: XIV 染色ツールについて (:9), ポリシー (:29), プライバシー (:30), 詳細設定 (:222), 設定をリセット (:223), お気に入りをクリア (:227), 保存したパレットをクリア (:229), 分析を有効にする (:234), マーケットボードを有効にする (:157), 画像はブラウザ内で処理され、送信されません。 (:304), マイ投稿 (:858), 投票済み (:989), ログアウト (:221), 開く… (:1249), 装備リスト (:1389), すべてリセット (:1404), ミラプリリーダー (:102) — all present verbatim.
- Numbers/hosts/commands/storage names: 8, 30, 50, 60, 90, 120, 180, 12か月, 7日, 13歳, 2026-10-05, hosts, `/preferences reset key:<preference>`, `usertrack:{date}:{userId}`, `doNotStore`, `Sec-GPC`, KV/D1/localStorage/IndexedDB all verbatim.
- No untranslated English sentence; cross-links target the ja siblings, only line 3 links English.

## POSITIVE controls

- English-prevails notice on line 3 of all four ja files, linking the English file.
- All never-claims kept as 一切/決して-strength negatives ("一切ありません", "絶対に保存されない" PRIVACY.ja.md:80), none softened to "normally".
- Every deletion path survives: My Submissions, re-vote, sign-out revoke, email + Discord DM, 30-day handling, active-ban exception (PRIVACY.ja.md:100-113; PRIVACY_POLICY.ja.md:153-174).
- GPC override "スイッチがオンでも一切動作しません" (PRIVACY.ja.md:69) keeps the "even with the switch on" promise.

## REJECTED (one-line reason each)

1. web TOS.ja:64 heading "他社のサービスについて" and :74, PRIVACY.ja.md:50 "他社のサイト" (other *companies'*) for "other people's / someone else's" — third parties are community projects, no commitment changes — i18n handoff.
2. PRIVACY_POLICY.ja.md:139 column "各社のプライバシーポリシー" (each company's) for "Their Privacy Policy" — terminology — i18n handoff.
3. web TOS.ja:80 "情報提供目的でのみ使用" adds "only" to "used here for informational purposes" — narrows the operator's own use, matches bot TOS wording, no user right affected — i18n handoff.
4. web TOS.ja:88 "変更・停止・移転・終了" renders "change, break, move, or shut down" with 停止 for "break" — no commitment changes — i18n handoff.
5. PRIVACY.ja.md:18 "記録の名前を変更または削除するか" can read as "delete the record's NAME" rather than "delete the record" — slightly ambiguous wording of the same local-only removal path; English "Rename or delete the record" — i18n handoff (suggest 記録の名前を変更するか記録を削除するか).
6. PRIVACY.ja.md:29 "サインアウトすると" vs the UI label ログアウト (ja.json:221; PRIVACY.ja.md:104 already uses **ログアウト**) — label inconsistency, effect stated identically — i18n handoff.
7. PRIVACY.ja.md:74 "カラーグリッド" for "dye grid" — terminology — i18n handoff.
8. ja.json:1166 charaHint "ファイルには名前や画像が含まれることがあります" for "the file holds a character name and sometimes a screenshot" — warning softened from "holds" to "may hold"; the no-upload promise ("送信はしません") is intact — i18n handoff.
9. ja.json gateVoteNote "1パレットにつき1票。" drops "per account" and says パレット for preset — not a data claim — i18n handoff.
10. ja.json:982 shotSlot "リンクのみ保存" for "LINKED, NOT UPLOADED" — same meaning (only the link is kept) — i18n handoff.
11. PRIVACY.ja.md:19 "十数個" for "a dozen" — spelled-out quantity kept digit-free as the skill requires; approximate in both — not a defect.

## FILES COVERED

13 files: apps/web-app/{PRIVACY.md, PRIVACY.ja.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.ja.md},
apps/discord-worker/{PRIVACY_POLICY.md, PRIVACY_POLICY.ja.md, TERMS_OF_SERVICE.md, TERMS_OF_SERVICE.ja.md},
apps/web-app/src/locales/{en.json, ja.json} (privacy-bearing keys), packages/bot-logic/src/i18n/locales/{en.json, ja.json} (privacy-bearing keys),
.agents/skills/audit-shared/policy-documents.md; plus evidence/policy-locale-parity.txt.
Directories: apps/web-app, apps/web-app/src/locales, apps/discord-worker, packages/bot-logic/src/i18n/locales, .agents/skills/audit-shared, docs/audits/2026-10-26-security/evidence.
