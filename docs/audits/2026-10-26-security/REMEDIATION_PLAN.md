# Remediation Plan — 2026-10-26
**Sources:** [2026-10-26-security](SECURITY_AUDIT_REPORT.md) — 56 findings (1 MEDIUM, 31 LOW, 24 INFO) · **Status basis:** 56 total — 0 fixed, 56 outstanding, 0 superseded (three carry forward a 2026-10-03 ID, see *Superseded findings*), 0 KEEP, 0 need rotation
**Ordering:** 1. one deploy unit per sprint (a package change is one publish sprint, then one sprint per consumer deploy) 2. P0 first — there is none 3. Severity × Exposure, then hardening 4. terminal work last (CI and repo settings, docs and process)

Tiers: **P2** = the MEDIUM, plus LOW findings with a reachable code path or a false statement users read. **P3** = hardening, INFO, LOCAL and process items. Nothing here is P0 or P1: no unauthenticated party can harm another user, and no secret is exposed.

**Merging to `main` is the deploy.** Bare `wrangler deploy` is production on `oauth` and the live beta on `og-worker` / `discord-worker`. Every sprint below ends with the unit gate `pnpm turbo run build type-check lint test --filter=<unit>...` and, before a merge, the whole graph. Policy edits are six-file edits (English + `.ja .ko .zh .de .fr`, every `Last updated` line the same date, `policy-locale-parity.py` back to exit 0, laymans-changelog entry); AMEND rows need the maintainer's yes and never land before the code they describe.

## Decisions needed at the §8 gate

| # | Finding | Decision |
|---|---|---|
| 1 | [FINDING-001](findings/FINDING-001.md) | **DECIDED 2026-10-26:** drop the moderator username from the posts (code fix, no policy change); MEDIUM kept. An AMEND (12 files) only if you reverse this. |
| 2 | [FINDING-003](findings/FINDING-003.md) | Correct PRIVACY.md to say no per-record rename/delete exists, or restore a per-record control in v4. Independently: stop defaulting the Swatch character-save name to the .chara nickname. |
| 3 | [FINDING-011](findings/FINDING-011.md) | Narrow `connect-src` to the four named hosts (policy becomes true) or reword the policy. |
| 4 | [FINDING-016](findings/FINDING-016.md), [-019](findings/FINDING-019.md), [-040](findings/FINDING-040.md) | Product calls: moderate tags and example links; keep or drop the preview-slot refund on decode failure; add a button rate-limit tier or record it in `security-trade-offs.md`. |
| 5 | [FINDING-023](findings/FINDING-023.md), [-025](findings/FINDING-025.md) | Whether oauth detaches a Discord id XIVAuth stops asserting, and how the ban learns an author's other identity (needs a presets-api or oauth lookup). |
| 6 | [FINDING-026](findings/FINDING-026.md) | **AMEND** web PRIVACY.md item 3: signed-in viewers send the token when opening a preset. |
| 7 | Live-state checks | **DONE 2026-10-26** with your yes: read-only Cloudflare queries settled most items and added FINDING-054, -055 and -056 (report § *Live state*). The still-open checks are listed there. |
| 8 | Plan gate | **DECIDED 2026-10-26:** review first, start nothing. No sprint, bump, publish or deploy runs until you say so. |

## Sprint 0 — Prerequisites and maintainer-only actions (no deploy; nothing exploitable now)
No finding is exploitable now by the skill's rule and no credential is exposed, so there is nothing to rotate. These items need the maintainer's Cloudflare dashboard or GitHub settings, not a code change, and can run in parallel with Sprint 1; do FINDING-054 first (a deletion, nothing depends on it).

