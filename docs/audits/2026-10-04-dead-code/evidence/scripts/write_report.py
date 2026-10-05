"""Write DEAD_CODE_REPORT.md from evidence/catalog.json plus the prose below."""
import json
import pathlib

OUT = pathlib.Path('docs/audits/2026-10-04-dead-code')
cat = json.loads((OUT / 'evidence/catalog.json').read_text(encoding='utf-8'))
act = [c for c in cat if c['rec'] != 'KEEP']
keep = [c for c in cat if c['rec'] == 'KEEP']
S = sum(c['src'] for c in act)
T = sum(c['test'] for c in act)


def esc(s):
    return s.replace('|', '\\|')


def link(c):
    return f"[{c['id']}](findings/{c['id']}.md)"


rows = '\n'.join(
    f"| {link(c)} | {esc(c['title'])} | {c['conf']} | {c['blast']} | {c['semver']} | {c['unit']} | {c['origin']} | {c['rec']} |"
    for c in cat)
quick = [c for c in act if c['conf'] == 'HIGH' and c['blast'] in ('NONE', 'LOW') and c['rec'] == 'REMOVE' and not c.get('cascade')]
CORE = sum(c['src'] for c in keep if c['unit'] == 'packages/core')
CORE_IDS = ', '.join(c['id'] for c in keep if c['unit'] == 'packages/core')
keeprows = '\n'.join(f"| {link(c)} | {esc(c['title'])} | {esc(c['detail'])} |" for c in keep)

by_unit = {}
for c in act:
    u = by_unit.setdefault(c['unit'], [0, 0, 0])
    u[0] += 1; u[1] += c['src']; u[2] += c['test']
unit_rows = '\n'.join(f"| {u} | {n} | {s} | {t} |" for u, (n, s, t) in sorted(by_unit.items(), key=lambda kv: -kv[1][1]))

BUNDLES = [('api-worker', 3854.87, 577.39, 5237.38, 706.38), ('discord-worker', 7448.58, 2282.85, 7977.20, 2362.86),
           ('image-worker', 1666.45, 645.50, 1666.82, 645.58), ('moderation-worker', 220.64, 51.50, 234.93, 55.61),
           ('oauth', 159.27, 41.19, 160.91, 41.67), ('og-worker', 6393.90, 1944.43, 6409.02, 1947.47),
           ('presets-api', 215.94, 53.48, 231.57, 57.53)]
brows = '\n'.join(f"| {w} | {a:.2f} | {b:.2f} | {c:.2f} | {d:.2f} |" for w, a, b, c, d in BUNDLES)

