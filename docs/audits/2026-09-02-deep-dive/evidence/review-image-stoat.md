# Review — unit `image-stoat` (image-worker + stoat-worker)

Deep-dive 2026-09-02, worktree at `origin/main` e7ac4042. Read-only.

Deploy units: `xivdyetools-image-worker` (CF Worker, photon WASM host, service-binding only) and
`xivdyetools-stoat-worker` (Node.js + revolt.js, **PARKED** — its findings carry priority **P3**
regardless of severity, per the task brief; none of them is a security finding).

---

## 1. Map

### image-worker (`apps/image-worker/`)

| Route / module | File | What it does |
|---|---|---|
| middleware | `src/index.ts:39-104` | requestId → logger → `.workers.dev` hostname refusal (404, trailing dot normalised) |
| `GET /health` | `src/index.ts:106` | `{ status: 'ok' }` |
| `POST /extract` | `src/index.ts:117-160` | JSON `{url, maxDimension?}` → SSRF+size+format fetch → photon decode/resize → raw RGBA + `X-Image-Width/Height`. Caller: discord-worker `/extractor` |
| `POST /thumbnail` | `src/index.ts:169-203` | raw bytes → header dimension gate → crop to 640×264 band → WebP. Caller: presets-api preview upload |
| SSRF / fetch | `src/validators.ts:92-172, 395-478` | Discord-CDN allowlist, IP-literal + metadata blocks, 10 s `AbortController`, one manual redirect hop re-validated |
| size / format | `src/validators.ts:184-296, 308-379` | 10 MB cap (Content-Length **and** streaming), magic-byte sniff, `readBodyWithCap` |
| pre-decode gate | `src/validators.ts:238-248` + `src/dimensions.ts` | header-only w×h (PNG IHDR / JPEG SOFn / GIF LSD / WebP VP8·VP8L·VP8X / BMP), fail-closed |
| photon | `src/photon.ts` | `loadImage`, `resizeImage`, `extractPixels`, `computeCropBox`, `processImageFor{Extraction,Thumbnail}` |
| config | `wrangler.toml` | no routes, `workers_dev=false`, `preview_urls=false`, both envs; pinned by `src/wrangler-config.test.ts` |

### stoat-worker (`apps/stoat-worker/`)

| Module | File | What it does |
|---|---|---|
| bootstrap | `src/index.ts` | `loadConfig` → `new Client()` → `ready` + `messageCreate` listeners → `loginBot` |
| gate | `src/message-handler.ts` | self/bot filter → parse → per-user throttle → route → fixed-text error reply |
| parser | `src/commands/parser.ts` | `!xivdye` / `!xd` prefixes, short aliases, `>` splitting, trailing-option stripping |
| router | `src/router.ts` | `COMMAND_ROUTES` = `ping`, `help`, `about`, `dye.info`; `Object.hasOwn` lookup |
| commands | `src/commands/{ping,help,about,info}.ts` | four handlers; `info` resolves a dye and sends an embed |
| services | `src/services/{dye-resolver,response-formatter,command-throttle,message-context,loading-indicator}.ts` | resolution, echo sanitisation, 5 cmd / 10 s throttle, 500-entry 1 h context store, ⏳ helper |

---

## 2. Candidates

### image-stoat-01 — BUG — MEDIUM — `apps/image-worker/src/photon.ts:245`

**Claim.** `computeCropBox` produces a **zero-height** crop band for a one-pixel-wide source, and the
0-sized `crop`/`resize` that follows traps inside the photon WASM module.

