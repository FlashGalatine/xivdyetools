export const meta = {
  name: 'security-audit-2026-10-03',
  description: 'Whole-monorepo security + privacy-policy audit: per-unit and cross-cutting finders, adversarial verification, completeness critic, calibration',
  phases: [
    { title: 'Review', detail: 'per-unit, cross-cutting and policy finders write evidence/review-*.md' },
    { title: 'Verify', detail: 'verifier confirms each candidate at file:line; a second verifier tries to refute; tie-break on disagreement' },
    { title: 'Gaps', detail: 'completeness critic + targeted second-round finders (loop until dry, max 2 rounds)' },
    { title: 'Calibrate', detail: 'dedup + consistent Severity x Exposure across every confirmed row' },
  ],
}

const ROOT = 'C:/dev/XIVProjects/xivdyetools/.claude/worktrees/security-audit-96f7ce'
const OUT = 'docs/audits/2026-10-03-security'
const SCRATCH = 'C:/Users/DrawF/AppData/Local/Temp/claude/C--dev-XIVProjects-xivdyetools--claude-worktrees-security-audit-96f7ce/ec1e1083-46fc-4fca-8a16-2decba2de235/scratchpad'
const SEV = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
const EXP = ['INTERNET-UNAUTH', 'INTERNET-AUTH', 'INTERNAL', 'LOCAL']

const GRADING = `Grading rules.
- Severity: CRITICAL | HIGH | MEDIUM | LOW | INFO = impact if exploited. Exposure = who can reach it: INTERNET-UNAUTH (anyone on the internet, no login) | INTERNET-AUTH (needs a signed-in web user, a Discord login, or is any Discord user sending an interaction) | INTERNAL (reachable ONLY through a Cloudflare service binding — valid only if no public route/custom domain/workers.dev URL reaches the same handler) | LOCAL (build, dev, CI, a maintainer's machine). Severity x Exposure orders the work: an INTERNET-UNAUTH MEDIUM outranks a LOCAL HIGH.
- Privacy stance: the project's promise is "collect nothing personal". The only personal field with a documented purpose is the pseudonymous Discord user id, and only where a policy lists it. IP, User-Agent, request ids tied to people, usernames, display names, avatars, emails, guild/channel ids, free text, file names, .chara TypeName/Nickname, option values reaching any analytics datapoint, log line, KV/D1/R2 write or third-party request body are findings. A field the governing policy does not list = MEDIUM (exposure of the unit); a field the policy explicitly promises not to store = HIGH. Governing documents: apps/web-app/PRIVACY.md (web + beta; also describes api-worker, og-worker, oauth, presets-api), apps/discord-worker/PRIVACY_POLICY.md (bot; also presets-api, Perspective), web telemetry spec docs/superpowers/specs/2026-08-29-web-analytics-design.md, bot analytics spec docs/superpowers/specs/2026-08-29-bot-analytics-tier-a-design.md.
- Policy fields: policy = NONE | CORRECT (align the document text to what the code already does — no new commitment) | AMEND (the document must newly disclose something; only ever after the code is minimized). reconcile_case: 1 = code collects something undisclosed with no documented purpose -> fix the CODE (policy usually NONE); 2 = undisclosed but genuinely necessary -> minimize, then AMEND; 3 = the document says something false / stale / silent about what the code does -> CORRECT the document (LOW-MEDIUM, INTERNET-UNAUTH since anyone can read it); 0 = not a policy matter. policy_doc = "<file> §<section>". A policy edit is a six-file edit: the English file plus its .ja/.ko/.zh/.de/.fr siblings.
- rotation: "NONE", or "ROTATE: <credential>" when a live credential is exposed.`

const COMMON = `You are one reviewer in the xivdyetools whole-monorepo security audit dated 2026-10-03.
Repo root (your working directory): ${ROOT} — a git worktree on branch claude/security-audit-96f7ce at commit 0ab33466 (identical to main). Audit folder: ${OUT}/. Automated evidence already in ${OUT}/evidence/: pii-sinks.txt and pii-sources.txt (grep inventories 'path:line:text' of storage/log/analytics sinks and personal-field sources), outbound-fetch.txt (every fetch( call), html-sinks.txt (innerHTML/unsafeHTML/etc.), wrangler-surface.txt, policy-claims.txt (line-numbered testable claims in the four English policy documents), policy-claims-i18n.txt, potential-secrets.txt, delta-commits.txt (378 commits since the previous audit at 0332fcc5), pnpm-audit (0 advisories), github-secret-scanning-alerts.json ([]), versions.txt. Filter the inventories to your paths (grep '^apps/<unit>/') rather than reading them whole.

Ground rules
- READ-ONLY for tracked files: never edit source, config, docs, policies or locale files. Write exactly one file: ${OUT}/evidence/review-<your label>.md. Throwaway probe scripts may go under ${OUT}/evidence/scripts/<your label>/ (keep them and mention them in the review file).
- Packages are already built. NEVER run turbo, any build, or a whole-package test run — several reviewers share this checkout concurrently. A local reproduction may run ONE test file: pnpm --filter <pkg-name> exec vitest run <file> --coverage.enabled=false
- No git writes (add/commit/stash/checkout/worktree/reset). No wrangler command that reaches Cloudflare. No network access except what your brief explicitly allows.
- Search tracked files only (git grep -n ..., or git ls-files <glob> | xargs grep -n ...). Never search coverage/, e2e-coverage/, dist/ or node_modules/ — they embed copies of sources and produce fake hits.
- Do not re-file accepted trade-offs (docs/architecture/security-trade-offs.md: KV rate-limit race, fail-open KV rate limiting, single JWT algorithm, timing-safe compare fallback, moderation fail-closed) or anything listed under Positive controls / Rejected suspicions in docs/audits/2026-09-15-security/SECURITY_AUDIT_REPORT.md and docs/audits/2026-08-29-security/SECURITY_AUDIT_REPORT.md — unless the code changed so the earlier verdict no longer holds; then say what changed and cite the earlier folder/ID. A regression of a fixed finding is a new candidate with regression_of = '<folder>/<ID>'.
- A candidate is a lead you have checked yourself: cite the exact path:line you opened, quote <= 8 lines in evidence, and state in trigger the concrete request / input / sequence that reaches it. Hunches without a file:line go in rejected with the reason you dropped them. Report real issues even if small (LOW/INFO) but do not pad.
${GRADING}

The review file must contain, in this order: (1) entry-point table (routes / slash commands / buttons / bindings / pages) with an authz matrix: who can call each entry, which middleware or guards run before the handler, and the body/param caps; (2) Positive controls (what is right, with path:line); (3) Rejected items, one line each with the reason; (4) Files covered — every file you actually read; (5) Candidate table | cid | sev | exposure | path:line | claim |; (6) Handoffs — non-security defects for other skills (documentation, i18n, plain bugs), one line each.
Then return the structured output. cids are short local ids (c1, c2, ...).`

