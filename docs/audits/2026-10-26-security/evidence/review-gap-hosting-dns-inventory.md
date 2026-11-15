# Review: gap-hosting-dns-inventory (2026-10-26)

Method: read-only DNS (nslookup + Cloudflare DoH, A/CNAME/NS) and HEAD/GET probes on 2026-10-26 22:1xZ, plus tracked-file reads. The Cloudflare API was NOT used (no maintainer approval), so Pages project ownership and the deployment list are inferred, not read.

## Host table (live DNS)

| Host | DNS result | Source in repo | Verdict |
|---|---|---|---|
| xivdyetools.app | A 104.21.37.78 / 172.67.205.229 (Cloudflare proxy); NS harleigh/javon.ns.cloudflare.com | web-app Pages | OK |
| data / proxy / developers (.xivdyetools.app) | same Cloudflare anycast IPs, no visible CNAME | api-worker wrangler.toml:120-122 custom_domain | OK |
| api, auth, bot, moderation-bot, og, og-beta, beta, shots | same Cloudflare IPs | worker wrangler routes / R2 custom domain | OK |
| www, img, presets, auth-preview, analytics (.xivdyetools.app) | NXDOMAIN | doc/comment mentions only | not dangling (no record exists) |
| zz-nonexistent-1.xivdyetools.app | NXDOMAIN | n/a | no wildcard DNS record |
| xivdyetools.projectgalatine.com and bot/api/auth/proxy/moderation-bot/analytics subdomains, plus a random label | NOERROR with empty answer (NODATA); zone still on same Cloudflare NS | DOMAIN_DEPRECATION.md | records removed, no wildcard, no takeover surface; zone stays in the maintainer's Cloudflare account |
| xiv-colorexplorer.pages.dev | resolves, serves current prod build (live-headers.txt:37) | presets-api wrangler.toml:76 | owned by Pages project named `xivdyetools` (deploy-web-app.yml:76, comment :85-88: subdomain fixed at creation) |
| xivdyetools.pages.dev | NXDOMAIN | only a comment (deploy-web-app.yml:85) | unclaimed name, referenced by NO allowlist, CSP or redirect (git grep) |
| xivdyetools-beta.pages.dev | resolves, serves beta build | deploy-web-app-beta.yml:186 | OK |
| v4-ui-migration.xiv-colorexplorer.pages.dev, 66496174.xiv-colorexplorer.pages.dev, ecc7fb76.xivdyetools-beta.pages.dev | HTTP 200 | old docs/plans only | retained old deployments, see gap-01 |

No record anywhere CNAMEs (visibly) to a third-party, *.workers.dev or released *.pages.dev target. Proxied hosts hide the real CNAME, which is why the CNAME query is empty; the actual targets (Worker custom domains, Pages domains, R2 domain) can only be confirmed through the Cloudflare API.

## Authz / trust matrix for origins

| Allowlist | Entries | Match mode | File |
|---|---|---|---|
| presets-api CORS (prod) | https://xivdyetools.app, https://xiv-colorexplorer.pages.dev, https://beta.xivdyetools.app | exact string (`includes`) | apps/presets-api/src/index.ts:114-118, wrangler.toml:76 |
| oauth FRONTEND_URL / redirect | https://xivdyetools.app only | single origin | apps/oauth/wrangler.toml:21 |
| web-app CSP connect-src | `https://*.xivdyetools.app` wildcard | wildcard | live-headers.txt (CSP) |

## POSITIVE controls
- All 13 live `*.xivdyetools.app` hosts sit in one Cloudflare zone; no wildcard record, so a deleted record cannot silently fall through.
- Retired projectgalatine.com subdomains return NODATA, not dangling CNAMEs; the zone is still held by the maintainer.
- presets-api CORS is exact-match and returns null with no Origin (index.ts:114-118); a `*.pages.dev` hash host is not trusted.
- oauth trusts only xivdyetools.app, so no pages.dev origin can receive a token through the login flow.
- Production Pages project is deployed from main by deploy-web-app.yml:76 and the pages.dev alias serves the same current build with the full CSP/HSTS set.

## Candidates
- gap-hosting-dns-inventory-01 (LOW, INTERNET-UNAUTH): old Pages deployments/branch aliases still served (see below).
- gap-hosting-dns-inventory-02 (LOW, INTERNET-AUTH): presets-api trusts the legacy pages.dev origin.

## REJECTED
- xivdyetools.pages.dev unclaimed: nothing trusts that name (git grep: comment and docs only).
- Subdomain takeover of any *.xivdyetools.app: no unresolved-but-referenced live host; the NXDOMAIN ones are not referenced by code paths that fetch them.
- Dangling projectgalatine.com hosts: NODATA, no CNAME, no wildcard.
- `Access-Control-Allow-Origin: *` on the Pages site (live-headers.txt:~31): static public assets.
- `connect-src https://*.xivdyetools.app`: only a risk if a subdomain dangled, and none does; hardening INFO.

## NOT COVERED
Cloudflare API reads (Pages project list, custom domains, Workers custom domains, deployment list) were not made. Whether the retained old bundles contain specific fixed web findings was not diffed.

FILES COVERED: about 22 tracked files (apps/*/wrangler.toml, .github/workflows/deploy-web-app*.yml, apps/presets-api/src/index.ts, apps/web-app/functions/_middleware.ts, docs/operations/DOMAIN_DEPRECATION.md, evidence/live-headers.txt) plus 40 live DNS/HTTP probes.