**Failing input → wrong outcome.** A 1 × 1000 PNG uploaded as a preset preview image. It passes
presets-api's gate (`handlers/presets.ts:1078-1108`: non-empty, ≤ 5 MB, `sniffImageType` = png) and
image-worker's gate (`assertImageDimensionsFromHeader`: w>0, h>0, ≤ 4096/side, ≤ 16 MP). Then
`bandHeight = Math.round(1 / 2.4242) = 0`; `bandHeight > height` is false, so the band stays 1 × 0 and
`crop(original, 0, 0, 1, 0)` yields a 1 × 0 image that `resize(…, 640, 264, Lanczos3)` samples out of
bounds. A Rust panic in `@cf-wasm/photon` becomes a WASM trap: the request answers 400 with an opaque
message, and the trapped module instance is shared by every later `/extract` and `/thumbnail` on that
isolate.

**Why tests miss it.** `photon.test.ts:231-271` covers only 1920×1080, 1080×1920, 1000×1000, 1600×1200
and 3000×400 — no degenerate/narrow source. Every `processImageForThumbnail` test mocks
`@cf-wasm/photon` wholesale (`photon.test.ts:31-45`), so a 0-sized crop never reaches a real decoder.

**Covered by test:** no.

```ts
let bandWidth = width;
let bandHeight = Math.round(width / TARGET_ASPECT);   // width = 1  →  0
if (bandHeight > height) { bandHeight = height; bandWidth = Math.round(height * TARGET_ASPECT); }
const x1 = Math.round((width - bandWidth) / 2);
const y1 = isLandscape ? Math.round((height - bandHeight) / 2) : 0;
return { x1, y1, x2: x1 + bandWidth, y2: y1 + bandHeight };   // y2 === y1
```

**Fix direction.** Clamp both axes: `bandWidth = Math.max(1, …)`, `bandHeight = Math.max(1, …)` — and
add a minimum source-dimension check at the route so a degenerate upload is a clean 400.

---

### image-stoat-02 — BUG — LOW — `apps/image-worker/src/photon.ts:127` (and `:130`)

**Claim.** `resizeImage` rounds the minor axis to **0** for aspect ratios steeper than ~512:1, so
`/extract` returns a 200 with an empty pixel body.

**Failing input → wrong outcome.** A 2000 × 3 (or 4096 × 1) Discord attachment through `/extractor`.
With the default `maxDimension = 256`: `newHeight = Math.round((3 / 2000) * 256) = 0` →
`resize(image, 256, 0, Lanczos3)` → `get_raw_pixels()` is empty. The route answers 200 with a
zero-byte body and `X-Image-Height: 0`; discord-worker's `rgbPixels.length === 0` branch
(`handlers/commands/extractor.ts:516-522`) then tells the user the image has no colours it can read,
for an image that plainly has colours.

**Why tests miss it.** The four aspect-ratio tests (`photon.test.ts:115-154`) use 400×200, 200×400,
500×500, 500×300 — none anywhere near the ratio where the rounding collapses.

**Covered by test:** no.

```ts
if (width > height) { newWidth = maxDimension; newHeight = Math.round((height / width) * maxDimension); }
else                { newHeight = maxDimension; newWidth  = Math.round((width / height) * maxDimension); }
```

**Fix direction.** `Math.max(1, Math.round(...))` on both branches.

---

### image-stoat-03 — BUG — MEDIUM — `apps/image-worker/src/validators.ts:48` / `:53`

**Claim.** The dimension caps that FINDING-004 introduced to stop decompression bombs are set above
what the isolate can hold: 4096 × 4096 = exactly `MAX_PIXEL_COUNT`, so it is **accepted**.

**Failing input → wrong outcome.** A solid-colour 4096 × 4096 PNG compresses to a few tens of KB — far
under the 10 MB file cap — and its header passes the gate (`pixelCount > MAX_PIXEL_COUNT` is false at
equality). One RGBA buffer for it is 4096·4096·4 = **64 MiB**. photon holds `raw_pixels` (64 MiB) and
`dyn_image_from_raw` copies that vector again for each operation (another 64 MiB), so decode-then-resize
needs ≥ 128 MiB of WASM linear memory against Cloudflare's 128 MiB per-isolate limit — before the JS-side
source buffer and the resize output. The result is the OOM/abort the pre-decode gate exists to prevent,
reachable from any Discord attachment, in a Worker shared with presets-api.

