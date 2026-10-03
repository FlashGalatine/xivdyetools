# Handoffs — non-security defects for other skills (2026-10-03 security audit)

Not security findings. Routed to `documentation-audit` (DOC), `i18n-manager` (I18N) or `deep-dive-analysis` (BUG) per `.agents/skills/audit-shared/policy-documents.md` § *Who files what*. Each line is a reviewer lead, not a verified defect — the owning skill verifies before filing.

## Routed by the coordinator

- **DOC — all five translated web Terms omit the Glamour Reader.** `apps/web-app/TERMS_OF_SERVICE.{ja,ko,zh,de,fr}.md` §What the site does say "ten tools" and name nine; the English gained the Glamour Reader on 2026-09-27 (`b29b9562`) and the 2026-09-28 policy commit (`2e4cb0cb`) did not touch that paragraph. Not a data claim, so not a FINDING.
- **BUG — quadratic `text()` regex in GPOSERS export.** `packages/core/src/services/chara/chara-gposers.ts:101` `/s*[
]+s*/g` is quadratic on long newline-free whitespace; only the viewer’s own typed Acquisition note reaches it, so it is a self-DoS robustness bug with no trust boundary.
- **Hardening — `allowed_mentions` default on interaction callbacks.** `apps/discord-worker/src/utils/response.ts:88-112` and `handlers/buttons/copy.ts` type-4 bodies set no `allowed_mentions`; nothing exploitable today (all type-4 content is ephemeral or bot-built). Already rejected as a finding in 2026-08-29 `evidence/review-discord-worker.md`; see Recommendations.

## Translation re-read (verifier tier) — upheld drifts that do not change a commitment

- **I18N ja-1** (INFO) `apps/web-app/TERMS_OF_SERVICE.ja.md` §Square Enix material / スクウェア・エニックスの資産について: (Left in English, untranslated.) The bot Terms ja L77 does translate the trademark sentence (FINAL FANTASYはスクウェア・エニックス・ホールディングス株式会社の登録商標です), and de/fr/ko/zh web Terms all translate it; only ja web Terms leaves it in English.
- **I18N ja-2** (INFO) `apps/web-app/TERMS_OF_SERVICE.ja.md` §Square Enix material / スクウェア・エニックスの資産について: Game data such as dye names, colors, acquisition methods, item names, icons belongs to Square Enix, and on this site is used ONLY for informational purposes.
- **I18N ko-1** (LOW) `apps/discord-worker/TERMS_OF_SERVICE.ko.md` §4. User Conduct: Will not submit inappropriate, offensive, or copyright-infringing content to community features
- **I18N ko-2** (LOW) `apps/web-app/TERMS_OF_SERVICE.ko.md` §Square Enix material: Game data ... is the property of Square Enix and is used here ONLY for informational purposes.
- **I18N ko-4** (INFO) `apps/web-app/TERMS_OF_SERVICE.ko.md` §Using the site fairly: working around rate limits, or automating the site in a way that harms other people
- **I18N zh-1** (INFO) `apps/web-app/PRIVACY.zh.md` §Network access, item 1 (Market-board prices): the item IDs you selected, and the server or data center [you are] located on, are sent to our proxy at data.xivdyetools.app
- **I18N zh-2** (INFO) `apps/web-app/TERMS_OF_SERVICE.zh.md` §Square Enix material: Game data (dye names, colors, acquisition methods, item names and icons) belongs to Square Enix and is used here ONLY for informational-explanation purposes.
- **I18N de-4** (INFO) `apps/web-app/PRIVACY.de.md` §Charakterdateien (.chara): "Its character name is never sent anywhere and never used as a preset name, author name or anything else that other players can see." 'Other people' is narrowed to 'other players'. The protection is nominally scoped to fewer viewers, but in practice the commit
- **I18N fr-1** (INFO) `apps/web-app/PRIVACY.fr.md` §Fichiers de personnage (.chara): The character name it contains is never sent anywhere, and is never used as a preset name, author name, or any other thing visible to other players.
- **I18N fr-2** (INFO) `apps/web-app/PRIVACY.fr.md` §Accès réseau (item 1, market-board prices): the item ids and the World or data centre you chose are sent to our proxy at data.xivdyetools.app, which retrieves them from Universalis. The only grammatical antecedent of 'les' (them) is the ids and World, so the sentence reads as if those came from Universa
- **I18N fr-3** (INFO) `apps/web-app/PRIVACY.fr.md; apps/web-app/TERMS_OF_SERVICE.fr.md` §Fichiers de personnage (exception) / Disponibilité: ...or erase the data of your (web)site, and it disappears. This reads as a website the user owns. The same files elsewhere use the correct 'données de site de votre navigateur' (PRIVACY.fr L56, L63-64; TERMS.fr L37-38). It is a deletion instruction, but the cl

## Translation re-read — non-claim defects

