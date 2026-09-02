# Deep-dive analysis — xivdyetools monorepo (2026-09-02)

- **Branch/commit:** `main` @ `e7ac4042` (audit branch `worktree-deep-dive-2026-09-02`) · **Scope:** all 8 packages and 9 apps, every non-test source file
- **Method:** uncached gates + coverage baselines → lead-pattern grep over 486 tracked sources → 18 parallel read-only reviewers (one per deploy unit; `web-app` split five ways, `discord-worker` and `core` two each) → coordinator verification at `file:line`, with runnable repros for the colour-math and redaction claims
- **Totals:** the 18 reviewers returned **252 candidates**; after merging cross-unit duplicates, **250 findings** — **208 bug-class** (159 defects: 0 CRITICAL, **14 HIGH**, 64 MEDIUM, 74 LOW of which 7 are documentation-only; plus 49 *untested behaviour* findings, where the hidden bug is whatever the test was written to catch), **29 refactors**, **14 optimizations**. **No source file was modified.**
- **Sprint 0 (act now):** BUG-016 first (it unmasks the rest), then BUG-006, BUG-012, BUG-013, BUG-009, BUG-010
- **Coordinator verification:** every HIGH and every finding with its own file in `findings/` was re-checked at `file:line` by the coordinator, four of them with runnable repros against the built packages. Candidates that did not survive that check are in *Rejected suspicions*.

## Baseline health

Every gate the project defines is green at the audit commit, uncached.

| Gate | Result |
|---|---|
| `turbo run build type-check lint` | 44/44 tasks pass |
| `turbo run test` | 25/25 tasks pass |
| `test:coverage`, all 17 units, `--force` | **9,695 tests pass** |
| Package coverage | 94–99 % statements |
| Worker coverage | 89–99 % statements |
| `web-app` coverage | 74 % statements / 61 % branches — the lowest, and where the most findings landed |

## How to read this catalog

Findings that carry a file in `findings/` are the ones whose severity or blast radius justified a full write-up with evidence and a fix direction. The rest are catalogued below with an exact `file:line` and a pointer to the reviewer return in `evidence/review-<unit>.md`, which holds the code excerpt, the failing input and the fix direction for each. Every finding has an ID so the planner can schedule it; only the volume of prose differs.

## Catalog — bugs

### HIGH

| ID | Title | Type | Deploy unit | Tested? |
|---|---|---|---|---|
| [BUG-006](findings/BUG-006.md) | RYB blending loses green entirely — greens and teals return blue on the bot's default mix mode | Logic | `core` → `bot-logic` → `discord-worker` | no |
| [BUG-016](findings/BUG-016.md) | Shared web-app test mock inverts the dye id contract, manufacturing green for a whole defect class | Untested | `web-app` | n/a |
| [BUG-012](findings/BUG-012.md) | "Inspect Dye in → Harmony" broken for all 125 dyes — sends the id grammar the receiver rejects | Logic | `web-app` | no |
| [BUG-013](findings/BUG-013.md) | Moderation and submission-log embeds print dye id numbers instead of names | Logic | `discord-worker` | no |
| [BUG-009](findings/BUG-009.md) | Opening a second modal strips the first one's listeners, leaving it unclosable | State | `web-app` | no |
| [BUG-010](findings/BUG-010.md) | `/preset moderate action:stats` prints "undefined" in all four counters | Logic | `moderation-worker` | no |
| [BUG-007](findings/BUG-007.md) | Extractor prints raw RGB distance as ΔE, so every match card is mis-graded | Logic | `web-app` | no |
| [BUG-014](findings/BUG-014.md) | The 1–9 tool shortcuts have no production listener; the shortcuts panel advertises them | Untested | `web-app` | no |
| [BUG-015](findings/BUG-015.md) | A one-dye share link parses as a number, so single-dye Comparison/Accessibility links open empty | Edge case | `web-app` | no |
| BUG-017 | `dye-grid.ts:433` — `Enter`/`Space` `preventDefault()`s before the `focusedIndex` guard: Tab-focus + Enter selects nothing, and after arrow nav it selects the wrong dye | Logic | `web-app` | no |
| BUG-018 | `budget-tool.ts:1160,1818,1822,1827` — SEND TO hand-offs navigate with `{dye: dye.name}` where receivers parse `?dye=` as a stainID → `parseInt` → NaN → "invalid dye" toast; harmony uses a third, unread `add=` grammar | Logic | `web-app` | no |
| BUG-019 | `accessibility-tool.ts:2010` — `updateShareButton()` is wired only to the desktop selector, so palette picks, clear, card-remove and the mobile drawer leave Share disabled or stale | State | `web-app` | no |
| BUG-020 | `v4/preset-tool.ts:492-507` — `reconcileTombstones` persists `deletedByAuthor` for any saved preset missing from the fetched page; the API clamps `limit` to 50 while the tool asks 100, and a post-boot outage leaves `offline` false | State | `web-app` | no |
| BUG-021 | `og-data-generator.ts:764` — the Swatch crawler card still reads the retired `?hex=`/`?sheet=` grammar; the SPA shares `?slot=&i=`, so every Swatch share unfurls as the generic default card | Logic | `og-worker` | no |

