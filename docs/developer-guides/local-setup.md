# Local Development Setup

**Setting up your development environment for XIV Dye Tools**

---

## Prerequisites

### Required

| Tool | Version | Installation |
|------|---------|--------------|
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org/) |
| **npm** | 10+ | Comes with Node.js |
| **Git** | 2.40+ | [git-scm.com](https://git-scm.com/) |

### For Workers Development

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Wrangler** | Cloudflare CLI | `npm install -g wrangler` |
| **Cloudflare account** | Deploy workers | [cloudflare.com](https://cloudflare.com/) |

### Optional

| Tool | Purpose | Installation |
|------|---------|--------------|
| **VS Code** | Recommended IDE | [code.visualstudio.com](https://code.visualstudio.com/) |
| **Discord Developer App** | Bot testing | [discord.com/developers](https://discord.com/developers) |

---

## Clone the Repository

```bash
git clone https://github.com/your-username/xivdyetools.git
cd xivdyetools
```

---

## Project-Specific Setup

### Core Library

```bash
cd xivdyetools-core

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Start development (watch mode)
npm run test:watch
```

### Web App

```bash
cd xivdyetools-web-app

# Install dependencies
npm install

# Start dev server (localhost:5173)
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Discord Worker

```bash
cd xivdyetools-discord-worker

# Install dependencies
npm install

# Login to Cloudflare (first time only)
wrangler login

# Start local dev server
npm run dev
```

**Required Secrets (for full functionality):**

```bash
# Set locally for development
export DISCORD_TOKEN="your-bot-token"
export DISCORD_PUBLIC_KEY="your-public-key"
```

### OAuth Worker

```bash
cd xivdyetools-oauth

# Install dependencies
npm install

# Start local dev server (port 8788)
npm run dev
```

**Required Secrets:**

```bash
export DISCORD_CLIENT_SECRET="your-client-secret"
export JWT_SECRET="your-jwt-secret"
```

### Presets API

```bash
cd xivdyetools-presets-api

# Install dependencies
npm install

# Apply local database schema
npm run db:migrate:local

# Start local dev server (port 8787)
npm run dev
```

**Required Secrets:**

```bash
export BOT_API_SECRET="your-api-secret"
export JWT_SECRET="your-jwt-secret"
```

---

## Full Stack Development

To run the entire ecosystem locally:

### Terminal 1: Web App
```bash
cd xivdyetools-web-app
npm run dev
# Runs on http://localhost:5173
```

### Terminal 2: OAuth Worker
```bash
cd xivdyetools-oauth
npm run dev
# Runs on http://localhost:8788
```

### Terminal 3: Presets API
```bash
cd xivdyetools-presets-api
npm run dev
# Runs on http://localhost:8787
```

### Terminal 4: Discord Worker (optional)
```bash
cd xivdyetools-discord-worker
npm run dev
# Runs on http://localhost:8976
```

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

## Environment Variables

See [Environment Variables](environment-variables.md) for a complete list per project.

### Local Development Files

Each project supports `.dev.vars` for local secrets:

```bash
# xivdyetools-discord-worker/.dev.vars
DISCORD_TOKEN=your-token
DISCORD_PUBLIC_KEY=your-key
BOT_API_SECRET=local-secret
```

---

## Common Issues

### "Module not found" errors

```bash
# Make sure dependencies are installed
npm install

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Wrangler not found

```bash
npm install -g wrangler
wrangler login
```

### Local database issues

```bash
# Reset local D1 database
rm -rf .wrangler/state
npm run db:migrate:local
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
