# Review: policy-web-en (web PRIVACY.md + TERMS_OF_SERVICE.md vs code)

Scope: apps/web-app/PRIVACY.md and TERMS_OF_SERVICE.md (English, governing; both "Last updated 2026-09-28", last commit 2e4cb0cb 2026-09-28 17:33 -0400) against apps/web-app source, apps/api-worker telemetry/rate-limit, apps/presets-api, apps/oauth, apps/og-worker, worker-kit, wrangler files. Read-only. No probe scripts written.

## 1. Entry points reached by the policy claims, and authz matrix

| Entry (what the doc describes) | Caller | Guards before handler | Body / param caps |
|---|---|---|---|
| POST data.xivdyetools.app/v1/telemetry (PRIVACY.md:97-132) | any browser; client sends only if toggle on and no GPC (telemetry-service.ts:118,193-203) | requestId+logger; Sec-GPC:1 -> 204 (router.ts:57); Origin allowlist xivdyetools.app / beta only (origin.ts); per-IP native limiter 240/60s fail-closed (rate-limit.ts:170-190) | 16 KB (schema.ts MAX_BODY_BYTES), 25 events |
| POST data.xivdyetools.app/v1/chara/resolve (PRIVACY.md:35-40) | any browser | CORS *, /v1 limiter 65/60s | 8 KB per api-worker review |
| GET data.xivdyetools.app/universalis/aggregated/... (PRIVACY.md:61-63) | any browser | CORS *, per-IP memory limiter | static DC list |
| GET /v1/chara/icon/:id (img-src data.xivdyetools.app) | any browser | as above | id |
| auth.xivdyetools.app OAuth + /auth/revoke (PRIVACY.md:65-68) | any browser | oauth RL_AUTH_* 60s tiers | per oauth review |
| api.xivdyetools.app presets: browse GET (no auth), POST/PUT preset, vote, POST /:id/preview-image (PRIVACY.md:65-74) | browse: anyone; writes: signed-in web user (JWT) | presets-api RL_PUBLIC 100/60s, JWT, ban check, daily caps via submission_events | preview image 5 MB (preview-image-service.ts MAX_PREVIEW_IMAGE_BYTES) |
| Pages static site + _headers CSP (PRIVACY.md:58) | anyone | CSP (public/_headers:30) | n/a |
| Policy documents (reached via About -> Privacy) | anyone | none | n/a |

