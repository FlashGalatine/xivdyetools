"""Write REMEDIATION_PLAN.md: one merged plan for the 2026-10-04 deep-dive and dead-code catalogs
(remediation-planner, merged mode). Asserts every finding of both catalogs is placed exactly once."""
import json
import pathlib

OUT = pathlib.Path('docs/audits/2026-10-04-deep-dive')
dd = {c['id']: c for c in json.loads((OUT / 'evidence/catalog.json').read_text(encoding='utf-8'))}
dc = {c['id']: c for c in json.loads(pathlib.Path('docs/audits/2026-10-04-dead-code/evidence/catalog.json').read_text(encoding='utf-8'))}


def esc(s):
    return (s or '').replace('|', '\\|')


def row(i):
    if i in dd:
        c = dd[i]
        sev = c['sev'] if c['prefix'] == 'BUG' else f"{c['prefix'].title()} {c['sev']}"
        if c['kind'] == 'UNTESTED':
            sev += ' (untested)'
        return f"| [{i}](findings/{i}.md) | deep-dive | {sev} · {c['origin']} | {esc(c['title'])} |"
    c = dc[i]
    return (f"| [dead-code/{i}](../2026-10-04-dead-code/findings/{i}.md) | dead-code | Conf {c['conf']} / Blast {c['blast']} · {c['rec']} | "
            f"{esc(c['title'])} |")


def table(ids):
    return '\n'.join(['| ID | Source | Sev/Pri · Origin (deep-dive) or Conf/Blast · Rec (dead-code) | Item |', '|---|---|---|---|'] + [row(i) for i in ids])


B = lambda *n: [f'BUG-{x:03d}' for x in n]
D = lambda *n: [f'DEAD-{x:03d}' for x in n]
R = lambda *n: [f'REFACTOR-{x:03d}' for x in n]
O = lambda *n: [f'OPT-{x:03d}' for x in n]
RNG = lambda a, b: list(range(a, b + 1))

