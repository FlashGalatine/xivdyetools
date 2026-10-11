# Japanese (ja) policy translations: meaning review (2026-10-11)

Method: each variant read in full against its English file at HEAD 42c35e87. Quoted UI labels checked against apps/web-app/src/locales/ja.json and packages/bot-logic/src/i18n/locales/ja.json. Game nouns checked against docs/reference/ffxiv-terminology.md.

Checks that passed on all four files: English-prevails notice at line 3 and links the English file; no 当社/弊社/自社 for the operator (運営者 used; 株式会社 only for Square Enix); no グラマー (policies use コーディネート, the formal register terminology.md prescribes); no hard-wrapped paragraph; カララント for dye; フェイスアクセサリー for facewear; ミラプリリーダー for Glamour Reader; command names, hostnames, retention numbers (30/60/90/120 s/180 days/12 months/7 days/13 years), section numbers and storage names verbatim; North Carolina governing-law clauses, liability and licence clauses read twice, modifiers attach correctly.

Quoted UI labels verified against ja.json: XIV 染色ツールについて (L9), ポリシー (L29), プライバシー (L30), 画像はブラウザ内で処理され、送信されません。(L303), 詳細設定 (L221), 設定をリセット (L222), お気に入りをクリア (L226), 保存したパレットをクリア (L228), コレクション管理 (L748), コレクションを削除 (L730), 分析を有効にする (L233), マーケットボードを有効にする (L156), マイ投稿 (L858), 装備リスト (L1367), すべてリセット (L1382), 開く… (L1243), 投票/投票済み (L988-989), ログアウト (L220). Bot exclusion categories メタリック/パステル/ダーク/コスモ/イシュガルド/高価/ベンダー/クラフト match bot-logic ja.json L406-413.

## apps/web-app/PRIVACY.ja.md vs PRIVACY.md
Sections compared (all): intro; Images and camera captures; Character files; What is stored on your device; Network access (items 1-5, links to other sites, example links); Community presets: what we keep (daily limits, Discord posts, failed notifications, ban records, moderation log); Usage analytics; Your IP address and logs; How to verify; Deleting your data; Questions.
Result: every section present and equivalent; no dropped obligation, no added claim, no weaker or stronger clause. Retention numbers, the 2026-10-05 cutoff, the Sec-GPC/GPC rule, the doNotStore note and the ban-lift clearing rule all match. Only cosmetic item: 約三ヶ月 (L82) while the bot policy writes 3か月 (cand 06).

## apps/web-app/TERMS_OF_SERVICE.ja.md vs TERMS_OF_SERVICE.md
Sections compared: intro; What the site does; Accounts; Community presets (ownership, conduct, moderation, appeals); Using the site fairly; Other people's services; Square Enix material; Age; Availability; No warranty; Limits on liability; Changes; Ending things; Governing law; Contact.
Result: meaning equivalent throughout. Findings are wording only: L60 ungrammatical "誰かを嫌がらせする"; L78 trademark sentence left in English while the bot terms translate it; L39 "通過する必要があります" reads as a duty on the user (cand 01, 02, 05).

## apps/discord-worker/PRIVACY_POLICY.ja.md vs PRIVACY_POLICY.md
Sections compared: 1-12 and the closing acknowledgement, including all four tables (collected data, usage analytics, storage, retention) row by row.
Result: equivalent; every table row and retention period matches. Wording only: L9 defined term 「運営者の」; stray spaces L47, L131, L183 (cand 03, 04).

## apps/discord-worker/TERMS_OF_SERVICE.ja.md vs TERMS_OF_SERVICE.md
Sections compared: 1-12 and closing acknowledgement.
Result: equivalent. Wording only: L11 defined term 「運営者のBot」 (cand 03).

No handoff-security claim differences were found.