## 2. Positive controls
- CSP connect-src 'self' https://*.xivdyetools.app; img-src self/data/blob + cdn.discordapp.com, shots., data. (apps/web-app/public/_headers:30); script-src 'self' and the only script tag is src/index.html:96. Fonts self-hosted, font-src 'self' (_headers:30; globals.css:28).
- Every `fetch(` in web-app src goes to same-origin /json/* or api./auth./data. hosts (outbound-fetch.txt; api-worker-origin.ts:11, auth-service.ts:57,62, preset-submission-service.ts:121). No third-party error reporter is wired (error-handler.ts:98 only reads window.Sentry if present).
- Telemetry: default OFF (tool-config-types.ts:417), GPC checked on every track and flush (telemetry-service.ts:118,189), queue dropped on toggle off in all tabs (98-110), nothing persisted, no client id; server allowlist maps to enums/dye DB, bad envelope -> 'invalid' (schema.ts:100-165), GPC and Origin gate before the body is read (router.ts:57-73), no IP/UA/requestId in the datapoint (router.ts:23-26,45).
- .chara: parsed on device (chara-file-loader.ts:57-69); resolve body is only gear model keys + glasses id (chara-resolve-service.ts:127-129; core chara-models.ts:24-32); telemetry sends only a normalized producer bucket (telemetry-service.ts:177-184); the community path never reads nickname/file name (glamour-block.ts:1700-1708); local fallback nickname -> file name exactly as documented (glamour-block.ts:1716-1721; chara-sheet.ts:163).
- Image purge: IndexedDB v3 deletes image_cache (indexeddb-service.ts:16,111-117); extractor deletes legacy v3_matcher_* keys on mount (extractor-tool.ts:111-119,431-433).
- External "Open in" links use window.open(..., 'noopener,noreferrer') (item-links-menu.ts:131; result-card.ts:1453).
- Perspective gets only `${name} ${description}` with `doNotStore: true`, key in a header (moderation-service.ts:261-274, 361-364); no account identity.
- oauth D1 `users` row = uuid, discord_id/xivauth_id, provider, username, timestamps; roster and avatar_url columns removed (oauth schema/users.sql:12-30; user-service.ts:111).
- Rate limit: native binding primary (api-worker rate-limit.ts:36-41), KV fallback TTL = 60 s window + 60 s buffer = 120 s (worker-kit kv.ts:64,211,234).
- Policy locale parity gate passes: five siblings per document (policy-locale-parity.txt).

## 3. Rejected items
- "Fonts self-hosted / no third-party analytics / no cookies": true (CSP, no document.cookie, no service worker, no Cache Storage use anywhere in src).
- CSP allows the `*.xivdyetools.app` wildcard rather than named hosts: consistent with "first-party hosts"; accepted outcome of 2026-08-21 FINDING-031.
- IndexedDB "holds one thing": DB defines 3 object stores (indexeddb-service.ts:21-25) but only PRICE_CACHE is ever written (api-service-wrapper.ts:116); true in effect.
- "About three months" Analytics Engine retention: matches the Cloudflare 90-day window and the bot policy; no contradiction, not verifiable offline.
- Telemetry `ver` regex permits a -prerelease tail (schema.ts:68): documented as "app version"; handoff only.
- Logger lines with file name / palette name (chara-file-loader.ts:90, glamour-block.ts:1736) are browser-console only; @shared/logger has no remote sink.
- "Nothing here is a tracking identifier": the only random ids are local collection/toast/modal ids (collection-service.ts:1072), never transmitted.
- 7-day appeal SLA (ToS:73) and contact existence: process claims, UNVERIFIABLE from code.

### 3b. Claim-by-claim table (doc:line | claim | code evidence | verdict)

| doc:line | claim | evidence | verdict |
|---|---|---|---|
| PRIVACY:5 | Last updated 2026-09-28 | last commit to the doc and to every described code path is the same day, 17:33 or earlier; nothing substantive after (git log --since) | TRUE |
| PRIVACY:8-12 | nine colour tools work on device; "the sections below are the complete list" | see c1, c6, c7 | FALSE (closure) |
| PRIVACY:16-18 | uploaded/pasted/dragged/camera images never leave device, never written to storage | extractor-tool.ts:1318-1329 Canvas only; legacy keys purged :111-119. Preset preview image IS uploaded: preset-submission-service.ts:230-251 | TRUE for the tools; FALSE if read unconditionally (c1) |
| PRIVACY:19-21 | extractor shows "Images are read in your browser and never uploaded", padlock, plain text; policy reached from About -> Privacy | en.json:307 exact; about-modal.ts:459 docLink('about.privacyPolicy') label "Privacy" (en.json:30) | TRUE |
| PRIVACY:25-29 | .chara parsed on device; name never sent, never used as preset/author name; community name field starts empty | chara-file-loader.ts:57-69; glamour-block.ts:1700-1708 | TRUE |
| PRIVACY:30-34 | local save falls back to nickname then file name; stays in browser; never uploaded | glamour-block.ts:1716-1721; chara-sheet.ts:163-166; collection-service.ts:455-465 | TRUE |
| PRIVACY:35-40 | resolve request carries only model numbers + facewear id; not file/name/colours/dyes; XIVAPI gets numbers only; names/acquisition/icons come back from data.xivdyetools.app | chara-resolve-service.ts:127-139; chara-models.ts:24-32 (plus slot-name strings, harmless); xivapi.ts:30,32 static UA; charaIconUrl :84-86 | TRUE |
| PRIVACY:44-49 | localStorage holds prefs, saved work, acquisition lines, session token; "Reset settings" and site-data controls clear it; "Reset all" deletes rewritten lines | auth-service.ts:478-480; acquisition-edits.ts:28; glamour-sheet.ts:369-370; but Reset Settings only resets tool configs (advanced-options-panel.ts:237-243, config-controller.ts:381-385) | PARTLY FALSE (c4) |
| PRIVACY:44 | "Advanced Settings", "Reset settings" labels | en.json config.advancedSettings "Advanced Settings", config.resetSettings "Reset Settings" (case only) | TRUE |
| PRIVACY:51-54 | IndexedDB: only the market price cache; legacy image copy deleted on first open after update | api-service-wrapper.ts:116; indexeddb-service.ts:111-117 (runs when the DB is first opened = first price-capable tool mount, market-board-service.ts:108; blocked while another tab holds the old DB, :122-125) | TRUE (minor caveat) |
| (silent) | sessionStorage | auth-service.ts:656-665,704-709; preset-submission-form.ts:730 | SILENT (c8) |
| PRIVACY:58-59 | only first-party hosts ("CSP allows nothing else") plus named third parties | _headers:30; img-src also cdn.discordapp.com (named at :74) | TRUE |
| PRIVACY:61-63 | "Show Prices" toggle (optional); item ids + world/DC to data.xivdyetools.app -> Universalis | showPrices default false (tool-config-types.ts:414); service returns an empty map when off (market-board-service.test.ts:411); api-service-wrapper.ts:26-50 | TRUE |
| PRIVACY:65-74 | browse sends nothing about you; sign-in creates provider id + username record immediately; presets/votes under account; author name shown; avatars from Discord CDN; previews from shots. | user-service.ts:111; auth.ts:358 (author = display name, c3); preset-card.ts:369; config-sidebar.ts:1688; img-src | TRUE with c3 wording gap |
| PRIVACY:69-73 | Perspective gets name + description, doNotStore, nothing else | moderation-service.ts:261-274,361-364 | TRUE; STALE after 2026-12-31 (c5) |
| PRIVACY:72-73 | removal "see Questions? below" | PRIVACY:161-164 has no removal instructions | FALSE/vacuous (c2) |
| PRIVACY:75-77 | share links encode chosen dyes in URL; og-worker sees only the URL | share-service.ts:246-280; og-worker index.ts:597-601 logs category only | TRUE (og analytics: c10) |
| PRIVACY:78 | analytics goes to data.xivdyetools.app | telemetry-service.ts:230 | TRUE |
| PRIVACY:80-81 | fonts self-hosted, no third-party trackers, no cookies | see Rejected | TRUE |
| PRIVACY:85-95 | "Open in..." and dye-card hosts; only item id/name in URL; new tab, referrer suppressed | item-links.ts:81-96; result-card.ts:174-177,1453; item-links-menu.ts:131 | TRUE for the listed links; preset example link not listed (c7) |
| PRIVACY:99-104 | off by default; Advanced Settings -> Enable Analytics; GPC wins; server enforces origin + Sec-GPC; off stops sending in all tabs | advanced-options-panel.ts:353 (Behavior card :337-355); en.json config.enableAnalytics "Enable Analytics"; telemetry-service.ts:98-110,118; router.ts:57-73 | TRUE |
| PRIVACY:109-116 | tool views (entry, dwell seconds), dye picks (id + tool, explicit only), chara parse (producer family), theme switches | telemetry-service.ts:127-129,141,173,83-86; v4-layout.ts:223 (consumed && !random); dye-selector.ts:278; theme-switch.ts:23 | TRUE |
| PRIVACY:118-119 | five dimensions: version, env, locale, theme, viewport bucket | telemetry-service.ts:193-201, viewport :241-246 | TRUE |
| PRIVACY:121-126 | never stored: IP, UA, ids, cookies, URLs, colours, text; allowlist | router.ts:23-26; schema.ts EVENT_SCHEMAS | TRUE |
| PRIVACY:128 | Analytics Engine keeps ~3 months | Cloudflare default | UNVERIFIABLE (consistent) |
| PRIVACY:129-132 | links to telemetry-service.ts and schema.ts | both paths exist | TRUE |
| PRIVACY:139-144 | per-IP 60 s limiter via Cloudflare binding; KV fallback key contains IP, 120 s; not linked to analytics | api-worker rate-limit.ts:36-41; presets-api rate-limit.ts:58-60; oauth rate-limit.ts:71-82; kv.ts:64,211 (60+60) | TRUE |
| PRIVACY:147-152 | Workers Logs OFF on every worker; lines visible only on a live tail | no [observability] in any wrangler file; image-worker index.ts:84-88 cites the 2026-08-29 dashboard check | UNVERIFIABLE now / TRUE per prior audit (c11) |
| PRIVACY:156-159 | verify via the Network tab | consistent | TRUE |
| ToS:9-17 | ten tools incl. Presets browser; prices; .chara; local saves | en.json tools.* has 10 keys; schema TOOL_IDS has 10 | TRUE (names differ, handoff) |
| ToS:28-31 | Discord/XIVAuth sign-in, no password; account record = provider ID + username; "username shown as author"; session token in browser | user-service.ts:111; auth.ts:358 prefers display name | PARTLY FALSE (c3) |
| ToS:56-59 | auto checks; clean -> published immediately and logged for audit; flagged or unavailable -> held | presets.ts:666-690 (perspective_unavailable treated as flagged); submission path :960-1050 | TRUE |
| ToS:67-74 | appeal steps; removal "see PRIVACY.md" | circular with PRIVACY:72 | c2 |
| ToS:86 | report vulnerabilities privately by email | SECURITY.md:7-8 says GitHub private vulnerability reporting | STALE/inconsistent (handoff) |
| ToS:93-98 | third parties: Universalis, XIVAPI, Discord, XIVAuth, link targets | matches; Perspective, Discord moderation channel, shots host not named | partly silent (c6) |
| ToS:122-125 | saved palettes/collections live in the browser only | collection-service.ts localStorage | TRUE |

Hosts named vs contacted: Universalis (via proxy), XIVAPI (api-worker xivapi.ts:30), Discord (OAuth, CDN, bot notify), XIVAuth, Perspective (presets-api), Mirapri/Garland/Teamcraft/GamerEscape/Lodestone/Saddlebag (navigation only). Contacted but not named: Cloudflare cache-purge API by presets-api (no user data), image-worker (internal service binding).

In-product copy cross-check (policy-claims-i18n.txt, en): "Images are read in your browser and never uploaded" (en.json:307) agrees with PRIVACY:19-20; sign-in note (en.json:1033) says "display name appears on presets" (agrees with code, disagrees with ToS:29-30 "username"); glamour edit note (en.json:1411) agrees with PRIVACY:44-49; analytics description "No identifiers, no images" agrees. Preview-image hint (en.json:1051-1052) tells the user a file is uploaded; the policy is silent (c1). All five locale files carry the same four privacy strings (policy-claims-i18n.txt).

## 4. Files covered
apps/web-app/PRIVACY.md, TERMS_OF_SERVICE.md, public/_headers, src/index.html (grep), src/locales/en.json (targeted keys), src/services/{telemetry-service,chara-file-loader,chara-resolve-service,api-worker-origin,api-service-wrapper,indexeddb-service,auth-service (storage/avatar parts),theme-switch,preset-submission-service (upload/delete),config-controller (reset)}.ts, src/components/{about-modal,advanced-options-panel,glamour-block (name paths),chara-file-card,item-links-menu,v4/preset-card,v4/preset-detail,preset-edit-form,dye-selector,v4-layout (telemetry parts),extractor-tool (legacy keys)}.ts, src/shared/{example-link,item-links,acquisition-edits}.ts; apps/api-worker/src/telemetry/{schema,router,origin}.ts, src/middleware/rate-limit.ts, wrangler.toml; apps/presets-api/{wrangler.toml, src/middleware/auth.ts, src/handlers/presets.ts (submit/refresh-author), src/services/{moderation-service,preview-image-service,notification-service,rate-limit-service}.ts, migrations 0003/0011}; apps/oauth/{wrangler.toml, schema/users.sql, src/services/user-service.ts, src/handlers/token.ts (grep)}; apps/og-worker/src/index.ts:425-455; packages/worker-kit/src/{middleware/logger,rate-limiter/backends/kv}.ts; DEPRECATIONS.md, SECURITY.md, apps/discord-worker/PRIVACY_POLICY.md (cross-reference); evidence files named in the brief; review-api-worker-chara-universalis-telemetry.md and review-og-worker.md (cross-reference only).

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | MEDIUM | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:16-18,56-81 | Closure and "images never leave your device" contradicted by the preset Preview image upload (bytes -> presets-api -> image-worker -> public R2 / shots.xivdyetools.app); section 3 mentions only serving |
| c2 | LOW | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:72-73,161-164 and TERMS_OF_SERVICE.md:73-74 | Account/submission removal path is circular and contains no steps |
| c3 | LOW | INTERNET-UNAUTH | apps/web-app/TERMS_OF_SERVICE.md:29-30 | "username shown as author" but code shows the display name (global_name first) and stores it in presets.author_name |
| c4 | LOW | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:47-48 | "Reset settings ... clear it" overstates; it only resets tool configs |
| c5 | LOW | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:69-73 | Perspective statement becomes false after the 2026-12-31 shutdown / secret deletion |
| c6 | LOW | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:65-74 | Silent on server stores/flows the bot policy discloses: submission_events (user id, 30 d), ban list, token-revocation KV, Discord moderation notification carrying author name + id |
| c7 | INFO | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:83-95 | Preset example link (user URL to X/Reddit/Instagram/pixiv...) is an off-site navigation not listed; "nothing about you in the URL" is scoped to the listed links |
| c8 | INFO | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:42-54 | sessionStorage (PKCE verifier, OAuth state, return path, pendingPresetId) missing from the storage inventory |
| c9 | INFO | INTERNET-UNAUTH | apps/web-app/TERMS_OF_SERVICE.md:69,169 | Policy documents use Discord invite rzxDHNr6Wv; the in-product link (core PRODUCT_LINKS) uses 5VUSKTZCe5 |
| c10 | INFO | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:75-77,97-99 | og-worker writes a non-opt-in Analytics Engine datapoint per crawler hit (event, tool, crawler category); not mentioned (no personal data) |
| c11 | INFO | LOCAL | apps/*/wrangler.toml (no [observability]); PRIVACY.md:147-152 | "Workers Logs off on every worker" rests on dashboard state; no config or CI invariant pins it |

