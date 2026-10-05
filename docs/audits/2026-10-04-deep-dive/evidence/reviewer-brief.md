# Reviewer brief — deep-dive 2026-10-04 (read fully before starting)

You are a **read-only** reviewer for one slice of a deep-dive audit of the xivdyetools monorepo:
- pnpm + Turborepo;
- Cloudflare Workers on Hono;
- a Lit + Vite web app;
- TypeScript strict with `verbatimModuleSyntax`;
- Vitest 5.

## What you are reading

- **The repo root is a local preview worktree:** `C:/dev/XIVProjects/xivdyetools/.claude/worktrees/preview-2026-10-04` (Git Bash: `/c/dev/XIVProjects/xivdyetools/.claude/worktrees/preview-2026-10-04`).
  - Start every Bash call with `cd` to it.
  - Never read or write under any other worktree or under `C:/dev/XIVProjects/xivdyetools` itself.
- **The branch is `preview/integration-2026-10-04` @ `80262a2f`,** which is never pushed. It is `main@8ecb878f` plus the 13 PRs open on 2026-10-04, so it is the code that will be on `main` after the batch merge. Exact heads: `docs/audits/2026-10-04-dead-code/evidence/preview-branch.md`.
- **Origin matters:** tag every candidate either `MAIN` (already true at `8ecb878f`) or `PR-#N` (introduced by an open PR).
  - `evidence/changed-src-since-79a69d1f.txt` marks files an open PR changes.
  - For per-PR file lists, see `docs/audits/2026-10-04-dead-code/evidence/pr-delta.txt`.

## Before you start

1. **Read your unit's `CLAUDE.md`** (`apps/<unit>/CLAUDE.md` or `packages/<pkg>/CLAUDE.md`). It holds the decisions and traps the code does not show.
2. **Your file list** is `evidence/slices/<slice>.txt`.
   - Each app slice includes its `wrangler.toml` and `package.json`. Cron triggers, bindings, rate limits and vars are behaviour, and they changed in the open PRs.
   - Package slices include their `package.json` exports maps.
3. **Skim the 2026-09-16 deep-dive's *Rejected suspicions*** (`docs/audits/2026-09-16-deep-dive/DEEP_DIVE_REPORT.md`), so nothing it already dropped gets re-filed.

## Ground rules

**Allowed:**
- Read, Grep and Glob tools.
- Read-only git: `git grep`, `git log`, `git show`, `git diff`.
- Running **one existing test file** to check a hypothesis: `pnpm --filter <pkg> exec vitest run <file> --coverage.enabled=false`.

**Never:**
- build, install, or run a whole suite or `turbo`;
- edit, stage, stash, checkout, commit or push;
- write any file except your review file.

**Searching:** search tracked files only (`git grep`, or `git ls-files | xargs grep`).
- `coverage/`, `e2e-coverage/`, `dist/`, `node_modules/` and `.wrangler/` contain copies of the sources and poison every search.
- `docs/audits/**` holds audit text, not code.

**What to read:**
- Read **every non-test source file in your slice**, plus the package entry points it calls when that is needed to confirm a claim.
- Skim the matching tests to judge coverage and to spot tests that cannot fail.

**Priority inside your slice:**
1. Files in `evidence/changed-src-since-79a69d1f.txt`. They hold 192 source files changed in the 345 commits since the last deep-dive (2026-09-16), and were never deep-dived. Open-PR code is marked there.
2. Regressions of the previously fixed patterns under *Known context*.
3. Everything else, with fresh eyes.

**Coverage:** per-workspace coverage is in `evidence/coverage-baseline.txt` (once written). Uncovered lines are where hidden bugs live.

## What to look for — hidden bugs first

**Generic, in every unit:**
- off-by-one;
- `null`/`undefined` through optional chains;
- swallowed rejections: a `catch` that returns success, or `.catch(() => {})` on a side effect;
- inverted conditions;
- unreachable branches;
- stale caches or missing invalidation;
- integer parsing of user input: `parseInt` / `Number` without guards, or NaN reaching a query or a bind;
- float equality;
- empty collections;
- Date and timezone handling, and ISO-vs-space timestamps;
- string-vs-number id comparisons;
- async work started but never awaited or `waitUntil`-ed;
- listeners, timers or observers with no teardown path;
- prototype-key lookups on client-controlled strings.