**Why tests miss it.** `photon-gate.test.ts` asserts 20000×20000 and 4096×4097 are rejected and that a
640×480 "still decodes" — with photon mocked. Nothing exercises the largest *accepted* input, and a
mock allocates nothing.

**Covered by test:** no.

```ts
export const MAX_IMAGE_DIMENSION = 4096;              // 4096² × 4 B = 64 MiB per RGBA copy
export const MAX_PIXEL_COUNT = 16 * 1024 * 1024;      // 4096×4096 passes: `>` not `>=`
```

**Fix direction.** Derive the pixel cap from the memory budget rather than from the side length —
~4 MP (2048×2048) keeps two RGBA copies plus overhead inside 128 MiB; keep the side cap as a
secondary guard.

---

### image-stoat-04 — UNTESTED — MEDIUM — `apps/image-worker/src/photon.test.ts:339-357`

**Claim.** `it('calls crop with correct arguments')` asserts `expect.any(Number)` for all four crop
coordinates — it cannot fail for *any* crop box, including the degenerate one in image-stoat-01.

**Behaviour it was supposed to catch.** That `processImageForThumbnail` hands photon the box
`computeCropBox` actually computed (and that the box is inside the source). Two neighbours are the same
shape: `:195-202` (`'uses custom max dimension'`) asserts only that `new_from_byteslice` was called —
true for every input regardless of `maxDimension`; `:174-180` (`extractPixels`) asserts the length of
the constant its own mock returns.

**Covered by test:** the assertion exists, the behaviour is untested.

```ts
expect(crop).toHaveBeenCalledWith(
  expect.anything(), expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number)
);
```

**Fix direction.** Assert the four numbers `computeCropBox(100, 100)` returns, and add a
`computeCropBox` case at width 1 / height 1 that pins a ≥ 1 band.

---

### image-stoat-05 — REFACTOR — LOW — `apps/image-worker/src/index.ts:26-35`

**Claim.** The `maxDimension` rule is written twice. `index.ts` declares its own `MIN_MAX_DIMENSION`
and `isValidMaxDimension` (and rebuilds the error string at `:133`), while `photon.ts:19-32` already
exports `MIN_MAX_DIMENSION` and `assertValidMaxDimension` with the identical rule and the identical
message. `index.ts` imports `MAX_IMAGE_DIMENSION` from `validators.ts` but not the minimum.

**Risk it hides.** A change to the accepted range on one side leaves the route's 400 and the
processor's throw disagreeing, with nothing failing type-check.

**Covered by test:** both paths are tested independently (`index-limits.test.ts:31-44`,
`photon-gate.test.ts:69-76`), which is precisely why a drift between them would stay green.

**Fix direction.** Import `MIN_MAX_DIMENSION` / `assertValidMaxDimension` from `photon.js` in
`index.ts` and delete the local copies.

---

### image-stoat-06 — REFACTOR — LOW — `apps/image-worker/CLAUDE.md`

**Claim.** Three sections of the app's own project-instruction file describe pre-1.1.0 behaviour, and
the error contract points at a matcher that has moved.

- "Response size bound" and "What is actually bounded on the request path" both still state that
  `maxDimension` reaches `resize()` **unvalidated** and that *"nothing in the `/extract` route calls
  `validateDimensions`"*. Both were fixed in 1.1.0 (`index.ts:130-137`, `photon.ts:189-190`).
- The `/thumbnail` contract says *"The only guard is the empty-body check"* — there is now a
  Content-Length pre-check, a streaming 10 MB cap (`index.ts:172-185`) and the header dimension gate.
- "The error contract is verbatim" names five fragments including `'SSRF'`, sourced to
  `extractor.ts:536-543`. No message thrown anywhere in this Worker contains the string `SSRF`, and the
  matcher is now a 14-entry table in `apps/discord-worker/src/services/image-input-errors.ts:21-40`,
  reached from `extractor.ts:612`.

