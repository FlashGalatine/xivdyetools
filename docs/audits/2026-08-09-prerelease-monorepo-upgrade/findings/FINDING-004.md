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

---

## Resolution — Sprint 6, 2026-08-10

**8 of the 14 advisories closed. 4 accepted with a revisit trigger, 2 already out of scope.**

Re-deriving the dependency paths before coding — as this plan's standing guidance requires —
showed **three of the five rows in the table above name the wrong root cause.** `pnpm audit`
prints the *advisory's* patched version, not the patched version of the branch you are actually
on, and a stale-lockfile advisory is indistinguishable from a no-fix-available one. Both
mistakes are recorded here so the next audit does not repeat them.

| Advisory | Original prescription | Actual root cause | What closed it |
|---|---|---|---|
| `undici` 7.28.0 — 1 HIGH + 4 MOD | bump `wrangler`/`miniflare` | ✅ correct | `wrangler ^4.114.0 → ^4.120.0` in all 7 Workers. `wrangler@4.117.0` swapped its internal `miniflare 4 → 5` *inside a minor release*, and miniflare 5 carries `undici 7.29.0`. `apps/oauth` separately declared `miniflare: ^4.20260722.0` — never imported by any test (they use `src/__tests__/mocks/cloudflare-test.ts`) but enough to pin a second, vulnerable `undici 7.28.0`. Deleting that unused devDependency was the rest of the fix. |
| `nanoid` 3.3.16 — HIGH | "build tooling" | **stale lockfile.** `postcss@8.5.26` already requires `nanoid ^3.3.17`; the tree simply held `postcss@8.5.24`. | `pnpm update -r --depth Infinity postcss` (→ 8.5.26, `nanoid 3.3.18`), then `pnpm dedupe` to collapse a duplicate `postcss@8.5.24` that survived inside two peer-keyed `vite@8.1.5(…)` snapshots. No version declaration changed. |
| `brace-expansion` 5.0.7 — 2 HIGH | "glob tooling" | **stale lockfile.** `minimatch@10.2.6` already requires `brace-expansion ^5.0.8`. | same `--depth Infinity` update (→ `minimatch 10.2.6`, `brace-expansion 5.0.9`). No version declaration changed. |
| `vite` 5.4.21 — 1 HIGH + 2 MOD | `pnpm up -r vite@^6.4.3` | **not `web-app`** — it already runs `vite ^8.1.5`. The vulnerable copy is `apps/api-worker > vitepress@1.6.4 > vite@5.4.21`, and **vite 5 has no patched release**: 5.4.21 is the end of the branch and the fix lands in 6.4.3. | **Accepted** — see below. |
| `esbuild` 0.21.5 / 0.27.3 — 1 MOD + 1 LOW | `pnpm up -r esbuild@^0.28.1` | `esbuild` is not a direct dependency anywhere. 0.21.5 is inside the same `vitepress → vite@5` subtree; 0.27.3 is `stoat-worker > tsup@8.5.1`, whose latest release requires `esbuild ^0.27.0` — the 0.28.1 patch is outside that caret. | **Accepted** — see below. |

### Accepted, with revisit triggers

| Advisory | Why accepted | Revisit trigger |
|---|---|---|
| `vite` HIGH (`server.fs.deny` bypass on Windows) + 2 MOD, and `esbuild` MOD, via `api-worker > vitepress@1.6.4` | VitePress 1.6.4 is the current stable release and pins `vite ^5.4.14`; no patched vite 5 exists, so there is nothing to bump to. The only escape is `vitepress@2.0.0-alpha.19` (which depends on `vite ^8.2.0`), and an alpha docs framework is not worth putting into a release for a build-tool advisory. Forcing vite 6+ via a pnpm `override` would push vitepress onto a major it never declared support for. Reachability is a developer running `pnpm --filter xivdyetools-api-worker run docs:dev` **and** browsing a malicious page in the same browser profile; the mitigation in this finding still stands. Nothing here reaches a deployed artefact. | **When VitePress 2 ships stable**, move `api-worker`'s docs to it, verify the docs site builds and renders, and re-run `pnpm audit`. |
| `esbuild` LOW (arbitrary file read via dev server), via `stoat-worker > tsup@8.5.1` | Same parked surface as `FINDING-003`. `tsup`'s newest release caps `esbuild` at `^0.27.0`, so the patched 0.28.1 is unreachable without abandoning tsup. Nobody runs a tsup dev server on a parked app. | Folded into `FINDING-003`'s existing un-parking checklist: **before any `stoat-worker` deploy**, re-run `pnpm audit` and resolve every advisory in its tree. |
| `seroval` CRITICAL, via `stoat-worker > revolt.js` | Out of Sprint 6's scope by design — see `FINDING-003`. | Unchanged. |

### Also folded in

The one-off `minimumReleaseAgeExclude: [postcss]` in `pnpm-workspace.yaml` was retired. Its own
comment set an expiry of 2026-07-29; it had been dead for 12 days, and leaving an expired
supply-chain exemption in place is exactly the kind of drift the policy exists to prevent.

### Verification

`pnpm turbo run build type-check test --force` (fully uncached), `pnpm turbo run lint`, and the
`web-app` Playwright suite — the bundler-shift check the recommendation above asks for.
