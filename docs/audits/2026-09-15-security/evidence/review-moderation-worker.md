# Moderation worker review
**Scope:** source-only review of `apps/moderation-worker` at `0332fcc5`.
## Route/authz matrix
| Interaction | Gate | Result |
|---|---|---|
| slash command | raw Ed25519 before parse, moderator gate, native limiter | moderator actions |
| autocomplete | raw Ed25519 before parse, moderator gate | moderator-only choices |
| component | raw Ed25519 before parse, moderator gate, bounded custom id | moderator-only button action |
| modal | raw Ed25519 before parse, moderator gate, validated reason | moderator-only submission |
## Candidates
No unit-specific candidate verified. Shared auth raw-body streaming cap is owned by the package review.
## Positive controls
- Every command, autocomplete, component, and modal path rechecks `MODERATOR_IDS`; no UI-only authorization trust.
- Presets-api calls use v2 signing and nonce/freshness binding; fixed service target and response handling prevent outbound URL steering.
- Production env validation requires native rate limiter and signing configuration; interaction body/JSON and custom-id helpers constrain attacker input.
- Ban actions use validated identifiers/reasons, sanitized embed content, parameterized API calls, and request-scoped redacted logging; no analytics/KV personal-data sink beyond documented moderation records.
## Rejected suspicions
- Missing autocomplete/component/modal authorization, legacy v1 bot signing, unverified Discord interaction, SQL injection, and raw user text in embeds/logs were not reachable.
## Coverage and limits
- Covered 22 production TypeScript files and `wrangler.toml`; no tests, production probes, or source edits. Service-binding and Discord runtime behavior was not exercised.
