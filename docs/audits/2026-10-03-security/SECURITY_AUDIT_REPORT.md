# Security audit — xivdyetools, whole monorepo (2026-10-03)

- **Branch/commit:** `claude/security-audit-96f7ce` @ `0ab33466c2e184e433b05aeb96cbe46e88f0e041` (= `main`). Previous audit: [2026-09-15-security](../2026-09-15-security/README.md) @ `0332fcc5` — 378 commits / 493 files since.
- **Scope:** all 9 apps, 8 packages, CI / wrangler / GitHub settings, and the four policy documents in all six languages (24 files).
- **Method:** Step 2 evidence ([collect.sh](evidence/scripts/collect.sh)); 29 review assignments + 6 completeness-critic gap assignments ([audit-workflow.js](evidence/scripts/audit-workflow.js), 35 `evidence/review-*.md`); every candidate verified at `file:line` by a verifier and challenged by an adversarial second verifier (tie-break on disagreement); a calibration pass over all confirmed rows; coordinator reconciliation against the rejected list, prior audits and the Step 3a policy rules ([final-catalog.json](evidence/scripts/final-catalog.json)); a verifier-tier re-read of all 20 translations; live read-only header and GitHub-settings probes.
- **Totals:** **31 findings — 1 HIGH, 4 MEDIUM, 21 LOW, 5 INFO.** No CRITICAL, no credential exposed, no rotation.
- **Sprint 0 (act now):** **FINDING-001** — beta.xivdyetools.app serves no CSP / X-Frame-Options / HSTS (live).
- **Source changes:** none. Only `docs/audits/2026-10-03-security/` was written.

## Severity × exposure

| Severity | INTERNET-UNAUTH | INTERNET-AUTH | INTERNAL | LOCAL | Total |
|---|---:|---:|---:|---:|---:|
| CRITICAL | 0 | 0 | 0 | 0 | 0 |
| HIGH | 0 | 1 | 0 | 0 | 1 |
| MEDIUM | 3 | 1 | 0 | 0 | 4 |
| LOW | 8 | 8 | 0 | 5 | 21 |
| INFO | 3 | 0 | 0 | 2 | 5 |
| **Total** | **14** | **10** | **0** | **7** | **31** |

## Catalog

