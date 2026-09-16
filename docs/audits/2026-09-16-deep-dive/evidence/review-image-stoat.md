# Review: image-stoat (image-worker + stoat-worker)

## 1. Map

| Module | Role |
|---|---|
| `apps/image-worker/src/index.ts` | Hono app: `GET /health`, `POST /extract`, `POST /thumbnail`, workers.dev hostname guard (FINDING-023) |
| `apps/image-worker/src/validators.ts` | SSRF allowlist, file-size/dimension/format validation, `assertValidMaxDimension` (single rule, REFACTOR-007), streaming body cap, timeout fetch |
| `apps/image-worker/src/photon.ts` | WASM decode/resize/crop/WebP-encode; `computeCropBox`; `processImageForExtraction`/`processImageForThumbnail` (pre-decode header gate) |
| `apps/image-worker/src/dimensions.ts` | Header-only PNG/JPEG/GIF/WebP/BMP dimension parsers, never decode, never throw |
| `apps/image-worker/src/types.ts` | `Env` (empty — no bindings), validation result types |
| `apps/image-worker/wrangler.toml` (read-only) | No routes, `workers_dev=false`/`preview_urls=false` both envs |
| `apps/stoat-worker/src/index.ts` | Bootstrap: `Client`, gateway `error` listener (BUG-101), graceful shutdown |
| `apps/stoat-worker/src/router.ts` | `COMMAND_ROUTES` (`ping`/`help`/`about`/`dye.info`), `isRegisteredCommand` (`Object.hasOwn`) |
| `apps/stoat-worker/src/message-handler.ts` | `messageCreate` gate: bot-filter, per-user throttle, route via try/catch, fixed-text error reply |
| `apps/stoat-worker/src/config.ts` | `loadConfig()` env parsing, ULID validation |
| `apps/stoat-worker/src/commands/parser.ts` | Prefix parsing (`!xivdye`/`!xd`), `SHORT_ALIASES`, multi-dye `>` splitting |
| `apps/stoat-worker/src/commands/{ping,help,about,info}.ts` | Command handlers |
| `apps/stoat-worker/src/services/dye-resolver.ts` | Multi-strategy resolution (exact → name → partial), Levenshtein suggestions |
| `apps/stoat-worker/src/services/response-formatter.ts` | `StoatEmbed`/`StoatMessage` shape, `sanitizeEcho`, disambiguation/no-match formatters |
| `apps/stoat-worker/src/services/message-context.ts` | LRU(500)+TTL(1h) context store for future reaction handlers |
| `apps/stoat-worker/src/services/command-throttle.ts` | Per-user sliding window (5/10s), lazy pruning |
| `apps/stoat-worker/src/services/loading-indicator.ts` | `withLoadingIndicator` — not wired into any command yet |
| `apps/stoat-worker/src/test-utils/revolt-mocks.ts` | Hand-written revolt.js mock factories |

## 2. Candidates

### image-stoat-14 — BUG, LOW, `apps/stoat-worker/src/commands/ping.ts:9-11`
Claim: the reported ping "latency" is measured entirely inside the JS call before the network round-trip, so it is always ~0ms regardless of actual gateway latency.
```ts
const startTime = Date.now();
await ctx.message.channel?.sendMessage({
  content: `🏓 Pong! (${Date.now() - startTime}ms)`,
```
Failing input → wrong outcome: any `!xd ping` invocation → the template-literal argument (including `Date.now() - startTime`) is evaluated *before* `sendMessage` is even called, so the number shown is the time to build the message object (sub-millisecond), never the actual send/round-trip time the command claims to check ("Connectivity + latency check" per CLAUDE.md).
Why tests miss it: there is no `ping.test.ts` at all (only `ping.ts` exists under `src/commands/`).
Covered by test: **no**.
Fix direction: measure elapsed time after the `sendMessage` resolves (or edit the sent message with the post-send delta), not before it is sent.

