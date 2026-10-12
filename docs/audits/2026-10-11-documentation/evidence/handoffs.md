# Hand-offs (2026-10-11 documentation audit)

These were confirmed by a verifier but belong to another skill per `.agents/skills/audit-shared/policy-documents.md` § *Who files what*. They carry no DOC- ID.

## security-audit (a policy claim that is false against the code)

| Item | Policy location | What the code does |
|---|---|---|
| first-run notice flag | `apps/discord-worker/PRIVACY_POLICY.md:30` (+ all five variants); echoed by `docs/user-guides/discord-bot/getting-started.md:173-176`, `docs/user-guides/discord-bot/faq.md:181-183` | `apps/discord-worker/src/index.ts:881` writes `firstrun:v5:<id>` (180-day TTL) **before** the preferences check at :883-884, so users with saved preferences get the flag without ever seeing the notice. The policy says the flag records that the notice was shown. |
| collection deletion route | `apps/web-app/PRIVACY.md:59` "Manage Collections → Delete Collection" (+ all five variants) | The collection manager is opened only from `DyeSelector` (`apps/web-app/src/components/dye-selector.ts:553-566`), which no V4 tool renders; live check 2026-10-11 found no Manage Collections control on any dye-picker tool. Same root as DOC-003. |

## i18n-manager (translation quality, terminology, register — 18 items)

