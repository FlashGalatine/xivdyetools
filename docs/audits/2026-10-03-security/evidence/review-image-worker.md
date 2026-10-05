# Review: image-worker (apps/image-worker) — 2026-10-03

## 1. Entry points and authz matrix
| Entry | Reachable by | Guards before handler | Body / param caps |
|---|---|---|---|
| GET /health (src/index.ts:121) | service binding only | requestId, logger (index.ts:54-60), workers.dev hostname 404 (index.ts:112-119) | none, returns {status:ok} |
| POST /extract (index.ts:135) | discord-worker via IMAGE_WORKER binding (image-client.ts) | same | JSON body {url, maxDimension}; url host allowlist cdn.discordapp.com / media.discordapp.net, https only (validators.ts:25,171-182); fetched body capped 10 MB streaming (validators.ts:476, readBodyWithCap :323); maxDimension integer 16..4096 (validators.ts:122); header dim gate 4096 px/side and 9.4 MP (validators.ts:277-286, 302) before decode (photon.ts:187); 10 s fetch timeout (validators.ts:133,418) |
| POST /thumbnail (index.ts:185) | presets-api via binding | same | Content-Length pre-check + streaming cap 10 MB (index.ts:188-199); empty rejected; header dim gate before decode (photon.ts:279) |
Bindings: none (types.ts Env = Record<string,never>); no secrets, KV, D1, R2. No auth in the worker by design: the control is "no public surface".
Wrangler: wrangler.toml has no routes, workers_dev=false and preview_urls=false at top level and in [env.production] (wrangler.toml, last two blocks); pinned by src/wrangler-config.test.ts:144-211. No [observability] block, so no persisted logs.

## 2. Positive controls
- Binding-only deployment, pinned by test (wrangler.toml; wrangler-config.test.ts:182,191,211); defence-in-depth workers.dev 404 incl. trailing dot (index.ts:112-119).
- Decompression-bomb gate reads PNG/JPEG/GIF/WebP/BMP headers, fails closed on unknown/undecodable (dimensions.ts:117-133; validators.ts:302-312), applied on both decode paths (photon.ts:187, 279).
- Streaming byte cap independent of Content-Length (validators.ts:323-360, 476).
- SSRF: https + exact host allowlist, IP literals blocked, manual redirect with one validated hop, second hop not followed (validators.ts:156-194, 423-460); no user-controlled header sent; timeout abort (:418).
- Format sniff via worker-kit image-sniff before decode on /extract (validators.ts:14, 383, 537); /thumbnail relies on the header parser, which only recognizes 5 formats.
- Photon trap path from degenerate aspect ratios clamped (photon.ts:237-270 computeCropBox, resizeImage minor-axis clamp); WASM objects freed in finally (photon.ts:209, 291).
- Privacy: logger logs method + pathname only (worker-kit middleware/logger.ts getRequestInfo, no search, UA off by default); image URL is in the body and never logged; no stored data, no analytics, no outbound bodies; outbound UA is a constant string (validators.ts:428).
- maxDimension validated before any fetch (index.ts:149-154).

## 3. Rejected
- GIF logical-screen vs frame-size mismatch defeating dim gate: dimensions.ts:84 reads logical screen only; cannot confirm decoder behaviour without a wasm probe, no concrete bypass shown; handed off as a hardening test.
- 16-bit PNG at 9.4 MP exceeding the 72 MB pixel budget (validators.ts:81): speculative, availability only, callers are trusted bindings.
- Port in allowlisted URL (cdn.discordapp.com:8443): hostname check ignores port (validators.ts:176) but target is still Discord's host; no impact.
- Error text echo (index.ts:170-175, 213-216): messages are fixed strings or photon decode messages, no URL/host echo, internal callers only.
- Photon panic poisoning shared isolate: addressed by BUG-053 clamp; no remaining zero-dimension path found (width,height >= 1 enforced by dimensions.ts ok()).
- Absent rate limit/auth: accepted by design (wrangler.toml header comment; docs IMAGE_WORKER_SPLIT), callers rate-limit.
- Module-scope state, KV/R2 keys, SQL, CORS, cache headers: none exist in this worker.

## 4. Files covered
apps/image-worker/{wrangler.toml, src/index.ts, src/validators.ts, src/photon.ts, src/dimensions.ts, src/types.ts}; wrangler-config.test.ts (headers/test names only); packages/worker-kit/src/middleware/logger.ts; apps/discord-worker/src/services/image-client.ts (30-110); apps/presets-api/src/services/preview-image-service.ts (45-170); evidence pii-sinks/outbound-fetch (image-worker rows: only 4 fetch sites, all in validators.ts/doc comments; no PII sinks).

## 5. Candidates
| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| (none) | | | | no findings |

## 6. Handoffs
- Add a GIF test where frame size exceeds logical screen size to confirm the header gate holds (dimensions.ts:84).
- wrangler.toml comment says discord-worker/presets-api bind the production name in every env; test at wrangler-config.test.ts:230 covers it (no action).