Evidence (<= 8 lines each):

c1: apps/web-app/src/services/preset-submission-service.ts:230-251
```
export async function uploadPreviewImage(presetId: string, file: File): Promise<void> {
  ...
  const response = await fetch(`${PRESETS_API_URL}/api/v1/presets/${encodeURIComponent(presetId)}/preview-image`, {
      method: 'POST', ... body: file,
```
apps/presets-api/src/services/preview-image-service.ts:140-158 (`IMAGE_WORKER.fetch('https://image-worker/thumbnail', body: bytes)`, then `THUMBNAILS.put(key, webp, ...)`; public cache header :40). Trigger: any signed-in user picks a file in the submit or edit form (preset-submission-form.ts:751, preset-edit-form.ts:841); a screenshot can show a character name plate. The in-product hint (en.json:1051-1052) discloses the upload; PRIVACY.md does not. Fix: policy CORRECT, reconcile_case 3: add a bullet under "Community presets" (optional upload, cropped and re-encoded to WebP, stored in R2, hidden until a moderator approves, deleted on reject, preset delete or replace) and qualify line 16 with "in the colour tools". Six-file edit.

c2: PRIVACY.md:72-73 "To have your account record and submissions removed, see the Questions? section below." PRIVACY.md:163-164 only says open a GitHub issue or ask on Discord. ToS:73-74 "To have your account record ... removed, see PRIVACY.md". ToS:67-71 steps cover content takedown only. The bot policy promises deletion handling (discord-worker/PRIVACY_POLICY.md:161). Fix: CORRECT with concrete steps and what is deleted (users row, presets, votes, R2 image).

