# [FINDING-004]: Dev-toolchain advisories — `vite` fs.deny bypass (Windows), `esbuild`, `undici`, `brace-expansion`, `nanoid`

## Severity
LOW

## Category
A06:2021 Vulnerable and Outdated Components · CWE-1395

## Location
- Repo-wide `devDependencies`; none of these packages is bundled into a deployed artefact.

| Package | Advisories | Vulnerable | Patched | Reaches production? |
|---|---|---|---|---|
| `vite` | fs.deny bypass on Windows alternate data streams (HIGH); path traversal in optimized deps (MOD); `launch-editor` NTLMv2 hash disclosure via UNC path (MOD) | `<=6.4.2` | `>=6.4.3` | **No** — build tool + dev server |
| `esbuild` | any website can send requests to the dev server (MOD); arbitrary file read (LOW) | `<=0.24.2` / `>=0.27.3 <0.28.1` | `>=0.24.3` / `>=0.28.1` | **No** — bundler |
| `undici` | cross-user information disclosure (HIGH); downstream response, CRLF injection, cookie attribute injection (MOD ×3) | `>=7.0.0 <7.29.0` | `>=7.29.0` | **No** — via `miniflare`/`wrangler` and `jsdom`/`vitest` |
| `brace-expansion` | DoS via unbounded expansion (HIGH ×2) | `>=4.0.0 <5.0.8` / `<5.0.9` | `>=5.0.9` | **No** — glob tooling |
| `nanoid` | custom generators can loop indefinitely (HIGH) | `<3.3.17` | `>=3.3.17` | **No** — build tooling |

## Deploy Unit
Repo-wide `devDependencies` — no deploy unit ships these.

## Exposure
**LOCAL** — developer workstations and CI runners only. Cloudflare Workers bundle only their
declared runtime dependencies; `wrangler`, `miniflare`, `vitest`, `jsdom` and `vite` are absent
from every deployed artefact.

## Rotation Required
NONE.

## Description

`pnpm audit`'s remaining 5 high / several moderate advisories all resolve to build-and-test
tooling. They do not reach any deployed Worker or the Pages bundle. They are nonetheless worth
scheduling because two of them are meaningfully reachable **on a developer's machine**:

- **`vite` `server.fs.deny` bypass via Windows alternate data streams** is the notable one.
  This project's primary development platform is Windows (the audit itself runs on
  Windows 11), and the bypass lets a page loaded in the browser during `pnpm dev` read files
  the dev server intended to deny. Combined with the `esbuild` "any website can send requests
  to the dev server" advisory, a malicious page open in the same browser as a running dev
  server is a credible local threat.
- **`launch-editor` NTLMv2 hash disclosure via UNC path** is likewise Windows-specific and
  leaks an authentication hash, not just file content.

`undici` (via `miniflare`/`wrangler`/`jsdom`) and `brace-expansion` / `nanoid` are lower
concern: they execute against inputs the developer already controls.

## Evidence

```
$ pnpm audit
 high      vite: `server.fs.deny` bypass on Windows alternate …
   Package vite   Vulnerable <=6.4.2   Patched >=6.4.3
 moderate  launch-editor: NTLMv2 hash disclosure via UNC path
   Package vite   Vulnerable <=6.4.2   Patched >=6.4.3
 moderate  esbuild enables any website to send any requests to …
   Package esbuild   Vulnerable <=0.24.2   Patched >=0.24.3
 high      undici vulnerable to cross-user information disclosure
   Package undici   Vulnerable >=7.0.0 <7.29.0   Patched >=7.29.0
…
18 vulnerabilities found
Severity: 2 low | 10 moderate | 5 high | 1 critical
```

```
$ pnpm why undici
undici@7.28.0
└─┬ miniflare@4.20260722.0
  ├─┬ wrangler@4.114.0
  │ ├── xivdyetools-api-worker@0.5.0 (devDependencies)      ← dev only
  …
undici@8.9.0
└─┬ jsdom@30.0.0
  ├─┬ vitest@4.1.10 …                                       ← dev only
```

## Impact

No production impact. On a developer workstation running `pnpm dev`, a malicious page open in
the same browser could read files outside the served root (`vite`) or, on Windows, trigger an
outbound UNC fetch that leaks an NTLMv2 hash (`launch-editor`). CI runners are lower risk —
short-lived, no browser.

## Recommendation

Fold into a routine maintenance pass, **separate from any Worker deploy** — these packages
change build behaviour, so they deserve their own verification gate rather than riding a
security hotfix:

```bash
pnpm up -r vite@^6.4.3 esbuild@^0.28.1
pnpm up -r wrangler miniflare        # pulls undici >= 7.29.0
pnpm install
pnpm turbo run build type-check test --force
```

`vite` 6.4.2 → 6.4.3 and `esbuild` → 0.28.1 are patch/minor bumps, but bundler upgrades can
shift output; run the **full uncached** gate (`--force`) and, for `web-app`, the Playwright E2E
suite before accepting.

Until upgraded, mitigate cheaply: do not browse untrusted sites in the same browser profile
while a dev server is running.

## References
- GHSA advisories in `evidence/pnpm-audit.json`
- OWASP A06:2021 — Vulnerable and Outdated Components
