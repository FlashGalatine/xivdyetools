# Remediation Plan — 2026-10-03 security audit

**Sources:** [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md) — 31 findings (1 HIGH, 4 MEDIUM, 21 LOW, 5 INFO) · **Status basis:** 31 total — 0 fixed, 31 outstanding, 0 superseded, 0 KEEP, 0 need rotation
**Ordering:**
1. One deploy unit per sprint.
2. P0 first: FINDING-001, shipped out-of-band.
3. Severity × Exposure. Within that, **API guards ship before the producers that depend on them** (presets-api → moderation-worker → discord-worker, the 2026-09-15 rollout pattern).
4. A policy **CORRECT** ships as early as its owning unit allows. A policy **AMEND** ships only after the code it describes is live.
5. Terminal work is per-worker config pins, then CI / repository hardening, then the parked stoat-worker.

Cross-unit findings are split into **parts**, one per deploy unit, e.g. *FINDING-017 (API)*. Each part sits in exactly one sprint. A finding closes only when all of its parts, plus any policy half, have landed. No finding needs credential rotation. This plan was reviewed adversarially before the gate: 3 blockers and 10 ordering / command corrections were applied, each verified at `file:line`.

## Decisions at the §8 gate — decided 2026-10-03

Eight findings carry an **AMEND**, a new public commitment. Four of them have a code alternative that removes the need for the AMEND, so decide up front:

| ID | Choice | If code | If AMEND |
|---|---|---|---|
| FINDING-004 | XIVAuth author name: keep the verified character name, or store an opaque label / ask the user to type one | oauth (Sprint 6) changes what is stored | web PRIVACY item 3 + ToS §Accounts + `preset.privacyNote` name the character name and the linked Discord id |
| FINDING-005 | Ban records. Minimization is always needed. `banned_users.username` is `NOT NULL`, and moderator ban search selects and sorts by it (`ban-service.ts:172-180`), so **blank it on unban and set a retention for lifted bans and `moderation_log` reasons**. Do not drop the column. | presets-api + moderation-worker (Sprints 3–4) | then AMEND both policies with the minimized fields and the retention (always needed: ban records stay necessary) |
| FINDING-007 | Bot author name: send `username`, or keep the display name | discord-worker (Sprint 5), no policy edit | bot §2 / §4 say "display name" |
| FINDING-008 | Discord moderation / log-channel posts: drop the `<@id>` from the log embed? | discord-worker (Sprint 5) | always: both policies gain a Discord-channels row |
| FINDING-009 | Web disclosure of the 30-day counters and failure records | — | web PRIVACY item 3 (always) |
| FINDING-011 | Market-proxy IP limiter: move it to the native binding, or disclose the in-memory counter | api-worker (Sprint 7), no policy edit | web PRIVACY IP section |
| FINDING-013 | `/stats preferences` sampling: drop it, or disclose the purpose | discord-worker (Sprint 5), no policy edit | bot §4 |
| FINDING-029 | Web deletion steps, 30-day response time and retention | — | web PRIVACY Questions? (always) |

Also at the gate:
- FINDING-002: **HIGH, confirmed by the maintainer on 2026-10-03**. The skill's rule graded it HIGH; the calibration pass argued MEDIUM.
- FINDING-017 rollout: **fail closed, approved by the maintainer on 2026-10-03.** This follows `docs/operations/security-remediation-2026-09-15.md`.
  - A stale, missing or unversioned revision gets an error (409) wherever it applies.
  - That includes the window between the Sprint 3 and Sprint 4 deploys. Run both sprints in one held-workflow window.

**Decided 2026-10-03: the maintainer accepted every recommendation below.**
- FINDING-013's preference sampling is dropped (code, no policy edit).
- FINDING-029's contact address is `flashgalatinefgc@gmail.com`, the same mailbox the bot policy already names.
- The sprint rows below are resolved to these choices. The facts behind them were gathered at `file:line` after the gate.

