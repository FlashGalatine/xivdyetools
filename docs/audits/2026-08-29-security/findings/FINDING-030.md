# FINDING-030: the rotation runbook prescribes KV / D1 / R2 *Edit* scopes for the CI `CLOUDFLARE_API_TOKEN` — deploys need only Workers Scripts / Routes / Pages Edit, so a CI compromise becomes production-data access
**Severity:** LOW (plausible — token scope not readable from here) · **Exposure:** LOCAL (supply chain) · **Deploy unit:** CI / docs/operations · **Rotation:** ROTATE if the live token carries the data scopes (re-issue with the narrower set)

## Location
- `docs/operations/SECRET_ROTATION.md:66` ("scope it to Workers Scripts + Pages + KV/D1/R2 edit") and `:151` (§7: "Workers Scripts: Edit, Pages: Edit, Workers KV/D1/R2: Edit, Workers Routes: Edit")
- `docs/operations/POST_MERGE_CHECKLIST.md:334-335` — token-scoping item still open

## Evidence
- Every CI use is `cloudflare/wrangler-action` `deploy` / Pages deploy; D1 migrations and backfills are user-run (`d1_migrations` empty, merge-day runbook). Attaching KV/D1/R2 *bindings* to a script needs Scripts Edit, not data-plane Edit — verify on a scratch token before rotating.

## Fix
- Re-issue the token with Workers Scripts: Edit, Workers Routes: Edit, Pages: Edit (this account only); correct the runbook; if the current token has the wider scopes, rotate (see rotation rule: rotate before pushing the doc change is not needed here — no leak, just over-scope).

## Status
FIXED 2026-09-01 — the live `XIVDyeTools Workers` token was inspected and trimmed **in place**
(same token value, so no GitHub secret change and nothing to revoke). Removed: **Account → Workers
R2 Storage: Edit** and **Account → Workers KV Storage: Edit**. There was no D1 row at all, so that
third of the finding needed no action — the D1 migrations this audit required were run under the
maintainer's own `wrangler` OAuth login, never this token.

Retained, and this is the required minimum: **Workers Scripts: Edit**, **Cloudflare Pages: Edit**
(web-app), and **Zone → Workers Routes: Edit** on *both* `xivdyetools.app` and
`projectgalatine.com` — the second zone is not stale, discord-worker declares
`bot.xivdyetools.projectgalatine.com` as a second custom domain and route reconciliation needs it.

**Verified rather than assumed:** `deploy-image-worker.yml` was run via `workflow_dispatch` against
`main` after the trim and completed successfully, which demonstrates the removed storage grants were
genuinely unused by deploys — a worker's KV/R2/D1 *bindings* resolve by ID from `wrangler.toml` at
deploy time and never require permission to administer those stores.

The runbook half was corrected earlier, in Sprint 13: `SECRET_ROTATION.md` §7 and the
`POST_MERGE_CHECKLIST.md` item both used to prescribe KV/D1/R2 Edit for this token and now state the
Scripts/Pages/Routes minimum. **Consequence worth knowing:** this token can no longer perform
`wrangler kv` or `wrangler r2` operations. That affects no CI job; local work uses the OAuth login.
