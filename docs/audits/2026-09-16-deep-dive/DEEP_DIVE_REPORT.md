# Deep-dive analysis — whole monorepo (2026-09-16)

- **Branch/commit:** `main` @ `79a69d1f` (audit branch `worktree-deep-dive-2026-09-16`) · **Scope:** all 8 packages and 9 apps · **Method:** uncached gates + coverage (all green but one flake), lead-pattern grep over 500 non-test source files, 18 read-only Sonnet reviewers (one per deploy unit; five slices for web-app, two each for discord-worker and core) briefed to read the 240 files changed since the 2026-09-02 deep-dive first, coordinator verification of every candidate at `file:line`, then an Opus pass over every row graded MEDIUM or above (`evidence/verifier-pass.md`).
- **Totals:** 53 findings from 62 reviewer candidates — 43 bug-class (**0 CRITICAL, 0 HIGH, 8 MEDIUM, 23 LOW, 12 untested-behaviour**), 9 refactors, 1 optimization. Both HIGH candidates were downgraded on the facts: one is unreachable dead code (now REFACTOR-001), the other renders a correct static price while an opt-in fetch goes unread (BUG-004). · **Sprint 0 (act now):** BUG-007 (the flaky shared fixture — it will redden an unrelated PR), BUG-003 (one-line `.catch`), BUG-001 (a moderation capability that silently does not exist for one login provider — needs a product decision on the identity key).

The unit reviews found the codebase markedly harder to fault than two weeks ago: eleven of the eighteen slices returned no MEDIUM at all, and every previously fixed pattern the brief listed for regression (env-latch, locale race, cached rejected init, KV read-modify-write, consolidated price lookups, limiter cleanup, redaction case, `Vary: Origin`, within-distance ordering, the `id === stainID` mock, modal listener stack, prototype-key lookups, RYB green, moderation dye names) was checked and holds.

## Catalog

