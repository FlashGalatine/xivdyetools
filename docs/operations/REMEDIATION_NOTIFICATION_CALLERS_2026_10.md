# Preset-notification callers before binding-only activation — October 2026

**PREPARATION ONLY — production activation is on hold.** This document authorizes no merge, package publication, remote database access, hosted request, deployment, workflow dispatch, command registration or announcement.

This is a read-only static inventory of everything that can reach the Discord worker's `POST /webhooks/preset-submission` route, written before `PRESET_WEBHOOK_BINDING_ONLY` could ever be set to `true`. The reference tree is branch `codex/release-cut-f-03-readiness-20261030` at `2ac97b6fb37c12640a70af0aebac42d4086912e0`, the date is 2026-10-30, and every line citation is to that tree (paths relative to the repository root). No network, registry or hosted service was used, so there are no URL retrieval times, and nothing was executed. See the [October 2026 A/R/H release and adoption runbook](REMEDIATION_RELEASE_2026_10.md).

Bottom line: the only in-repo production caller is presets-api `notifyDiscordBot`. At the reference tree it already selects the named `PresetNotifications` entrypoint (the C4 form), so it would keep working with the flag `true`. Any default-binding caller (a C2-form presets cut, a rollback, a hand-run request to the public host, a holder of the shared secret) would get 404 with the flag `true`, and that 404 is not retried. None of the latter can be ruled out from source. The flag stays `"false"`.

## 1. Entry points

| # | Entry point | Where | Transport / reachability | Auth | Flag `true` behavior |
|---|---|---|---|---|---|
| E1 | Default export (Hono `app`), `POST /webhooks/preset-submission` | `apps/discord-worker/src/index.ts:306`; default export `src/worker.ts:19`, `index.ts:1567` | (a) service binding with NO `entrypoint` (reaches the default export); (b) public HTTP: production custom domain `bot.xivdyetools.app` (`apps/discord-worker/wrangler.toml:131-133`), beta `workers.dev` (`wrangler.toml:16`, worker `xivdyetools-discord-worker-dev` at `:12`) | `Authorization: Bearer ${INTERNAL_WEBHOOK_SECRET}`, constant-time compare (`index.ts:319,346`); 401 if the secret is unset (`:323-326`); production 503 if the secret is shorter than `MIN_WEBHOOK_SECRET_LENGTH` (`index.ts:335-343`; 32 per `apps/discord-worker/CLAUDE.md:196`) | Refused: 404 `{"error":"Not found"}` before any bearer or body work (`index.ts:313-315`) |
| E2 | Named `PresetNotifications` `WorkerEntrypoint` `fetch()` | `apps/discord-worker/src/worker.ts:6-16` | service binding with `entrypoint = "PresetNotifications"` only; no route | Same bearer; E2 delegates into the same handler through `fetchPresetNotification` (`index.ts:1558-1565`) | Accepted: the handler sees the module-private Symbol marker (`index.ts:197-200`, set at `:1564`) |
| E2a | E2 method and path guard | `worker.ts:8-13` | any non-POST request or other path gets 404 `{"error":"Not found"}` | n/a | unchanged |
| E3 | Other routes on E1: `GET /health` (`index.ts:290`), `POST /` interactions (`:823`), `POST /webhooks/github` (`:610`) | public | none / Ed25519 / GitHub HMAC | unaffected; the workerd test asserts they still answer (`apps/discord-worker/tests/preset-notifications.workerd.test.ts:240-251`) |

The capability cannot be forged by header, query, body or IP (`index.ts:194-196`, comment `:310-312`). `fetchPresetNotification` spreads env into a fresh object so overlapping public requests never see the marker (`index.ts:1561-1564`). Tests: `apps/discord-worker/src/index.test.ts:496-516` and `tests/preset-notifications.workerd.test.ts:206-224`. Caveat: a service binding that omits `entrypoint` reaches the default export, that is E1 without the marker.

## 2. Flag behavior (`PRESET_WEBHOOK_BINDING_ONLY`)