**Covered by test:** no — no gate reads CLAUDE.md.

**Fix direction.** Refresh the three sections and repoint the contract at `image-input-errors.ts`.

---

### image-stoat-07 — BUG — LOW — `apps/image-worker/src/validators.ts:186`

**Claim.** `'Image file is empty'` has no marker in discord-worker's `IMAGE_INPUT_MARKERS`, so an
empty 200 from the Discord CDN is classified as an internal failure.

**Failing input → wrong outcome.** `fetchImageWithTimeout` reaches `validateFileSize(0)` at `:464` and
throws `'Image file is empty'`. `imageInputReason()` finds no marker → `null` → `classifyError` records
the outcome as `unknown` rather than `image_input`, and the user is shown the generic
`matchImage.processingFailed` instead of a size/format message.

**Why tests miss it.** The marker table is tested against the messages it lists, not against the set of
messages image-worker can actually throw.

**Covered by test:** no.

**Fix direction.** Add `['too_large', 'file is empty']` (or a dedicated reason) to the table — the file
lives in discord-worker, so this belongs to that unit's owner; flagged here because it is a gap in the
image-worker error contract.

---

### image-stoat-08 — BUG — MEDIUM / **P3** — `apps/stoat-worker/src/index.ts:50-68`

**Claim.** No `client.on('error', …)` is registered, and revolt.js's emitter **throws** on an
unhandled `'error'` event — so any gateway error kills the process and pre-empts revolt.js's own
auto-reconnect.

**Failing state → wrong outcome.** Verified chain:

1. `revolt.js/lib/Client.d.ts:128` — `class Client extends AsyncEventEmitter<Events>`; `Events` has `error`.
2. `revolt.js/lib/Client.js:96` — `this.events.on("error", (error) => this.emit("error", error));`
3. `@vladfrangu/async_event_emitter@2.4.7` `dist/index.global.js:2452-2485` — `emit()` with
   `eventName === 'error'` and `events.error === undefined` **throws** (`throw er` / `Unhandled 'error'
   event emitted, received …`).
4. `revolt.js/lib/events/EventClient.js:79-81` (`socket.onerror`) and `:148-151` (a Revolt `Error`
   frame) both `emit("error", …)` from outside any promise we own → uncaught exception → Node exits.
5. At `EventClient.js:150-151` the throw pre-empts the following `this.disconnect()`, so the
   `Disconnected` state transition — and with it `Client.js:110-112`'s `autoReconnect` backoff — never
   runs.

`package.json` `start` is a bare `node dist/index.js`; nothing supervises it. A bad/expired bot token
takes the same path, so `main().catch` at `index.ts:85-90` never produces its intended
`'Fatal error during startup'` line.

**Why tests miss it.** `src/index.ts` is excluded from coverage (`vitest.config.ts` coverage
`exclude`), and `commands/index.test.ts` deliberately re-implements the handler rather than importing
the module (see image-stoat-13), so no test constructs a real `Client`.

**Covered by test:** no.

```ts
client.on('ready', () => { … });
client.on('messageCreate', createMessageHandler({ … }));
// no client.on('error', …)  →  emit('error') throws out of the socket callback
```

**Fix direction.** `client.on('error', (e) => logger.error('Gateway error', { error: … }));` — a
listener is enough to restore the `disconnect()` + backoff path. Add `process.on('uncaughtException')`
/ `unhandledRejection` guards and a restart policy if the bot is ever un-parked.

---

### image-stoat-09 — BUG — MEDIUM / **P3** — `apps/stoat-worker/src/services/dye-resolver.ts:135-138`

**Claim.** The prefix branch of `getSuggestions` is **unreachable**, so every "Did you mean?" comes
from a character-overlap heuristic that matches almost anything.