| ID | Source | Tier | Action |
|---|---|---|---|
| [FINDING-054](findings/FINDING-054.md) | security | P2 · LOW / INTERNET-UNAUTH | Delete the worker `xivdyetools-api-worker-dev` (stale 2026-08-10 build, public on `workers.dev`), or redeploy it once so wrangler applies `workers_dev = false`; tick `OPEN_ITEMS.md:74-75` with the HEAD probe. |
| [FINDING-055](findings/FINDING-055.md) | security | P3 · INFO / INTERNET-UNAUTH | Zone `xivdyetools.app` → SSL/TLS → Edge Certificates: **Always Use HTTPS** on, **Minimum TLS Version** 1.2. |
| [FINDING-056](findings/FINDING-056.md) | security | P3 · INFO / INTERNET-UNAUTH | Delete the retired Pages project `xivdyetools-api-docs` and the retired worker `xivdyetools-universalis-proxy`; tick `DEPRECATIONS.md:162,200` and `OPEN_ITEMS.md` §2. |
| [FINDING-028](findings/FINDING-028.md) | security | P3 · LOW / LOCAL | `gh secret delete` the repository-scope `DISCORD_TOKEN`, `MODERATION_DISCORD_TOKEN`, `BETA_DISCORD_TOKEN`, `BETA_DISCORD_GUILD_ID` (the environment copies already exist and every consuming job declares `environment:`); check off FINDING-023 in `docs/operations/OPEN_ITEMS.md`. Optional token reset. |
| [FINDING-009](findings/FINDING-009.md) | security | P2 · LOW / INTERNET-UNAUTH | Bulk-delete the superseded Pages deployments (522 in `xivdyetools`, 240 in `xivdyetools-beta`, each at its own `<hash>.pages.dev` host; the `ecc7fb76` beta deployment serves no CSP, XFO or HSTS) and the `v4-ui-migration` alias, keeping the current production and beta deployments. Add a retention step to `deploy-web-app*.yml` in Sprint 8. |
| [FINDING-008](findings/FINDING-008.md) | security | P3 · LOW / INTERNET-UNAUTH | Report upstream to XIVAuth (MFA or owner confirmation on the email auto-merge path); decide whether oauth narrows its side (Sprint 6). |
| [FINDING-035](findings/FINDING-035.md) | security | P3 · INFO / INTERNET-UNAUTH | **Dated: before 2026-12-31.** Add both Terms-of-Service auto-publish sentences to the `DEPRECATIONS.md` Perspective-sunset checklist (doc-only); the six-file CORRECTs land on key-deletion day. |
| [FINDING-050](findings/FINDING-050.md) | security | P3 · INFO / LOCAL | Enable secret-scanning non-provider patterns and validity checks, or record the choice. |
| [FINDING-051](findings/FINDING-051.md) | security | P3 · INFO / LOCAL | Turn on `enforce_admins` and `strict` on `main` now that the 2026-10-03 remediation PRs merged, or record the deferral. |
| [FINDING-052](findings/FINDING-052.md) | security | P3 · INFO / LOCAL | Tag the `xivcharakit` releases in the XIVCharaKit repository (your own repo) so each npm version maps to a commit. |

The live-state checks that decided later sprints' grades are done (report § *Live state*); [FINDING-030](findings/FINDING-030.md) is now INFO (Sprint 14) and [FINDING-004](findings/FINDING-004.md)'s precondition is confirmed (Sprint 1). Still open for you: whether the 4 users linked to both ids are stale ([FINDING-023](findings/FINDING-023.md)) and the Discord channel permissions ([FINDING-001](findings/FINDING-001.md)).
**Ends with:** the settings changes themselves, then `gh api` GET to confirm; the `DEPRECATIONS.md` edit rides a docs-only PR.

## Sprint 1 — worker-kit (publish): IPv6 /64 keying and the /glamour tier
Anchor: [FINDING-004](findings/FINDING-004.md). One additive release; the consumers adopt it in Sprints 3, 6 and 7. **Review lens: verifier** (rate limiting).

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-004](findings/FINDING-004.md) | security | LOW / INTERNET-UNAUTH · P2 | `getClientIp` (opt-in option): collapse IPv6 to its /64 (expand `::`, keep four hextets), leave IPv4 alone; test that two addresses in one /64 share a key. |
| [FINDING-017](findings/FINDING-017.md) | security | LOW / INTERNET-AUTH · P2 | Add a `glamour` entry to `DISCORD_COMMAND_LIMITS` (about 5/min on the existing `RL_5` binding); discord-worker wires it in Sprint 5. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/worker-kit...` → bump `packages/worker-kit/package.json` (MINOR, additive) and the CHANGELOG → merge → Actions → "Publish Packages to npm" → `@xivdyetools/worker-kit`.

## Sprint 2 — bot-logic (publish): bot-voiced text sanitizers
Anchor: [FINDING-021](findings/FINDING-021.md). Consumed by discord-worker, moderation-worker and (parked) stoat-worker.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-021](findings/FINDING-021.md) | security | LOW / INTERNET-AUTH · P2 | Add `<` to `MARKDOWN_SPECIALS` (after `defuseMentions`), add U+061C, U+2066–2069 and the tag block to `INVISIBLE`; mirror in stoat-worker's copy. Tests for `<#id>`, `</cmd:id>`, `<:e:id>`, `<t:0>`, `<id:customize>`. |
| [FINDING-014](findings/FINDING-014.md) | security | LOW / INTERNET-AUTH · P2 | `/glamour` `plain()`: escape `[` `]`, defuse mention/timestamp tokens, collapse CR/LF (or route through `sanitizeEmbedText`). |
| [FINDING-043](findings/FINDING-043.md) | security | INFO / INTERNET-AUTH · P3 | Drop the raw `TypeName` from the published `SwatchResult.character` (keep the allowlisted token). |