| ID | Title | Sev | Exposure | Deploy unit | Rotation |
|---|---|---|---|---|---|
| [FINDING-001](findings/FINDING-001.md) | Beta serves no CSP / XFO / HSTS / Permissions-Policy — appended `/*` rule replaces the security rule | MEDIUM | INTERNET-UNAUTH | web-app | NONE |
| [FINDING-002](findings/FINDING-002.md) | `/budget` logs option values (target dye, method, threshold) that bot policy §5 says are never logged | HIGH | INTERNET-AUTH | discord-worker | NONE |
| [FINDING-003](findings/FINDING-003.md) | PRIVACY.md: "images never leave your device" — the preset preview image is uploaded and stored in R2 | MEDIUM | INTERNET-UNAUTH | web-app | NONE |
| [FINDING-004](findings/FINDING-004.md) | Sign-in copy says "No character data"; XIVAuth stores the verified character name as author name + a linked Discord id | MEDIUM | INTERNET-UNAUTH | web-app + oauth | NONE |
| [FINDING-005](findings/FINDING-005.md) | Ban / moderation-log records (id, username copy, free-text reason) kept indefinitely, undisclosed | MEDIUM | INTERNET-AUTH | moderation-worker + presets-api | NONE |
| [FINDING-006](findings/FINDING-006.md) | oauth still trusts the retired `xivdyetools.projectgalatine.com` origin for redirect + CORS | LOW | INTERNET-UNAUTH | oauth | NONE |
| [FINDING-007](findings/FINDING-007.md) | Bot policy says "Discord Username"; the bot publishes the display name (`global_name`) | LOW | INTERNET-UNAUTH | discord-worker | NONE |
| [FINDING-008](findings/FINDING-008.md) | Submissions posted to private Discord moderation / log channels; both policies silent | LOW | INTERNET-UNAUTH | discord-worker + web-app | NONE |
| [FINDING-009](findings/FINDING-009.md) | Web PRIVACY.md item 3 omits 30-day submission counters + notification-failure records | LOW | INTERNET-UNAUTH | web-app | NONE |
| [FINDING-010](findings/FINDING-010.md) | PRIVACY.md: "Reset settings" clears saved work and the session token — it resets tool configs only | LOW | INTERNET-UNAUTH | web-app | NONE |
| [FINDING-011](findings/FINDING-011.md) | PRIVACY.md IP section omits the market proxy's in-memory per-IP limiter | LOW | INTERNET-UNAUTH | api-worker + web-app | NONE |
| [FINDING-012](findings/FINDING-012.md) | `swatch.charaHint` / LOCAL ONLY chip say "Nothing is uploaded" in the Glamour Reader, which calls `/v1/chara/resolve` | LOW | INTERNET-UNAUTH | web-app | NONE |
| [FINDING-013](findings/FINDING-013.md) | `/stats preferences` samples stored preference records — purpose not in bot policy §4 | LOW | INTERNET-UNAUTH | discord-worker | NONE |
| [FINDING-014](findings/FINDING-014.md) | Linking Discord to an XIVAuth-only account switches the presets-api identity: UUID-keyed ban lapses, presets/votes orphaned | LOW | INTERNET-AUTH | presets-api + oauth | NONE |
| [FINDING-015](findings/FINDING-015.md) | `/preferences reset` leaves legacy `i18n:user:` / `budget:world:v1:` keys, which re-migrate | LOW | INTERNET-AUTH | discord-worker | NONE |
| [FINDING-016](findings/FINDING-016.md) | presets-api stores `example_link` / `author_name` raw — no control / bidi / invisible-char rule | LOW | INTERNET-AUTH | presets-api | NONE |
| [FINDING-017](findings/FINDING-017.md) | Approve/reject buttons carry no reviewed `content_revision` — a stale embed approves edited text | LOW | INTERNET-AUTH | discord-worker + moderation-worker + presets-api | NONE |
| [FINDING-018](findings/FINDING-018.md) | discord-worker logs the user id in lines bot policy §5 ("two of them") does not name | LOW | INTERNET-AUTH | discord-worker | NONE |
| [FINDING-019](findings/FINDING-019.md) | After the documented Perspective-key removal (by 2026-12-31) every preset auto-approves — local list holds no profanity | LOW | INTERNET-AUTH | presets-api | NONE |
| [FINDING-020](findings/FINDING-020.md) | Preview-image approve/reject (and R2 delete) writes no `moderation_log` row | LOW | INTERNET-AUTH | presets-api | NONE |
| [FINDING-021](findings/FINDING-021.md) | `unbanUser` restore has no `dye_signature` collision check — the all-or-nothing unban fails | LOW | INTERNET-AUTH | moderation-worker | NONE |
| [FINDING-022](findings/FINDING-022.md) | No wrangler.toml pins `[observability]` off; CI does not assert it — the "Workers Logs off" promise is unchecked | LOW | LOCAL | 7 workers + CI | NONE |
| [FINDING-023](findings/FINDING-023.md) | Production bot tokens are repository-scope secrets, outside the main-only `production` environment | LOW | LOCAL | CI | NONE |
| [FINDING-024](findings/FINDING-024.md) | `Secret scan (gitleaks)` not a required check; `enforce_admins` off; deploys don't depend on CI | LOW | LOCAL | CI | NONE |
| [FINDING-025](findings/FINDING-025.md) | `wrangler>miniflare>undici@7.29.0` — 10 dev-tree advisories invisible to the `--prod` gate | LOW | LOCAL | CI | NONE |
| [FINDING-026](findings/FINDING-026.md) | stoat-worker `sanitizeEcho` does not defuse Revolt `@online` (parked unit) | LOW | LOCAL | stoat-worker + bot-logic | NONE |
| [FINDING-027](findings/FINDING-027.md) | Public `/webhooks/preset-submission` bearer secret has no length floor or failed-auth limit | INFO | INTERNET-UNAUTH | discord-worker + presets-api | NONE |
| [FINDING-028](findings/FINDING-028.md) | Policy "links to other sites" sections omit author-supplied preset example links | INFO | INTERNET-UNAUTH | web-app | NONE |
| [FINDING-029](findings/FINDING-029.md) | Web PRIVACY.md deletion path states no steps, response time or retention | INFO | INTERNET-UNAUTH | web-app | NONE |
| [FINDING-030](findings/FINDING-030.md) | Repo settings: SHA pinning not enforced, Dependabot alerts off, no code scanning | INFO | LOCAL | CI | NONE |
| [FINDING-031](findings/FINDING-031.md) | No test or startup check ties migration 0014's revision trigger to `schema.sql` / deployed D1 | INFO | LOCAL | presets-api | NONE |