const ROW_WORKER = `[Every Worker (Hono)] route-level auth/authz order (middleware before handlers); param/body validation + size caps (readBodyWithCap-style); D1 only via .prepare().bind() (no template SQL); KV/R2 key construction from user input; error handler leaks (stack/env/root echo); Cache-Control/Vary on user-specific responses; CORS allowlist exact-match (oauth, presets-api, api-worker); rate limiting present and fail-closed (native [[ratelimits]]; a KV limiter cannot throttle fast clients); secrets only as secrets (never [vars]), .dev.vars* gitignored; module-scope state shared across requests; waitUntil for side effects; logger redaction of tokens/IDs; outbound fetch targets allowlisted (SSRF), timeouts.`
const ROW_BOTS = `[Discord bots (discord-worker, moderation-worker)] Ed25519 signature verified before parsing; interaction freshness/timestamp; moderator/owner gates on every admin path incl. autocomplete + components (MODERATOR_IDS); custom_id parsing bounds; user text sanitized before cards/embeds (bot-logic sanitizer helpers); bot->presets-api signed with v2 (X-Request-Signature-V2 + nonce, 60 s) and v1 acceptance removed; webhook (INTERNAL_WEBHOOK_SECRET, GITHUB_WEBHOOK_SECRET) verification constant-time; allowed_mentions on every outgoing message that can carry user text.`
const ROW_OAUTH = `[oauth] state required + bound on every callback; redirect_uri allowlist; JWT alg pinned, exp, revocation list honored (blacklist must outlive exp); token TTLs; cookie flags; [env.production] absent -> a bare deploy is prod.`
const ROW_PRESETS = `[presets-api] ownership + state-machine checks on every mutation (TOCTOU on status writes); moderation endpoints authz; upload type/size/dimension gates before image-worker; R2 keys not user-controlled; tag charset; pagination bounds; author_discord_id exposure; Perspective API key never in query string, fail-closed.`
const ROW_IMAGE = `[image-worker] service-binding only (no routes); dimension gate from headers before decode (decompression bomb); body cap; photon panic paths; callers' contract.`
const ROW_OGAPI = `[og-worker / api-worker] unbounded URL params (length, count, O(n^3) wraps); ?lang= allowlist; XML/SVG escaping of user text (escapeXml); edge cache keys incl. all params; Universalis proxy allowlist + timeouts; KV cache poisoning.`
const ROW_WEB = `[web-app (Pages)] _headers CSP/HSTS/X-Frame-Options + pattern-merge trap; innerHTML sinks escaped (escapeHtml), postMessage origins; OAuth state forwarded; token storage + logout clears; third-party script/font origins; SW/cache rules; public/ leaks.`
const ROW_PACKAGES = `[Packages] auth: HMAC key length floor (createHmacKey >= 32 B), constant-time compare, canonical string unambiguous (length-prefixed); logger: redaction list covers Discord/JWT/HMAC shapes; worker-kit: limiter defaults fail-closed; core: JSON parsing of untrusted .chara/preset input bounded.`
const ROW_PII = `[Personal data — every unit] (CWE-359, CWE-532) Reconcile ${OUT}/evidence/pii-sinks.txt x pii-sources.txt for your paths: for each analytics datapoint (writeDataPoint blobs/doubles — web apps/api-worker/src/telemetry/schema.ts, bot apps/discord-worker/src/services/analytics.ts, og-worker), KV/D1/R2 write, structured log call and third-party request body, name every field and check it against the governing promise — PRIVACY_POLICY.md §2 (never option values, message content, guild/channel ids), the web telemetry spec (no ids, no storage, opt-in default off, GPC honored, allowlist-validated server-side), the locale strings promising images never leave the browser. Flag: IP / UA / request id / username / avatar / email / guild or channel id / free text / file names / .chara TypeName / option values reaching any datapoint or log; any client-generated persistent or per-session identifier; telemetry that can fire while the opt-in is off or GPC is set; a server telemetry route that writes a field it did not validate against an enum or the dye DB; logger calls interpolating user objects ({ user }, interaction.member) rather than ids; exact timestamps or coarse buckets widened into fingerprints (viewport in px, full version strings, full locale tags). A harmless-looking field not listed in the policy is still a finding (MEDIUM); a field the policy explicitly promises not to store is HIGH. Positive controls to record: allowlist schemas, 'invalid'-not-reject envelope handling, guild/dm context blob, redaction lists.`
const ROW_POLICY = `[Privacy policies — accuracy] (CWE-451) Every claim in the policy is checked against the code and is a finding if false, stale or silent. Work from ${OUT}/evidence/policy-claims.txt. (a) Closure claims — PRIVACY.md "the sections below are the complete list" and "talks only to these first-party hosts", PRIVACY_POLICY.md §3 Data We Do NOT Collect: these turn ANY undisclosed sink into a violation, so enumerate them against pii-sinks.txt rather than reading for plausibility. (b) Retention numbers vs real TTLs — every "30 days" / "180 days" / "120-second" / "3 months" against the expirationTtl, TTL constant or Cloudflare default that actually applies. (c) Named commands, toggles and UI paths the policy tells users to use for access or deletion — each must still exist. (d) Named hosts and third parties vs the CSP connect-src/img-src, wrangler routes and service bindings — a live third party missing and a removed one still listed are both findings, as is a dated claim about to expire (Perspective sunsets 2026-12-31 — DEPRECATIONS.md). (e) Storage inventory — what localStorage/IndexedDB/KV/D1/R2 actually holds vs what the policy says. (f) Silence — a real data flow no section addresses is an accuracy defect. (g) Contradiction across surfaces — the two policies, the ToS service descriptions, and the web app's in-product copy (policy-claims-i18n.txt) must agree. (h) Stale Last Updated relative to the last substantive change to what is described. (i) Every language makes the same promise.`
const ROW_CI = `[CI / supply chain] actions SHA-pinned, permissions: contents: read, OIDC publish (no npm token), pnpm audit --prod + gitleaks jobs present, pnpm overrides for known advisories, deploy workflows gated on main, secrets not echoed in logs, D1 migration steps.`

