# Developer Guides

**Technical guides for contributing to XIV Dye Tools**

---

## Getting Started

| Guide | Description |
|-------|-------------|
| [Local Setup](local-setup.md) | Set up your development environment |
| [Monorepo Setup](monorepo-setup.md) | Understanding the multi-project structure |
| [Contributing](contributing.md) | Contribution workflow and guidelines |

---

## Development

| Guide | Description |
|-------|-------------|
| [Testing](testing.md) | Testing strategy and running tests |
| [Deployment](deployment.md) | Deployment procedures |
| [Release Process](release-process.md) | Version bumping and publishing |

---

## Reference

| Guide | Description |
|-------|-------------|
| [Environment Variables](environment-variables.md) | All env vars in one place |
| [Logging Standards](logging-standards.md) | Consistent logging across packages |
| [Troubleshooting](troubleshooting.md) | Common issues and solutions |

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/xivdyetools.git
cd xivdyetools
```

### 2. Choose a Project

```bash
# Core library
cd xivdyetools-core && npm install && npm test

# Web app
cd xivdyetools-web-app && npm install && npm run dev

# Discord worker
cd xivdyetools-discord-worker && npm install && npm run dev

# OAuth worker
cd xivdyetools-oauth && npm install && npm run dev

# Presets API
cd xivdyetools-presets-api && npm install && npm run dev
```

### 3. Make Changes

- Create a feature branch
- Make your changes
- Write/update tests
- Submit a pull request

---

## Project Commands Quick Reference

### xivdyetools-core

```bash
npm run build              # Build library
npm test                   # Run tests
npm run test:coverage      # Tests with coverage
npm run lint               # Lint check
npm run docs               # Generate TypeDoc
```

### xivdyetools-web-app

```bash
npm run dev                # Dev server (localhost:5173)
npm run build              # Production build
npm test                   # Unit tests
npm run test:e2e           # Playwright E2E tests
```

### xivdyetools-discord-worker

```bash
npm run dev                # Local wrangler server
npm run deploy             # Deploy to staging
npm run deploy:production  # Deploy to production
npm run register-commands  # Register slash commands
```

### xivdyetools-oauth

```bash
npm run dev                # Local server (port 8788)
npm run deploy             # Deploy
npm run type-check         # TypeScript check
```

### xivdyetools-presets-api

```bash
npm run dev                # Local server (port 8787)
npm run db:migrate:local   # Apply schema locally
npm run deploy             # Deploy to staging
npm run deploy:production  # Deploy to production
```

---

## Architecture Overview

See [Architecture Documentation](../architecture/overview.md) for:
- Project relationships
- Service bindings
- Data flows
- API contracts

---

## Related Documentation

- [Architecture](../architecture/overview.md) - System design
- [Projects](../projects/index.md) - Per-project technical docs
- [Specifications](../specifications/index.md) - Feature specs
