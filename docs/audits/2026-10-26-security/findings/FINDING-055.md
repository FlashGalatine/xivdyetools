# FINDING-055: Zone `xivdyetools.app` has Always Use HTTPS off and minimum TLS 1.0: `api.`, `auth.` and `data.` answer 200 over plaintext HTTP
**Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** Cloudflare zone settings (dashboard; no repo file) · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-319
**Found by:** the live-state pass (read-only Cloudflare query) and an independent Opus verifier, who graded it INFO because browsers are protected by HSTS preloading

## Location
- Cloudflare zone `xivdyetools.app`: `always_use_https: off`, `min_tls_version: 1.0`, zone-level HSTS (`security_header`) disabled — dashboard settings, not in the repo
- `apps/oauth/src/index.ts:129-133`, `apps/discord-worker/src/index.ts:270`, `apps/presets-api/src/index.ts:95` — "Enforce HTTPS" comments that overstate what a worker-set HSTS header does

## Evidence
- `HEAD http://api.xivdyetools.app/`, `http://data.xivdyetools.app/`, `http://auth.xivdyetools.app/` each return **200 OK** with no redirect to HTTPS ([capture](../evidence/live-headers-http-and-retired.txt)); the zone settings come from `GET /zones/{id}/settings/*` ([evidence](../evidence/live-state-cloudflare-2026-10-26.md)). A worker's `Strict-Transport-Security` header on an HTTP response is ignored (RFC 6797), so it does not enforce anything there.
- Mitigated: the whole `.app` TLD is on browsers' built-in HSTS preload list, so browsers refuse plaintext to these hosts. `git grep` finds no first-party `http://` use of these hosts (only negative tests); the bots reach presets-api through service bindings; `data.` serves public JSON. Only a non-browser client that is pointed at `http://`, or that negotiates TLS 1.0/1.1, is exposed (a Bearer token on `api.`, an OAuth code on `auth.`).

## Fix
- Dashboard → SSL/TLS → Edge Certificates: turn **Always Use HTTPS** on and set **Minimum TLS Version** to 1.2. No first-party consumer needs either the HTTP or the TLS 1.0 path.
- Add both settings to the live-origin probe checklist (2026-10-03 report, recommendation 1) and reword the three "Enforce HTTPS" comments.

## Status
FIXED 2026-10-26 — maintainer-authorized zone settings changes: Always Use HTTPS on and minimum TLS 1.2. Fresh API readbacks, five HTTP-to-HTTPS redirects ending in 200, and explicit TLS 1.0/1.1 rejection plus 1.2 acceptance verified; [execution evidence](../evidence/remediation-finding-055-2026-10-26.md). No code deploy or repository commit was needed for the live action. The three HSTS-comment wording cleanups remain companion work for the owning app sprints.