- Declared `"false"` in both blocks: top-level (beta) `apps/discord-worker/wrangler.toml:87` and production `:144`. Guarded by `apps/discord-worker/tests/wrangler-config.test.ts:71-72`. Type: `src/types/env.ts:78`.
- Valid values: unset, `"false"`, `"true"`. Any other value makes `validateEnv` add `PRESET_WEBHOOK_FLAG_ERROR` (`src/utils/env-validation.ts:27,54-59`), and the global middleware answers 500 `{"error":"Service misconfigured"}` on EVERY route, interactions and health included (`index.ts:238-270`; test `src/index.test.ts:548-562`). A typo takes the whole bot down.
- `"true"`: the check at `index.ts:313` runs first in the handler, before the secret-unset 401 (`:323`), the short-secret 503 (`:335-343`), the bearer compare (`:346`), the 10,240-byte capped body read (`:355`) and JSON parsing. Refused requests get 404; `RL_30` and `timingSafeEqual` are never called (`src/index.test.ts:496-516`). Floods of public requests do not consume private admission (`tests/preset-notifications.workerd.test.ts:226-238`).
- The private path (E2) with the flag `true` still enforces bearer 401, 400 invalid JSON or payload, and 413 oversize (`tests/preset-notifications.workerd.test.ts:144-204`).
- Payload kinds the handler accepts: `type: "submission"` (new, or an edit when `is_edit === true`, `index.ts:449`) and `type: "preview_image"` (needs `preview_image_key` prefixed `<presetId>/`). Any other `type` or a missing `preset` gets 400 `Invalid payload` (`index.ts:372-378`). No other kinds exist.
- Handler outcomes: 200 `{success:true}`; 502 `Failed to deliver moderation notification` (pending submission whose Discord post failed, `:461,528`); 502 `Failed to deliver preview-image notification` (`:441`); an approved-submission log-channel failure is only logged and returns 200 (`:590`); `preview_image` with no `MODERATION_CHANNEL_ID` is a 200 no-op (`:390`); a pending submission with no moderation channel skips the post and returns 200 (the 502 branch is inside `:461`).

Producer side (`apps/presets-api/src/services/notification-service.ts`):

- Guard: no `DISCORD_WORKER` binding or no `INTERNAL_WEBHOOK_SECRET` means it logs and returns; there is no dead letter (`:264-267`).
- Request: `POST https://internal/webhooks/preset-submission`, JSON, bearer, a NEW `Request` per attempt (`:274-284`; test `apps/presets-api/tests/services/notification-service.test.ts:60-110`).
- Retry: `maxRetries: 3`, base 1 s, cap 10 s, doubling, plus or minus 25% jitter (`:226-230`, loop `:271`, delay `:310-312`). 5xx and network errors retry. Any 4xx throws immediately with no retry (`:294-296`, `:304`). So a flag-`true` 404 is dead-lettered on the first try.
- Dead letter: callers `.catch` into `storeFailedNotification` (edit `apps/presets-api/src/handlers/presets.ts:929-937`, new submission `:1120-1127`, preview image `:1354-1366`). A row keeps only the `toDeadLetterRecord` fields: for a submission, type, preset id, `moderation_status` and `content_revision`; for a preview image, type and preset id (`notification-service.ts:183-191`). `attempts` is written as `retries + 1` (default 4) even for an instant 4xx (`:402-414`). Retention: 30 days after resolution, 90 days if unresolved (`notification-service.ts:199,206`).
- No redelivery exists: `PATCH /api/v1/moderation/failed-notifications/:id/resolve` only marks the row resolved (`apps/presets-api/src/handlers/moderation.ts:553-566`), and `GET /failed-notifications` is list-only (`:537-548`). The prose "the failure goes to `failed_notifications` for retry" at `apps/presets-api/CLAUDE.md:352` overstates this; no code retries from the table.

## 3. Caller matrix

SB-default = service binding to the default export (E1); SB-named = binding with entrypoint (E2); HTTP = public request to E1.

