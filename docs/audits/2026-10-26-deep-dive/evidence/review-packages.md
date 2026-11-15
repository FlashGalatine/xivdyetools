# Package deep-dive evidence

Scope: all eight packages at `6da3ff5b`, reviewed 2026-10-26. Reviewer routing: instruction-only worker role, `gpt-6.1-sol` / `high`, explicitly assigned by coordinator. Findings are candidates for independent verification, not final filing verdicts. No build, test suite, reproduction program, source edit, git write, network request, external action, or subagent was used. Only these three assigned evidence files were written.

## Coverage

| Package | Non-test source files | Original source lines |
|---|---:|---:|
| auth | 9 | 1,308 |
| bot-logic | 22 | 4,768 |
| core | 68 | 18,396 |
| logger | 13 | 2,237 |
| svg | 19 | 6,428 |
| test-utils | 18 | 2,064 |
| types | 32 | 2,848 |
| worker-kit | 23 | 2,987 |
| Total | 204 | 41,036 |

`read-files-packages.txt` is the exact file ledger. All tracked non-test implementation/declaration files under package `src/` and `scripts/` were read in line-numbered batches. Blank/comment-only lines were elided for output; counts above are original complete file line counts. Initial oversized outputs were repaired by smaller rereads; final source-inventory comparison had no unread implementation file. Core scripts, including all three parts of `build-locales.ts`, were included. `import-graph.ts` under the core test directory was additionally read in full as a support file and is excluded from the 204-file total.

All eight package manifests, all eight Vitest configs, core's audit ESLint config and localize config were read. Thirty runtime source JSON files were parsed and their top-level structures inventoried. Generated palettes, reference tables, presets, and locale prose were **not** semantically re-derived row by row. Test fixtures and tests were not comprehensively audited; relevant harmony, swatch, glamour, chara facade and parity cases were inspected to check candidate coverage. No source code files remain partially reviewed within the stated implementation scope.

Context read: root and all eight package `CLAUDE.md` files; `.agents/skills/deep-dive-analysis/SKILL.md`; named audit-shared routing, conventions, unit, shell and test-trap references; `DEPRECATIONS.md`; 2026-10-04 deep-dive README/report/rejections and core/data review; 2026-10-26 security report/catalog/rejections and pertinent handoffs; 2026-10-26 xivcharakit dead-code report/catalog/KEEP decisions. Historical rejections were used to avoid re-filing previously accepted behavior. Exact candidate data is in `candidates-packages.json`.

## Candidates

### pkg-001 — harmony measures mix units (MEDIUM)

`packages/core/src/services/dye/HarmonySelector.ts:136` returns matching-method distance for perceptual selection, but the alternate branch at :139-141 returns angular hue distance. `packages/bot-logic/src/commands/harmony.ts:221` forwards the caller's strictness; :275 passes the selector's deviance directly as the main row measure, while :278-280 computes companions using the selected metric. `packages/svg/src/harmony-card.ts:291` grades all row measures against that metric's harmony bands and :295 formats them under that metric. The public Discord flag at `apps/discord-worker/src/handlers/commands/harmony.ts:63` accepts false. A false-strictness OKLAB request therefore compares the main degree value against OKLAB thresholds (0.041/0.101/0.174), while companion values use OKLAB units.

The false-strictness path needs a card-argument assertion. `packages/bot-logic/src/commands/harmony.test.ts:365` covers true strictness and result success without checking this measure. Keep angular selection behavior and recompute displayed distance after selection. No runtime probe was run.

### pkg-002 — same palette index hides distinct live eye colors (MEDIUM)

`packages/bot-logic/src/commands/swatch.ts:427` drops rightEye whenever `eyesShareIndex` and a left row exist; :448 labels the retained row LR. The facade carries the raw index-equality flag at `packages/core/src/services/chara/chara-library.ts:273`. Existing EXT-28 at `packages/core/src/services/chara/__tests__/chara-library-parity.test.ts:5669` expressly contains equal indices 42 with distinct effective colors: left off-grid `#87C0A3`, right palette `#DCBA6C`, flag true. Consequently the command loses the right eye's effective color and nearest-dye match.

`packages/bot-logic/src/commands/swatch-library.test.ts:358` exercises a different null-left-match case; ordinary shared-index cases have identical colors. Add the existing EXT-28 state at the command boundary. Merge and label LR only after effective winning colors are equal. No runtime probe was run.

### pkg-003 — bounded label can end in a lone surrogate (LOW; security handoff overlap)

`packages/core/src/services/chara/chara-library.ts:146` truncates by UTF-16 code unit at 256. Its producer/nickname call sites at :265 and :269 split a supplementary-plane character after a 255-code-unit prefix. UTF-8 rendering can replace the dangling surrogate with U+FFFD; SVG escaping removes illegal surrogates (`packages/svg/src/base.ts:18`) so this does not break XML. The producer allowlist limits practical display exposure; nickname remains a concrete cosmetic case.