### MEDIUM

| ID | Title | Deploy unit |
|---|---|---|
| [BUG-004](findings/BUG-004.md) | Logger's cycle guard returns the raw node, emitting a secret reachable through a cycle | `logger` |
| [BUG-005](findings/BUG-005.md) | `sanitizeErrorMessage` stops at the first space, leaving Basic credentials in the log | `logger` |
| [BUG-011](findings/BUG-011.md) | Allowlist lookups walk `Object.prototype`; `constructor`/`__proto__` pass validation (3 units) | `core`, `api-worker`, `bot-logic` |
| [BUG-001](findings/BUG-001.md) | moderation-worker reads only the legacy language key, ignoring preferences set in the main bot | `moderation-worker` |
| [BUG-008](findings/BUG-008.md) | `extractAndMatchPalette` matches by the requested method but always reports RGB distance | `core` |
| BUG-022 | `og-worker/services/svg/harmony.ts:39-48` — `IDEAL_OFFSETS` diverges from the page's `HARMONY_OFFSETS`: `analogous` gains a 180° band, `compound` is `[30,150,210]` vs `[30,180,330]`, `shades` missing | `og-worker` |
| BUG-023 | `og-worker/services/svg/swatch.ts:50-57` — ranks by hardcoded `ciede2000` but prints `deltaForAlgorithm(…)` labelled ΔEOK; deltas can run out of order | `og-worker` |
| BUG-024 | `og-worker/services/svg/band-shared.ts:14-22` — `ALGO_TAG` lacks `hyab`/`oklch-weighted`, so `?algo=hyab` prints "HYAB" over a ΔE2000 number | `og-worker` |
| BUG-025 | `og-worker/index.ts:264-278` — cache key carries no app/data version with `s-maxage=604800` and no purge on deploy: cards stale up to 7 days after a design or dye-data change | `og-worker` |
| BUG-026 | `discord-worker/services/announcements.ts:83-94` — `sendAnnouncement` discards Discord's Response, so a 403/400 still writes the `announced:v:` memo and the release is permanently unannounceable | `discord-worker` |
| BUG-027 | `discord-worker/services/budget/budget-calculator.ts:286` — `pricesStale`/`pricesAsOf` are produced but read nowhere; a Universalis outage serves stale prices with no warning | `discord-worker` |
| BUG-028 | `discord-worker/index.ts:1201-1210` — favourites name back-fill awaited inside the lookup's `try`; a KV write failure returns `[]`, so the user gets no autocomplete at all | `discord-worker` |
| BUG-029 | `discord-worker/services/preferences.ts:171-243` and `handlers/commands/preferences.ts:305` — `/preferences set` with k options does k sequential read-modify-writes on one KV key. KV's 1 write/s/key limit and its eventual consistency can drop all but the last while the embed reports every one saved. Reported independently by both discord-worker reviewers, from the service and the handler | `discord-worker` |
| BUG-030 | `discord-worker/services/fonts.ts:51-61` — the bundled font union is cut from locale data only, but raw user preset name/description/author are rendered into the card, so CJK user text is tofu | `discord-worker` |
| BUG-031 | `discord-worker/services/budget/universalis-client.ts:345-374` — `validateWorld` swallows every error, telling the user a valid world is "not found" during a proxy outage | `discord-worker` |
| BUG-032 | `discord-handlers/gradient.ts:158` — per-step dye emoji never renders: `step.dyeId` is a legacy itemID but `getDyeEmoji` is keyed by stainID | `discord-worker` |
| BUG-033 | `discord-handlers/harmony.ts:168` — base-colour emoji never renders, same id mismatch (`resolved.id` vs `dye.stainID` one line above) | `discord-worker` |
| BUG-034 | `discord-handlers/manual.ts:258` — `/manual topic:🪙` makes two uncached Universalis calls before a non-deferred reply, against the 3-second ack | `discord-worker` |
| BUG-035 | `discord-handlers/stats.ts:375` — `/stats preferences` reads one `KV.list()` page as the whole namespace; the count saturates at 1000 | `discord-worker` |
| BUG-036 | `discord-handlers/stats.ts:390` — up to 100 sequential `KV.get()` calls on a non-deferred path, 2–5 s against a 3 s ack | `discord-worker` |
| BUG-037 | `discord-handlers/stats.ts:40` — `BOT_VERSION` hardcoded `'4.0.0'`; public `/stats` contradicts `/about` (package is 5.1.1) and the test pins the stale literal | `discord-worker` |
| BUG-039 | `discord-handlers/buttons/preview-image.ts:211` — failure-path `sendFollowUp` neither checks `.ok` nor is wrapped; the moderator gets no feedback and `waitUntil` rejects unhandled | `discord-worker` |
| BUG-040 | `moderation-worker/utils/discord-api.ts:35-62` — `editOriginalResponse` has no `AbortSignal` and no `.ok` check at any of 5 call sites; a refused follow-up leaves "thinking…" forever | `moderation-worker` |
| BUG-041 | `presets-api/handlers/moderation.ts:97` — a moderator transition to `approved`/`pending` can violate the partial UNIQUE `dye_signature` index, uncaught: opaque 500 and the batched `moderation_log` row is lost | `presets-api` |
| BUG-042 | `presets-api/handlers/presets.ts:952,1013` — `remaining_submissions` and the rollback guard count deletable rows, not `max(rows, events)`, disagreeing with `GET /rate-limit` after a self-delete | `presets-api` |
| BUG-043 | `presets-api/services/notification-service.ts:173` — a missing `DISCORD_WORKER`/`INTERNAL_WEBHOOK_SECRET` resolves as success: no dead letter, no error, and `validateEnv` does not require it in production | `presets-api` |
| BUG-044 | `presets-api/middleware/rate-limit.ts:363` — all service-binding traffic keys to `unknown`, so both bots and every Discord user share one 100/min bucket | `presets-api` |
| BUG-045 | `presets-api/services/preview-image-service.ts:151` — the only outbound call with no `AbortSignal`; a stalled decode hangs the author's upload | `presets-api` |
| BUG-046 | `api-worker/lib/validation.ts:318` — `?method=` bypass (the api-worker instance of BUG-011): HTTP 200 with `distance: null` and no `method` echo | `api-worker` |
| BUG-047 | `api-worker/routes/dyes.ts:279` — `?sort=` present-but-empty returns 400 `MISSING_PARAMETER` on an optional param; `minPrice`/`maxPrice`/`order` are immune | `api-worker` |
| BUG-048 | `api-worker/universalis/router.ts:85` — service-binding calls carry no `CF-Connecting-IP`, so the whole discord-worker fleet shares one `unknown` 30-miss/min bucket | `api-worker` |
| BUG-049 | `oauth/handlers/oauth-flow.ts:54` — every GET-callback failure redirects to `FRONTEND_URL`, dumping a beta user on production with their session context unreachable | `oauth` |
| BUG-050 | `oauth/handlers/token.ts:127-151` — a KV write failure on `POST /auth/revoke` answers `200 {success:true}` with a note blaming a missing JTI; the token stays valid and nothing is logged | `oauth` |
| BUG-051 | `oauth/handlers/xivauth.ts:285` — the roster is assigned before any `Array.isArray` check, so a 200 with non-array JSON defeats the "not fatal" catch and `characters.find` 500s the sign-in | `oauth` |
| BUG-052 | `image-worker/validators.ts:48,53` — 4096×4096 is accepted (64 MiB RGBA, copied again by photon) in a 128 MiB isolate | `image-worker` |
| BUG-053 | `image-worker/photon.ts:245` — `computeCropBox` yields a zero-height band for a 1-px-wide source; the 0-size crop traps the shared photon WASM instance | `image-worker` |
| BUG-054 | `svg/gradient.ts:495-511` — `wrapVerdict` never `fitText`s its result: the ja verdict renders 432 px and ko 445.5 px on a 400 px card, clipping 35–40 % of the sentence | `svg` |
| BUG-055 | `bot-logic/css-colors.ts:170` — the bot-logic instance of BUG-011: `/contrast dye1:constructor` throws in the handler instead of returning the localized invalid-colour message | `bot-logic` |
| BUG-056 | `core/CharacterColorService.ts:343-346` — `findClosestDyes` dereferences `best[-1]` and throws when `count <= 0`, reachable via a corrupted `maxResults` in localStorage | `core` |
| BUG-057 | `core/APIService.ts:1021-1028` — `isAPIAvailable()` is the only fetch in the file that bypasses `fetchWithTimeout` | `core` |
| BUG-058 | `core/LocalizationService.ts:569-571` — `preloadLocales` uses `setLocale`, so preloading silently switches the active locale to the last array entry | `core` |
| BUG-059 | `core/dye/HarmonyGenerator.ts:239,434` — a two-way ΔE ternary collapses `deltaEFormula:'oklab'` to CIE76 and its tolerance default to 40 (latent, no live caller) | `core` |
| BUG-060 | `webapp/auth-service.ts:790` — `JSON.parse(atob(...))` with no UTF-8 decode: mojibake display name for every non-ASCII Discord user | `web-app` |
| BUG-061 | `webapp/shared/logger.ts:17,87` — `browserLogger` is imported but unused; `logger` is a raw console shim, so the package's secret redaction never runs in the browser | `web-app` |
| BUG-062 | `webapp/community-preset-service.ts:325` — `message.includes('404')` never matches presets-api's `"Preset not found"` body, so `getPreset` throws instead of returning null | `web-app` |
| BUG-063 | `webapp/auth-service.ts:282,584` — a corrupt expiry parses to `NaN`, defeating both the `<` and the truthiness check: a client session that never expires | `web-app` |
| BUG-064 | `webapp/harmony-generator.ts:243` — a filtered-out companion's replacement is picked by plain Euclidean RGB, not the configured ΔE method, and the deviance switches scale with it | `web-app` |
| BUG-065 | `webapp/v4-layout.ts:708-722` — the BUG-040 supersede guard is missing from the `catch`: a late-rejecting lazy import wipes the newer tool's DOM and resets `mountedToolId` | `web-app` |
| BUG-066 | `webapp/v4/dye-palette-drawer.ts:1194` — all 125 swatches are `<div @click>` with no tabindex/role/keydown; keyboard users can star a dye but never select one | `web-app` |
| BUG-067 | `webapp/v4/share-button.ts:292` — share-validation failure is fully silent: `setError()` writes state no v4 render reads, and no `Error` is passed so `logger.error` is skipped | `web-app` |
| BUG-068 | `webapp/v4/preset-tool.ts:366` — every Presets config change (6 of them client-side only) spinner-flashes the grid and refetches 100 presets | `web-app` |
| BUG-069 | `webapp/dye-grid.ts:454` — `f`/`c` shortcuts pass `dye.id` into handlers matching on `stainID`, so both are permanently dead (a test asserts it and cannot fail) | `web-app` |
| BUG-070 | `webapp/accessibility-tool.ts:487` — `renderLeftPanel()` never destroys the old DyeSelector; each language change leaks a selector, a grid and its subscriptions, all still re-rendering | `web-app` |
| BUG-071 | `webapp/dye-selector.ts:709` — `destroy()` never destroys child `searchBox`/`dyeGrid`, leaking a favourites listener per drawer open | `web-app` |
| BUG-072 | `webapp/harmony-tool.ts:1386` — `matches[0].dye` unguarded; three filter toggles can exclude all 125 dyes → TypeError (the sibling loop already uses `?.`) | `web-app` |
| BUG-073 | `webapp/harmony-tool.ts:2644` — `selectDye`/`selectCustomColor`/`clearDyes` never refresh the left-panel base-dye display, leaving a stale swatch | `web-app` |
| BUG-074 | `webapp/budget-tool.ts:625` — local `priceData` is merged and never cleared, so after a world change the ledger shows the old world's prices under the new world's name | `web-app` |
| BUG-075 | `webapp/budget-tool.ts:609` + `harmony-tool.ts:1766` — a superseded fetch returns an empty Map by design, which both tools read as "market offline" and show a false failure banner | `web-app` |
| BUG-076 | `webapp/market-board.ts:66` — `onMount` → `loadServerData` repopulates an already-filled `<select>` without clearing: every DC and world listed twice | `web-app` |
| BUG-077 | `webapp/image-zoom-controller.ts:441` — `setImage()` adds document keydown/keyup on every call, so `+` steps 20 % after two images and 30 % after three | `web-app` |
| BUG-078 | `webapp/color-picker-display.ts:184` — 3-digit hex stored and emitted raw: `input[type=color]` sanitises `#F00` to black, and typing `#123456` emits `#123` mid-way | `web-app` |
| BUG-079 | `webapp/advanced-options-panel.ts:220` — behaviour toggles capture config once, so a reset or import in the same open panel makes the next tap write the negation of a stale value | `web-app` |
| BUG-080 | `webapp/camera-preview-modal.ts:298` — no route-change teardown; in-app navigation leaves the modal open with a live MediaStream | `web-app` |
| BUG-081 | `webapp/preset-edit-form.ts:377` — `availableDyes.slice(0,100)` hides 25 of the 125 dyes in the edit picker; the submission form renders all | `web-app` |
| BUG-082 | `webapp/my-submissions-modal.ts:75` — `getMySubmissions()` never rejects, so the error toast is dead code and an API outage shows "no submissions yet" with 0/0/0 stats | `web-app` |
| BUG-083 | `webapp/preset-edit-form.ts:70,505,673` — `MAX_TAGS`/`MAX_TAG_LENGTH` are printed in the hint but never enforced, and `exampleLinkError` is wired to blur only | `web-app` |
| BUG-084 | `webapp/keyboard-service.ts:143,150,157` — Shift+T/L/S omit the ctrl/alt/meta exclusion the 1–9 branch has, so `Ctrl+Shift+T` also flips the theme | `web-app` |
| BUG-085 | `webapp/tutorial-spotlight.ts:238` — the tooltip is positioned from a measurement taken before its content is written: a 0×0 box on step 1 | `web-app` |
| BUG-086 | `webapp/tutorial-spotlight.ts:148` — no `scroll` listener (ResizeObserver does not fire on scroll), so the fixed spotlight drifts off target | `web-app` |
| BUG-087 | `webapp/collection-manager-modal.ts` + `add-to-collection-menu.ts` — hardcoded `dark:` utilities key off the OS, not the app theme (`tailwind.config.js` sets no `darkMode`): unreadable on the two mismatched combinations | `web-app` |
| BUG-088 | `webapp/my-submissions-modal.ts:208` — `dismissTop()` inside an un-awaited async `onConfirm` closes whatever modal is top when the DELETE resolves | `web-app` |
| BUG-089 | `webapp/modal-container.ts:520` — the focus trap is a one-shot snapshot; the preset forms' `innerHTML=''` rebuild detaches it and Tab escapes the dialog | `web-app` |
| BUG-090 | `webapp/changelog-modal.ts:108` / `v4-layout.ts:264` — a failed `import('virtual:changelog')` rejects into `void` with no global handler, so "What's New" silently does nothing after a deploy | `web-app` |
| BUG-091 | `webapp/extractor-tool.ts:2391` — auto-extract omits `matchingMethod`, always using ΔE2000, then the sidebar re-runs K-means for an identical result | `web-app` |
| BUG-092 | `webapp/extractor-tool.ts:2098` — the closest dye is prepended to a `findDyesWithinDistance` list that already contains it: duplicate top card, count off by one | `web-app` |
| BUG-093 | `webapp/swatch-tool.ts:318` — ungated `loadColors()` race; the constructor's hair/skin chunk resolves last and repaints the grid with the wrong palette under the new heading | `web-app` |
| BUG-094 | `webapp/mixer-tool.ts:1298` — `updateShareButton()` is only reachable via `showEmptyState()`, so field-cell taps and `setConfig` leave a stale `ratio`/`mode`/`algo` in the copied link | `web-app` |
| BUG-095 | `webapp/base-component.ts:605` — `this.on()` is used in re-render paths but the listener map is cleared only on `update()`/`destroy()`: ~44 detached nodes retained per swatch click | `web-app` |
| BUG-096 | `webapp/accessibility-tool.ts:1268` — `activeVision` is never reconciled with `enabledVisionTypes`, leaving the panel painted through a lens with no tab | `web-app` |
| BUG-097 | `worker-kit/rate-limiter/backends/memory.ts:98,114` — `check()` writes back timestamps filtered by the *current* `windowMs`, defeating BUG-023's per-key cutoff (latent: no in-repo mixed-window key) | `worker-kit` |
| BUG-098 | `test-utils/cloudflare/kv.ts:155-192` — the mock `list()` never returns a cursor, which is what hides BUG-035's un-paginated `KV.list` | `test-utils` |
| BUG-099 | `test-utils/cloudflare/d1.ts:231-255` — `batch()` is non-atomic and `run()` returns a constant `meta.changes=1`, making `presets-api/handlers/votes.ts:83`'s `already_voted` branch unreachable by default | `test-utils` |
| BUG-100 | `test-utils/cloudflare/r2.ts:141-154` — `put()` stores `httpMetadata` but nothing reads it back, so `preview-image-service.ts:165` writes a cache policy no test can observe | `test-utils` |
| BUG-101 | `stoat-worker/index.ts:50-68` — no `client.on('error')`; revolt.js's emitter throws on unhandled `'error'`, crashing the process and pre-empting its own auto-reconnect | `stoat-worker` |
| BUG-102 | `stoat-worker/services/dye-resolver.ts:135` — the `getSuggestions` prefix branch is unreachable, so "Did you mean" is a char-overlap heuristic returning near-arbitrary dyes | `stoat-worker` |
| BUG-103 | `stoat-worker/commands/help.ts:9-34` — help lists 13 commands; the router has 4. `!xd random` answers `Unknown command "dye.random"` | `stoat-worker` |
| BUG-104 | `logger/adapters/console-adapter.ts:62,104` — raw `JSON.stringify`; a circular or BigInt context throws out of the log call (FINDING-026 was applied to `JsonAdapter` only) | `logger` |
| BUG-105 | `core/localization/TranslationProvider.ts:137,170,203,236,269,…` — FINDING-027's `Object.hasOwn` guard reached `getLabel` only; ten sibling getters still resolve through the prototype | `core` |

