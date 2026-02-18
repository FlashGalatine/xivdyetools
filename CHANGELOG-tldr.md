# Changelog — TL;DR

Quick summary of what changed and when. See [CHANGELOG.md](CHANGELOG.md) for full details.

---

## 1.0.0 — 2026-02-18

**Monorepo created.** Consolidated 15 separate repos into one.

- **7 libraries** + **8 apps** + **523 docs** now live in a single pnpm workspace
- **~7,800 tests** all passing
- **CI/CD** via GitHub Actions: auto-lint/test on push, auto-deploy workers on path changes, manual npm publish
- All internal deps use `workspace:*` — no more "did I publish the latest version?" bugs
- Shared TypeScript, ESLint, and Prettier configs at root
- Revoked exposed npm token, secrets moved to GitHub Secrets
- Original repos tagged `archive/pre-monorepo` and preserved
