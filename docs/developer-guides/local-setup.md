# Local Development Setup

**Setting up your development environment for XIV Dye Tools**

---

## Prerequisites

### Required

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | 22+ | [nodejs.org](https://nodejs.org/) |
| **pnpm** | 10+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| **Git** | 2.40+ | [git-scm.com](https://git-scm.com/) |

### For Workers Development

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Wrangler** | Cloudflare CLI | Installed as workspace devDependency (no global install needed) |
| **Cloudflare account** | Deploy workers | [cloudflare.com](https://cloudflare.com/) |

### Optional

| Tool | Purpose | Installation |
|------|---------|--------------|
| **VS Code** | Recommended IDE | [code.visualstudio.com](https://code.visualstudio.com/) |
| **Discord Developer App** | Bot testing | [discord.com/developers](https://discord.com/developers) |

---

## Clone and Install

```bash
git clone https://github.com/your-username/xivdyetools.git
cd xivdyetools
pnpm install
```

This installs dependencies for all packages and apps in the monorepo via pnpm workspaces.

---

## Building

```bash
# Build everything (Turborepo handles dependency order)
pnpm turbo run build

# Build a specific package
pnpm turbo run build --filter=@xivdyetools/core

# Build all packages only
pnpm turbo run build --filter='./packages/*'

# Build all apps only
pnpm turbo run build --filter='./apps/*'
```

---

## Running Tests

```bash
# Test everything
pnpm turbo run test

# Test a specific package
pnpm turbo run test --filter=@xivdyetools/core

# Run a single test file
pnpm --filter @xivdyetools/core exec vitest run src/services/DyeService.test.ts

# Test with coverage
pnpm --filter @xivdyetools/core run test:coverage
```

---

## Dev Servers

### Web App

```bash
pnpm --filter xivdyetools-web-app run dev
# Runs on http://localhost:5173
```

### OAuth Worker

```bash
pnpm --filter xivdyetools-oauth run dev
# Runs on http://localhost:8788
```

### Presets API

```bash
pnpm --filter xivdyetools-presets-api run dev
# Runs on http://localhost:8787
```

**First-time setup for Presets API** — apply local database schema:

```bash
pnpm --filter xivdyetools-presets-api run db:migrate:local
```

### Discord Worker

```bash
pnpm --filter xivdyetools-discord-worker run dev
# Runs on http://localhost:8976
```

**First-time setup** — login to Cloudflare:

```bash
pnpm --filter xivdyetools-discord-worker exec wrangler login
```

### Full Stack Development

To run the entire ecosystem locally, open separate terminals for each service:

```bash
# Terminal 1: Web App
pnpm --filter xivdyetools-web-app run dev

# Terminal 2: OAuth Worker
pnpm --filter xivdyetools-oauth run dev

# Terminal 3: Presets API
pnpm --filter xivdyetools-presets-api run dev

# Terminal 4: Discord Worker (optional)
pnpm --filter xivdyetools-discord-worker run dev
```

---

## Required Secrets

Each worker uses `.dev.vars` for local secrets:

```bash
# apps/discord-worker/.dev.vars
DISCORD_TOKEN=your-token
DISCORD_PUBLIC_KEY=your-key
BOT_API_SECRET=local-secret
```

```bash
# apps/oauth/.dev.vars
DISCORD_CLIENT_SECRET=your-client-secret
JWT_SECRET=your-jwt-secret
```

```bash
# apps/presets-api/.dev.vars
BOT_API_SECRET=your-api-secret
JWT_SECRET=your-jwt-secret
```

See [Environment Variables](environment-variables.md) for a complete list per project.

---

## VS Code Configuration

### Recommended Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "lit-plugin.lit-plugin",
    "ms-playwright.playwright"
  ]
}
```

### Workspace Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

---

## Common Issues

### "Module not found" errors

```bash
# Reinstall all workspace dependencies
pnpm install

# If persistent, clear and reinstall
rm -rf node_modules packages/*/node_modules apps/*/node_modules
pnpm install
```

### Wrangler not found

Wrangler is installed as a workspace devDependency. Use it through pnpm:

```bash
pnpm --filter xivdyetools-discord-worker exec wrangler login
```

### Local database issues

```bash
# Reset local D1 database
rm -rf apps/presets-api/.wrangler/state
pnpm --filter xivdyetools-presets-api run db:migrate:local
```

### Port conflicts

Default ports:
- Web App: 5173
- OAuth: 8788
- Presets API: 8787
- Discord Worker: 8976

Change ports in respective config files if needed.

---

## Next Steps

- [Contributing](contributing.md) - Contribution guidelines
- [Testing](testing.md) - Testing strategy
- [Environment Variables](environment-variables.md) - All configuration options