c3: apps/presets-api/src/middleware/auth.ts:358 `const displayName = jwtPayload.global_name || jwtPayload.username;`; presets.ts:1029 `author_name: auth.userName?.trim() || 'Unknown User'`; en.json:1033 "Your display name appears on presets". ToS:29-30 "Your username is shown as the author". PRIVACY:67-69 is ambiguous. Fix: CORRECT ToS and PRIVACY to "display name (your Discord global name when set, otherwise username)" and say presets keep that name.

c4: advanced-options-panel.ts:237-243 `configController.resetAllConfigs()`; config-controller.ts:381-385 loops CONFIG_KEYS only; favourites/palettes have their own clear actions (advanced-options-panel.ts:249-270); collections, acquisition edits and token are untouched. PRIVACY:47-48. Fix: CORRECT wording (Reset Settings restores tool settings; Clear favorites / Clear palettes and site-data controls remove saved work).

c5: DEPRECATIONS.md:10-15 (remove by 2026-12-31), :44; moderation-service.ts:202-215; PRIVACY:69-73. When the PERSPECTIVE_API_KEY secret is deleted the sentence is false. Fix: add the six-file PRIVACY edit to the removal checklist; no change needed before.

c6: rate-limit-service.ts:146 `SUBMISSION_EVENT_RETENTION_DAYS = 30` (user_discord_id, kind, preset_id); migrations/0003_add_banned_users.sql (discord_id, username, moderator id, reason); presets.ts:1033-1050 `notifyDiscordBot(... author_name, author_discord_id ...)`; oauth handlers/token.ts:131 jti blacklist. Disclosed for the bot in discord-worker/PRIVACY_POLICY.md:104,176-177, and the same presets-api serves web users. Fix: CORRECT PRIVACY section 3 with those stores and retention numbers (30 d counters; dead-letter 30/90 d, notification-service.ts:108,115).

