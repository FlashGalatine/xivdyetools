# Reviewer brief — whole-monorepo security audit 2026-08-29 (xivdyetools)

You are one of nine parallel reviewers, each owning one deploy unit. The coordinator verifies
every candidate at `file:line` before it becomes a finding, so **precision beats volume**: every
claim must name a `file:line` you actually read and, for reachable issues, the request/input
that triggers it. Findings are leads; anything you checked and dropped goes in your report's
*Rejected* section with a one-line reason (that keeps the next audit from re-chasing it).

## Ground rules

- **READ-ONLY.** Source lives in the audit worktree
  `C:/dev/XIVProjects/.worktrees/xivdyetools-security-audit-2026-08-29` (branch
  `security-audit-2026-08-29`, commit `4c213248` = `main`). Read there. Do not edit any file
  except your single output file. No git write commands (no add/commit/stash/checkout/reset).
- To *run* a test the worktree has no `node_modules`; the main checkout
  `C:/dev/XIVProjects/xivdyetools` is at the same commit and has them —
  `pnpm --filter <pkg> exec vitest run <file>` there is fine; **never edit there** (another
  session may be working in it).
- Search tracked files only: `git ls-files 'apps/<unit>/src/*.ts' | xargs grep -n <pattern>`.
  Plain `grep -r` is poisoned (coverage / e2e-coverage JSON embeds whole sources). This is
  git-bash on Windows: no `--include={a,b}` brace globs; long heredocs fail.
- Start with the **delta since the previous audit** — your unit's list is in
  `docs/audits/2026-08-29-security/evidence/delta-files-by-unit.txt` (153 commits,
  `b195723f..HEAD`; `git log --format='%h %s' b195723f..HEAD -- apps/<unit>` shows the intent) —
  then sweep the whole unit against the checklist rows you were given.
- Previous audit: `docs/audits/2026-08-21-security/`. You **may** read
  `evidence/review-<unit>.md` for your unit (route table, INFO items, rejected list) to avoid
  re-chasing, but verify everything against *current* code. All 36 findings were marked FIXED
  on 2026-08-21; where a fix touches your unit, confirm it is real and has a guarding test —
  **a regression is a new finding, cross-linked to the old ID**. Previously INFO-only items
  that are now material (new code path, wider exposure) may be promoted — say why.
- Do not re-file accepted trade-offs or verified positive controls (both listed below) unless
  they regressed.
- Skip generic items that do not apply (LDAP/XPath/XXE, filesystem traversal in Workers).
- Vocabulary — **Severity:** CRITICAL | HIGH | MEDIUM | LOW | INFO. **Exposure:**
  INTERNET-UNAUTH | INTERNET-AUTH | INTERNAL (service binding) | LOCAL (build/dev).
  Severity × Exposure orders the work, so always give both. **Rotation:** if a candidate leaks
  or weakens a credential, say exactly what must be rotated.
- Deploy-unit reminders (see `.claude/skills/audit-shared/units.md` in `C:/dev/XIVProjects`):
  `oauth` has no `[env.production]` — a bare `wrangler deploy` **is** production; `og-worker`'s
  top-level env is the **routed beta** (`beta.xivdyetools.app`); `discord-worker`'s top-level
  env is the beta bot; image-worker is service-binding only.

## Checklist by surface (apply the rows named in your assignment; "Every Worker" and
## "Personal data" apply to every Worker unit)