### The remainder

The rows above are the bugs whose blast radius justified naming them in the report. The balance — the rest of the MEDIUM tier, all 74 LOW defects, and the 49 *untested behaviour* findings — is itemised per unit in `evidence/review-<unit>.md`, each with an `id`, a `file:line`, the failing input, the wrong outcome, a code excerpt and a fix direction. Reviewer ids are stable (`presets-api-07`, `webapp-v4-12`, …), so the planner can schedule directly against them; qualify them by unit outside this folder.

The largest untested-behaviour clusters, which the planner should treat as one job per unit rather than 49 separate ones:

| Unit | Shape | Examples |
|---|---|---|
| `web-app` | `not.toThrow()` or `toBeDefined()` as the only assertion; assertions inside `if` bodies; mocks returning the constant under test | `webapp-modals-20…23`, `webapp-tools-a-13`, `webapp-v4-15…18`, `webapp-services-15…17` |
| `core` | `toBeDefined()` on a nullable return; a benchmark whose guard is the negation of its own assertion | `core-color-04…07`, `core-data-14…16` |
| `worker-kit` / `test-utils` | window-boundary and cleanup behaviour with no failing-capable test; integration tests that re-implement the thing under test | `pkg-worker-kit-test-utils-03,04,05,07,13,14` |
| `discord-worker` | fixtures that assert structure but not the rendered value; a test pinning a stale version literal | `discord-core-13…15`, `discord-handlers-13,14,16` |
| `presets-api` | no test makes a D1 write reject, so all three recovery paths are dead to the suite | `presets-api-09…13` |