c7: preset-detail.ts:985-1000 `<a href=${exampleLink} target="_blank" rel="noopener noreferrer">`; allowlist example-link.ts:15-27 (reddit, x, twitter, instagram, pixiv, bsky, misskey...). PRIVACY:85-95 and ToS:91-101 list only glamour and dye links. Referrer is suppressed, so exposure is low.

c8: auth-service.ts:656-658 `sessionStorage.setItem(PKCE_VERIFIER_KEY ...)`, `OAUTH_STATE_KEY`, `OAUTH_RETURN_PATH_KEY`, removed on callback :371-378; preset-submission-form.ts:730. No personal data.

c9: packages/core/src/config/product-links.ts:35 `{ label: 'Discord', url: 'https://discord.gg/5VUSKTZCe5' }`; about-modal.ts social links derive from it; the policies use rzxDHNr6Wv in every language. Cannot tell which is live (no network). Fix: CORRECT once the maintainer names the canonical invite.

c10: apps/og-worker/src/index.ts:448-452 `writeDataPoint({ blobs: [event.event, event.tool, event.crawler], doubles: [event.timestamp], indexes: [event.tool] })`. Crawler requests only (review-og-worker.md:28). PRIVACY:97-99 says analytics run only while the switch is on. No personal data, so INFO.

