# Remediation Plan — 2026-09-02

**Sources:** `DEEP_DIVE_REPORT.md` (250 findings: 208 bug-class, 29 refactors, 14 optimizations) · **Status basis:** 250 total — 0 fixed during analysis (the audit modified no source file), 250 outstanding, 0 superseded, 0 rotation-bearing
**Ordering:** 1. one deploy unit per sprint 2. user-facing integrity before performance 3. package publish, then one sprint per consumer deploy 4. terminal work last (the moderation-worker structural refactor)

## Sprint 0 — Emergency & prerequisites

**Nothing ships out-of-band.** There is no P0: no exploitable vulnerability, no server-side data corruption, and every gate is green at `e7ac4042`. The one prerequisite is scheduling, not code — **BUG-016 must be the first commit of Sprint 1**, because the shared web-app test fixture currently makes four id-grammar defects pass. Fixing it turns them red, which is what makes the rest of that sprint verifiable rather than taken on trust.

No credential rotation is required by any finding in this catalog.

## Sprint 1 — `web-app`: the dye id grammar, and the fixture that hid it

**✅ COMPLETED 2026-09-02** — a5bd0eb3, f62e1246, 2b0953d9, ebdcb4b1. **Deploy needs:** one web-app Pages release (version bump + CHANGELOG + CHANGELOG-laymans).

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

**✅ COMPLETED 2026-09-02** — 184f1897, 7f5c662e, 61cadaae, 8825bf55, 8abd89d3. **Deploy needs:** ships with Sprint 1 in the same web-app release.

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

**✅ COMPLETED 2026-09-02** — c1c7a173, ef357d26, c83d7874. Also carried the api-worker and bot-logic halves of BUG-011 (scheduled in Sprints 5 and 9) because one class fix in three files is cheaper and safer than three. **Deploy needs:** publish @xivdyetools/core and @xivdyetools/bot-logic, then deploy api-worker; discord-worker picks up the RYB fix on its next deploy. OPT-005 and OPT-009 deliberately not done — see the report status table.

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

**✅ COMPLETED 2026-09-02** — `ab81d435`. All four scheduled items plus the `-02` legend half of BUG-054. Tests 271 → 304; each gate mutation-proved. Reviewer line numbers were ~310 off in `gradient.ts` (the file is 202 lines) but every claim held at the real location — verified before fixing, per the plan's own standing guidance. **Deploy needs:** publish `@xivdyetools/svg` **3.0.2** (before bot-logic); discord-worker and og-worker pick the changes up on their next deploy.

## Sprint 5 — `@xivdyetools/bot-logic` publish

Depends on Sprints 3 and 4 being published first.

| ID | Sev | Item |
|---|---|---|
| BUG-055 | MED | `css-colors.ts:170` — bot-logic half of BUG-011; `/contrast dye1:constructor` currently throws instead of answering. |
| BUG cluster `pkg-svg-bot-logic-08,09,11` | LOW | Unreachable English harmony fallback; `/dye info` always reading "+1 more"; `capGradientRows` running twice per `/gradient`. |

**Ends with:** `pnpm turbo run build test --filter=@xivdyetools/bot-logic` → bump → merge → Actions publish.

**✅ COMPLETED 2026-09-02** — `3e4b360a`. BUG-055 was already fixed in Sprint 3 (`ef357d26`), so this sprint was the three-item cluster. Tests 332 → 343. The `-09` threshold was **measured** rather than assumed: the first attempt (ΔE ≤ 5, the EXACT cut) turned the count into a different constant — zero — because the tightest fourth-nearest neighbour in the whole database is 5.41. **Deploy needs:** publish `@xivdyetools/bot-logic` **3.0.1** (after svg 3.0.2); discord-worker picks it up on its next deploy.

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

**✅ COMPLETED 2026-09-02** — `c4c4ef42` (BUG-013/031/032/033/034/035/036/037) and `c981542b` (BUG-026/028/029/030/039 + OPT-002). All 15 scheduled items. 12/12 tasks green, 1,218 tests.

Two things worth carrying forward:

