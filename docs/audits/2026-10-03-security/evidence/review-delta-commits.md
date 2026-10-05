# Review: delta-commits (378 commits, 0332fcc5..0ab33466)

Reviewer label: delta-commits. Read-only. Files written: this review and `scripts/delta-commits/gen_table.py` (regenerates the commit table in section 7 from `delta-commits.txt`). No network, no tests run.

Summary: all six 2026-09-15 findings (FINDING-001..006) are fixed at HEAD and no later commit regressed them. The delta's new surface (Glamour Reader: `/v1/chara/resolve` acquisition and rules, the `/glamour` bot command, `/glamour/*` OG routes, device-kept Acquisition edits, the extractor share link, `SERVICE_RATE_LIMITER`) opens no hole I could reach. Two LOW candidates.

## 1. Entry points touched by the delta, with authz matrix

| Entry | Who can call | Guards before the handler | Body / param caps |
|---|---|---|---|
| `POST data.xivdyetools.app/v1/chara/resolve` (api-worker) | anyone (CORS `*`, no credentials) | requestId, logger, security headers, CORS, `rateLimitMiddleware` (`apps/api-worker/src/index.ts:122`; public key = CF-Connecting-IP, 60/min; a request with no client IP uses the service bucket, 1300/min, `middleware/rate-limit.ts:61-75,137`), locale | 8 KiB streamed cap (`chara/router.ts:44,165`), max 12 gear, slot enum, uint16 lanes, duplicate slots refused |
| `GET /v1/chara/icon/:iconId` | anyone | same chain | canonical id regex (`router.ts:53`), 1 MiB streamed cap, PNG signature check, upstream Content-Type never reflected, `CSP: sandbox` |
| `POST /v1/telemetry` | anyone, opt-in client | own limiter bucket, Sec-GPC discard, enum allowlist; `glamour` added to `TOOL_IDS` (`telemetry/schema.ts:50`) | unchanged |
| service binding `UNIVERSALIS_PROXY` to `/v1/chara/resolve` | discord-worker only (no CF-Connecting-IP) | same chain, then the service bucket | same as public |
| `/glamour` slash command (discord-worker) | any Discord user (signed interaction) | Ed25519 + timestamp window + streamed body cap (`packages/auth/src/discord.ts:112-145`), per-user limiter (default tier 15/min, `worker-kit presets/configs.ts:100`), attachment guards (`utils/chara-attachment.ts:17-88`: https, `cdn.discordapp.com`/`media.discordapp.net` only, `redirect:'manual'`, 10 s timeout, 1 MiB streamed cap) | file <= 1 MiB; error text through `sanitizeEmbedText`; `allowed_mentions` none |
| `/swatch` (refactored onto the same guards) | any Discord user | same | same |
| `previewimg_approve_/reject_<key>` buttons (discord-worker) | moderators only | signature; key shape (`types/preset.ts:163-168`); moderator gate before any API call (`handlers/buttons/preview-image.ts:132-147`) | custom_id = prefix + 78-char key |
| `POST /webhooks/preset-submission`, `/webhooks/github` (discord-worker) | presets-api (shared secret), GitHub (HMAC) | secret / HMAC over raw bytes; streamed byte caps (10 KiB; `GITHUB_WEBHOOK_MAX_BYTES` 1 MiB, `index.ts:517,536,557`) | as stated |
| `PATCH /api/v1/moderation/:id/preview-image` (presets-api) | moderators | auth, `requireModerator`, body guards | needs `preview_image_key` equal to the pending key (`handlers/moderation.ts:282-324`) |
| `PATCH /api/v1/moderation/:id/status`, `/revert` | moderators | same | conditional on `content_revision` (+ `previous_values` for revert) (`services/preset-service.ts:461,483`) |
| `PATCH /api/v1/presets/:id` | owner | auth, ban check, caps via `reserveDailyEvent` | `WHERE author_discord_id=? AND content_revision=?` (`preset-service.ts:713`) |
| `POST /api/v1/presets/:id/preview-image` | owner | auth, ban, daily reservation | 5 MiB streamed (bodyGuards exemption), magic-byte sniff, decoder dimension gate |
| moderation-worker `ban_user`/`unban_user`, `ban_confirm_`, ban modal | moderators | signature, moderator gate, `isBanTargetId` (snowflake or lowercase UUID) before D1 or custom_id | custom_id <= 48 chars |
| og-worker `/glamour/*` (beta + production routes), `/og/glamour/default*` | anyone / crawlers | crawler detection; human pass-through only on the app host (`index.ts:573,1286`); parameter allowlist | default card only, no user input rendered |
| web-app Glamour Reader (browser) | any visitor | CSP self + `data.xivdyetools.app`; 1 MiB file cap before reading (`chara-file-loader.ts:50-51`) | `.chara` parse guarded against prototype keys (`core chara-parser.ts:296-320`) |