**Failing input → wrong outcome.** `getSuggestions` is called from exactly one place — line 88, inside
`if (partialMatches.length === 0)` — and `partialMatches` (line 78-84) already holds every dye whose
lowercased name `.includes(lowerInput)`. `startsWith ⊆ includes`, so the filter at line 135 is always
empty at that call site. Control therefore always falls to lines 141-149, which count each character of
the query (spaces and duplicates included) present *anywhere* in a candidate and accept at ≥ 70 %. For
`!xd info Snow Whte` (9 chars, threshold 6.3) nearly every dye name qualifies, so the bot answers
`Did you mean: <first three dyes in database order>?`.

**Why tests miss it.** `dye-resolver.partial.test.ts:99-105` is *named* `'generates startsWith
suggestions when available'` but asserts `expect(['single']).toContain(result.kind)` — it proves the
input never reaches `getSuggestions` at all. The fallback test at `:107-113` puts its only assertion
inside `if (result.kind === 'none')` with no preceding kind assertion, and that assertion is
`expect(Array.isArray(result.suggestions)).toBe(true)`, true unconditionally.

**Covered by test:** no.

```ts
const startsWith = names.filter((n) => n.toLowerCase().startsWith(lower));
if (startsWith.length > 0) { return startsWith.slice(0, maxResults); }   // unreachable
```

**Fix direction.** Replace the overlap heuristic with a real edit-distance ranking (or drop suggestions
when nothing scores well) and delete the dead prefix branch.

---

### image-stoat-10 — BUG — LOW / **P3** — `apps/stoat-worker/src/commands/ping.ts:9-11`

**Claim.** `!xd ping` always reports `0ms`. Both `Date.now()` calls run in the same synchronous tick,
before `sendMessage` is even invoked — the interval measured spans nothing.

**Failing input → wrong outcome.** Every `!xd ping` answers `🏓 Pong! (0ms)`, while the module docstring
promises "WebSocket latency".

**Why tests miss it.** There is no `ping.test.ts`; `commands/index.test.ts:73-77` only asserts that
*something* was sent.

**Covered by test:** no.

```ts
const startTime = Date.now();
await ctx.message.channel?.sendMessage({
  content: `🏓 Pong! (${Date.now() - startTime}ms)`,   // evaluated before the send
```

**Fix direction.** Report `client.events.ping()` (revolt.js tracks the gateway RTT), or measure around
the awaited send and edit the message.

---

### image-stoat-11 — BUG — MEDIUM / **P3** — `apps/stoat-worker/src/commands/help.ts:9-34`

**Claim.** Help and About advertise a command set the router does not have, so the bot's own
documentation is mostly a list of errors.

**Failing input → wrong outcome.** `HELP_OVERVIEW` lists `search`, `list`, `random`, `harmony`,
`gradient`, `mixer`, `comparison`, `match`, `extract`, `a11y`, `prefs`, `prefs set`; `COMMAND_ROUTES`
(`router.ts:101-109`) registers only `ping`, `help`, `about`, `dye.info`. `!xd random` parses through
`SHORT_ALIASES` to `dye`/`random` and answers ``Unknown command "dye.random"`` — echoing a compound key
the user never typed. `about.ts:22-25` additionally says *"React with ❓ on any bot message for help"*,
but `info.ts:105-108` records that reactions were deliberately removed because no `messageReactionAdd`
listener exists (BUG-038), and `index.ts` still registers none.

**Why tests miss it.** `help.test.ts` asserts the overview text is sent; nothing cross-checks its
entries against `COMMAND_ROUTES`.

**Covered by test:** no.

