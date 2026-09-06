# Cloudflare Pages Functions

This directory contains Cloudflare Pages Functions that run at the edge before serving content.

## `_middleware.ts`

**Purpose:** two things — a 301 redirect off the old domain, and a guard that keeps the SPA catch-all out of the immutable asset cache.

**How it works:**
- Runs on every request before any page is served
- **Domain redirect:** if the hostname is `xivdyetools.projectgalatine.com`, redirects to `xivdyetools.app` with the same path and query parameters, HTTP 301 (Permanent Redirect)
- **`/assets/*` guard (FINDING-027):** for any path under `/assets/`, the middleware inspects the response and answers `404` with `Cache-Control: no-store` when it came back as `text/html`. `public/_redirects` answers every unmatched path with `/index.html 200`, and Cloudflare Pages *merges* overlapping `_headers` patterns — so without this, a request for a hashed asset that a deployment does not have was served the HTML fallback carrying `max-age=31536000, immutable`, and was then cached as that script for a year (the 2026-08 cache-poisoning incident)

**Benefits:**
- Version controlled (unlike dashboard-based redirects)
- Automatic deployment with every push
- Preserves full URL path and query parameters
- Fast edge execution (runs on Cloudflare's CDN)

## Testing

After deployment, test the redirect:

```bash
curl -I https://xivdyetools.projectgalatine.com/
```

Expected response:
```
HTTP/2 301
location: https://xivdyetools.app/
```

## Removal

Only the **domain-redirect block** may go, once the old domain is fully deprecated and no longer receives traffic. The `/assets/*` guard must stay — it is the standing fix for FINDING-027 and is not tied to the old domain at all.

## License

MIT © 2025-2026 Flash Galatine