## 2. Positive controls

- FINDING-001 fix: `packages/auth/src/discord.ts:112-145` reads the body as a stream, cancels past the cap and verifies the exact bytes (`verifyKey(bytes, ...)`).
- FINDING-003 fix: `apps/discord-worker/src/index.ts:517-557` caps the GitHub webhook stream and runs the HMAC over the undecoded bytes before decoding; the Content-Length early reject is retained.
- FINDING-002 fix, three layers: webhook validates key shape and preset prefix (`index.ts:307`), button validates the key and refuses legacy ids (`preview-image.ts:104,132-147`), presets-api matches `preview_image_key = ? AND preview_image_status = 'pending'` (`moderation.ts:308,324`).
- FINDING-004/005 fix: migration `0014_add_content_revision.sql` trigger fires on content and moderation columns only (votes, timestamps, preview image excluded); owner and moderator writes are conditional on the revision. The trigger updates `content_revision`, which is outside its own `OF` list, so it cannot recurse.
- FINDING-006 fix: `og-worker/src/index.ts:597-601` logs tool, locale and crawler type only; `logUserAgent: false` at line 160; the shared request log carries the pathname only (`worker-kit middleware/logger.ts:83-89`).
- The `bodyGuards` extraction (REFACTOR-009) preserves behavior: `structure.ts:34-59` keeps depth 10 and the `__proto__/constructor/prototype` refusal; oauth and presets-api keep their caps and error envelopes; the presets preview-image exemption is intact.
- The shared image sniffer (REFACTOR-008) keeps the 12-byte precondition and the WEBP check at offset 8 (`worker-kit image-sniff/detect.ts:41-91`); presets-api re-narrows to png/jpeg/webp.
- api-worker service bucket: `isServiceBinding` keys on the absence of CF-Connecting-IP, which Cloudflare sets on every external request and a client cannot strip, so a public caller cannot reach the 20x bucket (`middleware/rate-limit.ts:75`); rate-limit namespace ids 1005/1006 are unique across all `wrangler.toml` files (checked).
- `/glamour` privacy: the nickname is stripped (`bot-logic swatch.ts:156-158`) and never used by glamour (`glamour.ts:355`); only model numbers and the facewear id leave the worker (`discord-worker handlers/commands/glamour.ts:56`); the log call carries the error class only (`glamour.ts:166`).
- Item names and acquisition lines are escaped at each sink: `plain()` for Discord (`bot-logic glamour.ts:313`), `escapeHtml` for the HTML clipboard flavor (`web-app shared/glamour-markdown.ts:110`), `textContent` elsewhere; "Open in..." links use `encodeURIComponent` on fixed hosts with `noopener,noreferrer` (`components/item-links-menu.ts:131`).
- Workflows: every `uses:` is 40-hex SHA pinned (grep over `.github`), all 14 workflows declare `permissions:`, no `pull_request_target`, no npm token (OIDC); the only `.github` change in the delta is the wrangler-action SHA bump.
- No new Analytics Engine fields, KV writes or D1 columns beyond `presets.content_revision`; the telemetry schema delta is one enum member.
- Removed security-looking tests were each traced: the FINDING-020 ban-target test was rewritten for the UUID shape (`moderation-worker handlers/commands/preset.test.ts:1886`); the WEB-13 file-size test moved next to the loader that still holds the guard (`chara-file-loader.ts:51`, tested in `services/__tests__/chara-file-loader.test.ts`); the url-sanitizer header tests left with their dead helpers; the KV fail-open test remains (`moderation-worker middleware/rate-limit.test.ts:139`).

## 3. Rejected items