const UNITS = [
  { label: 'oauth', rows: [ROW_WORKER, ROW_OAUTH, ROW_PII], brief: `apps/oauth (CF Worker + D1 'xivdyetools-users'; Discord OAuth + XIVAuth login, JWT issuance; NOTE: no [env.production] — a bare wrangler deploy IS production). Read apps/oauth/wrangler.toml, apps/oauth/README.md, src/**, migrations/schema. Enumerate every route. Check: state + PKCE binding on every callback (Discord and XIVAuth), redirect_uri / return-URL allowlist exact match (no prefix/subdomain tricks), JWT alg pinned + exp + iss, revocation (TOKEN_BLACKLIST) honored on every token-accepting path and outliving exp, what identity data is written to D1 on sign-in and whether PRIVACY.md describes it, Cache-Control no-store on token responses, CORS allowlist, rate limiting on auth endpoints (native binding, fail mode), validateEnv requiring security bindings in production, error responses leaking internals. Regression: 2026-08-29 FINDING-001/002/003/013/022.` },
  { label: 'presets-api', rows: [ROW_WORKER, ROW_PRESETS, ROW_PII], brief: `apps/presets-api (CF Worker + D1 'xivdyetools-presets' + R2 previews; public REST API used by web-app, plus service-binding calls from discord-worker and moderation-worker; calls image-worker /thumbnail and Google Perspective). Read wrangler.toml, src/**, the SQL schema/migrations. Enumerate every route and state for each whether it is internet-reachable, needs a user JWT, needs a bot signature (X-Request-Signature-V2 + nonce), or is moderator-only. Check ownership + state machine on every mutation, TOCTOU on status writes, moderation endpoint authz, upload type/size/dimension gates before image-worker, R2 key construction, tag charset, pagination bounds, author_discord_id exposure, Perspective key never in query string + fail-closed + doNotStore, notification fan-out caps, dead-letter / submission_events retention. Regression — each control must still hold AND be guarded by a test (a missing guard test is itself a candidate): 2026-09-15 FINDING-002 (approval bound to the exact pending image key; stale -> 409), FINDING-004 (owner edit compares owner + content revision; DB trigger), FINDING-005 (status/revert compares revision + raw snapshot; atomic audit insert); 2026-08-29 FINDING-004/005/006/016/017/018.` },
  { label: 'moderation-worker', rows: [ROW_WORKER, ROW_BOTS, ROW_PII], brief: `apps/moderation-worker (Discord HTTP-interactions bot for preset moderation; D1 binding to xivdyetools-presets read/write; service binding to presets-api). Check Ed25519 verify on the bounded body before parse (uses @xivdyetools/auth bounded reader — 2026-09-15 FINDING-001), timestamp freshness, MODERATOR_IDS gate on every command, autocomplete, button and modal path, custom_id parsing bounds, direct D1 SQL (bound params; does any direct write bypass presets-api's revision/state-machine guards from 2026-09-15 FINDING-004/005, and is the DB trigger enough?), v2 request signing to presets-api, ban/unban/hide/restore audit rows (2026-08-29 FINDING-018), logs of display names / free-text ban reasons (2026-08-29 FINDING-011), allowed_mentions on any message echoing user text, rate limiting.` },
  { label: 'discord-worker-core', rows: [ROW_WORKER, ROW_BOTS, ROW_PII], brief: `apps/discord-worker — interaction entry + infrastructure half (the slash-command half is reviewed by another reviewer). Files: src/index.ts, src/utils/** (discord-api, env-validation, github-verify, read-text-capped, response, sanitize, brand, text), src/handlers/buttons/**, src/services/{preset-api,image-client,rate-limiter,announcements,analytics,command-trace,preferences,preset-favorites,changelog-parser,emoji,bot-i18n,i18n}.ts, src/commands/{registry,schemas,localize}.ts, src/types/**, wrangler.toml (top-level block = the BETA bot; [env.production] = production). Check: Ed25519 signature verified on the bounded body before any parse (2026-09-15 FINDING-001 consumer side), timestamp freshness, GitHub webhook HMAC constant-time with an independent 1 MiB stream cap before verify (2026-09-15 FINDING-003) plus event allowlist / delivery de-dup (2026-08-29 FINDING-021), INTERNAL_WEBHOOK_SECRET verification for presets-api -> bot notifications, owner/moderator gates on every admin path incl. autocomplete + components, custom_id parsing bounds (preview-image buttons carry the exact image key), v2 signed calls to presets-api, Upstash/KV rate limiter (identifier, fail mode), analytics datapoint fields vs bot policy §2 'Usage Analytics' and the tier-A spec, KV keys built from user ids (firstrun flag, preferences, favorites) vs policy §2/§8 retention, allowed_mentions on every message/embed/webhook post that can include user text.` },
  { label: 'discord-worker-commands', rows: [ROW_WORKER, ROW_BOTS, ROW_PII], brief: `apps/discord-worker — slash-command half. Files: src/handlers/commands/** (about, accessibility, budget, changelog, comparison, contrast, dye, extractor, glamour, gradient, harmony, manual, mixer-v4, preferences, preset-notifications, preset, stats, swatch), src/utils/chara-attachment.ts, src/services/budget/**, src/services/svg/renderer.ts, src/services/fonts.ts, src/services/font-coverage.ts, src/services/image-input-errors.ts, src/services/image-client.ts (caller side). The newest surface is the Glamour Reader: /glamour takes a .chara attachment -> parse (packages/core services/chara/chara-parser via packages/bot-logic glamour + chara-identity) -> item resolution through the UNIVERSALIS_PROXY service binding to api-worker. Check: attachment fetch — host allowlist (Discord CDN only?), redirect handling, byte cap enforced while streaming, timeout; parse bounds on untrusted JSON (size, depth, array lengths) before any work; whether TypeName / Nickname / file name / option values reach any log line, analytics datapoint, KV key or outbound body; whether that matches PRIVACY_POLICY.md §3 'Character Files' word for word; /extractor image URL / attachment fetch (SSRF, size, decompression bombs via image-worker); /budget and /preferences world: validation (2026-08-29 FINDING-019) and proxy cache keys; user text rendered into SVG cards (escaping) or echoed in messages (allowed_mentions, mention/markdown injection); /preset submit/edit validation before forwarding; /stats authz.` },
  { label: 'image-worker', rows: [ROW_WORKER, ROW_IMAGE, ROW_PII], brief: `apps/image-worker (service-binding only: POST /extract for discord-worker, POST /thumbnail for presets-api; Photon WASM). Check wrangler.toml has no routes, workers_dev = false and preview_urls = false in EVERY env; dimension gate from image headers before decode (decompression bombs) on both paths; body cap; any URL-fetch path (host / redirect / byte / time limits); photon panic paths; whether worker-kit image-sniff is used before decode; caller contract (does it trust a caller-supplied size/type?); logging of URLs / file names.` },
  { label: 'api-worker-public', rows: [ROW_WORKER, ROW_OGAPI, ROW_PII], brief: `apps/api-worker — public REST half at data.xivdyetools.app: src/index.ts, src/routes/** (dyes, harmony, match, wheels), src/lib/** (bounded-body, validation, response, api-error, harmony, services, dye-serializer), src/middleware/** (locale, rate-limit), src/types.ts, wrangler.toml, and the VitePress docs served as Workers Static Assets on developers.xivdyetools.app (apps/api-worker/docs + the assets config: anything internal shipped publicly? headers on the docs host?). Check the route table, param bounds (lengths, counts, O(n^2)/O(n^3) loops on user input), ?lang/locale allowlist, CORS, cache keys include every param, error handler leaks, rate limiting (native binding, fail mode, key = IP? is the IP logged?), negative facewear itemIDs -> 404 with slug. Network allowed: read-only curl -sI https://data.xivdyetools.app/v1/dyes and curl -sI https://developers.xivdyetools.app/ to compare live headers with the source.` },
  { label: 'api-worker-chara-universalis-telemetry', rows: [ROW_WORKER, ROW_OGAPI, ROW_PII], brief: `apps/api-worker — the three non-catalog surfaces: src/chara/** (Glamour Reader resolve endpoint used by web-app and by discord-worker through the UNIVERSALIS_PROXY binding; xivapi.ts outbound calls; KV cache), src/universalis/** (absorbed Universalis CORS proxy: upstream path/host allowlist, world/datacenter validation, cache keys, request coalescer, timeouts, KV poisoning, response byte caps), src/telemetry/** (POST /v1/telemetry: Origin allowlist, Sec-GPC honored, enum / dye-DB allowlist validation of every field, 'invalid'-not-reject envelope, batch caps, limiter fail mode — spec docs/superpowers/specs/2026-08-29-web-analytics-design.md; regression 2026-08-29 FINDING-014). For /chara: what the request body carries (item ids only, or names / TypeName?), body cap, array caps, fan-out to xivapi bounded, cache keys from user input, whether anything about the character reaches logs / Analytics Engine. Which of these routes are reachable from the internet vs only via the binding?` },
  { label: 'og-worker', rows: [ROW_WORKER, ROW_OGAPI, ROW_PII], brief: `apps/og-worker (dynamic OpenGraph images + crawler HTML; the top-level wrangler block is the ROUTED beta on beta.xivdyetools.app — live; production via --env production). Check unbounded URL params (length, count, O(n^3)), ?lang allowlist, escapeXml / HTML escaping of every user-controlled string in SVG and crawler HTML (incl. src/services/character-cells.ts — new glamour/character share cards: what share-URL data is rendered?), cache keys include all params (2026-08-29 FINDING-024), resvg render cost per request, logging of UA / full URLs (regression 2026-09-15 FINDING-006: the crawler metadata event must contain only tool, normalized locale and crawler category — confirm, and confirm a test guards it), Analytics Engine fields vs PRIVACY.md.` },
  { label: 'web-app-shell', rows: [ROW_WEB, ROW_PII], brief: `apps/web-app (Cloudflare Pages; Vite + Lit) — shell / auth / network half: public/_headers, public/_redirects, functions/_middleware.ts, src/index.html, vite.config.*, src/main.ts, src/services/{auth-service,api-worker-origin,api-service-wrapper,community-preset-service,hybrid-preset-service,preset-submission-service,share-service,router-service,market-board-service,world-service}.ts, src/components/{signin-modal,my-submissions-modal,preset-submission-form,preset-edit-form,about-modal}.ts, src/components/v4/share-button.ts. Check CSP (script-src self, connect-src list, img-src, frame-ancestors), HSTS, X-Frame-Options, the _headers pattern-merge trap (immutable inherited by HTML), the SPA catch-all serving HTML under .js/asset URLs (2026-08-29 FINDING-027), OAuth state forwarding + validation on return, where the JWT is stored, logout clears all auth state, postMessage origin checks, open redirects via return URLs / router, share links, third-party origins (fonts, preconnect — 2026-08-29 FINDING-026), what functions/_middleware.ts does (headers, bot detection, OG rewrite, logging?), service worker / cache rules, public/ leaks, beta vs production differences. Network allowed: read-only curl -sI https://xivdyetools.app/ and https://beta.xivdyetools.app/ plus one hashed asset URL found in the live HTML, to compare live headers with public/_headers.` },
  { label: 'web-app-content', rows: [ROW_WEB, ROW_PII], brief: `apps/web-app (Lit SPA) — content / storage half. Start from ${OUT}/evidence/html-sinks.txt (grep '^apps/web-app/') and check every innerHTML / unsafeHTML / unsafeSVG / insertAdjacentHTML sink escapes user-controlled values (escapeHtml): preset names/descriptions/tags from the presets API, dye names from locale files, .chara-derived strings (Nickname / TypeName must never render unescaped), glamour-markdown export. Then the Glamour Reader client: src/services/{chara-file-loader,chara-resolve-service,chara-session-service}.ts, src/components/{chara-file-card,chara-sheet,chara-ui,glamour-block,glamour-list-actions,glamour-sheet,glamour-tool,glamour-twin-picker}.ts, src/shared/glamour-markdown.ts — what is read from the file, what is persisted (localStorage / IndexedDB / sessionStorage), what is sent to api-worker /chara (item ids only? any name?), and whether that matches PRIVACY.md 'Character files' word for word. Storage: src/services/{indexeddb-service,storage-service,collection-service,saved-presets-service,config-controller,language-service,theme-service}.ts — inventory every key written vs PRIVACY.md 'What is stored on your device' (2026-08-29 FINDING-009: image cache). Telemetry client src/services/telemetry-service.ts: default off, GPC honored, cross-tab opt-out, no persistent or per-session identifier, coarse buckets only. Also extractor-tool / image-zoom-controller (images must never leave the browser except the explicit preset preview upload), src/shared/{download-file,clipboard,palette-export,logger,error-handler}.ts (CSV/formula injection? what reaches console or any remote?).` },
  { label: 'packages-security', rows: [ROW_WORKER, ROW_PACKAGES, ROW_PII], brief: `packages/auth (JWT verify, HMAC signing, Discord Ed25519, /encoding), packages/logger (redaction), packages/worker-kit (Hono middleware: request id, logger, rate limit; /rate-limiter backends Memory/KV/Upstash/Cloudflare native; NEW src/image-sniff/). Check: createHmacKey >= 32-byte floor, constant-time compares, canonical signing string unambiguous (length-prefixed), the v2 bot signature binds method + path + query + body + timestamp + nonce, a nonce replay check exists at the verifiers, JWT alg pinned / exp / nbf / iss, the Discord verifier enforces the body cap WHILE reading (2026-09-15 FINDING-001 — confirm the control and that a stream-consumption test guards it), logger redaction covers Discord bot tokens, JWTs, HMAC hex, Bearer headers, Upstash tokens, array items, error.message (2026-08-29 FINDING-025), limiter defaults and fail modes, request-id middleware trusting client-supplied ids (log injection?), UA logging off by default. image-sniff: what it detects, whether it is called before any decode at every consumer (git grep its exports across apps/ and packages/), whether a polyglot or truncated header passes.` },
  { label: 'packages-domain', rows: [ROW_PACKAGES, ROW_PII], brief: `packages/core (color algorithms, dye DB, k-d tree, i18n, Universalis client, NEW chara parser src/services/chara/** incl. chara-parser.ts, chara-resolver.ts, chara-gposers.ts, chara-twins.ts), packages/svg (card generators — escapeXml of every string that can come from users or .chara files; glamour-card.ts is new), packages/bot-logic (command business logic, sanitizers, chara-identity.ts, glamour.ts, /i18n engine), packages/types, packages/test-utils. Check: untrusted .chara / preset JSON parsing bounded (input size, depth, array sizes, numeric ranges, __proto__/constructor keys, recursion), ReDoS in regexes applied to user input, SVG/XML injection in every card generator (text, attributes, hrefs, font-family, color values landing in attributes), i18n interpolation of user text, Universalis client URL construction from user input, what chara-identity extracts and whether bot-logic ever passes TypeName / Nickname to a log or analytics callback, published-package hygiene (each package.json 'files' field; you may run 'npm pack --dry-run --json --ignore-scripts' inside a package directory — read-only — to list what ships; no fixtures/secrets/test data in tarballs).` },
  { label: 'stoat-worker', rows: [ROW_BOTS, ROW_PII], brief: `apps/stoat-worker (Node.js + revolt.js Revolt bot; parked — non-security findings are P3). Check token handling (env only, never logged), command parsing bounds, user text echo (mentions / markdown), logging of user ULIDs / channel ids / raw command text (2026-08-29 FINDING-031 — fixed or still open?), outbound calls, use of bot-logic, and whether it is deployed anywhere and silent in the policies (the bot policy covers Discord only).` },
  { label: 'ci-supply-chain', rows: [ROW_CI, ROW_WORKER], brief: `Repo-level CI / supply chain / deployment configuration. Files: .github/workflows/* (14), .github/dependabot.yml and any other .github config, pnpm-workspace.yaml (overrides, allowBuilds, minimumReleaseAge), .npmrc, root package.json, turbo.json, .gitleaks.toml, every apps/*/wrangler.toml and the packages' publish config, scripts/** that CI runs. Check: every action SHA-pinned; top-level permissions contents: read with per-job escalations justified; OIDC publish with no npm token; id-token: write only on the publish job; environment: production on production deploy jobs; beta workflows use CLOUDFLARE_API_TOKEN_BETA and their branch triggers (2026-08-29 FINDING-028); pull_request_target / workflow_run usage (untrusted code with secrets); script injection via \${{ github.event.* }} interpolated into run: steps (PR titles, branch names, commit messages, issue bodies); secrets echoed; cache poisoning; D1 migration steps; pnpm audit + gitleaks jobs present and actually gating; wrangler [vars] holding anything secret; workers_dev / preview_urls exposure per env; routes; .dev.vars* ignored (see ${OUT}/evidence/wrangler-surface.txt); .gitleaks.toml allowlist breadth (2026-08-29 FINDING-029). Network allowed: read-only 'gh api' GETs only — repos/FlashGalatine/xivdyetools/environments, .../environments/production/deployment-branch-policies, .../actions/permissions, .../actions/permissions/workflow, .../branches/main/protection, .../dependabot/alerts?state=open, .../code-scanning/alerts?state=open (a 403/404 is a result to record, not an error). Record each command and its result in the review file.` },
  { label: 'secret-hits', rows: [ROW_CI], brief: `Classify every line of ${OUT}/evidence/potential-secrets.txt (66 tracked-file hits from a credential-shaped grep) and record the table in your review file: test fixture / obviously fake / public client id / docs example / config name only / REAL. Record that ${OUT}/evidence/github-secret-scanning-alerts.json is [] and that the gitleaks binary was unavailable locally (CI's gitleaks-action scans each push's commits only, not full history). Then sweep for credential shapes the grep misses with git grep -n -E over tracked files: Discord bot tokens ([MN][A-Za-z0-9_-]{23,25}\\.[A-Za-z0-9_-]{6}\\.[A-Za-z0-9_-]{27,}), JWTs (eyJ[A-Za-z0-9_-]{10,}\\.eyJ), Upstash / Cloudflare / AWS / Google API key shapes (AIza[0-9A-Za-z_-]{35}), 'BEGIN .*PRIVATE KEY', Discord webhook URLs (discord(app)?\\.com/api/webhooks/[0-9]+/), and secret-looking files tracked by mistake (git ls-files | grep -i -E '\\.env|\\.dev\\.vars|secret|credential|\\.pem|\\.key$'). Also git log --all --diff-filter=D --name-only --format= | grep -i -E 'env|secret|key|vars|pem' | sort -u for deleted secret-looking files in local history, and git log --all -p -S'BEGIN' --format=%h -- . | head for private-key material. Only a REAL live credential is a candidate (rotation: 'ROTATE: <what>'); never write a full secret value — first 4 characters + length.` },
  { label: 'delta-commits', rows: [ROW_WORKER, ROW_PII, ROW_CI], brief: `Commit-by-commit sweep of the 378 commits since the previous audit (git log --oneline 0332fcc5..HEAD; list in ${OUT}/evidence/delta-commits.txt; diffstat in delta-since-last-audit.txt). This is a different search modality from the per-unit reviewers: walk the commit list and pick every commit that adds or changes a route, an outbound fetch, a storage write (KV / D1 / R2 / localStorage / IndexedDB / Analytics Engine / log), an auth / signature / limiter path, a wrangler.toml, a workflow, a dependency or override, a test that guarded a security control, or a policy document; read its diff (git show <sha> -- <paths>). For each ask: did it open a hole, weaken a control, delete or weaken a guard test, or add data collection the policies do not describe? Record a table | sha | subject | security-relevant? | verdict | covering all 378 commits (non-relevant ones may be bulk-listed by sha). Candidates must cite current-HEAD path:line, not just the historical diff.` },
  { label: 'pii-bot', rows: [ROW_PII, ROW_POLICY], brief: `Personal-data reconciliation, bot side: apps/discord-worker, apps/moderation-worker, apps/presets-api, apps/image-worker, packages/bot-logic, apps/stoat-worker. Take every line of ${OUT}/evidence/pii-sinks.txt for those paths (writeDataPoint, .put(, .prepare( / INSERT INTO, logger.*) and name every field each sink writes, following variables back to their source; cross with pii-sources.txt for the same paths. Check each field against apps/discord-worker/PRIVACY_POLICY.md §2 (collected), §3 (NOT collected — never option values, message content, guild/channel ids...), §5 Operational Logs, §8 retention, and the tier-A analytics spec. Produce in the review file a sink table | path:line | sink kind | fields | listed in policy? (§) | verdict |. Every unlisted field is a candidate (MEDIUM; HIGH if §3 promises it is not collected). Also: KV TTLs vs §8 retention numbers; D1 retention of user-linked rows (submission_events, dead letters, bans, votes) vs §8; logger calls interpolating whole objects (interaction, member, user, body); Workers observability / logpush config in each wrangler.toml (head_sampling_rate, invocation logs) as a data flow §5 must describe.` },
  { label: 'pii-web', rows: [ROW_PII, ROW_POLICY], brief: `Personal-data reconciliation, web side: apps/web-app, apps/api-worker, apps/og-worker, apps/oauth, packages/worker-kit, packages/logger. Same method: every pii-sinks.txt line for those paths -> fields -> source; table | path:line | sink | fields | listed in PRIVACY.md? (section) | verdict |. Governing promises: apps/web-app/PRIVACY.md (its sections are 'the complete list'; the IP address and server-log section; the analytics section), the telemetry spec docs/superpowers/specs/2026-08-29-web-analytics-design.md (no ids, no storage, opt-in default off, GPC honored, allowlist-validated server-side), and the web locale strings promising images never leave the browser (${OUT}/evidence/policy-claims-i18n.txt). Flag client-generated persistent / per-session identifiers, telemetry that can fire while the opt-in is off or GPC is set, server telemetry writing an unvalidated field, exact timestamps / viewport px / full version strings / full locale tags widened into fingerprints, oauth D1 identity rows, worker request logs with IP / UA / full URLs (Workers observability / logs enabled in each wrangler.toml? head_sampling_rate? — operational logs are a data flow PRIVACY.md must address).` },
  { label: 'regression', rows: [ROW_WORKER, ROW_PACKAGES], brief: `Regression sweep of every earlier security finding and positive control. Sources: docs/audits/2026-09-15-security (6 findings, all fixed by commits ef555e57 0a357852 205f0be6 3c07b6b9 247d368d 0b5d814c 74114ebf 6b7d1b3c 3095b8ce, all ancestors of HEAD; see its IMPLEMENTATION_REPORT.md), docs/audits/2026-08-29-security (31 findings; see its Remediation status table), and both reports' Positive controls. For each finding: locate the control at current HEAD (path:line) and the test that guards it (test path:line), and run that single test file to show it passes (pnpm --filter <pkg> exec vitest run <file> --coverage.enabled=false). Table in the review file | folder/ID | control at HEAD | guard test | status (HOLDS / REGRESSED / UNGUARDED / ACCEPTED) |. A reverted or weakened control, or a control with no guarding test, is a candidate with regression_of set. Also re-check that each Positive-control bullet of the 2026-09-15 report still holds at HEAD.` },
  { label: 'trust-boundaries', rows: [ROW_WORKER], brief: `Cross-cutting by vulnerability class (a different modality from the per-unit reviewers). (a) Service-binding trust boundaries — for every [[services]] binding in apps/*/wrangler.toml (every env), find the callee's handler for the called path and decide whether the same handler is also reachable from the internet (a public route, custom domain, workers.dev or preview URL) and, if so, what authenticates the binding caller (bot signature, internal secret, nothing?). INTERNAL is a valid exposure only if the route is unreachable from the internet. (b) SSRF / outbound — every line of ${OUT}/evidence/outbound-fetch.txt: is the host fixed or allowlisted, are redirects followed, is there a timeout, is the response byte-capped before .json()/.text()/.arrayBuffer(), is user input in path/query encoded? (c) Cache / CDN — caches.default and KV caches keyed by user input, Vary on user-specific responses, Cache-Control on authenticated responses across all workers. (d) Error handling — onError / notFound handlers in every Hono app: stack traces, env values, internal URLs leaked? (e) scheduled() / queue / cron handlers and Durable Objects, if any: what they touch and whether they can be triggered externally.` },
  { label: 'injection-classes', rows: [ROW_WORKER, ROW_WEB, ROW_OGAPI], brief: `Cross-cutting by vulnerability class: (a) markup injection — every place user-controlled text (preset names/descriptions/tags, Discord display names, .chara strings, URL params, locale strings) becomes HTML (web-app, og-worker crawler HTML, Pages functions), SVG/XML (packages/svg, og-worker), Discord message content / embeds (mention injection @everyone / @here / <@&role>: is allowed_mentions set to { parse: [] } or equivalent on every outgoing message, followup, edit and webhook post in discord-worker and moderation-worker?), Markdown exports (glamour-markdown), CSV exports (formula injection), HTTP headers (Content-Disposition filename). (b) ReDoS — every RegExp applied to user input across apps/ and packages/ (nested quantifiers, alternation inside repetition). (c) Prototype pollution — JSON.parse of user input followed by object spread / Object.assign / recursive merge / bracket assignment with user keys. (d) Resource exhaustion — loops, recursion or allocations sized by user input without a cap (O(n^2+) over user arrays, new Array(n) with user n, String.repeat).` },
  { label: 'policy-web-en', rows: [ROW_POLICY, ROW_PII], brief: `Privacy-policy accuracy — web: apps/web-app/PRIVACY.md and apps/web-app/TERMS_OF_SERVICE.md (English, governing), against the code. Work from ${OUT}/evidence/policy-claims.txt and the full documents. Run checks (a)-(h) claim by claim and record a table | doc:line | claim | code evidence (path:line) | TRUE / FALSE / STALE / UNVERIFIABLE |. Cross-checks that must appear: the 'complete list' / first-party-hosts closure claims vs the CSP connect-src and img-src in apps/web-app/public/_headers and every fetch target in the web-app source; every storage item the guide lists vs what the code writes (localStorage / IndexedDB / sessionStorage / Cache Storage); every retention number vs the real TTL / expirationTtl / Cloudflare default; every UI label or path the guide tells users to follow (toggles, panels, buttons) vs apps/web-app/src/locales/en.json — the label must exist and be reachable in the UI; the 'Character files' section vs what chara-file-loader / chara-resolve-service actually read, persist and send (word for word); the analytics section vs telemetry-service.ts + the api-worker telemetry schema; the IP / server-logs section vs every web-side worker's logging and observability config; third parties named vs contacted (Perspective, XIVAPI, Universalis, Discord, XIVAuth, fonts); the ToS service description vs what the app offers; Last updated (2026-09-28) vs the last substantive change to anything described (git log --since=2026-09-28 on the described code). Also compare with the in-product privacy copy in ${OUT}/evidence/policy-claims-i18n.txt (en). Policy findings: policy CORRECT, reconcile_case 3, policy_doc the English file + section (the fix edits all six variants).` },
  { label: 'policy-bot-en', rows: [ROW_POLICY, ROW_PII], brief: `Privacy-policy accuracy — bot: apps/discord-worker/PRIVACY_POLICY.md and apps/discord-worker/TERMS_OF_SERVICE.md (English, governing), against the code (discord-worker, presets-api, moderation-worker, bot-logic, image-worker). Work from ${OUT}/evidence/policy-claims.txt and the full documents. Table | doc:line | claim | code evidence | TRUE / FALSE / STALE / UNVERIFIABLE |. Must include: every slash command named anywhere in either document vs apps/discord-worker/src/commands/registry.ts (exists? same name? same options?); §2 collected fields vs every KV key / analytics datapoint / log field the bot writes; §3 'Data We Do NOT Collect' as a closure claim, incl. 'Image Processing' and 'Character Files' (verify against handlers/commands/extractor.ts, glamour.ts, utils/chara-attachment.ts, services/image-client.ts, image-worker); §5 storage locations (KV vs Upstash Redis vs D1 vs R2 — 2026-08-29 FINDING-007); §6 third parties vs every outbound host (Perspective — DEPRECATIONS.md says it sunsets 2026-12-31: is the policy's claim dated or about to expire?; Universalis; XIVAPI; Discord CDN); §7 access / deletion instructions (commands exist and actually delete what is claimed — trace the deletion code); §8 retention numbers vs TTLs; §11 change-announcement promise; the ToS service description vs the shipped command set. Last Updated (September 28, 2026) vs the last substantive change. Policy findings: policy CORRECT, reconcile_case 3, policy_doc the English file + section.` },
]