**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/bot-logic...` → bump (MINOR; a type change on `SwatchResult.character` is MAJOR for npm consumers — check `npm view @xivdyetools/bot-logic version` first) → merge → Actions publish `@xivdyetools/bot-logic`.

## Sprint 3 — presets-api: server-side ban, tag moderation, quota order
Anchor: [FINDING-016](findings/FINDING-016.md). Deploy: production via `deploy-presets-api.yml`. No migration is expected; if a migration is added, apply it by hand with `wrangler d1 execute --file`, never `d1 migrations apply`.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-015](findings/FINDING-015.md) | security | LOW / INTERNET-AUTH · P2 | Add `AND NOT EXISTS (…banned_users…)` to the `prepareStatusUpdate` and `prepareRevert` WHERE clauses so the ban is the server's guard (moderation-worker's pre-check stays as the friendly message). |
| [FINDING-016](findings/FINDING-016.md) | security | LOW / INTERNET-AUTH · P2 | Run tags (joined) and `example_link` through `moderateContent` on submit and on change; count a tag/link change as a text edit for the `text_edit` quota and the approved→pending flip. *(decision 4)* |
| [FINDING-018](findings/FINDING-018.md) | security | LOW / INTERNET-AUTH · P2 | `reserveDailyEvent('submission')` before `moderateContent` (reserve-then-act); correct `security-trade-offs.md:309`. May lapse with the Perspective key — decide before the 2026-12-31 sunset. |
| [FINDING-019](findings/FINDING-019.md) | security | LOW / INTERNET-AUTH · P2 | Keep the `preview_upload` slot when the image-worker decode fails, or count decode failures as their own capped kind. *(decision 4)* |
| [FINDING-037](findings/FINDING-037.md) | security | INFO / INTERNET-UNAUTH · P3 | Clamp `page` to a sane maximum before computing the OFFSET. |

Also adopt Sprint 1's `/64` option in the presets-api IP limiter. **Review lens: verifier** (authorization and rate limiting).
**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api...` → merge → `deploy-presets-api.yml` (production, `--env production`).

## Sprint 4 — moderation-worker: moderator name, ban across identities
Needs Sprints 2 and 3 deployed first. Deploy: production via `deploy-moderation-worker.yml`.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-001](findings/FINDING-001.md) | security | MEDIUM / INTERNET-AUTH · P2 | *(decided 2026-10-26)* Attribute decisions through `moderation_log` and drop the moderator username from the moderation-channel and submission-log posts, the ban post and discord-worker's preview-image post (the discord-worker file changes in Sprint 5); update the `previewImage.approvedFooter` / `rejectedFooter` keys and tests; no policy edit. |
| [FINDING-025](findings/FINDING-025.md) | security | LOW / INTERNET-AUTH · P2 | Ask presets-api or oauth for the author's linked identities and hide and match both on ban; or show the moderator every id sharing the author name. *(decision 5)* |

The moderation-worker half of [FINDING-015](findings/FINDING-015.md) needs no change beyond keeping its pre-check. Consume the Sprint 1 and 2 releases.
**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker...` → merge → `deploy-moderation-worker.yml` (production).

## Sprint 5 — discord-worker: tiers, throttle, bot policy
Consumes Sprints 1 and 2. Deploy: `deploy:production` via `deploy-discord-worker.yml`; `register-commands` runs in CI on merge (no command shape changes here). The six-file bot-policy edit rides this sprint.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-022](findings/FINDING-022.md) | security | LOW / INTERNET-AUTH · P2 | CORRECT `PRIVACY_POLICY.md` §3 Character Files item 2: the card also shows clan, gender and the producing tool. Six files; same commit as the policy half of [FINDING-027](findings/FINDING-027.md). |
| [FINDING-024](findings/FINDING-024.md) | security | LOW / INTERNET-AUTH · P2 | `/preset favorite list`: render from the stored `{id,name}` entries or one batched read; otherwise cap concurrency and send the acting user id so presets-api's per-user limiter counts it. |
| [FINDING-040](findings/FINDING-040.md) | security | INFO / INTERNET-AUTH · P3 | Add a cheap `button` tier before `trackButtonClick`, or record the Analytics-Engine-only effect in `security-trade-offs.md` *(decision 4)*. |
| [FINDING-039](findings/FINDING-039.md) | security | INFO / INTERNET-UNAUTH · P3 | `/webhooks/preset-submission`: failed-auth throttle (or binding-only check) before the bearer compare. |

Wire the `glamour` tier from Sprint 1; drop the moderator name from `preview-image.ts` (decision 1, decided).
**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-discord-worker...` → merge → `deploy-discord-worker.yml` (production). Bare `deploy` is the beta bot.