### image-stoat-15 — UNTESTED, P3, `apps/stoat-worker/src/commands/info.ts:98-101`
Claim: the happy-path embed content for a resolved dye (`title`/`description`/`colour`) is never asserted — only "something truthy was sent" is checked.
```ts
const embed = {
  title: result.embed.title,
  description: result.embed.description,
  colour: colorToHex(result.embed.color),
};
```
The behaviour that would catch a regression: `commands/info.test.ts:82`, `:109`, `:177` all use `expect(lastCall.embeds?.[0] ?? lastCall.content).toBeDefined()` — a code change that emptied `result.embed.title` or dropped `colour` entirely would still pass every one of those three tests.
Why tests miss it: the assertion checks presence of *either* field, not the field values, so it can't fail on wrong content, only on total silence.
Covered by test: **no** (presence only, not content).
Fix direction: assert `lastCall.embeds[0].title`/`.colour` against the mocked `executeDyeInfo` result's `embed.title`/`color` in at least the "known dye" test case.

### image-stoat-16 — REFACTOR, LOW, `apps/image-worker/src/validators.ts:141-147,386-423` vs `apps/presets-api/src/services/preview-image-service.ts:113-144`
Claim: magic-byte image-format sniffing is implemented twice, independently, in two apps.
```ts
// image-worker/validators.ts
const MAGIC_BYTES: Record<ImageFormat, number[]> = { png: [0x89,0x50,0x4e,0x47], jpeg: [0xff,0xd8,0xff], ... };
export function detectImageFormat(buffer: Uint8Array): ImageFormat | undefined { ... }
```
```ts
// presets-api/preview-image-service.ts
export function sniffImageType(bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | null { ... }
```
Both check PNG/JPEG/WebP header bytes; presets-api's copy is missing GIF/BMP (which image-worker's `/thumbnail` also accepts via `assertImageDimensionsFromHeader`), so the two can silently drift on what "is an image" means between the upload-time sniff and the decode-time gate. Not urgent — no observed wrong behavior, just duplicated logic belonging in a shared package (e.g. `@xivdyetools/worker-kit` or a small new module both apps could import).
Fix direction: extract one magic-byte sniffer (image-worker's, since it is the more complete one incl. GIF/BMP) into a shared package and have `preview-image-service.ts` import it.

## 3. POSITIVE

- Dimension/pixel caps are read from the container header and enforced **before** any WASM decode in both `/extract` and `/thumbnail` (`assertImageDimensionsFromHeader` runs first in both `processImageForExtraction` and `processImageForThumbnail`); verified the pixel-count branch (BUG-052) is genuinely reachable — e.g. 4096×2305 passes the 4096-per-side cap but fails `MAX_PIXEL_COUNT` (9,437,184 px).
- `maxDimension` validation has exactly one implementation (`validators.ts` → `assertValidMaxDimension`), imported by both the `/extract` route and `photon.ts` — REFACTOR-007 holds, no drift between the two copies that used to exist.
- `computeCropBox`/`resizeImage` both clamp every axis to ≥1 with dedicated regression tests sweeping every `1..64 × 1..64` shape — BUG-053 and image-stoat-02 (minor-axis rounding to 0) cannot silently recur.
- `photon.test.ts`'s crop-box assertion checks the exact computed coordinates (image-stoat-04 fix) rather than `expect.any(Number)` — this specific "cannot fail" pattern has been eliminated from the file.
- stoat-worker's three lookup tables (`SHORT_ALIASES`, `COMMAND_ROUTES` via `isRegisteredCommand`, `COMMAND_HELP`) are all consulted with `Object.hasOwn` — no `constructor`/`__proto__` prototype-lookup surface remains anywhere a user token reaches a table key.
- `message-handler.ts` wraps the entire `route()` call in try/catch and `index.ts` registers a `client.on('error', ...)` listener (BUG-101) — a handler throw or a gateway socket error can no longer produce an unhandled rejection/exception that kills the Node process.
- Error messages thrown by `validators.ts`/`photon.ts` are returned verbatim by `index.ts`'s catch blocks, preserving the substring contract `discord-worker`'s `image-input-errors.ts` depends on.

## 4. REJECTED

- WASM init cached-rejection poisoning the isolate — checked: `@cf-wasm/photon` is imported eagerly at module scope in `photon.ts` (no lazy dynamic import, no cached promise wrapper to poison). That failure pattern belongs to og-worker's `resvg-wasm` lazy singleton, not this Worker.
- `isPrivateHost`'s `ipv6Pattern` (`/^([0-9a-f:]+)$/i`, `validators.ts:220`) could in principle false-positive on an all-hex-character hostname like "cafe" — unreachable: it only runs after `ALLOWED_HOSTS.has(hostname)` already matched one of exactly two literal Discord CDN hostnames (`validators.ts:191`), so no real host string ever reaches it.
- Missing `Cache-Control` on `/extract`/`/thumbnail` responses — both are service-binding-only `Response` objects that never pass through Cloudflare's edge cache, so the header would have no effect; the real cache policy is set by the caller when it persists the bytes (presets-api's `PREVIEW_IMAGE_CACHE_CONTROL` on the R2 object).
- GIF/WebP header vs. actual frame data disagreement ("smuggled" larger real image past the pre-decode gate) — for PNG/JPEG the IHDR/SOF fields are authoritative for the decoder's own buffer allocation, so no smuggling path exists there; could not construct a concrete failing GIF/WebP input in the time available, dropped for lack of a failing input.
- `presets-api`'s `storePreviewImage` collapses every image-worker `/thumbnail` error into a generic `'Image could not be processed'` (`preview-image-service.ts:172-174`), discarding the specific `{error}` message — this is a deliberate simplification for an author-facing message, not a broken contract; the verbatim-error contract is documented as existing for discord-worker specifically.
- `MessageContextStore.set` evicts the oldest entry even when the incoming `messageId` already exists (overwrite, not growth) — technically wastes one eviction slot, but unreachable in practice since `sent.id` (the only caller) is always a freshly created Stoat message id, never a repeat key.
- BUG-052/BUG-053/REFACTOR-007/image-stoat-02/image-stoat-04/image-stoat-12/image-stoat-13/BUG-101/BUG-103/BUG-102/BUG-038 — all previously-fixed patterns re-checked directly against current source; all remain fixed, no regression found.

