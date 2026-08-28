# [DEAD-003]: `apps/web-app/netlify.toml` — stale deploy config carrying a third CSP copy

## Category
Dead Config

## Location
- File: `apps/web-app/netlify.toml` (1,824 bytes, last modified 2026-01-19)
- Header: `# Netlify Configuration for XIV Dye Tools v2.0.0`

## Deploy Unit
`web-app`

## Semver Impact
**NONE**

## Evidence

**1. The app deploys to Cloudflare Pages, not Netlify.** The root `CLAUDE.md` documents
`web-app` as *"Vite + Lit + Tailwind"* deployed as Pages, and the deployment story throughout
the monorepo is Cloudflare (`wrangler` for Workers, Pages for the web app). There is no Netlify
account, workflow, or CLI dependency anywhere in the repo.

**2. It is self-declared as v2.0.0 — three majors stale.** The repo is preparing 5.0.

**3. Its build settings are wrong for the current layout.**

```toml
[build]
  publish = "dist"
  command = "npm run build"
```

The monorepo uses **pnpm**, not npm, and this is a workspace package — a bare `npm run build`
at this path would not resolve `workspace:*` dependencies.

**4. It contains a third, independent copy of the CSP.**

```toml
# apps/web-app/netlify.toml:17
    Content-Security-Policy = """
```

That makes three CSP declarations in one package:

| Location | Status |
|---|---|
| `apps/web-app/public/_headers` | ✅ **live** — Cloudflare Pages reads this; copied into `dist/` |
| `apps/web-app/index.html` (meta) | ❌ orphaned (`DEAD-001`) |
| `apps/web-app/netlify.toml` | ❌ inert (this finding) |

## Why It Exists

A v2.0.0-era Netlify deployment that predates the move to Cloudflare Pages. The file was never
removed when the hosting target changed.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | **HIGH** — Netlify is not a deployment target for this project; nothing reads this file |
| **Blast Radius** | **NONE** — inert config; no build, test, or deploy step references it |
| **Reversibility** | **EASY** — `git revert` |
| **Hidden Consumers** | Checked: no GitHub workflow references Netlify; no `netlify` package in any manifest; no `NETLIFY_*` secret in CI docs |

## Recommendation
**REMOVE**

### Rationale

The value here is **not** the 1.8 KiB — it is eliminating a security-relevant drift hazard.

Three CSP declarations in one package means a maintainer hardening the CSP has a 2-in-3 chance
of editing a file that does nothing, then believing the site is protected. That failure mode is
silent and would only surface during an incident. This finding and `DEAD-001` should therefore
land together, leaving `public/_headers` as the single, unambiguous source of truth.

The stale `npm run build` command is a second, smaller trap: it is the kind of line someone
copies when setting up a new deploy target, and it is wrong for a pnpm workspace.

### If Removing

1. Confirm no deployment path depends on it:
   ```bash
   grep -rin "netlify" --include="*.yml" --include="*.yaml" --include="*.json" \
     --include="*.md" . | grep -v node_modules
   ```
   Expect hits only in this file and any historical changelog entries.
2. `git rm apps/web-app/netlify.toml`
3. Confirm `apps/web-app/public/_headers` still carries the intended CSP, and that it appears in
   `dist/` after a build.
4. Land in the same commit as `DEAD-001` with a message that states the outcome plainly —
   e.g. *"chore(web-app): one CSP source of truth (public/_headers); drop the orphaned entry and
   the Netlify config"* — so the security-relevant consolidation is visible in history rather
   than reading as incidental cleanup.

### Related
- `DEAD-001` — orphaned `index.html`, the second CSP copy
- `FINDING-006` / `FINDING-007` — the security audit's informational notes on CSP delivery and
  this file's drifting duplicate
