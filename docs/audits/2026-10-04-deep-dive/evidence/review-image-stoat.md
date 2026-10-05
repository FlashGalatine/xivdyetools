# Review: image-stoat (image-worker + parked stoat-worker, P3)

Branch preview/integration-2026-10-04 @80262a2f. All candidates origin MAIN (open PRs touch only image-worker index.ts comments / observability config and stoat response-formatter's @online defuse, both fine).

## Map
| Module | Role |
|---|---|
| image-worker/src/index.ts | Hono: workers.dev 404 guard, GET /health, POST /extract (JSON url), POST /thumbnail (raw bytes, Content-Length + streaming cap) |
| validators.ts | Discord CDN allowlist, one manual redirect hop, 10 s timeout, streaming 10 MB cap, pixel gate (9.4 MP / 4096 side), assertValidMaxDimension |
| dimensions.ts | Header-only PNG/JPEG/GIF/WebP/BMP dimension parsers (fail closed) |
| photon.ts | decode, resize, crop (computeCropBox), WebP encode, free() in finally |
| stoat-worker/src/index.ts | revolt.js client, error listener, messageCreate -> handler |
| message-handler.ts | bot filter, per-user throttle, route, fixed error reply |
| router.ts / commands/* | ping, help, about, dye.info only |
| services/dye-resolver.ts | name/id/hex resolution, partial match, suggestions |
| services/response-formatter.ts | embeds, sanitizeEcho (mentions) |
| command-throttle.ts, message-context.ts, loading-indicator.ts | in-memory throttle / LRU store / unused react wrapper |

## Candidates

### image-stoat-01 BUG MEDIUM - apps/stoat-worker/src/services/dye-resolver.ts:54
Claim: step 1 `resolveColorInput` runs `searchDyesByName` (partial `includes` over English names: packages/core/src/services/dye/DyeSearch.ts:82-95, packages/bot-logic/src/input-resolution.ts:53-60 and 246-250) and returns `candidates[0]`, so any name substring matching at least one dye resolves as kind `single` (dye-resolver.ts:55-56). The `multiple` (2-4) and `disambiguation` (5+) branches at :78-100 are only reachable for category-only matches.
Failing input: `!xd info white` (or red, blue, coral): several dyes contain it, the bot replies with ONE arbitrary dye (first in DB order), no list, no hint.
Tests miss it: dye-resolver.test.ts:83-114 and :181-190 assert `['single','multiple','disambiguation']).toContain(kind)` or sit inside `if (kind === 'multiple')` with no else; dye-resolver.partial.test.ts mocks resolveColorInput to null (:12-16), forcing the branch the real code skips. Covered: no. Origin MAIN.
Excerpt: `const exact = resolveColorInput(trimmed, { findClosestForHex: true }); if (exact) { return { kind: 'single', dye: exact }; }`
Fix: exact-only resolution first (bare number, hex, exact name via findDyeByName), then the substring step before any first-match fallback; tighten the tests to assert the kind for "white".

### image-stoat-02 BUG MEDIUM - apps/stoat-worker/src/services/dye-resolver.ts:46 (plus commands/help.ts:28,44,49)
Claim: `_locale` is unused and `resolveColorInput` / `resolveDyeInput` are called without a locale (:54, :60), so localized names never match; nothing in stoat-worker calls `initializeLocale` (git grep over src: zero hits), which the localized path needs (input-resolution.ts:25-28). Help advertises "localized names are all accepted" and uses `!xd info スノウホワイト` as its example. info.ts:38 hard-codes 'en'.
Failing input: the help's own example -> English-only search finds nothing -> `none` plus edit-distance suggestions.
Tests miss: no test feeds a non-English name. Covered: no. Origin MAIN.
Fix: wire `initializeLocale` and pass the locale through, or drop the claim and the example from help.ts.

### image-stoat-03 BUG LOW - apps/stoat-worker/src/commands/about.ts:23,25
Claim: Quick Start advertises `!xd random` ("Discover new dyes") and "React with ❓ on any bot message". `random` aliases to `dye.random`, which is not in COMMAND_ROUTES (router.ts), so it answers `Unknown command "dye.random"`; no reaction listener exists (BUG-038). BUG-103 fixed help.ts but not about.ts; the feature bullets (blending, harmony, accessibility, 6 languages) are also not implemented here.
Failing input: user follows the about card -> `!xd random` -> unknown-command reply. Tests: about.test.ts has no router-drift check (help.test.ts does). Covered: no. Origin MAIN.
Fix: list only routed commands; add the same drift test.

### image-stoat-04 BUG LOW - apps/image-worker/src/index.ts:138-143
Claim: `await c.req.json()` succeeds for a body of `null`; `!body.url` then throws a TypeError outside the try (which starts at :155), and the app has no onError, so Hono answers a bare 500 instead of the 400 `{error}` contract.
Failing input: POST /extract with body `null` -> 500 "Internal Server Error". Real callers always send an object, so latent. Covered: no. Origin MAIN.
Fix: `if (!body || typeof body !== 'object' || typeof body.url !== 'string')` -> 400.

### image-stoat-05 OPT LOW - apps/image-worker/src/photon.ts:135
Claim: when the image already fits `maxDimension`, `resizeImage` "copies" via `PhotonImage.new_from_byteslice(image.get_bytes())`; `get_bytes()` PNG-encodes the whole image and it is decoded again. Trivial at the default 256, but a caller passing `maxDimension` up to 4096 for a 9.4 MP image pays a full PNG encode + decode and holds roughly 3-4 RGBA copies, above the `CONCURRENT_RGBA_COPIES = 2` the pixel gate was sized for (validators.ts:60,81). discord-worker never passes maxDimension today, so not reachable in production.
Covered: no. Origin MAIN. Fix: return pixels from the original and free once, or cap maxDimension against the pixel budget.

### image-stoat-06 UNTESTED MEDIUM - apps/stoat-worker/src/services/dye-resolver.test.ts:83-114
The multi-match and disambiguation tests cannot fail: each ends in an else asserting the kind is any of the three, which is why image-stoat-01 stays green. Behaviour they should catch: name substrings with 2-4 / 5+ hits yield `multiple` / `disambiguation`. Origin MAIN.

### image-stoat-07 BUG LOW - apps/stoat-worker/src/services/message-context.ts:40
Claim: `set` evicts the oldest entry whenever size >= 500 even when the key already exists, and re-setting never refreshes insertion order (documented as LRU). Overwriting an existing id at capacity drops an unrelated live entry. Latent: no reader of the store exists yet. Origin MAIN. Fix: delete the key before set; evict only for a new key.

## POSITIVE
- Dimension gate fails closed and runs before decode on both routes; BUG-052/053 clamps (validators.ts:104, photon.ts:384-396) verified: computeCropBox gives x2 <= width and y2 <= height for odd and degenerate shapes.
- SSRF: allowlist before IP check, one manual redirect hop re-validated, a second 3xx rejected by `!ok` (validators.ts:433-460); the timeout covers the body read.
- readBodyWithCap cancels and releases the lock; Content-Length pre-check on /thumbnail.
- photon free() in finally with a distinct-reference set; workers.dev guard handles the trailing dot.
- stoat: own-property lookups (parser, router, help), sanitizeEcho ordering (ZWJ after the sanitiser), log redaction via loggableCommand, gateway `error` listener, throttle consumed only after a command parses.

## REJECTED
- Header/decoder dimension mismatch (WebP VP8X canvas vs frame, GIF logical screen vs frame): photon/image-crate behaviour cannot be confirmed from the repo; no failing input.
- Thumbnail peak memory exceeding the 2-copy budget: depends on photon internals, unverifiable by reading.
- Relative `Location` on redirect rejected as "Invalid URL format": Discord CDN never emits one.
- isPrivateHost IPv6 regex vs bracketed hostnames: unreachable, the allowlist runs first.
- `!xd info Bad/Add/Ace` hex-lookalikes resolving to the closest dye: documented hex behaviour.
- `authorId ?? 'unknown'` shared throttle bucket (message-handler.ts:80): authorId is always set for user messages.
- `message.author?.bot` with an uncached author (:71): worst case another bot's command is processed, still throttled; not filed.
- Unused exports (isAuthorized, withLoadingIndicator, HELP_TOPICS): owned by the dead-code audit.

## COVERED (23 files read)
image-worker: package.json, wrangler.toml, src/{index,validators,dimensions,photon,types}.ts. stoat-worker: package.json, src/{index,config,message-handler,router}.ts, commands/{about,help,info,parser,ping}.ts, services/{command-throttle,dye-resolver,loading-indicator,message-context,response-formatter}.ts, test-utils/revolt-mocks.ts (head only). Tests skimmed: dye-resolver*.test.ts. Also read bot-logic input-resolution.ts, discord-markdown.ts and core DyeSearch.ts for confirmation.