- [ja] DOC: apps/web-app/TERMS_OF_SERVICE.ja.md:11 says 十のツール (ten tools) but lists only nine. ミラプリリーダー (Glamour Reader) is missing, though English L15-16 names it. The English gained it on 2026-09-27 (b29b9562/e15928b2) and 2e4cb0cb never touched ja L11. Insert 、ミラプリリーダー after スウォッチマッチャー.
- [ja] DOC (English is the stale one, faithfully mirrored in ja): apps/web-app/PRIVACY.md:47-48 says '"Reset settings" in Advanced Settings and your browser's site-data controls clear it', where 'it' is all of localStorage. In apps/web-app/src/components/advanced-options-panel.ts:237-240 that button only calls configController.resetAllConfigs(). Favourites, saved palettes and collections, the rewritten Acquisition lines (the commit 2e4cb0cb message itself says Reset settings does not clear them) and the session token are not cleared by it. PRIVACY.ja.md:22 repeats the over-claim. Separately, the English quotes 'Reset settings' while en.json config.resetSettings is 'Reset Settings' (case only).
- [ja] I18N: apps/web-app/PRIVACY.ja.md:36 フォントは自社ホストです uses 自社 ('our company'), which casts the operator as a company. Use フォントはセルフホストしています or 運営者のサーバーから配信.
- [ja] I18N: 他社 ('another company') is used for third-party sites and services, several of them community projects rather than companies: PRIVACY.ja.md:42 他社のサイト; TERMS_OF_SERVICE.ja.md:64 heading 他社のサービスについて and :73 他社のサイト. Prefer 第三者 or 他者.
- [ja] I18N: apps/discord-worker/PRIVACY_POLICY.ja.md:120 has a stray space in Discordユーザー ID. Elsewhere the file writes DiscordユーザーID.
- [ja] I18N: apps/discord-worker/PRIVACY_POLICY.ja.md:47 and :172 have a stray space in Cloudflareの Analytics Engine.
- [ja] I18N: apps/web-app/PRIVACY.ja.md:22 renders 'for that outfit' as その装備 ('that equipment'). This matches the in-product string sheet.privacy (この装備ごと) in apps/web-app/src/locales/ja.json:1411, so it is consistent with the UI. The terminology doc, however, prescribes コーディネート for one outfit in the policies (as used elsewhere in this file).
- [ja] I18N (in-product string, not policy): apps/web-app/src/locales/ja.json:238 analyticsDesc writes 染料 for 'dyes'. The policies and the rest of the UI use カララント. The claim itself (anonymous, no identifiers, no images) agrees with PRIVACY.ja.md §利用状況分析.
- [ja] Checked, no defect: every quoted web UI label matches apps/web-app/src/locales/ja.json. That covers 画像はブラウザ内で処理され、送信されません。 (:307), XIV 染色ツールについて → プライバシー (:9/:30), 詳細設定 (:225), 設定をリセット (:226), 分析を有効にする (:237), 価格を表示 (:157), 開く… (:1276), 装備リスト (:1398) and すべてリセット (:1412). Tool names match too. Bot preference and filter labels (部族, コスモ, イシュガルド, ベンダー, クラフト) match packages/bot-logic/src/i18n/locales/ja.json. Facewear is フェイスアクセサリー, as in the terminology table's slot row.
- [ja] Checked, no defect: in-product privacy strings agree with the ja policies. Web ja.json:1033 (account record holds provider ID and username; no character info or email collected; nothing sold), :1108 (stored on this device, not sent to the server), :1411 (edits kept on this device; character name and file never saved). Bot ja.json:690 (.chara read once for the reply, not stored).
- [ko] DOC: apps/web-app/TERMS_OF_SERVICE.ko.md:11 'What the site does' says 열 가지 도구 (ten tools) but lists nine; 코디 리더 (Glamour Reader) is missing. English L15-16 lists ten with Glamour Reader. The sentence contradicts itself as well as omitting a tool. This is the known all-language defect, confirmed present in ko.
- [ko] DOC: The governing English is the stale text. apps/web-app/PRIVACY.md:47-48 says '"Reset settings" in Advanced Settings and your browser's site-data controls clear it', where 'it' is all of localStorage: palettes, collections, rewritten Acquisition lines and the session token. The handler at apps/web-app/src/components/advanced-options-panel.ts:237-240 only calls configController.resetAllConfigs(), which loops CONFIG_KEYS (src/services/config-controller.ts:381-385). It does not touch the acquisition-edit key (src/shared/acquisition-edits.ts:28), saved palettes, collections or the token. Commit 2e4cb0cb's own message says 'Reset settings does not clear them'. PRIVACY.ko.md:22 faithfully copies this overstatement of a deletion path. Route to security-audit as a FINDING (Policy: AMEND, all six variants).
- [ko] DOC: The English quotes the button as "Reset settings" (PRIVACY.md:47), but en.json config.resetSettings is "Reset Settings". Case drift only. The ko label 설정 초기화 matches ko.json:226.
- [ko] I18N: apps/web-app/PRIVACY.ko.md:57 uses 서버 twice in one paragraph for two things: '캐릭터 이름이나 서버 이름' (game World names) and, one sentence later, '서버는 검증된 이벤트를…' (the operator's API server). This is the 'one word for two things' pitfall. L30 '서버 또는 데이터 센터' sits next to 'our proxy' too. The shipped label 마켓 서버 (bot-logic ko.json:357) or a disambiguation would fix it.
- [ko] I18N: apps/web-app/PRIVACY.ko.md:12 has a doubled period after the quoted notice: '…업로드되지 않습니다.". 이 안내는'.
- [ko] I18N: apps/web-app/src/locales/ko.json:1033 (sign-in privacyNote) says '표시 이름은 투고한 팔레트에 표시됩니다' (palettes you posted). en.json:1033 and both ko policy documents say presets (프리셋). In-product wording disagrees with the policy terminology. The data claim itself (ID + username stored, no character data or email collected, nothing sold) agrees with PRIVACY.ko.md:32 and TERMS_OF_SERVICE.ko.md:20.
- [ko] I18N: Verified, no defect. Every quoted web UI label in PRIVACY.ko.md matches current apps/web-app/src/locales/ko.json: 고급 설정 (225), 설정 초기화 (226), 분석 활성화 (237), 가격 표시 (157), 다음에서 열기… (1276), 장비 목록 (glamour sheet.title 1398), 모두 초기화 (1412), XIV 염색 도구 정보 → 개인정보처리방침 (9/30), privacyNote (307). Tool names match the tool titles. Bot slash-command names are not localized (apps/discord-worker/src/commands/localize.ts localizes only descriptions and choice names), so /preferences show|reset and /preset favorite list|remove are correct as quoted. In-product .chara/upload strings (bot-logic ko.json:690 'not stored'; web ko.json:1108, 1411) agree with the policies.
- [zh] DOC: apps/web-app/TERMS_OF_SERVICE.zh.md:11 says 十个工具 (ten tools) but lists only nine (调色板提取、色彩和谐探索器、染剂比较、渐变生成器、染剂混合器、无障碍检查器、预算建议、色板匹配器，以及社区预设浏览器). It drops the Glamour Reader (幻化查看器), which English L15-16 names. Commit e15928b2 changed only the count and left the list for a reviewer, so this is confirmed and still open at 0ab33466.
- [zh] I18N: stray ASCII space after full-width punctuation, left over from joining hard-wrapped lines. Each renders as a visible gap: apps/web-app/PRIVACY.zh.md:33 '任何网页一样； Discord'; :40 '.com/)、 [Garland', '.com/)、 [Gamer Escape', 'Universalis、 Garland Tools'; :57 '客户端标识符， Cookie'; :59 '代码是开源的： [`apps/'; apps/web-app/TERMS_OF_SERVICE.zh.md:5 '有自己的条款： [`apps/'; apps/discord-worker/PRIVACY_POLICY.zh.md:187 '同意此项传输。 Cloudflare'.
- [zh] I18N: apps/web-app/TERMS_OF_SERVICE.zh.md:7 renders 'colour toolkit' as 染剂工具集 (dye toolkit). Elsewhere these documents translate the colour tools as 颜色工具 (e.g. TERMS L17), so 颜色工具集 would be consistent.
- [zh] I18N: apps/discord-worker/TERMS_OF_SERVICE.zh.md:91 heading '担保声明' (Warranty statement) for 'Disclaimer of Warranties'. It loses 'disclaimer'; the body correctly disclaims, and the web Terms uses 无担保声明.
- [zh] I18N: apps/discord-worker/PRIVACY_POLICY.zh.md:9 lists defined terms as (“本机器人”、“我们”) and drops the English 'our'. This is cosmetic.
- [zh] I18N: apps/web-app/TERMS_OF_SERVICE.zh.md:22 '如果您认为有其他人访问了您的账户' means 'has accessed'; English L32-33 says 'has access to it'. Tense drift only; the instruction to revoke access and tell us is intact.
- [de] DOC: apps/web-app/TERMS_OF_SERVICE.de.md:17-19 says 'Zehn Werkzeuge' but lists only nine (Paletten-Extraktor … Farbmuster-Matcher und der Community-Presets-Browser). It drops 'Projektionsleser' (Glamour Reader), which the English lists at TERMS_OF_SERVICE.md:15-17. This confirms the coordinator's known defect for de.
- [de] DOC (English-level, carried faithfully into DE): PRIVACY.md:47-48 (DE 54-55 'Einstellungen zurücksetzen … löschen es') says 'Reset settings' in Advanced Settings clears localStorage. The handler at apps/web-app/src/components/advanced-options-panel.ts:237-240 only calls configController.resetAllConfigs(). It does not clear saved palettes, collections, favourites, the rewritten Acquisition lines (shared/acquisition-edits) or the session token. Commit 2e4cb0cb's own message says Reset settings does not clear the edits. This is a deletion path a user would follow, so the English needs the fix (all six variants).
- [de] DOC (English-level): PRIVACY.md:21 quotes 'About → Privacy', but the shipped en.json label is 'About XIV Dye Tools' (about.title / nav about). The DE text quotes the real shipped label 'Über XIV Farbwerkzeuge → Datenschutz', so DE is correct where the English is loose.
- [de] DOC: cross-document links inside the DE files point at the English siblings (PRIVACY.de.md:6 and :172 → ../discord-worker/PRIVACY_POLICY.md; TERMS_OF_SERVICE.de.md:6-8, :24, :81 → PRIVACY.md and the English bot terms; discord-worker TERMS_OF_SERVICE.de.md:8-9 → English web terms and PRIVACY_POLICY.md). fr and ja have the same pattern, so this is a convention question, not a de-only defect.
- [de] I18N: tool names in the web documents are not the shipped de.json labels. 'Budget-Finder' (PRIVACY.de.md:9, TERMS_OF_SERVICE.de.md:18) is shipped as 'Budget-Vorschläge' (de.json:77). 'Community-Presets-Browser' / 'Community-Presets' is shipped as 'Community-Vorlagen' / 'Vorlagen'. The bot locale also uses 'Vorlage' (bot-logic de.json:226). 'Presets' is used throughout all four documents.
- [de] I18N: apps/web-app/PRIVACY.de.md:115-116 'verwirft jeden Stapel, der das Sec-GPC-Signal deines Browsers trägt, bevor er sie schreibt'. The pronoun should be 'ihn' (der Stapel). As written, 'sie' grammatically picks up 'Telemetrie'. The meaning survives.
- [de] I18N: apps/discord-worker/PRIVACY_POLICY.de.md:202 '90 Tage bei ungelöst' is ungrammatical. Use '90 Tage, wenn ungelöst' or 'bei ungelösten Fällen 90 Tage'.
- [de] I18N: apps/discord-worker/TERMS_OF_SERVICE.de.md:30-31 'einer aus einem Bild extrahierten Farbe' is singular, where the English (TERMS_OF_SERVICE.md:23) has plural 'colors extracted from an image'. This is a service description, not a commitment.
- [de] I18N: 'Acquisition' has two German words in product. The policy (PRIVACY.de.md:44, 51) uses 'Bezugsquelle(n)', which matches the glamour sheet's cardNote (de.json:1414). The general 'acquisition' label is 'Beschaffung' (de.json:122). The policy matches the label nearest the feature it describes, so this is consistent enough. Noted for the terminology table.
- [de] I18N: apps/web-app/PRIVACY.de.md:8-10 and the other DE files hard-wrap mid-sentence (e.g. 'erledigen' / 'ihre Arbeit'). This is harmless in German (a space renders, which is correct), so it is not the CJK hard-wrap defect. Noted only for completeness.
- [fr] DOC: apps/web-app/TERMS_OF_SERVICE.fr.md L17-20 says 'Dix outils' (ten tools) but lists only nine: Extracteur de palette, Explorateur d'harmonies, Comparaison, Constructeur de Dégradé, Mélangeur de Teintures, Vérification d'accessibilité, Suggestions Budget, Nuancier, navigateur de Palettes Prédéfinies communautaires. The Lecteur de mirages (Glamour Reader) is missing, against English L15-17. The count contradicts the list. The French PRIVACY.fr.md intro (L8-11) does include the Lecteur de mirages, so only the Terms are affected.
- [fr] I18N: In all four fr policy documents 'preset' is 'palette prédéfinie' / 'Palettes Prédéfinies communautaires', but the shipped UI says 'préréglage': web fr.json tools.presets.title is 'Préréglages communautaires' (26 hits), and bot-logic fr.json uses 'préréglage' 57 times (e.g. 'Tous vos préréglages favoris'). A French user following the policy will not find a feature by the policy's name. The web TERMS.fr L19 also capitalizes it inconsistently ('Palettes Prédéfinies').
- [fr] I18N: apps/web-app/src/locales/fr.json L1204 charaHint 'Analysé sur cet appareil. Rien n'est envoyé — ...' means 'Nothing is sent'. The English en.json L1204 says 'Nothing is uploaded'. The French UI string claims more than the English and contradicts the French policy's own gear-lookup paragraph (PRIVACY.fr.md L40-47: equipment model numbers and the facewear id are sent to the API and on to XIVAPI). Suggest 'Rien n'est téléversé' or 'Le fichier n'est jamais envoyé'.
- [fr] DOC: affects the English governing text, not a fr divergence. web en.json/fr.json L902 previewImagePendingReview ('Picture uploaded — it appears once a moderator approves it' / 'Image envoyée — elle apparaîtra après validation') reports a user-uploaded preset picture. Neither PRIVACY.md nor PRIVACY.fr.md says user-uploaded pictures are stored; L73-74 says only that previews are served from shots.xivdyetools.app. Route to the English policy owner.
- [fr] DOC: English apps/web-app/PRIVACY.md L47 quotes "Reset settings" while en.json config.resetSettings is 'Reset Settings'. Casing only. The fr text 'Réinitialiser les paramètres' matches fr.json.
- [fr] I18N: apps/discord-worker/TERMS_OF_SERVICE.fr.md L75 leaves 'All Rights Reserved.' in English. The web TERMS.fr L117 translates the same notice as 'Tous droits réservés.' The two fr documents are inconsistent.
- [fr] I18N: in both fr privacy documents, the bold emphasis on the logging-off claim is dropped ('switched **off**' becomes plain 'désactivée' at web PRIVACY.fr L175 and bot PRIVACY_POLICY.fr L120). Typography only.
- [fr] I18N: apps/web-app/PRIVACY.fr.md renders 'upload' inconsistently: 'importez' (L12), 'téléversé' (L37, L184), and 'envoyées' in the quoted padlock notice (L23, which matches fr.json). The bot policy consistently uses 'téléversé'.
- [fr] I18N: apps/web-app/PRIVACY.fr.md L53 'lignes d'obtention' and the UI's glamour.sheet.cardNote 'notes d'obtention' use different nouns for the same Acquisition line. TERMS.fr L121 and bot TERMS.fr L79 use 'méthodes d'acquisition' for the game-data acquisition methods. These are not quoted labels.

## Reviewer handoffs (verbatim, by review)

### oauth

- documentation: apps/web-app/PRIVACY.md:66-67 could state that for XIVAuth the stored username is the verified FFXIV character name (six-file edit)
- documentation: wrangler.toml dev D1 id placeholder TODO_RUN_WRANGLER_D1_CREATE makes --env development deploy fail until created
- documentation/cleanup: packages/worker-kit/src/rate-limiter/presets/configs.ts:28-29 keeps /auth/refresh limit for a removed endpoint
- plain bug (minor): oauth-flow.ts:283 uses console.error instead of request logger for blocked-redirect event

### presets-api

- GET /api/v1/presets?search= has no length cap; D1 LIKE patterns are limited (about 50 bytes per D1 docs) so a long term likely 500s (preset-service.ts:250-255); unverified locally
- presets.ts:246 page has no upper bound; a huge value gives a huge OFFSET bind and probably a D1 error 500
- JSON null body makes `body.name` throw a TypeError and return a generic 500 on POST/PATCH presets (presets.ts:924-931,559-575) and moderation status (moderation.ts:105-111); should be 400
- DEPRECATIONS.md Perspective checklist should state that the local list is empty (see c1) and add removing the Perspective mention from both privacy documents (six-file edits) when the tier goes
- PATCH /presets/refresh-author alters author_name, which the revision trigger counts, so a login-time refresh can 409 an in-flight owner edit (migrations/0014:7-12)
- Dead-letter and submission_events pruning ride requests (no cron); worth a line in docs/operations

### moderation-worker

- Operations: confirm presets-api migrations 0013 and 0014 are applied in production (hand-run per docs/operations/security-remediation-2026-09-15.md); the 0014 trigger is what makes the direct hide/restore writes revision-safe.
- i18n: several moderator-facing literals are hardcoded English (Unknown action, Invalid preset ID format., Reason, Rate limit exceeded, Unbanned by moderator).
- Documentation: if c2 is accepted, the ban-record retention line goes in all six policy files (discord-worker PRIVACY_POLICY siblings) and apps/moderation-worker/README.md.

### discord-worker-core

- presets-api: bot sends X-User-Discord-Name on moderator actions; confirm not persisted, consider dropping
- presets-api: v2 signature path excludes query string (preset-api.ts:107)
- ops: confirm Workers Logs are off in the dashboard for both discord-worker scripts (no observability block in wrangler.toml)
- bug: first-run follow-up (index.ts:889) can race the initial interaction response
- bug: validateEnv MODERATOR_IDS grammar differs from isModeratorId
- docs: preferences.ts legacy-keys comment stale after c1 fix

### discord-worker-commands

- Possible bug, unverified: preset-api.ts:96-97 puts the raw display name in the X-User-Discord-Name header; characters above U+00FF may throw in new Request() and break /preset submit/edit for those users (presets-api reads it raw at auth.ts:254). Consider encodeURIComponent on both ends.
- Cosmetic: sanitizeEmbedText runs over the whole localized card.swatchParseError template (glamour.ts:168, swatch.ts:130), so markdown inside the locale string is escaped literally.
- Hardening: no max_length on tags (schemas.ts:1089), colour / dye text options and world in the command schemas.
- Trivial: the preferences record keeps an exact updatedAt ISO timestamp, shown to the user, not named in the policy preferences row.

### image-worker

- Add test for GIF frame larger than logical screen vs dimensions.ts:84 gate
- No other non-security defects found

### api-worker-public

- Documentation: the 429 message says '60 requests per minute' (rate-limit.ts:126) while the binding allows 65 per 60 s; check that docs/guide/rate-limits.md agrees.

### api-worker-chara-universalis-telemetry

- Web analytics spec line 156 says ver matches /^\d+\.\d+\.\d+/ but schema.ts:68 also allows a -prerelease tail (documentation)
- Icon/universalis 400 bodies echo user input (received/invalidIds); harmless, consistency only

### og-worker

- documentation: c1 needs one sentence in apps/web-app/PRIVACY.md (plus the 5 translations) saying og-worker keeps server-side counts of tool and crawler category with no IP, UA or URL.
- infra: confirm the 2026-09-01 WAF rate-limit rule also covers og-beta.xivdyetools.app and beta.xivdyetools.app. Those are live beta routes and there is no in-worker limiter. This cannot be verified from source.
- plain bug (minor): apps/og-worker/src/index.ts:874-883 and 919-928 write the analytics datapoint before the steps/ratio range check, so rejected requests are counted.

### web-app-shell

- oauth: ALLOWED_REDIRECT_ORIGINS (apps/oauth/src/constants/oauth.ts:10-20) still lists xivdyetools.projectgalatine.com (transition) and localhost/127.0.0.1 origins in production; beta is allowed and deploys from any non-main branch push (deploy-web-app-beta.yml:19-30)
- documentation: docs/architecture/security-trade-offs.md lacks the localStorage-JWT trade-off entry the 2026-08-29 report requested
- bug: auth-service.ts:756 performLogout awaits /auth/revoke with no timeout, delaying local session clear on a hung connection
- bug cosmetic: duplicated Cache-Control on /index.html from overlapping /*.html and /index.html rules
- telemetry reviewer: payload sends full APP_VERSION, locale, theme and viewport bucket (telemetry-service.ts:195-200); verify against schema.ts and PRIVACY.md 107-128

### web-app-content

- advanced-options-panel.ts:310 and collection-manager-modal.ts:581: settings and collection import have no file size cap (the image and .chara inputs use MAX_USER_FILE_BYTES); local-DoS bug
- indexeddb-service.ts:100-108: empty PALETTES and SETTINGS stores still created though PRIVACY says IndexedDB holds one thing; dead-code cleanup plus a DB_VERSION bump
- error-handler.ts:92-103: ErrorHandler.report is a dead Sentry shim; dead-code candidate
- preset-submission-service.ts:235-252: preview image uploaded as original bytes with no client re-encode; EXIF/GPS stripping is for the presets-api and image-worker reviewers
- v4-layout.ts:754: renderPlaceholder interpolates toolId into innerHTML; use textContent for defence in depth
- chara-session-service.ts:15-17: module doc claims nothing from the file touches localStorage; see c4

### packages-security

- packages/auth/src/hmac.ts:157,182: add `await` before crypto.subtle.verify so the catch-returns-false contract holds (plain bug)
- packages/worker-kit/src/rate-limiter/backends/cloudflare.ts:151-157: warn at construction when no tier period matches a config window (limit-only fallback is silent)
- packages/auth/src/hmac.ts:231: docblock says path is 'no origin, no query'; keep the PKG-03 decision visible in consumer docs (documentation skill)

### packages-domain

- documentation: parser error text echoes file values; any new consumer (stoat-worker /swatch) must run sanitizeEmbedText - note in bot-logic CLAUDE.md
- hardening: drop raw `producer` from SwatchCharacter (swatch.ts:80)
- web-app reviewer: chara-file-loader.ts:81,98 logs file.name, producer and echoed field value via logger; confirm console-only
- package hygiene: exclude dist/commands/__fixtures__/chara-fixtures.* from the bot-logic tarball

### stoat-worker

- about.ts:231-233 advertises unrouted '!xd random' and unimplemented features (P3 docs/bug)
- config.ts Upstash vars and isAuthorized/STATS_AUTHORIZED_USERS unused (P3 dead code)
- MessageContextStore written but never read (P3)

### ci-supply-chain

- docs: DEPLOY_ENVIRONMENTS.md / secret-rotation runbook should say DISCORD_TOKEN and MODERATION_DISCORD_TOKEN are repo-scope today, or reflect the move once c1 is fixed
- ops: confirm the new 'copilot' GitHub environment (created 2026-09-28) is intended and that non-main Copilot branches may trigger the three beta deploy workflows
- plain bug: oauth [env.development] D1 database_id is the placeholder TODO_RUN_WRANGLER_D1_CREATE, so a deploy to that env fails
- discord-worker reviewer: the beta bot is on workers.dev with ENVIRONMENT=development (apps/discord-worker/wrangler.toml:16); no dev-mode signature bypass found by grep, please confirm
- privacy reviewer: 5 .chara fixtures under packages/core/src/services/chara/__tests__/fixtures/ are exempt from gitleaks; confirm they contain no real TypeName/Nickname data
- I also ran extra read-only gh api GETs beyond the brief's list (actions/secrets, environments/*/secrets names only, rulesets, collaborators, repo security_and_analysis, beta branch-policies); all are logged in the review file