| ID | Recommended | Main reason |
|---|---|---|
| FINDING-004 | AMEND | The verified character name is the attribution XIVAuth users sign in for, and it is public in-game and on the Lodestone. Discord sign-in already publishes the display name the same way. The code option needs hand-applied backfills in two D1 databases (`presets.author_name`, `users.username`). The linked Discord id is the ownership key, so it stays and is disclosed. |
| FINDING-005 | Minimize, then AMEND | Blank `username` and `reason` at unban; the 10–500 rule on `reason` is a comment in `schema.sql`, not a `CHECK`. Delete lifted-ban rows 90 days after unban. In `moderation_log`, keep preset-level rows (approve / reject; authors see the rejection reason, `preset-service.ts:562-566`) until the preset is deleted, and keep user-level rows (ban / unban / hide) for 12 months. Purge on the moderation write path, like `pruneFailedNotifications`: no cron, no schema change. |
| FINDING-007 | AMEND (wording) | The web path publishes the same `global_name \|\| username`. Changing only the bot gives one person two names, and `refresh-author` reverts it on the next web sign-in. A unique handle is not more private than a display name. |
| FINDING-008 | AMEND + drop the log-embed mention | Buttons key on the preset id, so `<@id>` is display only. Drop it from the submission-log embed, and keep it in the moderation embed only if moderators act on it. Both policies name the channels, say posts stay in Discord until deleted, and say a deletion request removes them. |
| FINDING-009 | AMEND | Copy the bot policy's two §8 rows into web item 3. The 30 / 90-day pruning already exists. |
| FINDING-011 | Code | Move the market proxy to a native `[[ratelimits]]` binding (`CloudflareRateLimiter`, 60 s). PRIVACY's existing IP sentence then becomes true for every route, with no policy edit, and the limiter stops being per-isolate. |
| FINDING-013 | Code (drop), unless used | The sampling is owner-only and read-only, and shows percentages over ≤ 100 records. Dropping it removes a use instead of adding a stated purpose. If the maintainer relies on it, the AMEND is the cheapest of the eight. |
| FINDING-029 | AMEND | Mirror the bot policy: a private channel (email or Discord DM, not a public issue), a 30-day response, the self-serve deletes that exist, and what a request cannot remove (an active ban). |

## Sprint 0 — Emergency and prerequisites

**FINDING-001: ✅ COMPLETED 2026-10-03** — `61b7077b`, PR #221 merged as `b89629d9` (web-app 5.13.3). The live `curl -sI` acceptance on beta passed.
- Step 6 (branch hygiene) and step 7 (recovery) remain the maintainer's.
- **FINDING-019 runbook: ✅ COMPLETED 2026-10-03, `d8d5e3e8`.**
- **FINDING-027 precondition:** the maintainer's, still open.

**FINDING-001 ships alone, out-of-band**, on its own branch, before everything else. The two other rows are maintainer prerequisites with no deploy. Nothing needs rotation.

| ID | Source | Tier | Action |
|---|---|---|---|
| FINDING-001 | security | P0 · MEDIUM / INTERNET-UNAUTH | Fix beta headers and add guards:<br>• Insert `X-Robots-Tag` inside the existing `/*` rule of `dist/_headers` instead of appending a second `/*` rule (`src/shared/beta-branding.ts`, `vite-plugin-beta-branding.ts`).<br>• Fix the misleading merge comment.<br>• Unit-test that the file has exactly one `/*` rule and that it keeps CSP / XFO / HSTS / PP.<br>• `scripts/check-beta-build.js` fails on a duplicated path pattern.<br>• `scripts/smoke-test-pages.js` asserts `content-security-policy` and `x-frame-options` on both custom domains. |
| FINDING-019 (runbook) | security | P2 · LOW / INTERNET-AUTH · **dated 2026-12-31** | Doc-only change to root `DEPRECATIONS.md` (no deploy path filter):<br>• Make "replace the scorer or default new / text-edited presets to `pending`" a **blocking** step before `PERSPECTIVE_API_KEY` is deleted.<br>• Add the six-file edit of bot §6 and web PRIVACY item 3 on the day the key goes.<br>• Until the presets-api part ships, the key must not be deleted. |
| FINDING-027 (precondition) | security | INFO | Cloudflare secrets cannot be read back. Before Sprint 1, the maintainer either checks `INTERNAL_WEBHOOK_SECRET`'s length against the stored copy, or sets a known ≥ 32-character value with `wrangler secret put INTERNAL_WEBHOOK_SECRET --env production` on presets-api and then on discord-worker, back-to-back with the same value. Webhook calls fail and dead-letter in the gap between the two puts. A short secret plus the new check means **500 on every bot request**. |

