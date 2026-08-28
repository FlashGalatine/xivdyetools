# [FINDING-002]: `presets-api` allows `localhost` CORS origins in production with `credentials: true`

## Severity
MEDIUM

## Category
A05:2021 Security Misconfiguration · CWE-942 (Overly Permissive Cross-domain Whitelist) · CWE-1220 (Insufficient Granularity of Access Control)

## Location
- File: [apps/presets-api/src/index.ts](../../../../apps/presets-api/src/index.ts)
- Lines: 111–121 (the unguarded block), 130 (`credentials: true`)
- Function: the `origin` callback passed to `cors()`

## Deploy Unit
`presets-api`

## Exposure
**INTERNET-UNAUTH** — the misconfiguration is served to any unauthenticated requester on
`api.xivdyetools.app`. Exploitation additionally requires attacker-controlled content running
on one of four specific loopback origins.

## Rotation Required
NONE.

## Description

The CORS `origin` callback ends with an **unconditional** loopback allowlist. Every sibling
guard in this file checks `c.env.ENVIRONMENT`; this one does not.

The comment above the block states the intent plainly — *"Only allow specific localhost ports
**in development**"* — and `apps/presets-api/CLAUDE.md` documents it the same way
("In dev mode only, specific localhost ports are also allowed"). **The code implements neither
claim.** `ENVIRONMENT` is available and correct in this Worker (`wrangler.toml` sets
`ENVIRONMENT = "production"` under `[env.production]`, and lines 58/68/83/191/228 of this same
file already branch on it), so the guard was simply omitted.

The `oauth` Worker solved exactly this problem — its equivalent block is wrapped in
`if (env.ENVIRONMENT === 'development')` and annotated `OAUTH-SEC-001`. **The fix landed in one
Worker and was never mirrored to its sibling.**

## Evidence

```ts
// apps/presets-api/src/index.ts:111-121  — production reaches this
      // SECURITY: Only allow specific localhost ports in development
      // This prevents malicious apps on other localhost ports from making requests
      const allowedDevOrigins = [
        'http://localhost:5173',   // Vite dev server
        'http://127.0.0.1:5173',   // Vite dev server (IP)
        'http://localhost:8787',   // Wrangler local dev
        'http://127.0.0.1:8787',   // Wrangler local dev (IP)
      ];
      if (allowedDevOrigins.includes(origin)) {   // ← no ENVIRONMENT check
        return origin;
      }

      return null;
    },
    …
    credentials: true,
```

Contrast — the sibling Worker gets it right:

```ts
// apps/oauth/src/index.ts:82-84
      // SECURITY: Only allow localhost in development environment
      // Prevents malicious localhost apps from accessing OAuth in production
      if (env.ENVIRONMENT === 'development') {          // ← the guard
        …ALLOWED_LOCALHOST_PORTS check…
      }
```

Production configuration confirming the branch is live:

```toml
# apps/presets-api/wrangler.toml:29-31
[env.production]
vars = { ENVIRONMENT = "production", …, CORS_ORIGIN = "https://xivdyetools.app", … }
```

## Impact

Production `api.xivdyetools.app` reflects `Access-Control-Allow-Origin` for four loopback
origins together with `Access-Control-Allow-Credentials: true`. Any content the user's browser
loads from `http://localhost:5173` or `:8787` — a malicious or compromised local dev server, a
locally-installed Electron/desktop app serving on those ports, or a package post-install script
that binds one — can make **credentialed, cross-origin reads** against the production API and
read the responses.

**Realistic impact is bounded, and this is why it is MEDIUM rather than HIGH:**

- The application has **no cookie surface at all** (verified: zero `Set-Cookie` /
  `document.cookie` hits repo-wide). Auth is `Authorization: Bearer` from script-held storage,
  which the browser does not attach automatically. `credentials: true` therefore does **not**
  hand an attacker ambient authority.
- Without a token, a local attacker can reach only the same public, unauthenticated reads it
  could already obtain server-side with `curl`.

What the flaw actually costs is **defence in depth**: it converts a would-be single-origin
policy into a four-extra-origin policy on a credentialed endpoint, and it silently disagrees
with its own documentation — the kind of drift that becomes exploitable the moment a future
change introduces cookie or same-origin-implied auth.

## Recommendation

Wrap the block in the same environment guard the `oauth` Worker uses:

```ts
      // SECURITY: Only allow specific localhost ports in development.
      // Mirrors OAUTH-SEC-001 in apps/oauth/src/index.ts — production must not
      // reflect loopback origins on a credentialed endpoint.
      if (env.ENVIRONMENT === 'development') {
        const allowedDevOrigins = [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:8787',
          'http://127.0.0.1:8787',
        ];
        if (allowedDevOrigins.includes(origin)) {
          return origin;
        }
      }

      return null;
```

Then add a regression test asserting that with `ENVIRONMENT: 'production'` the callback returns
`null` for `http://localhost:5173`, and returns the origin when `ENVIRONMENT: 'development'`.
`presets-api` already has 17 test files and the `Env` object is injectable, so this is cheap.

**Also sweep the other Workers for the same omission** as part of the fix — the lesson of this
finding is that `OAUTH-SEC-001` was fixed instance-by-instance rather than as a class.
`api-worker` is fine (`origin: '*'` but `credentials: false`, read-only), and `discord-worker`
uses a static production-only array, so `presets-api` is believed to be the only outstanding
case — confirm rather than assume.

## References
- CWE-942: Permissive Cross-domain Policy with Untrusted Domains
- OWASP A05:2021 — Security Misconfiguration
- Internal precedent: `OAUTH-SEC-001` (`apps/oauth/src/index.ts:67-69`)
- Contradicted documentation: `apps/presets-api/CLAUDE.md` § CORS