### secret-hits

- Exclude docs/audits from the potential-secrets grep generator to reduce noise (tooling)
- gitleaks binary unavailable locally; full-history scan not run, only local git log -S sweeps

### delta-commits

- h1 Dependabot moved cloudflare/wrangler-action to 953926a2e2182532811c01a25e53647d93bf07c0 (comment still '# v4'); confirm it is the v4.1.3 tag commit when network is allowed and write the full version in the comment (.github/workflows/deploy-*.yml)
- h2 presets-api migration 0014 must run before the revision-aware deploy; without the column presetRow.content_revision is undefined and bind(undefined) raises D1_TYPE_ERROR (500 on every edit and moderation write). Deploy-order note for docs/developer-guides/contributing.md
- h3 apps/web-app/PRIVACY.md still uses British spellings ('favourite', 'colours') that the American-spelling pass covers elsewhere (documentation-audit skill)

### pii-bot

- PRIVACY_POLICY never names the moderation-worker application, which has its own logs and counters
- Verify web-app/PRIVACY.md mentions the presets-api per-IP native rate-limit key (pii-web)
- preferences.ts:723/788 hand-build the prefs:v1 key instead of buildPrefsKey (refactor)
- stoat about.ts advertises unrouted commands (see review-stoat-worker.md)

### pii-web

