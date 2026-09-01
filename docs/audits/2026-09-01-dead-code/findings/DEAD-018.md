# DEAD-018: moderation-worker `discord-interactions` devDependency — no reference in any source, script or config

**Confidence:** HIGH · **Blast radius:** NONE · **Deploy unit:** apps/moderation-worker · **Semver:** NONE · **Category:** Unused Dependency

## Location
- `apps/moderation-worker/package.json:40` — `"discord-interactions": "^4.4.0"` (devDependencies)

## Evidence
- knip *Unused devDependencies* (`evidence/knip-root.txt`).
- `git ls-files apps/moderation-worker | xargs grep -ln discord-interactions` → `CHANGELOG.md`, `CLAUDE.md`, `package.json` only — no import, no script, no config.
- Signature verification in this worker goes through `@xivdyetools/auth` (Discord Ed25519), which is what replaced this library.
- The repo-wide dependency scan (`evidence/deps-unreferenced.txt`) found no other real orphan: `@types/node`, `@vitest/coverage-v8`, `cross-env`, `@vitest/ui`, `tsx`, `tsup` all have implicit or script-level consumers, and api-worker's `vue` is used by the VitePress theme (`docs/.vitepress/theme/`), outside knip's project glob.

## Fix
**REMOVE** the line, `pnpm install` to update the lockfile, drop the mention from `apps/moderation-worker/CLAUDE.md`. moderation-worker CHANGELOG `### Removed`.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker`.

## Status
OPEN
