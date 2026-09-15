# Shared security packages review — 2026-09-15

## Module map and authority

| Unit | Inspected modules | Boundary |
|---|---|---|
| auth | src/hmac.ts, jwt.ts, discord.ts, revocation.ts, timing.ts, encoding/base64.ts and hex.ts; package contract/tests | Untrusted signatures/tokens/body enter; verified identity or explicit refusal leaves |
| logger | src/constants.ts, core/base-logger.ts; worker/browser presets and JSON adapter via tests | Context/message/errors become redacted output |
| worker-kit | src/middleware/{logger,request-id,rate-limit}.ts; rate-limiter/{ip,key-scope}.ts and backends/{cloudflare,kv,memory,upstash}.ts | Request metadata and limiter identities reach logs/backends |

## Confirmed

- FINDING-001: Discord body limit runs after full buffering, before cryptographic authentication. Bounded local stream reproduction saved beside this report.

## Positive controls

- HMAC requires 32 encoded bytes, uses native verification, limits CryptoKey LRU entries, and v2 canonicals length-prefix method/path/body digest/time/nonce/identity. V1 removed. Nonce replay storage belongs to callers.
- JWT verification pins HS256, checks typed exp/sub/iat/nbf, rejects non-object payloads, and supports issuer/audience/type checks. Normal production paths pin issuer. Invalid decode errors fail closed.
- Discord timestamps checked before body read; stale/future requests fail. Final byte-size check correctly counts UTF-8, but buffering remains FINDING-001.
- Logger handles nested arrays, shared references and cycles with redaction; free-text JWT/auth patterns are scrubbed. Production errors omit stacks. Existing suites passed: auth 122 tests; logger 251 tests.
- IP limiter extraction defaults to ignoring client-controlled X-Forwarded-For. Backend failure logs use key scope rather than raw identifiers. Request IDs are shape validated, and logger defaults exclude User-Agent and query strings.

## Rejected suspicions / residual risks

- Revocation outage bypass is explicitly documented as intentional in `apps/oauth/README.md:56` and tested in `packages/auth/src/revocation.test.ts`; no new finding. Production bindings required, sessions cannot refresh, writes fail visibly. A stolen revoked unexpired token can still work during KV failure; retain this risk in future threat-model reviews.
- Default rate-limit fail-open and eventually consistent KV counters are accepted architecture trade-offs; do not re-file. Missing middleware logger fallback is already documented as an external/future consumer gap in the trade-offs document.
- `verifyJWTSignatureOnly` is a published primitive, not a live refresh route: oauth removed `/auth/refresh`. Do not infer an active token-renewal exploit from the export alone.
- Request-ID acceptance is not a telemetry identifier: request tracing and Analytics Engine event fields are distinct; no client-generated persistent telemetry identity found by app reviewer.

## Method and limits

Tracked source review (`git grep`, targeted reads), local synthetic stream probe, and existing focused tests. No live tokens, production requests, memory-exhaustion load tests, source edits, or deployment. General package behavior outside these security boundaries is not exhaustively proven safe.