const LOCALES = [
  ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Simplified Chinese'], ['de', 'German'], ['fr', 'French'],
]
for (const [lc, lang] of LOCALES) {
  UNITS.push({
    label: `policy-${lc}`,
    rows: [ROW_POLICY],
    brief: `Policy translation review — ${lang} (${lc}). Documents: apps/web-app/PRIVACY.${lc}.md, apps/web-app/TERMS_OF_SERVICE.${lc}.md, apps/discord-worker/PRIVACY_POLICY.${lc}.md, apps/discord-worker/TERMS_OF_SERVICE.${lc}.md, each against its English (unsuffixed, governing) file. FIRST read .agents/skills/audit-shared/policy-documents.md in full — its section 'What the first translation pass taught' is your checklist; list in the review file every pitfall named there and where you checked for it. Then run git show 2e4cb0cb -- apps/web-app/PRIVACY.md apps/web-app/TERMS_OF_SERVICE.md apps/discord-worker/PRIVACY_POLICY.md apps/discord-worker/TERMS_OF_SERVICE.md (the 2026-09-28 Glamour Reader content change) and read the matching hunks of your four translations first — newly translated text is where drift is most likely. Then read every section of all four translations against the English, sentence by sentence. The mechanical parity script already PASSED (numbers, backticked tokens, hosts, commands, structure, dates) — that does NOT cover meaning. Candidates (security FINDING material: severity MEDIUM, exposure INTERNET-UNAUTH, policy CORRECT, reconcile_case 3, policy_doc '<translated file> §n', unit 'web-app' or 'discord-worker') are ONLY claim-level divergences: a promise softened ('never' -> 'normally not') or strengthened, a right / opt-out / deletion path dropped or added, a collected field listed in English but not in the translation (or vice versa), a retention period or recipient changed, a claim-bearing sentence left untranslated or omitted, a modifier attached to the wrong verb that changes who does what, a quoted UI label that does not match apps/web-app/src/locales/${lc}.json (web documents) or packages/bot-logic/src/i18n/locales/${lc}.json (bot documents) — a label a user must follow to opt out or delete is a claim. Also compare the privacy strings in those two ${lc}.json files (git grep -n -i -E 'privacy|never|stored|send' on them) with your language's policy. Everything else — notice wording, structure, terminology, register, typos, CJK hard wraps — goes in handoffs, each prefixed 'DOC:' or 'I18N:'. In the review file give, per document, a section table | § | verdict (same claims / divergence) | note |. Your review file is ${OUT}/evidence/review-policy-${lc}.md.`,
  })
}

