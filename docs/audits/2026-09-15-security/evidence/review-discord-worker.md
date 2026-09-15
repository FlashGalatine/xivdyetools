# Discord worker review
**Scope:** source-only review of `apps/discord-worker` at `0332fcc5`.
## Route/authz matrix
| Route | Gate | Result |
|---|---|---|
| `POST /` | raw-body Ed25519 + timestamp before interaction parse; command limiter | Discord interactions |
| `/webhooks/preset-submission` | constant-time internal bearer plus 10 KB cap | presets-api only |
| `/webhooks/github` | raw HMAC, event/repository/branch/path validation, 1 MiB cap | GitHub push only |
| `/health` | env validation/headers | public liveness |
## Candidates
| candidate | severity / exposure | file:line | claim | evidence |
|---|---|---|---|---|
| GitHub webhook buffers an untrusted body before HMAC | MEDIUM / INTERNET-UNAUTH | `src/index.ts:506-528` | A chunked/missing/spoofed `Content-Length` bypasses the pre-read check and `c.req.text()` buffers arbitrary data before signature rejection. | The 1 MiB actual-length check is only at `516-522`, after full read at `514`; unauthenticated callers reach it. |
## Positive controls
- Interaction dispatch verifies Discord signature before parsing and routes commands, autocomplete, and components through the same validated interaction boundary.
- Inbound internal and GitHub webhooks authenticate before JSON use; GitHub announcement URL/repository are constants, payload size is checked before and after read, and outbound Discord status is checked.
- Outgoing presets requests use v2 HMAC including method/path/body/timestamp/nonce/user; service binding is preferred and external targets are fixed with timeouts.
- Production requires all native rate-limit tiers; all commands including stats/autocomplete are limited. User text is sanitised for embeds, and cards apply font coverage filtering.
- `PRIVACY_POLICY.md` §2 reconciles AE/KV telemetry: enum/bucket fields only, no option values/message/guild/channel IDs. Policy-listed pseudonymous user IDs also appear in command/rate-limit logs (`index.ts:800,845`); no concrete forbidden username/guild/channel/option-text log sink was verified.
## Rejected suspicions
- Missing moderator gates on buttons/components, v1 signing fallback, unsigned webhooks, GitHub repository/link injection, SSRF through service URLs, and unbounded image client input were not reachable.
## Coverage and limits
- Covered 39 production TypeScript files, `wrangler.toml`, privacy policy and target CLAUDE; no tests, production probes, or source edits. Live Discord/GitHub payload behavior was not exercised.