| Surface | Check |
|---|---|
| **Every Worker (Hono)** | route-level auth/authz order (middleware before handlers); param/body validation + size caps (`readBodyWithCap`-style); D1 only via `.prepare().bind()` (no template SQL); KV/R2 key construction from user input; error handler leaks (stack/env/`/` root echo); `Cache-Control`/`Vary` on user-specific responses; CORS allowlist exact-match (oauth, presets-api, api-worker); rate limiting present and **fail-closed** (native `[[ratelimits]]`; KV limiter cannot throttle fast clients); secrets only as secrets (never `[vars]`), `.dev.vars*` gitignored; module-scope state shared across requests; `waitUntil` for side effects; logger redaction of tokens/IDs; outbound `fetch` targets allowlisted (SSRF), timeouts |
| **Discord bots** (discord-worker, moderation-worker) | Ed25519 signature verified before parsing; interaction freshness/timestamp; moderator/owner gates on *every* admin path incl. autocomplete + components (`MODERATOR_IDS`); `custom_id` parsing bounds; user text sanitised before cards/embeds (bot-logic sanitiser helpers); bot→presets-api signed with v2 (`X-Request-Signature-V2` + nonce, 60 s) and v1 acceptance removed once both bots deploy; webhook (`INTERNAL_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`) verification constant-time |
| **oauth** | `state` required + bound on every callback; redirect_uri allowlist; JWT alg pinned, `exp`, revocation list honoured by `/auth/refresh` (blacklist must outlive `exp`); token TTLs; cookie flags; `[env.production]` absent → bare deploy is prod |
| **presets-api** | ownership + state-machine checks on every mutation (TOCTOU on status writes); moderation endpoints authz; upload type/size/dimension gates before image-worker; R2 keys not user-controlled; tag charset; pagination bounds; `author_discord_id` exposure; Perspective API key never in query string, **fail-closed** |
| **image-worker** | service-binding only (no routes); dimension gate from headers before decode (decompression bomb); body cap; photon panic paths; callers' contract |
| **og-worker** / **api-worker** | unbounded URL params (length, count, `O(n³)` wraps); `?lang=` allowlist; XML/SVG escaping of user text (`escapeXml`); edge cache keys incl. all params; Universalis proxy allowlist + timeouts; KV cache poisoning |
| **web-app** (Pages) | `_headers` CSP/HSTS/`X-Frame-Options` + pattern-merge trap; `innerHTML` sinks escaped (`escapeHtml`), `postMessage` origins; OAuth `state` forwarded; token storage + logout clears; third-party script/font origins; SW/cache rules; `public/` leaks |
| **Packages** | auth: HMAC key length floor (`createHmacKey` ≥ 32 B), constant-time compare, canonical string unambiguous (length-prefixed); logger: redaction list covers Discord/JWT/HMAC shapes; worker-kit: limiter defaults fail-closed; core: JSON parsing of untrusted `.chara`/preset input bounded |
| **Personal data — every unit** (CWE-359 privacy violation, CWE-532 log exposure) | xivdyetools has **no business reason to collect PII**; the only personal field with a documented purpose is the pseudonymous Discord user id, and only where a policy lists it. Reconcile `evidence/pii-sinks.txt` × `evidence/pii-sources.txt` for your unit: for each analytics datapoint (`writeDataPoint` blobs/doubles — web `apps/api-worker/src/telemetry/schema.ts`, bot `apps/discord-worker/src/services/analytics.ts`, og-worker `src/index.ts`), KV/D1/R2 write, structured log call and third-party request body, name every field and check it against the governing promise — `apps/discord-worker/PRIVACY_POLICY.md` §2 (never option values, message content, guild/channel ids), the web-app telemetry spec `docs/superpowers/specs/2026-08-29-web-analytics-design.md` (no ids, no storage, opt-in default off, GPC honoured, allowlist-validated server-side), and locale strings promising images never leave the browser. Flag: IP / UA / request id / username / avatar / email / guild or channel id / free text / file names / `.chara` `TypeName` / option values reaching any datapoint or log; any client-generated persistent or per-session identifier; telemetry that can fire while the opt-in is off or GPC is set; a server telemetry route that writes a field it did not validate against an enum or the dye DB; logger calls interpolating user objects (`{ user }`, `interaction.member`) rather than ids; exact timestamps or coarse buckets widened into fingerprints (viewport in px, full version strings, full locale tags). A field that is *harmless-looking* but not listed in the policy is still a finding (MEDIUM, exposure of the unit); a field the policy explicitly promises not to store is HIGH. Positive controls to record: allowlist schemas, `'invalid'`-not-reject envelope handling, `guild`/`dm` context blob, redaction lists |
| **CI / supply chain** | actions SHA-pinned, `permissions: contents: read`, OIDC publish (no npm token), `pnpm audit --prod` + gitleaks jobs present, `pnpm.overrides` for known advisories, deploy workflows gated on `main`, secrets not echoed in logs, D1 migration steps |

## Accepted trade-offs (`docs/architecture/security-trade-offs.md`) — do not re-file