const CAND = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cid: { type: 'string' },
          title: { type: 'string' },
          severity: { type: 'string', enum: SEV },
          exposure: { type: 'string', enum: EXP },
          unit: { type: 'string', description: 'deploy unit, e.g. presets-api, web-app, auth' },
          location: { type: 'string', description: 'path:line' },
          claim: { type: 'string' },
          trigger: { type: 'string' },
          evidence: { type: 'string' },
          cwe: { type: 'string' },
          policy: { type: 'string', enum: ['NONE', 'CORRECT', 'AMEND'] },
          policy_doc: { type: 'string' },
          reconcile_case: { type: 'integer', enum: [0, 1, 2, 3] },
          rotation: { type: 'string' },
          regression_of: { type: 'string' },
        },
        required: ['cid', 'title', 'severity', 'exposure', 'unit', 'location', 'claim', 'trigger', 'evidence', 'policy', 'reconcile_case', 'rotation'],
      },
    },
    positive_controls: { type: 'array', items: { type: 'string' } },
    rejected: { type: 'array', items: { type: 'string' } },
    handoffs: { type: 'array', items: { type: 'string' } },
    files_covered: { type: 'integer' },
    review_file: { type: 'string' },
  },
  required: ['candidates', 'positive_controls', 'rejected', 'handoffs', 'files_covered', 'review_file'],
}