- r1 Public caller reaching the service rate-limit bucket by omitting CF-Connecting-IP: Cloudflare injects it on every external request; only service bindings lack it.
- r2 SSRF in the `/glamour` attachment download: host allowlist, https only, `redirect:'manual'`, timeout, streamed cap (`utils/chara-attachment.ts:17-88`).
- r3 `/v1/chara/resolve` cache poisoning or amplification with random model keys: 60/min per IP, truncated pages are never stored (`router.ts:224,234`); pre-existing and not changed by the delta.
- r4 Trigger recursion in migration 0014: `content_revision` is outside the trigger's `UPDATE OF` list.
- r5 `reserveDailyEvent` failing open on a D1 error (`presets-api rate-limit-service.ts`, ruling in its docblock): a client cannot induce a D1 error; the same posture as the accepted fail-open limiter trade-off.
- r6 Character nickname or file name in browser `logger.info` lines (`glamour-block.ts:1747`, `chara-sheet.ts:174`, `chara-file-loader.ts:90`): console only; web-app configures no ErrorTracker (`packages/logger presets/browser.ts:102` is opt-in), so not a sink.
- r7 Nickname fallback saved as a local collection name (`chara-sheet.ts:163`, `glamour-block.ts:1719`): disclosed at `apps/web-app/PRIVACY.md:30-34`, never uploaded; the community path reads only the typed draft (`glamour-block.ts:1706`).
- r8 `/glamour` has no explicit rate-limit tier (default 15/min, `configs.ts:100`): equal to `/swatch`; 15/min per user against a shared 1300/min ceiling.
- r9 `wrangler-action` bump: pinned SHA; cannot be verified offline (handoff h1).
- r10 Teamcraft `staging` resolved at build time: the commit SHA is pinned and recorded in `acquisition.meta.json` (`teamcraftCommit`); the request path never fetches it.
- r11 OG pass-through `fetch(request)`: still behind the app-host check; the delta adds only a 5 s timeout.
- r13 Committed third-party acquisition text (`apps/api-worker/src/chara/data/acquisition.en.json`, `diff: unset`, Teamcraft commit pinned in `acquisition.meta.json`): every sink escapes it (Discord `plain()` at `bot-logic glamour.ts:313`, HTML clipboard `escapeHtml` at `glamour-markdown.ts:110`, `textContent` in the UI), so a poisoned string is cosmetic. Not filed.
- r12 XIVAPI amplification: at most one search per request, 12 s client timeout, 503 on upstream failure.

## 4. Files covered

Read at full-file or diff level (`git diff 0332fcc5..HEAD`):

- api-worker: `src/index.ts`, `src/chara/{router,resolver,xivapi,cache,acquisition}.ts`, `src/middleware/rate-limit.ts`, `src/telemetry/schema.ts`, `src/universalis/services/cache-service.ts`, `src/lib/{response,validation}.ts`, `src/routes/match.ts`, `src/types.ts`, `scripts/build-acquisition.ts` (fetch sites), `src/chara/data/acquisition.meta.json`, `wrangler.toml`.
- discord-worker: `src/index.ts`, `src/handlers/commands/{glamour,swatch}.ts`, `src/utils/{chara-attachment,read-text-capped,github-verify}.ts`, `src/handlers/buttons/preview-image.ts`, `src/services/{preset-api,preferences,rate-limiter}.ts`, `src/types/preset.ts`.
- presets-api: `src/handlers/{presets,moderation}.ts`, `src/services/{preset-service,rate-limit-service,preview-image-service,moderation-service}.ts`, `src/middleware/{body-validation,ban-check,auth}.ts`, `src/types.ts`, `migrations/0014_add_content_revision.sql`, `schema.sql`.
- moderation-worker: `src/index.ts`, `src/handlers/commands/preset.ts`, `src/handlers/buttons/ban-confirmation.ts`, `src/handlers/modals/ban-reason.ts`, `src/services/{ban-service,preset-api,bot-i18n}.ts`, `src/utils/{response,url-sanitizer}.ts`.
- oauth: `src/index.ts`, `src/middleware/body-validation.ts`, `src/services/user-service.ts`.
- og-worker: `src/index.ts`, `src/crawler-detector.ts`, `src/services/og-embed.ts`, `wrangler.toml`. image-worker: `src/validators.ts`, `src/types.ts`.
- packages: `auth/src/discord.ts`; `worker-kit/src/{body-guards/body-guards.ts,body-guards/structure.ts,image-sniff/detect.ts,rate-limiter/ip.ts,rate-limiter/presets/configs.ts,middleware/logger.ts}`; `bot-logic/src/commands/{glamour,swatch}.ts`; `core/src/services/chara/chara-parser.ts`; `logger/src/presets/browser.ts` (grep).
- web-app: `src/services/{chara-file-loader,chara-session-service,chara-resolve-service,share-service,router-service,auth-service,collection-service,indexeddb-service,config-controller,storage-service}.ts`, `src/shared/{acquisition-edits,clipboard,glamour-markdown,download-file,item-links}.ts`, `src/components/{glamour-block,chara-sheet,chara-file-card,item-links-menu,about-modal,changelog-modal,advanced-options-panel}.ts`, `PRIVACY.md`; `apps/discord-worker/PRIVACY_POLICY.md`.
- Repo: `.github/workflows/*` (grep and diff), all `package.json` (diff), `.gitignore` (diff), `docs/audits/2026-09-15-security/SECURITY_AUDIT_REPORT.md`, evidence `delta-commits.txt`, `pii-sinks.txt`, `html-sinks.txt`, `policy-claims.txt`.
- Not read: locale JSON bodies, the 1.3 MB `acquisition.en.json` (generated, `diff: unset`), policy translations beyond their presence, coverage output.

