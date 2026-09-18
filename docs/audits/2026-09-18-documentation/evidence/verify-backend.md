# Verifier verdicts — presets-api, api-worker, packages, architecture, discord-worker, developer guides (2026-09-18)

Verified at `0fec18f4`. Candidate ids are the reviewers' working ids; the catalog in
`../DOCUMENTATION_AUDIT_REPORT.md` maps them to `DOC-` ids.

| cand | verdict | sev | location (corrected) | decisive evidence |
|---|---|---|---|---|
| PMO-01 | CONFIRMED | MEDIUM | `docs/projects/presets-api/database.md:52,193` | Column table ends at `updated_at`; `schema.sql:56-57` has `content_revision INTEGER NOT NULL DEFAULT 0` + trigger (`:64-78`); migrations table stops at `0013` though `0014_add_content_revision.sql` exists. |
| PMO-02 | CONFIRMED | MEDIUM | `docs/projects/presets-api/endpoints.md:189` (and the revert route at `:290-301`) | `handlers/presets.ts:788-796` returns `409 CONFLICT "Preset changed concurrently — reload and retry"`; the revert route's equivalent 409 (`handlers/moderation.ts:241-248`) is also undocumented. |
| PMO-03 | CONFIRMED | MEDIUM | `docs/projects/presets-api/endpoints.md:262-263` | Doc: `"error": "DUPLICATE_RESOURCE"`, "Preset status changed concurrently…". Source `handlers/moderation.ts:162-163`: `ErrorCode.CONFLICT`, "Preset changed concurrently…". Distinct codes (`utils/api-response.ts:39-40`). |
| PMO-04 | CONFIRMED | LOW | `docs/projects/presets-api/endpoints.md:6` | Banner "legacy itemIDs (≥ 5729)"; `validation-service.ts:217` is `id >= 5000`. Harmless: `:221` rejects everything > 254 anyway and the source comment itself says 5729. |
| PMO-05 | CONFIRMED | MEDIUM | `docs/projects/presets-api/endpoints.md:282` (twin: `docs/architecture/api-contracts.md:496-503`) | Body documented as `{ action }`; `handlers/moderation.ts:282-289` 400s without a matching `preview_image_key`, and `:291-295,:312,:328` return 409. A client following the doc always gets a 400. |
| PMO-06 | REJECTED | — | `docs/projects/presets-api/moderation.md:63-89` | That page is the pipeline overview and carries no HTTP status code at all; the missing revert 409 belongs to `endpoints.md` (folded into PMO-02). |
| API-01 | CONFIRMED | LOW | `docs/projects/api-worker/endpoints.md:503` | Error table lists 11 of 13 codes; `INVALID_COLOR_WHEEL` / `INVALID_HARMONY_TYPE` (`lib/api-error.ts:27,29`) appear only inline at `:383,:395-396`. |
| API-02 | CONFIRMED | LOW | `docs/projects/api-worker/endpoints.md:48` | `page` "min 1"; `routes/dyes.ts:47,289` caps it at 1000 (400 past it). |
| API-03 | CONFIRMED | LOW | `docs/projects/api-worker/endpoints.md:153` | `q` "required"; `routes/dyes.ts:45,57-63` 400s past 100 characters. |
| PKG-01 | CONFIRMED | LOW | `docs/projects/test-utils/overview.md:131,134` | `factories/dye.ts:62,72` export `resetMockDyeSequence()` / `randomStainId()`; the hidden gotcha is `nextStainId()` (`:45-54`) throwing after 254 default dyes. |
| AMR-01 | CONFIRMED | MEDIUM | `docs/architecture/api-contracts.md:483,734,735` | Same defect as PMO-03, plus `:734` calls `CONFLICT` "Reserved" (it is returned by `presets.ts:794`, `moderation.ts:162,245,293`) and `:735` attributes the concurrent-moderation case to `DUPLICATE_RESOURCE`. |
| AMR-02 | CONFIRMED | MEDIUM | `docs/architecture/api-contracts.md:475-476` | "revert is the fifth action this API writes"; `getActionFromStatusChange` (`moderation.ts:436-453`) also writes `requeue`. `database.md:80` and `endpoints.md:278` have it right. |
| AMR-03 | CONFIRMED | LOW | `docs/architecture/data-flow.md:67` | JWT example lacks `jti`; `apps/oauth/src/services/jwt-service.ts:125,133` always mints it and `api-contracts.md:67` shows it. |
| AMR-04 | CONFIRMED | LOW | `docs/architecture/dependency-graph.md:170` | "28 internal symbols"; tracked count of `@internal` in `packages/core/src` is 17 (4 files). |
| DW-01 | CONFIRMED | MEDIUM | `docs/projects/discord-worker/interactions.md:95` | Scopes streamed-byte counting to `/webhooks/github`; since BUG-013 `/webhooks/preset-submission` uses `readTextCapped(c.req.raw, 10240)` (`index.ts:281`, `utils/read-text-capped.ts:43-55`). |
| DO-01 | CONFIRMED | MEDIUM | `docs/developer-guides/environment-variables.md:79` | discord-worker Secrets table omits `BOT_SIGNING_SECRET` (`services/preset-api.ts:106,127`, `utils/env-validation.ts:79-83`) and `GITHUB_WEBHOOK_SECRET` (`index.ts:504,556`). |
| DO-02 | CONFIRMED | **HIGH** | `docs/developer-guides/environment-variables.md:182` | `MODERATOR_IDS` "Required: No"; `apps/presets-api/src/utils/env-validation.ts:43-49` requires it in every environment and `src/index.ts:74-75` answers 500 "Service misconfigured" to every production request when validation fails. |
| DO-03 | CONFIRMED | **HIGH** | `docs/developer-guides/environment-variables.md:183,186` (+ the `wrangler secret put` block `:190-198`) | `BOT_SIGNING_SECRET` / `INTERNAL_WEBHOOK_SECRET` "No"; `env-validation.ts:97-99,131-133` require both when `ENVIRONMENT === 'production'` — same total 500. |
| DO-04 | CONFIRMED | LOW | `docs/developer-guides/environment-variables.md:138` | oauth table omits the genuinely optional `XIVAUTH_CLIENT_SECRET` (`handlers/xivauth.ts:158-159`, `types.ts:64`). |
| DO-05 | CONFIRMED | LOW | `docs/developer-guides/testing.md:4` | "Vitest 4 across every workspace"; every devDependency is `^5.0.0`. |
| DO-06 | CONFIRMED | LOW | `docs/developer-guides/monorepo-setup.md:152` | Tooling row "Vitest \| 4" — same evidence. |
| DO-07 | CONFIRMED | LOW | `docs/developer-guides/testing.md:113` | "Playwright 1.62"; `apps/web-app/package.json:36` pins `^1.63.0`. |
| DO-08 | CONFIRMED | MEDIUM | `docs/developer-guides/contributing.md:110-111` | "the same two required checks"; `docs/operations/OPEN_ITEMS.md:29-32` (dated `gh api` check, 2026-09-05) records three, the third being the E2E job at `.github/workflows/ci.yml:314`. Branch protection is not a tracked file, so this rests on the dated check. |

**Merges.** PMO-03 + AMR-01 are one defect in two documents. DO-02 + DO-03 are one table. DO-05 + DO-06 (+ DO-07) are one edit pass.
**Why HIGH.** presets-api runs `validateEnv` on every request (`src/index.ts:60-79`) and returns 500 in production, so "Required: No" on any of the three is a whole-API outage for anyone provisioning from that page.
