# FINDING-056: Two retired deploy units are still deployed: the `xivdyetools-api-docs` Pages project (public, 22 deployments) and the `xivdyetools-universalis-proxy` worker (unreachable)
**Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** Cloudflare account (api-worker docs, retired proxy) · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-489
**Related:** `DEPRECATIONS.md:162,200` and `docs/operations/OPEN_ITEMS.md:59-61` (unticked since 2026-08-21; "still present on 2026-09-05") · **Found by:** the live-state pass and an independent Opus verifier

## Location
- Pages project `xivdyetools-api-docs` — `https://xivdyetools-api-docs.pages.dev/` answers 200 with no security headers; 22 deployments, last 2026-07-21
- Worker `xivdyetools-universalis-proxy` — no route, no custom domain (`proxy.xivdyetools.app` now points at api-worker), `workers.dev` off, no secrets
- `DEPRECATIONS.md:162` and `:200`, `docs/operations/OPEN_ITEMS.md:59-61` — the unticked deletion steps

## Evidence
- Cloudflare API 2026-10-26 ([evidence](../evidence/live-state-cloudflare-2026-10-26.md)); `HEAD https://xivdyetools-api-docs.pages.dev/` → 200 ([capture](../evidence/live-headers-http-and-retired.txt)). The proxy worker is not reachable from the internet.
- Stale, not dangerous: the old VitePress docs contain no secrets, forms or `http://` endpoints but describe retired behaviour (60 req/min limits, "Phase 2 optional API keys", the pre-schema-v2 model). No live file links the old host; a static, credential-free origin without CSP or XFO has nothing to frame or steal.

## Fix
- Delete the Pages project `xivdyetools-api-docs` (removes all 22 deployments) and the worker `xivdyetools-universalis-proxy`; tick `DEPRECATIONS.md:162`, `:200` and `OPEN_ITEMS.md` §2. Until then, update the item's "still present" date to 2026-10-26.

## Status
FIXED 2026-10-26 — maintainer-authorized deletion of the `xivdyetools-api-docs` Pages project (22 deployments) and `xivdyetools-universalis-proxy` worker. Fresh inventories omit both; project/deployment-list GETs return 404 / 8000007 and worker settings return 404 / 10007. Replacement docs and both current proxy URLs still serve expected content; [execution evidence](../evidence/remediation-finding-056-2026-10-26.md). No code deploy or repository commit was needed for the live actions.