## Catalog — refactoring

| ID | Title | Priority | Effort | Deploy unit |
|---|---|---|---|---|
| [REFACTOR-001](findings/REFACTOR-001.md) | moderation-worker keeps a full private fork of discord-worker's Discord plumbing (~24 symbols, 4 files, 1,063 changed lines) | MEDIUM | MEDIUM | `moderation-worker` → `bot-logic` |
| REFACTOR-002 | `og-worker/services/svg/*` forks the `svg` package's frame primitives; `bandInk`'s white `onDim` is 0.78 here and 0.72 in the package | MEDIUM | MEDIUM | `og-worker` |
| REFACTOR-003 | `presets-api/middleware/auth.ts:385,419,441` — four different error shapes leave one worker; the 401/403/400 guards and the 415 gate omit `success:false` and `ErrorCode` | MEDIUM | LOW | `presets-api` |
| REFACTOR-004 | `moderation-worker/utils/response.ts:262` — `rateLimitedResponse` promises 429 + `Retry-After` in its JSDoc and returns 200 with neither | MEDIUM | LOW | `moderation-worker` |
| REFACTOR-005 | `webapp/collection-manager-modal.ts:178` — native `window.confirm()` for delete instead of the project's own `showConfirm({destructive})` | MEDIUM | LOW | `web-app` |
| REFACTOR-006 | `discord-worker/services/preset-api.ts:68` — the `requestId` option has zero callers; no `X-Request-ID` reaches presets-api, image-worker or api-worker | LOW | LOW | `discord-worker` |
| REFACTOR-007 | `image-worker/index.ts:26-35` — the `maxDimension` rule and its message are duplicated instead of imported from `photon.ts` | LOW | LOW | `image-worker` |
| REFACTOR-008 | `svg/frame.ts:185` — `fitText` truncates by UTF-16 unit while its twin `preset-swatch.ts:71` slices by code point, citing BUG-060 | LOW | LOW | `svg` |
| REFACTOR-009 | `core/CharacterColorService.ts:293` — the `distinguish` scale is hardcoded `4.416729559`, a third copy of `COLOR_DISTANCE_MAX` | LOW | LOW | `core` |
| REFACTOR-010 | `webapp/config-controller.ts:376` — the migration merge is shallow, so nested `displayOptions`/`dyeFilters` never gain new keys (masked by ~30 `?? true`) | LOW | MEDIUM | `web-app` |

