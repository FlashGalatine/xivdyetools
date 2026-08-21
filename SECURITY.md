# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private vulnerability reporting for this repository
(**Security → Report a vulnerability**), which reaches the maintainer directly and keeps the report
private until a fix is published. If that form is unavailable, contact the maintainer through the
links on <https://xivdyetools.app/about> and say it is security-related.

Please include: the affected surface (web app, a specific Worker, a Discord command, an npm
package), steps to reproduce, and the impact you believe it has. Anything that touches user data,
authentication (`auth.xivdyetools.app`), the community presets API (`api.xivdyetools.app`), or the
Discord bots gets looked at first.

## What to expect

- Acknowledgement within a few days; a fix or mitigation as fast as severity warrants (the
  Workers and the web app deploy from `main` on merge, so fixes can ship the same day).
- Credit in the changelog if you want it.
- No bug bounty — this is a volunteer, MIT-licensed project.

## Scope

In scope: everything in this monorepo — the web app, the Cloudflare Workers, the Discord /
Revolt bots and the published `@xivdyetools/*` npm packages.
Out of scope: Final Fantasy XIV itself, Square Enix services, Discord, and third-party services
the project calls (XIVAPI, Universalis, XIVAuth, Cloudflare).

## How the project keeps itself honest

- Periodic whole-monorepo audits with every finding tracked to closure
  (`docs/audits/`, latest `docs/audits/2026-08-21-security/`).
- CI: `pnpm audit --prod` nightly, gitleaks secret scanning on every push / PR, SHA-pinned
  GitHub Actions with least-privilege tokens, OIDC trusted publishing to npm (no long-lived tokens).
- Secrets are never committed; rotation procedures live in `docs/operations/SECRET_ROTATION.md`.