- The BUG-030 fix **fails open**, and that was found by a failing test rather than designed in. An unmocked `.ttf` import resolves to a URL *string* under vitest and coerces to a zero-length buffer silently (the DEAD-005 note in `fonts.test.ts`), so the coverage set came back EMPTY and `/preset show` handed the card generator a bare em dash for the title. Blanking every card is far worse than the tofu the filter exists to prevent. Its tests read the real font files off disk for the same reason — going through `getFontBuffers()` would have passed for entirely the wrong reason.
- Moving `/manual` onto the cached Universalis wrappers (BUG-034) left `fetchWorlds`/`fetchDataCenters` as unused barrel re-exports, which the dead-code gate caught immediately. Removed from `services/budget/index.ts`; they remain module-private inside `universalis-client.ts`.

**Deploy needs:** merge → `deploy-discord-worker.yml`. No `register-commands` change. Version 5.1.2 with a `CHANGELOG-laymans.md` entry (eight of these are user-visible).

## Sprint 7 — `moderation-worker` deploy

| ID | Sev | Tested? | Item |
|---|---|---|---|
| BUG-010 | HIGH | no | `handlers/commands/preset.ts:321` — read the four field names presets-api returns; build the test mock from the server's own shape. |
| BUG-001 | MED | no | `services/i18n.ts:95` — read `prefs:v1:` before the legacy key, matching the main bot (both workers share one KV namespace). |
| BUG-040 | MED | no | `utils/discord-api.ts:35` — add an `AbortSignal` and a `.ok` check at all five call sites. |
| REFACTOR-004 | MED | n/a | `utils/response.ts:262` — make `rateLimitedResponse` return the 429 + `Retry-After` its JSDoc promises. |
| `moderation-worker-03…11` | LOW | no | Unfrozen `freezeResult`, unclamped autocomplete names, missing reject-path log post, reason-length floor disagreement, `updated_at` omitted on ban writes, empty autocomplete query rejected, unresolved "Processing Ban…". |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-moderation-worker...` → merge → `deploy-moderation-worker.yml`.

**✅ COMPLETED 2026-09-02** — `678514b3`. BUG-010, BUG-001, BUG-040, REFACTOR-004 and `moderation-worker-03`…`-10`. 11/11 tasks green, 628 → 645 tests.

- **`moderation-worker-11` deliberately NOT done.** The finding is that a rejected author is never told and never told why; closing it means a notification path (a DM through discord-worker, reusing the dead-letter queue), which is a feature rather than a fix. The review's alternative — reword the modal copy that "implies the reason is for them" — does not apply on inspection: the placeholder reads "Please provide a clear reason for rejecting this preset…", which is addressed to the moderator and promises the author nothing. Left as a product decision, recorded in the moderation-worker changelog under *Known gap*.
- **BUG-010 needed a `@xivdyetools/types` change**, and the type was not merely unused — it was *wrong*, describing a shape nothing produces and making the client's mistake look correct. Corrected, which is a **major** bump (2.0.1 → 3.0.0) by the letter of semver even though no consumer can have relied on the old names working. Nothing in the deploy depends on it: the app bundles `workspace:*` at build time.
- The fix that prevents recurrence is `tests/moderation-stats-contract.test.ts`, which reads presets-api's own SQL and asserts its aliases are the keys the type declares. Renaming the fields alone would have left the same hole open for the next field: the unit test's mock was built from the names the *handler* expected, so mock and client agreed with each other and both disagreed with the server.

**Deploy needs:** merge → `deploy-moderation-worker.yml`. Version 1.6.2. Publishing `@xivdyetools/types` 3.0.0 is optional for this deploy but wanted for the npm consumers.

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

**✅ COMPLETED 2026-09-02** — `ea8dc352`. All ten items. 8/8 tasks green, 749 → 757 tests. No migration needed, as predicted: `moderation_log.action` is a bare `TEXT` column, so `requeue` only needed the comment in `schema.sql` that documents the vocabulary.

- BUG-041 needed a lookup that did not exist. The recovery could only *name* the colliding preset when the request carried a dye list, which a status change never does — and the same gap made a text-only resubmission answer a bare 409 about a field the author never touched. `findDuplicateBySignature` reads it off the stored row instead.
- **Deploy needs a secret check first.** BUG-043 makes production refuse to start without `INTERNAL_WEBHOOK_SECRET`, `DISCORD_WORKER`, `IMAGE_WORKER` and `THUMBNAILS`. That is the point — without them the moderation fan-out failed silently — but confirm they are set before merging.
- REFACTOR-003 changes the 401/403/400 envelope worker-wide. The `auth-v2` test named "unchanged envelope" was pinning that the *v1 removal* did not change the 401, not that the envelope is immutable; renamed so it no longer claims something false.

**Deploy needs:** merge → `deploy-presets-api.yml`. Version 2.3.0 (minor: client-visible envelope and bucket changes).

## Sprint 9 — `api-worker` deploy

| ID | Sev | Item |
|---|---|---|
| BUG-046 | MED | `lib/validation.ts:318` — run the allowlist before the legacy-map branch (api-worker half of BUG-011). |
| BUG-048 | MED | `universalis/router.ts:85` — key service-binding traffic by something other than `unknown`. |
| BUG-047 | MED | `routes/dyes.ts:279` — `?sort=` present-but-empty should not 400 an optional param. |
| OPT-004 | MED | `cache-service.ts:66` — drop the origin from the cache key; three hostnames currently keep three copies. |
| `api-worker-04,05,06,07,12,13` | LOW | 3xx echoed as a bodied redirect, telemetry subtree un-rate-limited, bare `parseInt` on a dye id, a 404 docs link, two raw `console.log`s, stale rate-limit docs. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker...` → merge → `deploy-api-worker.yml`.

