# Security audit — xivdyetools, whole monorepo (2026-10-26)

- **Branch/commit:** `claude/project-security-audit-3b5195` @ `13c386e5983fe58ff17ac08fb5712239feb2e696` (= `main`). Previous whole-repo audit: [2026-10-03-security](../2026-10-03-security/SECURITY_AUDIT_REPORT.md) @ `0ab33466` — 680 commits / 1,871 files since; plus the focused [2026-10-15 web-app .chara audit](../2026-10-15-web-app-security/SECURITY_AUDIT_REPORT.md).
- **Scope:** all 9 apps, 8 packages, CI / wrangler / GitHub repository settings, the four policy documents in all six languages (24 files), the new xivcharakit-backed `.chara` reader end to end (core 5.15.0, web-app 5.16.0, bot-logic 4.11.0 + discord-worker 5.9.0, api-worker `/v1/chara/*`), and the upstream XIVAuth build the oauth worker signs in through (`other-sources/XIVAuth` @ `a4e6693`).
- **Method:** Step 2 evidence ([collect.sh](evidence/scripts/collect.sh); gitleaks 8.30.1 installed this run, [provenance](evidence/gitleaks.md)); 46 reviewers — 38 in round 1 (34 per-unit and cross-cutting assignments incl. two regression sweeps, a diff-oriented pass over the 680 commits and five translation-meaning readers, plus a completeness critic that raised 4 gap assignments) and 8 second-pass reviewers on code round 1 had not read — each writing an `evidence/review-<key>.md`; 85 candidates merged into 73 groups; every MEDIUM/LOW group judged by an independent confirming verifier **and** an independent refuting verifier (third verifier on the 4 split votes), every INFO group by one verifier; one severity × exposure calibration pass; coordinator reconciliation ([final-catalog.json](evidence/final-catalog.json)); read-only live header probes, GET-only `gh api` reads, a browser visit to the production Harmony tool, and — at the maintainer's yes at the §8 gate — **read-only Cloudflare API queries** (GET/list calls, secret names only, aggregate D1 `COUNT`s; [evidence](evidence/live-state-cloudflare-2026-10-26.md)), whose three new items ([FINDING-054](findings/FINDING-054.md), [-055](findings/FINDING-055.md), [-056](findings/FINDING-056.md)) were graded by an independent Opus verifier. **No Fable agent and no advisor call was used**, per the maintainer's instruction; every verifier was Opus (`xivdye-verifier`), reviewers were Opus-high or Sonnet-medium `xivdye-worker`s.
- **Totals:** **56 findings — 0 CRITICAL, 0 HIGH, 1 MEDIUM, 31 LOW, 24 INFO.** No credential exposure, so no exposure-driven rotation. **Sprint 0 (act now): no exploitable-now item** — the plan's Sprint 0 holds only maintainer-only dashboard and settings actions, led by deleting the stale public dev worker ([FINDING-054](findings/FINDING-054.md)). 9 further groups were rejected on verification and 7 verified items are routed to other skills.
- **Source changes:** none. Only `docs/audits/2026-10-26-security/` was written.

## Severity × exposure

| Severity | INTERNET-UNAUTH | INTERNET-AUTH | INTERNAL | LOCAL | Total |
|---|---:|---:|---:|---:|---:|
| CRITICAL | 0 | 0 | 0 | 0 | 0 |
| HIGH | 0 | 0 | 0 | 0 | 0 |
| MEDIUM | 0 | 1 | 0 | 0 | 1 |
| LOW | 13 | 14 | 0 | 4 | 31 |
| INFO | 9 | 4 | 5 | 6 | 24 |
| **Total** | 22 | 19 | 5 | 10 | **56** |