| # | Caller | Evidence | Transport | Auth | Payload kind | Works if flag `true`? |
|---|---|---|---|---|---|---|
| C-1 | presets-api `notifyDiscordBot`, top-level (dev) binding | `apps/presets-api/wrangler.toml:28-30` (`service = "xivdyetools-discord-worker"`, `entrypoint = "PresetNotifications"`); worker `xivdyetools-presets-api-dev` (`:11`) | SB-named; targets the PRODUCTION provider name, not `-dev` | bearer from presets-api `INTERNAL_WEBHOOK_SECRET` (`notification-service.ts:280`) | submission, edit, preview_image | Yes, once the provider is deployed. A dev presets deploy talks to the production provider |
| C-2 | presets-api `notifyDiscordBot`, `[[env.production.services]]` | `apps/presets-api/wrangler.toml:98-100`; deploy `.github/workflows/deploy-presets-api.yml:69` (`deploy --env production`) | SB-named | same | new `handlers/presets.ts:1105-1127`; edit (`is_edit:true`, payload `:881-886`, notify and dead letter `:929-937`); preview image `:1350-1366` | Yes |
| C-3 | Same call sites on a C2-form presets cut (named fields removed) or any rollback to a default binding | runbook `docs/operations/REMEDIATION_RELEASE_2026_10.md:143,147-149`; the reference-tree test asserts the named form and its comment says C2 differs (`apps/presets-api/tests/wrangler-config.test.ts:51`) | SB-default | same | same three | NO: 404, not retried, dead-lettered. Principal break if the flag is `true` while the binding is default |
| C-4 | The presets-api production worker as currently DEPLOYED | UNKNOWN: the reference tree is a prepared tree, not a deployment record; live acceptance is held (runbook `:152`) | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN until a maintainer reads the deployed binding |
| C-5 | moderation-worker | No `DISCORD_WORKER` binding; services are `PRESETS_API` and `OAUTH_IDENTITY` only (`apps/moderation-worker/wrangler.toml:36-42,106-112`); `src/` hits for "webhooks" are Discord's own API URLs (`utils/discord-api.ts:40,119`, `url-sanitizer.ts`) | none | n/a | n/a | Not a caller |
| C-6 | discord-worker `/preset submit` and `edit` | They post nothing; presets-api notifies for those writes (`apps/discord-worker/CLAUDE.md:102`; `handlers/commands/preset-notifications.ts:11-14`). `sendModerationNotification` is used only by the route (`index.ts:82`) | indirect via C-1 and C-2 | n/a | n/a | Same as C-2 |
| C-7 | web-app, api-worker, oauth, og-worker, image-worker, stoat-worker, `packages/*` | Search of the reference tree (excluding node_modules, dist, coverage, `.wrangler`, `.superpowers`, audits/historical/research/superpowers docs and CHANGELOGs) for `webhooks/preset-submission` and `INTERNAL_WEBHOOK_SECRET`: hits only in discord-worker, presets-api, docs and `.agents/skills/security-audit/SKILL.md:111`. web-app matches on "preset-submission" are component or service names (for example `apps/web-app/src/__tests__/TESTING.md:27`) | none | n/a | n/a | Not callers |
| C-8 | `scripts/` | No script references the route or the secret (listing: check-*, coverage-report, publish-packages, knip-config) | none | n/a | n/a | Not a caller |
| C-9 | `.github/workflows` | Only `deploy-discord-worker.yml:103` does `GET https://bot.xivdyetools.app/health` (E3), plus the presets deploy (C-2). No workflow posts to the webhook or references `INTERNAL_WEBHOOK_SECRET` | HTTP health only | none | none | Unaffected |
| C-10 | Docs | See the list below the table | docs only | docs only | docs only | Not callers |
| C-11 | Tests | discord-worker `src/index.test.ts:478-1792`, `tests/preset-notifications.workerd.test.ts` (real workerd; producer fixture `tests/fixtures/preset-notification-caller.ts:1-5` forwards the `Request` unchanged); presets-api `tests/services/notification-service.test.ts`, `notification-service-deadletter.test.ts`, `tests/handlers/*` | n/a | test secrets | all kinds | No production effect |
| C-12 | Human or manual: an operator or contributor posting by hand to `bot.xivdyetools.app` or the beta `workers.dev` host | Nothing in source or docs instructs it; the contract doc (C-10) makes it possible. Existence UNKNOWN | HTTP | needs the shared secret | any | NO (404), if such callers exist |
| C-13 | Anyone holding `INTERNAL_WEBHOOK_SECRET` outside the two workers | Documented holders: presets-api and discord-worker (`docs/operations/SECRET_ROTATION.md:45`); regenerated 2026-10-03 on both, and the log entry records that nobody holds a copy of the new value (`:193`). Other copies UNKNOWN | HTTP or binding | bearer | any | NO via HTTP or the default binding |

