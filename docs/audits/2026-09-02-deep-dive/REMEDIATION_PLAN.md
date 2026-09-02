# Remediation Plan — 2026-09-02

**Sources:** `DEEP_DIVE_REPORT.md` (250 findings: 208 bug-class, 29 refactors, 14 optimizations) · **Status basis:** 250 total — 0 fixed during analysis (the audit modified no source file), 250 outstanding, 0 superseded, 0 rotation-bearing
**Ordering:** 1. one deploy unit per sprint 2. user-facing integrity before performance 3. package publish, then one sprint per consumer deploy 4. terminal work last (the moderation-worker structural refactor)

## Sprint 0 — Emergency & prerequisites

**Nothing ships out-of-band.** There is no P0: no exploitable vulnerability, no server-side data corruption, and every gate is green at `e7ac4042`. The one prerequisite is scheduling, not code — **BUG-016 must be the first commit of Sprint 1**, because the shared web-app test fixture currently makes four id-grammar defects pass. Fixing it turns them red, which is what makes the rest of that sprint verifiable rather than taken on trust.

No credential rotation is required by any finding in this catalog.

## Sprint 1 — `web-app`: the dye id grammar, and the fixture that hid it

The 5.0 rewrite made stainID canonical, but several call sites still pass or expect an item ID, and the two ranges are disjoint (1–254 vs 5729–48227) so each mismatch fails totally rather than partially. They are grouped here because one test fixture hides all of them and one Pages release fixes them together. Anchor finding: **BUG-016**.

