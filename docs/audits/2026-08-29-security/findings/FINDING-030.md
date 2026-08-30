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
OPEN
