"""Write DEEP_DIVE_REPORT.md from evidence/catalog.json plus the prose below."""
import json
import pathlib

OUT = pathlib.Path('docs/audits/2026-10-04-deep-dive')
cat = json.loads((OUT / 'evidence/catalog.json').read_text(encoding='utf-8'))
bugs = [c for c in cat if c['prefix'] == 'BUG']
refs = [c for c in cat if c['prefix'] == 'REFACTOR']
opts = [c for c in cat if c['prefix'] == 'OPT']


def esc(s):
    return (s or '').replace('|', '\\|')


def link(c):
    return f"[{c['id']}](findings/{c['id']}.md)"


def n(sev, kind=None):
    return sum(1 for c in bugs if c['sev'] == sev and (kind is None or (c['kind'] == 'UNTESTED') == (kind == 'U')))


bug_rows = '\n'.join(f"| {link(c)} | {esc(c['title'])} | {c['sev']} | {c['bugType'] or 'Logic'} | {c['unit']} | {c['tested'] or 'no'} | {c['origin']} |" for c in bugs)
ref_rows = '\n'.join(f"| {link(c)} | {esc(c['title'])} | {c['sev']} | {c['effort'] or 'N/A'} | {c['unit']} | {c['origin']} |" for c in refs)
opt_rows = '\n'.join(f"| {link(c)} | {esc(c['title'])} | {c['sev']} | {c['category'] or 'N/A'} | {c['unit']} |" for c in opts)
pr = [c for c in cat if c['origin'] != 'MAIN']
pr_rows = '\n'.join(f"| {link(c)} | {c['origin'].replace('PR-', '')} | {c['sev']} | {esc(c['title'])} |" for c in pr)
status_rows = '\n'.join(f"| {c['id']} | OPEN | — |" for c in cat)