| ID | Sev | Tested? | Item |
|---|---|---|---|
| BUG-016 | HIGH | n/a | **Do this first.** Correct `__tests__/mocks/services.ts:20-23` so `id === itemID` and `stainID` is the small number, per `types/src/dye/dye.ts:51-57`. Expect currently-green tests to fail; each failure is one of the rows below. |
| BUG-012 | HIGH | no | `v4/result-card.ts:1189` — send `dye.stainID`, not `dye.itemID`; add a round-trip test through `ShareService.resolveSharedDye`. |
| BUG-069 | MED | yes, cannot fail | `dye-grid.ts:454` — `f`/`c` shortcuts pass `dye.id` into handlers matching on `stainID`; both are dead. |
| BUG-018 | HIGH | no | `budget-tool.ts:1160,1818,1822,1827` — SEND TO hand-offs pass `dye.name` where the receiver parses a stainID; reconcile onto one grammar (harmony's unread `add=` is a third). |
| BUG-007 | HIGH | no | `extractor-tool.ts:2089,2094,2155` — display the distance with `getDistanceForMethod(..., matchingMethod)` so the number matches its label. |
| BUG-015 | HIGH | no | `share-service.ts:399-403` — normalise list params to arrays regardless of element count; a one-dye link currently parses as a number. Fix `:407` and `:417` in the same pass. |
| BUG-091 | MED | no | `extractor-tool.ts:2391` — auto-extract omits `matchingMethod`, so it always uses ΔE2000 and the sidebar re-runs K-means for the same answer. |
| BUG-092 | LOW | no | `extractor-tool.ts:2098` — the closest dye is prepended to a list that already contains it. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app...` + `pnpm --filter xivdyetools-web-app run build:check` + `run validate:i18n` → merge to `main` → `deploy-web-app.yml`.

## Sprint 2 — `web-app`: lifecycle, teardown and silent failures

The second web-app cluster: components that lose listeners, leak them, or fail without telling anyone. Separate from Sprint 1 because it touches the base component and the modal shell, which Sprint 1's files sit inside — landing them together would make a regression hard to attribute.

| ID | Sev | Tested? | Item |
|---|---|---|---|
| BUG-009 | HIGH | no | `modal-container.ts:486-498` + `base-component.ts:156` — rebind listeners for modals skipped by the incremental render, or move per-modal bindings into `bindEvents()`. |
| BUG-014 | HIGH | no | `keyboard-service.ts:228` — register the `keyboard-navigate-tool` listener the comment promises; change the test to assert navigation, not emission. Fix the Shift+T/L/S modifier gap (BUG-084) here too. |
| BUG-019 | HIGH | no | `accessibility-tool.ts:2010` — wire `updateShareButton()` to palette picks, clear, card-remove and the mobile drawer. |
| BUG-020 | HIGH | no | `v4/preset-tool.ts:492-507` — do not tombstone against a clamped page; reconcile only against a complete fetch, and set `offline` on a post-boot failure. |
| BUG-065 | MED | no | `v4-layout.ts:708-722` — add the BUG-040 supersede guard to the `catch`. |
| BUG-070, BUG-071, BUG-077, BUG-080, BUG-095 | MED | no | Teardown leaks: accessibility left panel, dye-selector children, image-zoom document listeners, camera MediaStream on route change, base-component re-render listeners. |
| BUG-067, BUG-082, BUG-090 | MED | no | Silent failures: share-validation writes state nothing renders; `getMySubmissions()` never rejects so its error path is dead; a failed changelog chunk import rejects into `void`. |
| BUG-089 | MED | no | `modal-container.ts:520` — the focus trap is a one-shot snapshot and Tab escapes after a dye-grid rebuild. |

**Ends with:** the same web-app gate as Sprint 1 → merge → `deploy-web-app.yml`.

## Sprint 3 — `@xivdyetools/core`: colour maths and lookup hardening

One publish. **BUG-006 is the anchor** — the bot's default mix mode returns the wrong hue for every green and teal dye.

| ID | Sev | Tested? | Item |
|---|---|---|---|
| BUG-006 | HIGH | no | `blending/conversions.ts:130-153` — redistribute leftover green into yellow so `rgbToRyb` inverts `rybToRgb`; delete the `'ryb'` exemption at `blending.test.ts:101` and give it the same self-blend assertion as the other five modes. |
| BUG-008 | MED | no | `PaletteService.ts:456-463` — report the distance with the metric that chose the match. |
| BUG-011 | MED | no | `types/index.ts:91` — `Map` or `Object.hasOwn` for the legacy-method lookup (core half of the class). |
| BUG-105 | LOW | no | `localization/TranslationProvider.ts` — extend FINDING-027's `Object.hasOwn` guard to the ten sibling getters. |
| BUG-056–BUG-059 | MED/LOW | no | `findClosestDyes` `count <= 0`; `isAPIAvailable()` unbounded fetch; `preloadLocales` switching the active locale; the `HarmonyGenerator` ΔE ternary collapsing `oklab` to CIE76. |
| REFACTOR-009 | LOW | n/a | `CharacterColorService.ts:293` — derive the scale from `COLOR_DISTANCE_MAX` instead of a third hardcoded copy. |
| OPT-005, OPT-009 | LOW | n/a | Drop the per-colour 125-element copy; add an LRU to `rgbToRyb`. |

**Ends with:** `pnpm turbo run build test --filter=@xivdyetools/core` → version bump per `release-mechanics.md` → merge → Actions **Publish Packages to npm** (`@xivdyetools/core`).

## Sprint 4 — `@xivdyetools/svg` publish

Small, and it must land **before** bot-logic when both change in one wave.

| ID | Sev | Item |
|---|---|---|
| BUG-054 | MED | `gradient.ts:495-511` — `fitText` the wrapped verdict; ja renders 432 px and ko 445.5 px on a 400 px card. |
| REFACTOR-008 | LOW | `frame.ts:185` — truncate by code point, matching `preset-swatch.ts:71`. |
| BUG cluster `pkg-svg-bot-logic-02,06,07,10` | LOW | Mono under-measurement, two `MeasuredRowWidths` tables overshooting the 384 px margin, an unbundled `weight: 500`, six unescaped `fill=`/`stroke=` interpolations. |

**Ends with:** `pnpm turbo run build test --filter=@xivdyetools/svg` → bump → merge → Actions publish.

## Sprint 5 — `@xivdyetools/bot-logic` publish

Depends on Sprints 3 and 4 being published first.

| ID | Sev | Item |
|---|---|---|
| BUG-055 | MED | `css-colors.ts:170` — bot-logic half of BUG-011; `/contrast dye1:constructor` currently throws instead of answering. |
| BUG cluster `pkg-svg-bot-logic-08,09,11` | LOW | Unreachable English harmony fallback; `/dye info` always reading "+1 more"; `capGradientRows` running twice per `/gradient`. |

**Ends with:** `pnpm turbo run build test --filter=@xivdyetools/bot-logic` → bump → merge → Actions publish.

## Sprint 6 — `discord-worker` deploy

Picks up Sprints 3–5. **BUG-013 is the anchor**: moderators approve presets from an embed that prints id numbers instead of dye names.

| ID | Sev | Tested? | Item |
|---|---|---|---|
| BUG-013 | HIGH | no | `index.ts:128` — resolve preset dyes by stainID; assert a rendered dye name in the webhook embed test. |
| BUG-032, BUG-033 | MED | no | Gradient step and harmony base emoji never render — same id mismatch, one line from a correct sibling in each file. |
| BUG-034, BUG-036 | MED | no | `/manual topic:🪙` and `/stats preferences` do slow work on a non-deferred path against the 3-second ack. |
| BUG-035 | MED | no | `/stats preferences` reads one `KV.list()` page as the whole namespace; the count saturates at 1000. |
| BUG-029 | MED | no | `/preferences set` does k sequential read-modify-writes on one KV key; batch them into a single write. |
| BUG-026 | MED | no | `announcements.ts:83` — check Discord's response before writing the `announced:v:` memo, or a failed post makes the release permanently unannounceable. |
| BUG-027, BUG-031 | MED | no | Surface `pricesStale`; stop `validateWorld` swallowing outages into "world not found". |
| BUG-028, BUG-039 | MED | no | Favourites autocomplete returning `[]` on a KV write failure; unchecked failure-path `sendFollowUp`. |
| BUG-030 | MED | no | `fonts.ts:51` — the subset is cut from locale data only, but user preset text is rendered into cards; include user-text coverage or fall back visibly. |
| BUG-037 | MED | no | `stats.ts:40` — read the version from `package.json`; the test currently pins the stale literal. |
| OPT-002 | MED | n/a | Add the 3,072 KiB gzip check to CI — merging to `main` deploys this worker. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-discord-worker...` (includes `font-coverage` / `font-faces`) → merge → `deploy-discord-worker.yml` (`register-commands` runs in CI).

## Sprint 7 — `moderation-worker` deploy

| ID | Sev | Tested? | Item |
|---|---|---|---|
| BUG-010 | HIGH | no | `handlers/commands/preset.ts:321` — read the four field names presets-api returns; build the test mock from the server's own shape. |
| BUG-001 | MED | no | `services/i18n.ts:95` — read `prefs:v1:` before the legacy key, matching the main bot (both workers share one KV namespace). |
| BUG-040 | MED | no | `utils/discord-api.ts:35` — add an `AbortSignal` and a `.ok` check at all five call sites. |
| REFACTOR-004 | MED | n/a | `utils/response.ts:262` — make `rateLimitedResponse` return the 429 + `Retry-After` its JSDoc promises. |
| `moderation-worker-03…11` | LOW | no | Unfrozen `freezeResult`, unclamped autocomplete names, missing reject-path log post, reason-length floor disagreement, `updated_at` omitted on ban writes, empty autocomplete query rejected, unresolved "Processing Ban…". |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker...` → merge → `deploy-moderation-worker.yml`.

## Sprint 8 — `presets-api` deploy

| ID | Sev | Item |
|---|---|---|
| BUG-041 | MED | `handlers/moderation.ts:97` — guard the moderator transition against the partial UNIQUE `dye_signature` index; today it 500s and loses the batched log row. |
| BUG-043 | MED | `services/notification-service.ts:173` — a missing binding or secret must not resolve as success; require them in `validateEnv` for production. |
| BUG-044 | MED | `middleware/rate-limit.ts:363` — service-binding traffic all keys to `unknown`, so both bots share one bucket. |
| BUG-045 | MED | `services/preview-image-service.ts:151` — add the `AbortSignal` this call alone lacks. |
| BUG-042 | MED | `handlers/presets.ts:952` — count `max(rows, events)` so the quota agrees with `GET /rate-limit` after a self-delete. |
| REFACTOR-003 | MED | `middleware/auth.ts:385,419,441` — one error shape for the whole worker. |
| `presets-api-02,07,08,15` | LOW | Mislabelled log action, dead-letter catch-all returning `[]`, `has_more` computed post-filter, hardcoded `10` beside an imported constant. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-presets-api...` → merge → `deploy-presets-api.yml`. No D1 migration is required by these findings.

## Sprint 9 — `api-worker` deploy

| ID | Sev | Item |
|---|---|---|
| BUG-046 | MED | `lib/validation.ts:318` — run the allowlist before the legacy-map branch (api-worker half of BUG-011). |
| BUG-048 | MED | `universalis/router.ts:85` — key service-binding traffic by something other than `unknown`. |
| BUG-047 | MED | `routes/dyes.ts:279` — `?sort=` present-but-empty should not 400 an optional param. |
| OPT-004 | MED | `cache-service.ts:66` — drop the origin from the cache key; three hostnames currently keep three copies. |
| `api-worker-04,05,06,07,12,13` | LOW | 3xx echoed as a bodied redirect, telemetry subtree un-rate-limited, bare `parseInt` on a dye id, a 404 docs link, two raw `console.log`s, stale rate-limit docs. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker...` → merge → `deploy-api-worker.yml`.

## Sprint 10 — `oauth` deploy

Note: a bare `wrangler deploy` **is** production for this worker, and its version must never go below 3.0.0.

| ID | Sev | Item |
|---|---|---|
| BUG-051 | MED | `handlers/xivauth.ts:285` — validate the roster is an array before assigning; today a non-array 200 turns sign-in into a 500. |
| BUG-050 | MED | `handlers/token.ts:127` — a failed revocation must not answer `200 {success:true}` with a note blaming a missing JTI. |
| BUG-049 | MED | `handlers/oauth-flow.ts:54` — bounce failures back to the originating front end, not always production. |
| `oauth-05,06,07,08,09,10,11` | LOW | Provider not re-checked on the GET callback; ISO-vs-SQLite timestamps from the INSERT path; check-then-update on the discord-id owner; env 500 before CORS; body parsed before rate limiting; `RETURNING *` to collapse two D1 hops; `iss` minted but never pinned. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-oauth-worker...` → merge → `deploy-oauth.yml`.

## Sprint 11 — `og-worker` deploy

Its bare `wrangler deploy` is the live beta, so use `deploy:production` for production.

| ID | Sev | Item |
|---|---|---|
| BUG-021 | HIGH | `og-data-generator.ts:764` — read the `?slot=&i=` grammar the SPA actually shares; every Swatch share currently unfurls as the generic card. |
| BUG-022 | MED | `services/svg/harmony.ts:39` — reconcile `IDEAL_OFFSETS` with the page's `HARMONY_OFFSETS`; the card shows dyes the page does not. |
| BUG-023, BUG-024 | MED | Rank and label with the same algorithm; add `hyab`/`oklch-weighted` to `ALGO_TAG`. |
| BUG-025 | MED | Put an app/data version in the cache key, or purge on deploy; cards are stale up to 7 days. |
| REFACTOR-002 | MED | Re-point the forked `services/svg/*` primitives at the `svg` package, starting with `bandInk`'s `onDim` alpha. |
| `og-8, og-6, og-7`, OPT-006 | LOW | Undeduped comparison ids, `og:url` dropping `lang`/`algo`/`ratio`, `.png` stripped where it is not optional, repeated `getAllDyes()` copies. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-og-worker...` → merge → `deploy-og-worker.yml` (production env).

## Sprint 12 — `image-worker` deploy

| ID | Sev | Item |
|---|---|---|
| BUG-052 | MED | `validators.ts:48` — lower the dimension cap; 4096×4096 is 64 MiB RGBA, copied again by photon, in a 128 MiB isolate. |
| BUG-053 | MED | `photon.ts:245` — guard `computeCropBox` against a zero-height band, which traps the shared WASM instance. |
| REFACTOR-007, `image-stoat-02,06,07` | LOW | Import the `maxDimension` pair instead of duplicating it; minor-axis rounding to 0; stale CLAUDE.md; unclassified empty-file error. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-image-worker...` → merge → `deploy-image-worker.yml`.

## Sprint 13 — `@xivdyetools/logger` publish

| ID | Sev | Item |
|---|---|---|
| BUG-004 | MED | `base-logger.ts:301,408` — emit a sentinel on a cycle instead of the live reference; rewrite the `not.toThrow()` test to assert the secret is absent. |
| BUG-005 | MED | `base-logger.ts:195` — use the value pattern the comment already specifies, so `Authorization: Basic …` does not survive beside a `[REDACTED]` marker. |
| BUG-104 | MED | `console-adapter.ts:62,104` — route through `safeStringify`, as `JsonAdapter` already does. |
| OPT-007 | LOW | Hoist the 15 constant regexes out of the per-log-line path. |

**Ends with:** `pnpm turbo run build test --filter=@xivdyetools/logger` → bump → merge → Actions publish.

## Sprint 14 — logger consumer redeploys

No code changes: pick up the Sprint 13 publish. One merge per unit, in whatever order suits the release calendar — `web-app` (which also needs BUG-061, wiring `browserLogger` in place of the raw console shim so redaction runs at all), then the six workers.

**Ends with:** the whole-graph gate `pnpm turbo run build type-check lint test` before each merge.

## Sprint 15 — `@xivdyetools/worker-kit` + `@xivdyetools/test-utils`

Grouped: the test-utils fixes exist to make the worker-kit and consumer fixes provable.

| ID | Sev | Item |
|---|---|---|
| BUG-097 | LOW | `backends/memory.ts:98` — filter write-back by the entry's own window, not the current request's. |
| BUG-098, BUG-099, BUG-100 | LOW | Mock fidelity: KV `list` never returns a cursor (which hides BUG-035), D1 `batch()` is non-atomic with a constant `meta.changes`, R2 `httpMetadata` is write-only. |
| `pkg-worker-kit-test-utils-01,05,06,11,15` | LOW | Headers dropped by handlers returning a raw `Response`; no tier component in the binding key; `selectTier` ignoring `windowMs`; permissive `bind()`; a dye factory contradicting the type contract. |

**Ends with:** `pnpm turbo run build test --filter=@xivdyetools/worker-kit --filter=@xivdyetools/test-utils` → bump worker-kit → merge → Actions publish (test-utils is private: merge only).

## Sprint 16 — `web-app` remainder (P2/P3)

Everything left in the largest unit: `BUG-060`, `BUG-062`, `BUG-063`, `BUG-064`, `BUG-066`, `BUG-068`, `BUG-072`–`BUG-088`, `BUG-093`, `BUG-094`, `BUG-096`, `REFACTOR-005`, `REFACTOR-010`, `OPT-001`, `OPT-008`, `OPT-010`, and the `webapp-*` LOW rows in the reviewer returns. Split into two or three merges by theme (auth/session, market/pricing, accessibility, tutorial/modals) rather than one large one.

**Ends with:** the web-app gate plus `build:check` before each merge.

## Sprint 17 — `stoat-worker` (parked)

P3 by policy — the project holds no active investment here. Do it only if the bot is revived: `BUG-101` (no `error` listener, so the process crashes and pre-empts its own reconnect), `BUG-102`, `BUG-103`, `image-stoat-12,13,14`.

**Ends with:** `pnpm turbo run build test --filter=xivdyetools-stoat-worker`.

## Sprint 18 — the untested-behaviour sweep

49 findings, and the highest-leverage work in this plan after Sprint 1. Take them **one unit at a time**, at that unit's next natural release, using the clusters in the report's *The remainder* table. The bar for each: name the source edit that would make the test fail, then make that edit and watch it go red.

Sequence: `web-app` → `core` → `discord-worker` → `presets-api` → `worker-kit`/`test-utils` → the rest.

**Ends with:** each unit's own gate; no deploy is required for test-only changes, but they ride the next release of their unit.

## Sprint 19 — terminal: retire the moderation-worker fork

| ID | Pri | Effort | Item |
|---|---|---|---|
| REFACTOR-001 | MEDIUM | MEDIUM | Move the locale layer (`LocaleCode`, `SUPPORTED_LOCALES`, `discordLocaleToLocaleCode`, `isValidLocale`, `resolveUserLocale`) into `@xivdyetools/bot-logic/i18n`, then the response builders and Discord REST helpers. Leave `preset-api.ts` forked — the two clients genuinely diverge. |

Last because it reshapes files Sprints 5–7 edit, and because doing it earlier would mean resolving BUG-001 twice. Two sprints in practice: the `bot-logic` publish, then the two worker deploys.

**Ends with:** `bot-logic` bump → Actions publish → `deploy-moderation-worker.yml` and `deploy-discord-worker.yml`.

## Superseded findings

None. No finding in this catalog is invalidated by another, and no open dead-code catalog marks any of this code for removal.

## KEEP register

None. This catalog contains no findings whose recommendation is to keep as-is.

## Standing guidance

- Verify each finding's evidence against the code before fixing — findings are leads, and eight verdicts were wrong on the facts in the 2026-09-01 audit.
- One commit per task, or per sprint when the tasks are tiny; run the gate at every sprint boundary; stage only your own paths with `git commit --only -- <paths>` (another session usually has this checkout open).
- A publishable package touched means a version decision per `release-mechanics.md`; a package fix is one publish sprint, then one sprint per consumer deploy.
- Locale text touched means re-running `scripts/subset-cjk-fonts.py` in og-worker and discord-worker and their `font-coverage.test.ts` — fonts last, always.
- Re-run the deep-dive gates after each sprint; fixes unlock findings the previous state hid, which is the whole point of Sprint 1.
- Annotate executed sprints in the heading: **✅ COMPLETED &lt;date&gt; &lt;commits&gt;** plus **Deploy needs:** — this plan doubles as the tracker.
