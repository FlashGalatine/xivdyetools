# Monorepo Setup

**How the workspace is wired: pnpm, Turborepo, TypeScript, and the dependency layering**

For getting a machine running, see [Local Setup](local-setup.md). This document explains the
*structure* — why commands are shaped the way they are, and what breaks when you fight it.

---

## Repository layout

```
xivdyetools/
├── packages/                # Shared libraries (@xivdyetools scope, published to npm)
│   ├── types/               # Branded types and shared interfaces
│   ├── logger/              # Multi-runtime logging with secret redaction
│   ├── auth/                # JWT, HMAC, Discord Ed25519 (+ /encoding)
│   ├── worker-kit/          # Hono middleware + rate limiting (+ /rate-limiter)
│   ├── core/                # Colour algorithms, 125-dye database (+ /blending)
│   ├── svg/                 # Pure SVG card generators (data → SVG string)
│   ├── bot-logic/           # Platform-agnostic bot logic (+ /i18n)
│   └── test-utils/          # CF Workers mocks and factories (workspace-private)
├── apps/                    # Applications
│   ├── discord-worker/      # Primary Discord bot (CF Worker + Hono)
│   ├── image-worker/        # Photon pixel extraction (service-binding only)
│   ├── moderation-worker/   # Moderation bot for community presets
│   ├── presets-api/         # Community presets REST API (CF Worker + D1)
│   ├── oauth/               # Discord OAuth + JWT issuance (CF Worker + D1)
│   ├── api-worker/          # Public API + Universalis proxy + VitePress docs
│   ├── og-worker/           # OpenGraph card generation
│   ├── stoat-worker/        # Revolt bot (Node.js, NOT a CF Worker) — parked
│   └── web-app/             # Main web app (Vite + Lit + Tailwind)
├── docs/                    # This documentation
└── scripts/                 # Repo-level utility scripts
```

`pnpm-workspace.yaml` globs exactly `packages/*` and `apps/*` — a new project in either directory
is picked up automatically on the next install.

---

## Dependency layering

Internal dependencies use the `workspace:*` protocol. Nothing at a given level imports from a
level below it:

```
Level 0   types, logger, auth              (no internal dependencies)
Level 1   test-utils (→ auth, types)
Level 2   core (→ types, logger)
          worker-kit (→ logger)
Level 3   svg (→ core, types)
Level 4   bot-logic (→ core, svg, types)
              │
              ▼
          Applications
```

`stoat-worker` consumes `bot-logic` (including its `/i18n` engine) and `svg`, so it shares
command logic with `discord-worker` despite running on Node.js + Revolt rather than
Cloudflare + Discord.

This layering is what makes `pnpm turbo run build` correct without any manual ordering — see
below.

---

## pnpm

**pnpm 11**, one lockfile at the root, one `node_modules` store. Never `cd` into a package and
run `npm install` — it will produce a nested tree that shadows the workspace links.

Workspace-level policy lives in `pnpm-workspace.yaml`:

| Setting | What it does |
|---------|--------------|
| `overrides` | Pins `typescript` so the workspace shares one compiler; `rollup` and `qs` are security floors |
| `allowBuilds` | Explicit install-script policy. **No dependency is approved to run install scripts.** `esbuild`, `msw`, and `workerd` are deliberately rejected — the workspace builds and tests green without their postinstalls |
| `minimumReleaseAge: 1440` | Supply-chain window: a new release must be ≥ 24 h old before it can be installed, so compromised releases have time to be detected and yanked |

`allowBuilds` fails **open for review, not for install** — a new dependency that adds an install
script is surfaced rather than silently permitted. If you hit that prompt, decide deliberately.

If `minimumReleaseAge` blocks a dependency you genuinely need immediately, add a
`minimumReleaseAgeExclude` entry **with a dated expiry note** and remove it when it lapses. There
is no standing exclusion.

---

## Turborepo

**Turborepo 2.10** orchestrates tasks with dependency-aware caching. The contract lives in
`turbo.json`:

- `build`, `type-check`, `lint`, and `test` all declare `dependsOn: ["^build"]` — a task on a
  package waits for its *dependencies'* builds. This is why `pnpm turbo run build` needs no
  manual ordering.
- `build` caches on `src/**`, the tsconfigs, and `package.json`, outputting `dist/**`.
- `test` caches on `src/**`, `tests/**`, `scripts/**/*.js`, and the vitest config. The
  `scripts/**/*.js` entry is deliberate — CI-gate scripts like web-app's deploy smoke test live
  there and must invalidate the cache like source does.
- `dev` is `persistent: true` and uncached; `deploy` is uncached and depends on `build` and
  `type-check`.

### Filter syntax you'll actually use

```bash
pnpm turbo run build --filter=@xivdyetools/core        # just this package
pnpm turbo run build --filter=xivdyetools-web-app...   # ...and its dependencies
pnpm turbo run test  --filter='./packages/*'           # by directory
pnpm turbo run lint  --filter='...[HEAD^]'             # only what the last commit affected
```

The trailing `...` is the one to remember: without it you build the target against whatever stale
`dist/` its dependencies happen to have.

CI uses the `'...[HEAD^]'` affected-filter, with `--concurrency=3` on the test task — see
[Troubleshooting](troubleshooting.md#ci-test-job-dies-with-exit-1-and-no-assertion-failure) for
why that bound exists.

---

## TypeScript

**TypeScript 5.9** with a shared `tsconfig.base.json`: strict, ES2022, bundler resolution,
`verbatimModuleSyntax`.

That last flag means **type-only imports must be marked explicitly**:

```typescript
import type { Dye } from '@xivdyetools/types';   // ✅
import { Dye } from '@xivdyetools/types';        // ❌ compile error
```

Packages additionally carry a `tsconfig.build.json` with `stripInternal: true`, so
`@internal`-annotated symbols are excluded from published `.d.ts` output.

---

## Other tooling

| Tool | Version | Notes |
|------|---------|-------|
| Node | 22+ | Matches CI |
| Vitest | 4 | Every package and app |
| Playwright | — | `web-app` E2E only; Chromium is the gating project |
| ESLint | 10 | Flat config with typescript-eslint |
| Prettier | 3 | Formatting |
| Wrangler | — | Cloudflare Worker dev and deploy |

---

## Related Documentation

- [Local Setup](local-setup.md) — machine prerequisites and first run
- [Contributing](contributing.md) — branches, commits, PR checklist
- [Testing](testing.md) — test strategy
- [Deployment](deployment.md) — how projects reach production
- [Architecture Overview](../architecture/overview.md) — how the projects interconnect
- [Dependency Graph](../architecture/dependency-graph.md) — the full npm and service dependency map