19 further refactors — mostly dead guards, unreachable fallbacks and stale JSDoc — are listed per unit in the reviewer returns under their reviewer ids.

## Catalog — optimization

| ID | Title | Impact | Category | Deploy unit |
|---|---|---|---|---|
| OPT-001 | `webapp/accessibility-tool.ts:1225` — `pairResults` is written and never read: ~48 dead colourblindness simulations per `updateResults()` | MEDIUM | Algorithm | `web-app` |
| OPT-002 | `discord-worker` has no automated gate on the 3,072 KiB gzip cap — only a manual `--dry-run`, while merge to main auto-deploys | MEDIUM | Bundle | `discord-worker` |
| OPT-003 | `presets-api/services/rate-limit-service.ts:175` — a full retention `DELETE` runs before every quota write, a second serialized D1 round trip on the hot path | MEDIUM | I/O | `presets-api` |
| OPT-004 | `api-worker/cache-service.ts:66` — the cache key embeds the request origin, so `data.*`, `proxy.*` and the bot's `https://internal` keep three copies of one payload | MEDIUM | Caching | `api-worker` |
| OPT-005 | `core/CharacterColorService.ts:326` — a 125-element defensive copy per colour, 192× per sheet | LOW | Memory | `core` |
| OPT-006 | `og-worker` — `getAllDyes()` copies 125 dyes inside per-offset/step/entry loops, up to 5 copies per render | LOW | Memory | `og-worker` |
| OPT-007 | `logger/core/base-logger.ts:189-267` — 15 regexes compiled per `sanitizeErrorMessage` call, i.e. per log line, all from constant literals | LOW | Algorithm | `logger` |
| OPT-008 | `webapp/v4/config-sidebar.ts:2009` — all 9 tool sections, 9 display options and 6 dye filters render always via `?hidden`; one toggle fans out to 9 `setConfig` calls | LOW | Rendering | `web-app` |
| OPT-009 | `core/RybColorMixer.ts:170-244` — `rgbToRyb` costs up to ~1,260 trilinear interpolations and is the only conversion with no LRU cache | LOW | Algorithm | `core` |
| OPT-010 | `webapp/tutorial-spotlight.ts:36-64` — `querySelectorDeep` walks the whole document per ResizeObserver frame | LOW | Algorithm | `web-app` |