FINDING-001 is the only exploitable-now item: beta signs users in with production JWTs and writes production preset data, so a missing `frame-ancestors`/XFO makes clickjacking of vote / edit / delete possible today, and a missing CSP removes the control the token-in-`localStorage` trade-off relies on. It has been live since 2026-08-09; none of the three previous audits probed the beta origin.

FINDING-019 is dated: the documented runbook deletes the Perspective key by 2026-12-31, and after that every preset auto-approves. The plan therefore puts a doc-only `DEPRECATIONS.md` blocking step in Sprint 0, and falls back to shipping the presets-api part alone if it has not merged by about 2026-12-01.

FINDING-002 is HIGH by the skill’s rule — a field the policy explicitly promises is never in these log lines — not by impact: the values are a dye id, an enum and a number, and Workers Logs persistence is off. The calibration pass argued MEDIUM; the maintainer confirmed HIGH at the §8 gate on 2026-10-03.

## Pending rotation

No credential exposure was found. Gitleaks v8.30.1 (SHA256-verified) reported no leaks in the tracked tree or in 1,511 commits of local history; GitHub secret scanning reports 0 alerts; the 66 credential-shaped grep hits are classified in `evidence/review-secret-hits.md` (none real).

| ID | Credential | Rotated? | Revoked? |
|---|---|---|---|
| none | — | n/a | n/a |

## Pending policy edits

Every row is a **six-file edit per document** (English + `.ja/.ko/.zh/.de/.fr`), all `Last updated` lines bumped to the same date, `policy-locale-parity.py` back to exit 0, and the laymans changelog entry. Locale-JSON rows also need `pnpm --filter xivdyetools-web-app run validate:i18n` and the parity gates. **AMEND rows are new public commitments and need the maintainer's explicit yes at the §8 gate**; each must land no earlier than the code change it describes, and each is a "significant change" under bot policy §11 (Discord announcement) where the bot policy is touched.

| ID | Document(s) | § | CORRECT/AMEND | Landed? |
|---|---|---|---|---|
| FINDING-003 | web `PRIVACY.md` | Images and camera captures; Network access item 3; How to verify | CORRECT | no |
| FINDING-004 | web `PRIVACY.md`, web `TERMS_OF_SERVICE.md`, web `locales/*.json` `preset.privacyNote` | item 3; Accounts | **AMEND**, approved 2026-10-03: disclose the verified character name and the linked Discord id (plan Sprint 2) | no |
| FINDING-005 | bot `PRIVACY_POLICY.md`, web `PRIVACY.md` | §2 / §5 / §8; item 3 | **AMEND**, approved 2026-10-03, after minimizing (plan Sprints 3–5, 8) | no |
| FINDING-007 | bot `PRIVACY_POLICY.md` | §2, §4 | **AMEND**, approved 2026-10-03: "display name" | no |
| FINDING-008 | bot `PRIVACY_POLICY.md`, web `PRIVACY.md` | §5 / §7; item 3 | **AMEND** | no |
| FINDING-009 | web `PRIVACY.md` | item 3 | **AMEND** | no |
| FINDING-010 | web `PRIVACY.md` | What is stored on your device | CORRECT | no |
| FINDING-011 | — | — | none: §8 chose the native limiter (plan Sprint 7), which makes the current text true | n/a |
| FINDING-012 | web `locales/*.json` `swatch.charaHint` (+ chip) | — | CORRECT (UI copy; PRIVACY.md is already right) | no |
| FINDING-013 | — | — | none: §8 chose to drop the sampling (plan Sprint 5) | n/a |
| FINDING-028 | web `PRIVACY.md`, web `TERMS_OF_SERVICE.md` | Links to other sites; Other people's services | CORRECT | no |
| FINDING-029 | web `PRIVACY.md` | Questions?; item 3 | **AMEND**, approved 2026-10-03: contact `flashgalatinefgc@gmail.com` or a Discord DM, 30 days | no |