text = f"""# Deep-dive analysis — whole monorepo, as it will be after the 2026-10-04 batch merge (2026-10-04)

- **Branch/commit:** `preview/integration-2026-10-04@80262a2f`. This is a local branch that was never pushed. It is `main@8ecb878f` with the 13 open PRs (#223–#235) merged in, plus the two Sprint 0 fixes from the dead-code audit. Details: [evidence/baseline.md](evidence/baseline.md).
- **Scope:** all 17 workspaces, plus root scripts and CI. **No source file was modified by the audit.**
- **Method:**
  1. Uncached gates and coverage, plus lead lists: 531 source files, 1,257 pattern hits, and the 192 source files changed in 345 commits since the 2026-09-16 deep dive.
  2. 27 slice reviewers read every non-test file of their slice, including each app's `wrangler.toml` and `package.json`.
  3. Four cross-PR contract reviewers traced: revision binding (#224/#225/#227), the retention cron and migration 0015 (#224), the Universalis limiter (#229), and the retired OAuth origin (#228).
  4. A verifier checked every candidate at `file:line` and tagged its origin, either already on `main` or introduced by an open PR. It checked the dead-code catalog for superseded code and the 2026-09-16 rejections for repeats.
  5. An independent skeptic re-derived every bug graded MEDIUM or above. It refuted none, kept 1 HIGH and 47 MEDIUM, and moved 22 MEDIUM to LOW.
  6. A completeness critic found 8 gaps; a gap sweep closed them.
  7. 266 verdicts: 201 confirmed, 63 rejected, 2 superseded. Duplicates found from several slices were merged into one finding each.
- **Totals: {len(cat)} findings.**
  - **{len(bugs)} BUG:** {n('HIGH')} HIGH, {n('MEDIUM')} MEDIUM, {n('LOW')} LOW. Of these, {sum(1 for c in bugs if c['kind'] == 'UNTESTED')} are untested behaviour.
  - **{len(refs)} REFACTOR** and **{len(opts)} OPT.**
  - **{len(pr)} introduced by open PRs,** all LOW or refactor; the rest are already on `main`. None is CRITICAL.

## Decide before tomorrow's merge

**No finding from this audit blocks the batch merge:**
- every HIGH and MEDIUM finding is already on `main`;
- the eight PR-origin findings are LOW or refactor.

**Two cheap text fixes are worth making inside their PRs before you merge them.** They are only recommended; nothing has been pushed.
- **BUG-063 (#224):** the presets-api 2.4.0 changelog intro says "No schema change and no migration". Its own Rollout section marks hand-running migration 0015 as **Required**. Whoever deploys from the intro would skip the migration.
- **BUG-053 (#225):** the moderation bot's footer still advertises the removed `reject <id> <reason>` option, and a test pins it.

**The other six PR-origin items can wait for their unit's sprint:**
- BUG-039 (#229): an untested multiplier;
- BUG-052, BUG-054 (#225): a concurrent-click refresh race, and a stale-deploy 404. The 404 case is covered by the documented deploy order;
- BUG-066, BUG-067 (#224): retention-job errors are logged but report success, and an identity re-key has no self-guard;
- REFACTOR-001: the review custom_id grammar is copied into three units.

**A question only you can answer.** Three workers in this batch still route a retired `xivdyetools.projectgalatine.com` hostname. Those route lines are already on `main`; merging these PRs only triggers the production deploys that re-apply them.

| Worker | Hostname | Route | Merged in |
|---|---|---|---|
| api-worker | `proxy.` | `wrangler.toml:110` | #229 |
| presets-api | `api.` | `:72` | #224 |
| moderation-worker | `moderation-bot.` | `:72` | #225 |

- **What the runbook says:** `docs/operations/DOMAIN_DEPRECATION.md` records `auth.`, `bot.` and the apex as removed. It says `api.` and `moderation-bot.` remain (2026-10-04), and records no step on `proxy.`.
- **The open question:** whether anything, `proxy.` especially, was removed in the Cloudflare dashboard after that note.
- **If one was,** a merge re-attaches it, because `wrangler deploy` attaches every custom domain its config lists. It might instead fail if the zone is gone; the repo cannot tell which.
- **If none was,** merging changes nothing.
- Details: [evidence/review-contract-oauth-origin.md](evidence/review-contract-oauth-origin.md).

| ID | PR | Sev/Pri | Finding |
|---|---|---|---|
{pr_rows}

## Catalog

### BUG

| ID | Title | Sev | Type | Deploy unit | Tested? | Origin |
|---|---|---|---|---|---|---|
{bug_rows}

### REFACTOR

| ID | Title | Pri | Effort | Deploy unit | Origin |
|---|---|---|---|---|---|
{ref_rows}

### OPT

| ID | Title | Impact | Category | Deploy unit |
|---|---|---|---|---|
{opt_rows}

### Superseded by the 2026-10-04 dead-code audit

| Candidate | Superseded by | Why |
|---|---|---|
| copy-hex clipboard `.then` without `.catch` in swatch/gradient | `2026-10-04-dead-code/DEAD-003` | the `copy-hex` context action is never emitted; DEAD-003 removes the handler |
| `EMPTY_STATE_PRESETS.noSearchResults` behaviour | `2026-10-04-dead-code/DEAD-008` | test-only preset; DEAD-008 removes it |

## Status basis

Nothing was fixed during the analysis; every row is OPEN. The audit modified no source file.

## Positive controls

Verified at the commit and not worth re-filing next time. Per-slice detail is in `evidence/review-*.md`.

- **Character names never leave the device:**
  - web-app's resolve request sends only gear model keys and the glasses id;
  - `/glamour` and `/swatch` never destructure the nickname;
  - the glamour `.md` export and its file name carry no name;
  - parse-error text is sanitized before it reaches a public embed.
  - **Exception, disclosed in PRIVACY.md:** on-device collection saves can keep a nickname-derived record name. Collection exports and their file names then carry it.
- **The revision-bound moderation flow is sound end to end:**
  - presets-api's conditional UPDATE binds revision and status, with a `changes()`-gated audit row in one batch;
  - the AFTER trigger cannot recurse;
  - moderation-worker has one strict parser, and every legacy or 409 click refreshes and never acts.
- **The #224 retention cron is wired as claimed:**
  - production-only (`[env.production.triggers]`, pinned by a test);
  - `allSettled` inside `waitUntil`;
  - timestamp formats match each column's writers.
- **The #229 limiter contract matches both `wrangler.toml` blocks.** Namespace ids are unique account-wide, the service scope is detected the same way as in `/v1` middleware, and a binding typo fails a test.
- **#228 removed the retired origin** from the shared authorize/callback allowlist, and a test asserts no `projectgalatine` origin in production.
- **OAuth:** the state HMAC is constant-time with `exp` enforced; S256 PKCE binds to the signed state before any upstream call; JWTs are pinned to HS256 with claim types validated.
- **Edge hardening:** every api-worker upstream fetch has `redirect: 'manual'` and a 10 s timeout, and streaming body caps hold. image-worker's pre-decode dimension gate fails closed.
- **Committed core data is byte-equivalent to the generator's output:**
  - committed core locale JSON matches `build-locales.ts` output, with all 125 ids in all 6 locales;
  - schema-v2 dye data is consistent: consolidation groups, metallic set and the frozen facewear map.
- **Teardown:** every subscription and listener in the v4 shell, sidebar, drawer and header is torn down; `v4-layout` navigation sequencing guards after every await.
- **CI gate:** `check-worker-logs.ts` is fail-closed and thorough, and all four repo gates exit 0 at this commit.

## Rejected suspicions

All 63 rejections are in [evidence/verdicts.tsv](evidence/verdicts.tsv), each with its reason. These are the ones most likely to be re-chased:

- **Decided behaviour, not defects:**
  - **Disclosed in PRIVACY.md:**
    - a file loaded in Swatch is sent for name resolution when the Glamour Reader opens;
    - on-device saves fall back to the character nickname.
  - **Documented elsewhere:**
    - the lazy write-path prunes in presets-api stay beside the cron;
    - Pages middleware runs on every request;
    - the Discord service bindings are shared between dev and production.
- **Unreachable in production:**
  - `DyeGrid` and `CollapsiblePanel` paths that the only mount path (`v4-layout.ts:600-706`) never builds;
  - image-worker's null-JSON `/extract` (no routes, service binding only);
  - the bot editing a pending preset (presets-api returns 404 first).
- **Misread runtime:**
  - a non-Latin1 `X-User-Discord-Name` header does not throw on workerd (probed with miniflare);
  - a listener exception in jsdom does fail the run (probed with a temporary repro test).
- **Already rejected in earlier audits:**
  - per-IP limiter keys not bucketing IPv6 /64 (2026-08-29 security);
  - the retired-domain routes still in `wrangler.toml`: the runbook's documented order is to delete the route line, deploy, then remove the dashboard domain. They stay a question for you, above.
- **Earlier deep-dive fixes that hold:** these were re-checked and still hold:
  - modal-stack listener re-binding;
  - the preset vote-check generation guard;
  - `v4-layout` navigation sequencing;
  - the OAuth state and return-path handling in `auth-service`;
  - the preset-edit baseline;
  - swatch's colours request versioning.

## Recommendations

1. **Make `ConfigController` the single owner of tool settings.** BUG-001 (HIGH), BUG-019, BUG-022, BUG-027 and BUG-012 are one design gap: each tool keeps local copies that a full-config broadcast overwrites, or that it never seeds. Test with a real controller; the current mocks never fire `subscribe`, which is why none of this was caught.
2. **Every tool suite should mount against a non-default persisted config and fire one language switch** (BUG-011, BUG-076). Four tools empty their results on a language switch today (BUG-021).
3. **Run `test:coverage` in CI, or drop the thresholds that nothing enforces.** bot-logic sits at 88.38 % branches against its own 90 % (BUG-127).
4. **Pick one moderation-notification path** (BUG-004, BUG-003). Today the bot and the presets-api webhook both post for bot submissions, and the webhook renders every edit as new.
5. **Harden request handling worker-wide.** Each of these is a small shared helper:
   - **Null JSON bodies:** they reach handlers as a 500 (BUG-056, BUG-064).
   - **Limiter keys:** oauth's `/auth/*` limiter keys on the raw percent-encoded path while Hono routes on the decoded one (BUG-007).
   - **Content-Type case:** a case-sensitive check skips worker-kit's JSON depth guard (BUG-149).
6. **Share the review `custom_id` grammar** (REFACTOR-001) through one package, or add a parity test across the three units, before the next format change.
7. **Keep asking "what edit would make this test fail?"** This round added BUG-071, BUG-075, BUG-138, BUG-139 and BUG-144 to the 2026-09-16 list.
8. **Run the whole-graph gate on a trial merge of each batch,** as the dead-code audit recommends: the affected-only CI filter cannot see cross-unit contracts.

## Remediation status

| ID | Status | Commit |
|---|---|---|
{status_rows}

## Next steps

[REMEDIATION_PLAN.md](REMEDIATION_PLAN.md) is one merged plan for this catalog and the 2026-10-04 dead-code catalog. It supersedes that audit's `CLEANUP_PLAN.md`.
- Correctness first: the HIGH and the MEDIUM bugs.
- One deploy unit per sprint, with the dead-code cleanups folded into their unit's sprint.
- Package publishes before their consumers' deploys.
- Structural refactors last.

Nothing is changed until the maintainer approves the plan.
"""
(OUT / 'DEEP_DIVE_REPORT.md').write_text(text, encoding='utf-8', newline='\n')
print('report written:', len(cat), 'rows;', len(pr), 'PR-origin')