`packages/core/src/services/chara/__tests__/chara-library.test.ts:196` uses only repeated ASCII and checks length, leaving the boundary untested. Preserve the cap while ending on a code-point boundary. This is the G67 informational security handoff; coordinator owns the related web filename truncation and should combine them if filed. No runtime probe was run.

### pkg-004 — glamour tail escapes aggregate embed budget (LOW; security handoff overlap)

`packages/bot-logic/src/commands/glamour.ts:581`, :593 and :598 interpolate names into fixed/blocked/company notes. The tail at :604 is never capped. When it consumes the 4000-character budget (:193), the search position at :607 becomes negative; `lastIndexOf` returns -1 for the header-started body, and `slice(0,-1)` retains almost the entire body. The final :613 description still contains all notes and can exceed Discord's 4096-character limit. An injected resolver can supply such names; abnormal upstream game names are required on the live resolver route. This is low exposure, not a demonstrated attacker path.

`packages/bot-logic/src/commands/glamour.test.ts:624` lengthens acquisition/body text while keeping notes short. Its :653 aggregate assertion does not exercise the tail overflow or negative remaining budget. Bound/compact notes first, allocate a nonnegative remainder, and assert final size. This is security G37's library budgeting handoff and intersects uncapped-name FINDING-002. The worker's ignored failed-edit outcome is a separate coordinator finding. No reproduction was executed by this reviewer; earlier security evidence reported one.

## Rejected suspicions and controls

- **Robe gender mismatch rejected:** facade `packages/core/src/services/chara/chara-library.ts:136` maps Masculine/Feminine to Male/Female, applied at :259-260. `ImportedCharaCharacter` uses normalized resolver gender (`packages/core/src/services/chara/chara-resolver.ts:112`); glamour consumes normalized context at `packages/bot-logic/src/commands/glamour.ts:571`. Feminine/Masculine/unknown Robe cases already exist around `glamour.test.ts:280`.
- **Contrast-card pair clipping rejected for supported input:** public command caps at four dyes, `apps/discord-worker/src/handlers/commands/contrast.ts:66`; six supported pairs fit. Speculative direct callers passing more than the supported input are insufficient evidence.
- **API cache-coalescing timing not refiled:** pending removal precedes awaited cache write at `packages/core/src/services/APIService.ts:587`, but the same small duplicate-fetch window was rejected as core-data07 in 2026-10-04 verdicts. No new live in-repo price consumer establishes a stronger impact. Unawaited failed cache deletion remains an unconfirmed low operational suspicion, not a candidate.
- **World ID omission not refiled:** `_worldID` at `packages/core/src/services/APIService.ts:915` is reserved behavior and prior review rejected it; no new consumer contract was found.
- **Blending/conversion consolidation not proposed:** `DEPRECATIONS.md` explicitly declines consolidation where numeric differences preserve algorithm behavior. Random k-means initialization and unvalidated direct negative search limits also remain prior rejected suspicions without new ingress evidence.
- **Old filter-before-match defect is controlled:** mixer/gradient now construct exclusions and pass them into nearest-dye search rather than filtering the sole winner afterward. The old numeric-six-digit color ambiguity is controlled by `packages/bot-logic/src/input-resolution.ts:248` and :254.
- **Color/palette controls:** `packages/core/src/blending/blending.ts:78` handles achromatic hue and non-finite blend ratio; palette unique-color/empty-cluster paths were inspected. `packages/core/src/services/dye/DyeDatabase.ts:315` rejects all-invalid datasets, :339/:356 reject duplicate keys, and :399-402 freeze exposed entries. No new concrete candidate from those paths.
- **Auth controls:** JWT typed-claim checks and signature/algorithm binding were inspected; actual streamed Discord body bytes are bounded at `packages/auth/src/discord.ts:123`. HMAC canonical request binding was inspected. No new auth candidate; existing security items are not duplicated.
- **Logger controls:** ancestor/memo distinction in redaction, failing `toJSON` handling and sanitized payload paths were inspected in `packages/logger/src/core/base-logger.ts:340` and :473. Existing security non-Error/error and webhook-shape findings are not relabeled as deep-dive discoveries.
- **Worker-kit controls:** content-type folding at `packages/worker-kit/src/body-guards/body-guards.ts:43`, paged KV cursor reset at `packages/worker-kit/src/rate-limiter/backends/kv.ts:299`, and response-preserving rate-limit headers at `packages/worker-kit/src/middleware/rate-limit.ts:97` were inspected. Documented KV eventual consistency/fail-open behavior is not a new bug.
- **Test-utils controls:** D1 `first` null behavior at `packages/test-utils/src/cloudflare/d1.ts:258` and deterministic KV/R2 cursor ordering in `packages/test-utils/src/cloudflare/kv.ts` and `packages/test-utils/src/cloudflare/r2.ts` were inspected. Test helpers are runtime test infrastructure and were included in the full source pass; no new concrete defect established.

No refactor/optimization candidate is added solely for style, file size, theoretical microperformance, or historical duplication. Static findings above need coordinator verification and focused tests before remediation.
