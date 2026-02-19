# Changelog — TL;DR

Quick summary of what changed and when. See [CHANGELOG.md](CHANGELOG.md) for full details.

---

## 1.1.0 — 2026-02-19

**Security audit remediation.** Fixed 8 findings from the 2026-02-18 audit (2 false positives confirmed).

- **presets-api 1.4.13** / **og-worker 1.0.3** / **moderation-worker 1.1.5**: Env validation hardened, OG image param bounds added
- **oauth 2.3.6**: `STATE_TRANSITION_PERIOD` blocked in production
- **web-app 4.1.7**: Cache cleared on logout, cross-tab session sync, token expiry guard
- **core 1.17.0** / **universalis-proxy 1.4.1**: Cache hit/miss metrics and structured logging (OPT-002)
- **types 1.8.0**: Shared `DiscordSnowflake` validation replaces inline regex in 4 files (FINDING-002)
- New `DEPRECATIONS.md` for tracking removal timelines

## 1.0.0 — 2026-02-18

**Monorepo created.** Consolidated 15 separate repos into one.

- **7 libraries** + **8 apps** + **523 docs** now live in a single pnpm workspace
- **~7,800 tests** all passing
- **CI/CD** via GitHub Actions: auto-lint/test on push, auto-deploy workers on path changes, manual npm publish
- All internal deps use `workspace:*` — no more "did I publish the latest version?" bugs
- Shared TypeScript, ESLint, and Prettier configs at root
- Revoked exposed npm token, secrets moved to GitHub Secrets
- Original repos tagged `archive/pre-monorepo` and preserved
