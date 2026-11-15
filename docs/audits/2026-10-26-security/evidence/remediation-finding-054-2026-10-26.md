# FINDING-054 execution evidence — 2026-10-26

The maintainer authorized: "Let's delete xivdyetools-api-worker-dev first."
Only the worker `xivdyetools-api-worker-dev` was deleted. Times below are UTC;
all checks occurred on October 26 in America/New_York (EDT).
The account ID and workers.dev account subdomain are omitted from this record.

## Preflight — 2026-10-27 03:06:05 UTC

- Script existed, last modified `2026-08-10T20:22:58.629977Z`.
- Its workers.dev subdomain and previews were both enabled.
- No custom domains or xivdyetools.app zone routes targeted the script.
- Read settings for all 16 account workers: zero read failures and zero bindings
  whose service or script_name referenced the target.
- Target bindings were plain variables and the RATE_LIMIT KV binding; no Durable
  Object namespace was implemented by the target.

## Authorized deletion — 2026-10-27 03:06:29 UTC

Cloudflare API request:

```text
DELETE /accounts/<account>/workers/scripts/xivdyetools-api-worker-dev?force=false
```

Response: HTTP 200, success true, errors [], messages []; deleted script ID
`b92bf1046e7e49f1aeac92f6e40a333f`.
Cloudflare's dependency protection remained enabled. The RATE_LIMIT KV namespace
was not deleted. No publish, deploy, route change or production-worker mutation
was performed.

## Verification

- `2026-10-27 03:06:51 UTC`: fresh GET of the worker inventory did not contain
  `xivdyetools-api-worker-dev`; production `xivdyetools-api-worker` remained listed.
- GET of the deleted worker's settings returned HTTP 404, Cloudflare error 10007:
  "This Worker does not exist on your account".
- `2026-10-27 03:07:42 UTC`: HEAD of
  `https://xivdyetools-api-worker-dev.<account>.workers.dev/` returned HTTP 404
  from Cloudflare, Content-Type text/plain; curl exited 0.

FINDING-054 and OPS-API-DEV are complete. The separate og-worker live-origin
checkbox remains open. A future deliberate dev deploy could recreate the script;
the existing workers_dev = false and preview_urls = false configuration must stay
in place, and future live-origin checks should include all worker names.
