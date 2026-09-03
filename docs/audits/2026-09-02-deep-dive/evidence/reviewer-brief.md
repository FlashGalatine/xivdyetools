# Reviewer brief — deep-dive 2026-09-02 (read fully before starting)

You are a **read-only** code reviewer for one slice of a deep-dive audit of the xivdyetools monorepo
(pnpm + Turborepo; Cloudflare Workers on Hono; Lit + Vite web app; TypeScript strict with
`verbatimModuleSyntax`; Vitest 4).

## Ground rules

- Repo root is the git worktree at `origin/main` **e7ac4042**:
  `C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02`
  Read files **only** under this path (never under `C:/dev/XIVProjects/xivdyetools` itself).
- Use the Read / Grep / Glob tools. **Do not run git commands, tests, builds, or installs.** Never modify a
  source file. Grep only under `apps/*/src`, `packages/*/src` (and `integration/`, `scripts/` where the
  scope names them) — `coverage/`, `e2e-coverage/`, `dist/` and `.wrangler/` contain copies of the sources
  and poison every search.
- Read **every non-test source file in your scope**, plus the package entry points it calls when that is
  needed to confirm a claim. Skim the matching `*.test.ts` / `__tests__` files to judge whether each
  candidate is covered, and to spot tests that cannot fail.

## What to look for — hidden bugs first

Generic (every unit): off-by-one; `null`/`undefined` through optional chains; swallowed rejections
(`catch` that returns success, `.catch(() => {})` on a side effect); inverted conditions; unreachable
branches; stale caches / missing invalidation; integer parsing of user input (`parseInt` / `Number`
without guards, NaN reaching a query or a bind); float equality; empty collections; Date / timezone /
ISO-vs-space timestamps; string-vs-number id comparisons; async work started but never awaited or
`waitUntil`-ed; listeners / timers / observers registered without a teardown path.

Surface-specific rows are in your task prompt. The unit checklist rows in full:

| Surface | Look for |
|---|---|
| Workers / Hono | floating promises (side effects without `waitUntil`/await); module-scope caches or counters shared across requests; KV read-after-write assumptions; D1 COUNT-then-INSERT TOCTOU, multi-statement writes without `.batch()`, `RETURNING` misuse; middleware ordering (auth after handler, rate-limit after work); error handler swallowing (`catch {}` → 200), opaque 500s from schema drift (schema.sql vs `migrations/`); `fetch` without timeout/AbortSignal (Universalis, XIVAPI, Discord); cache-key collisions (missing `lang`/`algo`/`Vary`); `executionCtx` casts; env validation latched once per isolate |
| Discord interactions | 3-second ack vs deferred path; 15-minute interaction-token expiry on long jobs; `custom_id` ≤ 100 chars and state packed into it; 25-choice autocomplete cap; embed/field/description length limits (256/1024/4096/6000); component row limits (5×5); locale fallback (`Translator.t()` returns the key, never falsy — `|| 'x'` is dead); follow-up edits that never check `.ok`; cross-application button routing (approve/reject posted by one app, handled by another) |
| Lit / web-app | listeners added in `connectedCallback` / `firstUpdated` without removal; `innerHTML =` re-render dropping listeners or state; shadow-DOM CSS boundary (tools render inside `V4LayoutShell`'s shadow root — page CSS never reaches them; the same components also mount in light-DOM modals); controllers with stale closures; rAF / `setTimeout(0)` timing; `LanguageService.t()` fallbacks; `localStorage` / IndexedDB parsing without guards or schema versioning; OAuth `state` round-trip; in-flight fetch superseded by a newer request (race → stale data wins); URL / share-link encoding of dye ids (stainID vs legacy itemID) |
| Color / dye math (core) | ΔE aliases (`ciede2000` canonical, `cie2000` normalised — `===` traps); k-d tree vs linear-scan code paths; `getMarketItemID` / `CONSOLIDATED_DYES` (105 of 125 dyes share three real itemIDs 52254/52255/52256); facewear legacy IDs frozen (`LEGACY_FACEWEAR_ITEM_IDS`, never regenerated); `Dye.itemID` is always a number — `> 0`, never a null-check; hex / branded-type validation (anchored regex, 3-digit forms, `#` handling); float equality; empty inputs; LRU caches handing out mutable references; HSV hue wrap at 360; Lab/OKLab conversions at the gamut edge |
| Tests that cannot fail | `expect(typeof x).toBe('function')`, `not.toThrow()` alone, guarded `if (…) { expect }` bodies with no else, asserting a value captured **before** the action, arithmetic the test computed itself, mocks that return the constant the assertion checks. Report as kind **UNTESTED** naming the behaviour that test was supposed to catch |

## Refactor / optimization — short lists only

- **REFACTOR**: functions > 50 lines or files > 800 lines *where the size is hiding a correctness risk*;
  duplicated helpers across apps that belong in a package; magic numbers for limits/timeouts; layer
  violations (handler doing SQL / a component doing fetch); inconsistent error shapes across routes.
  **Do not** propose blending-conversion unification (declined in `DEPRECATIONS.md` with recorded deltas).
- **OPT**: N+1 D1 queries / missing `.batch()`; repeated expensive colour math without memo on a hot path;
  per-request `O(n³)` or string growth (`O(n²)` over the 125-dye set is fine); missing edge cache /
  `Cache-Control`; bundle weight (discord-worker gzip limit 3,072 KiB with ~14 % headroom; web-app has a
  bundle budget); eager loading in the SPA that a lazy chunk would remove.

## Known context — do not re-file unless you find a concrete regression

All prior audits were remediated (2026-07-18 deep-dive, 2026-08-09 pre-release, 2026-08-21 and
2026-08-29 security, 2026-09-01 dead code). The classic categories came back clean in August: no
floating promises, no empty `catch {}`, no loose equality outside `== null`. Previously fixed patterns to
**check for regression only**: env-validation guard latching per isolate; `LocalizationService`
singleton locale race; cached rejected init promise poisoning the isolate (resvg-wasm, lazy JSON); KV
read-modify-write lost updates on favorites/collections; consolidated `getMarketItemID` price lookups in
budget/swatch; `MemoryRateLimiter` cleanup using the wrong window; logger redaction case-sensitivity;
Universalis proxy `Vary: Origin` and SWR `max-age`; `/v1/match/within-distance` filtering after `limit`.

Domain facts: 125 dyes (schema v2, `stainID` canonical, seven stored fields, everything else derived at
`DyeDatabase.initialize()`); 11 facewear colours are **not** dyes (`facewearColors`, string slug ids);
6 locales `en ja de fr ko zh`; CJK text in SVG needs the subset fonts; `Translator.t()` returns the key on
a miss; web-app tools render inside `V4LayoutShell`'s shadow root.

## Verification bar

Every candidate must cite an exact `file:line` you read, the failing input or state, and the wrong
outcome — in one line. Prefer five real defects over twenty maybes; a candidate you could not make fail
in your head goes to REJECTED with the reason. Severity: **CRITICAL** (data loss, auth bypass, money),
**HIGH** (user-visible wrong result on a common path), **MEDIUM** (wrong result on an edge path, or an
operational risk), **LOW** (cosmetic, latent, or defended elsewhere).

## Output

Write **exactly one file**:
`C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02/docs/audits/2026-09-02-deep-dive/evidence/review-<unit>.md`
containing, in this order:

1. **Map** — module / route / command table of the scope (≤ 30 lines).
2. **Candidates** — for each: `<unit>-NN`, kind (BUG / UNTESTED / REFACTOR / OPT), severity or priority,
   `file:line`, one-line claim, failing input → wrong outcome, why tests miss it, covered-by-test yes/no,
   a ≤ 8-line code excerpt, and the fix direction in one line.
3. **POSITIVE** — what is right and should not be re-filed next time (≤ 8 bullets).
4. **REJECTED** — suspicions you checked and dropped, one line each with the reason.
5. **COVERED** — count and list of files read.

Return to the coordinator (≤ 40 lines): a table
`| cand-id | kind | sev | file:line | one-line claim | tested? |`, then `POSITIVE:` (≤ 5 bullets),
then `COVERED: <n> files`. Nothing else — the file carries the detail.