FINDING-002 and FINDING-018 make the existing bot-policy text true by changing code; they need no policy edit. FINDING-005, -008, -009 and -029 all touch web `PRIVACY.md` item 3 and should land as one coordinated web-app policy commit (plan Sprint 8). FINDING-004's AMEND describes code that is already live, so it ships earlier, with the Sprint 2 CORRECTs.

## Evidence and validation

| Check | Result |
|---|---|
| `pnpm audit --prod` (CI gate) | 0 advisories ([json](evidence/pnpm-audit.json), [summary](evidence/pnpm-audit-summary.txt)) |
| `pnpm audit` (full tree, coordinator) | 10 advisories, all dev-only `undici@7.29.0` via `wrangler>miniflare` → FINDING-025 ([json](evidence/pnpm-audit-full.json)) |
| Gitleaks v8.30.1, tree + `--all` history | no leaks, both exit 0 ([provenance](evidence/gitleaks.md)) |
| GitHub secret scanning | 0 alerts ([json](evidence/github-secret-scanning-alerts.json)) |
| Policy locale parity (mechanical) | PASS, 20 variants ([txt](evidence/policy-locale-parity.txt)) |
| Translation meaning (verifier tier, 5 languages × 4 documents) | 19 divergences raised, 11 upheld on challenge, **none changes a data / rights commitment** → I18N handoffs ([json](evidence/policy-translation-reread.json)); the first-pass ja/ko/zh readers had missed a five-language omission |
| Live headers (`curl -sI`) | production: CSP/XFO/HSTS/PP present; beta: all four absent → FINDING-001 |
| GitHub settings (read-only `gh api`) | production env branch policy = `main`; bot tokens are repo secrets; gitleaks not a required check; SHA pinning off; vulnerability alerts disabled ([txt](evidence/gh-settings-2026-10-03.txt)) |
| Fan-out | 35 reviews; 81 candidates → 55 confirmed (verifier + adversarial refuter / tie-break) and 26 rejected → 38 calibrated → **31 filed** after reconciliation ([workflow-result.json](evidence/workflow-result.json)) |
| Regression sweep | **no control regressed**: all six 2026-09-15 fixes and the 2026-08-29 fixes hold at HEAD, application controls guarded by passing single-file test runs (`evidence/review-regression.md`). Guard gaps: migration 0014's trigger (FINDING-031) and two CI-config controls (2026-08-29/028, /029) enforced only by workflow steps — the latter rejected as hardening (see *Rejected suspicions*) |

## Positive controls