text = f"""# Dead code — whole monorepo, as it will be after the 2026-10-04 batch merge (2026-10-04)

- **Branch/commit:** `preview/integration-2026-10-04@1e842b20`, a local branch that was never pushed. It is `main@8ecb878f` with the 13 open PRs (#223–#235) merged in; the exact heads are in [evidence/preview-branch.md](evidence/preview-branch.md).
- **Scope:** all 17 workspaces, plus root `scripts/`, CI workflows and root configuration. **Depth:** standard. **No source file was modified by the audit.**
- **Method:**
  1. The full gate, the repo's dead-code, knip, i18n and docs checks, `tsc --noUnusedLocals` on every unit, and a `wrangler --dry-run` bundle baseline for each of the 7 workers.
  2. Twelve per-unit reviewers ran the symbol, class-member, orphan-file, dead-path, stale-test, CSS, asset, dependency and delta sweeps.
  3. An adversarial verifier checked every candidate at `file:line`, tagged its origin (already on `main`, or introduced by an open PR) and measured its lines.
  4. A completeness critic found 8 gaps; a second round of sweeps and verification closed them.
  5. 111 verdicts in all: 81 confirmed, 30 rejected. Duplicates were merged into the 64 findings below, and each overlapping deletion was given a single owner.
  6. A final adversarial pass ([evidence/final-check.json](evidence/final-check.json)):
     - twelve skeptics each tried to refute one of the largest removals; none was refuted, and their fix-step corrections are folded into the findings;
     - a consistency check of these documents;
     - a re-check of the merge-batch claims.
- **Totals:** **64 findings**:
  - **46 cleanup entries:** {S:,} source lines and {T:,} dedicated test lines.
  - **18 KEEP:** 14 of them are published package API, which only a planned major release can remove.
  - **By origin:** **2 were introduced by open PRs** (DEAD-001 by #225, DEAD-002 by #227); 62 are already on `main`.
- **Act now (before the batch merge), both done 2026-10-04:**
  - **DEAD-001:** fixed inside PR #225 (`ea264d49`).
  - **The failing moderation-worker test** caused by PR #224: fixed in #224 (`10a1cb77`). It is a merge-batch blocker, not a dead-code finding; see below.
  - DEAD-002 is optional.

## Merge-batch results (read before merging)

The preview branch is what `main` will be after tomorrow's merges, so its checks are a trial run of the batch.

- **Merge conflicts:** only in `README.md` / `docs/versions.md` version rows and the root `CHANGELOG-laymans.md`; none in code. The real merges will hit the same ones; keep every version bump and keep the laymans entries newest first.
- **Lockfile:** `pnpm install --frozen-lockfile` passes.
- **Checks:** all pass except one: **61 of 62 turbo tasks pass**, and 62 of 62 once the #224 fix below is in. Also green: `dead-code:check`, `workers:check-logs` (so #233's new check goes green once the six pin PRs are in), `test:scripts`, `type-check:scripts` and both docs gates.
- **Blocker — PR #224 breaks a moderation-worker test.**
  - **What happens:** `apps/moderation-worker/tests/moderation-stats-contract.test.ts:57` reads presets-api's `moderation.ts` as text. It collects `as <alias>` words from the file's first `SELECT` up to `as actions_last_week`. #224's new comment at `apps/presets-api/src/handlers/moderation.ts:390`, "same shape as the revert route above", adds the alias `the`.
  - **Why CI missed it:** CI runs only the affected workspaces. moderation-worker is not a package dependent of presets-api, so neither PR's own CI runs this pairing.
  - **Fix:** reword the comment in #224. **Done 2026-10-04 in `10a1cb77`:** the comment now reads "mirrors the revert route above".
  - **Re-check:** the full gate on the preview with both fixes merged is in [evidence/gates-after-pr-fixes.txt](evidence/gates-after-pr-fixes.txt).
  - **Optional:** anchor the test to the stats statement in #225, so a future comment cannot break it.
- **DEAD-001 (PR #225):** five moderation-worker strings lost their last reader in #225's button rewrite. **Deleted in #225 on 2026-10-04 (`ea264d49`).**
- **DEAD-002 (PR #227):** the `author_discord_id` field on `ModerationPresetInfo` is no longer read.
  - #227 kept it deliberately, and its test fixture relies on it, so removing it is optional.
  - If it goes, reshape the fixture so the "ID not rendered" assertion keeps its meaning.

## Catalog

| ID | Title | Conf | Blast | Semver | Deploy unit | Origin | Rec |
|---|---|---|---|---|---|---|---|
{rows}

### Cleanup by unit

| Deploy unit | Entries | Source lines | Test lines |
|---|---:|---:|---:|
{unit_rows}

Line counts were measured by the verifiers, who opened the files. Bundle savings will be smaller than the source lines:
- types and tests erase;
- the CSS in DEAD-004–006 ships in the web-app bundle;
- the locale keys in DEAD-007/010 ship in all six locale files.

## Quick wins

HIGH confidence, NONE/LOW blast, REMOVE, and not part of a cascade: {', '.join(c['id'] for c in quick)}.

- **The largest:**
  - **DEAD-004:** 337 lines of shadow-root CSS left over from the pre-5.0 Accessibility tool.
  - **DEAD-018:** IndexedDBService getAll/count/deleteDatabase, 100 source + 200 test lines.
  - **DEAD-017:** WorldService lookups, 57 + 100.
- **Cascades:** DEAD-009/010 (after DEAD-008) and DEAD-016 (after DEAD-013/015) are separate commits in the same pull request as their trigger. Web-app's knip gate fails on the orphaned icon exports, so it cannot be green between DEAD-008 and DEAD-009. DEAD-050 (types) follows DEAD-049 (core) in a later major.
- **Needs care, REMOVE WITH CAUTION:**
  - DEAD-003, the context-action vocabulary across 5 tools;
  - DEAD-021/022, whole stale test files;
  - DEAD-029, old ban custom_id parsing;
  - DEAD-036 (`decodeJWT`);
  - DEAD-041, the test-utils integration suite (795 lines);
  - DEAD-044;
  - DEAD-045, the `qs` override, whose lockfile must be regenerated in the same commit.

## KEEP register

| ID | Item | Reason and revisit trigger |
|---|---|---|
{keeprows}

**Packages:** fourteen of the KEEP entries (DEAD-047–060) are exports of published packages with no in-repo caller.

- **Why not now:** "Unused in this repo" does not mean unused on npm, so removing any of them is a MAJOR release.
- **When:** gather them into the next major of each package, one publish sprint per package and then its consumers, instead of a release per item.
- **core is the largest group:** {CORE_IDS}, about {CORE:,} source lines.

**The prior register (2026-09-15):**
- 2026-09-15-dead-code/DEAD-019, DEAD-020 and DEAD-021 still hold; no trigger is met.
- 2026-09-15-dead-code/DEAD-020 grew: PR #229 adds another native-binding selector with a KV fallback (api-worker's Universalis proxy).
- **Correction to 2026-09-15-dead-code/DEAD-018:** `getSharedColors` and `getRaceSpecificColors` are **live**. og-worker's `src/services/character-cells.ts:66,68` calls them in production, and has since commit `35914823`. Only the rest of that entry (both `getAvailableLocales`, `hexToRyb`/`rybToHex`) is still published API without a caller.

## Dependency cleanup

- No unused dependency in any workspace:
  - knip is clean;
  - every reviewer checked config-only use;
  - `wrangler` in web-app stays as the documented pin.
- **DEAD-045:** the `qs` floor in `pnpm-workspace.yaml` overrides a package nothing installs any more. It arrived with the retired `apps/api-docs` VitePress chain.
- **DEAD-054:** `@upstash/redis` would leave worker-kit with `UpstashRateLimiter` at worker-kit's next major.
- The other overrides (rollup, seroval, vitepress>vite, tsup>esbuild, miniflare>undici) all still resolve.

## Evidence and baseline

| Check | Result |
|---|---|
| `pnpm turbo run build type-check lint test --continue --concurrency=2` | 61/62 tasks; the one failure is the #224 blocker above ([gates-before.txt](evidence/gates-before.txt)) |
| The same gate after the two Sprint 0 fixes were merged into the preview | **62/62 tasks** ([gates-after-pr-fixes.txt](evidence/gates-after-pr-fixes.txt)) |
| `pnpm dead-code:check` | exit 0; 597 production / 550 test files; 26 test-only, 6 entrypoint, 7 public exemptions (2026-09-15: 34 / 4 / 7) |
| Root knip | exactly the 3 documented web-app items |
| web-app knip; og-worker knip and `knip --production` | exit 0, no findings |
| `tsc --noEmit --noUnusedLocals --noUnusedParameters`, all 17 units | exit 0 everywhere, no hits |
| web-app locale-key analyzer | 1,195 / 1,195 keys used. It counts DEAD-007's and DEAD-010's keys as used because of dynamic prefixes (`accessibility.${{key}}`) or test-only readers |
| bot-logic i18n tests | 98 tests, 5 files, pass |
| Skipped/focused tests | none; the 3 matches are comments |
| `workers:check-logs`, `test:scripts` (133), `type-check:scripts`, `docs:check-versions`, `docs:check-links` (957 links) | all exit 0 |

### Bundle before (KiB, default environment, `wrangler deploy --dry-run`)

| Worker | Raw 2026-09-15 | Gzip 2026-09-15 | Raw now | Gzip now |
|---|---:|---:|---:|---:|
{brows}

- **Where the bundles are:** the dry-run output directories are kept locally only, as in the earlier audits; the `evidence/bundle-*.log` files hold the sizes.
- **Growth since 2026-09-15:** most of it is feature work (the Glamour Reader, `.chara` and api-worker's character endpoints), not dead code.

## Positive controls

- **Earlier cleanups stayed gone:** every 2026-09-15 cleanup is still absent; for example, og-worker's `getCrawlerName`, discord-worker's `getPreference` and the v1 request signature. Anything `DEPRECATIONS.md` retires is absent from source.
- **PR leftovers are clean:**
  - #229: the old per-isolate `MemoryRateLimiter` path in api-worker is fully gone, with no class, reset hook, mock or import left.
  - #228: the retired OAuth origin is gone; only guard comments and negative assertions remain.
  - #234: `sanitizeEcho` orphaned nothing.
  - #227: removing `/stats preferences` left no handler, schema entry or locale key behind.
- **#225 has a single custom_id parser:** `parseReviewCustomId`, shared by the buttons and both modals. The command and the refresh path share one embed builder (`review-message.ts`).
- **#224's retention cron is wired:** `runRetentionJob` → `scheduled()` → `Object.assign(app, {{ scheduled }})`, on the production-only cron, and tested.
- **Workers config:** every worker's `Env` fields and `wrangler.toml` vars and bindings have a production reader, and no field is read without being declared.
- **web-app assets and helpers:** all 25 `public/` files and all `e2e/fixtures` exports have consumers. The VitePress helpers are consumed by `.vue` components.
- **root and CI:** `scripts/check-worker-logs.ts` (#233) carries a reasoned `@entrypoint` tag and is wired into `ci.yml:274`. Every workflow path filter and script reference resolves.
- **After #229, worker-kit backends:** every backend except `UpstashRateLimiter` is still constructed by an app (Cloudflare ×5, KV ×4, Memory ×2 as fallbacks).

## Rejected suspicions and corrections

Every rejection is listed with its reason in [evidence/verdicts.tsv](evidence/verdicts.tsv) (30 rows). The ones most likely to be re-chased:

- **Kept because live data still needs them:**
  - The legacy `v3_mixer_*` storage migration in gradient-tool runs on every load with an empty selection, and reads real persisted data. Retiring it is a retention decision, not dead code.
  - discord-worker's legacy preference keys and `previewimg_approve_<id>` branch: old Discord messages and stored v1 blobs still reach them.
- **Old-shape moderation buttons are still sent:** moderation-worker's legacy `preset_<kind>_<uuid>` handling is live, because discord-worker still emits that id.
  - `/preset submit` and `/preset edit` post their own moderation embed (`notifyModerationChannel` / `notifyEditModerationChannel`, `apps/discord-worker/src/handlers/commands/preset.ts:576` and `:924`). It carries no revision, because presets-api's direct responses do not include one.
  - presets-api also sends its webhook for those same submissions and edits. It has no source filter (`apps/presets-api/src/handlers/presets.ts:846-878`, `:1068-1090`). discord-worker posts a second, revision-bound embed from it (`src/index.ts:402-409`).
  - **A pending submission made through the bot therefore produces two moderation posts.** That is already true on `main`; PR #227 did not introduce it.
  - It is a behaviour issue for a follow-up, not dead code. The likely fix is to drop the duplicate direct post rather than to add a revision to it.
- **presets-api's legacy dead-letter shape** (`listFailedNotifications`) stays live until migration 0015 has been applied in production.
  - Then it becomes a dead-code candidate.
  - Revisit trigger: 0015 confirmed applied, plus one retention period.
- **Reset/observation hooks over real state** were checked again and all stay:
  - `RequestCoalescer.isInFlight`/`getInFlightCount`, `resetCategoryCache`, the `_resetPatternsForTesting`/`_setTestPatterns` pair, `MemoryRateLimiter`'s size reader and `resetMockDyeSequence`;
  - the web-app read-back accessors (`BaseComponent.hasErrorState`, `DyeSearchBox.getSearchQuery`, …).
- **Exported only for their tests, with production callers in their own file:** og-worker band helpers, image-worker photon/validator helpers, the svg/bot-logic helpers and the core wheel/calibration helpers. Under `knip.jsonc`'s `ignoreExportsUsedInFile` policy, dropping the `export` keyword is churn, not dead code.
- **Not dead after all:**
  - `ErrorCode` members in types: web-app's `error-handler.ts` uses them as map keys.
  - `calibrateBandVocabulary`: the `calibrate:bands` script runs it.
  - oauth's re-exported types and `base64UrlDecode`: production consumers.
  - api-worker's `RATE_LIMIT_WINDOW_SECONDS` branch: it is a deploy var, so the branch is reachable through configuration.
  - presets-api's moderator-only stats route is documented, and moderators use it.
- **Correction:** the 2026-09-15-dead-code/DEAD-018 entry wrongly listed `getSharedColors`/`getRaceSpecificColors` as without callers (see the KEEP register above).

## Recommendations

1. **Run the whole-graph gate on a trial merge of every batch.** The #224 → moderation-worker failure was invisible to each PR's affected-only CI. A scheduled full `turbo run test` on `main`, or `strict` branch protection with a merge queue, would catch the next one.
2. **Anchor file-reading contract tests to a unique marker,** not "the first `SELECT`". `moderation-stats-contract.test.ts` is the example.
3. **Extend the moderation-worker i18n gate.** Its inline `bot-i18n.ts` table has no orphan-key check, which is how DEAD-001 and DEAD-030 accumulated. A key test like bot-logic's locale-quality gate would cover it.
4. **Tighten web-app's orphan analyzer.** A dynamic prefix like `accessibility.${{key}}` should not mark every key under the prefix as used (DEAD-007). Count only keys whose suffix the code can actually produce.
5. **Keep a running "next major" list per published package** (DEAD-047–060), so a planned major can clear it in one release.
6. **Re-check `@testonly` reasons each audit.** This run moved `test-utils/integration/setup.ts` from exempt to removable (DEAD-041) and confirmed the rest.

## Coverage and limits

- **What was covered:** all 17 workspaces plus root scripts, CI and configuration. The per-unit coverage counts and the commands run are in `evidence/review-*.md` and `evidence/review-gap-*.md`.
- **What a static survey cannot exclude:** dynamic and computed access, external npm consumers, and Discord payloads from messages sent long ago. Those are why DEAD-062 and DEAD-063 are KEEP, and why several entries are REMOVE WITH CAUTION.
- **Not performed:** browser or E2E runs, live traffic or log inspection, an npm download-count or consumer survey, or full git archaeology.
- **Where the line counts come from:** the verifiers' measurements; recount before each removal.

## Remediation status

| ID | Status | Commit |
|---|---|---|
""" + '\n'.join(f"| {c['id']} | {c['status']} | {c['commit']} |" for c in cat) + """

## Next steps

[CLEANUP_PLAN.md](CLEANUP_PLAN.md) orders the cleanup:
- **First:** the PR-origin item inside the open PR (DEAD-001), before the batch merge.
- **Then:** one sprint per deploy unit, after the batch merge, safest first.
- **Throughout:** cascades after their trigger, and MAJOR package removals held for each package's next planned major.

Nothing is removed until the maintainer approves the plan.
"""
(OUT / 'DEAD_CODE_REPORT.md').write_text(text, encoding='utf-8', newline='\n')
print('report written;', len(cat), 'rows; quick wins:', ', '.join(c['id'] for c in quick))