S0 = B(63, 53) + D(1, 2)
SPRINTS = [
    ('web-app: tool settings have one owner (the HIGH)',
     'BUG-001 is the anchor. Each tool keeps local copies of its settings, and `ConfigController` broadcasts a full config over them, or never seeds them at mount. Fix it once:\n'
     '- seed every tool from `getConfig()`;\n'
     '- route rail and slot picks through the controller;\n'
     '- align the default tables.\n\n'
     'Then add the test BUG-011 asks for: mount against a non-default persisted config with a real controller.',
     B(1, 19, 22, 27, 12, 23, 24, 11, 78, 79),
     'web'),
    ('web-app: presets and collections',
     '**The anchor is BUG-029:** `reconcileTombstones` marks live saved presets "Removed by its author".\n\n'
     '**Also here:**\n'
     '- vote failures shown as "already voted";\n'
     '- a stale response cache;\n'
     '- a delete failure reported as success;\n'
     '- collection manager refresh;\n'
     '- and the preset-tool test gap (BUG-026).\n\n'
     '**Dead code:** the preset-service removals from the dead-code catalog land here, after the fixes in the same files.',
     B(29, 30, 31, 32, 26, 17, 16, 101, 108, 109, 110, 102, 82, 84) + O(8) + D(12, 13, 14, 15, 16),
     'web'),
    ('web-app: tool correctness',
     '**Language switch:** the switch empties four tools (BUG-021), and no test fires it (BUG-076).\n\n'
     '**Stale deep links:** a stale deep link overrides the user\'s choice (BUG-013, BUG-014).\n\n'
     '**Matching and runs:**\n'
     '- budget runs without a supersede guard;\n'
     '- the comparison tier disagrees with its verdict;\n'
     '- a gradient pinned step can repeat a dye;\n'
     '- swatch filtering returns too few matches.\n\n'
     '**Keyboard:** the palette drawer cannot be used from the keyboard.\n\n'
     '**Boot:** OPT-001 removes a dev-only network probe from boot.',
     B(21, 76, 13, 14, 15, 18, 20, 25, 28) + O(1),
     'web'),
    ('presets-api: dye validation, null bodies, retention signal',
     '**BUG-010:** repeated dye ids bypass the 3-dye floor and the duplicate signature.\n\n'
     '**From #224, after the merge:**\n'
     '- BUG-066: make a failed retention sweep visible;\n'
     '- BUG-067: add a self-guard to the identity re-key.\n\n'
     '**BUG-003, payload half:** this sprint also carries the presets-api half of BUG-003, which is scheduled with discord-worker.\n'
     '- Add only an edit flag to the webhook payload; `previous_values` is already sent.\n'
     '- The change is additive, so it ships here, before discord-worker reads it.\n\n'
     '**Dead code:** the presets-api cleanups follow the fixes.',
     B(10, 64, 65, 66, 67, 68, 69) + D(33, 34, 31, 32),
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-presets-api` → merge → `deploy-presets-api.yml` (no D1 migration)'),
    ('discord-worker: one moderation-notification path, KV failure handling',
     '**BUG-004:** the bot and the presets-api webhook both post for bot submissions.\n'
     '- Drop the bot-side posts.\n'
     '- presets-api needs no change.\n'
     '- Check it with the moderation channel on a flagged `/preset submit` and `/preset edit`.\n\n'
     '**BUG-003:** the webhook renders every edit as new.\n'
     '- Map the presets-api sprint\'s edit flag to `kind: \'edit\'`, with the original taken from the `previous_values` already in the payload.\n'
     '- That presets-api change must be deployed first.\n\n'
     '**Also here:**\n'
     '- a world validation awaited inside the 3-second ack;\n'
     '- favourites and preferences writes that overwrite after a swallowed read failure;\n'
     '- the dead registry field.',
     B(4, 3, 2, 5, 6, 41, 42, 43, 44, 45, 46, 47, 48, 49) + R(2) + O(3, 4, 5) + D(24),
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-discord-worker` → merge → `deploy-discord-worker.yml` (CI runs `register-commands`; no command shape changes)'),
    ('oauth: limiter keying, null bodies',
     'BUG-007: decode the path before the `/auth/*` limiter keys it, then add the tests BUG-055 asks for. BUG-056 turns a null JSON body into a 400. BUG-057 filters null roster elements and empty names, falling back to the degraded login.',
     B(7, 55, 56, 57) + D(37, 36),
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-oauth-worker` → merge → `deploy-oauth.yml` (never a bare `wrangler deploy` by hand: it is production)'),
    ('og-worker: gradient card follows the requested algorithm',
     'BUG-009 and BUG-008: the gradient card ranks by a hard-coded ΔE and ramps in the wrong space. Also here: crawler parameters, the extractor algorithm, legacy `?algo=` spellings, cache-key fragmentation and resvg frees.',
     B(9, 8, 58, 59, 60, 61, 62) + O(6) + D(39, 40),
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker` → merge → `deploy-og-worker.yml` (bumping `CARD_VERSION` re-renders cached cards once; a bare deploy is the live beta)'),
    ('@xivdyetools/logger: redaction gaps (publish)',
     'BUG-140: context strings skip key=value redaction. BUG-141: `toJSON` objects log as `{}`. Plus a stale doc and a per-call Set rebuild.',
     B(140, 141) + O(10) + R(7),
     'bump `@xivdyetools/logger` (patch) → gate with `--filter=...@xivdyetools/logger` → merge → Actions publish'),
    ('@xivdyetools/core: blending, palette extraction, parser bounds (publish)',
     '**MEDIUM fixes:**\n'
     '- BUG-035: grey mixes get a hue neither input has.\n'
     '- BUG-036: palette extraction returns duplicate 0-pixel clusters.\n\n'
     '**Also here:** LOW parser and data fixes, plus two tests that cannot fail.\n\n'
     '**`build-locales.ts`:** BUG-128 is the generator, so fix the generator, never the generated JSON.',
     B(35, 36, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139),
     'bump `@xivdyetools/core` (minor) → `pnpm turbo run build type-check lint test --filter=...@xivdyetools/core` (all consumers) → merge (consumer deploy workflows fire on `packages/core/**`) → Actions publish'),
    ('@xivdyetools/svg: card text fidelity (publish)',
     'Rounding in the contrast tier, ellipsised step ranges, a sub-floor label, and the frame-budget gate\'s missing cards.',
     B(142, 143, 144, 145, 146),
     'bump `@xivdyetools/svg` (patch) → `pnpm turbo run build type-check lint test --filter=...@xivdyetools/svg` → merge → Actions publish'),
    ('@xivdyetools/bot-logic: input resolution and filtered matching (publish)',
     '**Fixes:**\n'
     '- BUG-034: an all-digit hex without `#` is read as a dye id.\n'
     '- BUG-033: filters applied after a capped search return "no match".\n\n'
     '**Coverage:** BUG-127. Restore the 90 % branch threshold by covering glamour\'s branches, and decide whether CI runs `test:coverage`.\n\n'
     '**Consumers:** discord-worker and stoat-worker pick the change up via `workspace:*`. The merge redeploys discord-worker through its path filter.',
     B(34, 33, 124, 125, 126, 127),
     'bump `@xivdyetools/bot-logic` (minor) → `pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic` → merge (redeploys discord-worker) → Actions "Publish Packages to npm"'),
    ('@xivdyetools/worker-kit: body guard and limiter edges (publish)',
     '**Fixes:**\n'
     '- BUG-149: a case-sensitive Content-Type check lets JSON skip the depth guard.\n'
     '- Rate-limit headers dropped on raw Responses.\n'
     '- Single-page KV resets.',
     B(149, 150, 151),
     'bump `@xivdyetools/worker-kit` (patch) → gate with `--filter=...@xivdyetools/worker-kit` → merge (oauth, presets-api, api-worker, image-worker and the bots redeploy) → Actions publish'),
    ('moderation-worker: review edge cases, then cleanup',
     '**From #225, after the merge:**\n'
     '- BUG-052: a losing concurrent click overwrites the winner\'s embed;\n'
     '- BUG-054: a stale-deploy 404 strips live buttons.\n\n'
     '**Dead code:** the moderation-worker cleanups follow, safest first.\n'
     '- `dead-code/DEAD-029`, the legacy ban suffix, goes last.\n'
     '- It needs the test-fixture rewrite the finding describes.',
     B(50, 51, 52, 54) + D(27, 28, 25, 26, 30, 29),
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker` → merge → `deploy-moderation-worker.yml` (commands are registered by hand; shapes unchanged)'),
    ('api-worker: telemetry double charge, param parsing, limiter test',
     'BUG-037: each telemetry beacon is charged twice. BUG-039 is from #229: pin the multiplier to the binding. OPT-002 moves the 3.4 MB acquisition tables off the cold start.',
     B(37, 38, 39, 40) + O(2) + D(35),
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-api-worker` → merge → `deploy-api-worker.yml`'),
    ('test-utils: D1/KV mock fidelity, then cleanup',
     'The mock fixes come first. Then the dead-code removals, ending with the self-referential integration suite (`dead-code/DEAD-041`).',
     B(147, 148) + D(42, 43, 44, 41),
     '`pnpm turbo run build type-check lint test --filter=...@xivdyetools/test-utils` (every consumer re-runs) → merge; private, so no publish and no deploy'),
    ('root (CI/scripts): workflow and gate fixes',
     '**Fixes:**\n'
     '- BUG-152: CI concurrency cancels main-branch and nightly runs.\n'
     '- BUG-153: deploy path filters omit the lockfile.\n'
     '- BUG-154: the publish loop keeps going after a failure.\n'
     '- Two gate-script fixes.\n\n'
     '**Then:** stale docs and two root config lines.',
     B(152, 153, 154, 155, 156) + R(8, 9) + D(46, 45),
     '`pnpm install --frozen-lockfile`, the whole-graph gate, `pnpm test:scripts`, `pnpm dead-code:check`, `pnpm docs:check-links` → merge (deploys nothing)'),
    ('image-worker: stale path alias',
     'Config only; the bundle is unchanged.',
     D(38),
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-image-worker` → merge → `deploy-image-worker.yml`'),
    ('web-app: remaining LOW fixes',
     'Tool, shell, service and glamour LOWs. Most are one-line guards or listener teardown.',
     B(74, 75, 77, 80, 81, 83, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 103, 104, 105, 106, 107, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123) + O(7, 9),
     'web'),
    ('web-app: dead-code cleanup',
     'The rest of the dead-code catalog\'s web-app entries. Each cascade is the next commit after its trigger, because web-app\'s knip gate fails on the orphaned exports in between: dead-code/DEAD-009 and dead-code/DEAD-010 after dead-code/DEAD-008. dead-code/DEAD-003, the context-action vocabulary, goes last.',
     D(4, 5, 6, 11, 7, 17, 18, 19, 20, 23, 8, 9, 10, 21, 22, 3),
     'web'),
    ('stoat-worker (parked)',
     'P3. Fix only if Stoat is resumed; otherwise these go with the app if it is archived (see `docs/research/discord-alternatives/07-2026-10-refresh.md`).',
     B(70, 71, 72, 73),
     '`pnpm turbo run build type-check lint test --filter=xivdyetools-stoat-worker` → merge (no deploy workflow)'),
    ('auth: doc comment',
     'A comment-only fix. It rides with the next auth change; no publish is needed for it alone.',
     R(6),
     'gate with `--filter=...@xivdyetools/auth` → merge'),
    ('Structural: share the review custom_id grammar (terminal)',
     'REFACTOR-001: one module for the grammar and status list, consumed by presets-api, moderation-worker and discord-worker, or a parity test across them. One publish, then one deploy per consumer.',
     R(1),
     'publish the host package → presets-api, moderation-worker and discord-worker each in their own deploy, in the documented order (presets-api first)'),
    ('Structural: one dyeable-slot set (terminal)',
     'REFACTOR-004: core exports the dyeable-slot set, and web-app imports it.',
     R(4),
     'core publish → web-app deploy'),
    ('Structural: svg ledger constants (terminal)',
     'REFACTOR-003: svg exports the ledger geometry, and discord-worker\'s budget calculator imports it.',
     R(3),
     'svg publish → discord-worker deploy'),
    ('Structural: split swatch-tool and gradient-tool (terminal, last)',
     'REFACTOR-005: the two largest files in the repo duplicate their desktop and mobile selector code. This goes last, because every web-app sprint above touches them.',
     R(5),
     'web'),
]
WEB = ('`pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. '
       'Recount coverage after any removal; never lower web-app\'s ratchet. Merge → `deploy-web-app.yml`.')
KEEP = D(*RNG(47, 64))

placed = S0 + [i for s in SPRINTS for i in s[2]] + KEEP
missing = (set(dd) | set(dc)) - set(placed)
dupes = {i for i in placed if placed.count(i) > 1}
assert not missing and not dupes, (sorted(missing), sorted(dupes))

parts = [f"""# Remediation Plan — 2026-10-04 (deep-dive + dead-code, merged)

> [!NOTE]
> **Superseded on 2026-10-05 by the merged [REMEDIATION_PLAN.md](../2026-10-04-i18n/REMEDIATION_PLAN.md)** of the same preview's i18n audit.
> - It schedules every finding below, with the same IDs, alongside the i18n catalog's 45.
> - Its sprints keep these rows unchanged, with i18n sprints inserted, so every sprint number from 2 on has moved.

**Sources:**
- [DEEP_DIVE_REPORT.md](DEEP_DIVE_REPORT.md): {len(dd)} findings.
- [2026-10-04-dead-code/DEAD_CODE_REPORT.md](../2026-10-04-dead-code/DEAD_CODE_REPORT.md): {len(dc)} findings.
- **ID convention:** deep-dive IDs are bare; dead-code IDs are qualified as `dead-code/DEAD-NNN`. Both catalogs come from the same preview branch (`main` plus the 13 open PRs).

**This plan supersedes** the dead-code audit's `CLEANUP_PLAN.md`. Its sprints are folded in here, one unit at a time.

**Status basis:** {len(dd) + len(dc)} total.
- 1 fixed: dead-code/DEAD-001, in #225, not merged.
- {len(dd) + len(dc) - 1 - len(KEEP)} outstanding.
- 2 deep-dive candidates superseded by dead-code removals (listed below).
- {len(KEEP)} KEEP.
- 0 need rotation.

**Ordering:**
1. Sprint 0 holds the decisions due before tomorrow's batch merge. Nothing is pushed without your yes.
2. Correctness first: the HIGH, then the units carrying MEDIUM bugs, then LOW-only units.
3. One deploy unit per sprint, with two exceptions: the four terminal structural sprints, each a publish followed by its consumers' deploys.
   - Dead-code cleanups ride in their unit's sprint, after that unit's fixes.
4. Package publishes follow the dependency graph: logger, core, svg, bot-logic, then worker-kit.
   - `workspace:*` becomes an exact version at publish, so a dependent must publish after its dependencies.
   - Consumers redeploy through their path filters on merge.
5. Structural refactors last.

**Conflicts (merged mode):**
- Two deep-dive candidates sat in code a dead-code entry removes, so the removal wins (*Superseded* below).
- One set of fixes shares files with removals: the preset services in Sprint 2. There the fixes land first, then the removals.
- No other overlap.
"""]
parts.append(f"""## Sprint 0 — Before the batch merge (your decision)

**Merging tomorrow is safe from both audits' point of view:**
- no finding in the batch is CRITICAL, HIGH or MEDIUM;
- the cross-PR test failure is already fixed in #224 (`10a1cb77`);
- the preview passes 62/62.

{table(S0)}

- **BUG-063 (#224) and BUG-053 (#225):** recommended text-only fixes, to make inside the PRs before merging if you agree. Otherwise, correct them in the presets-api and moderation-worker sprints.
- **dead-code/DEAD-001:** already applied in #225 (`ea264d49`).
- **dead-code/DEAD-002 (#227):** optional; if deferred, it joins the discord-worker sprint.

**Question:** are `proxy.`, `api.` and `moderation-bot.xivdyetools.projectgalatine.com` still attached in Cloudflare?
- **If so:** merging #229, #224 and #225 changes nothing.
- **If you removed them in the dashboard:** those merges re-attach them. Delete the route lines first, per `docs/operations/DOMAIN_DEPRECATION.md`.
""")
for n, (title, blurb, ids, ends) in enumerate(SPRINTS, 1):
    parts.append(f"## Sprint {n} — {title}\n\n{blurb}\n\n{table(ids)}\n\n**Ends with:** {WEB if ends == 'web' else ends}\n")
parts.append(f"""## Superseded findings

| Candidate | Superseded by | Why |
|---|---|---|
| copy-hex clipboard `.then` without `.catch` (swatch/gradient) | dead-code/DEAD-003 | the `copy-hex` action is never emitted; the removal deletes the handler |
| `EMPTY_STATE_PRESETS.noSearchResults` behaviour | dead-code/DEAD-008 | a test-only preset; the removal deletes it |

## KEEP register

These are not scheduled; the reasons and revisit triggers are in each finding. The package-major backlog is in the dead-code audit's report.

{table(KEEP)}

## Standing guidance

- **Verify first:** check each finding's evidence against the code before fixing; findings are leads. Re-grep before any removal, and grep `apps/stoat-worker` by hand for package exports.
- **One PR per sprint**, as with the security sprints. Make one commit per task, or per sprint when it is tiny. Stage only your own paths with `git commit --only -- <paths>`.
- **Gate every sprint boundary** (`release-mechanics.md` → *Standing verification gate*). Before merging a batch, run the whole-graph gate on a trial merge; the 2026-10-04 preview showed why.
- **Changelogs and versions:** every touched unit gets a version bump and a `CHANGELOG.md` entry. Player-visible web-app or bot fixes also get a root `CHANGELOG-laymans.md` entry, committed on its own.
- **Tracking:** mark executed sprints in their heading **✅ COMPLETED <date> <commits>**, with **Deploy needs:**, and mirror the status in each finding and in both reports' status tables.
""")
(OUT / 'REMEDIATION_PLAN.md').write_text('\n'.join(parts), encoding='utf-8', newline='\n')
print('plan written:', len(placed), 'placed;', len(SPRINTS), 'sprints after Sprint 0')