4 further optimizations are listed per unit in the reviewer returns under their reviewer ids.

## Positive controls

What is already right, verified this pass, and should not be re-derived next time.

- **Every prior deep-dive regression check passed.** BUG-005 (LRU mutable returns), BUG-013 (cached rejected init promise), BUG-010/039 (consolidated itemID price fan-out), BUG-028 (SWR `max-age`), BUG-030 (filter before `limit`), BUG-046 (rate-limit slot reservation), BUG-018 (redirect allowlists), the rate-limit prefix shadowing, and the `LocalizationService` locale race are all still fixed.
- **`getDeltaE2000` matches all 34 Sharma reference pairs to 5e-5**, and the k-d tree survived 4,000 randomised brute-force trials with zero mismatches.
- **Consolidation is applied exactly where it belongs**: all price and market sites go through `getMarketItemID`, all 15 display sites use the original `itemID`, and the frozen facewear map reproduces all 11 legacy ids literally.
- **Ed25519 verification order is correct** in discord-worker — headers, timestamp freshness, body, byte cap, then verify; nothing parses a body before `isValid`.
- **image-worker's private-only invariant is defended on two axes** (wrangler config pinned by a test, plus hostname refusal), and its SSRF handling is complete: HTTPS-only exact-host allowlist, IP literals and metadata hosts blocked, one re-validated redirect hop.
- **presets-api's visibility rule is genuinely centralised** — `canSeePreset` on every id route, `toPublicPreset` as the single identity gate, owner PATCH structurally unable to re-approve, and no schema drift between `schema.sql` and migrations 0002–0013.
- **Telemetry privacy holds end to end** in both api-worker and web-app: consent-gated, no client id, no IP or user agent in datapoints, `Sec-GPC` honoured.
- **`.chara` name privacy is type-enforced** (`Omit<…,'nickname'>` plus a producer allowlist), so no bot card branch can print a player name.
- **Dependency versions are uniform** across all 17 workspaces (Hono 4.13.5, wrangler 4.127.1, workers-types 5.20260828, vitest 4.1.11), and every outbound fetch in discord-worker is bounded below the drain deadline.
- **The bot gates both of its changelog files against the real parser**, including the root file over `readFileSync` — the pattern `web-app` should copy ([[BUG-003]]).

