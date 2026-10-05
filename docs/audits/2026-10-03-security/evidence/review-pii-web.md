# Review: pii-web (personal-data reconciliation, web side) - 2026-10-03

Scope: apps/web-app, apps/api-worker, apps/og-worker, apps/oauth, packages/worker-kit, packages/logger.
Governing documents: apps/web-app/PRIVACY.md (all six languages checked for structural parity), the web
telemetry spec, policy-claims-i18n.txt. Commit 0ab33466. Read-only; no probe scripts were needed.

Headline: no CRITICAL or HIGH. The telemetry path is clean (allowlist, GPC, opt-in, no id, origin gate).
The defects are policy-accuracy ones plus one in-product-copy contradiction for XIVAuth users.

## (1) Entry points and authz matrix

| Unit | Entry | Caller | Guards before handler | Body / param caps |
|---|---|---|---|---|
| api-worker | POST /v1/telemetry (telemetry/router.ts:53) | anyone on the internet, only xivdyetools.app / beta origins are written | requestId, logger, security headers, CORS, per-IP TELEMETRY_RATE_LIMITER (fail-closed, 240/60s), then Sec-GPC:1 -> 204, Origin allowlist -> 204 | 16 KiB bounded stream (schema.ts:27), <=25 events, enum/DB allowlist |
| api-worker | POST /v1/chara/resolve (chara/router.ts:195) | anyone | API_RATE_LIMITER 65/60s per IP, locale mw | 8 KiB (router.ts:44), integers only |
| api-worker | GET /v1/chara/icon/:iconId (:271) | anyone | same | id 1..999999, PNG-only response |
| api-worker | /v1/dyes, /match, /wheels, /harmony | anyone | same | param validators |
| api-worker | GET /universalis/*, /api/v2/* (index.ts:185-186) | anyone | NOT the API bucket; per-isolate MemoryRateLimiter keyed by IP (universalis/services/rate-limiter.ts:46) | datacenter whitelist |
| api-worker | /health, /, developers.* assets | anyone | host check | none |
| og-worker | GET /og/*.png (index.ts:803-1230) | anyone | request guards (segment length), requestId, logger (logUserAgent false) | 64-char segments |
| og-worker | GET /<tool>/* and /presets/:id (createToolHandler) | crawler (rendered) or human (passThroughToOrigin, :534) | same | none |
| oauth | GET /auth/discord, /auth/xivauth, GET callbacks | anyone | per-IP+path native ratelimit bindings (oauth/src/index.ts:183) | query |
| oauth | POST /auth/callback, POST /auth/xivauth/callback | anyone holding a code + PKCE verifier | state signature, bodyLimit 10 KiB (body-validation.ts:19) | 10 KiB |
| oauth | GET /auth/me, POST /auth/revoke | bearer JWT | JWT verify + revocation KV | 10 KiB |
| worker-kit / logger | libraries, no entry points | - | - | - |

## (2) Positive controls

- Telemetry allowlist: unknown event names dropped via a Map (apps/api-worker/src/telemetry/schema.ts:96-123), enums for tool / entry / via / producer / theme, stainID checked against the dye DB (:85-88), dwell is an integer capped at 1800 (:81-83).
- Envelope fields degrade to 'invalid' rather than reject (schema.ts:125-133); locale is checked against SUPPORTED_LOCALES, version against a strict regex capped at 16 chars (:62), viewport is a 3-value bucket (:59).
- GPC is honoured server-side before any body read (telemetry/router.ts:57-59) and client-side (web-app/src/services/telemetry-service.ts:117-119). Origin gate also derives the env dimension (telemetry/origin.ts:53-69). Datapoints carry no IP, UA or request id (router.ts:23-25; writeDataPoint receives only the validated point, :45).
- Client side: opt-in default false (web-app/src/shared/tool-config-types.ts:417), queue is memory only, no id, flush re-checks isEnabled (telemetry-service.ts:189), toggle-off drops the queue (:107). All call sites go through track() (v4-layout.ts:518, dye-selector.ts:280, v4-layout.ts:223, chara-file-loader.ts:73/83, theme-switch.ts:23); random-dye and unaccepted picks are excluded as the policy says. `.chara` producer is bucketed (telemetry-service.ts:177-184).
- Rate-limit key redaction: worker-kit scopeRateLimitKey logs the bucket class never the IP (packages/worker-kit/src/rate-limiter/key-scope.ts:1-30; used at middleware/rate-limit.ts:151,185 and the three backends). KV fallback TTL = window 60 + buffer 60 = 120 s (kv.ts:64,211), matching PRIVACY.md:143.
- Request logger logs method + pathname only, no query, no UA by default (worker-kit/src/middleware/logger.ts:79-90,150-153); oauth and og-worker do not opt in to UA (oauth/src/index.ts:43, og-worker/src/index.ts:157-161). og-worker "Serving OG metadata" log now carries tool/locale/crawler type only (og-worker/src/index.ts:597-601) - 2026-09-15 FINDING-006 fix holds.
- OAuth D1 schema is minimal after 2026-08-29 FINDING-001/002: users(id, discord_id, xivauth_id, auth_provider, username, timestamps) (apps/oauth/schema/users.sql, user-service.ts:110-111); roster table and avatar_url dropped (migrations/0001). Revocation KV stores only `revoked:<jti>` = '1' with a TTL (packages/auth/src/revocation.ts:91-92).
- oauth handlers log no identifiers (xivauth.ts:72-76 and its logger calls log counts and booleans only; callback.ts:208-211 logs booleans).
- IndexedDB holds only the price cache (indexeddb-service.ts; PALETTES/SETTINGS stores are created but never written - grep of STORES.PALETTES/SETTINGS shows no writers), matching PRIVACY.md:51.
- `.chara` handling matches PRIVACY.md:25-34: the community name field is never pre-filled from nickname/file name (glamour-block.ts:1561,1700-1712); the resolve request carries only slot/set/base/variant integers (chara-resolve-service.ts:116-117; core chara-models.ts:24-32); the Universalis upstream fetch carries no client header (cached-fetch.ts:134-141).
- Browser logger: info/debug lines (including the ones that print a saved character name, chara-sheet.ts:174, and file.name, chara-file-loader.ts:90) are dev-gated (shared/logger.ts:55-95 comment + active()); nothing leaves the browser.
- CSP connect-src 'self' https://*.xivdyetools.app, img-src limited to cdn.discordapp.com / shots / data (public/_headers:31); no cookies set anywhere in these units (grep for Set-Cookie / document.cookie empty); no third-party analytics script.
- All six PRIVACY languages carry the same 8 sections, the 120 / 60 / GPC / doNotStore / three-month numbers and Last updated 2026-09-28 (counts checked per file); policy-locale-parity.txt PASS.

## (3) Rejected items

- Workers Logs persistent retention of IP/UA/URLs: no wrangler.toml in the repo declares [observability] or logpush or tail_consumers (grep over tracked files), so the platform default (off) applies; the app logs carry no IP/UA. Not a finding by itself - see c5 for the unenforced-claim angle.
- Intra-batch linkage of dye picks (AE gives every point of one beacon the same timestamp and envelope): inherent to a 15 s batch, no cross-visit linkage, policy only promises "your palette as a whole is never sent" and no linking of two visits. Rejected.
- Exact dwell seconds (double1) and full app-version string as fingerprint widening: both are disclosed (PRIVACY.md:109-110,118), low entropy, and no id exists to join them. Rejected.
- Rate-limiter backend `error.message` in log context (rate-limit.ts:154, kv.ts:179): Cloudflare KV/binding errors do not echo keys; speculative. Rejected.
- oauth console.* lines (callback.ts:128,156,175,208; oauth-flow.ts:283; state-signing.ts:102): redirect_uri is attacker-chosen, other fields are booleans/provider/iat; live-stream only. Rejected.
- KV revocation entries (jti) and the D1 users row are not in the "stored on your device" list: server-side, non-personal jti, row is disclosed as "account record". Rejected apart from c8.
- Discord avatar loads from cdn.discordapp.com reveal the viewer IP to Discord: disclosed at PRIVACY.md:74. Rejected.
- `connect-src https://*.xivdyetools.app` wildcard: first-party zone, previous audits accepted; "talks only to these first-party hosts" holds (proxy.xivdyetools.projectgalatine.com is an alias custom domain, not contacted by the web app).
- IndexedDB empty PALETTES/SETTINGS stores: empty, no data. Handoff only.
- Cloudflare Pages auto-injected Web Analytics beacon: cannot be observed from the repo; CSP script-src 'self' would block it. Not a finding.

## (4) Files covered

apps/web-app/PRIVACY.md (full); PRIVACY.{ja,ko,zh,de,fr}.md (structure and number checks by grep, not read in full); TERMS_OF_SERVICE.md (grep); public/_headers; src/services/telemetry-service.ts (full); src/services/auth-service.ts (270-345, 440-545); src/services/chara-resolve-service.ts (90-175); src/services/chara-file-loader.ts (60-95); src/services/chara-session-service.ts (1-60); src/services/preset-submission-service.ts (215-345); src/services/indexeddb-service.ts (grep); src/shared/logger.ts (1-140); src/components/chara-sheet.ts (140-180); dye-selector.ts (265-285); v4-layout.ts (210-226); locales en.json (lines 237-238, 307, 997, 1033, 1049, 1411) and de/fr/ja/ko/zh equivalents via policy-claims-i18n.txt.
apps/api-worker: src/telemetry/{schema,router,origin}.ts (full); src/chara/router.ts (195-360); src/chara/xivapi.ts (215-262); src/index.ts (55-135, 160-190); src/middleware/rate-limit.ts (30-75, 160-200); src/universalis/router.ts (100-175, 268-312); src/universalis/services/{rate-limiter,cached-fetch}.ts; wrangler.toml (grep).
apps/og-worker: src/index.ts (150-170, 425-470, 484-545, 565-612, 828-845, 1195-1310); src/types.ts (170-200); wrangler.toml (1-50, 80-92).
apps/oauth: schema/users.sql; migrations/0001; src/services/user-service.ts (55-200); src/handlers/xivauth.ts (28-80, 225-400); src/handlers/callback.ts (150-215); src/handlers/token.ts (120-150); src/index.ts (30-60, 178-215, 300-320); src/services/rate-limit.ts (85-140); state-signing.ts (96-110); wrangler.toml (grep).
packages/worker-kit: src/middleware/logger.ts (60-200); middleware/rate-limit.ts (135-200); rate-limiter/key-scope.ts; backends/{kv,cloudflare,upstash}.ts (log paths). packages/logger: grep inventory only (sink lines are JSDoc examples, no runtime sink). packages/auth/src/revocation.ts (grep).
Evidence: pii-sinks.txt (all lines for my paths), outbound-fetch.txt, policy-claims.txt, policy-claims-i18n.txt, policy-locale-parity.txt, delta-commits.txt; DEPRECATIONS.md; docs/superpowers/specs/2026-08-29-web-analytics-design.md (grep).

### pii-sinks reconciliation (non-test sinks)

| path:line | sink | fields | listed in PRIVACY.md? | verdict |
|---|---|---|---|---|
| api-worker telemetry/router.ts:45 | AE writeDataPoint | event, tool, entry/via/ok/to, stainID/producer, locale, theme, vp, ver, env, dwell s | yes, "Usage analytics" (:97-132) | OK |
| api-worker chara/router.ts:342, universalis cache-service.ts:186 | CF Cache API put | icon id; market response by item/world | n/a, no personal field | OK |
| api-worker index.ts:237 | logger.error | err, operation | operational logs section | OK |
| og-worker index.ts:448 | AE writeDataPoint | event, tool, crawler type, exact ms timestamp, no opt-in | NOT listed (see c3) | defect |
| og-worker index.ts:424 | CF Cache put (response) | rendered card by canonical URL | n/a | OK |
| og-worker index.ts:1302 | logger.error | err | ok | OK |
| oauth user-service.ts:75-291 | D1 users | uuid, discord_id, xivauth_id, provider, username, timestamps | "provider ID and username" (:66-68); XIVAuth username is a character name and a linked Discord id is also stored (see c1) | defect |
| oauth index.ts:164, 311 | logger | env note, err | ok | OK |
| worker-kit logger.ts:153,161 | request log | method, path, status, duration, request id | operational logs (:147-152) | OK, retention depends on dashboard (c5) |
| worker-kit rate-limit.ts:149,184; backends | logger.warn | keyScope class, path, method | ok | OK |
| worker-kit kv.ts:233 | KV put | key contains IP, 120 s | yes :139-144 | OK |
| universalis rate-limiter.ts:46 | isolate memory | IP counter, per isolate | NOT described (see c4) | defect |
| logger/* | doc examples only | - | - | no runtime sink |
| web-app localStorage / sessionStorage / IndexedDB (587 inventory lines, dominated by tool settings) | browser storage | prefs, dye ids, saved palettes, JWT, OAuth PKCE state in sessionStorage, price cache | yes :42-54 | OK |
| web-app preset-submission-service.ts:313-327 | POST presets-api | name, description, category, dyes, tags, example_link | partly :66-74 (name, description) - tags, example_link, preview image missing (c2) | defect |
| web-app preset-submission-service.ts:236-250 | POST preview-image | raw user image bytes, up to 5 MB | contradicted by :16-18 (c2) | defect |

## (5) Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | MEDIUM | INTERNET-AUTH | apps/oauth/src/handlers/xivauth.ts:333-359 | XIVAuth sign-in stores the verified FFXIV character name as users.username and public author name, plus the linked Discord id, while the sign-in copy says "No character data" |
| c2 | MEDIUM | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:16-18 (also :10-12, :66-74) | Preset submission uploads a user image, an example link and tags that no section lists; "images never leave your device" |
| c3 | LOW | INTERNET-UNAUTH | apps/og-worker/src/index.ts:448 | og-worker writes an always-on Analytics Engine counter (with exact ms timestamp) that PRIVACY.md never mentions; "sees only the URL" is imprecise |
| c4 | LOW | INTERNET-UNAUTH | apps/api-worker/src/universalis/services/rate-limiter.ts:46 | Market proxy keeps per-IP counters in isolate memory, a third mechanism PRIVACY.md :139-144 does not describe |
| c5 | LOW | LOCAL | apps/api-worker/wrangler.toml (no [observability]) | "Workers Logs is off on every worker" is a dashboard fact nothing in the repo pins or checks |
| c6 | LOW | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:69-73 | Perspective API is named as live; it shuts down 2026-12-31 and the removal checklist does not list the policy files |
| c7 | LOW | INTERNET-AUTH | apps/oauth/src/handlers/xivauth.ts:47 | XIVAuth `refresh` scope is requested although the refresh token is never stored or used |
| c8 | INFO | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:72-73, :161-164 | Deletion is delegated to the Questions section, which gives no removal procedure; no retention is stated for the account row, presets, votes |

### Candidate details

**c1** (regression_of 2026-08-29-security/FINDING-002, partly; reconcile_case 3; policy CORRECT; policy_doc apps/web-app/PRIVACY.md Network access item 3 + web locale `preset.privacyNote`; rotation NONE)
- trigger: user clicks "Sign in with XIVAuth" with a verified character -> POST /auth/xivauth/callback.
- evidence: `const verifiedCharacter = characters.find((ch) => ch.verified) ?? null; const displayName = verifiedCharacter?.name ?? null; const username = displayName ?? \`XIVAuth User ...\`` (xivauth.ts:339-341) then `findOrCreateUser(..., { xivauth_id, discord_id: linkedDiscordId, username, ...})` (:354-360); response `global_name: displayName, // verified character name only` (:377). In-product copy en.json:1033: "your Discord or XIVAuth ID and username ... No character data". PRIVACY.md:66-68 says "your provider ID and username" and PRIVACY.md:25-29 says players put their real name in character names.
- impact: the D1 row and public preset author name are a real-world-adjacent name, and the Discord id the user did not sign in with is also stored; both contradict the "no character data" promise. The 2026-08-29 fix trimmed claims but left this sentence.
- fix options: case 1 (use the opaque label for XIVAuth and drop the character fetch/scope) or case 3 (reword the copy in 6 locales and PRIVACY.md to say the verified character name and linked Discord id are stored). A policy edit is the six-file edit plus 6 locale JSON entries.

**c2** (reconcile_case 3; policy CORRECT; policy_doc apps/web-app/PRIVACY.md Images and camera captures + Network access item 3; rotation NONE)
- trigger: signed-in user submits a preset with a preview image: POST /api/v1/presets then POST /api/v1/presets/:id/preview-image with the file body (preset-submission-service.ts:236-250, form wiring preset-submission-form.ts:749-751); body also carries `tags` and `example_link` (:322-326).
- evidence: PRIVACY.md:10-12 "Nothing you upload, pick or type is sent anywhere unless a section below says so, and the sections below are the complete list"; :16 "Uploaded, pasted, dragged-in and camera-captured images never leave your device"; item 3 (:73-74) only says preview images "are served from shots.xivdyetools.app". en.json:997 "GLAMOUR SHOT - LINKED, NOT UPLOADED" and :1049 "never a copy of the image" sit next to a form field `preset.fieldPreviewImage` that does upload.
- impact: user-chosen images (possibly screenshots with names, or EXIF) are stored in R2 with a moderation hop; the headline promise reads as absolute. Handoff to the presets-api reviewer for EXIF/re-encode behaviour.
- fix: reword the Images bullet to scope it to the colour tools, and add the opt-in preview upload, tags and example link to item 3 in all six languages.

**c3** (reconcile_case 3; policy CORRECT; policy_doc apps/web-app/PRIVACY.md Network access item 4 + Usage analytics; rotation NONE)
- trigger: any crawler fetch of a tool URL (og_request, index.ts:583-588) or any fetch of an /og/*.png card (og_image_request, e.g. :833-838).
- evidence: `env.ANALYTICS.writeDataPoint({ blobs: [event.event, event.tool, event.crawler], doubles: [event.timestamp], indexes: [event.tool] })` (index.ts:448-452) with `timestamp: Date.now()`. PRIVACY.md:77 "og-worker, which sees only the URL"; :99 "Analytics are off by default. They run only while ... Enable Analytics is switched on". og-worker is also on-path for human page loads of tool routes (passThroughToOrigin, index.ts:534; routes wrangler.toml:23-35) and reads User-Agent to classify.
- impact: no personal field is written (crawler type is an enum), so this is an accuracy defect, not a leak; the exact-ms double is redundant with AE's own timestamp and could be dropped.
- fix: drop the timestamp double (code minimization), then say plainly that link-preview fetches bump an anonymous per-tool counter regardless of the switch.

**c4** (reconcile_case 3; policy CORRECT; policy_doc apps/web-app/PRIVACY.md Your IP address; rotation NONE)
- trigger: any GET to /api/v2/aggregated/... or /universalis/... (the app's "Show Prices" path).
- evidence: `const limiter = new MemoryRateLimiter();` (rate-limiter.ts:46); `return { key: clientIP, config }` (universalis/router.ts:131-135). PRIVACY.md:139-144 describes a Cloudflare binding plus a KV fallback and says "Neither path writes your address to a database".
- impact: the address is held only in isolate memory (never persisted), so the substance of the promise holds; the description is incomplete.
- fix: add one clause: the market-price proxy keeps a short per-IP counter in memory of the running worker instance.

**c5** (reconcile_case 0; policy NONE; rotation NONE)
- evidence: `git grep -i observability -- '*.toml'` returns nothing; apps/image-worker/src/index.ts:84-86 records the 2026-08-29 live check as the only basis. PRIVACY.md:147-152 makes "switched off on every one of our workers" a standing promise and also says that if turned on it will say so first.
- impact: if someone enables Workers Logs in the dashboard (or a future wrangler config does), request-id + path lines (and, for oauth, endpoint paths) start being retained with no code or CI signal, silently falsifying the policy.
- fix: pin `[observability] enabled = false` (and for env.production) in each wrangler.toml and assert it in the wrangler-invariants step. I could not verify the live dashboard state (no Cloudflare access permitted).

**c6** (reconcile_case 3; policy CORRECT; policy_doc apps/web-app/PRIVACY.md Network access item 3 (+ .ja/.ko/.zh/.de/.fr) and apps/discord-worker/PRIVACY_POLICY.md; rotation NONE)
- evidence: DEPRECATIONS.md:10-15 hard deadline 2026-12-31; removal checklist (:42-48) lists code, secret, CLAUDE.md and env docs but not the policy documents. PRIVACY.md:69-71 names Perspective.
- impact: after the shutdown the document describes a service nobody calls (and presets then fail closed per DEPRECATIONS.md:24-25 unless a replacement is chosen). A removed third party still listed is an accuracy defect.
- fix: add the six-file policy edit to the removal checklist, to be made in the same release that removes checkWithPerspective.

**c7** (reconcile_case 0; policy NONE; rotation NONE)
- evidence: `scopes: 'user user:social character refresh'` (xivauth.ts:47); the only use of the result is `hasRefreshToken: !!tokens.refresh_token` (:201); /auth/refresh was removed in oauth 3.0.0 (CHANGELOG.md:114).
- impact: a refresh grant is requested from the user and from XIVAuth's consent screen for nothing; the token is discarded, so no storage, but it widens what a compromised consent could do. Drop `refresh` from the scope string.

**c8** (reconcile_case 3; policy CORRECT; policy_doc PRIVACY.md Network access item 3 / Questions; rotation NONE)
- evidence: PRIVACY.md:72-73 "To have your account record and submissions removed, see the Questions? section below"; the Questions section (:161-164) is a generic contact line with no deletion procedure and no retention period. users rows (apps/oauth/schema/users.sql) have no purge.
- impact: INFO only; the path works by contact but the document does not say so or how long data is kept.

## (6) Handoffs (non-security)

- documentation: PRIVACY.md :72-73 points to "Questions?" for removal but that section does not describe it (c8); DEPRECATIONS.md Perspective checklist omits policy files (c6).
- documentation: PRIVACY.md :19-21 says the extractor notice is "plain text, not a link" - still true (en.json:307); fine, no action.
- i18n: web locale `analyticsDesc` (en.json:238, all six) omits time-on-tool and the theme-switch events that PRIVACY.md lists; consistent in spirit, tighten if the policy is edited.
- plain bug / cleanup: indexeddb-service.ts:95-108 still creates empty PALETTES and SETTINGS object stores that nothing writes.
- presets-api reviewer: confirm preview-image upload strips EXIF/re-encodes and what the image-worker /thumbnail path retains (c2).
- docs: apps/oauth/src/handlers/xivauth.ts:41-44 comment still says `character` scope gives "FFXIV character info" - it is used only to pick a verified name.