| Candidate | Location | Issue | Suggested rendering |
|---|---|---|---|
| manual-04 | packages/bot-logic/src/i18n/locales/de.json manual5.topics.contrast.body (and manual.contrast.description); fr.json same keys | de/fr write the WCAG ratio as '4,5' in the topic body but '4.5:1' in the /manual overview line | Pick one separator per locale (the decimal comma for de/fr is the usual choice) and use it in both strings. i18n-manager owns the call. |
| policy-ja-01 | apps/web-app/TERMS_OF_SERVICE.ja.md:60 | サイトを使って誰かを嫌がらせすること | サイトを使って誰かに嫌がらせをすること、またはマルウェアを配布すること |
| policy-ja-02 | apps/web-app/TERMS_OF_SERVICE.ja.md:78 | FINAL FANTASY XIV (c) SQUARE ENIX ... FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd. (whole second sentence left  | Keep the (c) line verbatim, then add: FINAL FANTASYはスクウェア・エニックス・ホールディングス株式会社の登録商標です。 |
| policy-ja-03 | apps/discord-worker/PRIVACY_POLICY.ja.md:9; apps/discord-worker/TERMS_OF_SERVICE.ja.md:11 | （以下「本Bot」、「運営者」または「運営者の」）; （以下「本Bot」または「運営者のBot」） | PRIVACY_POLICY.ja L9: （以下「本Bot」。本Botを運営する者を「運営者」といいます）. TERMS_OF_SERVICE.ja L11: （以下「本Bot」） |
| policy-ja-04 | apps/discord-worker/PRIVACY_POLICY.ja.md:47; apps/discord-worker/PRIVACY_POLICY.ja.md:131; apps/discord-worker/PRIVACY_POLICY.ja.md:183 | Cloudflareの Analytics Engineの...; Discordユーザー ID | CloudflareのAnalytics Engineの保持期間; DiscordユーザーID |
| policy-ja-05 | apps/web-app/TERMS_OF_SERVICE.ja.md:39 | 投稿は公開される前に自動コンテンツチェックを通過する必要があります。 | 投稿は、公開される前に自動コンテンツチェックにかけられます。 |
| policy-ja-06 | apps/web-app/PRIVACY.ja.md:82 | Analytics Engineでのデータ保持期間は約三ヶ月です。 | 約3か月です。 |
| policy-de-01 | apps/discord-worker/PRIVACY_POLICY.de.md:173 | / Dienst / Zweck / Ihre Datenschutzrichtlinie / | Replace the header cell with: 'Deren Datenschutzrichtlinie' (or 'Datenschutzrichtlinie des Anbieters'). |
| policy-fr-01 | apps/discord-worker/PRIVACY_POLICY.fr.md:28 | excluded dye categories listed as "(métallique, pastel, sombre, cosmique, ishgardienne, chère, de vendeur, artisanale)" | (teintures métalliques, pastel, sombres, cosmiques, ishgardaises, coûteuses, vendues par un marchand, artisanales) |
| policy-fr-02 | apps/discord-worker/PRIVACY_POLICY.fr.md:47; apps/discord-worker/PRIVACY_POLICY.fr.md:129 | "limité par débit" (L47) and "limitée par débit" (L129) for "rate-limited" / "rate limited" | L47: "soumis à la limitation de débit". L129: "quand une commande est soumise à la limitation de débit". |
| policy-fr-03 | apps/web-app/TERMS_OF_SERVICE.fr.md:78; apps/web-app/TERMS_OF_SERVICE.fr.md:87; apps/web-app/TERMS_OF_SERVICE.fr.md:104; apps/web-app/TERMS_OF_SERVICE.fr.md:172; apps/discord-worker/TERMS_OF_SERVICE.fr.md:62; apps/discord-worker/TERMS_OF_SERVICE.fr.md:69 | Headings translated literally: "Appels et retrait", "Services d'autres personnes", "Fin des choses", "Processus d'appel", "Les appels sont e | "Recours et retrait" / "Les recours sont examinés sous 7 jours"; "Services tiers"; "Fin de l'utilisation"; "Procédure de recours". |
| policy-fr-04 | apps/discord-worker/TERMS_OF_SERVICE.fr.md:75 | "FINAL FANTASY XIV © SQUARE ENIX CO., LTD. All Rights Reserved." left in English | FINAL FANTASY XIV © SQUARE ENIX CO., LTD. Tous droits réservés. |
| policy-fr-05 | apps/web-app/PRIVACY.fr.md:133 | "Les polices sont hébergées par nous-mêmes." | Les polices sont auto-hébergées. |
| policy-ko-02 | apps/web-app/PRIVACY.ko.md:38; apps/web-app/PRIVACY.ko.md:80 | "사용자가 선택한 서버 또는 데이터 센터" (L38) and "캐릭터 이름이나 서버 이름" (L80) use 서버 for an FFXIV World, in a document that also uses 서버 for the Discord server ( | PRIVACY.ko.md:80: replace "캐릭터 이름이나 서버 이름" with "캐릭터 이름이나 게임 서버(월드) 이름". L38 may stay (it matches the UI label) or read "사용자가 선택한 게임 서버 또는 데이터 센터". i18n-manager owns the final call, since 서버 is the shipped web label. |
| policy-zh-01 | apps/web-app/PRIVACY.zh.md:18; apps/web-app/TERMS_OF_SERVICE.zh.md:11; apps/web-app/TERMS_OF_SERVICE.zh.md:88 | PRIVACY.zh:18 '与您其他已保存的收藏放在一起'; TOS.zh:11 and :88 '收藏集' (English: saved collections / palettes and collections) | PRIVACY.zh.md:18 '...保存在您浏览器存储中，与您其他已保存的集合放在一起。'; TERMS_OF_SERVICE.zh.md:11 '...并让您把调色板和集合保存到自己的设备上。'; :88 '您保存的调色板和集合存放在您自己的浏览器中' |
| policy-zh-02 | apps/web-app/PRIVACY.zh.md:103 | '**投票**：再次点击该预设上的**投票**按钮。' (English: 'select the vote button on that preset again', no quoted label) | '- **投票**：再次点击该预设上的投票按钮（此时显示为**已投票**）即可取消。' (keep the bold on the shipped label 已投票 or drop bold to match English) |
| policy-zh-03 | apps/web-app/PRIVACY.zh.md:94 | '打开开发者工具 → Network，启用「Preserve log」。' | '1. 打开开发者工具 → 网络（Network），勾选“保留日志”（Preserve log）。' |
| policy-zh-04 | apps/web-app/PRIVACY.zh.md:41; apps/web-app/PRIVACY.zh.md:48; apps/web-app/PRIVACY.zh.md:80; apps/web-app/PRIVACY.zh.md:82; apps/web-app/TERMS_OF_SERVICE.zh.md:5; apps/discord-worker/PRIVACY_POLICY.zh.md:202 | Stray ASCII space after full-width punctuation: '一样； Discord', ')、 [Garland', ')、 [Gamer Escape', 'alis、 Garland', '标识符， Cookie', '开源的： [`ap | Delete the space after the full-width mark at each location (e.g. '一样；Discord 等平台上的链接预览', ')、[Garland Tools]', '标识符，Cookie，', '开源的：[`apps/...', '条款：[`apps/...', '传输。Cloudflare 为国际数据传输'). |

## web-app / product owner (not documentation defects)

- The collection manager and its Export All / Import / per-palette download are orphaned in the V4 shell: `showCollectionManagerModal()` has one caller, `dye-selector.ts:565`, and the tools skip the `DyeSelector` when `leftPanel === rightPanel` (`mixer-tool.ts:622-630`). Users cannot export or import saved palettes. (DOC-003 is the doc side.)
- The live `index.html` meta description still names retired tools: "Color Matcher, Harmony Generator, Accessibility Checker, Dye Comparison, and Dye Mixer" (`evidence/baseline-live.txt`, probe 7).
- The Welcome modal lists nine tools; the Glamour Reader is absent (web-app-core reviewer).
- `apps/og-worker/src/services/svg/band.ts:2` comment still says nine tools.
- presets-api and moderation-worker still emit "Preset Palettes" in user-facing strings (e.g. `apps/presets-api/src/middleware/ban-check.ts:71`) although the tool was renamed Community Presets in web-app 5.12.4.

## Outside this audit's scope (supporting documents)

- Root `CLAUDE.md:161` gives a Hono floor of `^4.12.34`; every worker declares `^4.13.9` and the lockfile resolves 4.13.9.
- `packages/core/CLAUDE.md` APIService list omits `getPricesForDataCenterWithOutcome` (same gap as DOC-048).
