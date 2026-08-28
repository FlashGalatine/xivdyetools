# [FINDING-001]: `hono` 4.12.32 ships four unpatched advisories, including a CORS ReDoS reachable on every Worker

## Severity
MEDIUM

## Category
A06:2021 Vulnerable and Outdated Components · CWE-1395 · CWE-1333 (ReDoS) · CWE-407 (Algorithmic Complexity)

## Location
- File: `apps/api-worker/package.json:25`, `apps/discord-worker/package.json:35`,
  `apps/moderation-worker/package.json:34`, `apps/oauth/package.json:21`,
  `apps/og-worker/package.json:26`, `apps/presets-api/package.json:26`,
  `packages/worker-kit/package.json:62,74` (peer + dev)
- Installed version: `hono@4.12.32` (single hoisted copy, verified via `node_modules/.pnpm`)
- Declared range: `^4.12.32` — the caret **permits** the fix; the lockfile pins below it

## Deploy Unit
All six Cloudflare Workers (`api-worker`, `discord-worker`, `moderation-worker`, `oauth`,
`og-worker`, `presets-api`) plus `@xivdyetools/worker-kit`, which declares `hono` as a peer
dependency.

## Exposure
**INTERNET-UNAUTH** — the CORS middleware runs on `app.use('*', ...)` in every Worker, ahead of
authentication. An unauthenticated request carrying a crafted `Origin` header reaches the
vulnerable code path. The Language middleware advisory applies wherever locale negotiation
runs.

## Rotation Required
NONE.

## Description

`hono` is the HTTP framework for all six Workers. The pinned 4.12.32 predates 4.12.34, which
fixes four advisories:

| Advisory | Severity | Reachability in this codebase |
|---|---|---|
| ReDoS in CORS middleware via crafted `Origin` | MODERATE | **Directly reachable.** Every Worker mounts `cors()` on `'*'` before auth |
| Algorithmic Complexity DoS in Language middleware | MODERATE | Reachable where locale negotiation runs (`api-worker` `localeMiddleware`, og-worker `?lang=`) |
| `memo()` retains SSR output across requests | MODERATE | Not reachable — no `memo()` / SSR usage in this codebase |
| Proxy Helper does not strip `Connection`-listed response headers | LOW | Not reachable — no Proxy Helper usage |

Two of the four are reachable. Neither yields data disclosure or privilege escalation; the
realistic impact is **CPU exhaustion on a Worker isolate**, which on Cloudflare's platform
manifests as CPU-limit termination and elevated error rates rather than a full outage.

## Evidence

```
$ pnpm audit
 moderate  Hono: ReDoS in CORS middleware via …
   Package hono   Vulnerable <4.12.34   Patched >=4.12.34
 moderate  Hono: Algorithmic Complexity DoS in Language …
   Package hono   Vulnerable >=4.12.0 <4.12.34   Patched >=4.12.34
 moderate  Hono: `memo()` retains SSR output across requests …
   Package hono   Vulnerable >=3.8.0 <4.12.34   Patched >=4.12.34
 low       Hono: Proxy Helper does not remove response headers …
   Package hono   Vulnerable >=4.7.0 <4.12.34   Patched >=4.12.34
   Paths: apps__api-worker>hono, apps__discord-worker>hono,
          apps__moderation-worker>hono, … 7 paths total

$ ls node_modules/.pnpm | grep '^hono@'
hono@4.12.32
```

The reachable middleware, identical in shape across all six Workers:

```ts
// apps/presets-api/src/index.ts:89 — mounted on '*', before authMiddleware
app.use('*', cors({ origin: (origin, c) => { … }, credentials: true }));
```

## Impact

An unauthenticated attacker sending crafted `Origin` (or `Accept-Language`) headers can force
super-linear CPU work inside the CORS/Language middleware on any of the six public Workers.
Sustained, this consumes the per-request CPU budget and degrades availability for legitimate
traffic. No confidentiality or integrity impact.

## Recommendation

Bump to `^4.12.34` in all seven manifests and refresh the lockfile:

```bash
pnpm -r --filter './apps/*' --filter '@xivdyetools/worker-kit' up hono@^4.12.34
pnpm install
pnpm turbo run type-check test --force
```

This is a **patch-level bump inside the same minor** — no API surface change is expected. The
existing type-check and 24-task test suite are sufficient regression cover; re-run them
uncached before deploying.

Deploy order does not matter for correctness (no cross-Worker contract changes), so this can
ride each Worker's normal deploy. Because it touches every Worker, it is the natural
prerequisite sprint for the release.

Consider adding a non-blocking `pnpm audit` step to CI so this class of drift is visible
continuously rather than at audit time.

## References
- GHSA advisories surfaced by `pnpm audit` (see `evidence/pnpm-audit.json`)
- CWE-1333: Inefficient Regular Expression Complexity
- CWE-407: Inefficient Algorithmic Complexity
- OWASP A06:2021 — Vulnerable and Outdated Components