c11: no apps/*/wrangler.toml has an [observability] block (image-worker index.ts:84-88 says so and cites the 2026-08-29 dashboard check); the CI wrangler-invariants step has no assertion. The PRIVACY:147-152 promise depends on a dashboard toggle that `wrangler deploy` does not pin. Hardening: add `[observability] enabled = false` to each wrangler.toml plus an invariant. Policy NONE, reconcile_case 0.

## 6. Handoffs (non-security)
- Documentation/i18n: tool names in PRIVACY:8-10 and ToS:15-17 ("Budget finder", "Comparison", "Gradient", "Mixer", "Accessibility checker") differ from en.json tools.* ("Budget Suggestions", "Dye Comparison", "Gradient Builder", "Dye Mixer", "Accessibility Checker").
- ToS:86 says report security problems "by email"; SECURITY.md:7-8 says GitHub private vulnerability reporting; ToS:168 email subject is "Terms".
- apps/web-app/README.md:110 and other READMEs use the 5VUSKTZCe5 invite; policies use rzxDHNr6Wv (c9).
- docs/superpowers/specs/2026-08-29-web-analytics-design.md:156 says `ver` matches /^\d+\.\d+\.\d+/; schema.ts:68 also allows a -prerelease tail (already noted in the api-worker review).
- ja/ko/zh PRIVACY siblings are 77 lines vs 164 (en) and 185 (de); line-level parity belongs to the locale reviewers (the numbers 60 / 120 / 2026-09-28 are present in all five).
