# XIV Dye Tools

A comprehensive suite of color/dye tools for Final Fantasy XIV, built as a pnpm monorepo with Turborepo.

## Quick Start

```bash
pnpm install
pnpm turbo run build
pnpm turbo run test
```

## Structure

- **`packages/`** — 7 shared npm libraries under `@xivdyetools` scope
- **`apps/`** — 8 applications (6 Cloudflare Workers, 1 web app, 1 dev tool)
- **`docs/`** — Architecture, specifications, and guides

See [CLAUDE.md](CLAUDE.md) for detailed development guidance.

## License

MIT