## BUG catalog
| ID | Title | Sev | Type | Deploy unit | Tested? |
|---|---|---|---|---|---|
| BUG-001 | XIVAuth-only preset authors cannot be banned: both ban entry points require a Discord snowflake and `banned_users.xivauth_id` is never written | MEDIUM | Logic | presets-api (+ moderation-worker) | no |
| BUG-002 | Extractor share links were dropped by the 4A rebuild while `ShareService.ExtractorShareParams` and og-worker's `/og/extractor/:colors.png` card remain with no producer | MEDIUM | State | web-app | no |
| BUG-003 | Swatch 'Submit to Community' dynamic import has no `.catch()`: a stale-deploy chunk 404 is a silent dead click | MEDIUM | Error handling | web-app | no |
| BUG-004 | Preset detail view fetches Universalis prices into `priceData` on every preset and never reads it — 'Show prices' is a silent no-op there | MEDIUM | Logic | web-app | no |
| BUG-005 | Browser Back from a preset detail remounts `<v4-preset-tool>` and loses tab, search and scroll because `pushState` omits `toolId` | MEDIUM | State | web-app | no |
| BUG-006 | Bot `/swatch` card drops the L/R eye marker on off-grid rows, so off-grid heterochromia renders two identical 'EYES · OFF GRID' rows | MEDIUM | Edge case | bot-logic (publish) → discord-worker (deploy) | no |
| BUG-007 | `createMockDye()` draws stainIDs from `Math.random()` over 254 values with no uniqueness, so every workspace test run has a ~0.4 % chance of a red that is nobody's fault | MEDIUM | Race | test-utils | the existing test is the flake |
| BUG-008 | `/manual topic:🪙` still answers non-deferred and, on a cold isolate, awaits two 10 s service-binding calls inside Discord's 3 s ack | MEDIUM | Resource | discord-worker | no |
| BUG-009 | `ColorConverter.hexToHsv` consults the LRU before validating, so a bare `'FF0000'` throws cold and succeeds warm | LOW | Logic | core | no |
| BUG-010 | `DyeDatabase.getAllDyes` is documented as a defensive copy but is shallow, and `LocaleLoader`/`LocaleRegistry` hand out the static locale module objects — a caller mutation would corrupt shared indices | LOW | State | core | no — the 'defensive copy' test checks array identity only |
| BUG-011 | `CharacterMatchOptions.matchingMethod` documents default `'oklab'` while the code defaults to `'ciede2000'` | LOW | Logic | core | n/a |
| BUG-012 | `/stats health` hard-codes `workerEnv = 'production'`, so the beta bot reports itself as production — and the test pins the literal | LOW | Logic | discord-worker | yes, but the assertion enshrines the bug |
| BUG-013 | `/webhooks/preset-submission` trusts `Content-Length` then buffers `c.req.json()` with no streaming cap | LOW | Resource | discord-worker | no |
| BUG-014 | `PATCH /presets/refresh-author` binds `auth.userName` with no fallback; an undefined bind makes D1 throw a 500 | LOW | Edge case | presets-api | no |
| BUG-015 | `text_edit` / `flagged_edit` / `preview_upload` daily caps are check-then-insert; concurrent requests can overshoot the cap | LOW | Race | presets-api | no |
| BUG-016 | moderation-worker's presets-api client fetches carry no `AbortSignal`, unlike every Discord-facing call | LOW | Resource | moderation-worker | no |
| BUG-017 | oauth's env-validation 500 is returned before the security-headers middleware runs, so it carries no nosniff / no-store / HSTS | LOW | Logic | oauth | no |
| BUG-018 | og-worker keys `wheel` into the cache for `/og/harmony/default.png`, a route that never reads it | LOW | Edge case | og-worker | no |
| BUG-019 | api-worker's SWR expiry `waitUntil(cache.delete())` has no `.catch()`, unlike its `storeAsync` sibling | LOW | Error handling | api-worker | no |
| BUG-020 | logger's browser error-tracker wrapper uses raw `JSON.stringify(error)`, so a circular or BigInt-bearing non-Error value throws inside `logger.error()` | LOW | Error handling | logger | no |
| BUG-021 | `createMockDye({ stainID: null })` swaps null for a random decoy, so the documented legacy 'null arm' fixture cannot be built | LOW | Edge case | test-utils | no |
| BUG-022 | Extractor zoom canvas never checks `MouseEvent.button`, so a right-button drag commits a pixel sample alongside the context menu | LOW | Edge case | web-app | no |
| BUG-023 | `market-board.ts` refresh status uses a raw `setTimeout` that `destroy()` cannot cancel | LOW | Resource | web-app | no |
| BUG-024 | `CollectionService.importData` lets a truthy non-string `name` past its guard, then `name.trim()` throws and aborts the loop after earlier collections were persisted | LOW | Error handling | web-app | no |
| BUG-025 | `AuthService.isAuthenticated()` fire-and-forgets `logout()` with no re-entrancy guard, so N synchronous callers on an expired token trigger N revoke requests and notify storms | LOW | Race | web-app | no |
| BUG-026 | An in-flight `checkVoteStatus()` started by `updated()` can clobber an optimistic `handleVote` result on the preset detail view | LOW | Race | web-app | no |
| BUG-027 | `v4-preset-tool` never clears its search debounce in `disconnectedCallback`, so one `loadPresets()` fetch fires into a detached element | LOW | Resource | web-app | no |
| BUG-028 | `BaseComponent.handleRetry()` / `renderError()` never `unbindAllEvents()`, so a `safeAsync` fail→retry cycle leaks listener-map entries | LOW | Resource | web-app | no |
| BUG-029 | `add-to-collection-menu` off-screen check assumes a 200 px menu while its CSS allows up to 256 px | LOW | Edge case | web-app | no |
| BUG-030 | Preset edit form drops unresolvable stored dye ids at load and would then send a shortened `dyes` patch on a Save with no edits | LOW | Edge case | web-app | no |
| BUG-031 | stoat-worker `/ping` builds its latency string before `sendMessage` resolves, so it always reports ~0 ms | LOW | Logic | stoat-worker (parked — P3) | no |
| BUG-032 | `ColorAccessibility.test.ts` guards its only assertion behind a branch that never runs for its fixed fixture | LOW | Untested behaviour | core | the test cannot fail |
| BUG-033 | `/gradient`'s adapter (`commands/gradient.ts`) has no test file | LOW | Untested behaviour | discord-worker | no |
| BUG-034 | `/mixer`'s adapter (`commands/mixer-v4.ts`) has no test file | LOW | Untested behaviour | discord-worker | no |
| BUG-035 | moderation-worker rate-limit KV-error test asserts only `resolves.not.toThrow()` | LOW | Untested behaviour | moderation-worker | the test cannot fail |
| BUG-036 | api-worker `serializeDye` test asserts its boolean/enum fields via `.toBeDefined()` only | LOW | Untested behaviour | api-worker | weakly |
| BUG-037 | api-worker's negative-id legacy-facewear 404 (message + `details.facewearId/hex`) has no HTTP-level test | LOW | Untested behaviour | api-worker | no |
| BUG-038 | Swatch `selectDye` entry test asserts `not.toThrow()` only | LOW | Untested behaviour | web-app | the test cannot fail |
| BUG-039 | 'merges displayOptions rather than replacing them' asserts `not.toThrow()` only, in two tool suites | LOW | Untested behaviour | web-app | the tests cannot fail |
| BUG-040 | Three components value-import `RouterService` past the `@services/index` barrel their tests mock, so the mock is inert (the PR #161 trap, three survivors) | LOW | Untested behaviour | web-app | no |
| BUG-041 | `collection-manager-modal.ts` (640 lines of CRUD / import-export) and `add-to-collection-menu.ts` carry `/* istanbul ignore file */` and have no tests | LOW | Untested behaviour | web-app | no |
| BUG-042 | stoat-worker dye-info tests assert presence of an embed only, never its content | LOW | Untested behaviour | stoat-worker (parked — P3) | presence only |
| BUG-043 | presets-api ban-check tests pass through a D1 mock that special-cases the query and ignores which id and column were bound | LOW | Untested behaviour | presets-api | the tests cannot see BUG-001 |

## REFACTOR catalog
| ID | Title | Pri | Effort | Deploy unit |
|---|---|---|---|---|
| REFACTOR-001 | Delete the unreachable legacy `navigate-to-tool` context-action branches in Swatch and Mixer (and their success toasts) | P2 | LOW | web-app |
| REFACTOR-002 | `/preset` notification helpers never receive the request logger, so their failures log nowhere | P3 | LOW | discord-worker |
| REFACTOR-003 | `/preset submit\|edit` schemas document name/description length bounds but set no `min_length`/`max_length`, and autocomplete choice names are never truncated to Discord's 100-char cap | P3 | LOW | discord-worker |
| REFACTOR-004 | api-worker builds its error envelope two ways and error `meta` never carries `locale` | P3 | LOW | api-worker |
| REFACTOR-005 | bot-logic `dye-info.marketValue()` re-implements core's consolidation gate | P3 | LOW | bot-logic |
| REFACTOR-006 | `gradient-tool.ts` still logs under the `[MixerTool]` tag from before the v4 rename | P3 | LOW | web-app |
| REFACTOR-007 | `config-sidebar` carries a dead field-initializer default (`tetradic`/false) that disagrees with the real default (`complementary`/true) | P3 | LOW | web-app |
| REFACTOR-008 | Magic-byte image sniffing is duplicated between image-worker and presets-api, and presets-api's copy lacks GIF/BMP | P3 | MEDIUM | presets-api + image-worker |
| REFACTOR-009 | `bodySizeLimit` / `jsonDepthLimit` middleware exists as two near-copies in oauth and presets-api | P3 | MEDIUM | worker-kit (publish) → oauth, presets-api |

## OPT catalog
| ID | Title | Impact | Category | Deploy unit |
|---|---|---|---|---|
| OPT-001 | og-worker's two SPA pass-through `fetch()` calls carry no timeout | LOW | I/O | og-worker |

## Status basis

Nothing was fixed during the analysis; every row is OPEN. The audit modified no source file (the worktree diff is `docs/audits/2026-09-16-deep-dive/` only).

## Positive controls

Verified at the commit and not worth re-filing next time (per-unit detail in `evidence/review-*.md`):

- **Harmony convergence holds everywhere.** `generateHarmonySlots` is the only hue rotation in core, api-worker, og-worker and bot-logic; `IDEAL_OFFSETS` is gone from both packages; hue units are degrees at every seam checked.
- **The five colour wheels** guard prototype keys (`Object.hasOwn` in `getColorWheel`), assert monotone tables, and are cross-checked against culori over 2,000 random samples.
- **`dyes.json` invariants are exact** (125 contiguous stainIDs, valid hex, 105 consolidated A/B/C), and the 11 facewear slugs match the frozen `LEGACY_FACEWEAR_ITEM_IDS`.
- **Every upstream fetch in core, api-worker, discord-worker's Discord client and og-worker carries a timeout** (the two exceptions are BUG-016 and OPT-001).
- **Body caps bind on the stream** for both api-worker POST routes, the GitHub webhook, presets-api's preview upload and the Discord Ed25519 path (FINDING-001/003 of 2026-09-15 hold).
- **Cross-application button routing** (moderation buttons posted with `MODERATION_BOT_TOKEN`) is intact end-to-end; the moderation-stats contract test still reads presets-api's live SQL.
- **Font tests read real `.ttf` files** in discord-worker and og-worker (cmap parse + real resvg render); FINDING-006's log privacy is pinned by `index.privacy.test.ts`.
- **The web-app `.chara` name-privacy rule holds**: community submission names are typed-draft-only; `item-links.ts` never builds an Eorzea Collection link and says why.
- **MarketBoardService request versioning** correctly prevents a superseded fetch reading as "market offline"; consolidated price fan-out re-keys onto each dye's own itemID.
- **oauth's D1 mocks are statement-aware** (branch on `sql.includes`), so the generic "scripted queue ignores the statement" risk does not apply there; BUG-049/050/051 and oauth-05/06/07 all carry non-vacuous regression tests.

## Rejected suspicions

Checked and dropped, so the next audit does not re-chase them.

- **"Swatch/Mixer context-menu hand-offs are a live no-op."** True that `navigate-to-tool` has no listener, but `result-card.ts` only ever emits `inspect-*` / `transform-*` / `external-*` / `add-mixer-slot-*`, so the `add-comparison` branches never run — dead code (REFACTOR-001), not a defect.
- **"Preset detail never shows prices."** Line 958 renders the vendor price; only the opt-in Universalis overlay is unread (BUG-004 at MEDIUM, not HIGH).
- **"A→B navigation lets a late vote-status response overwrite the new preset."** The detail element is destroyed on navigation, so the late response lands on a detached instance; only the same-instance optimistic-vote ordering survives (BUG-026).
- **"`/preset edit dye5:` places the dye in the wrong slot."** Submit compacts options into a dense array and the API floor is 3 dyes; there are no positional slot semantics. Only the comment at `preset.ts:712` is stale.
- **"`banned_users.xivauth_id` has no reader."** It is read by `ban-service.ts:174-194,649`; it has no *writer* — BUG-001 is framed on that.
- **"`PresetService`'s header example shows itemID-shaped values."** The header contains no dye values.
- **"routes/harmony.ts mixes `dye.itemID` and `dye.id` into `excludeItemIDs`."** `DyeDatabase` guarantees `id === itemID` for every loaded dye; documented in `review-api-worker.md` in case that invariant ever moves.
- **"`bandSlices` undershoots past ~52 colours."** Clipped harmlessly; no realistic input.
- **"preferences.ts filters set/reset is a new KV read-modify-write race."** It is the whole file's documented, deferred BUG-036 limitation, not new.
- **"Hono `bodyLimit` trusts a present `Content-Length` over the bytes read."** No concrete bypass could be constructed without asserting edge-runtime framing behaviour; left out per the verification bar.
- **The four `validateEnv` harnesses and the RYB dual implementations** stay as decided in 2026-09-02 / `DEPRECATIONS.md`; not re-proposed.

## Recommendations

1. **Fix BUG-007 before anything else** — a ~0.4 % per-run flake in a shared fixture will redden an unrelated PR and cost a re-run each time; the fix is a counter.
2. **Adopt a "dead by data, alive by type" check for event vocabularies.** REFACTOR-001 survived knip and the reachability gate because a `switch` over a string union is reachable by type; a test that enumerates `ContextAction` against the handled cases would have caught it.
3. **Give dynamic `import()` a lint rule.** BUG-003 is one bare `void import().then()` among sibling sites that all `.catch`; `no-floating-promises` with `ignoreVoid: false` on dynamic imports, or a shared `loadChunk()` helper, closes the class.
4. **Wire `navigateTo` assertions before the barrel trap bites.** BUG-040's three survivors are latent only because no test asserts navigation yet; an `no-restricted-imports` entry for `@services/router-service` outside `services/` makes the rule mechanical.
5. **Decide the ban identity key** (BUG-001) as a product/security decision before anyone writes code: snowflake-or-UUID at the moderation gates is one deploy; a real `xivauth_id` path is two.
6. **Retire or restore extractor sharing deliberately** (BUG-002); an orphaned og-worker route is a maintenance and cache-key surface with no producer.
7. **Keep the "tests that cannot fail" question in review** — twelve more rows this round (BUG-032…043), all of the same six shapes recorded in `traps/tests-coverage.md`.

## Remediation status

| ID | Status | Commit |
|---|---|---|
| all | OPEN | — |

## Next steps

`REMEDIATION_PLAN.md` — written by `remediation-planner` from this catalog (no other open catalog exists for the same tree: the 2026-09-15 dead-code and security catalogs were executed in PRs #183–#186).