| Surface | Look for |
|---|---|
| Workers / Hono | <ul><li>Floating promises.</li><li>Module-scope caches or counters shared across requests.</li><li>KV read-after-write assumptions.</li><li>D1 COUNT-then-INSERT TOCTOU; multi-statement writes without `.batch()`; `RETURNING` misuse; AFTER-trigger values a `RETURNING *` cannot see.</li><li>Middleware ordering.</li><li>Error handlers swallowing errors.</li><li>Opaque 500s from schema drift (`schema.sql` vs `migrations/`).</li><li>`fetch` without a timeout.</li><li>Cache-key collisions.</li><li>`executionCtx` casts.</li><li>Env validation latched once per isolate.</li><li>Body-size caps enforced after buffering.</li><li>Cron `scheduled()` handlers: `waitUntil`, partial failure, idempotency.</li></ul> |
| Discord interactions | <ul><li>3-second ack vs the deferred path.</li><li>15-minute token expiry.</li><li>`custom_id` ≤ 100 characters.</li><li>The 25-choice autocomplete cap.</li><li>Embed limits (256/1024/4096/6000).</li><li>Component row limits.</li><li>`Translator.t()` returns the key, so `\|\| 'x'` is dead.</li><li>Follow-up edits that never check `.ok`.</li><li>Cross-application button routing (moderation embeds are posted with one app and handled by another).</li><li>Revision-bound review ids `preset_<action>_<uuid>:<rev>:<status>` and their legacy forms.</li><li>**The bot must never display a character name** (`.chara`).</li></ul> |
| Lit / web-app | <ul><li>Listeners without removal.</li><li>`innerHTML` re-renders dropping state.</li><li>The shadow-DOM CSS boundary: tools render inside `V4LayoutShell`'s shadow root and also mount in light-DOM modals.</li><li>Stale closures.</li><li>rAF / `setTimeout(0)` timing.</li><li>`LanguageService.t()` fallbacks.</li><li>Storage parsing without guards or schema versioning.</li><li>The OAuth `state` round-trip.</li><li>Superseded fetches (a stale result wins).</li><li>Share-link encoding of dye ids (stainID vs legacy itemID).</li><li>Unhandled dynamic `import()` failures.</li><li>Clipboard after a dynamic import.</li><li>Glamour Reader: `.chara` parsing of untrusted files (bounds, sizes); twin picking; the export sheet's on-device Acquisition lines; **character names never leave the device**.</li></ul> |
| Color / dye math (core) | <ul><li>ΔE aliases (`ciede2000` vs `cie2000`).</li><li>k-d tree vs linear scan.</li><li>`getMarketItemID` / `CONSOLIDATED_DYES` (105 of 125 dyes share 52254/52255/52256).</li><li>Frozen `LEGACY_FACEWEAR_ITEM_IDS`.</li><li>`Dye.itemID > 0`, never a null-check.</li><li>Hex validation.</li><li>The five colour wheels: table edges, the 0/360 seam, monotonicity, round-trips.</li><li>`generateHarmonySlots` is the only hue rotation.</li><li>`human.cmp` palette reading (both halves) and the in-game check.</li></ul> |
| Data / generated tables | <ul><li>The GPOSERS acquisition tables and formatter (api-worker).</li><li>Zone and outpost data.</li><li>Locale generators (`build-locales.ts`): generated vs hand-edited.</li><li>A table entry no code path can produce, or a code path no entry covers.</li></ul> |
| Tests that cannot fail | <ul><li>`typeof x === 'function'`.</li><li>`not.toThrow()` alone.</li><li>Guarded bodies with no `else`.</li><li>A value captured before the action.</li><li>Arithmetic the test computed itself.</li><li>A mock that returns the asserted constant.</li><li>A suite that exercises only the safe setting.</li></ul>Report these as kind **UNTESTED**, naming the behaviour the test was supposed to catch. |

## Refactor / optimization — short lists only

- **REFACTOR:**
  - files over 800 lines, or functions over 50, *where the size hides a correctness risk*;
  - duplicated helpers across apps (`evidence/cross-unit-dupes.txt` lists 59 shared symbol names);
  - magic numbers for limits;
  - layer violations;
  - inconsistent error shapes.
  - **Do not** propose: blending-conversion unification (declined in `DEPRECATIONS.md`), unifying the four `validateEnv` harnesses (rejected 2026-09-02), or the RYB dual implementations.
