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
| REFACTOR-003 | `/preset submit|edit` schemas document name/description length bounds but set no `min_length`/`max_length`, and autocomplete choice names are never truncated to Discord's 100-char cap | P3 | LOW | discord-worker |
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