## 5. Candidate table

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:46-48 | Policy says "Reset settings" clears the stored items it just listed (saved collections, rewritten Acquisition lines, session token); the button resets only the 12 tool configs (`config-controller.ts:45-58,381-384`). Reconcile case 3, CORRECT, six files. |
| c2 | LOW | INTERNET-AUTH | apps/presets-api/src/middleware/ban-check.ts:58 | A banned XIVAuth-only user sheds the ban by linking Discord (`oauth user-service.ts:183-199` stamps `discord_id`; `resolveJWTUserId` (`presets-api middleware/auth.ts:71-77`) then returns the snowflake while `banned_users` is keyed on the UUID). Documented residual B1 (`ban-check.ts:36-52`), not closed. |

## 6. Handoffs (non-security)

- h1 Dependabot moved `cloudflare/wrangler-action` to `953926a2e2182532811c01a25e53647d93bf07c0` and the trailing comment still says `# v4`; confirm the SHA is the v4.1.3 tag commit when network is allowed, and write the full version in the comment.
- h2 presets-api migration 0014 must run before the revision-aware deploy: without the column `presetRow.content_revision` is undefined and `bind(undefined)` raises D1_TYPE_ERROR (every edit and moderation write returns 500). Deploy-order note only.
- h3 `apps/web-app/PRIVACY.md` still uses British spellings ("favourite", "colours") that the American-spelling pass covers elsewhere; documentation-audit skill.

## 7. Commit-by-commit table (all 378)