const VERDICT = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['CONFIRMED', 'REJECTED'] },
    reason: { type: 'string' },
    severity: { type: 'string', enum: SEV },
    exposure: { type: 'string', enum: EXP },
    unit: { type: 'string' },
    cwe: { type: 'string' },
    policy: { type: 'string', enum: ['NONE', 'CORRECT', 'AMEND'] },
    policy_doc: { type: 'string' },
    policy_variants: { type: 'array', items: { type: 'string' } },
    reconcile_case: { type: 'integer', enum: [0, 1, 2, 3] },
    rotation: { type: 'string' },
    regression_of: { type: 'string' },
    sprint0: { type: 'boolean' },
    title: { type: 'string' },
    location_bullets: { type: 'array', items: { type: 'string' } },
    evidence_bullets: { type: 'array', items: { type: 'string' } },
    fix_bullets: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'reason', 'severity', 'exposure', 'unit', 'policy', 'reconcile_case', 'rotation', 'sprint0', 'title', 'location_bullets', 'evidence_bullets', 'fix_bullets'],
}

const REFUTE = {
  type: 'object',
  properties: {
    outcome: { type: 'string', enum: ['REFUTED', 'UPHELD', 'UNCERTAIN'] },
    reason: { type: 'string' },
    severity: { type: 'string', enum: SEV },
    exposure: { type: 'string', enum: EXP },
  },
  required: ['outcome', 'reason', 'severity', 'exposure'],
}