KV limiter lost-increment race (~2× burst); **fail-open** KV rate limiting for availability;
HS256-only JWT; `timingSafeEqual` XOR fallback outside Workers. *But*: the 2026-08-21 FINDING-003
fix moved primary limiting to native `[[ratelimits]]` bindings (`CloudflareRateLimiter`), with
the KV limiter kept only as a rollover fallback whose removal is gated on
`docs/operations/POST_MERGE_CHECKLIST.md` §3 — check the native path is what actually runs in
production, what happens when the binding is absent/throws, and whether the fallback is still
reachable from the internet.

## Previous audit (2026-08-21) — positive controls already verified; re-verify only if the delta touched them

- Ed25519 verification over the raw body on every interaction route, fail-closed, 100 KB cap; bot→API bearer **plus** HMAC (v2, nonce, window), mandatory in production; moderator allowlist enforced on every slash/button/modal/autocomplete path and re-checked server-side.
- OAuth: PKCE S256, HMAC-signed 10-min state with constant-time verify, exact-origin allowlist, pinned token-exchange `redirect_uri`, HS256 pinned with ≥32-byte secret, fully parameterised D1 with atomic batches, strict CORS, sanitised errors, fail-closed production env validation, no secrets in config; revocation TTL ≥ exp + refresh grace; `iss` pinned; presets-api consults `TOKEN_BLACKLIST`.
- Web app: strong CSP (`script-src 'self'`, no inline, `frame-ancestors 'none'`), HSTS preload, nosniff, Referrer-Policy; Lit text bindings for remote strings; `rel="noopener noreferrer"`; no third-party scripts/fonts/iframes; no service worker; PKCE/state fail-closed; URL scrubbed after callback.
- Supply chain: `minimumReleaseAge: 1440`, `allowBuilds` deny-all, security floors, `--frozen-lockfile`, nightly `pnpm audit --prod --audit-level high`, gitleaks on every push, OIDC trusted publishing with `--provenance`, packages 2FA/no-token, SHA-pinned actions with `permissions:` blocks, `environment: production` on deploys.
- SVG text XML-escaped and rasterised to PNG; fonts bundled; image-worker has no public routes and a header-only dimension gate; og-worker `/og/*` guards + linear wrap + `caches.default`; presets-api CORS allowlist with origin callback; conditional status updates (`expectedStatus`) on key transitions; append-only quota events; logger redaction (2.1.0); request-ID and IP helpers safe by default.

## Previous audit — rejected suspicions (do not re-chase unless the code changed)

SQL injection (all D1 access parameterised, LIKE escaped); SSRF (image-worker exact Discord-CDN
allowlist with one-hop validated redirects; api-worker/og-worker build upstream URLs from
validated segments; Discord attachment URLs come from `resolved.attachments`); reflected XSS in
og-worker crawler HTML (all interpolations escaped); cross-guild moderator escalation
(`MODERATOR_IDS` re-checked by presets-api behind HMAC); JWT `alg` confusion / `none`; open
redirect in oauth (exact-origin allowlist) and web-app (`sanitizeReturnPath`); secrets in
repo/history; `Math.random` in security contexts; dangerous sinks with constant values (icon
`innerHTML`/`unsafeHTML`).

## Output contract

1. Write **exactly one file**:
   `C:/dev/XIVProjects/.worktrees/xivdyetools-security-audit-2026-08-29/docs/audits/2026-08-29-security/evidence/review-<unit>.md`
   with these sections:
   - `## Route / command table + authz matrix` (workers/bots) or `## Module map` (web-app, packages, infra)
   - `## Candidates` — one subsection per candidate: `### <UNIT>-NN — <title>` with Severity,
     Exposure, Rotation, `file:line` (≤ 8-line excerpt), the trigger (request/input), impact,
     suggested fix. Keep exploit detail here, not in the summary.
   - `## Positive controls` — what is right and should not be re-filed next time
   - `## Rejected` — candidate + one-line reason
   - `## Files covered` — list every file you read
   If the write is refused, put the whole report in your final message under `REPORT:`.
2. Return to the coordinator **≤ 40 lines**:
   ```
   | cand-id | sev | exposure | file:line | one-line claim | evidence pointer |
   POSITIVE: (≤ 5 bullets)
   COVERED: <n> files
   ```
   `cand-id` = `<UNIT>-01`, `<UNIT>-02`, … Never assign `FINDING-` IDs — the coordinator does.