- **Discord bots:** Ed25519 verified over a stream-capped body (100 KB, cancelled above the cap) before any parse, with timestamp freshness; `MODERATOR_IDS` gates every command, autocomplete, button and modal; `custom_id`s parsed to UUID/snowflake before use; every REST body defaults `allowed_mentions: { parse: [] }`; user text goes through `sanitizeEmbedText` (2026-09-15 FINDING-001 holds, guarded by `discord-stream.test.ts`).
- **Bot → presets-api:** v2 HMAC canonical string is length-prefixed and binds method, path, body hash, timestamp, nonce and identity; nonces are single-use; `createHmacKey` enforces a 32-byte floor; v1 is gone.
- **Webhooks:** GitHub webhook has an independent 1 MiB stream cap before constant-time HMAC, an event and repository allowlist and a per-version memo; preset-submission webhook is bearer + `timingSafeEqual` + 10 KiB streamed cap.
- **oauth:** HMAC-signed expiring state, server-bound PKCE S256, exact origin+path redirect allowlist shared with CORS, HS256-pinned 1 h JWTs with `iss`/`exp`/`jti` and revocation; `/auth/refresh` removed.
- **presets-api:** auth chain before handlers, D1 only via bound statements, server-generated R2 keys, key-bound preview approvals (409 on stale), `content_revision` CAS on owner/status/revert writes with a DB trigger and atomic audit rows (2026-09-15 FINDING-002/004/005 hold); Perspective called with `doNotStore`, key in a header, failure queues for review.
- **Glamour Reader / `.chara`:** bot attachment fetch is https-only to an exact Discord-CDN allowlist, `redirect: 'manual'`, 10 s timeout, 1 MiB counted cap; the parser uses fixed slot keys and `Object.hasOwn`; Nickname / TypeName / file name never reach a log, datapoint, KV key or outbound body; `/v1/chara/resolve` accepts an integer-only allowlisted body (8 KB cap).
- **image-worker:** service-binding only (`workers_dev = false`, `preview_urls = false`, no routes, pinned by a config test); header-only dimension gate before decode on both paths; streamed byte caps; exact-host SSRF allowlist with IP literals blocked.
- **api-worker / og-worker:** locale and parameter allowlists, canonical cache keys, no stack/env in errors; the Universalis proxy validates DC/world and id counts and caps responses at 5 MB; og-worker escapes all SVG/HTML text and its crawler log holds only tool, locale and crawler category (2026-09-15 FINDING-006 holds, guarded by `index.privacy.test.ts`).
- **Web telemetry:** default off, GPC honored on track and flush and dropped server-side before body read, Origin allowlist, enum / dye-DB validation with `'invalid'` envelope handling, no identifier or storage, memory-only queue cleared on toggle-off across tabs.
- **Production web origin and CI:** CSP `script-src 'self'`, `frame-ancestors 'none'`, first-party `connect-src`, HSTS preload, XFO DENY (live); all 56 `uses:` SHA-pinned, `contents: read` everywhere, OIDC publish with provenance and no npm token, `production` environment limited to `main`, beta on a separate token.

## Rejected suspicions

Candidates checked and dropped, so the next audit does not re-chase them. Each was rejected by its verifier or adversarial refuter unless marked *(coordinator)*. Full reasons are in [workflow-result.json](evidence/workflow-result.json) (`rejected[]`).

