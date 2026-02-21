# Cloudflare Pages Functions

This directory contains Cloudflare Pages Functions that run at the edge before serving content.

## `_middleware.ts`

**Purpose:** Handles HTTP 301 permanent redirect from the old domain to the new domain.

**How it works:**
- Runs on every request before any page is served
- Checks if the hostname is `xivdyetools.projectgalatine.com`
- If yes, redirects to `xivdyetools.app` with the same path and query parameters
- Returns HTTP 301 (Permanent Redirect) status

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

Once the old domain is fully deprecated and no longer receives traffic, this middleware can be removed.

## License

MIT © 2025-2026 Flash Galatine
