# Environment Variables & Secrets

This document compares environment variable management between PebbleHost and Cloudflare Workers.

---

## Comparison Overview

| Aspect | PebbleHost (.env) | Cloudflare Workers |
|--------|-------------------|-------------------|
| **Storage** | `.env` file on server | Wrangler CLI or Dashboard |
| **Secrets** | Plain text in file | Encrypted at rest |
| **Deployment** | Manual SFTP upload | CLI command or Dashboard |
| **Access** | `process.env.VAR` | `env.VAR` (passed to handler) |
| **Local dev** | `.env` + dotenv | `.dev.vars` file |
| **Version control** | Must exclude `.env` | Secrets never in repo |
| **Rotation** | Edit file, restart | CLI command, instant |

---

## PebbleHost Approach (Current)

### Setup
```bash
# 1. Create .env file locally
# 2. SFTP upload to server
# 3. Restart bot to load changes
```

### .env File Structure
```env
# .env (must be kept secret, never commit)
DISCORD_TOKEN=your-bot-token-here
DISCORD_CLIENT_ID=your-application-id
DISCORD_PUBLIC_KEY=your-public-key-here
REDIS_URL=rediss://default:xxxx@your-redis-instance.upstash.io:6379
PRESET_API_SECRET=your-api-secret-here
```

### Access in Code
```typescript
// Requires dotenv package
import 'dotenv/config';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
```

### Problems
1. **Plain text secrets** - Anyone with server access can read them
2. **Manual process** - SFTP upload, restart required
3. **No audit trail** - Can't see who changed what
4. **Easy to leak** - Accidentally commit `.env` to git

---

## Cloudflare Workers Approach (Proposed)

### Three Types of Configuration

| Type | Use Case | Storage | Visibility |
|------|----------|---------|------------|
| **Vars** | Non-sensitive config | `wrangler.toml` | Public (in repo) |
| **Secrets** | API keys, tokens | Cloudflare encrypted | Hidden |
| **KV/D1** | Dynamic config | Cloudflare storage | Via API |

### 1. Regular Variables (wrangler.toml)

For non-sensitive configuration that can be committed to git:

```toml
# wrangler.toml
name = "xivdyetools-discord-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
# Non-sensitive configuration
DISCORD_CLIENT_ID = "your-application-id"
RATE_LIMIT_COMMANDS_PER_MINUTE = "10"
RATE_LIMIT_COMMANDS_PER_HOUR = "100"
MAX_IMAGE_SIZE_MB = "8"
IMAGE_CACHE_TTL = "3600"

[env.production.vars]
# Production-specific overrides
RATE_LIMIT_COMMANDS_PER_MINUTE = "15"
```

### 2. Secrets (Wrangler CLI)

For sensitive data like tokens and API keys:

```bash
# Set secrets via CLI (never stored in files)
wrangler secret put DISCORD_TOKEN
# Prompts for value, never echoed

wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put REDIS_URL
wrangler secret put PRESET_API_SECRET

# For production environment specifically
wrangler secret put DISCORD_TOKEN --env production

# List existing secrets (values hidden)
wrangler secret list
# Output:
# - DISCORD_TOKEN
# - DISCORD_PUBLIC_KEY
# - REDIS_URL
# ...

# Delete a secret
wrangler secret delete OLD_SECRET
```

### 3. Access in Code

```typescript
// src/index.ts
// No imports needed - env is passed directly to handler

export interface Env {
  // Secrets (from wrangler secret put)
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  REDIS_URL: string;
  PRESET_API_SECRET: string;

  // Vars (from wrangler.toml [vars])
  DISCORD_CLIENT_ID: string;
  RATE_LIMIT_COMMANDS_PER_MINUTE: string;
  MAX_IMAGE_SIZE_MB: string;

  // Bindings (KV, R2, D1, etc.)
  KV: KVNamespace;
  DB: D1Database;
  IMAGES: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Access variables directly from env parameter
    const isValid = verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);

    // Type-safe access
    const maxSize = parseInt(env.MAX_IMAGE_SIZE_MB) * 1024 * 1024;

    // ...
  }
};
```

### 4. Local Development (.dev.vars)

For local development with `wrangler dev`:

```bash
# .dev.vars (git-ignored, like .env)
DISCORD_TOKEN=your_dev_token_here
DISCORD_PUBLIC_KEY=your_dev_public_key
REDIS_URL=redis://localhost:6379
PRESET_API_SECRET=dev_secret_here
```

```bash
# Start local dev server
wrangler dev
# Automatically loads .dev.vars
```

---

## Migration: Current Variables

### Variables to Move

| Current (.env) | Workers Location | Type |
|---------------|------------------|------|
| `DISCORD_TOKEN` | `wrangler secret put` | Secret |
| `DISCORD_CLIENT_ID` | `wrangler.toml [vars]` | Var |
| `DISCORD_PUBLIC_KEY` | `wrangler secret put` | Secret |
| `PORT` | Not needed (Workers handles) | N/A |
| `SFTP_*` | Not needed (no SFTP deploy) | N/A |
| `RATE_LIMIT_*` | `wrangler.toml [vars]` | Var |
| `MAX_IMAGE_SIZE_MB` | `wrangler.toml [vars]` | Var |
| `IMAGE_CACHE_TTL` | `wrangler.toml [vars]` | Var |
| `API_CACHE_TTL` | `wrangler.toml [vars]` | Var |
| `API_TIMEOUT` | `wrangler.toml [vars]` | Var |
| `REDIS_URL` | `wrangler secret put` | Secret |
| `STATS_AUTHORIZED_USERS` | `wrangler.toml [vars]` | Var |
| `PRESET_API_URL` | `wrangler.toml [vars]` | Var |
| `PRESET_API_SECRET` | `wrangler secret put` | Secret |
| `MODERATOR_IDS` | `wrangler.toml [vars]` | Var |
| `MODERATOR_ROLE_IDS` | `wrangler.toml [vars]` | Var |
| `MODERATION_CHANNEL_ID` | `wrangler.toml [vars]` | Var |
| `SUBMISSION_LOG_CHANNEL_ID` | `wrangler.toml [vars]` | Var |
| `OWNER_DISCORD_ID` | `wrangler.toml [vars]` | Var |
| `PERSPECTIVE_API_KEY` | `wrangler secret put` | Secret |
| `INTERNAL_WEBHOOK_SECRET` | Not needed (same Worker) | N/A |

### Proposed wrangler.toml

```toml
name = "xivdyetools-discord-worker"
main = "src/index.ts"
compatibility_date = "2024-12-01"

# Bindings
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"

[[d1_databases]]
binding = "DB"
database_name = "xivdyetools-presets"
database_id = "your-d1-database-id"

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "xivdyetools-images"

# Non-sensitive variables
[vars]
DISCORD_CLIENT_ID = "your-application-id"
RATE_LIMIT_COMMANDS_PER_MINUTE = "10"
RATE_LIMIT_COMMANDS_PER_HOUR = "100"
MAX_IMAGE_SIZE_MB = "8"
IMAGE_CACHE_TTL = "3600"
API_CACHE_TTL = "300"
API_TIMEOUT = "5000"
STATS_AUTHORIZED_USERS = "123456789012345678"
MODERATOR_IDS = "123456789012345678"
MODERATOR_ROLE_IDS = "123456789012345678"
MODERATION_CHANNEL_ID = "123456789012345678"
SUBMISSION_LOG_CHANNEL_ID = "123456789012345678"
OWNER_DISCORD_ID = "123456789012345678"

# Production environment
[env.production]
name = "xivdyetools-discord-worker"

[env.production.vars]
# Production-specific overrides if needed
RATE_LIMIT_COMMANDS_PER_MINUTE = "15"
```

### Setup Commands

```bash
# One-time setup: Set all secrets
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put REDIS_URL
wrangler secret put PRESET_API_SECRET
wrangler secret put PERSPECTIVE_API_KEY

# Deploy (vars from wrangler.toml, secrets from Cloudflare)
wrangler deploy
```

---

## Dashboard Management

Secrets can also be managed via the Cloudflare Dashboard:

1. Go to **Workers & Pages** → Your Worker
2. Click **Settings** → **Variables**
3. Add/edit variables under "Environment Variables"
4. Check "Encrypt" for secrets

**Pros:**
- Visual interface
- No CLI needed
- Easy for non-developers