- **`/auth/revoke` echoes `err.message` on 500** — unreachable: nothing in the try block can throw (verify helpers return null/false).
- **Preview-image upload race leaves orphaned unreviewed R2 objects** — the uploader never learns the key and owner reads gate the URL on `approved`; a bounded, documented R2 orphan.
- **Viewer-specific presets-api responses lack `Cache-Control: private` / `Vary`** — re-file of 2026-08-29 PAPI-15 (INFO); code unchanged; the zone cache does not store Worker responses.
- **api docs host has no CSP / Permissions-Policy** — re-file of a 2026-08-29 rejection; static VitePress content, XFO DENY set, unchanged since 2026-08-21.
- **og-worker's always-on Analytics Engine counter is not in PRIVACY.md** (raised three times) — re-file of 2026-08-29 OG-02 and the 2026-09-15 positive control: enum blobs + timestamp only, crawler requests only.
- **SPA catch-all still serves HTML under `/fonts`, `/json`, `/og`** — the deliberate scope of the 2026-08-29 FINDING-027 fix, guarded by `pages-middleware.test.ts`.
- **Settings import can switch analytics on** (raised twice) — a user-chosen file restoring a listed setting; the toggle shows it and GPC still gates sending.
- **Saved community-preset snapshots / tribe-gender lock missing from the storage list** — covered by "your own saved work" and the disclosed per-tool settings.
- **Logger redacts secrets but not personal fields** — the documented contract is secret redaction; PII minimization is enforced at call sites.
- **Policies silent on the stoat (Revolt) bot** — not deployed; stores and logs nothing personal.
- **gitleaks `__tests__/` path exemption** — kept by design in the 2026-08-29 FINDING-029 fix; unchanged.
- **Bot §6 Perspective row omits what is sent / will go stale on 2026-12-31** (raised four times; one verifier had confirmed it) *(coordinator)* — the row was accepted by 2026-08-29 FINDING-006 and is accurate today; the sunset is tracked under FINDING-019 and Recommendations.
- **Bot policy "Discord Username" vs display name** — one verifier rejected this on 2026-08-29 precedent; *(coordinator)* superseded by FINDING-007, which two verifiers upheld because that precedent lives only in an evidence file and the fields differ.
- **Bot image claims vs presets-api R2 previews** — bot users cannot upload previews; the web document covers them (now FINDING-003).
- **XIVAuth `refresh` scope requested but unused** — carried 2026-08-29 OAUTH-09 (INFO, not promoted); code unchanged. *(coordinator: one verifier had confirmed it as INFO)*
- **Web deletion route is circular** — the contact routing was the accepted 2026-08-29 FINDING-002 fix; the missing retention / response time is filed separately as FINDING-029.
- **Two different Discord invite codes** — one server can have several invites; no stale link shown.
- **CI secret separation has no automated guard** — a beta workflow edited to read the production Cloudflare token gets an empty value (environment-scoped, `main`-only).
- **Bot §7 "delete within 30 days" vs Analytics Engine rows** — §2 and §8 already say AE rows cannot be deleted per user and expire in about three months, in all six languages.
- **moderation-worker logs user / moderator / target ids** *(coordinator)* — re-files the 2026-09-15 rejected suspicion "Discord pseudonymous IDs in logs"; the 2026-09-16 "two of them" sentence (FINDING-018) describes the Bot only.
- **sessionStorage missing from the storage inventory** *(coordinator)* — transient OAuth flow state, removed on callback; the section makes no closure claim.
- **`allowed_mentions` default missing on interaction callbacks** *(coordinator)* — re-files the 2026-08-29 `review-discord-worker.md` rejection; every type-4 body is ephemeral or bot-built. Kept as a Recommendation.
- **Quadratic GPOSERS `text()` regex** *(coordinator)* — reached only by the viewer's own typed note; routed as a BUG handoff.
- **Translated web Terms list nine tools** *(coordinator)* — a service-description omission, not a data claim; routed as a DOC handoff.
- **Translation drifts** — 8 of 19 raised divergences refuted on challenge; the 11 upheld change no commitment ([handoffs](evidence/handoffs.md)).

## Informational items (not promoted)

| Unit | Item | Source |
|---|---|---|
| oauth | XIVAuth `refresh` scope requested, token discarded (carried 2026-08-29 OAUTH-09, unchanged) | `evidence/review-oauth.md`, `evidence/review-pii-web.md` |
| discord-worker | `utils/response.ts` / `copy.ts` type-4 bodies set no `allowed_mentions` (defense in depth) | `evidence/review-injection-classes.md` |
| core / web-app | Quadratic `text()` regex on a self-typed Acquisition note (BUG handoff) | `evidence/review-packages-domain.md` |

## Recommendations

1. **Probe every live origin in smoke tests and audits** — production, beta and the `pages.dev` alias — for CSP, XFO and HSTS. FINDING-001 survived three audits because the build-time check greps a file instead of reading the served headers.
2. **Tie privacy copy to code with tests** — the "No character data" note, the "Nothing is uploaded" hint and the "two log lines" sentence each drifted after a fix. Assert log contexts carry no option-derived keys or `userId` (FINDING-002/018), and assert the UI copy against the code paths it describes (FINDING-004/012).
3. **Make the Perspective sunset a gated checklist** in `DEPRECATIONS.md`: a replacement filter or default-to-pending before the key is deleted (FINDING-019), plus a six-file edit of both privacy policies the day the key goes.
4. **Pin `[observability] enabled = false` in every wrangler.toml** and extend the CI wrangler-invariants step to fail if logs or Logpush are enabled without a policy edit (FINDING-022).
5. **Harden the GitHub repo settings**: require `Secret scan (gitleaks)`, enforce SHA pinning, enable Dependabot alerts, move bot tokens onto the `production` environment, and add a non-blocking full-tree `pnpm audit` (FINDING-023/024/025/030).
6. **Review translations at verifier tier.** Worker-tier readers in three languages missed a five-language omission that two others caught; `policy-documents.md` should say so.
7. **Set `allowed_mentions` centrally in discord-worker `utils/response.ts`**, as moderation-worker already does, so a future public `content` reply cannot ping.
8. **Give presets-api one stable per-account identity** (oauth `sub`) and keep the Discord snowflake only for bot-side matching, closing FINDING-014 and the 2026-09-16 BUG-001 residual together.