**✅ COMPLETED 2026-09-02** — `0bc669e4`. Nine items; BUG-046 was already fixed in Sprint 3 (`ef357d26`). 9/9 tasks green, 377 → 385 tests.

- The BUG-048 fix required changing the existing API-7 test to send a `CF-Connecting-IP`. Without one it drives the *service-binding* path, which now has its own budget — and that is precisely why the collapse was invisible: `app.request` sends no IP, so the whole suite was the shared bucket, and with one caller sharing looks like working.
- **My first api-worker-06 regex was too tight.** The review suggested `[1-9]\d{0,6}`; at 7 digits it turned `/v1/dyes/999999999` from a useful 404 into a "malformed" 400, which `app-hardening.test.ts` caught. The regex checks the SPELLING; `resolveIdType` owns the range. Widened to 10 digits — the leading `[1-9]` is the part that matters, since it also rejects the leading zeros that cached one dye under several keys.
- OPT-004 made `CacheService`'s `baseUrl` parameter dead, so it is gone along with the plumbing that fed it (cached-fetch options, the chara cache, three router call sites). The dead-code gate would have required that anyway.

**Deploy needs:** merge → `deploy-api-worker.yml`. Version 0.11.0 (minor: `/v1/dyes/1e3` now 400s where it used to answer). One cold Universalis cache on deploy, from the key-namespace change.

## Sprint 10 — `oauth` deploy

Note: a bare `wrangler deploy` **is** production for this worker, and its version must never go below 3.0.0.

