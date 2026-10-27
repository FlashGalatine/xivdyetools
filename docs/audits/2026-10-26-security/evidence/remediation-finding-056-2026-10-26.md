# FINDING-056 execution evidence — 2026-10-26

The maintainer explicitly authorized deletion of the retired
`xivdyetools-api-docs` Pages project and `xivdyetools-universalis-proxy` worker.
Times below are UTC; all checks occurred on October 26 in America/New_York (EDT).
The account and zone IDs are omitted from this record.

## Preflight — 2026-10-27 03:16:46 UTC

- Pages project: exact name `xivdyetools-api-docs`, ID
  fc5eb354-f4b0-4db9-9002-e150357ce75c; 22 deployments, latest on 2026-07-21.
  Its project domain list contained only xivdyetools-api-docs.pages.dev. A separate
  custom-domain listing retained developers.xivdyetools.app with status deactivated.
- Retired worker: exact name `xivdyetools-universalis-proxy`, last modified
  2026-07-29T01:07:55.597049Z; no custom domains or xivdyetools.app zone routes;
  workers.dev and preview access both disabled. All bindings were plain variables.
- Read settings for all 15 account workers: zero read failures and zero bindings
  whose service or script_name referenced the retired worker.
- Worker custom-domain records confirmed developers.xivdyetools.app and
  proxy.xivdyetools.app belong to xivdyetools-api-worker, production.
- Curl HEAD of the retired Pages root returned 200. Replacement docs GET returned
  200 with title XIV Dye Tools API. Both current proxy URLs returned 200 with a
  valid 17-row data-centers JSON array, first name Elemental, with worlds arrays.

## Authorized deletions

```text
2026-10-27 03:17:40 UTC
DELETE /accounts/<account>/pages/projects/xivdyetools-api-docs
HTTP 200; success true; result null; errors []; messages []

2026-10-27 03:17:41 UTC
DELETE /accounts/<account>/workers/scripts/xivdyetools-universalis-proxy?force=false
HTTP 200; success true; result.id e0c80042c87140de87dc6778763cf17c
errors []; messages []
```

Deleting the Pages project removed its 22 retired deployments. The worker was
deleted with dependency protection enabled. No separate DNS, route, production
worker, production/beta web deployment or storage deletion was performed.

## Verification — 2026-10-27 03:18:10–03:18:17 UTC

- Fresh complete Pages project inventory and worker inventory omitted both targets.
- Project GET and its deployment-list GET returned HTTP 404 / Cloudflare 8000007,
  Project not found. Retired worker settings GET returned HTTP 404 / 10007,
  This Worker does not exist on your account.
- The former Pages root returned HTTP 530 from Cloudflare rather than docs;
  the former latest deployment host 55f62f58.xivdyetools-api-docs.pages.dev
  failed DNS resolution (curl exit 6). These are recorded as observed, not 404s.
- Both replacement custom domains still belonged to production xivdyetools-api-worker,
  which remained listed in the worker inventory.
- developers.xivdyetools.app GET returned 200 with title XIV Dye Tools API.
- proxy.xivdyetools.app/api/v2/data-centers and
  data.xivdyetools.app/universalis/data-centers both returned 200 with the expected
  17-row data-centers JSON array (first name Elemental; worlds arrays present).
- Active web Pages deployments were unchanged: xivdyetools at
  970e253a-083a-4d97-bdb2-8e8e2792dee4 and xivdyetools-beta at
  5a3fb28b-2091-47e7-a6b3-2495c5a52090.

FINDING-056 and OPS-RETIRED are complete. DEPRECATIONS.md and OPEN_ITEMS.md record
both removals. No application deploy or publish was required.