## Limits

Source / configuration audit plus read-only live probes: `HEAD` requests to the two web origins and GET-only `gh api` calls. Not a penetration test; no live Worker interaction beyond those, no load tests, no D1 / KV / R2 records, personal data or credentials inspected. Cloudflare dashboard state (Workers Logs, token scopes, WAF) was not read: the Cloudflare MCP servers were unauthenticated. The deployed D1 schema (migration 0014 trigger) was not verified. Reviewers ran single test files only; the whole-monorepo gate was not run.

## Handoffs

196 non-security leads for `documentation-audit`, `i18n-manager` and `deep-dive-analysis` are in [evidence/handoffs.md](evidence/handoffs.md). The most actionable is the DOC item: all five translated web Terms list nine tools.

## Remediation status

| ID | Status | Commit |
|---|---|---|
| FINDING-001 | FIXED 2026-10-03 — live on beta (`curl -sI` acceptance passed) and merged | `61b7077b`, PR #221 → `b89629d9` |
| FINDING-002 | FIXED 2026-10-03 | `28769473`, PR #222 → `8ecb878f` |
| FINDING-003 | OPEN | — |
| FINDING-004 | OPEN | — |
| FINDING-005 | OPEN | — |
| FINDING-006 | OPEN | — |
| FINDING-007 | OPEN | — |
| FINDING-008 | OPEN | — |
| FINDING-009 | OPEN | — |
| FINDING-010 | OPEN | — |
| FINDING-011 | OPEN | — |
| FINDING-012 | OPEN | — |
| FINDING-013 | OPEN | — |
| FINDING-014 | OPEN | — |
| FINDING-015 | FIXED 2026-10-03; the one-off KV clean-up is the maintainer's | `28769473`, PR #222 → `8ecb878f` |
| FINDING-016 | OPEN | — |
| FINDING-017 | OPEN | — |
| FINDING-018 | FIXED 2026-10-03 | `28769473`, PR #222 → `8ecb878f` |
| FINDING-019 | OPEN — runbook part done; presets-api part Sprint 3 | `d8d5e3e8` (runbook) |
| FINDING-020 | OPEN | — |
| FINDING-021 | OPEN | — |
| FINDING-022 | OPEN — discord-worker part fixed | `28769473`, PR #222 → `8ecb878f` |
| FINDING-023 | OPEN | — |
| FINDING-024 | OPEN | — |
| FINDING-025 | OPEN | — |
| FINDING-026 | OPEN | — |
| FINDING-027 | OPEN — discord-worker part fixed; secret rotated to 64 characters 2026-10-03; presets-api part Sprint 3 | `28769473`, PR #222 → `8ecb878f` |
| FINDING-028 | OPEN | — |
| FINDING-029 | OPEN | — |
| FINDING-030 | OPEN | — |
| FINDING-031 | OPEN | — |

## Next steps

Follow [REMEDIATION_PLAN.md](REMEDIATION_PLAN.md). The audit itself changed no source.

**§8 decisions (2026-10-03):**
- Every AMEND recommendation was accepted. FINDING-011 and FINDING-013 are fixed by code, so six AMENDs remain.
- FINDING-002 stays HIGH.
- FINDING-017 fails closed.

**Progress:**
- **Sprint 0:** FINDING-001 is fixed and live on beta (`61b7077b`, PR #221 merged as `b89629d9`; the `curl -sI` acceptance passed). The FINDING-019 runbook is in `d8d5e3e8`.
- **Sprint 1:** ✅ merged as `8ecb878f` (PR #222). The maintainer rotated the production `INTERNAL_WEBHOOK_SECRET` first.

**Publication hold:** lifted for FINDING-001. The repository is public and this folder still details findings that are not yet deployed, so publishing it is the maintainer's call.