| sha | subject | security-relevant? | verdict |
|---|---|---|---|
| 2e4cb0cb | docs(policy): the Privacy and Terms documents catch up with the Glamour Reader, in six lan | YES | policy; Glamour Reader catch-up verified (nickname, model numbers only, Open-in links); c1 found in the same text |
| 5dd7916b | merge: feat/glamour-reader (with main) into feat/glamour-og | YES | merge with conflict-resolved docs/versions/changelog only |
| fc11c8b2 | merge: main into feat/glamour-reader; core is 5.8.0, bundle budgets follow the tenth tool | YES | merge; conflict-resolved src (api-worker chara resolver/types, web-app swatch-tool, config-controller) reviewed at HEAD through the full-range diff |
| 609330af | merge: feat/glamour-reader into feat/glamour-og (review fixes for #208) | YES | merge; docs/version files only |
| e15928b2 | docs(web-app): the living docs, README and terms say ten tools | YES | policy-adjacent docs: Terms/README say ten tools; wording only |
| ce296d09 | fix(bot-logic): only a refused body is the file's problem; a 404 is ours | YES | OK; a 404 is ours, not the file |
| f5e3aac2 | fix(discord-worker): /glamour relays api-worker's reason when it refuses a file | YES | OK; relayed reason is a validation message and passes sanitizeEmbedText |
| dfa45fd0 | fix(bot-logic): a file api-worker refuses is the file's problem, not an outage | YES | OK; a refused body is the file problem |
| 215cfa42 | chore(deps-dev): Bump the dev-deps group across 1 directory with 10 updates | YES | dev-deps bump (10); pnpm audit 0 advisories |
| f692799e | Merge pull request #213 from FlashGalatine/dependabot/npm_and_yarn/production-deps-ded142a | YES | merge; docs/version files only |
| 404105f7 | chore(deps): Bump the production-deps group with 3 updates | YES | dep bump |
| b00bd30e | chore(deps): Bump cloudflare/wrangler-action from 4.0.0 to 4.1.3 | YES | SHA-pinned (953926a2...); the SHA-to-v4.1.3 mapping could not be verified offline (handoff h1) |
| 73480209 | feat: resolve the bot's deferred minors (shared GPOSERS model, +N, escaping, busy, ko labe | YES | OK; plain() escapes formatting, allowed_mentions none |
| bfd393e7 | feat: /glamour — the Glamour Reader in the Discord bot (design 2a) | YES | reviewed; shared attachment guards, default 15/min per-user limit, service-binding resolve, sanitized embed text, nickname never leaves |
| 975175da | feat(og-worker): the Glamour Reader card, and a one-liner that wraps | YES | OK; new /glamour/* routes on og-worker, default card only, no user input rendered |
| 4df52961 | feat: resolve the reader's deferred minors (twin order, verdict, GPOSERS model, a11y, serv | YES | adds SERVICE_RATE_LIMITER (api-worker wrangler.toml x2 envs, middleware/rate-limit.ts); reviewed: unique namespace ids, separate bucket, fail-open per accepted trade-off |
| b29b9562 | chore(release): the Glamour Reader — web-app 5.13.0, core 5.6.0, svg 4.2.0, api-worker 0.1 | YES | release; Glamour Reader web-app 5.13.0, core 5.6.0, svg 4.2.0, api-worker 0.16.0 |
| 0e83fe74 | feat(web-app): the export sheet — the Acquisition line, editable and kept on device | YES | reviewed; localStorage holds user-typed free text keyed by an FNV hash of the gear; disclosed in PRIVACY; "Reset settings" does not clear it (c1) |
| 559a219c | feat(api-worker): acquisition follows the GPOSERS March 2026 reminders | YES | build-time data |
| 6e9159f2 | fix(api-worker): acquisition table — no sell-back shops, misread prices, token exchanges o | YES | build-time data |
| 1877c975 | feat(api-worker): resolve rules carry Grand Company, not jobs | YES | OK; XIVAPI rule fields parsed defensively, rulesOf returns null on a partial answer |
| 9f4b26ae | feat(core): the in-game check drops jobs and flags Grand Company gear | YES | OK; in-game check |
| b36fd5a5 | feat(api-worker): acquisition line on /v1/chara/resolve items and their twins | YES | reviewed; response-only field from a build-time table, no new input |
| cda81279 | feat(api-worker): build the GPOSERS acquisition table | YES | LOCAL build script; fetches XIVAPI and Teamcraft (commit-pinned) and commits the output (INFO c2) |
| 8ebb30bc | feat(api-worker): acquisition inputs — zones, outposts, relic sagas, tables | YES | LOCAL build-time acquisition inputs |
| 6c2821a0 | feat(api-worker): acquisition rules — only-source, Savage, vendor choice | YES | LOCAL build-time acquisition rules |
| 78678c78 | feat(api-worker): GPOSERS acquisition formatter | YES | LOCAL build-time GPOSERS formatter |
| 6628080e | fix(web-app): only the newest .chara drop may load | YES | OK; size guard retained in chara-file-loader |
| 6481d1c8 | fix(web-app): keep a loaded .chara across tools and unlock tribe/gender with it | YES | OK; session is memory-only; tribe/gender persisted in tool config |
| d25f37e4 | chore(deps-dev): Bump the dev-deps group across 1 directory with 16 updates | YES | dev-deps bump (16) |
| 48c7dc8b | fix(worker-kit): keep the optional hono peer at ^4.13.7 in 1.4.1 | YES | peer range only |
| c50ea318 | chore(worker-kit): release 1.4.1 -- optional workers-types peer accepts 5.x | YES | peer range only |
| 6064ba94 | Merge pull request #197 from FlashGalatine/dependabot/npm_and_yarn/production-deps-1e3c372 | YES | merge; conflict-resolved pnpm-lock.yaml only (0 advisories at HEAD) |
| afce044d | chore(deps-dev): Bump dotenv from 17.4.2 to 18.0.0 | YES | dev-deps bump (dotenv 18, dev only) |
| 43ee47e7 | chore(deps): Bump the production-deps group with 2 updates | YES | dep bump |
| c92126df | fix(i18n): review corrections for #192 - Korean legal wording, clan-name tooltips, doc acc | YES | policy; Korean legal wording and doc accuracy for the six-language policies |
| b0e963a2 | docs(policy): Terms of Service - two sentences that admitted two readings, in six language | YES | policy; Terms wording |
| 29b94984 | fix(web-app): official tool names, "glamour" from the terminology dictionary, the Privacy  | YES | policy-adjacent; Privacy Policy names the Advanced Settings panel (the sentence behind c1) |
| 0008820a | feat(discord-worker): the bot's Privacy Policy and Terms of Service in six languages | YES | policy; bot Privacy and Terms in six languages, claims checked against code |
| 863cd0e7 | feat(web-app): Privacy Policy and Terms of Service in six languages, linked by app locale  | YES | policy; web Privacy and Terms in six languages; see c1 |
| ba38251e | refactor(presets-api): route sniffImageType through worker-kit's shared image sniffer (REF | YES | OK; presets-api accept list png/jpeg/webp preserved |
| 3fcb5dd4 | refactor(oauth): adopt worker-kit's bodyGuards factory (REFACTOR-009) | YES | OK; oauth keeps 10 KB cap and depth 10 |
| 1237d7d5 | refactor(image-worker): adopt worker-kit's shared image sniffer (REFACTOR-008) | YES | OK; image-worker re-exports the shared detector |
| e75328c5 | refactor(presets-api): replace body-validation middleware with worker-kit bodyGuards (REFA | YES | OK; presets-api keeps the 5 MB preview-image exemption |
| 36a60081 | fix(oauth): carry security headers on the misconfiguration 500 (BUG-017) | YES | control added; oauth security headers also on the misconfiguration 500 (BUG-017) |
| b639e9d2 | chore(worker-kit): release 1.4.0 -- ./body-guards and ./image-sniff subpaths | YES | OK; worker-kit 1.4.0 subpath exports |
| 7d3f137f | feat(worker-kit): add the bodyGuards middleware factory (REFACTOR-009) | YES | OK; worker-kit bodyGuards lift is behavior-preserving (dangerous-key list retained) |
| 951e7177 | feat(worker-kit): add the shared magic-byte image sniffer (REFACTOR-008) | YES | OK; shared sniffer, 12-byte precondition, same table as image-worker |
| f39cf88b | test(api-worker): replace toBeDefined() boolean/enum checks with literal snapshots (BUG-03 | YES | guard test TIGHTENED: toBeDefined replaced by strict equality |
| 55f212a3 | test(api-worker): add an HTTP-level test for the legacy-Facewear 404 (BUG-037) | YES | guard test ADDED: legacy-Facewear 404 over HTTP |
| 914c401f | fix(og-worker): bound the SPA pass-through fetch() calls to a 5s timeout | YES | OK; 5 s timeout on SPA pass-through, isAppHost gate unchanged |
| 9963891f | fix(og-worker): stop keying wheel into the cache for the harmony default card | YES | OK; wheel keyed only on the parameterised harmony card (shrinks the key space) |
| 3e6d9a46 | fix(api-worker): catch the SWR-expiry cache.delete rejection (BUG-019) | YES | OK; SWR cache.delete rejection caught |
| 3eaca5a7 | feat(web-app): restore the Palette Extractor's share link (BUG-002) | YES | OK; share URL carries at most 5 bare RRGGBB values, strictly validated |
| 161d0326 | feat(web-app): give ShareService an extractor arm (BUG-002) | YES | OK; ShareService extractor arm |
| 231fc05d | fix(presets-api): release the daily preview-upload reservation on a body-read failure (B2) | YES | OK; reservation released on body-read failure |
| 511261b2 | docs(presets-api): document the account-linking ban residual (B1) | YES | doc only; ban-shed-by-linking residual documented (rejected r6) |
| 64391c47 | fix(moderation-worker): use fetch(url, init) for the PRESETS_API service binding (A2) | YES | OK; fetch(url, init) shape for the service binding |
| 17c6516f | fix(moderation-worker): reject uppercase XIVAuth UUIDs as ban targets (A1) | YES | OK; uppercase UUID refused |
| 6d89f89e | test(moderation-worker): make the rate-limit KV-error test falsifiable (BUG-035) | YES | guard test TIGHTENED: KV-error test asserts fail-open + backendError + warning |
| 596a3e4b | fix(presets-api): review fixes round 1 for BUG-015/BUG-043 (fail-open, coverage, test prec | YES | OK; id<=rowId tie-break |
| c6c8c5f7 | fix(moderation-worker): add a 10 s AbortSignal to presets-api requests (BUG-016) | YES | OK; moderation-worker 10 s timeout to presets-api |
| 3c5e5648 | fix(moderation-worker): accept a Discord snowflake OR an XIVAuth UUID as a ban target (BUG | YES | OK; ban target = snowflake or lowercase UUID, gated by isBanTargetId before D1 and custom_id |
| e5ad1fe1 | fix(presets-api): close the text_edit/flagged_edit/preview_upload daily-cap race with rese | YES | OK; reserve-then-act daily caps. INFO: fails open on a D1 error (rejected r5) |
| cfec7428 | fix(presets-api): reject refresh-author with 400 instead of binding an unset display name  | YES | OK; refresh-author rejects an empty name instead of binding undefined |
| 7d922b89 | test(presets-api): make ban-check "banned" cases identity-aware (BUG-043) | YES | guard test TIGHTENED: ban-check cases now identity-aware (UUID sub banned vs different id) |
| a6311d71 | docs(presets-api): document what banned_users.discord_id actually holds (BUG-001 path (a)) | YES | doc only; discord_id column may hold an XIVAuth UUID |
| 551c2e33 | fix(discord-worker): check res.ok in notifySubmissionChannel (B6) | YES | OK; res.ok checked in notifySubmissionChannel |
| fd5689a7 | test(discord-worker): fix vacuous defer assertions + comment the two byte readers (B4+B5) | YES | guard test TIGHTENED: vacuous defer assertions made real |
| 9d3d6774 | refactor(discord-worker): enforce /preset length bounds in schema, cap autocomplete choice | YES | OK; /preset bounds in schema, choice names capped at 100 |
| 3f72fc9e | fix(discord-worker): bound the actual /webhooks/preset-submission body, not a client-decla | YES | OK; preset-submission webhook bounded by streamed bytes (readTextCapped) |
| 7b2eaa66 | fix(discord-worker): report the actual worker environment in /stats health (BUG-012) | YES | OK; /stats reports the real environment, no new field |
| 21ae7d5b | fix(discord-worker): defer /manual spectrum_prices to stay inside the 3s ack (BUG-008) | YES | OK; /manual spectrum_prices deferred inside the 3 s ack |
| a86e9dc0 | fix(web-app): stop importData aborting mid-loop on a bad record (BUG-024) | YES | OK; non-string collection name guarded |
| 17eeecb4 | fix(web-app): memoise in-flight logout to fix revoke/notify storm (BUG-025) | YES | OK; one revoke request for concurrent logouts |
| 05f15f6c | feat(web-app): rich-text copy, worn slots only, dyed channels only | YES | OK; every value passes escapeHtml in the HTML flavor |
| d71d4512 | docs: correct five inaccuracies in the privacy policies | YES | policy; five corrections |
| 926d8f03 | feat(web-app): Copy list / Export .md for the glamour equipment list (5.10.0) | YES | OK; static filename, no character name |
| acdcbaaf | docs(web-app): add a Terms of Service, and make both policies reachable | YES | policy; web-app Terms; policy links open with noopener,noreferrer |
| 863decb3 | fix(discord-worker): verify original webhook bytes | YES | OK; signature over undecoded bytes |
| 3095b8ce | fix(og-worker): minimize crawler metadata logs | YES | OK; OG log carries tool/locale/crawler type only (FINDING-006 fix holds) |
| 6b7d1b3c | fix(presets-api): reject stale moderation writes | YES | OK; status/revert conditional on revision and previous_values (FINDING-005 fix holds) |
| 0b5d814c | fix(discord-worker): refresh legacy image reviews | YES | OK; a legacy button only refreshes the review, cannot approve |
| 74114ebf | fix(presets-api): guard owner edit revisions | YES | OK; owner edit WHERE author+content_revision; migration 0014 trigger (FINDING-004 fix holds) |
| 247d368d | fix(discord-worker): bind preview reviews | YES | OK; isValidPreviewImageKey (78 chars, uuid/uuid.webp) gates the button |
| 3c07b6b9 | fix(presets-api): bind preview approvals | YES | OK; UPDATE ... AND preview_image_key=? AND status=pending (FINDING-002 fix holds) |
| 205f0be6 | fix(discord-worker): cap webhook streams | YES | control added; GitHub webhook HMAC runs over raw bytes (FINDING-003 fix holds) |
| 0a357852 | fix(moderation-worker): bundle bounded auth | YES | control added; moderation-worker adopts the bounded verifier |
| ef555e57 | fix(auth): bound Discord request streams | YES | control added; auth/discord.ts reads bytes, caps, verifies the bytes (FINDING-001 fix holds) |
| 47d606aa | chore(deps-dev): bump the dev-deps group across 1 directory with 7 updates | YES | dev-deps bump (7) |
| 5faf2164 | chore(deps): bump the production-deps group with 2 updates | YES | dep bump |
| 61015eb0 | chore(deps-dev): migrate the workspace to vitest 5 | YES | dev-only vitest 5 migration; removed tests spot-checked, none weakened a guard |
| 3f20ce12 | chore(deps-dev): bump @types/culori from 2.1.1 to 4.0.1 | YES | dev-deps bump (@types/culori) |
| acd64eec | chore(deps-dev): bump the dev-deps group across 1 directory with 8 updates | YES | dev-deps bump (8) |
| 21793551 | chore(deps): bump the production-deps group with 2 updates | YES | dep bump; pnpm audit shows 0 advisories |

Non-relevant commits, bulk-listed. Cross-check done mechanically: every commit that touches a wrangler.toml, .github, a migration, a PRIVACY/TERMS file, pnpm-lock.yaml, an app middleware directory, packages/auth/src or the worker-kit rate-limiter has an explicit row above. Verdict for the remainder: no new route, outbound fetch, storage write, auth or limiter path, wrangler or workflow change or policy text; no guard test weakened.

- **merge commits with no conflict-resolved content (the rest of their content is reviewed through the non-merge commits)** (40): 0ab33466 d85d9686 ca817648 914138a3 a8698179 6982e0d5 e24741c6 8725f97b 548a0666 cfc82df3 a7b7a992 763320af 388f270c e622a8f8 28371957 70e95a9c f2ca8754 a7a6f13a 96de2d84 63f035ff 365ca529 59572c05 92c6fda3 407369ed 5c80fcba e86c7404 c948f77a 53090f68 0fec18f4 79a69d1f 699906a4 20d63756 68c6ee75 c40e7e63 71fc2233 1f682474 fb8c10ea 49e6a89b e04fa06a becf5446
- **feature / bug-fix / refactor commits with no new route, storage write, outbound call or auth path (diffs scanned)** (85): 7b919266 d9f043d5 0c74244e 2122a20b 100facc4 69eecceb cfdf96d3 ca673469 cf1696fc 1ce8c2b5 4ef83e41 b65ac15d 601dc4c0 8b3f8c6f f23ac4b0 defbd3cf 150d3cd6 d524f23b fbdc8c60 8b2eaeeb 088f4d38 063e88b6 78ba2cda 71f88d7f e6aba41d adc815a4 375a68d0 7560d52e 5caddf70 6d34233f a365aefe 7ce6830c 8c057c34 39672238 7a47b52b 3b6fd288 7e79b0a6 10817e0d 354fe746 29e055e9 738cbb03 8395eb59 ed885447 77520aac 41be98f1 a50ba98d 19e36205 0d3d90b1 6b9c4ec0 5e88e2f8 3c1b22bc f0cadee2 469a2578 ae7e15f8 048081cc 085e498b 0e706f0f 98a62c5d d45280ee 74f19f75 1ad6d3dd 12d442b3 b6801990 c3cccbd1 4ff63654 ae399bbc 8050c90f 554fd745 dcadae88 78caa32e a087e276 500cbb9e 98637eff 638caf2d f9455216 d1e8e1d9 516c6944 a4c057da 2d1695af 225df738 f9b469af 6fce09cf 8f7b292b c6aa8c73 4f4e5c13
- **other (skills / tooling / chore; no runtime effect)** (29): 1c114da7 99c856f0 47190a5f e7d8daa5 202e1699 2e0392be cde1beb7 6bfdae81 cd4e7099 f93f4ce2 614bc3df bc45d025 1fb3341f b6c96766 a26fb857 5aba87c8 f3805db0 61dbb512 9b95d257 64fb4939 390ff09e 030d6fd6 6523f62c a17ecffe c3bd53be aad319e3 cee186b5 e7d47c23 258cfe4c
- **docs / changelog / audit records (no executable change)** (83): ad0e816f fb436fa6 918dd529 c3f926af 8195daaa 018eb27a f364bcf6 a9e6b37a bf5c3769 12af7a49 4d727522 4798cc66 611e3183 f7b24d2d 714de886 1d9b4465 32e6ed37 d615680b 5dba4c5b d83023db cebbd53f a53ad793 f3f7951a d970cb25 2fce8fb6 862a6e27 131679b4 8081bab3 7d15c8e3 bb7d2f3b 500ed8ec b14b1cda ce455850 c568104f 9e73429f ffb41949 c6de8507 8dbf57f2 c87e492a 2a87d3e0 ba97c9d4 da661eb0 b9428956 4b912720 589846b0 146cee72 b7754ee9 cae679c5 c6b66400 573ef385 caa7acc7 4b4879d8 40d5fb54 caa071af 62efb704 e8920849 d6662950 686f3c2a bcbc20cc cb3f44f0 63eb1262 008b706f c67e7dfd 5f71f50e d018e704 3140db24 1182d088 ba3c8f77 13b66d8f 33671cad eef347fc d6693ebb 7116f1cf 156134a5 a353f619 58d17f4b b3c751b6 c9317154 5675870c c63c685e 506e453c b7794253 fa3517d2
- **tests / style / release and dependency bumps** (27): 7d6a4ccc cf7bb2c5 8ee1b689 5568fdf0 8b6b0532 6969c861 70e2482b 31c72cce d4214f3b 91d8cee1 8a164a9a 4b564e75 1d03a1bb 622a1191 4c232c36 4f8a281b 197226e3 24ba3888 feae1b39 18e86d3c 3180cba4 4af11218 68297fe5 e76ccc71 250acb73 156f25f6 8869484c
- **i18n / locale strings / spelling** (19): c4e128bb 5f0763ec 9de47a48 8d5dc9e9 fdd8d55f 38bb94d2 4b69240e d2673969 81bf7980 b8b5c71f 661d0d7e b76623dd 329fcc58 7ae472e7 f7c6e1fc e94f8fd4 45051233 1cf37231 86d9e0db

Total commits accounted for: 378
