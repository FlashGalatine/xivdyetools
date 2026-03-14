# XIV Dye Tools — Public Developer API

Research and planning documents for a public, documented REST API that exposes XIV Dye Tools' color and dye functionality to third-party developers.

## Why Build a Public API?

### Current Limitations

1. **No HTTP access to core logic** — The `@xivdyetools/core` npm library contains 136-dye database, color matching, harmony generation, color conversion, and colorblind simulation, but it's only usable from JavaScript/TypeScript applications.
2. **Platform lock-in** — Developers building native mobile apps, Dalamud plugins (C#), Python scripts, or non-JS Discord bots cannot leverage any of this functionality.
3. **Duplicated effort** — Community developers who need dye data must scrape it themselves or maintain their own databases.
4. **No discoverability** — There is no programmatic way for third-party tools to search dyes, match colors, or generate palettes without embedding the npm library.

### Expected Benefits

- **Language-agnostic access** — Any HTTP client in any language can query dye data, match colors, and generate harmonies
- **Zero-dependency integration** — Developers don't need Node.js or npm; a single HTTP request returns structured data
- **JSON and XML support** — Response format flexibility for different consumer needs
- **Rate-limited and key-managed** — Sustainable public access with abuse prevention
- **Living documentation** — OpenAPI/Swagger spec enables code generation for any language

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 01 | [Overview & Goals](./01-overview-and-goals.md) | Target audience, what the API exposes, non-goals, success criteria |
| 02 | [Endpoint Catalog](./02-endpoint-catalog.md) | Complete endpoint design: dyes, matching, harmony, conversion, mixing, simulation, character colors, presets, prices, localization |
| 03 | [Architecture Decisions](./03-architecture-decisions.md) | Deployment model, framework, versioning, service bindings, bundle size |
| 04 | [Authentication & Rate Limiting](./04-authentication-and-rate-limiting.md) | Two-tier access model, API key management, rate limit configuration |
| 05 | [Response Formats](./05-response-formats.md) | JSON/XML content negotiation, response envelopes, pagination, CORS |
| 06 | [Error Handling](./06-error-handling.md) | Error code catalog, input validation rules, HTTP status mapping |
| 07 | [Implementation Plan](./07-implementation-plan.md) | 5-phase rollout from MVP to developer portal |
| 08 | [Open Questions](./08-open-questions.md) | Unresolved decisions requiring further discussion |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Deployment | New `api-worker` Cloudflare Worker | Separation of concerns; different auth, CORS, and rate limits from presets-api |
| Framework | Hono | Consistent with all existing workers |
| Auth model | API keys (`xdt_` prefix) | Public API doesn't need user identity; simpler for developers than JWT/OAuth |
| Rate limiting | `@xivdyetools/rate-limiter` KV backend | Already built and battle-tested; has `PUBLIC_API_LIMITS` preset |
| Response format | JSON default + XML opt-in | Content negotiation via `Accept` header or `?format=xml` query param |
| CORS | `Access-Control-Allow-Origin: *` | Public API must be callable from any origin |
| Versioning | Path-based `/v1/` | Breaking changes get `/v2/`; non-breaking additions are additive within a version |

## Scope

**In scope:** Read-only HTTP API wrapping `@xivdyetools/core` services — dye database, color matching, harmony generation, color conversion, color mixing, colorblind simulation, character colors, curated presets, localization, and market price pass-through.

**Out of scope:** Community preset write operations (stays on presets-api with its own auth), user authentication/accounts (no JWT/OAuth for API consumers), real-time WebSocket feeds, image upload for palette extraction (Phase 1).