- documentation: PRIVACY.md:72-73 points to Questions? for removal but the section describes no procedure (c8); DEPRECATIONS.md Perspective checklist omits the policy files (c6)
- i18n: web locale analyticsDesc (en.json:238, all six) omits time-on-tool and theme-switch events that PRIVACY.md lists
- plain cleanup: apps/web-app/src/services/indexeddb-service.ts:95-108 still creates empty PALETTES and SETTINGS object stores nothing writes
- presets-api reviewer: confirm preview-image upload strips EXIF / re-encodes and what image-worker /thumbnail retains (c2)
- documentation: apps/oauth/src/handlers/xivauth.ts:41-44 comment says character scope gives 'FFXIV character info' but it is only used to pick a verified name

### regression

- documentation: 2026-09-15 SECURITY_AUDIT_REPORT.md still shows all six findings as 'OPEN - fixed locally; deploy pending' while HEAD (main) contains every fix commit, so the status table needs closing once the acceptance checks are recorded.
- documentation: 2026-08-29 SECURITY_AUDIT_REPORT.md Positive controls says '15/15 workflows' but 14 workflow files exist at HEAD (git ls-files .github/workflows).
- documentation/i18n: policy-text halves of 08-29/002, /006 and /008 (Google named in the web guide, KV prefixes and 180-day first-run flag in the bot policy, deletion path) were not re-read in this review; hand to the policy-claims reviewer.
- plain bug (INFO): apps/image-worker/src/index.ts:138 /extract parses its JSON body with no byte cap (INTERNAL only).
- plain note (INFO): oauth callback/xivauth handlers call c.req.json() after jsonDepthLimit already consumed c.req.text(); this works only through Hono's body cache, so the order is load-bearing (covered by callback.test.ts).