- **OPT:**
  - N+1 D1 queries;
  - repeated expensive colour math on a hot path;
  - per-request `O(n³)` work or string growth (`O(n²)` over the 125-dye set is fine);
  - missing edge cache or `Cache-Control`;
  - bundle weight (discord-worker is at 2,362.86 of its 3,072 KiB gzip cap, 76.9 %; web-app has per-chunk budgets, see `evidence/bundle-web-app.txt`);
  - eager loading in the SPA.

## Known context — do not re-file unless you find a concrete regression

- **2026-09-16 deep-dive:** all 53 findings are closed. BUG-040 is a partial fix: `welcome-modal.ts` is exempt from the router-import rule.
- **2026-10-03 security audit:** its 31 findings are remediated in the open PRs this branch includes:
  - revision binding;
  - a retention cron;
  - migration 0015;
  - xivauth bans;
  - Workers Logs pinned off;
  - native rate limiting on the Universalis proxy;
  - the CI log gate.
- **2026-10-04 dead-code audit** (`docs/audits/2026-10-04-dead-code/DEAD_CODE_REPORT.md`): **do not file unreachable or unused code**, since that audit owns it. File a defect in live code even when it sits next to dead code.
- **A lead to verify and grade (discord-worker / presets-api slices):** a pending preset submitted through the bot appears to get two moderation posts.
  - One comes from discord-worker's own `notifyModerationChannel` / `notifyEditModerationChannel` (`src/handlers/commands/preset.ts:576`, `:924`; legacy button ids).
  - The other comes from presets-api's webhook (`apps/presets-api/src/handlers/presets.ts` ~846-878 and ~1068-1090; revision-bound ids, handled at discord-worker `src/index.ts:402`).
  - Already true on `main`.
- **Previously fixed patterns: check for regression only.**
  - env-validation latching per isolate;
  - the `LocalizationService` singleton locale race;
  - a cached rejected init promise poisoning the isolate;
  - KV read-modify-write lost updates;
  - consolidated `getMarketItemID` price lookups;
  - logger redaction case-sensitivity;
  - the Universalis proxy `Vary: Origin` header;
  - `/v1/match/within-distance` filtering after `limit`;
  - modal-stack listener clearing;
  - `discordLocaleToLocaleCode` prototype lookup;
  - RYB green→blue;
  - moderation embeds resolving dyes through the item-ID map;
  - test-utils fixture id collisions.
- **Still open by decision (do not re-file):**
  - `oauth-10` (`RETURNING`);
  - `moderation-worker-11` (a rejected author is never notified, a product decision);
  - OPT-005 / OPT-009 (declined caches).

## Domain facts

- **Dyes:** 125 dyes (schema v2, `stainID` canonical, everything derived at `DyeDatabase.initialize()`). The 11 facewear colours are **not** dyes.
- **Locales:** 6 (`en ja de fr ko zh`).
- **CJK in SVG** needs the subset fonts and static-instance weights.
- `Translator.t()` returns the key on a miss.
- **`.chara` files** carry no facewear tint, and character names must never be sent or stored.
- **Eorzea Collection links** are never built from an FFXIV item id.

## Verification bar

Every candidate must cite, in one line:
- an exact `file:line` you read;
- the failing input or state;
- the wrong outcome.

Prefer five real defects over twenty maybes. A candidate you cannot make fail in your head goes to REJECTED, with the reason.

| Severity | Meaning |
|---|---|
| **CRITICAL** | data loss, auth bypass, money |
| **HIGH** | user-visible wrong result on a common path |
| **MEDIUM** | wrong result on an edge path, or an operational risk |
| **LOW** | cosmetic, latent, or defended elsewhere |

## Output

Write **exactly one file**, `docs/audits/2026-10-04-deep-dive/evidence/review-<slice>.md`, containing:

1. **Map:** a module / route / command table (≤ 30 lines).
2. **Candidates:** for each one:
   - an id `<slice>-NN` and its kind (BUG / UNTESTED / REFACTOR / OPT);
   - severity or priority;
   - `file:line`;
   - the claim;
   - failing input → wrong outcome;
   - why the tests miss it, and covered by a test yes/no;
   - origin (MAIN / PR-#N);
   - a ≤ 8-line excerpt;
   - the fix direction.
3. **POSITIVE:** what is right and should not be re-filed (≤ 8 bullets).
4. **REJECTED:** suspicions you checked and dropped, with reasons.
5. **COVERED:** the count and list of files you read.

Then return the structured result your task asks for.