Nothing in this audit is exploitable by an unauthenticated party to the detriment of another user. The most consequential item is a privacy-policy gap ([FINDING-001](findings/FINDING-001.md), graded MEDIUM by the skill's personal-data rule; the maintainer chose the code fix). The most visible new item is a stale dev api-worker that is still public on `workers.dev` because the repo's pin never reached the live script ([FINDING-054](findings/FINDING-054.md)). The rest are bounded hardening gaps, policy or UI text that no longer matches the code, and repository-settings residue. All 2026-10-03 and 2026-10-15 fixes still hold at HEAD except 2026-10-03/FINDING-023, which is still open ([FINDING-028](findings/FINDING-028.md)).

## Catalog

| ID | Title | Sev | Exposure | Deploy unit | Rotation |
|---|---|---|---|---|---|
| [FINDING-001](findings/FINDING-001.md) | Acting moderator's Discord username is written into persistent moderation-channel and submission-log posts, and neither privacy policy's list of post… | MEDIUM | INTERNET-AUTH | moderation-worker + discord-worker (policy te… | NONE |
| [FINDING-002](findings/FINDING-002.md) | api-worker reads XIVAPI search/Glasses bodies unbounded and caches item names with no length cap, control or bidi filtering (7-day cache; quadratic d… | LOW | INTERNET-UNAUTH | api-worker (primary); packages/core chara-gpo… | NONE |
| [FINDING-003](findings/FINDING-003.md) | Swatch 'Save character colors' names its local record after the .chara nickname or file name, and PRIVACY.md tells users to rename or delete that rec… | LOW | INTERNET-UNAUTH | web-app (code + PRIVACY.md and its 5 locale s… | NONE |
| [FINDING-004](findings/FINDING-004.md) | Per-IP /auth/* limiter keys on the full IPv6 address, so one /64 gets an unlimited number of independent buckets | LOW | INTERNET-UNAUTH | oauth (root cause in packages/worker-kit getC… | NONE |
| [FINDING-005](findings/FINDING-005.md) | No cache-miss upstream budget on /v1/chara/*; arbitrary canonical icon ?version= (and any unknown key) forces an XIVAPI call per request | LOW | INTERNET-UNAUTH | api-worker | NONE |
| [FINDING-006](findings/FINDING-006.md) | Sign-in modal says browsing has "no rate limit", but presets-api rate-limits every /api/* request to 100/min per IP | LOW | INTERNET-UNAUTH | web-app (policy copy); limiter lives in prese… | NONE |
| [FINDING-007](findings/FINDING-007.md) | fr policy says 'Effacer les palettes sauvegardées' deletes all 'palettes enregistrées', which the fr UI uses as its name for saved presets; the contr… | LOW | INTERNET-UNAUTH | web-app (PRIVACY.fr.md policy translation) | NONE |
| [FINDING-008](findings/FINDING-008.md) | Upstream XIVAuth email auto-merge attaches a new provider identity to the email-matched account and signs in without MFA, so oauth mints a JWT with t… | LOW | INTERNET-UNAUTH | gap (upstream XIVAuth a4e6693; impact lands i… | NONE |
| [FINDING-009](findings/FINDING-009.md) | Superseded Cloudflare Pages deployments and the v4-ui-migration branch alias still serve old web-app builds with weaker or no CSP | LOW | INTERNET-UNAUTH | web-app (Cloudflare Pages projects xiv-colore… | NONE |
| [FINDING-010](findings/FINDING-010.md) | Privacy policy says the .chara resolve request carries "a dozen small integers"; it carries up to 27 plus 12 slot labels | LOW | INTERNET-UNAUTH | web-app (policy text only) | NONE |
| [FINDING-011](findings/FINDING-011.md) | Privacy policy says the CSP allows nothing beyond the listed first-party hosts, but connect-src allows every *.xivdyetools.app subdomain | LOW | INTERNET-UNAUTH | web-app (policy) | NONE |
| [FINDING-012](findings/FINDING-012.md) | ToS appeal steps demand a Discord user ID that XIVAuth-only accounts do not have; PRIVACY's request route accepts the author name | LOW | INTERNET-UNAUTH | web-app (policy docs served as static TERMS_O… | NONE |
| [FINDING-013](findings/FINDING-013.md) | The ToS says the stored Discord name is always the display name, but oauth stores the username when there is no display name | LOW | INTERNET-UNAUTH | web-app (policy docs) | NONE |
| [FINDING-014](findings/FINDING-014.md) | /glamour embed's plain() leaves masked-link syntax in upstream item names and acquisition lines unescaped | LOW | INTERNET-AUTH | bot-logic + discord-worker | NONE |
| [FINDING-015](findings/FINDING-015.md) | Author-ban guard on approve/revert is a separate, non-atomic pre-read in moderation-worker; presets-api /status and /revert write approved with no au… | LOW | INTERNET-AUTH | moderation-worker + presets-api | NONE |
| [FINDING-016](findings/FINDING-016.md) | Tags and example_link are never content-moderated, so an approved preset can carry or gain arbitrary tag text without review or a daily cap; looping… | LOW | INTERNET-AUTH | presets-api | NONE |
| [FINDING-017](findings/FINDING-017.md) | /glamour has no tier of its own and spends one shared api-worker service key | LOW | INTERNET-AUTH | discord-worker + worker-kit (preset) + api-wo… | NONE |
| [FINDING-018](findings/FINDING-018.md) | POST /presets spends a Perspective call before reserving quota; a same-dye concurrent burst is charged one submission | LOW | INTERNET-AUTH | presets-api | NONE |
| [FINDING-019](findings/FINDING-019.md) | Preview-upload daily slot is refunded when the image-worker decode fails, so decode work is uncapped per day | LOW | INTERNET-AUTH | presets-api | NONE |
| [FINDING-020](findings/FINDING-020.md) | 16-bit PNG within the pixel cap overruns the isolate memory limit (pixel budget assumes 4 B/px) | LOW | INTERNET-AUTH | image-worker | NONE |
| [FINDING-021](findings/FINDING-021.md) | bot-logic sanitizeEmbedText leaves Discord <...> syntax live (channel, slash-command, emoji, timestamp) and omits bidi isolates, Arabic letter mark a… | LOW | INTERNET-AUTH | bot-logic (consumed by discord-worker, modera… | NONE |
| [FINDING-022](findings/FINDING-022.md) | Bot privacy policy §3 says a .chara file is read only for colors, dyes and equipment, but /swatch and /glamour also read the clan, gender and produci… | LOW | INTERNET-AUTH | discord-worker (policy) | NONE |
| [FINDING-023](findings/FINDING-023.md) | oauth never clears or re-checks a row's Discord link, so a Discord id once attached stays the presets-api identity after XIVAuth stops asserting it | LOW | INTERNET-AUTH | oauth | NONE |
| [FINDING-024](findings/FINDING-024.md) | /preset favorite list fans out up to 50 userless presets-api reads that skip both presets-api limiters | LOW | INTERNET-AUTH | discord-worker | NONE |
| [FINDING-025](findings/FINDING-025.md) | Ban keyed on one identity leaves the author's other-identity presets public and approvable | LOW | INTERNET-AUTH | moderation-worker | NONE |
| [FINDING-026](findings/FINDING-026.md) | PRIVACY.md 'browsing sends nothing about you' is false for signed-in viewers: opening a preset detail sends the user's JWT to GET /api/v1/votes/:id/c… | LOW | INTERNET-AUTH | web-app (policy) | NONE |
| [FINDING-027](findings/FINDING-027.md) | Pre-edit snapshot disclosure is broader than the code: a snapshot is taken only when the edited preset is approved | LOW | INTERNET-AUTH | web-app + discord-worker (policy text only; p… | NONE |
| [FINDING-028](findings/FINDING-028.md) | FINDING-023 still open: production and beta Discord bot tokens remain repository-scope Actions secrets 21 days after the deletion precondition was met | LOW | LOCAL | CI + repo settings | NONE |
| [FINDING-029](findings/FINDING-029.md) | ko/zh item-name tables built from unpinned Teamcraft staging head with no recorded commit, checksum or content gate | LOW | LOCAL | api-worker build-time data (item-names.{ko,zh… | NONE |
| [FINDING-030](findings/FINDING-030.md) | Beta bot's presets-api access rests on an unenforced "omit the bot secrets" convention, and DEPLOY_ENVIRONMENTS.md:284 contradicts it | INFO | LOCAL | cross-unit (discord-worker beta config + docs… | NONE |
| [FINDING-031](findings/FINDING-031.md) | vitepress>vite override floor '>=6.4.3 <7' leaves vite locked at 6.4.3; 5 open Dependabot alerts (1 high), dev-server only | LOW | LOCAL | CI + repo settings (api-worker docs dev tree:… | NONE |
| [FINDING-032](findings/FINDING-032.md) | oauth [env.development] inherits the production auth.xivdyetools.app custom-domain route | LOW | LOCAL | oauth (only oauth; every other wrangler.toml… | NONE |
| [FINDING-033](findings/FINDING-033.md) | de/fr web-app privacy policies narrow the .chara character-name never-clause from 'other people' to 'other players' | INFO | INTERNET-UNAUTH | web-app (policy translations de, fr) | NONE |
| [FINDING-034](findings/FINDING-034.md) | de preset.shotSlot caption omits the "not uploaded" assurance the other five locales carry | INFO | INTERNET-UNAUTH | web-app (locale de) | NONE |
| [FINDING-035](findings/FINDING-035.md) | Perspective sunset checklist omits both Terms of Service auto-publish sentences (web and bot), which go stale when the key is deleted (by 2026-12-31) | INFO | INTERNET-UNAUTH | repo docs (DEPRECATIONS.md) now; web-app + di… | NONE |
| [FINDING-036](findings/FINDING-036.md) | OAuth state is HMAC'd with JWT_SECRET (the JWT signing key) with no domain separation: latent cross-protocol risk, not exploitable today | INFO | INTERNET-UNAUTH | oauth | NONE |
| [FINDING-037](findings/FINDING-037.md) | presets-api GET /api/v1/presets `page` has no upper bound: Infinity / >int64 OFFSET reaches the D1 bind | INFO | INTERNET-UNAUTH | presets-api | NONE |
| [FINDING-038](findings/FINDING-038.md) | Telemetry blob8 'ver' is regex-validated, not allowlisted, so a sender can write about 10 free alphanumeric characters | INFO | INTERNET-UNAUTH | api-worker | NONE |
| [FINDING-039](findings/FINDING-039.md) | Public /webhooks/preset-submission has no failed-auth throttle or binding-only check (FINDING-027 optional hardening not done) | INFO | INTERNET-UNAUTH | discord-worker | NONE |
| [FINDING-040](findings/FINDING-040.md) | Message-component (button) interactions bypass the per-user rate limiter | INFO | INTERNET-AUTH | discord-worker | NONE |
| [FINDING-041](findings/FINDING-041.md) | Preset edit form renders preview_image_url without the https read-path guard (consistency hardening only) | INFO | INTERNET-AUTH | web-app | NONE |
| [FINDING-042](findings/FINDING-042.md) | JWT and V2 bot signatures accept non-canonical encodings (signature malleability, no exploitable consumer) | INFO | INTERNET-AUTH | auth | NONE |
| [FINDING-043](findings/FINDING-043.md) | Published SwatchResult.character still carries the raw, uploader-controlled TypeName as `producer` | INFO | INTERNET-AUTH | bot-logic | NONE |
| [FINDING-044](findings/FINDING-044.md) | Logger: a non-Error `error` argument skips key-name redaction (cookie, session_id, webhook_url, set_cookie, auth_header, nested keys) | INFO | INTERNAL | logger (published @xivdyetools/logger; consum… | NONE |
| [FINDING-045](findings/FINDING-045.md) | Page-side worker-answer validator accepts any 256-unit string as tribe, then casts it to SubRace for the swatch config and clan lookup (defense in de… | INFO | INTERNAL | web-app | NONE |
| [FINDING-046](findings/FINDING-046.md) | v2 bot signature binds URL pathname only; GET query string (status/search/sort/page/limit) is unsigned | INFO | INTERNAL | discord-worker | NONE |
| [FINDING-047](findings/FINDING-047.md) | Logger value-shape redaction misses Discord webhook / interaction-token URLs (hardening gap, no live leak path) | INFO | INTERNAL | logger | NONE |
| [FINDING-048](findings/FINDING-048.md) | Resolve-API response adopted without per-field shape validation (hardening only) | INFO | INTERNAL | web-app | NONE |
| [FINDING-049](findings/FINDING-049.md) | publish job grants id-token: write to every step, including pnpm install, turbo build and vitest runs of dev-tree code | INFO | LOCAL | CI + repo settings (publish-packages.yml, npm… | NONE |
| [FINDING-050](findings/FINDING-050.md) | GitHub secret scanning non-provider patterns and validity checks are disabled (settings real, benefit narrower than claimed) | INFO | LOCAL | CI + repo settings | NONE |
| [FINDING-051](findings/FINDING-051.md) | main branch protection still has enforce_admins and strict off after the 2026-10-03 remediation PRs it waited on merged | INFO | LOCAL | CI (GitHub repo settings) | NONE |
| [FINDING-052](findings/FINDING-052.md) | xivcharakit releases have no git tags; source traceability relies only on npm provenance | INFO | LOCAL | core (xivcharakit dependency) | NONE |
| [FINDING-053](findings/FINDING-053.md) | 30-day deletion and 'full data export' promises have no runbook enumerating the stores to purge | INFO | LOCAL | web-app + discord-worker (policy) / docs/oper… | NONE |
| [FINDING-054](findings/FINDING-054.md) | A stale api-worker dev script (deployed 2026-08-10) is still public on workers.dev; the repo's workers_dev = false pin never reached the live script | LOW | INTERNET-UNAUTH | api-worker (live script xivdyetools-api-worke… | NONE |
| [FINDING-055](findings/FINDING-055.md) | Zone xivdyetools.app has Always Use HTTPS off and minimum TLS 1.0: api., auth. and data. answer 200 over plaintext HTTP | INFO | INTERNET-UNAUTH | Cloudflare zone settings (dashboard) | NONE |
| [FINDING-056](findings/FINDING-056.md) | Two retired deploy units are still deployed: the xivdyetools-api-docs Pages project (public, 22 deployments) and the xivdyetools-universalis-proxy wo… | INFO | INTERNET-UNAUTH | Cloudflare account (api-worker docs, retired… | NONE |

## Pending rotation

No credential exposure was found. Gitleaks 8.30.1 reported no leaks in the tracked tree or in the 1,992 commits reachable from the remote refs; GitHub secret scanning reports 0 alerts; the 76 credential-shaped grep hits in [potential-secrets.txt](evidence/potential-secrets.txt) were classified by the config reviewer ([review-wrangler-secrets-config.md](evidence/review-wrangler-secrets-config.md)) and none is real.

| ID | Credential | Rotated? | Revoked? |
|---|---|---|---|
| none | — | n/a | n/a |

[FINDING-028](findings/FINDING-028.md) is a settings clean-up, not an exposure: delete the repository-scope copies of the production and beta bot tokens (every consuming job already reads the `production` / `beta` environment copy). Resetting the tokens is optional and the maintainer's call.

## Pending policy edits

Every row is a **six-file edit per document** (English + `.ja/.ko/.zh/.de/.fr`), all `Last updated` lines bumped to the same date, `policy-locale-parity.py` back to exit 0, and a laymans-changelog entry. Locale-JSON rows also need `pnpm --filter xivdyetools-web-app run validate:i18n` and the parity gates. **AMEND rows are new public commitments and need the maintainer's explicit yes at the §8 gate**, and must land no earlier than the code change they describe.

| ID | Document(s) | § | CORRECT/AMEND | Landed? |
|---|---|---|---|---|
| [FINDING-001](findings/FINDING-001.md) | bot `PRIVACY_POLICY.md`, web `PRIVACY.md` | §5 Discord row; "Posts in our Discord server" | **NONE** — §8 decision 2026-10-26: drop the moderator name from the posts (code fix); an AMEND only if the maintainer reverses this | n/a |
| [FINDING-003](findings/FINDING-003.md) | web `PRIVACY.md` | Character files (.chara) bullet 2 | CORRECT (replace "rename or delete the record") | no |
| [FINDING-006](findings/FINDING-006.md) | web `locales/*.json` `preset.gateBrowseNote` | — | CORRECT (UI copy, six locales) | no |
| [FINDING-007](findings/FINDING-007.md) | web `PRIVACY.fr.md` (and `PRIVACY.ja.md` / `.ko.md` where the same term collides) | What is stored on your device | CORRECT ("saved palettes" term collision) | no |
| [FINDING-010](findings/FINDING-010.md) | web `PRIVACY.md` | What leaves your device (.chara bullet) | CORRECT ("a dozen small integers") | no |
| [FINDING-011](findings/FINDING-011.md) | web `PRIVACY.md` | Network access | CORRECT the sentence, or narrow `connect-src` in `_headers` (maintainer decision) | no |
| [FINDING-012](findings/FINDING-012.md) | web `TERMS_OF_SERVICE.md` | Appeals and removal, step 3 | CORRECT | no |
| [FINDING-013](findings/FINDING-013.md) | web `TERMS_OF_SERVICE.md` | Accounts | CORRECT ("display name" → name, username as fallback) | no |
| [FINDING-022](findings/FINDING-022.md) | bot `PRIVACY_POLICY.md` | §3 Character Files, item 2 | CORRECT (add clan, gender, producing tool shown on the card) | no |
| [FINDING-026](findings/FINDING-026.md) | web `PRIVACY.md` | Network access, item 3 | **AMEND** (qualify "browsing sends nothing about you": signed-in viewers send the token) | no |
| [FINDING-027](findings/FINDING-027.md) | web `PRIVACY.md`, bot `PRIVACY_POLICY.md` | Community presets; previous-version snapshot wording | CORRECT (snapshots exist only for approved presets) | no |
| [FINDING-033](findings/FINDING-033.md) | web `PRIVACY.de.md`, `PRIVACY.fr.md` (+ `PRIVACY.ja.md`) | Character files (.chara) | CORRECT (translation: "other people") | no |
| [FINDING-034](findings/FINDING-034.md) | web `locales/de.json` `preset.shotSlot` | — | CORRECT (UI copy, one locale) | no |
| [FINDING-035](findings/FINDING-035.md) | web + bot `TERMS_OF_SERVICE.md` | Moderation (auto-publish sentences) | CORRECT **on the day the Perspective key is deleted (by 2026-12-31)** | no |

[FINDING-053](findings/FINDING-053.md) is a process gap (no deletion/export runbook), not a policy edit. The other 38 findings carry no policy field. A fixed-code resolution of a Step 3a case-1 finding makes the existing text true and needs no edit.

## Live state

At the maintainer's yes at the §8 gate (2026-10-26), live Cloudflare state was read through the API — GET/list calls, secret **names** only, aggregate D1 `COUNT`s, nothing written ([evidence](evidence/live-state-cloudflare-2026-10-26.md)). It settled most of what the repo could not show and added three findings ([FINDING-054](findings/FINDING-054.md), [-055](findings/FINDING-055.md), [-056](findings/FINDING-056.md)).

| Finding | Result (read 2026-10-26) | Still open |
|---|---|---|
| [FINDING-001](findings/FINDING-001.md) | `MODERATION_CHANNEL_ID` and `SUBMISSION_LOG_CHANNEL_ID` are configured on both bots, so the submission-log copy is live | Who can read those two channels (Discord permissions) |
| [FINDING-004](findings/FINDING-004.md) | IPv6 on, Pseudo IPv4 off: the precondition holds | Dashboard WAF and rate-limiting rules were not read |
| [FINDING-009](findings/FINDING-009.md) | 522 + 240 deployments retained (not three); `ecc7fb76` serves no CSP | — (bulk prune is the fix) |
| [FINDING-018](findings/FINDING-018.md) | `PERSPECTIVE_API_KEY` is set in production: reachable today | How strictly the native `RL_PUBLIC` binding is enforced ([FINDING-019](findings/FINDING-019.md)) |
| [FINDING-020](findings/FINDING-020.md) | — | How workerd enforces the 128 MiB isolate limit against wasm memory (measured in Node only) |
| [FINDING-023](findings/FINDING-023.md) | 19 users, 4 linked to both ids | A comparison of those 4 with XIVAuth's current links |
| [FINDING-025](findings/FINDING-025.md) | 16 approved presets by 7 authors, 1 UUID-keyed | Whether that author's linked id is among the other 6 (not run, to avoid reading identifiers) |
| [FINDING-028](findings/FINDING-028.md) | — | The repository-scope bot-token secrets (delete them); whether their values are still valid tokens (GitHub secret values are write-only) |
| [FINDING-030](findings/FINDING-030.md) | Beta bot holds only `DISCORD_PUBLIC_KEY` and `DISCORD_TOKEN`: **re-graded INFO** | — |
| [FINDING-032](findings/FINDING-032.md) | No `xivdyetools-oauth-dev` worker and no dev D1 exist: latent | — |
| [FINDING-054](findings/FINDING-054.md) / [-055](findings/FINDING-055.md) / [-056](findings/FINDING-056.md) | New: a stale public dev api-worker; zone Always Use HTTPS off and minimum TLS 1.0; two retired deploy units still deployed | — |

Also settled: the deployed D1 carries migrations 0012 and 0014 (the `content_revision` trigger and the `text_edit` quota kind), closing 2026-10-03/FINDING-031's open limit; the DNS records, custom domains and zone routes were checked and none is dangling.

## Evidence and validation

| Check | Result |
|---|---|
| `pnpm audit --prod` (CI gate) | 0 advisories ([json](evidence/pnpm-audit.json), [summary](evidence/pnpm-audit-summary.txt)) |
| `pnpm audit` (full tree) | 5 advisories, all dev-only `vite@6.4.3` via `vitepress` → [FINDING-031](findings/FINDING-031.md) ([json](evidence/pnpm-audit-full.json)) |
| Gitleaks v8.30.1, tree + history | tree: no leaks; remote refs (1,992 commits): no leaks; all local refs: 1 false positive on a local-only branch ([provenance](evidence/gitleaks.md)) |
| GitHub secret scanning / CI | 0 alerts ([json](evidence/github-secret-scanning-alerts.json)); CI green on `main` at HEAD ([json](evidence/ci-main-runs.json)) |
| Policy locale parity (mechanical) | PASS, 20 variants ([txt](evidence/policy-locale-parity.txt)) |
| Translation meaning (verifier-model readers, 5 languages × 4 documents) | no divergence in ja or zh; ko 1, de 2, fr 2 raised → 4 groups: 3 filed ([FINDING-007](findings/FINDING-007.md), [-033](findings/FINDING-033.md), [-034](findings/FINDING-034.md)), 1 rejected (the ko "nothing is transmitted" wording: English "Nothing is uploaded" is equally absolute) |
| Live headers (`curl -sI`, read-only) | production, beta, `xiv-colorexplorer.pages.dev`, `xivdyetools-beta.pages.dev`: CSP, HSTS, XFO, nosniff, Permissions-Policy all present and identical ([txt](evidence/live-headers.txt)); old hash/branch deployments: [txt](evidence/live-headers-old-deployments.txt) → [FINDING-009](findings/FINDING-009.md) |
| GitHub settings (GET-only `gh api`) | SHA pinning enforced, Dependabot alerts on (5 open, all dev-tree vite), `Secret scan (gitleaks)` required, bot tokens still repository-scope, `enforce_admins` / `strict` still off ([ci-supply-chain review](evidence/review-ci-supply-chain.md)) |
| Regression sweep | **no control regressed.** 2026-10-03 FINDING-001…031 and 2026-10-15 FINDING-001…003: all HOLDS except FINDING-023 (PARTIAL → [FINDING-028](findings/FINDING-028.md)), FINDING-024 (residual → [FINDING-051](findings/FINDING-051.md)) and FINDING-027 (optional hardening → [FINDING-039](findings/FINDING-039.md)); the 2026-09-15 and 2026-08-29 fix lists also hold ([review-regression-a.md](evidence/review-regression-a.md), [review-regression-b.md](evidence/review-regression-b.md)). Guard tests were identified by reading, not executed |
| Cloudflare (read-only API) | 16 workers, 4 D1 databases, 8 Pages projects, 12 DNS records and the zone routes and settings read; three new findings, one re-grade (FINDING-030), the deployed D1 schema confirmed ([evidence](evidence/live-state-cloudflare-2026-10-26.md), [captures](evidence/live-headers-http-and-retired.txt)) |
| Fan-out | 46 reviews, 85 candidates → 73 groups → 53 filed (merges and rejections below), 9 rejected, 7 routed; plus 3 filed from the live-state pass (56 total) ([workflow-verify-result.json](evidence/workflow-verify-result.json), [candidates.json](evidence/candidates.json), [candidate-groups.json](evidence/candidate-groups.json)) |
| Third-party dependency | `xivcharakit@0.1.0-beta.4`: exact pin, lockfile integrity equals the registry, SLSA provenance, no install hooks, no runtime dependencies, no eval / fs / process, `fetch` only in an XIVAPI client no workspace imports; hostile-input probes at the 8 KiB cap finished in < 6 ms ([review-r2-xivcharakit-source.md](evidence/review-r2-xivcharakit-source.md)); releases carry no git tags → [FINDING-052](findings/FINDING-052.md) |

## Positive controls

- **Origins:** production, beta and both `*.pages.dev` aliases serve the same CSP (`script-src 'self'`, `frame-ancestors 'none'`, first-party `connect-src`), HSTS preload, XFO DENY, nosniff and Permissions-Policy; 2026-10-03/FINDING-001 stays fixed on beta.
- **.chara reader:** `*.chara` extension and the 8 KiB cap are enforced before any read on web and bot (the bot checks declared and streamed bytes, https-only Discord-CDN allowlist, `redirect: 'manual'`, 10 s); the web Worker's messages are allowlist-validated and rebuilt in both directions, the Worker imports only the narrow `@xivdyetools/core/chara` subpath, and telemetry carries only `ok` plus an allowlisted producer. xivcharakit's reader enforces depth 32, 100k nodes, 64 KiB strings and null-prototype records itself.
- **api-worker `/v1/chara/resolve`:** integer-only body on a streamed 8 KiB cap, no XIVAPI query injection, fixed base and paths with redirects refused, cache identity includes version, schema and row shape.
- **Discord bots:** Ed25519 verified over a streamed 100 KB cap before any parse, 300 s freshness; every command and autocomplete rate-limited; `MODERATOR_IDS` gates every admin path; `custom_id`s parsed to UUID/snowflake before use; webhooks use constant-time compares and a 32-character production floor; every REST body defaults `allowed_mentions` to none.
- **Bot → presets-api:** v2 HMAC canonical string is length-prefixed and binds method, path, body hash, timestamp, nonce and identity; nonces single-use; 32-byte key floor; presets-api ignores `X-User-*` on the JWT path and calls `requireModerator` / `requireNotBanned` on the mutating routers.
- **presets-api:** every D1 statement is `prepare().bind()`; `content_revision` compare-and-set with a DB trigger on owner, status and revert writes; preview approvals bound to the exact key; Perspective fails closed with `doNotStore`.
- **oauth:** HMAC-signed expiring state, server-bound PKCE S256, one exact redirect + CORS allowlist, HS256-pinned 1 h JWTs with `jti` revocation that outlives `exp`.
- **Privacy:** the only two bot log lines carrying a user id are test-enforced; analytics blobs carry no option value, guild id or error text; telemetry is default-off, honors GPC, carries no identifier; every retention number in the bot policy (§8) matches a real TTL or purge job; the bot strips the `.chara` nickname at projection and never logs it.
- **CI and supply chain:** all 69 `uses:` lines SHA-pinned and `sha_pinning_required` on; `permissions: contents: read` everywhere; no `pull_request_target`; OIDC trusted publishing with provenance on all 7 packages; every wrangler pins `[observability] enabled = false` behind a CI gate; image-worker is binding-only and pinned by a config test.

## Rejected suspicions

Nine groups were rejected on verification, so the next audit does not re-chase them. Reviewers also rejected 351 further candidates with one-line reasons inside their `evidence/review-*.md` files (for example the unmeasured-component-rate-limit, interaction-replay, GitHub-webhook-secret-floor and unbounded-changelog-fetch suspicions).

- **G05 — Dev worker (ENVIRONMENT=development, production D1/R2) does not pin preview_urls = false, unlike api-worker/i…** — The config facts are accurate. presets-api wrangler.toml:16 and moderation-worker :17 set workers_dev = false with no preview_urls line, both bind the production D1 (and R2 / KV), and the tests pin only workers_dev (presets-api tests/wrangler-config.test.ts:43, moderation-worker :81). The exposure does not follow, though. In the installed wrangler 4.152.0, cli.js:165613-165614 sends preview_urls as undefined when th… Covered by: The 2026-10-03 security audit rejected this suspicion in docs/audits/2026-10-03-securi…
- **G16 — Invalid world/DC names cause uncharged upstream list fetches** — The code matches the claim: there is no onMiss at :197-208, failures are not cached, and coalescing is per isolate only (cached-fetch.ts:91-115, request-coalescer.ts). It adds no new capability, because the public GET /data-centers and /worlds routes (router.ts:344-399) call the same cachedFetch with the same cache keys and no limiter at all. Upstream is spent only when the caches are cold or Universalis is already… Covered by: Rejected in the 2026-10-03 security audit: docs/audits/2026-10-03-security/evidence/rev…
- **G24 — PRIVACY.md says single saved palettes and Swatch character colors cannot be deleted in-app, but the Collectio…** — Coordinator rejected, agreeing with the calibration pass over two CONFIRMED votes: the Collection Manager delete control is not reachable in the live v4 UI (production Harmony tool probed 2026-10-26: the Favorites panel has no Manage button, the dye-selector component that carried it is not rendered), so PRIVACY.md:59-62 is accurate. The false sentence is :36-40, filed under the Swatch character-save finding.
- **G28 — ko swatch.charaHint promises 'nothing is transmitted' where English says only 'Nothing is uploaded'** — The quoted strings are accurate (ko/ja/de/fr :1166 say "transmit/send", en/zh say "upload"), but the opt-in chara_parse beacon conflicts with the English "Nothing is uploaded" exactly as much, so the Korean does not widen the promise or differ in effect. The beacon carries no file content, name or identifier, and it is disclosed both on the opt-in toggle (ko.json:235 analyticsDesc names ".chara 불러오기") and in PRIVACY… Covered by: docs/audits/2026-10-03-security/SECURITY_AUDIT_REPORT.md Rejected suspicions, under tr…
- **G34 — presets-api production CORS still trusts the legacy pages.dev origin** — The entry is real (wrangler.toml:76, exact-match reflection at src/index.ts:120, credentials: true at :150), but it is not a dangling legacy origin. It is the subdomain of the live production Pages project (deploy-web-app.yml:76 `--project-name=xivdyetools`, comment at :84-88), so the takeover precondition is not met. Even after a takeover there is nothing to gain: auth is Bearer-only from the Authorization header (… Covered by: Prior audit evidence, not a report section. docs/audits/2026-10-03-security/evidence/r…
- **G38 — v5_saved_presets store (other authors' names, survives author deletion) missing from the web privacy policy's…** — The inventory half re-files a rejected suspicion from the 2026-10-03 audit: PRIVACY.md:50-54 covers the store as "your own saved work", and "Your browser's site-data controls clear all of it" is true. Per-preset unsave exists (saved-presets-service.ts:147-153). The deletion-section half describes how public publication works by design: viewers keep local copies of fields the author already made public, and PRIVACY.m… Covered by: docs/audits/2026-10-03-security/SECURITY_AUDIT_REPORT.md:131 (Rejected suspicions): "S…
- **G50 — Legacy parseCharaFile is still a published export without the facade's bounds and echoes input in errors** — The facts are accurate, but each one is a deliberate, documented result of the 2026-10-15 review. The byte cap belongs to the caller by design (chara-parser.ts:75-79, core CHANGELOG 5.14.0); that audit ruled no depth ceiling is needed (V8 JSON.parse handles 1M levels, and no code recurses over parsed values); and the 64-character quote limit (chara-parser.ts:259, describeValue :272) is the FINDING-002 fix itself. La… Covered by: docs/audits/2026-10-15-web-app-security/SECURITY_AUDIT_REPORT.md FINDING-002 remediati…
- **G57 — Extractor logs the uploaded image's file name to the browser console** — The web-app wrapper's warn() at apps/web-app/src/shared/logger.ts:159-164 only runs when isDev() is true, which is import.meta.env.DEV (lines 40-50). A production build therefore never prints the file name. The reviewer relied on the package preset's 'warn' production level (packages/logger/src/presets/browser.ts:92), which this wrapper deliberately skips for warn. No errorTracker or console forwarding exists in app… Covered by: Not covered by a prior audit entry. It is rejected on the dev-only guard at apps/web-a…
- **G73 — Third-party Teamcraft/XIVAPI strings enter acquisition.en.json without markup stripping** — The underlying fact is true: the builder writes `JSON.stringify(table)` at build-acquisition.ts:533/553 with no markup stripping. But every consumer escapes. The web-app renders the line only through textContent/input.value (chara-ui.ts:214 `el()`, glamour-sheet.ts:196 `preview.textContent`, :268 `field.value`), the Discord list escapes formatting via `plain()` (packages/bot-logic/src/commands/glamour.ts:384), the a… Covered by: 2026-10-03 security audit positive controls (SVG/embed sanitization); the sinks are gu…

## Informational items (not promoted to findings)

Verified, but not security defects; routed as handoffs to `deep-dive-analysis` / `documentation-audit`.

| Group | Item |
|---|---|
| G37 | BUG handoff (deep-dive-analysis): /glamour embed truncation math + unrecorded failed edit; not attacker-reachable |
| G44 | DEAD/DOC handoff: stoat-worker (parked) loads unused Upstash credentials and admin roster; environment-variables.md describes a fallback that does not exist |
| G48 | DOC handoff: worker-kit getClientIp JSDoc says X-Forwarded-For is trusted by default; the code defaults to false |
| G51 | BUILD handoff: bot-logic dist ships the chara test-fixture module (tsconfig.build.json exclude list) |
| G52 | DOC handoff (documentation-audit): docs/architecture/service-bindings.md shows an unsigned presets-api call and overstates binding scope |
| G66 | DOC handoff: stale Perspective-sunset comment in presets-api moderation-service.ts:212 (code queues every local pass as unscored) |
| G67 | BUG handoff: .chara label truncation can leave ill-formed UTF-16 (cosmetic U+FFFD in the web card only) |

## Recommendations

1. **Tie privacy copy to code with tests.** Thirteen findings here are policy or UI text that drifted from the code (003, 006, 007, 010–013, 022, 026, 027, 033–035). Assert every UI path, control name and number a policy quotes against the locale keys and constants it names, the way `privacy-copy-parity.test.ts` already does for one sentence.
2. **Clean third-party game text once, at the boundary.** One shared cleaner (length cap, control and bidi strip, whitespace collapse) in api-worker for XIVAPI names and the build scripts, with `sanitizeEmbedText` extended to `<...>` syntax and bidi isolates ([FINDING-002](findings/FINDING-002.md), [-014](findings/FINDING-014.md), [-021](findings/FINDING-021.md)).
3. **Key per-IP limiters on the IPv6 /64** in `getClientIp` (opt-in), so one residential prefix is one bucket ([FINDING-004](findings/FINDING-004.md)).
4. **Enforce the author ban server-side**, in the presets-api status and revert writes, and across both identities ([FINDING-015](findings/FINDING-015.md), [-025](findings/FINDING-025.md)).
5. **Charge cache misses, not hits, on `/v1/chara/*`** with a dedicated native limiter, and give `/glamour` its own command tier ([FINDING-005](findings/FINDING-005.md), [-017](findings/FINDING-017.md)).
6. **Pin every external data source in build scripts** to a commit SHA and record a checksum, as `build-acquisition.ts` already does ([FINDING-029](findings/FINDING-029.md)).
7. **Probe every live origin, including hash and branch `pages.dev` aliases and every `*.workers.dev` name, plus the zone's HTTPS settings,** in the smoke test, and prune superseded Pages deployments after each deploy ([FINDING-009](findings/FINDING-009.md), [-054](findings/FINDING-054.md), [-055](findings/FINDING-055.md)).
8. **Close the settings residue:** delete the repository-scope bot tokens, turn on `enforce_admins` and `strict`, raise the `vitepress>vite` floor to `>=6.4.5` ([FINDING-028](findings/FINDING-028.md), [-051](findings/FINDING-051.md), [-031](findings/FINDING-031.md)).

## Limits

Source / configuration audit plus read-only live probes: `HEAD` requests to the live origins, the superseded Pages deployments, the plain-HTTP API hosts and the `workers.dev` names; GET-only `gh api` calls; one browser visit to the production Harmony tool; and read-only Cloudflare API queries (GET/list, secret names only, aggregate D1 counts — see *Live state*). Not a penetration test; no live Worker interaction beyond those, no load tests, no row of personal data, no secret value and no Discord channel permission was read. Not read: Cloudflare WAF and rate-limiting rules, the account's other projects (`doyoulikethis-*`, `galatine-*`, `calendar-sync-worker`, `webp-converter`, `shaderfinder-webapp`, `xivcharakit-demo`), and GitHub secret values. Reviewers ran scratch probes and single test files only; the whole-monorepo gate was not run and guard tests were identified by reading, not executed. `image-worker` memory behavior (FINDING-020) was measured in Node, not workerd. The xivcharakit tarball was compared with its claimed source by file map and two files, not rebuilt byte for byte. The 2,000-commit `--all` gitleaks scan covers local refs only. The three live-state findings were graded by one verifier without a refuter, as INFO and LOW items.

## Remediation status

| ID | Status | Commit |
|---|---|---|
| FINDING-001 | OPEN | — |
| FINDING-002 | OPEN — core/SVG companions prepared; API outstanding | [Core evidence](../2026-10-26-xivcharakit-dead-code/evidence/remediation-core-2026-10-27.md); [SVG evidence](evidence/remediation-svg-2026-10-27.md) |
| FINDING-003 | OPEN | — |
| FINDING-004 | OPEN — opt-in worker-kit support prepared; consumer adoption/deployment pending | [Implementation evidence](evidence/remediation-worker-kit-2026-10-27.md) |
| FINDING-005 | OPEN | — |
| FINDING-006 | OPEN | — |
| FINDING-007 | OPEN | — |
| FINDING-008 | OPEN — private encrypted report sent 2026-10-27; upstream triage pending | Sent-copy recipient and attachment verified; private receipt outside Git; no mitigation applied |
| FINDING-009 | PARTIAL 2026-10-26 — one-off history/alias cleanup complete; automated retention remains in R-CI | [760 deletion receipts and preservation verification](evidence/remediation-finding-009-2026-10-26.md) (no code commit) |
| FINDING-010 | OPEN | — |
| FINDING-011 | OPEN | — |
| FINDING-012 | OPEN | — |
| FINDING-013 | OPEN | — |
| FINDING-014 | OPEN | — |
| FINDING-015 | OPEN | — |
| FINDING-016 | OPEN | — |
| FINDING-017 | OPEN — shared preset and Discord RL_5 regression prepared; deployed verification pending | [Implementation evidence](evidence/remediation-worker-kit-2026-10-27.md) |
| FINDING-018 | OPEN | — |
| FINDING-019 | OPEN | — |
| FINDING-020 | OPEN | — |
| FINDING-021 | OPEN | — |
| FINDING-022 | OPEN | — |
| FINDING-023 | OPEN | — |
| FINDING-024 | OPEN | — |
| FINDING-025 | OPEN | — |
| FINDING-026 | OPEN | — |
| FINDING-027 | OPEN | — |
| FINDING-028 | FIXED 2026-10-26 | Repository secret copies deleted; environment copies preserved; [verification](evidence/remediation-finding-028-2026-10-26.md) (no code commit) |
| FINDING-029 | OPEN | — |
| FINDING-030 | OPEN | — |
| FINDING-031 | OPEN | — |
| FINDING-032 | OPEN | — |
| FINDING-033 | OPEN | — |
| FINDING-034 | OPEN | — |
| FINDING-035 | FIXED 2026-10-27 — checklist omission closed; actual policy changes remain scheduled for key deletion | [Perspective-sunset checklist](../../../DEPRECATIONS.md) (documentation only) |
| FINDING-036 | OPEN | — |
| FINDING-037 | OPEN | — |
| FINDING-038 | OPEN | — |
| FINDING-039 | OPEN | — |
| FINDING-040 | OPEN | — |
| FINDING-041 | OPEN | — |
| FINDING-042 | OPEN | — |
| FINDING-043 | OPEN | — |
| FINDING-044 | OPEN | — |
| FINDING-045 | OPEN | — |
| FINDING-046 | OPEN | — |
| FINDING-047 | OPEN | — |
| FINDING-048 | OPEN | — |
| FINDING-049 | OPEN | — |
| FINDING-050 | OPEN — BLOCKED 2026-10-26 on feature eligibility; both options remain disabled | [Attempt and verification](evidence/remediation-finding-050-2026-10-26.md); no accepted deferral |
| FINDING-051 | FIXED 2026-10-26 — enforce_admins and strict enabled | [Live settings and preservation verification](evidence/remediation-finding-051-2026-10-26.md) (no code commit) |
| FINDING-052 | FIXED 2026-10-27 — four published library releases have verified source tags; registry stub excluded | [Version/commit mapping and remote verification](evidence/remediation-finding-052-2026-10-27.md) |
| FINDING-053 | OPEN | — |
| FINDING-054 | FIXED 2026-10-26 | Live Cloudflare deletion; [verification](evidence/remediation-finding-054-2026-10-26.md) (no code commit) |
| FINDING-055 | FIXED 2026-10-26 (zone settings) | Live Cloudflare settings; [verification](evidence/remediation-finding-055-2026-10-26.md) (no code commit); HSTS-comment wording follows in app sprints |
| FINDING-056 | FIXED 2026-10-26 | Live Cloudflare project and worker deletions; [verification](evidence/remediation-finding-056-2026-10-26.md) (no code commit) |

## Next steps

Hand off to `remediation-planner` ([REMEDIATION_PLAN.md](REMEDIATION_PLAN.md)) and take the §8 confirmation gate before any fix. The audit itself changed no source.