**Cons:**
- Slower for bulk changes
- No version control integration

---

## Environment-Specific Configuration

### Multiple Environments

```toml
# wrangler.toml

# Default (development)
[vars]
LOG_LEVEL = "debug"
RATE_LIMIT_COMMANDS_PER_MINUTE = "100"  # Higher for testing

# Staging
[env.staging.vars]
LOG_LEVEL = "info"
RATE_LIMIT_COMMANDS_PER_MINUTE = "15"

# Production
[env.production.vars]
LOG_LEVEL = "warn"
RATE_LIMIT_COMMANDS_PER_MINUTE = "10"
```

```bash
# Deploy to specific environment
wrangler deploy --env staging
wrangler deploy --env production

# Set secrets for specific environment
wrangler secret put DISCORD_TOKEN --env production
```

---

## Type Safety

### Define Environment Interface

```typescript
// src/types/env.ts

export interface Env {
  // ===== Secrets (wrangler secret put) =====
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  REDIS_URL: string;
  PRESET_API_SECRET: string;
  PERSPECTIVE_API_KEY: string;

  // ===== Variables (wrangler.toml) =====
  DISCORD_CLIENT_ID: string;
  RATE_LIMIT_COMMANDS_PER_MINUTE: string;
  RATE_LIMIT_COMMANDS_PER_HOUR: string;
  MAX_IMAGE_SIZE_MB: string;
  IMAGE_CACHE_TTL: string;
  API_CACHE_TTL: string;
  API_TIMEOUT: string;
  STATS_AUTHORIZED_USERS: string;
  MODERATOR_IDS: string;
  MODERATOR_ROLE_IDS: string;
  MODERATION_CHANNEL_ID: string;
  SUBMISSION_LOG_CHANNEL_ID: string;
  OWNER_DISCORD_ID: string;

  // ===== Bindings =====
  KV: KVNamespace;
  DB: D1Database;
  IMAGES: R2Bucket;
}
```

### Config Helper

```typescript
// src/config.ts

import type { Env } from './types/env';

export function getConfig(env: Env) {
  return {
    discord: {
      token: env.DISCORD_TOKEN,
      clientId: env.DISCORD_CLIENT_ID,
      publicKey: env.DISCORD_PUBLIC_KEY,
    },
    rateLimits: {
      commandsPerMinute: parseInt(env.RATE_LIMIT_COMMANDS_PER_MINUTE),
      commandsPerHour: parseInt(env.RATE_LIMIT_COMMANDS_PER_HOUR),
    },
    image: {
      maxSizeMb: parseInt(env.MAX_IMAGE_SIZE_MB),
      cacheTtl: parseInt(env.IMAGE_CACHE_TTL),
    },
    moderation: {
      moderatorIds: env.MODERATOR_IDS.split(','),
      moderatorRoleIds: env.MODERATOR_ROLE_IDS.split(','),
      channelId: env.MODERATION_CHANNEL_ID,
      logChannelId: env.SUBMISSION_LOG_CHANNEL_ID,
      ownerId: env.OWNER_DISCORD_ID,
    },
  };
}
```

---

## Comparison Summary

| Feature | PebbleHost | Cloudflare Workers |
|---------|------------|-------------------|
| Setup complexity | Simple (one file) | Slightly more (vars + secrets) |
| Security | Low (plain text) | High (encrypted) |
| Deployment | Manual SFTP | `wrangler deploy` |
| Secret rotation | Edit file, restart | CLI command, instant |
| Audit trail | None | Cloudflare logs |
| Local dev | `.env` + dotenv | `.dev.vars` |
| Type safety | Manual | Built-in with Env interface |
| Environments | Multiple .env files | `--env` flag |
| Accidental leak risk | High | Low |

---

## Migration Checklist

- [ ] Create `wrangler.toml` with non-sensitive vars
- [ ] Create `.dev.vars` for local development
- [ ] Add `.dev.vars` to `.gitignore`
- [ ] Run `wrangler secret put` for each secret
- [ ] Create `Env` TypeScript interface
- [ ] Update code to use `env.VAR` instead of `process.env.VAR`
- [ ] Test locally with `wrangler dev`
- [ ] Deploy and verify secrets are loaded