### trust-boundaries

- bug (presets-api): GET /api/v1/presets?search= has no length cap (apps/presets-api/src/handlers/presets.ts:226,241; services/preset-service.ts:249-254). D1 documents a 50-byte LIKE pattern limit, so a long search should produce an unhandled 500. Unverified against D1. Cap search to about 40 characters and return 400 above it.
- bug (presets-api): notifyDiscordBot calls env.DISCORD_WORKER.fetch with no AbortSignal (apps/presets-api/src/services/notification-service.ts:184-193), unlike every other service-binding call.
- bug (image-worker): no app.onError, and POST /extract calls c.req.json() with no size cap (apps/image-worker/src/index.ts:135-139). Internal only.
- doc: docs/architecture/security-trade-offs.md has no entry for the per-isolate Universalis limiter (BUG-066), which rate-limiter.ts:39 and the 2026-08-29 report call an accepted trade-off.
- doc: the 2026-09-15 SECURITY_AUDIT_REPORT.md positive control 'User-specific/auth responses use no-store controls' overstates presets-api.
- robustness (api-worker): XIVAPI searchItems and getGlasses use an unbounded response.json() on a var-configured host (apps/api-worker/src/chara/xivapi.ts:280,294). lib/bounded-body.ts already has a bounded reader.
- robustness (core): APIService.fetchWithTimeout checks size after response.text() has buffered the body (packages/core/src/services/APIService.ts:709-718).
- consistency: presets-api and moderation-worker still return stack in development onError, while api-worker never does.
- privacy reviewers: discord-worker and moderation-worker log the Discord user id at info (apps/discord-worker/src/index.ts:832, apps/moderation-worker/src/index.ts:247). Confirm the retention wording in the bot policy.