C-10 detail (principal documentation mentions of the route or the secret; the list is not exhaustive, and none of it is a caller):

- Contract: `docs/architecture/api-contracts.md:720-789` documents route, base URL, bearer header and JSON bodies (no curl). Lines `:722-724` describe only "the `DISCORD_WORKER` Service Binding", with no named entrypoint.
- Binding patterns: `docs/architecture/service-bindings.md:99-102,129` show the named binding; `:296-326` is an explicitly non-live pattern to `/webhooks/moderation` (`:310`).
- Design proposal for a parked bot: `docs/research/discord-alternatives/02c-stoat-infrastructure.md:636,669,739`.
- Project docs: `docs/projects/presets-api/moderation.md:125-130`, `docs/projects/presets-api/overview.md:272,279,289`, `docs/projects/discord-worker/interactions.md:85`, `docs/projects/discord-worker/overview.md:214,227`.
- Other mentions: `apps/discord-worker/README.md:141,155,160`; `apps/discord-worker/CLAUDE.md:356`; `docs/developer-guides/environment-variables.md:75,202,218,427`; `docs/specifications/community-presets.md:1293`; `docs/operations/DEPLOY_ENVIRONMENTS.md:331`.
- `apps/api-worker/docs` has no reference to the route or the secret (searched at the reference tree).

## 4. Unknowable from source, and how a maintainer could bound it

Not establishable from the repository:

1. Whether any external or manual client posts to `https://bot.xivdyetools.app/webhooks/preset-submission` or the beta `xivdyetools-discord-worker-dev` host (C-12, C-13). They would need the bearer secret, and who holds a copy is recorded only at `docs/operations/SECRET_ROTATION.md:45,193`.
2. Which binding form the DEPLOYED presets-api production worker has now (C-4), and whether the named provider is deployed.
3. Whether any other Worker or account holds a service binding to `xivdyetools-discord-worker` (bindings are by script name; the repository shows only its own consumers).
4. Whether past traffic ever came from anything but presets-api. There is no request log to ask. Workers Logs are pinned off by the repository invariant: `apps/discord-worker/wrangler.toml:106-107` and `:136-137` (`enabled = false`, top-level and `[env.production.observability]`), the same pin in presets-api (`apps/presets-api/wrangler.toml:74-75,146-147`) and every worker, enforced by `scripts/check-worker-logs.ts` (`ALLOWED_TO_LOG` empty; it also forbids `logpush = true` and `tail_consumers`), run as `pnpm workers:check-logs` (root `package.json:16`). Enabling logs needs both privacy policies updated in all six languages (`apps/discord-worker/wrangler.toml:103-105`). Absence of a log is not absence of a caller.
5. The contents of `failed_notifications` live in production D1 and were not read; they would show only presets-api failures anyway.

Secret holders stay UNKNOWN: `SECRET_ROTATION.md:45,193` names only the two workers, which is a statement about intended holders, not proof that no copy exists elsewhere.

Ways to bound it. Each is a separately authorized maintainer action that this document does not authorize; none was run or verified here, and each is subject to the privacy policies.