## Rejected suspicions

Checked and dropped, so the next audit does not re-chase them.

- **oauth's JWT fork is gone.** The duplicate-symbol scan flagged `verifyJWT`/`decodeJWT`/`base64UrlEncode` in both `oauth` and `auth`, but `jwt-service.ts` now delegates to `@xivdyetools/auth` and only re-exports for compatibility. REFACTOR-001 of the 2026-07-18 audit is closed.
- **The env-validation latch has not regressed** in any of the four workers that carry `validateEnv`; none holds a "already validated" flag, and the four copies differ only in the variable lists they must differ on. Four near-identical harnesses are not worth unifying.
- **`MAX_PREVIEW_IMAGE_BYTES` agrees** across the client/server boundary (5 MB both sides, documented as a mirror).
- **The `bandInk` contrast law is mirrored correctly** between `svg` and `og-worker` — same luminance formula, same crossover; only the white `onDim` alpha differs (REFACTOR-002).
- **`compatibility_date = "2024-12-01"` on all seven workers** is stale relative to the tooling, but no worker imports a `node:` module and every runtime API in use predates it, so no failure could be demonstrated. Tracked as a recommendation, not a finding.
- **The moderator-id grammar agrees** between both bots; both now route through `bot-logic`'s `parseModeratorIds`.
- **The two RYB implementations are deliberate** (`DEPRECATIONS.md` records that unification was declined with measured deltas) — BUG-006 is a defect in one of them, not an argument to merge them.
- **`getDyeById` callers are almost all correct.** Of 20 call sites, only `discord-worker/index.ts:128` is fed preset data; the web-app callers read their own persisted itemIDs and migrate on read.

## Recommendations

1. **Fix the test fixture before the bugs it hides.** [[BUG-016]] is why four id-grammar defects shipped green. Correcting it turns several of them red on the spot, which is a better proof than this report.
2. **Add a mutation check to the "cannot fail" class.** Roughly 40 of the findings are tests that pass on broken code — `not.toThrow()` alone, `toBeDefined()` on a nullable, assertions inside `if` bodies, mocks returning the constant under assertion. The standing review question is already recorded in the project's own trap notes: "what source edit would make this fail?"
3. **Make `Map` the default for any client-controlled key lookup.** The telemetry code already does this and pins it with a test; BUG-011 is the same lookup written three other ways.
4. **Gate the discord-worker bundle in CI.** Merging to `main` deploys it, and the 3,072 KiB cap is currently checked only by hand (OPT-002).
5. **Treat cross-worker contracts as code, not convention.** BUG-010 and BUG-001 are both hand-copied client shapes that drifted from their server. A shared type or a fixture captured from the server would have caught both.
6. **Revisit `compatibility_date`** on the seven workers as deliberate maintenance, one worker at a time, rather than as a fix for anything found here.

## Remediation status

The audit itself modified no source file. Sprints 1–10 of `REMEDIATION_PLAN.md` were then executed with the user's approval on 2026-09-02.