### injection-classes

- Documentation: discord-worker CHANGELOG/CLAUDE.md FINDING-019 wording is accurate but silent on the initial-response path (c2)
- stoat-worker (parked): commands/parser.ts:100 split(/\s+/) and dye-resolver edit distance run on unbounded user text; owned by the stoat unit review
- c1 is also a plain performance bug (quadratic regex) independent of the security framing

### policy-web-en

- Docs: tool names in PRIVACY:8-10 / ToS:15-17 differ from en.json (Budget Suggestions, Dye Comparison, Gradient Builder, Dye Mixer, Accessibility Checker)
- Docs: ToS:86 says report vulnerabilities by email; SECURITY.md:7-8 says GitHub private vulnerability reporting
- Docs: READMEs and core use Discord invite 5VUSKTZCe5 while policies use rzxDHNr6Wv
- Docs: web-analytics spec :156 `ver` pattern omits the -prerelease tail allowed by schema.ts:68
- i18n: ja/ko/zh PRIVACY siblings are 77 lines vs 164 (en)/185 (de); line-level parity belongs to locale reviewers

### policy-bot-en

- documentation: no data-access/deletion runbook though PRIVACY_POLICY.md:153-161 promises 30-day handling; must cover KV prefs/legacy/favorites v1+v2/firstrun/usertrack, D1 presets/votes/moderation_log/submission_events/banned_users, Discord channel copies, undeletable Analytics Engine
- documentation: 'Votes ... Until removed or account deletion' (PRIVACY_POLICY.md:175) - bot has no accounts
- documentation: ToS service list could name /dye /manual /changelog /about /stats
- plain bug: apps/discord-worker/src/handlers/commands/budget.ts:413 logs raw error message redundantly beside the structured error
- documentation: PRIVACY_POLICY.md:48 '30 days' for KV stats counters is a rolling TTL refreshed on each write
- i18n: six-language parity of the c2-c6 edits (ja/ko/zh/de/fr) must ship with any English correction