**Fix direction.** Generate the help text from `COMMAND_ROUTES` (or mark unimplemented rows "coming
soon"), drop the ❓ sentence from About, and add a test asserting every command named in help resolves
via `isRegisteredCommand`.

---

### image-stoat-12 — BUG — LOW / **P3** — `apps/stoat-worker/src/commands/parser.ts:77-78`

**Claim.** The post-prefix separator check accepts only a literal space, so a tab or newline after the
prefix silently drops the command.

**Failing input → wrong outcome.** `"!xd\nping"` (ordinary in a multi-line Revolt message):
`afterPrefix === '\n'`, which is neither `undefined` nor `' '`, so no prefix matches and `parseCommand`
returns `null` — the bot ignores the message entirely. Tokenising eleven lines later uses `/\s+/`, so
the rest of the parser already handles arbitrary whitespace.

**Why tests miss it.** `parser.test.ts` contains no tab or newline case.

**Covered by test:** no.

```ts
const afterPrefix = trimmed[prefix.length];
if (afterPrefix === undefined || afterPrefix === ' ') { matchedPrefix = prefix; break; }
```

**Fix direction.** `if (afterPrefix === undefined || /\s/.test(afterPrefix))`.

---

### image-stoat-13 — UNTESTED — LOW / **P3** — `apps/stoat-worker/src/commands/index.test.ts:37-53`

**Claim.** Four assertions in this file cannot fail, and its five "handler" tests exercise a **copy** of
the gate rather than the gate.

- `:37-53` re-implements the `messageCreate` logic inline instead of importing `createMessageHandler`,
  and the copy omits the other-bot filter (`message.author?.bot`) and the throttle. Deleting either
  check from `message-handler.ts` leaves all five tests green. (`message-handler.test.ts` is the file
  that genuinely covers the gate — this one is a drift-prone duplicate.)
- `:95-99` — `expect(typeof process.exit).toBe('function')`, under the name "shutdown handler".
- `:102-114` — asserts the test's own `createMockClient` mock registers and resolves; no product code.
- `info.test.ts:85-92` — `'stores message context after successful info'` asserts
  `expect(ctx.messageContextStore.size).toBeGreaterThanOrEqual(0)`; a `Map` size is never negative.

**Behaviour that goes untested.** The bot/self/throttle ordering in the real handler, and — from the
`info.test.ts` case — BUG-038's fix that the context is keyed by the **bot reply's** id
(`info.ts:124`), not the user's message id, so a regression to the old key has no test.

**Fix direction.** Import `createMessageHandler` in `commands/index.test.ts` (or delete the duplicated
describe block, since `message-handler.test.ts` covers it), and assert
`ctx.messageContextStore.get(sentReplyId)` in `info.test.ts`.

---

### image-stoat-14 — REFACTOR — LOW / **P3** — `apps/stoat-worker/src/services/loading-indicator.ts`

**Claim.** stoat-worker is the one workspace deliberately left off the dead-code gate (root
`knip.jsonc:12-14`, `turbo.json:66`, and its `package.json` `lint` is a bare `eslint src/`), and it
carries the corresponding drift. Symbols with **no production reader** (test files only, or none):

| Symbol | File |
|---|---|
| `withLoadingIndicator` (whole module) | `services/loading-indicator.ts:25` |
| `DYE_INFO_REACTIONS` | `services/response-formatter.ts:43` |
| `parseMultiDyeArgs` (+ `MultiDyeArgs`) | `commands/parser.ts:143` |
| `isAuthorized` | `config.ts:57` |
| `upstashRedisUrl` / `upstashRedisToken` | `config.ts:10-12, 49-50` (throttle is in-memory) |
| every `MessageContextStore` write | `commands/info.ts:124` — no reaction listener reads it |

**Fix direction.** Either add `lint:dead` for this workspace when it is un-parked, or delete the six
above; `MessageContextStore` should go together with the reaction feature or come back with its
listener.

---

## 3. POSITIVE — do not re-file

- **The private-only invariant is genuinely defended on two axes.** `wrangler.toml` (no routes,
  `workers_dev=false`, `preview_urls=false`, both envs) is pinned by `src/wrangler-config.test.ts`,
  which correctly asserts the *presence* of `workers_dev = false` (a deleted line defaults to `true` for
  a routeless worker), and `index.ts:97-104` refuses `*.workers.dev` before any body read, with the
  RFC 1035 trailing-dot form normalised.
- **SSRF handling is complete**: HTTPS-only, exact-host allowlist, all IP literals and metadata hosts
  blocked, one manual redirect hop whose target is re-validated through the same allowlist, a second
  3xx rejected by `!ok`, and `redirect: 'manual'` (not workerd's non-existent `'error'` mode).
- **Content-Type is never trusted** — format comes from magic bytes (`detectImageFormat`) and
  dimensions are re-derived from the container header (`dimensions.ts`), which fails closed on anything
  it cannot parse.
- **Byte caps bind while streaming**, not after buffering: `readBodyWithCap` checks before pushing a
  chunk, cancels the reader, and releases the lock in `finally`; both the Content-Length pre-check and
  the stream cap are covered by real tests (`validators-cap.test.ts`, `index-limits.test.ts`).
- **photon memory is released on every path.** `processImageForExtraction` frees in `finally` with an
  `originalImage !== resizedImage` guard; `processImageForThumbnail` frees `new Set([original, cropped,
  resized])` so a shared pointer is never freed twice. There is no cached init promise to poison.
- **The image-worker → discord-worker error contract is coherent and order-sensitive in the right
  way**: `IMAGE_INPUT_MARKERS` lists `'Invalid URL format'` *before* the generic `'format'` marker, so
  a bad URL is classified `url` and not `format` (only `'Image file is empty'` is missing — see -07).
- **stoat's security remediations hold.** `Object.hasOwn` on all three user-keyed tables with a
  dedicated `prototype-keys.test.ts`; `sanitizeEcho` defuses Revolt mentions before the shared
  sanitiser; the throttle rejects without consuming a slot and prunes lazily; logs carry no user ids,
  channel ids or raw args, and an unregistered token is replaced by a fixed placeholder on all three
  log lines. `message-handler.test.ts` tests the real handler, including the fallback-reply failure path.
- **Reconnect is not missing** — revolt.js defaults `autoReconnect: true` with exponential backoff
  (`Client.js:56-63, 110-112`); the gap is only the missing `error` listener that pre-empts it (-08).

---

## 4. REJECTED

- *Cached rejected WASM-init promise poisoning the isolate* — `@cf-wasm/photon` is bound at import in
  this Worker; no init promise is cached in repo code, so the resvg-style pattern does not exist here.
- *Missing auth on the service-binding routes* — confirmed nothing exposes them: no routes in either
  env, `workers_dev`/`preview_urls` false, test-pinned, plus the hostname guard. Defence is adequate.
- *`fetch` without a timeout / unbounded redirect chain* — `FETCH_TIMEOUT_MS` via `AbortController`
  cleared in `finally`; exactly one hop, re-validated.
- *`parseInt(Content-Length)` NaN reaching a comparison* (`index.ts:174`, `validators.ts:448`) — both
  guarded by `Number.isFinite`, and `readBodyWithCap` is the real bound.
- *Premultiplied alpha / sampling arithmetic in `/extract`* — the Worker returns straight RGBA from
  `get_raw_pixels()`; sampling and the α ≥ 128 filter live in
  `PaletteService.pixelDataToRGBFiltered` (core), outside this unit, and its stride is a correct `i += 4`.
- *Empty pixel body crashing discord-worker* — handled by the `rgbPixels.length === 0` branch at
  `extractor.ts:516`; that is why image-stoat-02 is LOW rather than HIGH.
- *`presets-api` and `discord-worker` parsing image-worker errors incompatibly* — presets-api
  deliberately discards the body and returns a fixed `'Image could not be processed'`
  (`handlers/presets.ts:1111-1117`); it never substring-matches, so no contract conflict exists.
- *BMP `BITMAPCOREHEADER` misparse* — `readBmp` reads BITMAPINFOHEADER offsets, so a 12-byte OS/2
  header yields a huge value and is rejected. Fails closed (a false rejection of a format nothing in
  this pipeline produces), not a bypass.
- *`crop`/`resize` box escaping the source bounds* — checked both branches of `computeCropBox` with
  odd/even remainders; `x2 ≤ width` and `y2 ≤ height` always hold. Only the zero-size case (-01) breaks.
- *Bot token leaking into stoat's crash output* — the uncaught value is `inspect()`ed, and the gateway
  URL carries `?token=`; but revolt.js has no `ws` dependency, so Node 22's global (undici) WebSocket is
  used, whose `url` is a getter that `util.inspect` does not invoke. Not reproducible.
- *`CommandThrottle` pruning with the wrong window* (the known regression shape) — verified correct:
  `lastPrune = 0` makes the first call prune, the cutoff uses the same `windowMs`, and a rejected call
  re-stores the filtered list without appending.
- *`MessageContextStore` unbounded growth* — 500-entry cap with insertion-order eviction plus a 1 h TTL
  checked on read.
- *Guarded `if (result.kind === …)` blocks throughout `dye-resolver.test.ts`* — each is preceded by
  `expect(result.kind).toBe(…)`, so the narrowing guard is a TypeScript idiom, not a vacuous escape.
  The two genuine cases are called out in -09 and -13.
- *`/extract` returning 400 for internal failures* — cosmetic; discord-worker classifies on the message,
  not the status.

---

## 5. COVERED — 31 files read

**image-worker (source, 5):** `src/index.ts`, `src/validators.ts`, `src/photon.ts`,
`src/dimensions.ts`, `src/types.ts`.
**image-worker (tests skimmed, 7):** `src/index.test.ts`, `src/index-limits.test.ts`,
`src/photon.test.ts`, `src/photon-gate.test.ts`, `src/validators.test.ts`,
`src/validators-cap.test.ts`, `src/dimensions.test.ts`, `src/wrangler-config.test.ts` (head).
**image-worker (config/docs, 4):** `wrangler.toml`, `package.json`, `vitest.config.ts`, `CLAUDE.md`
(+ `CHANGELOG.md` head).

**stoat-worker (source, 14):** `src/index.ts`, `src/config.ts`, `src/message-handler.ts`,
`src/router.ts`, `src/commands/parser.ts`, `src/commands/ping.ts`, `src/commands/help.ts`,
`src/commands/about.ts`, `src/commands/info.ts`, `src/services/dye-resolver.ts`,
`src/services/response-formatter.ts`, `src/services/command-throttle.ts`,
`src/services/message-context.ts`, `src/services/loading-indicator.ts`.
**stoat-worker (tests skimmed, 5):** `src/commands/index.test.ts`, `src/commands/prototype-keys.test.ts`,
`src/commands/info.test.ts`, `src/services/dye-resolver.test.ts`,
`src/services/dye-resolver.partial.test.ts` (+ `message-handler.test.ts` headings).
**stoat-worker (config, 2):** `package.json`, `vitest.config.ts`.

**Cross-unit files read to confirm claims (read-only, not in scope):**
`apps/discord-worker/src/services/image-client.ts`,
`apps/discord-worker/src/services/image-input-errors.ts`,
`apps/discord-worker/src/handlers/commands/extractor.ts` (490-628),
`apps/presets-api/src/services/preview-image-service.ts` (1-220),
`apps/presets-api/src/handlers/presets.ts` (1060-1140),
`packages/core/src/services/PaletteService.ts` (470-503), root `knip.jsonc`, `turbo.json`,
and `node_modules/.pnpm/revolt.js@7.2.0/…/lib/{Client.d.ts,Client.js,events/EventClient.js}` +
`@vladfrangu/async_event_emitter@2.4.7/dist/index.global.js` (to verify image-stoat-08).