## Sprint 6 — oauth: identity link, dev env, state separation
**Bare `wrangler deploy` IS production here and merging deploys it. Review lens: verifier** (authentication, tokens).

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-023](findings/FINDING-023.md) | security | LOW / INTERNET-AUTH · P2 | On XIVAuth sign-in, when the row's `discord_id` is set but upstream no longer asserts it, detach the XIVAuth link onto a fresh row instead of minting the stale id; keep the Discord-sign-in lookup. Check production D1 first (Sprint 0). *(decision 5)* |
| [FINDING-032](findings/FINDING-032.md) | security | LOW / LOCAL · P3 | `[env.development]`: add `routes = []` and `workers_dev = false` (or an explicit dev route); extend `wrangler-config.test.ts`. |
| [FINDING-036](findings/FINDING-036.md) | security | INFO / INTERNET-UNAUTH · P3 | Domain-separate the state HMAC from the JWT signing key (prefix or derived subkey) with a migration window for in-flight states. |

Adopt Sprint 1's `/64` option in the oauth `/auth/*` limiter. Optionally narrow the upstream email-merge impact ([FINDING-008](findings/FINDING-008.md)) by re-verifying the link on sign-in.
**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-oauth-worker...` → merge → deploy (production, same command).

## Sprint 7 — api-worker: XIVAPI bounds, cache-miss budget
Deploy: production via `deploy-api-worker.yml`. Consumes Sprint 1.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-002](findings/FINDING-002.md) | security | LOW / INTERNET-UNAUTH · P2 | Read the search and Glasses bodies with the existing bounded reader (about 2 MiB / 32 KiB), map oversize to `UpstreamUnavailableError`; in `cleanName` strip C0/C1 controls and bidi, collapse whitespace, cap at about 128 code points before caching; same cleaner in the build scripts. The two quadratic sinks (core `chara-gposers.ts:120`, svg `fitText`) are hardened in Sprint 12. |
| [FINDING-005](findings/FINDING-005.md) | security | LOW / INTERNET-UNAUTH · P2 | Charge only cache misses on `/v1/chara/*` to a dedicated per-IP native limiter (mirror the Universalis `onMiss`, with a 20× service key for discord-worker); accept `?version=` only when it matches the discovered/pinned context. |
| [FINDING-029](findings/FINDING-029.md) | security | LOW / LOCAL · P3 | Resolve the Teamcraft staging head to a SHA as `build-acquisition.ts` does, record it with a sha256 per file in `meta.sources`; fail instead of falling back to `master`. |
| [FINDING-038](findings/FINDING-038.md) | security | INFO / INTERNET-UNAUTH · P3 | Allowlist the telemetry `ver` field or drop the prerelease suffix. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker...` → merge → `deploy-api-worker.yml` (production).

## Sprint 8 — web-app: policy and UI copy, validators
The owner of `PRIVACY.md` and `TERMS_OF_SERVICE.md` (and the locale JSON). One six-file policy commit per document plus the locale keys. Deploy: merge to `main` → `deploy-web-app.yml` (bundle budget + smoke test); beta follows `deploy-web-app-beta.yml`. Add the Pages prune step from Sprint 0 and a live-origin probe (including hash/branch aliases) to the smoke test.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-003](findings/FINDING-003.md) | security | LOW / INTERNET-UNAUTH · P2 | Name the Swatch character record with the localized default or add an empty name field; CORRECT PRIVACY.md:36-40 (six files). *(decision 2)* |
| [FINDING-006](findings/FINDING-006.md) | security | LOW / INTERNET-UNAUTH · P2 | Reword `preset.gateBrowseNote` in all six `locales/*.json`; run `validate:i18n`. |
| [FINDING-007](findings/FINDING-007.md) | security | LOW / INTERNET-UNAUTH · P2 | CORRECT the "saved palettes" term collision in `PRIVACY.fr.md` (and ja/ko where it collides): say saved community presets are not cleared by that control. |
| [FINDING-010](findings/FINDING-010.md) | security | LOW / INTERNET-UNAUTH · P2 | CORRECT "a dozen small integers" (up to 27 plus 12 slot names). |
| [FINDING-011](findings/FINDING-011.md) | security | LOW / INTERNET-UNAUTH · P2 | Narrow `connect-src` to the named hosts, or CORRECT the sentence. *(decision 3)* |
| [FINDING-012](findings/FINDING-012.md) | security | LOW / INTERNET-UNAUTH · P2 | CORRECT Terms "Appeals and removal" step 3 so XIVAuth-only accounts can follow it. |
| [FINDING-013](findings/FINDING-013.md) | security | LOW / INTERNET-UNAUTH · P2 | CORRECT Terms "Accounts": display name, with the username as the fallback. |
| [FINDING-026](findings/FINDING-026.md) | security | LOW / INTERNET-AUTH · P2 | **AMEND** PRIVACY.md Network access item 3: browsing while signed out sends nothing; signed in, opening a preset sends the token to check the vote. *(decision 6)* Optionally defer the check. |
| [FINDING-027](findings/FINDING-027.md) | security | LOW / INTERNET-AUTH · P2 | CORRECT the previous-version-snapshot wording (approved presets only) in web PRIVACY.md; the bot policy half rides Sprint 5's commit. |
| [FINDING-033](findings/FINDING-033.md) | security | INFO / INTERNET-UNAUTH · P3 | Translation fix: "other people" in `PRIVACY.de.md` and `PRIVACY.fr.md` (and ja). |
| [FINDING-034](findings/FINDING-034.md) | security | INFO / INTERNET-UNAUTH · P3 | Restore the "not uploaded" assurance in `de.json` `preset.shotSlot`. |
| [FINDING-041](findings/FINDING-041.md) | security | INFO / INTERNET-AUTH · P3 | Apply `sanitizePreviewImageUrl` in `preset-edit-form.ts`. |
| [FINDING-045](findings/FINDING-045.md) | security | INFO / INTERNAL · P3 | Validate tribe against the clan list in `chara-inspection-protocol.ts` before casting to `SubRace`. |
| [FINDING-048](findings/FINDING-048.md) | security | INFO / INTERNAL · P3 | Field-validate the `/v1/chara/resolve` response before it reaches CSS `url()`, link builders and `Intl.ListFormat`. |

Decision 1 was "drop the name", so no "Posts in our Discord server" edit is needed. Re-run the CJK subset scripts only if a locale string touches a glyph the subsets lack.
**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app...` and `pnpm --filter xivdyetools-web-app run build:check`, `pnpm --filter xivdyetools-web-app run validate:i18n`, `policy-locale-parity.py` exit 0 → merge → `deploy-web-app.yml`.

## Sprint 9 — image-worker
Deploy: production via `deploy-image-worker.yml`; binding-only.

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-020](findings/FINDING-020.md) | security | LOW / INTERNET-AUTH · P2 | Read the PNG IHDR bit depth and colour type in `dimensions.ts`; refuse 16-bit input or charge it a 2× factor against the pixel budget; re-measure the peak (8-bit at the cap is already about 110 MiB) and confirm against workerd. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-image-worker...` → merge → `deploy-image-worker.yml`.

## Sprint 10 — logger (publish): redaction gaps
**Review lens: verifier** (secret redaction).

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-044](findings/FINDING-044.md) | security | INFO / INTERNAL · P3 | Run a non-Error `error` object through `redactSensitiveFields` before `safeStringify`; fix the five context-as-error call sites (`logger.error(msg, undefined, ctx)`). |
| [FINDING-047](findings/FINDING-047.md) | security | INFO / INTERNAL · P3 | Add Discord webhook and interaction-token URL shapes to the value-shape and sanitize rules. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/logger...` → bump (MINOR) → merge → Actions publish `@xivdyetools/logger`; consumers pick it up at their next deploy.

## Sprint 11 — auth (publish): canonical signature encoding
**Review lens: verifier** (signature checks).

| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-042](findings/FINDING-042.md) | security | INFO / INTERNET-AUTH · P3 | `base64UrlDecodeBytes` for JWT and V2 signature segments: reject whitespace, padding and non-zero trailing bits (re-encode and compare). |

**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/auth...` → bump → merge → Actions publish `@xivdyetools/auth`.

## Sprint 12 — core and svg (publish): quadratic sinks
Defence in depth for [FINDING-002](findings/FINDING-002.md) (tracked in Sprint 7): rewrite `chara-gposers.ts:120` `text()` without the leading `\s*` backtracking, and make svg `fitText` binary-search its cut point. No new finding ID.
**Ends with:** `pnpm turbo run build type-check lint test --filter=@xivdyetools/core...` then `--filter=@xivdyetools/svg...` → bump each → merge → Actions publish `core`, then `svg`.

## Sprint 13 — CI and repository (terminal, hardening)
| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-031](findings/FINDING-031.md) | security | LOW / LOCAL · P3 | Raise the override to `'vitepress>vite': '>=6.4.5 <7'`, `pnpm install`, confirm Dependabot alerts #13–#17 close; update the stale FINDING-036 comment. |
| [FINDING-049](findings/FINDING-049.md) | security | INFO / LOCAL · P3 | `publish-packages.yml`: grant `id-token: write` only to the job (or step) that runs `pnpm publish`; build and test in a job without it. |

**Ends with:** `pnpm turbo run build type-check lint test`, `pnpm test:scripts`, `pnpm dead-code:check` → merge (CI-only; no deploy).

## Sprint 14 — docs and process (terminal)
| ID | Source | Sev/Pri | Item |
|---|---|---|---|
| [FINDING-030](findings/FINDING-030.md) | security | INFO / LOCAL · P3 | The live check found no signing secret on `-dev`. Correct `DEPLOY_ENVIRONMENTS.md:283-284` and `:324` and the discord-worker `wrangler.toml:92-96` comment to say `BOT_API_SECRET` / `BOT_SIGNING_SECRET` must NOT be set on `-dev`; reword the "writes a genuine row" residual-risk line. |
| [FINDING-046](findings/FINDING-046.md) | security | INFO / INTERNAL · P3 | Decide: record "v2 signature binds the path, not the query" in `security-trade-offs.md`, or sign the query (a coordinated `auth` + three-app change). |
| [FINDING-053](findings/FINDING-053.md) | security | INFO / LOCAL · P3 | Add a deletion-and-export runbook under `docs/operations/` listing every per-user store (D1 tables, KV prefixes, R2 objects, the web and bot stores) the 30-day promises cover. |

**Ends with:** `pnpm docs:check-versions` and `pnpm docs:check-links` → merge (docs-only).

## Superseded findings
| ID | Superseded by | Why |
|---|---|---|
| 2026-10-03-security/FINDING-023 | [FINDING-028](findings/FINDING-028.md) | Carried forward under a new ID, still open; the regression sweep verdict is PARTIAL |
| 2026-10-03-security/FINDING-024 | [FINDING-051](findings/FINDING-051.md) | Residual (`enforce_admins`, `strict`) after its precondition PRs merged |
| 2026-10-03-security/FINDING-027 | [FINDING-039](findings/FINDING-039.md) | Optional hardening (failed-auth throttle) not done |

## KEEP register
| ID | Item | Reason | Revisit trigger |
|---|---|---|---|
| — | none | A security audit records accepted trade-offs in `docs/architecture/security-trade-offs.md`, not here | [FINDING-040](findings/FINDING-040.md) and [-046](findings/FINDING-046.md) if the maintainer chooses "accept" |

## Standing guidance
- Verify each finding's evidence against the code before fixing — findings are leads, and line numbers have moved since the verifiers read them.
- One commit per task (or per sprint when tiny); gate at every sprint boundary (`release-mechanics.md` → Standing verification gate); stage only your own paths; never merge locally into `main`.
- Route each sprint's agents by role (`.agents/skills/audit-shared/model-routing.md` § *Remediation sprints*): collectors run the gates, workers implement and review, a verifier settles what ships — and, per the maintainer, **no Fable agent** unless they say otherwise. Sprints 1, 3, 6, 10 and 11 (rate limiting, authorization, tokens, redaction, signatures) get a verifier review lens, not only a final verdict.
- A policy finding is not done until both halves land (code, then the six-file edit); AMEND rows need the §8 yes first.
- Re-run `docs/audits/2026-10-26-security/evidence/scripts/collect.sh` and the regression sweep after each sprint; fixes unlock new findings.
- Annotate executed sprints in the heading: **✅ COMPLETED <date> <commits>** + **Deploy needs:** — the plan doubles as the tracker.