### policy-ja

- DOC: apps/web-app/TERMS_OF_SERVICE.ja.md 'サイトの機能' says ten tools but lists nine; ミラプリリーダー (Glamour Reader) is missing from the list; check the other locales' ToS for the same omission
- I18N: apps/web-app/PRIVACY.ja.md:36 'フォントは自社ホスト' uses 自社 (company register); use 運営者 wording
- I18N: web PRIVACY.ja.md '十数個' for 'a dozen' (11-19 vs 12)
- I18N: apps/discord-worker/PRIVACY_POLICY.ja.md stray spaces 'Cloudflareの Analytics Engine' (x2) and 'Discordユーザー ID' vs 'DiscordユーザーID'
- I18N: PRIVACY_POLICY.ja.md section 1 defines 「運営者の」 as a term, awkward

### policy-ko

- DOC: apps/web-app/TERMS_OF_SERVICE.ko.md 'What the site does' says ten tools but lists nine; 코디 리더 (Glamour Reader) omitted - check other locales too
- DOC: Perspective API listed in web PRIVACY item 3 and bot PRIVACY section 6 (all languages) but sunsets 2026-12-31 (DEPRECATIONS.md:10-15)
- DOC: web ko.json:1033 / en.json:1033 'display name' vs policies' 'username'
- I18N: 운영자 (moderators) vs 관리자 (maintainer) terminology note
- I18N: bot PRIVACY ko stiff phrasing (사용 통계 구간, 원격 측정) optional polish