- A. A time-boxed capture of the default and public route only, with a written start and stop time and a named owner, nothing stored (live view or platform aggregate analytics), no bodies or secrets, only counts by path, method and status. It must not flip `[observability]` or add `tail_consumers` (the gate fails). Whether such a facility fits the privacy promises, and what the platform offers, is UNKNOWN.
- B. (Outside capture-only scope and blocked by the current release hold. It is a production secret change that needs its own explicit maintainer authorization after the hold lifts.) A bounded `INTERNAL_WEBHOOK_SECRET` rotation per `docs/operations/SECRET_ROTATION.md:124-132`, verified by a real web submission (`:179`). Any holder outside the two workers then gets 401. It closes unknown holders; it does not identify them. Note that `:193` already records that nobody holds a copy of the value set on 2026-10-03.
- C. Read the deployed presets-api binding and the Discord provider version in the Cloudflare dashboard (maintainer only), settling C-4.
- D. (Outside this task's scope: it involves contacting people.) Ask internal maintainers whether anyone scripts the webhook. No outreach was made here.

## 5. Obligations checklist

- [ ] Keep `PRESET_WEBHOOK_BINDING_ONLY` false in source until its own later activation and acceptance: runbook `docs/operations/REMEDIATION_RELEASE_2026_10.md:200,205`; `apps/discord-worker/CLAUDE.md:236-238`; `apps/discord-worker/wrangler.toml:86-87,143-144`; test `apps/discord-worker/tests/wrangler-config.test.ts:71-72`.
- [ ] Inventory external and manual notification callers before binding-only activation: runbook `:219-220` (sections 3 and 4 above are that inventory; the unknowns remain).
- [ ] Keep named providers exported while consumers select them (including OAuth `IdentityLookup` while presets and moderation select it): runbook `:220-221`; `apps/discord-worker/CLAUDE.md:241-242` ("never remove the provider entrypoint first"); `apps/presets-api/CLAUDE.md:99-100`; `apps/presets-api/README.md:92-93`.
- [ ] On rollback, restore and verify public and default notification compatibility BEFORE moving the presets binding back: runbook `:221-222`; `apps/discord-worker/CLAUDE.md:241-242`; `apps/presets-api/CLAUDE.md:98-100`; `apps/presets-api/README.md:92-93`. Practical reading: if the flag were ever `true`, set it false and redeploy Discord first, then move presets to the default binding; the reverse order yields unretried 404s (section 2).
- [ ] Failed-notification records do not imply automatic redelivery: runbook `:222-223`; code `apps/presets-api/src/handlers/moderation.ts:553-566` (resolve only marks) and `notification-service.ts:402-414`. Do not treat an unresolved dead letter as "will be retried".
- [ ] Verify actual submission, edit and preview delivery after C4 before separately enabling binding-only mode: runbook `:145,222-223`; `apps/presets-api/CLAUDE.md:97-98`.
- [ ] C3 acceptance: both default and named paths, real manual delivery and capped favorites, no binding-only activation: runbook `:144`.
- [ ] Reverse favorites edge: after C3, retain presets' capped batch endpoint (`POST /api/v1/presets/batch`, up to 50 IDs) while the Discord favorites consumer is deployed; before rolling presets back below that provider, first deploy and verify a reviewed compatible Discord rollback; keeping notification compatibility alone does not protect it: runbook `:225-228`; consumer `apps/discord-worker/CLAUDE.md:228`, deploy-order note `:253`.
- [ ] Two presets source and configuration releases (C2 then C4), order C1, C2, C3, C4: runbook `:133-152`; notification form `apps/presets-api/CLAUDE.md:94-98`.
- [ ] Recheck registry versions and intervening releases before publication or integration; a reserved version or green draft PR authorizes no deployment: runbook `:154-157`.
- [ ] Production secret floor: a production `INTERNAL_WEBHOOK_SECRET` under 32 characters makes the discord-worker route answer 503 (retried, then dead-lettered): `apps/discord-worker/src/index.ts:335-343`; `apps/discord-worker/CLAUDE.md:196`. presets-api only warns on a short secret (`apps/presets-api/src/utils/env-validation.ts:158-162`) and errors only when it is missing (`:156-157`).
- [ ] Doc drift to fix at the next doc pass (not done here): `docs/architecture/api-contracts.md:722-724` omits the named entrypoint; `apps/presets-api/CLAUDE.md:352` implies a retry from the dead-letter table; `apps/discord-worker/README.md:155` and `apps/discord-worker/CLAUDE.md:356` describe the caller as "the web app", but the only caller is presets-api.

Confidence: high on handler, entrypoint, flag and producer retry semantics (read directly from source); low on live deployment state and external callers (UNKNOWN by construction).