const CRITIC = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          scope: { type: 'string' },
          brief: { type: 'string' },
        },
        required: ['label', 'scope', 'brief'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['gaps', 'notes'],
}

const CALIB = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          merges: { type: 'array', items: { type: 'integer' } },
          title: { type: 'string' },
          severity: { type: 'string', enum: SEV },
          exposure: { type: 'string', enum: EXP },
          unit: { type: 'string' },
          cwe: { type: 'string' },
          policy: { type: 'string', enum: ['NONE', 'CORRECT', 'AMEND'] },
          policy_doc: { type: 'string' },
          policy_variants: { type: 'array', items: { type: 'string' } },
          reconcile_case: { type: 'integer', enum: [0, 1, 2, 3] },
          rotation: { type: 'string' },
          regression_of: { type: 'string' },
          sprint0: { type: 'boolean' },
          rationale: { type: 'string' },
        },
        required: ['merges', 'title', 'severity', 'exposure', 'unit', 'policy', 'reconcile_case', 'rotation', 'sprint0', 'rationale'],
      },
    },
    dropped: {
      type: 'array',
      items: { type: 'object', properties: { idx: { type: 'integer' }, reason: { type: 'string' } }, required: ['idx', 'reason'] },
    },
    notes: { type: 'string' },
  },
  required: ['findings', 'dropped', 'notes'],
}

const VERIFY_RULES = `Repo root: ${ROOT} (commit 0ab33466 = main). Work read-only: write no files in the repo. If a probe script helps, write it only under ${SCRATCH}/verify/ and run it from there. Packages are already built — never run turbo or any build; you may run ONE existing test file at a time: pnpm --filter <pkg> exec vitest run <file> --coverage.enabled=false. No git writes. No network.
Account for upstream mitigations (middleware order, service-binding-only routing, body caps, Cloudflare platform limits, Discord's own limits), the accepted trade-offs in docs/architecture/security-trade-offs.md, and the Positive controls / Rejected suspicions in docs/audits/2026-09-15-security/SECURITY_AUDIT_REPORT.md and docs/audits/2026-08-29-security/SECURITY_AUDIT_REPORT.md — re-filing an accepted or previously rejected item is REJECTED unless the code changed since.
${GRADING}`

function finderPrompt(u) {
  return `${COMMON}

## Your assignment — label: ${u.label}
${u.brief}

## Checklist rows for this assignment (from the security-audit skill, Step 3)
${u.rows.join('\n\n')}

Write your review to ${OUT}/evidence/review-${u.label}.md, then return the structured output.`
}

function verifyPrompt(c, label) {
  return `You are the verifier for ONE candidate in the 2026-10-03 xivdyetools security audit. Confirm or reject it on what the files actually say, not on how it is worded.
${VERIFY_RULES}

Candidate (from reviewer '${label}'; their notes are in ${OUT}/evidence/review-${label}.md):
${JSON.stringify(c, null, 2)}

Do: open every cited path:line and follow the real call path from the public entry point (route, slash command, button, binding, page load) to the sink. Decide CONFIRMED or REJECTED. Grade Severity and Exposure yourself — do not inherit the reviewer's. sprint0 = true only for a reachable, exploitable-now issue that should ship out-of-band (typically HIGH+ at INTERNET-*, or an exposed live credential).
If CONFIRMED: title names the file/symbol and the defect in one line; location_bullets <= 3 ('path:line — what is there'); evidence_bullets <= 3 (an excerpt of <= 8 lines, or a command + its result); fix_bullets <= 3 (direction; for leaks, exactly what to rotate). For a policy edit, policy_variants lists every file to edit (English + 5 siblings).
If REJECTED: reason is ONE line usable in the report's 'Rejected suspicions' (say why, e.g. 'guarded by X at path:line'); fill the other required fields from the candidate.`
}

function refutePrompt(c, v1) {
  return `Adversarial second opinion for the 2026-10-03 xivdyetools security audit. A first verifier CONFIRMED the candidate below. Your job is to try to REFUTE it: find the guard, cap, middleware, platform behavior, accepted trade-off or earlier audit verdict that makes it unreachable or harmless — or show that its Severity or Exposure is overstated. Open the files yourself; trust neither the reviewer nor the first verifier.
${VERIFY_RULES}

Original candidate:
${JSON.stringify(c, null, 2)}

First verifier's verdict:
${JSON.stringify(v1, null, 2)}

Outcome: REFUTED (cite the path:line or documented fact that defeats it), UPHELD (you tried and could not refute it; give your own Severity and Exposure), or UNCERTAIN (say exactly what would settle it). Always return your own severity/exposure grade.`
}

function tiePrompt(c, v1, v2) {
  return `Tie-break for the 2026-10-03 xivdyetools security audit. Two verifiers disagree about the candidate below. Settle it on the files — open every cited path:line yourself and evaluate both arguments.
${VERIFY_RULES}

Original candidate:
${JSON.stringify(c, null, 2)}

Verifier 1 (CONFIRMED):
${JSON.stringify(v1, null, 2)}

Verifier 2 (${v2 ? v2.outcome : 'no answer'}):
${JSON.stringify(v2, null, 2)}

Return CONFIRMED with your final grade and complete finding fields (title, location/evidence/fix bullets — reuse verifier 1's where they are accurate), or REJECTED with a one-line reason usable in 'Rejected suspicions'.`
}

async function verifyCandidate(c, label) {
  const tag = `${label}#${c.cid}`
  const cand = { ...c, cid: tag }
  const v1 = await agent(verifyPrompt(cand, label), { label: `verify:${tag}`, phase: 'Verify', schema: VERDICT, agentType: 'xivdye-verifier' })
  if (!v1) return { cid: tag, label, cand, status: 'ERROR' }
  if (v1.verdict !== 'CONFIRMED') return { cid: tag, label, cand, status: 'REJECTED', v1 }
  if (v1.severity === 'INFO') return { cid: tag, label, cand, status: 'CONFIRMED', v1, final: v1 }
  const v2 = await agent(refutePrompt(cand, v1), { label: `refute:${tag}`, phase: 'Verify', schema: REFUTE, agentType: 'xivdye-verifier' })
  if (v2 && v2.outcome === 'UPHELD') return { cid: tag, label, cand, status: 'CONFIRMED', v1, v2, final: v1 }
  const v3 = await agent(tiePrompt(cand, v1, v2), { label: `tiebreak:${tag}`, phase: 'Verify', schema: VERDICT, agentType: 'xivdye-verifier' })
  if (v3 && v3.verdict === 'CONFIRMED') return { cid: tag, label, cand, status: 'CONFIRMED', v1, v2, v3, final: v3 }
  return { cid: tag, label, cand, status: v3 ? 'REJECTED' : 'ERROR', v1, v2, v3 }
}

async function runRound(units, phaseName) {
  return pipeline(
    units,
    u => agent(finderPrompt(u), { label: `review:${u.label}`, phase: phaseName, schema: CAND, agentType: 'xivdye-worker' }),
    (review, u) => {
      if (!review) return { label: u.label, review: null, results: [] }
      const cands = review.candidates || []
      log(`${u.label}: ${cands.length} candidate(s), ${review.files_covered} files covered`)
      return parallel(cands.map(c => () => verifyCandidate(c, u.label)))
        .then(rs => ({ label: u.label, review, results: rs.filter(Boolean) }))
    },
  )
}