### policy-zh

- DOC: apps/web-app/TERMS_OF_SERVICE.zh.md:14 says ten tools but lists nine; Glamour Reader (幻化查看器) missing from the list (deferred by e15928b2)
- I18N: stray spaces after CJK punctuation: apps/web-app/PRIVACY.zh.md:33,40,57,59; apps/web-app/TERMS_OF_SERVICE.zh.md:5; apps/discord-worker/PRIVACY_POLICY.zh.md:187
- I18N: web PRIVACY.zh uses 服务器 for World; consider 市场服务器 as the bot policy does
- I18N: docs/reference/ffxiv-terminology.md:57 Facewear zh 脸部配饰 vs 面部配饰 used in core data and policies
- I18N: apps/discord-worker/PRIVACY_POLICY.zh.md:28 vendor-sold rendered 商店; check against bot zh.json category labels
- DOC: English web PRIVACY Questions? section gives no deletion procedure or deadline for the web account record that ToS and section 3 point to (all six languages inherit it)

### policy-de

- I18N: apps/web-app/src/locales/de.json:1204 charaHint says 'Nichts wird übertragen' (nothing is transferred). English en.json:1204 says 'Nothing is uploaded'. German is broader than English and untrue given the gear lookup that sends model numbers to data.xivdyetools.app. Use 'Nichts wird hochgeladen'.
- DOC: apps/web-app/PRIVACY.de.md:8-13 and TERMS_OF_SERVICE.de.md:17-19 have uneven hard wraps after the 2e4cb0cb edit (cosmetic). Fixing c1 in the same edit will tidy the ToS lines.

### policy-fr

- DOC: check de/ja/ko/zh web TERMS_OF_SERVICE for the same Glamour Reader omission in the tool list (only EN contained the string in my grep of EN/fr/de)
- I18N: unify 'palettes prédéfinies' (policies) with shipped 'Préréglages communautaires' (web fr.json:71) and 'préréglages favoris' (bot-logic fr.json:298)
- I18N: web TERMS fr heading 'Fin des choses' is a literal rendering of 'Ending things'
- I18N: PRIVACY.fr.md:147 'Le serveur rejette tout ce qui concerne la requête' reads like request rejection; use 'ignore tout le reste de la requête'
- I18N: bot TERMS fr:23 mirror the clarified English: 'ou aux couleurs extraites d'une image'
- I18N: ffxiv-terminology.md lists both 'Accessoires faciaux' (row 57) and 'Accessoires de visage' (row 313) for Facewear; reconcile
- I18N: straight vs guillemet quotes for the email subject in web TERMS fr:184 and bot TERMS fr:142

### gap2-bot-name-header-author-name

- web-app language-service.ts:184-189 tInterpolate uses String.replace with a replacement string, so author names containing $& or $$ render mangled; use function replacer
- No workerd-run test for a CJK userName through request(); unit tests mock fetch on Node where Headers rejects >U+00FF
- discord-worker preset-api.ts:510-513 autocomplete .slice(0,100) is UTF-16 based and can cut a surrogate pair; moderation-worker uses code-point clampChoiceName
- Consider adding U+2066-2069 bidi isolates to INVISIBLE in packages/bot-logic/src/discord-markdown.ts:22

### gap2-beta-deploy-actors-vs-prod-trust

- ops: add copilot/** to branches-ignore or give beta env a branch policy before enabling Copilot agent
- ops: repo webhook list contains a Discord webhook URL with token (admin-only API); rotate if that output is ever shared
- docs: security-trade-offs INF-06 should record verified actor set and the beta-prod trust coupling

### gap2-identity-link-blast-radius

- Docs: add the id switch to security-trade-offs.md or api-contracts.md:80 if kept; PRIVACY/TOS removal text could mention pre-link presets need maintainer removal
- Plain bug: refresh-author returns success with updated: 0 after link with no hint

### gap2-bot-deletion-promise-vs-stores

- Documentation: add a deletion runbook to docs/operations listing exact KV keys (prefs:v1:, favorites, firstrun:v5:, legacy i18n:user:, budget:world:v1:), the D1 statements (votes, submission_events, presets author fields), and the stores that cannot be deleted
- Documentation: PRIVACY_POLICY.md:20 (username kept until deletion) conflicts with :174 (presets kept indefinitely); say that deletion anonymises author_name

### gap2-web-app-grep-only-components

- PRIVACY.md:44-49 does not name v5_saved_presets (saved community presets incl. other authors' names) explicitly; consider wording (docs)
- Import size cap missing for settings/collection JSON (already tracked)

### gap3-dev-dependency-advisories

- Add a scheduled non-blocking full pnpm audit (moderate and above) so dev-tool advisories surface; related to ci-supply-chain#c3
- pnpm-workspace.yaml qs override matches no lockfile entry; housekeeping only