## 5. COVERED

**26 files read** (all non-test `src/` files in scope, plus the listed test files skimmed for coverage/weak-assertion judgment, plus `wrangler.toml` and one out-of-scope caller file read for the REFACTOR-016 duplicate claim):

Source: `apps/image-worker/src/index.ts`, `validators.ts`, `photon.ts`, `dimensions.ts`, `types.ts`, `wrangler.toml`; `apps/stoat-worker/src/index.ts`, `router.ts`, `message-handler.ts`, `config.ts`, `commands/parser.ts`, `commands/ping.ts`, `commands/help.ts`, `commands/about.ts`, `commands/info.ts`, `services/dye-resolver.ts`, `services/response-formatter.ts`, `services/message-context.ts`, `services/command-throttle.ts`, `services/loading-indicator.ts`, `test-utils/revolt-mocks.ts`.

Tests read in full: `index.test.ts`, `photon.test.ts`, `photon-gate.test.ts`, `index-limits.test.ts`, `dimensions.test.ts` (image-worker); `info.test.ts` (partial, targeted) (stoat-worker).

Tests skimmed for line count / grep only (existence + assertion-shape check, not full read): `validators.test.ts`, `validators-cap.test.ts`, `wrangler-config.test.ts` (image-worker); `parser.test.ts`, `help.test.ts`, `about.test.ts`, `router.test.ts`, `commands/index.test.ts`, `prototype-keys.test.ts`, `dye-resolver.test.ts`, `dye-resolver.partial.test.ts`, `command-throttle.test.ts`, `loading-indicator.test.ts`, `message-context.test.ts`, `response-formatter.test.ts`, `echo-sanitisation.test.ts`, `message-handler.test.ts`, `config.test.ts` (stoat-worker).

Out-of-scope, read for a cross-app REFACTOR claim: `apps/presets-api/src/services/preview-image-service.ts`; also `packages/bot-logic/src/index.ts` and `src/i18n/index.ts` to confirm stoat-worker's imports (`LocaleCode`, `sanitizeEmbedText`, `resolveColorInput`, `resolveDyeInput`, `dyeService`, `executeDyeInfo`) still resolve against the current published barrel.