function summarize(rounds) {
  return rounds.filter(Boolean).map(r => ({
    label: r.label,
    review_file: `${OUT}/evidence/review-${r.label}.md`,
    returned: !!r.review,
    files_covered: r.review ? r.review.files_covered : 0,
    candidates: r.results.map(x => ({ cid: x.cid, status: x.status, title: (x.final && x.final.title) || x.cand.title, reason: x.status === 'REJECTED' ? ((x.v3 && x.v3.reason) || (x.v2 && x.v2.reason) || (x.v1 && x.v1.reason)) : undefined })),
  }))
}

// ---------- Round 1 ----------
phase('Review')
log(`${UNITS.length} review assignments`)
const allRounds = []
const r1 = await runRound(UNITS, 'Review')
allRounds.push(...r1.filter(Boolean))
const failed1 = UNITS.filter((u, i) => !r1[i] || !r1[i].review).map(u => u.label)
if (failed1.length) log(`finders that returned nothing: ${failed1.join(', ')}`)

// ---------- Gap rounds (loop until dry, max 2) ----------
phase('Gaps')
const criticNotes = []
const seenGapLabels = new Set(UNITS.map(u => u.label))
for (let round = 2; round <= 3; round++) {
  const summary = summarize(allRounds)
  const critic = await agent(`You are the completeness critic for the 2026-10-03 xivdyetools whole-monorepo security audit (repo root ${ROOT}, audit folder ${OUT}). Read-only; write no files.
Below is every review assignment so far: its review file (${OUT}/evidence/review-<label>.md), whether it returned, its files-covered count, and its candidates with their verification status. Assignments that returned nothing: ${JSON.stringify(allRounds.filter(r => !r.review).map(r => r.label))}.
${JSON.stringify(summary, null, 1)}

Your job is to find what is MISSING — not to re-review. (1) For each deploy unit (apps/*, packages/*), compare its tracked non-test source files (git ls-files <unit>/src plus wrangler.toml, migrations, public/, functions/, scripts run in CI) with the union of the 'Files covered' lists in the review files; name uncovered security-relevant files (route handlers, middleware, storage, outbound calls, parsing, auth, logging). (2) Check that each checklist row of .agents/skills/security-audit/SKILL.md Step 3 was actually addressed for each unit it applies to — look for evidence in the review files, not claims. (3) Look for surfaces no assignment owned: a Pages function, a scheduled() handler, a queue consumer, a Durable Object, a cron, a script CI runs with secrets, a new package export, an api-worker docs page, a locale variant nobody read. (4) Look for candidate clusters that imply a sibling issue in another unit nobody checked (a missing cap in one worker -> the same pattern elsewhere). (5) Any assignment that returned nothing must be re-issued.
Return at most 10 gap assignments, each self-contained: label (unique kebab-case, prefix 'gap${round}-'), scope (paths), and brief (exactly what to check and why it is a gap, written so a reviewer with no other context can do it). Return an empty gaps list if coverage is complete. Never return a gap for something already rejected with a reason.`, { label: `completeness-critic-${round}`, phase: 'Gaps', schema: CRITIC, agentType: 'xivdye-verifier' })
  if (!critic) { log(`critic ${round} returned nothing — stopping gap rounds`); break }
  criticNotes.push({ round, notes: critic.notes, gaps: critic.gaps })
  const gaps = (critic.gaps || []).filter(g => !seenGapLabels.has(g.label)).slice(0, 10)
  if ((critic.gaps || []).length > 10) log(`critic ${round} proposed ${(critic.gaps || []).length} gaps; capped at 10 (dropped: ${critic.gaps.slice(10).map(g => g.label).join(', ')})`)
  if (!gaps.length) { log(`critic ${round}: coverage complete`); break }
  gaps.forEach(g => seenGapLabels.add(g.label))
  log(`gap round ${round}: ${gaps.map(g => g.label).join(', ')}`)
  const gapUnits = gaps.map(g => ({ label: g.label, rows: [ROW_WORKER, ROW_PII, 'Apply any other row of .agents/skills/security-audit/SKILL.md Step 3 that fits your scope.'], brief: `Gap assignment from the completeness critic. Scope: ${g.scope}. ${g.brief}` }))
  const rg = await runRound(gapUnits, 'Gaps')
  allRounds.push(...rg.filter(Boolean))
}

// ---------- Calibrate ----------
phase('Calibrate')
const all = allRounds.flatMap(r => r.results)
const confirmed = all.filter(x => x.status === 'CONFIRMED')
const rejected = all.filter(x => x.status === 'REJECTED')
const errored = all.filter(x => x.status === 'ERROR')
log(`${all.length} candidates: ${confirmed.length} confirmed, ${rejected.length} rejected, ${errored.length} errored`)

const calibInput = confirmed.map((x, idx) => ({
  idx,
  cid: x.cid,
  title: x.final.title,
  severity: x.final.severity,
  exposure: x.final.exposure,
  refuter_grade: x.v2 ? `${x.v2.outcome} ${x.v2.severity}/${x.v2.exposure}` : 'none',
  unit: x.final.unit,
  cwe: x.final.cwe,
  policy: x.final.policy,
  policy_doc: x.final.policy_doc,
  reconcile_case: x.final.reconcile_case,
  rotation: x.final.rotation,
  regression_of: x.final.regression_of,
  sprint0: x.final.sprint0,
  location: x.final.location_bullets,
  evidence: (x.final.evidence_bullets || []).slice(0, 2),
}))

let calib = null
if (confirmed.length) {
  calib = await agent(`You are the final calibrator for the 2026-10-03 xivdyetools whole-monorepo security audit (repo root ${ROOT}). Read-only; write no files. You may open any path:line to settle a grade.
Below are all ${confirmed.length} CONFIRMED candidates, each confirmed by a verifier and upheld by an adversarial second verifier or a tie-breaker (INFO items skip the second check).
${JSON.stringify(calibInput, null, 1)}

Tasks: (1) Merge duplicates — the same root defect found by several reviewers (same path:line, or the same missing control) becomes ONE finding listing every input idx in merges. A pattern repeated across deploy units stays one finding only if one fix closes it everywhere; otherwise split per deploy unit. (2) Calibrate Severity and Exposure consistently across the whole set using the rules below; where the refuter graded differently, decide. (3) Deploy unit, from: web-app, discord-worker, moderation-worker, presets-api, oauth, api-worker, og-worker, image-worker, stoat-worker, auth, logger, worker-kit, core, svg, bot-logic, types, test-utils, CI — join several with ' + '. (4) Final Policy / reconcile_case / policy_variants / Rotation / CWE. A policy-translation divergence is policy CORRECT on that translated file only; an English-claim error lists all six variants. (5) sprint0 only for reachable, exploitable-now issues (and exposed live credentials). (6) Order the findings most urgent first by Severity x Exposure (an INTERNET-UNAUTH MEDIUM outranks a LOCAL HIGH). Every input idx must appear in exactly one finding's merges or in dropped (with a reason).
${GRADING}`, { label: 'calibrate', phase: 'Calibrate', schema: CALIB, agentType: 'xivdye-verifier' })
}

return {
  calib,
  confirmed: confirmed.map((x, idx) => ({ idx, cid: x.cid, label: x.label, final: x.final, refuter: x.v2 || null, tiebreak: x.v3 || null, cand: x.cand })),
  rejected: rejected.map(x => ({ cid: x.cid, label: x.label, title: x.cand.title, location: x.cand.location, reason: (x.v3 && x.v3.reason) || (x.v2 && x.v2.outcome === 'REFUTED' ? x.v2.reason : null) || (x.v1 && x.v1.reason) })),
  errored: errored.map(x => ({ cid: x.cid, label: x.label, title: x.cand.title, location: x.cand.location })),
  reviews: allRounds.map(r => ({ label: r.label, returned: !!r.review, files_covered: r.review ? r.review.files_covered : 0, positive_controls: r.review ? r.review.positive_controls : [], rejected: r.review ? r.review.rejected : [], handoffs: r.review ? r.review.handoffs : [] })),
  critic: criticNotes,
}
