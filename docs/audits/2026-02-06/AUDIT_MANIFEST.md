# Security Audit Manifest

## Audit Information

| Field | Value |
|-------|-------|
| **Audit Date** | 2026-02-06 |
| **Auditor** | Claude Code (Opus 4.6) |
| **Audit Type** | Comprehensive Security Review |
| **Status** | Complete |
| **Overall Risk** | LOW |
| **Findings** | 0 Critical, 0 High, 4 Medium, 4 Low, 2 Info |

## Scope

### Primary Target
- **Project:** xivdyetools-discord-worker v4.0.0
- **Type:** Cloudflare Worker (Discord Bot — HTTP Interactions)
- **Runtime:** Cloudflare Workers (V8 isolate)
- **Framework:** Hono v4.11.7

### Dependency Packages Audited
| Package | Version | Purpose |
|---------|---------|---------|
| `@xivdyetools/core` | ^1.16.0 | Dye database, color services, Universalis API client |
| `@xivdyetools/auth` | ^1.0.0 | Ed25519, JWT (HS256), HMAC-SHA256 verification |
| `@xivdyetools/logger` | ^1.0.2 | Structured logging with secret redaction |
| `@xivdyetools/rate-limiter` | ^1.2.0 | Sliding window rate limiting (Memory/KV/Upstash) |

### External Dependencies (Third-Party)
| Package | Version | Purpose |
|---------|---------|---------|
| `hono` | ^4.11.7 | HTTP framework |
| `@resvg/resvg-wasm` | ^2.6.2 | SVG to PNG rendering |
| `@cf-wasm/photon` | ^0.3.4 | Image processing (dominant color) |
| `@upstash/redis` | (via rate-limiter) | Redis-backed rate limiting |
| `discord-interactions` | (via auth) | Ed25519 verification |
| `spectral.js` | ^3.0.0 | Color mixing (via core) |

## Attack Surface Summary

### HTTP Endpoints
1. `POST /` — Discord interactions (Ed25519 verified)
2. `GET /health` — Health check (public)
3. `POST /webhooks/preset-submission` — Web app webhook (Bearer token auth)
4. `POST /webhooks/github` — GitHub push notifications (HMAC-SHA256 auth)

### External API Integrations
1. **Discord API** (v10) — Bot token auth, follow-up messages
2. **Universalis API** — Market board prices (via Service Binding or proxy)
3. **Presets API** — Community presets (via Service Binding, HMAC signed)
4. **GitHub API** — Changelog fetching (webhook-triggered)

### Data Storage
1. **KV Namespace** — Rate limits, user preferences, favorites, collections, analytics
2. **D1 Database** — Preset storage (via Presets API service binding)
3. **Analytics Engine** — Command usage statistics

### Secrets (configured via `wrangler secret put`)
- `DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`
- `BOT_API_SECRET`, `BOT_SIGNING_SECRET`
- `INTERNAL_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `MODERATOR_IDS`, `STATS_AUTHORIZED_USERS`

## Methodology

1. **Automated Scanning** — `npm audit`, secret pattern grep
2. **Manual Code Review** — OWASP Top 10, CWE references
3. **Dependency Analysis** — Internal package deep review
4. **Configuration Review** — Wrangler, environment, secrets management

## Documentation Structure

```
xivdyetools-docs/audits/2026-02-06/
├── AUDIT_MANIFEST.md          (this file)
├── SECURITY_AUDIT_REPORT.md   (executive summary + full report)
├── findings/                  (individual finding files)
│   └── FINDING-XXX.md
├── evidence/                  (automated scan outputs)
│   └── npm-audit.json
└── recommendations/           (reserved for future use)
```