| ID | Sev | Item |
|---|---|---|
| BUG-051 | MED | `handlers/xivauth.ts:285` — validate the roster is an array before assigning; today a non-array 200 turns sign-in into a 500. |
| BUG-050 | MED | `handlers/token.ts:127` — a failed revocation must not answer `200 {success:true}` with a note blaming a missing JTI. |
| BUG-049 | MED | `handlers/oauth-flow.ts:54` — bounce failures back to the originating front end, not always production. |
| `oauth-05,06,07,08,09,10,11` | LOW | Provider not re-checked on the GET callback; ISO-vs-SQLite timestamps from the INSERT path; check-then-update on the discord-id owner; env 500 before CORS; body parsed before rate limiting; `RETURNING *` to collapse two D1 hops; `iss` minted but never pinned. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-oauth-worker...` → merge → `deploy-oauth.yml`.

**✅ COMPLETED 2026-09-02** — nine of ten items. 8/8 tasks green, 340 → 341 tests. Version 3.1.0, which honours the never-below-3.0.0 rule.

- **oauth-10 deliberately NOT done**, and recorded in the changelog under *Not done*. It is a latency optimisation (`UPDATE … RETURNING *` to collapse two D1 hops), and the hand-rolled D1 mock answers `.first()` from a scripted queue without regard to the statement — so a `RETURNING` clause silently consumes the response meant for the follow-up `SELECT`. I applied it, watched it turn "should throw error if user not found after update" green for the wrong reason, and took it back out. Worth doing alongside a statement-aware mock, not before one.
- oauth-06 took the review's *second* option (bind explicit timestamps) rather than `RETURNING *`, for the same reason.
- **The BUG-049 test needed a discriminating origin.** My first version used `localhost:5173` and passed against the *unfixed* code, because the test env's `FRONTEND_URL` is `localhost:5173` — exactly the coincidence the review named. Re-pointed at `localhost:3000`, which is allowlisted and is not `FRONTEND_URL`; it then failed against the mutation as it should.
- BUG-050 changes `POST /auth/revoke` from `200 {success: true}` to `503` when the blacklist write fails. The old behaviour was pinned by a test called "should handle KV errors gracefully" — graceful was right about the handler not throwing and wrong about the client being told it succeeded.

**Deploy needs:** merge → `deploy-oauth.yml`. Remember a bare `wrangler deploy` **is** production for this worker.

## Sprint 11 — `og-worker` deploy — ✅ COMPLETED 2026-09-02 (`35914823`)

**Deploy needs:** merge → `deploy-og-worker.yml` (production env). og-worker 2.4.0 → 2.5.0; `@xivdyetools/core` 4.0.3 → **4.1.0** and `@xivdyetools/svg` 3.0.2 → **3.1.0** (each gains a public export — `HARMONY_OFFSETS` and `bandInk` — so MINOR, not the PATCH they were sitting at). web-app keeps 5.0.2: `HARMONY_OFFSETS` moved to core and is re-exported byte-identically.

og-12 was not scheduled by this plan (a LOW og-worker refactor that fell between the rows); it is done here, since it is the same algorithm-consistency theme as BUG-023/024.

**Filed, not fixed here — ✅ RESOLVED 2026-09-03 in PR #159.** `@xivdyetools/bot-logic`'s own `IDEAL_OFFSETS` carried the same divergent `analogous: [30, -30, 180]` and knew neither `compound` nor `shades`. The bot's embed and its card agreed with *each other*, so this was a divergence rather than BUG-022 — and reconciling it changes what `/harmony` returns for every user, which made it a product decision like `moderation-worker-11`. Documented on the new core constant.

The decision came back "the bot should match the web app, from core", and measurement showed the problem was larger than the offsets table: the divergence was the **algorithm**, not the labels. The page rotated hue in HSV *preserving the base's saturation and value*, the bot called per-type `find*Dyes()` that did not (and `findComplementaryPair` took an RGB `invert()` rather than rotating at all), and og-worker rotated in **LCh** — three implementations, disagreeing on the returned dyes for **89–100 % of bases on every harmony type**. All three now call core's `generateHarmonySlots`, which is the page's algorithm lifted under a parity test. `IDEAL_OFFSETS` and `getHarmonyDyes` are deleted. See PR #159 (stacked on this plan's PR #158).

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

## Sprint 12 — `image-worker` deploy — ✅ COMPLETED 2026-09-02 (`1af1cac0`)

**Deploy needs:** merge → `deploy-image-worker.yml` **and** `deploy-discord-worker.yml` (image-stoat-07's marker lives in discord-worker). image-worker 1.2.1 → **1.3.0** (minor: the accepted pixel range shrank, so some inputs that used to reach photon are now rejected at the gate); discord-worker 5.1.2 → 5.1.3.

**Deviation from the plan row:** REFACTOR-007 says to import the `maxDimension` pair *from `photon.js`*. That fails — every route test mocks `./photon.js` wholesale, so a rule the route reaches through it is `undefined` under test (five `index-limits` cases went red). The shared rule lives in `validators.ts`, which nothing mocks. image-stoat-04 (a Sprint 18 row) was also done here, because it is the test that proves BUG-053.

| ID | Sev | Item |
|---|---|---|
| BUG-052 | MED | `validators.ts:48` — lower the dimension cap; 4096×4096 is 64 MiB RGBA, copied again by photon, in a 128 MiB isolate. |
| BUG-053 | MED | `photon.ts:245` — guard `computeCropBox` against a zero-height band, which traps the shared WASM instance. |
| REFACTOR-007, `image-stoat-02,06,07` | LOW | Import the `maxDimension` pair instead of duplicating it; minor-axis rounding to 0; stale CLAUDE.md; unclassified empty-file error. |

**Ends with:** `pnpm turbo run build type-check lint test --filter=xivdyetools-image-worker...` → merge → `deploy-image-worker.yml`.

## Sprint 13 — `@xivdyetools/logger` publish — ✅ COMPLETED 2026-09-02 (`e1ca03a1`)

**Deploy needs:** bump → merge → Actions publish. logger 2.1.2 → **2.2.0** (minor: `sanitizeErrorMessage`'s output changes shape for non-`Bearer` schemes, and a cyclic back-edge is now a string where it used to be an object — either could surprise a consumer asserting on log output).

BUG-004 closes the residual 2.1.2 listed under *Still not covered*. That follow-up was weighing two re-orderings of the guard; the fix is a third option neither considered — **both guards return the `'[Circular]'` sentinel**, with the check ordering untouched, so every property S10-R16 pins still holds and its two tests still discriminate the same mutation.

**Worth reading before touching `sanitizeErrorMessage` again:** the first cut of BUG-005 extended the free-text scheme pass to `Bearer|Basic|Bot|Digest|Token`. Four of those five are ordinary English — it turned oauth's `'XIVAuth token exchange failed'` into `'XIVAuth token [REDACTED] failed'`, and a real oauth test caught it. The scheme handling belongs in the `authorization=` rule, where the key name supplies the context.

| ID | Sev | Item |
|---|---|---|
| BUG-004 | MED | `base-logger.ts:301,408` — emit a sentinel on a cycle instead of the live reference; rewrite the `not.toThrow()` test to assert the secret is absent. |
| BUG-005 | MED | `base-logger.ts:195` — use the value pattern the comment already specifies, so `Authorization: Basic …` does not survive beside a `[REDACTED]` marker. |
| BUG-104 | MED | `console-adapter.ts:62,104` — route through `safeStringify`, as `JsonAdapter` already does. |
| OPT-007 | LOW | Hoist the 15 constant regexes out of the per-log-line path. |

**Ends with:** `pnpm turbo run build test --filter=@xivdyetools/logger` → bump → merge → Actions publish.

## Sprint 14 — logger consumer redeploys — ✅ COMPLETED 2026-09-02 (`e1ca03a1`, with Sprint 13)

**Deploy needs:** none beyond what this PR already fires — every consumer bundles `workspace:*` at build time, so merging redeploys them all against the new logger regardless of the npm publish.

BUG-061 was the sprint's one code change and is done. The shim's ~560 call sites are variadic and console-shaped, so the façade stays and routes through the package: the first argument becomes the message and **every remaining argument becomes context**, which is the load-bearing half — an argument that does not reach the context object is one redaction never sees. Two deliberate non-changes: the dev gates stay web-app's own (the package's production level is `warn`, so delegating would start emitting warnings in production), and `group`/`groupEnd`/`table` stay on `console` (presentation, not log records; no production call site uses them).

No code changes: pick up the Sprint 13 publish. One merge per unit, in whatever order suits the release calendar — `web-app` (which also needs BUG-061, wiring `browserLogger` in place of the raw console shim so redaction runs at all), then the six workers.

**Ends with:** the whole-graph gate `pnpm turbo run build type-check lint test` before each merge.

## Sprint 15 — `@xivdyetools/worker-kit` + `@xivdyetools/test-utils` — ✅ COMPLETED 2026-09-02 (`ac4087b3`)

**Deploy needs:** bump → merge → Actions publish. worker-kit 1.2.1 → **1.3.0**; test-utils 1.3.1 → **2.0.0** (private, so the major is bookkeeping — but `bind()` returning a new statement and the stricter KV TTL genuinely break consumer suites, as three of them showed).

**The binding key format changed, so every native rate-limit counter resets once on deploy.** One-off, per-minute buckets. Six consumer test files assert the key and were updated.

The unit's Sprint 18 rows (`-03/-04/-05/-07/-13/-14`) were done here too — same unit, same release. `-09` (KV put/get fidelity) was not scheduled by the plan and is done as well, being the same file as BUG-098.

**One of my own fixes was reverted after the full-graph gate caught it:** reading a bare `null` from a `_setupMock` as "affected zero rows" reinterpreted three unrelated presets-api behaviours as failures. The explicit `{ meta }` hatch is documented instead.

Grouped: the test-utils fixes exist to make the worker-kit and consumer fixes provable.

| ID | Sev | Item |
|---|---|---|
| BUG-097 | LOW | `backends/memory.ts:98` — filter write-back by the entry's own window, not the current request's. |
| BUG-098, BUG-099, BUG-100 | LOW | Mock fidelity: KV `list` never returns a cursor (which hides BUG-035), D1 `batch()` is non-atomic with a constant `meta.changes`, R2 `httpMetadata` is write-only. |
| `pkg-worker-kit-test-utils-01,05,06,11,15` | LOW | Headers dropped by handlers returning a raw `Response`; no tier component in the binding key; `selectTier` ignoring `windowMs`; permissive `bind()`; a dye factory contradicting the type contract. |

**Ends with:** `pnpm turbo run build test --filter=@xivdyetools/worker-kit --filter=@xivdyetools/test-utils` → bump worker-kit → merge → Actions publish (test-utils is private: merge only).

## Sprint 16 — `web-app` remainder (P2/P3) — ✅ COMPLETED 2026-09-02 (`6bf21bdd`, `d5f2c9e3`, `369f4965`, `6b9e165a`)

**Deploy needs:** merge → `deploy-web-app.yml`. web-app stays 5.0.2 (no public API).

**The row list here was stale.** BUG-077, BUG-080, BUG-082 and BUG-084 were already fixed in Sprints 1–2 — this plan was written before those ran. Each was verified against the source rather than re-fixed.

**Found in flight, not in the catalog:** `--theme-text-secondary` (19 call sites) and `--theme-input-background` (17) are referenced across `src/components` with no fallback and declared NOWHERE — not in `themes.css`, not by `ThemeService.applyPalette()`. Both were invalid at computed-value time. Defined as aliases of variables ThemeService does set.

Everything left in the largest unit: `BUG-060`, `BUG-062`, `BUG-063`, `BUG-064`, `BUG-066`, `BUG-068`, `BUG-072`–`BUG-088`, `BUG-093`, `BUG-094`, `BUG-096`, `REFACTOR-005`, `REFACTOR-010`, `OPT-001`, `OPT-008`, `OPT-010`, and the `webapp-*` LOW rows in the reviewer returns. Split into two or three merges by theme (auth/session, market/pricing, accessibility, tutorial/modals) rather than one large one.

**Ends with:** the web-app gate plus `build:check` before each merge.

## Sprint 17 — `stoat-worker` (parked) — ✅ COMPLETED 2026-09-02 (`5ac57593`)

**Deploy needs:** none — this unit has no deploy workflow. stoat-worker 0.2.3 → **0.3.0**. The bot stays parked; this was executed to finish the audit, not as a signal it is being revived.

`image-stoat-14` (dead symbols) was verified symbol by symbol but NOT actioned: two of the six are scaffolding for the reaction feature `commands/info.ts:108` documents as planned, and the choice between deleting the rest and putting this workspace on `lint:dead` is a product call about whether the bot is being revived. Recorded in the changelog.

P3 by policy — the project holds no active investment here. Do it only if the bot is revived: `BUG-101` (no `error` listener, so the process crashes and pre-empts its own reconnect), `BUG-102`, `BUG-103`, `image-stoat-12,13,14`.

**Ends with:** `pnpm turbo run build test --filter=xivdyetools-stoat-worker`.

## Sprint 18 — the untested-behaviour sweep — ◐ MOSTLY COMPLETED 2026-09-02

**Commits:** worker-kit/test-utils in `ac4087b3` (Sprint 15); core `b2df6802`; presets-api `94681d5c`; discord-worker `460365a8`; web-app `7971c9a2` and `c13ce36f`. Test-only apart from two source changes noted below.

**Three rows remain, all of the "write a suite that does not exist" kind:** `webapp-v4-16` (result-card's context menu, ΔE re-derivation, tier bands and the four external links), `webapp-v4-17` (no `preset-tool` or `preset-detail` suite exists at all — 67 KB of the unit's most stateful code), and `webapp-v4-18` (overlapping `loadToolContent` calls against a deferred import). They are additions rather than repairs, and each is a session's work on its own.

**A live bug fell out of webapp-modals-22.** The finding was only that the overflow test could not tell "restores the prior value" from "blanks it". Starting from a page that already had `overflow: scroll` made the new test FAIL: `onUpdate()` guarded on `modals.length === 0` alone, so it ran on the container's first update too — mounted, no modals, nothing saved — and `?? ''` blanked whatever the page had set before any modal existed. Fixed in `7971c9a2`.

**Four rows were STALE and are recorded as non-findings, each verified rather than re-fixed:**
- `discord-core-15` — its own stated mutation proof ("changing `neon_green.targetDyeId` from 99 to 98 keeps the file green") is false; a resolution test added 2026-08-29 catches exactly that.
- `discord-handlers-14` — `stats.test.ts` already asserts against `packageJson.version`.
- `webapp-services-16` — the keyboard tests already assert `RouterService.navigateTo` (BUG-014).
- `core-data-15`'s dead branch was real and is removed, along with the test that reached it only by mocking the thing that cannot throw.

49 findings, and the highest-leverage work in this plan after Sprint 1. Take them **one unit at a time**, at that unit's next natural release, using the clusters in the report's *The remainder* table. The bar for each: name the source edit that would make the test fail, then make that edit and watch it go red.

Sequence: `web-app` → `core` → `discord-worker` → `presets-api` → `worker-kit`/`test-utils` → the rest.

**Ends with:** each unit's own gate; no deploy is required for test-only changes, but they ride the next release of their unit.

## Sprint 19 — terminal: retire the moderation-worker fork — ◐ FIRST HALF COMPLETED 2026-09-02 (`1b67aadd`)

**Deploy needs:** bump → merge → Actions publish `@xivdyetools/bot-logic` **3.1.0**, then `deploy-moderation-worker.yml` and `deploy-discord-worker.yml`. moderation-worker 1.6.2 → 1.6.3, discord-worker 5.1.3 → 5.1.4.

**The locale layer is done** — the half this finding sequences first and the half that fixes BUG-001 at the class rather than the instance. `LocaleCode` is now derived from an exported `LOCALE_CODES` list that `isValidLocale` also checks, closing the union-vs-array trap the finding named. A latent bug came out with it: both forks resolved the Discord-locale map with `mapping[locale] ?? null`, so an inherited key returned a FUNCTION from a call typed `LocaleCode | null`.

**The response builders and REST helpers were NOT moved, and the reason is the destination's own contract.** `packages/bot-logic/CLAUDE.md`: "Never put Discord-specific types like `APIEmbed`, `Snowflake`, or interaction objects in this package" — it is the platform-agnostic layer `stoat-worker` shares. The locale layer fits; `DiscordEmbed`, `MessageFlags` and interaction response builders are exactly what that rule excludes. They need a new shared package, whose FIRST publish cannot go through OIDC and needs the break-glass manual path plus trusted-publisher configuration — a maintainer decision.

The evidence also says convergence there would change behaviour rather than move it: moderation's `messageResponse` routes through `withAllowedMentions` (FINDING-019) and discord-worker's does not; both `discord-api.ts` files now carry `allowed_mentions` in DIFFERENT shapes, and discord-worker's additionally owns the follow-up helpers and retry handling. `preset-api.ts` the finding already excludes.

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