**FINDING-001 ends with:**
1. Gates: `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, `pnpm --filter xivdyetools-web-app run build:check`, then `VITE_APP_ENV=beta pnpm --filter xivdyetools-web-app run build` and `node apps/web-app/scripts/check-beta-build.js`.
2. Bump the web-app patch version and add a technical CHANGELOG entry (security-only: no laymans entry).
3. Push the branch. `deploy-web-app-beta.yml` deploys beta, because the change touches `apps/web-app/**`.
4. Acceptance: `curl -sI https://beta.xivdyetools.app/` shows CSP, XFO, HSTS, Permissions-Policy and `x-robots-tag`.
5. **Merge to `main` the same day** (`deploy-web-app.yml`). Production output is unchanged, because the plugin is inert there.
6. Branch hygiene: beta redeploys from *any* non-main push that touches `apps/web-app/**` or `packages/{core,types,logger,svg}/**`. Delete the merged remote branches, and merge `main` into every branch still in use. On 2026-10-03, `git branch -r` lists 14 non-main remote branches (e.g. `feat/glamour-reader`, `fix/swatch-file-lock`, `feat/chara-cmp-palettes`), all from before the fix.
7. Recovery, if a stale branch redeploys beta: `gh workflow run deploy-web-app-beta.yml --ref <fixed branch>`, then re-run the `curl -sI` check.

## Sprint 1 — discord-worker: logging promises and code-only fixes

**Committed 2026-10-03 in `28769473`** (discord-worker 5.7.2), with `main` merged in as `93b11b89`. The full gate is green.
- Pushed as PR #222, which deploys the beta bot.
- **Merge needs:** the maintainer confirms the production `INTERNAL_WEBHOOK_SECRET` is ≥ 32 characters. A shorter one now stops preset notifications only.
- **Deviation from the row below, approved by the maintainer 2026-10-03:** FINDING-027 is enforced on the webhook route (503) rather than as a fatal `validateEnv` error.
  - With a short secret, the plan's fatal error would answer 500 to every interaction.
  - This choice instead stops only preset moderation notifications. Because Workers Logs are off, they stop with no visible signal and pile up in `failed_notifications` for up to 90 days.

The HIGH item plus the bot-side fixes that need no other unit and no policy edit. Each makes the current bot policy true. Anchor: FINDING-002.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-002 | security | HIGH / INTERNET-AUTH | Drop `targetDyeId` (`budget.ts:272`) and `method` / `threshold` (`budget-calculator.ts:180-185`) from log contexts. Test that budget log contexts carry no option-derived keys. |
| FINDING-018 | security | LOW / INTERNET-AUTH | Drop `userId` from `preferences.ts:546` and `preset-favorites.ts:99/160/189`. Test the "two lines" invariant. |
| FINDING-015 | security | LOW / INTERNET-AUTH | `resetPreference` also deletes `i18n:user:<id>` / `budget:world:v1:<id>`. Delete the legacy keys after a successful migration. Plan the one-off KV prefix cleanup (maintainer-run). |
| FINDING-027 (discord-worker) | security | INFO / INTERNET-UNAUTH | `validateEnv`: `INTERNAL_WEBHOOK_SECRET` ≥ 32 characters in production. **Only after the Sprint 0 precondition.** |
| FINDING-022 (discord-worker) | security | LOW / LOCAL | Pin `[observability] enabled = false` in both wrangler blocks, and assert it in this worker's wrangler-config test (create one if absent). |

**Ends with:**
1. `pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker`.
2. Patch bump and technical CHANGELOG entry.
3. Branch push: the beta bot deploys via `deploy-discord-worker-beta.yml`.
4. Merge. `deploy-discord-worker.yml` deploys `--env production` and then runs `register-commands`.

## Sprint 2 — web-app: early CORRECTs and copy

These are document and copy corrections with no code dependency, so they do not wait for the LOW sprints. The FINDING-003 sentence about images, and the false "No character data" clause, are wrong today. Each document edit is a six-file edit (`PRIVACY.md` / `TERMS_OF_SERVICE.md` + `.ja/.ko/.zh/.de/.fr`, all `Last updated` lines bumped). Locale-JSON edits touch all six `src/locales/*.json`. PRIVACY item 3 is edited again in Sprint 8; that is accepted.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-003 | security | MEDIUM / INTERNET-UNAUTH | CORRECT three places:<br>• §Images: scope it to the colour tools; the optional preset preview image is uploaded, stored and shown after approval.<br>• item 3.<br>• How to verify. |
| FINDING-004 (web) | security | MEDIUM / INTERNET-UNAUTH | §8 chose disclosure, and the code it describes is already live, so the final wording ships here (no Sprint 8 row). Three changes:<br>• `preset.privacyNote` (all six locales): remove "No character data". Say that signing in stores a provider ID and your name. For XIVAuth, that name is your verified character name, shown as the author of your presets. If your XIVAuth account is linked to Discord, the Discord ID is stored too.<br>• AMEND PRIVACY item 3 and ToS §Accounts to the same effect.<br>• Add a copy-parity test against `xivauth.ts`. |
| FINDING-010 | security | LOW / INTERNET-UNAUTH | CORRECT §What is stored on your device to say what "Reset settings" actually clears. Or add a real "clear all local data" action, in which case the wording follows the action. |
| FINDING-012 | security | LOW / INTERNET-UNAUTH | The Glamour Reader gets its own `charaHint` ("the gear model numbers are sent") and a conditional LOCAL ONLY chip. |
| FINDING-028 | security | INFO / INTERNET-UNAUTH | CORRECT PRIVACY "Links to other sites" and ToS "Other people's services": add the author-supplied preset example links. |
| FINDING-016 (web) | security | LOW / INTERNET-AUTH | `sanitizeExampleLink` returns `url.href`. Tests for LF / U+202E / space. |

**Ends with:**
1. `pnpm --filter xivdyetools-web-app run validate:i18n` and `pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`.
2. `pnpm --filter xivdyetools-web-app run build:check`.
3. `python .agents/skills/audit-shared/scripts/policy-locale-parity.py` exits 0.
4. Patch bump and technical CHANGELOG entry.
5. Add the in-app What's New and root laymans entries; the policy change is user-visible.
6. Merge. `deploy-web-app.yml` deploys. Flag any translated clause that needed interpretation.

## Sprint 3 — presets-api: moderation integrity, identity, validation, sunset

API guards first. Sprints 3 and 4 run in **one held-workflow maintenance window**, following `docs/operations/security-remediation-2026-09-15.md`:
1. Disable `deploy-moderation-worker.yml`.
2. Merge both sprints.
3. Dispatch presets-api and run its acceptance.
4. Dispatch moderation-worker and run its acceptance.
5. Restore the workflow.

**FINDING-019 deadline:** if this sprint has not merged by about 2026-12-01, ship the FINDING-019 row alone as its own presets-api deploy.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-017 (API) | security | LOW / INTERNET-AUTH | Three changes:<br>• `PATCH /moderation/:id/status` takes `expected_revision` / `expected_status` from the caller and uses them in the `WHERE`. A mismatch or a missing revision gets 409: **fail closed**, with no unversioned acceptance.<br>• The submission/edit notification payload (`notification-service.ts:25-41`) carries the `content_revision` and status of the text being sent.<br>• The dead-letter allowlist (`toDeadLetterRecord`) is updated to match. |
| FINDING-019 (presets-api) | security | LOW / INTERNET-AUTH | Either a real per-locale local filter (normalized profanity / slur lists), or new and text-edited presets default to `pending` when no scorer is configured. |
| FINDING-014 (presets-api) | security | LOW / INTERNET-AUTH | Keep both JWT `sub` and `discord_id` on `AuthContext`. `isUserBanned` becomes `(discord_id IN (?sub, ?snowflake) OR xivauth_id = ?sub) AND unbanned_at IS NULL`. Lazy re-keying of UUID-keyed presets / votes / `submission_events` runs **only after `requireNotBanned` passes, and never for a `sub` with an active ban**. Tests:<br>• ban UUID → link → still 403, with no re-key;<br>• unban → restore finds the presets.<br>Cross-ref the 2026-09-16-deep-dive/BUG-001 residual. |
| FINDING-005 (presets-api) | security | MEDIUM / INTERNET-AUTH | Retention, pruned on the write path (no cron exists):<br>• delete lifted-ban rows 90 days after `unbanned_at`;<br>• `moderation_log` preset-level rows (approve / reject) go with their preset;<br>• user-level rows (ban / unban / hide) are deleted after 12 months.<br>**No schema change**: `banned_users.username` stays `NOT NULL`. |
| FINDING-020 | security | LOW / INTERNET-AUTH | Batch an `image_approve` / `image_reject` `moderation_log` insert (`WHERE changes() > 0`) with each preview-image UPDATE. Tests include that a stale 409 writes no row. |
| FINDING-016 (presets-api) | security | LOW / INTERNET-AUTH | `example_link`:<br>• **reject** it unless `hasOnlySupportedCharacters` passes;<br>• store `new URL(...).href`.<br>`author_name` comes from the token, not the user, so **strip** control / bidi / invisible characters instead of rejecting (keep ZWJ between emoji). |
| FINDING-031 | security | INFO / LOCAL | A test that migration 0014's trigger equals the `schema.sql` copy, or run the revision tests on the pre-0014 schema plus 0014. Optionally add a `sqlite_master` probe in the deploy workflow. |
| FINDING-027 (presets-api) | security | INFO / INTERNET-UNAUTH | Production `INTERNAL_WEBHOOK_SECRET` ≥ 32 characters in `env-validation.ts`. Only after the Sprint 0 precondition. |
| FINDING-006 (presets-api) | security | LOW / INTERNET-UNAUTH | Remove `https://xivdyetools.projectgalatine.com` from `ADDITIONAL_CORS_ORIGINS`. |
| FINDING-022 (presets-api) | security | LOW / LOCAL | Pin `[observability] enabled = false` and assert it in `tests/wrangler-config.test.ts`. |

**Ends with:**
1. `pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api`.
2. Patch bump and technical CHANGELOG entry.
3. In the held window: merge, then dispatch `deploy-presets-api.yml` (`--env production`).
4. Acceptance:
   - stale approve → 409;
   - an unversioned approve → 409 (the **expected interim**, until Sprint 4 is live);
   - a banned UUID author with a linked token → 403.

## Sprint 4 — moderation-worker: revision-bound approvals, ban minimization, identity

Deploys right after Sprint 3, in the same window, and **before** Sprint 5. Moderation embeds are posted with the moderation bot's token (`preset-notifications.ts:58-63`), so their buttons route here.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-017 (moderation-worker) | security | LOW / INTERNET-AUTH | Custom-id parsing and the revision round-trip:<br>• Parse both the old `preset_approve_<id>` / `preset_reject_<id>` format and the new revision-bearing format (today a `replace()` at `buttons/preset-moderation.ts:77,215` would read `<id>_<rev>` as the id). `preset_reject_modal_<id>` must carry the revision through.<br>• Old buttons with no revision get the 2026-09-15 recovery: refresh the embed and require a second, revision-bound click, or answer "re-review".<br>• `approvePreset` / `rejectPreset` send the revision and status that the moderator saw.<br>• `/preset moderate approve|reject` (typed id, no revision seen) looks up the current revision, shows the text being approved, and requires a confirm click bound to that revision. |
| FINDING-005 (moderation-worker) | security | MEDIUM / INTERNET-AUTH | Blank `banned_users.username` and `reason` (`''`) on unban. The 10–500 rule on `reason` is a comment, not a `CHECK`. Keep both while the ban is active, because ban search uses the username. |
| FINDING-014 (moderation-worker) | security | LOW / INTERNET-AUTH | For an XIVAuth-only target, write the UUID to `banned_users.xivauth_id` and keep `discord_id` as today. The worker's own ban reads (`ban-service.ts:40,59,101,639`) also match `xivauth_id`. It has no oauth binding, so it cannot look up a linked Discord id. |
| FINDING-021 | security | LOW / INTERNET-AUTH | The `unbanUser` restore skips presets whose `dye_signature` collides with an approved or pending row (`NOT EXISTS`) and reports them. A UNIQUE error maps to its own specific message. |
| FINDING-022 (moderation-worker) | security | LOW / LOCAL | Pin `[observability] enabled = false` and assert it in `tests/wrangler-config.test.ts`. |

**Ends with:**
1. `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker`.
2. Patch bump and technical CHANGELOG entry.
3. Dispatch `deploy-moderation-worker.yml` (`--env production`) in the window.
4. Acceptance:
   - an old button refreshes or asks for re-review;
   - `/preset moderate approve` shows the current text and succeeds after the confirm click.
5. Re-enable the workflow.

## Sprint 5 — discord-worker: revision-bearing buttons, minimization choices, bot policy edits

This sprint lands after Sprints 3–4: the bot policy has to describe the minimized ban data, and the button producer needs both the API guard and the new parser. All bot-policy edits go in one six-file commit (`PRIVACY_POLICY.md` + `.ja/.ko/.zh/.de/.fr`), with every `Last Updated` bumped to the same date and `policy-locale-parity.py` exiting 0.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-017 (discord-worker) | security | LOW / INTERNET-AUTH | Emit revision-bearing custom_ids (≤ 100 characters), taken from the Sprint 3 notification payload. |
| FINDING-007 | security | LOW / INTERNET-UNAUTH | §8 chose the wording fix: AMEND §2 / §4 to say the Discord display name (`global_name`, else `username`) is published as the preset author. No code change. Also list the preferences `updatedAt` field, or stop storing it. |
| FINDING-008 (discord-worker + bot policy) | security | LOW / INTERNET-UNAUTH | Drop `<@id>` from the submission-log embed (§8). Keep it in the moderation embed only if moderators act on it; first find which control opens the ban modal (`moderation-worker/src/handlers/buttons/ban-confirmation.ts:93`). AMEND three places:<br>• add a Discord-channels row to the §5 storage table;<br>• replace "All data is stored on Cloudflare";<br>• make §7 say whether a deletion removes the channel messages. |
| FINDING-013 | security | LOW / INTERNET-UNAUTH | §8 chose to drop it. Remove the `/stats preferences` subcommand: the handler (`stats.ts` ~370-530), its schema entry and its tests. No policy edit. `deploy-discord-worker.yml` re-registers the commands. |
| FINDING-005 (bot policy) | security | MEDIUM / INTERNET-AUTH | AMEND §2 / §5 / §8 with the ban and moderation-log records:<br>• the Discord or XIVAuth id, the username at the time of the ban, the moderator, the reason and the dates;<br>• why they are kept;<br>• their retention: active bans until lifted; lifted bans 90 days with the name and reason cleared at unban; a preset's moderation notes for as long as the preset exists; ban / unban log entries 12 months. |

**Ends with:**
1. `pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker` and `policy-locale-parity.py`.
2. Minor bump, technical CHANGELOG entry and root laymans entry (the policy change is user-visible).
3. Merge. `deploy-discord-worker.yml` deploys.
4. **Discord announcement** of the AMENDs (bot policy §11).

## Sprint 6 — oauth: retired origin, logs pin

FINDING-004 needs no oauth change: §8 kept the verified character name and the linked Discord id, and disclosed them (Sprint 2).

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-006 (oauth) | security | LOW / INTERNET-UNAUTH | Remove the retired origin from `ALLOWED_REDIRECT_ORIGINS` (DOMAIN_DEPRECATION Phase 1). Test the exact production allowlist. Phase 2 (the route and the Discord redirect URIs) are maintainer steps. |
| FINDING-022 (oauth) | security | LOW / LOCAL | Pin `[observability] enabled = false` in the single top-level block (that block **is** production). Assert it in `src/__tests__/wrangler-config.test.ts`. |

**Ends with:**
1. `pnpm turbo run build type-check lint test --filter=...xivdyetools-oauth-worker`.
2. Patch bump and technical CHANGELOG entry.
3. Merge. `deploy-oauth.yml` deploys.

**A bare `wrangler deploy` on oauth is production.** Never run it by hand to "test".

## Sprint 7 — api-worker: market-proxy rate limiting

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-011 (api-worker) | security | LOW / INTERNET-UNAUTH | Decided at §8: rate-limit the Universalis proxy through the native binding and drop the module-scope `MemoryRateLimiter`. That needs no policy edit. |
| FINDING-022 (api-worker) | security | LOW / LOCAL | Pin `[observability] enabled = false` and assert it in a wrangler-config test. |

**Ends with:**
1. `pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker`.
2. Patch bump and technical CHANGELOG entry.
3. Merge. `deploy-api-worker.yml` deploys.

## Sprint 8 — web-app: AMENDs to the privacy guide and Terms

This runs after Sprints 3–7, so every sentence describes code that is already live. The edits are one coordinated six-file commit per document. FINDING-005/008/009/029 all edit PRIVACY item 3 or Questions?. FINDING-004 shipped in Sprint 2, and FINDING-011 needs no policy edit.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-005 (web) | security | MEDIUM / INTERNET-AUTH | AMEND item 3 with the same ban and moderation records, purpose and retention as the bot policy (Sprint 5). |
| FINDING-008 (web) | security | LOW / INTERNET-UNAUTH | AMEND item 3: submissions are posted to private Discord moderation channels. |
| FINDING-009 | security | LOW / INTERNET-UNAUTH | AMEND item 3: the 30-day submission/edit counters and the notification-failure records. |
| FINDING-029 | security | INFO / INTERNET-UNAUTH | AMEND Questions? to mirror bot policy §7:<br>• request deletion privately by email to `flashgalatinefgc@gmail.com` or by Discord DM, never in a public issue;<br>• requests are handled within 30 days;<br>• the self-serve deletes (your presets, your votes) are listed;<br>• data is kept until you delete it or ask;<br>• a request does not remove an active ban. |

**Ends with:**
1. Run the same gates as Sprint 2: `validate:i18n`, the build/type-check/lint/test gate, `build:check` and `policy-locale-parity.py`.
2. Minor bump, technical CHANGELOG entry, What's New and laymans entries.
3. Merge. `deploy-web-app.yml` deploys.

## Sprint 9 — og-worker: Workers Logs pin

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-022 (og-worker) | security | LOW / LOCAL | Pin `[observability] enabled = false` in both blocks and assert it in a wrangler-config test. |

**Ends with:**
1. `pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker`.
2. Patch bump and technical CHANGELOG entry.
3. The branch push deploys the **live** og beta (`deploy-og-worker-beta.yml`; config-only).
4. Merge. `deploy-og-worker.yml` deploys.

## Sprint 10 — image-worker: Workers Logs pin

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-022 (image-worker) | security | LOW / LOCAL | Pin `[observability] enabled = false` and assert it in `src/wrangler-config.test.ts`. |

**Ends with:**
1. `pnpm turbo run build type-check lint test --filter=...xivdyetools-image-worker`.
2. Patch bump and technical CHANGELOG entry.
3. Merge. `deploy-image-worker.yml` deploys.

## Sprint 11 — CI and repository hardening (terminal)

The settings rows are maintainer actions in GitHub, verified by re-reading them with `gh api`. `evidence/gh-settings-2026-10-03.txt` is the before-state. The in-repo rows touch no `apps/**` path, so merging triggers no worker deploy.

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-024 | security | LOW / LOCAL | Add `Secret scan (gitleaks)` to `main`'s required checks. Consider `strict` and `enforce_admins`. |
| FINDING-023 | security | LOW / LOCAL | Move `DISCORD_TOKEN` and `MODERATION_DISCORD_TOKEN` to the `production` environment (and the beta tokens to `beta`), then delete the repository copies. Update `SECRET_ROTATION.md` and `DEPLOY_ENVIRONMENTS.md`, the `sync-dye-emojis.yml:7` comment, and the `deploy-discord-worker-beta.yml:123` skip message, which names repository secrets. |
| FINDING-030 | security | INFO / LOCAL | Enforce SHA pinning (or restrict the allowed actions). Enable Dependabot alerts and security updates. Consider CodeQL default setup. |
| FINDING-025 | security | LOW / LOCAL | Add the override `'miniflare>undici': '>=7.29.1 <8'` to `pnpm-workspace.yaml`. Optionally add a non-blocking full-tree `pnpm audit` job. |
| FINDING-022 (CI) | security | LOW / LOCAL | Add a root `scripts/` check, run from `ci.yml`, that fails when any `apps/*/wrangler.toml` lacks `[observability] enabled = false` or adds Logpush / `tail_consumers`, unless both policies change in the same diff. |

**Ends with:**
1. `pnpm turbo run build type-check lint test` (the whole graph, because the override touches the lockfile), `pnpm test:scripts` and `pnpm type-check:scripts`.
2. Merge.
3. Re-read protection, permissions, secrets and vulnerability alerts with `gh api`.

## Sprint 12 — stoat-worker (parked)

| ID | Source | Sev / Exposure | Item |
|---|---|---|---|
| FINDING-026 | security | LOW / LOCAL | `sanitizeEcho` defuses `@online` (and Revolt role mentions) with a ZWJ. Add unit tests for the three echo sites. |

**Ends with:**
1. `pnpm turbo run build type-check lint test --filter=...xivdyetools-stoat-worker`.
2. Merge. There is no deploy, because the bot is parked. Before any redeploy, confirm the bot role cannot mention everyone.

## Superseded findings

| ID | Superseded by | Why |
|---|---|---|
| — | — | none |

## KEEP register

| ID | Item | Reason | Revisit trigger |
|---|---|---|---|
| — | — | not applicable to a security catalog | — |

## Standing guidance

- Verify each finding's evidence against the code before fixing it. Findings are leads.
- One commit per task, or per sprint when the sprint is tiny. Run the gate at every sprint boundary (`release-mechanics.md` → *Standing verification gate*). Stage only your own paths (`git commit --only -- <paths>`). "Done" also means the version bump and the changelogs (root `CLAUDE.md` § *Finishing a branch*).
- No finding needs rotation. If a fix ever exposes a credential, rotate it **before** pushing the commit that removes it.
- A finding with a `Policy` half is not done until the code and every document file have landed: six, twelve or eighteen files. An AMEND never lands before its code.
- Re-run the audit's checks after each sprint:
  - the live `curl -sI` probe for Sprint 0;
  - `gh api` reads for Sprint 11;
  - `policy-locale-parity.py` for Sprints 2, 5 and 8.
- Annotate executed sprints in the heading: **✅ COMPLETED <date> <commits>** + **Deploy needs:**. Mirror the result in each finding's `## Status` and in the report's status table.
