# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`xivdyetools-api-docs` is the **public documentation site** for the XIV Dye Tools REST API exposed by [`apps/api-worker`](../api-worker/). It is a static [VitePress 1.6](https://vitepress.dev) site (Vue 3) deployed to **Cloudflare Pages** under the project name `xivdyetools-api-docs`. The user-facing URL pairs with `data.xivdyetools.app` (the API itself).

Content is split into two top-level sections — a **Guide** (quick-start, response/error envelope, rate limits) and a **Reference** (per-endpoint pages with parameter tables and a custom `<TryIt>` Vue component that fires real requests against the live API). Local search is enabled via VitePress's built-in `provider: 'local'` index.

## Commands

```bash
pnpm dev        # vitepress dev — hot-reload preview at http://localhost:5173
pnpm build      # vitepress build — emits static site to .vitepress/dist/
pnpm preview    # vitepress preview — serve the built site for verification
```

Run from this directory or via Turborepo: `pnpm turbo run build --filter=xivdyetools-api-docs`.

## Architecture

VitePress is a Vite-based static site generator. Markdown files become routes (`guide/index.md` → `/guide/`), with `.vitepress/config.ts` defining nav + sidebar. The `home` layout in `index.md` produces the marketing landing page; all other pages use the default doc layout.

### Key Directories

```
apps/api-docs/
├── index.md                      # Landing page (frontmatter `layout: home`, hero + features)
├── guide/
│   ├── index.md                  # Quick Start (base URL, first request, ID auto-detection, locale)
│   ├── responses.md              # Response envelope spec
│   ├── errors.md                 # Error codes + status mapping
│   └── rate-limits.md            # 60 req/min, headers, 429 handling
├── reference/
│   ├── index.md                  # API overview / endpoint index
│   ├── dyes.md                   # 7 dye endpoints (search, list, batch, stain, :id, etc.)
│   └── matching.md               # 2 color-matching endpoints (closest, within-distance)
├── .vitepress/
│   ├── config.ts                 # Site title, nav, sidebar, social links, footer, search
│   ├── theme/
│   │   ├── index.ts              # Extends DefaultTheme + registers <TryIt> globally
│   │   ├── custom.css            # Brand-color overrides
│   │   └── components/
│   │       └── TryIt.vue         # Interactive request widget (fetches data.xivdyetools.app)
│   └── dist/                     # Build output (gitignored — emitted by `pnpm build`)
├── package.json
├── turbo.json                    # Declares `.vitepress/dist/**` as the `build` task output
└── LICENSE
```

### Site Configuration

`.vitepress/config.ts` highlights:
- `title: 'XIV Dye Tools API'`, `cleanUrls: true` (no `.html` suffixes)
- `themeColor: #c0a060` (brand gold)
- `nav`: Guide, Reference, link out to `xivdyetools.app`
- Sidebar groups per section (Getting Started for `/guide/`, API Reference for `/reference/`)
- `socialLinks`: Discord invite
- `footer`: SE © notice + fan-project disclaimer
- `search.provider: 'local'` — no third-party search index

## Authoring Patterns

### Page Frontmatter

Most pages use no frontmatter; VitePress falls back to defaults. The landing page `index.md` is the exception — it sets `layout: home` and provides VitePress's `hero` + `features` schema (see existing `index.md` for the structure).

### Documenting an Endpoint

Each endpoint in `reference/dyes.md` and `reference/matching.md` follows the same pattern:

````md
## GET /v1/dyes/:id

Look up a single dye. The ID type is inferred by numeric range — see [ID auto-detection](../guide/#dye-id-auto-detection).

### Parameters

| Name | In | Description |
|---|---|---|
| `id` | path | itemID, stainID (1–125), or Facewear ID (negative) |
| `locale` | query | Locale for `localizedName` |

<TryIt
  endpoint="/v1/dyes/:id"
  :params="[
    { name: 'id', in: 'path', required: true, default: '5729', description: '...' },
    { name: 'locale', in: 'query', required: false, default: 'en', description: '...', options: ['en', 'ja', 'de', 'fr', 'ko', 'zh'] }
  ]"
/>

Example response:

```json
{ ... }
```

---
````

The `---` horizontal rule separates endpoints. `<TryIt>` is the same component used everywhere; its props are typed in `theme/components/TryIt.vue`:

```ts
interface Param {
  name: string
  in: 'path' | 'query'
  required: boolean
  default?: string
  description: string
  options?: string[]   // becomes a <select> dropdown
}
```

When adding a new endpoint:
1. Add a `## METHOD /path` heading (this becomes the anchor link).
2. Add a Parameters table.
3. Add a `<TryIt>` component with sensible defaults so a fresh visitor gets a successful response without typing.
4. Optional: include a JSON example response.
5. Update `.vitepress/config.ts` sidebar **only** if you create a new top-level page (not a new section in an existing page).

### Cross-Links

Use root-relative paths without the `.md` extension (works because of `cleanUrls`):
- `[Quick Start](/guide/)`
- `[Dyes Reference](../reference/dyes)`
- In-page anchors: `[ID auto-detection](../guide/#dye-id-auto-detection)`

The hero `actions` in `index.md` and the `nav`/`sidebar` arrays in `config.ts` use the same path style.

### Code Blocks

Use language fences (` ```bash `, ` ```json `, ` ```http `) — VitePress applies Shiki syntax highlighting automatically. No special line-highlight syntax is currently used.

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `vitepress` | `^1.6.4` | Static-site generator (Vite + Vue 3 + Shiki + built-in local search) |
| `vue` | `^3.5.33` | Required peer for Vitepress + the `<TryIt>` component |

No internal `@xivdyetools/*` workspace dependencies — the docs site is fully decoupled from the rest of the monorepo. It documents `api-worker`'s wire contract by hand; if endpoint signatures change, both this site and the worker must be updated together.

## Related Projects

**Documents:** [`apps/api-worker/`](../api-worker/) — the Cloudflare Worker that backs every endpoint shown here. The `<TryIt>` widget calls `https://data.xivdyetools.app` directly.

**Sibling:** the internal `docs/` folder at the monorepo root holds architecture notes, deployment guides, and specs for **maintainers** — those are private docs and never deploy. This `api-docs/` site is for **API consumers** and is the public contract.

## Deployment

Deployed via `.github/workflows/deploy-api-docs.yml` to **Cloudflare Pages** (project: `xivdyetools-api-docs`).

Pipeline:
1. Triggered on push to `main` matching `apps/api-docs/**` or the workflow file itself, plus manual `workflow_dispatch`.
2. `pnpm install --frozen-lockfile`
3. `pnpm turbo run build --filter=xivdyetools-api-docs` → emits `.vitepress/dist/`
4. `cloudflare/wrangler-action@v3` runs `wrangler pages deploy .vitepress/dist --project-name=xivdyetools-api-docs`
5. Smoke test: `curl --fail` against `https://xivdyetools-api-docs.pages.dev/` (per ARCH-002).

The deployment uses `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets. There is no preview/staging environment for docs — every push to `main` ships to the public URL.

### Local Verification Before Pushing

```bash
pnpm build && pnpm preview
```

Then click through every page in the sidebar and exercise at least one `<TryIt>` widget on each reference page to confirm the live API contract still matches what's documented.
