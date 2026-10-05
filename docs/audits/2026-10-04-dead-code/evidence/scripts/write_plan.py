"""Write CLEANUP_PLAN.md (remediation-planner, standalone dead-code mode) from evidence/catalog.json."""
import json
import pathlib

OUT = pathlib.Path('docs/audits/2026-10-04-dead-code')
cat = {c['id']: c for c in json.loads((OUT / 'evidence/catalog.json').read_text(encoding='utf-8'))}


def esc(s):
    return s.replace('|', '\\|')


def table(ids, extra=None):
    out = ['| ID | Conf/Blast · Semver | Rec | Item |', '|---|---|---|---|']
    for i in ids:
        c = cat[i]
        item = esc(c['title'])
        if extra and i in extra:
            item += f" **{extra[i]}**"
        out.append(f"| [{i}](findings/{i}.md) | {c['conf']}/{c['blast']} · {c['semver']} | {c['rec']} | {item} |")
    return '\n'.join(out)


SPRINTS = [
    ('Sprint 1 — packages/test-utils: test-only helpers and the self-referential integration suite',
     'The safest place to start: a private package with no npm consumers and no deploy, whose every change is caught by the dependents\' test suites. DEAD-041 is the anchor (795 lines); do it last in the sprint, after its coverage check.',
     ['DEAD-042', 'DEAD-043', 'DEAD-044', 'DEAD-041'], {},
     '`pnpm turbo run build type-check lint test --filter=...@xivdyetools/test-utils` (every app that uses test-utils re-runs its tests), then `pnpm dead-code:check` (the test-only exemption count drops from 26 to 25) and `pnpm docs:check-links`. Test-utils is private, so there is no publish. Merging it deploys nothing, because no deploy workflow filters on `packages/test-utils/**`.'),
    ('Sprint 2 — root (CI/scripts): turbo task and stale override',
     'Two root-config lines. DEAD-045 changes the lockfile\'s overrides block, so regenerate it in the same commit.',
     ['DEAD-046', 'DEAD-045'], {},
     '`pnpm install` (regenerates the `pnpm-lock.yaml` overrides block), then `pnpm install --frozen-lockfile`, then the whole-graph gate `pnpm turbo run build type-check lint test`, `pnpm dead-code:check` and `pnpm docs:check-links`. Merging deploys nothing; no deploy workflow filters on root files.'),
    ('Sprint 3 — image-worker: stale path alias',
     'Test/config only; the bundle does not change.',
     ['DEAD-038'], {},
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-image-worker` → merge → `deploy-image-worker.yml` (redeploys an identical bundle).'),
    ('Sprint 4 — oauth: stale coverage excludes, test-only decodeJWT',
     'DEAD-037 is config. DEAD-036 removes a test-only helper next to the live JWT code; follow its caution note.',
     ['DEAD-037', 'DEAD-036'], {},
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-oauth-worker` → merge → `deploy-oauth.yml`. Remember that a bare `wrangler deploy` is production on oauth; let the workflow deploy.'),
    ('Sprint 5 — api-worker: redundant test re-export',
     'One line in `tests/test-utils.ts`.',
     ['DEAD-035'], {},
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker` → merge → `deploy-api-worker.yml`.'),
    ('Sprint 6 — og-worker: unread crawler field, stale path alias',
     'Both LOW blast; og-worker\'s own knip (`lint`) confirms nothing else depended on them.',
     ['DEAD-039', 'DEAD-040'], {},
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker` → merge → `deploy-og-worker.yml`. A bare `deploy` here is the live beta, so let the workflow deploy.'),
    ('Sprint 7 — discord-worker: unused registry field',
     'The two-line `deprecated` field. (DEAD-002, the other discord-worker item, is handled in Sprint 0 or folds in here if it was deferred.)',
     ['DEAD-024'], {},
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker` → merge → `deploy-discord-worker.yml` (CI also runs `register-commands`; the command shapes do not change).'),
    ('Sprint 8 — presets-api: test-only response helper, deprecated re-exports, dead error codes',
     'Do DEAD-033 and DEAD-034 first, then DEAD-031. DEAD-032 is REFACTOR FIRST: make `ErrorCode.BAD_REQUEST` live (`body-validation.ts:73` still writes the literal), and delete `DATABASE_ERROR` together with its row in `docs/architecture/api-contracts.md`.',
     ['DEAD-033', 'DEAD-034', 'DEAD-031', 'DEAD-032'], {},
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api` → merge → `deploy-presets-api.yml`. No D1 migration.'),
    ('Sprint 9 — moderation-worker: test-only wrappers, translator fallback, older orphan strings, legacy ban parsing',
     'Safest first. DEAD-029 (MEDIUM confidence) comes last. It removes parsing of the old base64-username suffix in `ban_confirm_`/`ban_reason_modal_` custom_ids. An ephemeral message held open for weeks cannot be fully excluded, but that click then fails gracefully ("Invalid button/modal data"); it never bans the wrong account. Most of its work is rewriting about 15 test fixtures that carry the suffix.',
     ['DEAD-027', 'DEAD-028', 'DEAD-025', 'DEAD-026', 'DEAD-030', 'DEAD-029'], {},
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker` → merge → `deploy-moderation-worker.yml` (commands are registered by hand by the maintainer; nothing changes in the command shapes).'),
    ('Sprint 10 — web-app: dead CSS, orphan strings, unused and test-only service methods, stale tests',
     'The largest sprint. Order:\n'
     '1. CSS and locale keys (NONE/LOW, easy to eyeball).\n'
     '2. The services.\n'
     '3. The test-only triggers, each followed by its cascade as the next commit:\n'
     '   - DEAD-008, then DEAD-009 and DEAD-010;\n'
     '   - DEAD-013 and DEAD-015, then DEAD-016.\n'
     '4. The whole stale test files.\n'
     '5. DEAD-003 last: the context-action vocabulary across five tools, REMOVE WITH CAUTION.\n\n'
     'Why the cascades share the trigger\'s pull request: the planner\'s rule keeps cascades in a later sprint, so that the trigger\'s removal is proven green first. Here that cannot work. Web-app\'s knip gate fails on the orphaned icon exports the moment DEAD-008 lands without DEAD-009. So each cascade is its own commit, gated together with its trigger.\n\n'
     'After DEAD-012, re-check the `GetPresetsOptions.category` branches that DEAD-014 names as a follow-on. DEAD-023 must land before any future core removal of `getLabel` (KEEP DEAD-049).',
     ['DEAD-004', 'DEAD-005', 'DEAD-006', 'DEAD-011', 'DEAD-007', 'DEAD-012', 'DEAD-014', 'DEAD-017', 'DEAD-018',
      'DEAD-019', 'DEAD-020', 'DEAD-023', 'DEAD-008', 'DEAD-009', 'DEAD-010', 'DEAD-013', 'DEAD-015', 'DEAD-016',
      'DEAD-021', 'DEAD-022', 'DEAD-003'],
     {'DEAD-009': '(next commit after DEAD-008)', 'DEAD-010': '(with DEAD-009)', 'DEAD-016': '(next commit after DEAD-013/015)'},
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`, plus the Playwright spec that DEAD-016 edits (`e2e/preset-gallery-api.spec.ts`).\n\nCheck the coverage ratchet: removing covered dead code shifts the percentages, so recount, and never lower web-app\'s thresholds.\n\nThen merge → `deploy-web-app.yml`.'),
]

KEEP = ['DEAD-047', 'DEAD-048', 'DEAD-049', 'DEAD-050', 'DEAD-051', 'DEAD-052', 'DEAD-053', 'DEAD-054', 'DEAD-055',
        'DEAD-056', 'DEAD-057', 'DEAD-058', 'DEAD-059', 'DEAD-060', 'DEAD-061', 'DEAD-062', 'DEAD-063', 'DEAD-064']

CORE = sum(cat[i]['src'] for i in ('DEAD-047', 'DEAD-048', 'DEAD-049', 'DEAD-051', 'DEAD-052'))
placed = ['DEAD-001', 'DEAD-002'] + [i for s in SPRINTS for i in s[2]] + KEEP
assert sorted(placed) == sorted(cat), set(cat) ^ set(placed)
assert len(placed) == len(set(placed))

parts = [f"""# Cleanup Plan — 2026-10-04 dead-code audit

**Sources:** [DEAD_CODE_REPORT.md](DEAD_CODE_REPORT.md), 64 findings.

**Status basis:** 64 total:
- 0 fixed;
- 46 outstanding: 2 of them introduced by open PRs, 44 already on `main`;
- 0 superseded;
- 18 KEEP;
- 0 need rotation.

**Ordering:**
1. Fix the two PR-introduced items inside their open PRs, before the batch merge (Sprint 0).
2. One deploy unit per sprint after the batch merge.
3. Confidence × Blast: the safest first, so that the early sprints prove the gates catch breakage (test-utils, root config, then the small workers, then the large web-app sprint).
4. Cascades come after their trigger. In web-app they are the next commit in the same pull request, because the knip gate cannot be green between them (Sprint 10 explains).
5. MAJOR package removals are not scheduled: they are KEEP until each package's next planned major.

**Other catalogs:** the open 2026-10-03 security plan was checked for overlap.
- Its code sprints are all in the open PRs, which this audit already read merged.
- Its remaining items are GitHub settings and hand-run steps.
- No dead-code finding touches code a security fix still has to change, so there are no fix-vs-remove conflicts and nothing is superseded.

**Execution:** one PR per sprint, as with the security sprints. Sprints 3–7 are one or two small items each, and can be done in one sitting as separate PRs.

**Not scheduled here:** a pending preset submitted through the bot produces two moderation posts. One comes from the bot's direct post; the other is the revision-bound post from presets-api's webhook. This is a behaviour issue already on `main` (see the report's *Rejected suspicions*), not dead code, and needs its own follow-up.

## Sprint 0 — Before the batch merge, inside the open PRs — ✅ APPLIED 2026-10-04 (`10a1cb77` in #224, `ea264d49` in #225; DEAD-002 left to the maintainer)

These come from the preview branch, not from `main`. Fix them in the PRs that introduced them, so `main` never carries them.

| ID / item | PR | Action |
|---|---|---|
| (gate) moderation-worker contract test fails with #224 | #224 | **Blocker.** Reword the comment at `apps/presets-api/src/handlers/moderation.ts:390` so it contains no `as <word>`. Optionally, anchor `moderation-stats-contract.test.ts` to the stats statement in #225. Details: [evidence/preview-branch.md](evidence/preview-branch.md). |
| [DEAD-001](findings/DEAD-001.md) | #225 | Delete the five orphaned `preset.moderation.*` strings from `bot-i18n.ts:53-57`. |
| [DEAD-002](findings/DEAD-002.md) | #227 | **Optional.** Drop the unread `author_discord_id` field and reshape the test fixture so the "ID is not rendered" assertion keeps its meaning. If deferred, it joins Sprint 7. |

**Ends with:** each PR's own gate, then a re-run of the full gate on a fresh preview merge of all 13 heads (`pnpm turbo run build type-check lint test --continue`). Expected result: 62/62.
"""]
for n, (title, blurb, ids, extra, ends) in enumerate(SPRINTS, 1):
    s = sum(cat[i]['src'] for i in ids)
    t = sum(cat[i]['test'] for i in ids)
    parts.append(f"## {title}\n\n{blurb} ({s} source + {t} test lines.)\n\n{table(ids, extra)}\n\n**Ends with:** {ends}\n")

parts.append("""## Superseded findings

None. No other open catalog overlaps this one (see *Other catalogs* above). The duplicates the audit found itself were merged before numbering. The completeness re-sweep independently re-confirmed six published-package items, kept as evidence in DEAD-050, DEAD-053, DEAD-054, DEAD-056, DEAD-058 and DEAD-059. It also re-confirmed one item each in DEAD-041 and DEAD-051. Overlapping deletions were each given a single owner: DEAD-008/009/010, DEAD-013/016 and DEAD-049/050.

## KEEP register

These are not scheduled. Each finding file gives the reason and the revisit trigger.

""" + table(KEEP) + """

**Package-major backlog.** When a package's next major is planned for its own reasons, fold its KEEP items into that one release: bump the major → merge → Actions "Publish Packages to npm", then one sprint per consumer deploy, as `release-mechanics.md` requires.

| Package | Items |
|---|---|
| `@xivdyetools/core` | DEAD-047, DEAD-048, DEAD-049, DEAD-051, DEAD-052 (about """ + f"{CORE:,}" + """ source lines) |
| `@xivdyetools/types` | DEAD-050 (after core drops `getToolName`), DEAD-058 |
| `@xivdyetools/logger` | DEAD-056, DEAD-057 |
| `@xivdyetools/worker-kit` | DEAD-054 (and the `@upstash/redis` dependency with it), DEAD-055 |
| `@xivdyetools/auth` | DEAD-059, DEAD-060 |
| `@xivdyetools/bot-logic` | DEAD-053 |

**App-level KEEPs:**
- DEAD-061: an accepted registry test hook.
- DEAD-062: a defensive Discord router branch.
- DEAD-063: public presets-api routes with possible outside callers.
- DEAD-064: parked Stoat leftovers, alongside 2026-09-15-dead-code/DEAD-019.

## Standing guidance

- **Verify before fixing:** check each finding's evidence against the code first; findings are leads. Re-grep every symbol immediately before `git rm` (`git grep -n -w <sym> -- . ':!docs/audits'`). Grep `apps/stoat-worker` by hand for anything exported by bot-logic, logger or types.
- **Commits and gates:** one commit per task, or per sprint when it is tiny, with the gate at every sprint boundary (`release-mechanics.md` → *Standing verification gate*). Stage only your own paths, with `git commit --only -- <paths>`.
- **Changelogs:** each touched unit's `CHANGELOG.md` gets an entry. Version bumps follow the repo's patch convention for internal cleanups. There is no player-facing change, so no `CHANGELOG-laymans.md`.
- **After each sprint,** re-run `pnpm dead-code:check` and root `pnpm exec knip`: removals can expose new test-only code.
- **Tracking:** mark executed sprints in their heading as **✅ COMPLETED <date> <commits>**, with **Deploy needs:**, and mirror it in each finding's `## Status` and the report's status table.
""")
(OUT / 'CLEANUP_PLAN.md').write_text('\n'.join(parts), encoding='utf-8', newline='\n')
print('plan written; placed', len(placed))