| ID | Status | Commit |
|---|---|---|
| BUG-016 | FIXED | `a5bd0eb3` |
| BUG-012 | FIXED | `f62e1246` |
| BUG-069 | FIXED | `a5bd0eb3` |
| BUG-015, BUG-018 | FIXED | `2b0953d9` |
| BUG-007, BUG-091, BUG-092 | FIXED | `ebdcb4b1` |
| BUG-009 | FIXED | `184f1897` |
| BUG-014, BUG-084 | FIXED | `7f5c662e` |
| BUG-019, BUG-020, BUG-065 | FIXED | `61cadaae` |
| BUG-070, BUG-071, BUG-077, BUG-080 | FIXED | `8825bf55` |
| BUG-082, BUG-090 | FIXED | `8abd89d3` |
| BUG-006 | FIXED | `c1c7a173` |
| BUG-011, BUG-046, BUG-055, BUG-105 | FIXED | `ef357d26` |
| BUG-008, BUG-056, BUG-057, BUG-058, BUG-059, REFACTOR-009 | FIXED | `c83d7874` |
| BUG-054, REFACTOR-008, `pkg-svg-bot-logic-02/06/07/10` | FIXED | `ab81d435` |
| `pkg-svg-bot-logic-08/09/11` | FIXED | `3e4b360a` |
| BUG-013, BUG-031, BUG-032, BUG-033, BUG-034, BUG-035, BUG-036, BUG-037 | FIXED | `c4c4ef42` |
| BUG-026, BUG-028, BUG-029, BUG-030, BUG-039, OPT-002 | FIXED | `c981542b` |
| BUG-010, BUG-001, BUG-040, REFACTOR-004, `moderation-worker-03…10` | FIXED | `678514b3` |
| BUG-041, BUG-042, BUG-043, BUG-044, BUG-045, REFACTOR-003, `presets-api-02/07/08/15` | FIXED | `ea8dc352` |
| BUG-047, BUG-048, OPT-004, `api-worker-04/05/06/07/12/13` | FIXED | `0bc669e4` |
| BUG-049, BUG-050, BUG-051, `oauth-05/06/07/08/09/11` | FIXED | Sprint 10 |
| everything else | OPEN | — |

**Deliberately not done in Sprint 3:** OPT-005 (drop the per-colour `getAllDyes` copy) and OPT-009 (add an LRU to `rgbToRyb`). Both are LOW-impact optimizations whose fixes carry more risk than the gain: OPT-005 would change `getAllDyes`'s defensive-copy contract for every caller, and OPT-009 would put a cache in front of a conversion this same sprint rewrote. Correctness first; measure before caching.

**Deliberately not done in Sprint 7:** `moderation-worker-11` — a rejected preset's author is never told, and never told why. Closing it means a notification path (a DM through discord-worker, reusing the existing dead-letter queue), which is a feature rather than a fix. The review's alternative — reword the modal copy that "implies the reason is for them" — does not survive inspection: the placeholder reads *"Please provide a clear reason for rejecting this preset…"*, which is addressed to the moderator and promises the author nothing. Left as a product decision, recorded in the moderation-worker changelog under *Known gap*.

**Deliberately not done in Sprint 10:** `oauth-10` (`UPDATE … RETURNING *` to collapse two D1 round trips on the returning-user sign-in). A latency optimisation, and the hand-rolled D1 mock answers `.first()` from a scripted queue regardless of the statement — so a `RETURNING` clause silently consumes the response meant for the follow-up `SELECT` and the change ships with its behaviour unverifiable. Applied, observed turning an error-path test green for the wrong reason, and taken back out. `oauth-06` took the review's second option (bind explicit timestamps) for the same reason.

**Gate at the end of Sprint 10:** `pnpm turbo run build type-check lint test` — 61/61 tasks green (warnings only, all pre-existing), plus the discord-worker bundle gate at ~2,698 KiB / 87.8 % of the 3,072 KiB cap.

### Three tests that passed for the wrong reason

Worth naming together, because the same shape recurs and each was caught only by mutation-proving:

1. **BUG-049** — the error-redirect test passed against the *unfixed* code, because the test env's `FRONTEND_URL` is `localhost:5173` and so was the origin under test. Fixed by picking an allowlisted origin that is **not** `FRONTEND_URL`.
2. **BUG-030** (Sprint 6) — a test going through `getFontBuffers()` measures an *empty* coverage set, since an unmocked `.ttf` import resolves to a URL string and coerces to a zero-length buffer without throwing. Fixed by reading the real font files off disk.
3. **BUG-048** — the API-7 limiter test drove the IP-less path, which *is* the shared bucket, so the collapse it was meant to bound was invisible with one caller.

In every case the assertion was correct and the *fixture* made it unfalsifiable.

**Version bumps across Sprints 4–7:** `@xivdyetools/svg` 3.0.1 → **3.0.2**, `@xivdyetools/types` 2.0.1 → **3.0.0** (breaking: `ModerationStats` field names corrected — see its changelog), `xivdyetools-discord-worker` 5.1.1 → **5.1.2**, `xivdyetools-moderation-worker` 1.6.1 → **1.6.2**. `@xivdyetools/core` 4.0.3 and `@xivdyetools/bot-logic` 3.0.1 were already bumped in Sprint 3 and remain unpublished, so Sprint 5's further bot-logic changes ride that same 3.0.1.

### A note on reviewer line numbers

Several Sprint 4 findings cited lines ~310 past the end of a 202-line file (`packages/svg/src/gradient.ts`). **Every claim held at the real location** — the drift was in the citation, not the analysis. The plan's own standing guidance ("verify each finding's evidence against the code before fixing — findings are leads") is what caught it, and it is worth keeping in mind when working the remaining sprints: locate by *symbol*, not by line.

## Next steps

See `REMEDIATION_PLAN.md` for the sprint-sequenced execution plan.
