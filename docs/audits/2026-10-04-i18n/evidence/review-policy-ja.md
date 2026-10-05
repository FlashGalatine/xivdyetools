# Review: policy-ja (2026-10-04 i18n audit)

Documents (HEAD, all read in full, sentence by sentence against the HEAD English): apps/web-app/PRIVACY.ja.md (117 lines), apps/web-app/TERMS_OF_SERVICE.ja.md, apps/discord-worker/PRIVACY_POLICY.ja.md (225 lines), apps/discord-worker/TERMS_OF_SERVICE.ja.md (main hunk: feature list, XIVAPI sentence, fair-use line). Diffs read: all *.main.diff and *.pr.diff for the four stems.

## Candidates
1. I18N P2, apps/web-app/TERMS_OF_SERVICE.ja.md:11, origin MAIN. Count changed to 十 (matches English "Ten tools") but the list still ends "スウォッチマッチャー、そしてコミュニティのプリセットパレットブラウザです": ミラプリリーダー (English: "Swatch Matcher, Glamour Reader, and the community Presets browser") was never added. "Ten" lists nine. See TERMS_OF_SERVICE.ja.md.main.diff (the 九->十 line is the only change to that sentence).
2. I18N P1, apps/discord-worker/PRIVACY_POLICY.ja.md:192, origin PR#227. Retention row: "12か月。ただし、非表示または再表示の場合は、プリセットが削除されるまで". Reads as "for hide/restore, kept until the preset is deleted" (instead of 12 months, i.e. unbounded). English "12 months, or until the preset is deleted for a hide or restore" means whichever is first (web-app English says "or sooner ... if its preset is deleted"; web PRIVACY.ja.md:63 is correct). Fix ja: "12か月。ただし、非表示または再表示の場合は、プリセットが削除された時点でそれより早く削除されます".
3. I18N P3 (English side, locale en), apps/discord-worker/PRIVACY_POLICY.md:190, origin PR#227. Same row is ambiguous in English ("or until ... deleted"), which is how ja took the wrong reading. Suggest "12 months, or sooner for a hide or restore if its preset is deleted" (same words as web PRIVACY.md:170-171).
4. TERM P3, apps/web-app/PRIVACY.ja.md:44, origin BASE (unchanged since 5c80fcba). "フォントは自社ホストです": 自社 = "our company"; operator is one person (brief trap). Suggest "フォントはセルフホストです".

## Positive controls (checked, correct)
- Every quoted UI label equals current web-app ja.json: 画像はブラウザ内で処理され、送信されません。(matcher.privacyNote), XIV 染色ツールについて → プライバシー, 詳細設定 → 設定をリセット / お気に入りをクリア / 保存したパレットをクリア / 分析を有効にする, コレクション管理 → コレクションを削除, マイ投稿, 価格を表示, 開く…, 装備リスト / すべてリセット (glamour.sheet.*), ログアウト, 投票 / 投票済み, ミラプリリーダー (tools.glamour.title).
- Retention numbers verbatim in all four: 30日, 90日, 12か月, 120秒, 60秒, 180日, first 8 characters; commands (`/glamour`, `/swatch`, `/preset favorite add`, `/preferences reset key:<preference>`), hosts (api/auth/data/shots.xivdyetools.app), email, Discord invite, XIVAPI, Perspective `doNotStore`.
- No softening or dropping: "never" -> 一切ありません throughout; ban-active carve-outs (not updated while ban active, not deleted on request, post about active ban stays) present in web PRIVACY.ja.md:40/113 and discord PP ja:174/194; deletion paths and "do not ask in a public GitHub issue" kept.
- Operator is one person: 運営者 everywhere; no 当社/弊社; 利用禁止 consistent.
- Glamour wording: ミラプリリーダー for the tool; コーディネート in the policies is the dictionary's formal-register choice (ffxiv-terminology.md:273-274); no グラマー. フェイスアクセサリー = dictionary Equipment Slots row (ffxiv-terminology.md:313).
- One paragraph per line: scripted check over all four files, no hard wrap between CJK lines; no English sentences left (scripted + read).
- Dates equal English in all four (2026-10-04 x2, discord PP Oct 4 2026, discord TOS 2026-09-28).
- Discord TOS ja: five new feature bullets, "dye and item names", XIVAPI sentence all faithful.
- English-prevails notice present in all four.

## Rejected
- web PRIVACY.ja.md:103/104 add bold button labels (投票/投票済み, ログアウト) that English leaves generic: labels are correct, not a defect. サインイン prose vs ログアウト label is a mild mix, not filed.
- discord PP ja:9 "（以下「本Bot」、「運営者」または「運営者の」）" is awkward but pre-existing and faithful.
- "Cloudflareの Analytics Engine" stray space (discord PP ja:47,183): cosmetic, pre-existing.
- 約三ヶ月 vs 3か月 style split between documents: cosmetic.
