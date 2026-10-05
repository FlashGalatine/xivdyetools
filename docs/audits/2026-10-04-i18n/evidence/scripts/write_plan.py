"""Write REMEDIATION_PLAN.md: one merged plan for the three 2026-10-04 catalogs — deep-dive, dead-code
and i18n (remediation-planner, merged mode). Built on the deep-dive's own generator
(`2026-10-04-deep-dive/evidence/scripts/write_plan.py`): its sprints are kept verbatim, with the i18n
sprints inserted and the i18n rows added to the units they belong to. Asserts every finding of all
three catalogs is placed exactly once. Run from the repo root."""
import json
import pathlib
import re

OUT = pathlib.Path('docs/audits/2026-10-04-i18n')
DD_DIR = pathlib.Path('docs/audits/2026-10-04-deep-dive')
DC_DIR = pathlib.Path('docs/audits/2026-10-04-dead-code')
dd = {c['id']: c for c in json.loads((DD_DIR / 'evidence/catalog.json').read_text(encoding='utf-8'))}
dc = {c['id']: c for c in json.loads((DC_DIR / 'evidence/catalog.json').read_text(encoding='utf-8'))}
i18n = {c['id']: c for c in json.loads((OUT / 'evidence/catalog.json').read_text(encoding='utf-8'))}


def esc(s):
    return (s or '').replace('|', '\\|')


def q(text):
    """Qualify bare deep-dive IDs in prose as deep-dive/BUG-NNN (dead-code IDs are already qualified)."""
    return re.sub(r'(?<![/\w])((?:BUG|REFACTOR|OPT)-\d{3})', r'deep-dive/\1', text)


def row(i):
    if i in i18n:
        c = i18n[i]
        return f"| [{i}](findings/{i}.md) | i18n | {c['tier']} · {c['origin']} | {esc(c['title'])} |"
    if i in dd:
        c = dd[i]
        sev = c['sev'] if c['prefix'] == 'BUG' else f"{c['prefix'].title()} {c['sev']}"
        if c['kind'] == 'UNTESTED':
            sev += ' (untested)'
        return f"| [deep-dive/{i}](../2026-10-04-deep-dive/findings/{i}.md) | deep-dive | {sev} · {c['origin']} | {esc(c['title'])} |"
    c = dc[i]
    return (f"| [dead-code/{i}](../2026-10-04-dead-code/findings/{i}.md) | dead-code | Conf {c['conf']} / Blast {c['blast']} · {c['rec']} | "
            f"{esc(c['title'])} |")


def table(ids):
    return '\n'.join(['| ID | Source | Tier or Sev · Origin, or Conf / Blast · Rec (dead-code) | Item |', '|---|---|---|---|'] + [row(i) for i in ids])


B = lambda *n: [f'BUG-{x:03d}' for x in n]
D = lambda *n: [f'DEAD-{x:03d}' for x in n]
R = lambda *n: [f'REFACTOR-{x:03d}' for x in n]
O = lambda *n: [f'OPT-{x:03d}' for x in n]
I = lambda *n: [f'I18N-{x:03d}' for x in n]
T = lambda *n: [f'TERM-{x:03d}' for x in n]
H = lambda *n: [f'HC-{x:03d}' for x in n]
FN = lambda *n: [f'FONT-{x:03d}' for x in n]
RNG = lambda a, b: list(range(a, b + 1))

WEB = ('`pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app`, then `pnpm --filter xivdyetools-web-app run build:check` (bundle budget) and `pnpm dead-code:check`. '
       'Recount coverage after any removal; never lower web-app\'s ratchet. Merge → `deploy-web-app.yml`.')
BOT_WAVE = ('**one PR with the next sprint.** Bump `@xivdyetools/bot-logic` (minor) and discord-worker; re-cut discord-worker\'s CJK subsets '
            '(`python scripts/subset-cjk-fonts.py` in `apps/discord-worker`; compare the subsets by cmap, never md5); '
            '`pnpm turbo run build type-check lint test --filter=...@xivdyetools/bot-logic` (that includes discord-worker\'s `font-coverage.test.ts`) → '
            'merge (`deploy-discord-worker.yml` runs `register-commands`) → Actions "Publish Packages to npm" for bot-logic')

# Sprint 0: the deep-dive's decisions first, then the i18n ones.
S0_DD = B(63, 53) + D(1, 2)
S0_I18N = I(1, 4, 5, 6) + T(14, 15)

SPRINTS = [
    ('web-app: tool settings have one owner (the HIGH)',
     'BUG-001 is the anchor. Each tool keeps local copies of its settings, and `ConfigController` broadcasts a full config over them, or never seeds them at mount. Fix it once:\n'
     '- seed every tool from `getConfig()`;\n'
     '- route rail and slot picks through the controller;\n'
     '- align the default tables.\n\n'
     'Then add the test BUG-011 asks for: mount against a non-default persisted config with a real controller.',
     B(1, 19, 22, 27, 12, 23, 24, 11, 78, 79),
     'web'),
    ('bot-logic: the bot speaks the user\'s language (i18n, publish)',
     '**The anchor is HC-001 (P1):** `/glamour` and `/swatch` cards print the clan in English in every locale. bot-logic needs a clan getter for the names core ships, and #240 (core 5.8.1) makes the Korean and Chinese ones the clients\' own. Merge #240 before this sprint.\n\n'
     '**Also here:** the dye-problem chip (TERM-012), a Chinese category name (TERM-013), card plurals and wording (I18N-016 to I18N-018), the manual topic `/glamour` points to (I18N-019) and a Korean option description (I18N-020).\n\n'
     '**TERM-004:** the sheet names are pinned in the dictionary (#239, *Character-Creation Color Sheets*). Merge #239 first.\n\n'
     '**Also here (no ID):** the Korean `/preferences set clan` tooltip still gives core\'s old clan names as examples (미드랜더, 렌). Use the clients\' (중원 부족, 아우라 렌).\n\n'
     '**Publishes bot-logic early.** It needs nothing from the core and svg sprints. bot-logic publishes again in Sprint 15.',
     H(1) + T(12, 13, 4) + I(16, 17, 18, 19, 20),
     BOT_WAVE),
    ('discord-worker: localized file errors, and the font re-cut (same PR as Sprint 2)',
     '**HC-002 (P1):** every pre-check in `chara-attachment.ts` puts an English reason into the translated error. The new keys live in bot-logic\'s locales, so this ships in Sprint 2\'s PR.\n\n'
     '**Fonts:** re-cut the CJK subsets here, for every drawn string Sprint 2 changes. A drawn-text change with no re-cut turns `font-coverage.test.ts` red.',
     H(2),
     'the same PR and merge as Sprint 2 (`deploy-discord-worker.yml`, which runs `register-commands`)'),
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
    ('web-app: translations and terminology (i18n)',
     '**Wrong English first:** the Glamour list privacy note claims a scope the code does not have (TERM-002), "tribe" names two things (TERM-009), and the list goes by two names (TERM-018).\n\n'
     '**Then the translations:**\n'
     '- two Korean typos (I18N-003);\n'
     '- German words for dye, preset and facewear (TERM-005 to TERM-007);\n'
     '- the Chinese Dated tag (TERM-008);\n'
     '- singular forms (I18N-007);\n'
     '- the smaller wording rows.\n\n'
     '**TERM-003:** the sheet names are pinned in the dictionary (#239, *Character-Creation Color Sheets*).\n\n'
     '**Also here (no ID):** `swatch.absentFurPattern` still calls Hrothgar 로스갈 in Korean (core says 로스가르 since #240). All five translations also name the fur pattern differently from the client (体毛柄 / Fellzeichnung / Motif du pelage / 털 무늬 / 毛纹).\n\n'
     '**Before Sprint 22:** some rows touch `glamour-block.ts`, which several of Sprint 22\'s rows also touch, so this sprint lands first.',
     T(2, 9, 18) + I(3) + T(5, 6, 7, 8, 3, 16, 17) + I(7, 8, 9, 10, 11, 12) + H(3),
     WEB + ' The edited `en` values re-key the allow-lists: re-run `pnpm --filter xivdyetools-web-app exec vitest run scripts/i18n-parity-gate.test.js --coverage.enabled=false` and update a stale allow-list reason in the same commit.'),
    ('Policy documents, both apps (docs only)',
     '**What lands here:** the Terms of Service variants missing the Glamour Reader (I18N-002), the "About → Privacy" path (I18N-013), the Korean moderator word (TERM-001), French "préréglage" (TERM-010), tool names in the policy prose (TERM-019) and Japanese 自社 (TERM-020).\n\n'
     '**Sprint 0 fallback:** any Sprint 0 policy item not fixed inside its PR lands here too.\n\n'
     '**How to edit:** one translator per language plus a verifier, as in the 2026-09-20 pass. Each document\'s six variants change in one commit, with `Last updated` on all six. The checklist is `.agents/skills/audit-shared/policy-documents.md`.',
     I(2, 13) + T(1, 10, 19, 20),
     '`python .agents/skills/audit-shared/scripts/policy-locale-parity.py` and `pnpm docs:check-links` → merge. The documents are served from GitHub `main` (`about-modal.ts` `POLICY_DOCS_BASE`), so they are live at merge. The web-app and discord-worker deploy workflows fire through their path filters but ship no code change. A user-visible policy change also gets a root `CHANGELOG-laymans.md` line, committed on its own.'),
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
     'BUG-009 and BUG-008: the gradient card ranks by a hard-coded ΔE and ramps in the wrong space. Also here: crawler parameters, the extractor algorithm, legacy `?algo=` spellings, cache-key fragmentation and resvg frees.\n\n'
     '**i18n:** the French deck name for Community Presets (TERM-011) and a German crawler sentence (I18N-014).',
     B(9, 8, 58, 59, 60, 61, 62) + O(6) + D(39, 40) + T(11) + I(14),
     '`pnpm turbo run build type-check lint test --filter=...xivdyetools-og-worker` → merge → `deploy-og-worker.yml` (bumping `CARD_VERSION` re-renders cached cards once; a bare deploy is the live beta). TERM-011 changes `og-strings.ts`: re-run og-worker\'s `scripts/subset-cjk-fonts.py` and compare by cmap (Latin-only, so expect no change).'),
    ('@xivdyetools/logger: redaction gaps (publish)',
     'BUG-140: context strings skip key=value redaction. BUG-141: `toJSON` objects log as `{}`. Plus a stale doc and a per-call Set rebuild.',
     B(140, 141) + O(10) + R(7),
     'bump `@xivdyetools/logger` (patch) → gate with `--filter=...@xivdyetools/logger` → merge → Actions publish'),
    ('@xivdyetools/core: blending, palette extraction, parser bounds (publish)',
     '**MEDIUM fixes:**\n'
     '- BUG-035: grey mixes get a hue neither input has.\n'
     '- BUG-036: palette extraction returns duplicate 0-pixel clusters.\n\n'
     '**Also here:** LOW parser and data fixes, plus two tests that cannot fail.\n\n'
     '**`build-locales.ts`:** BUG-128 is the generator, so fix the generator, never the generated JSON. The sheet names (TERM-021) are in the same file and follow the dictionary table (#239). The race and clan names there were corrected earlier, in #240 (core 5.8.1), so this sprint\'s bump is the next minor.',
     B(35, 36, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139) + T(21),
     'bump `@xivdyetools/core` (minor) → `pnpm turbo run build type-check lint test --filter=...@xivdyetools/core` (all consumers) → merge (consumer deploy workflows fire on `packages/core/**`) → Actions publish. If TERM-021 lands, its CJK sheet names reach both workers\' font gates, which read core\'s locales. Re-cut the discord-worker and og-worker subsets in the same PR (compare by cmap).'),
    ('@xivdyetools/svg: card text fidelity (publish)',
     'Rounding in the contrast tier, ellipsised step ranges, a sub-floor label, and the frame-budget gate\'s missing cards. The glamour card footer\'s line breaks (I18N-015) ride with them.',
     B(142, 143, 144, 145, 146) + I(15),
     'bump `@xivdyetools/svg` (patch) → `pnpm turbo run build type-check lint test --filter=...@xivdyetools/svg` → merge → Actions publish'),
    ('@xivdyetools/bot-logic: input resolution and filtered matching (publish)',
     '**Fixes:**\n'
     '- BUG-034: an all-digit hex without `#` is read as a dye id.\n'
     '- BUG-033: filters applied after a capped search return "no match".\n\n'
     '**Coverage:** BUG-127. Restore the 90 % branch threshold by covering glamour\'s branches, and decide whether CI runs `test:coverage`.\n\n'
     '**Consumers:** discord-worker and stoat-worker pick the change up via `workspace:*`. The merge redeploys discord-worker through its path filter. This is bot-logic\'s second publish; the first was Sprint 2.',
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
    ('Structural: split swatch-tool and gradient-tool (terminal)',
     'REFACTOR-005: the two largest files in the repo duplicate their desktop and mobile selector code. This goes after every other web-app sprint, because they all touch these files.',
     R(5),
     'web'),
    ('Fonts: item names on the /glamour card (terminal, last of all)',
     '**FONT-001 is a decision first:**\n'
     '- **Option A:** widen discord-worker\'s CJK subsets with item names (about +363 Hangul and +1,171 hanzi).\n'
     '- **Option B:** record the English-name card as accepted, with the measured rates.\n\n'
     '**Why it is last:** any text change before it would invalidate the subsets again.\n\n'
     '**Every other font re-cut** happens in the sprint whose drawn text changed (Sprints 2–3, 11).',
     FN(1),
     'if widened: add the item-name tables to `apps/discord-worker/scripts/subset-cjk-fonts.py`\'s inputs, measure `wrangler deploy --dry-run` gzip against the 3,072 KiB limit, run both `font-coverage` tests → merge → `deploy-discord-worker.yml`. If accepted: record it in `apps/discord-worker/CLAUDE.md` and close the finding.'),
]
KEEP = D(*RNG(47, 64))

placed = S0_DD + S0_I18N + [i for s in SPRINTS for i in s[2]] + KEEP
missing = (set(dd) | set(dc) | set(i18n)) - set(placed)
dupes = {i for i in placed if placed.count(i) > 1}
assert not missing and not dupes, (sorted(missing), sorted(dupes))
assert {i for i in S0_I18N} == {c['id'] for c in i18n.values() if c['sprint0']}

total = len(dd) + len(dc) + len(i18n)
parts = [f"""# Remediation Plan — 2026-10-04 (deep-dive + dead-code + i18n, merged)

**Sources:**
- [I18N_AUDIT_2026-10-04.md](I18N_AUDIT_2026-10-04.md): {len(i18n)} findings.
- [2026-10-04-deep-dive/DEEP_DIVE_REPORT.md](../2026-10-04-deep-dive/DEEP_DIVE_REPORT.md): {len(dd)} findings.
- [2026-10-04-dead-code/DEAD_CODE_REPORT.md](../2026-10-04-dead-code/DEAD_CODE_REPORT.md): {len(dc)} findings.
- **ID convention:** i18n IDs are bare (`I18N-`, `TERM-`, `HC-`, `FONT-`). The others are qualified as `deep-dive/BUG-NNN` and `dead-code/DEAD-NNN`.
- All three catalogs come from the same preview branch: `main` plus the 13 open PRs.

**This plan supersedes** the deep-dive's `REMEDIATION_PLAN.md`, which had already absorbed the dead-code `CLEANUP_PLAN.md`.
- Its 25 sprints are kept, with their rows unchanged.
- The i18n sprints are inserted (2, 3, 6, 7 and the last).
- The i18n rows are added to the units they belong to (11, 13, 14).
- So every deep-dive sprint number from 2 on has moved.

**Status basis:** {total} total.
- 1 fixed: dead-code/DEAD-001, in #225, not merged.
- {total - 1 - len(KEEP)} outstanding.
- 2 deep-dive candidates superseded by dead-code removals, and 1 i18n candidate that duplicates deep-dive/BUG-145 (listed below).
- {len(KEEP)} KEEP.
- 0 need rotation.
- Seven terminology questions need a dictionary row before anyone edits them (*Pin first*, below). They are not findings.

**Ordering:**
1. Sprint 0 holds the decisions due before tomorrow's batch merge. Nothing is pushed without your yes.
2. Correctness first:
   - the deep-dive HIGH (Sprint 1), then the two i18n P1s (Sprints 2–3), after #239 and #240 (the dictionary table and core's race and clan names);
   - then the units carrying MEDIUM / P2 findings;
   - then the LOW-only units.
3. One deploy unit per sprint, with three exceptions:
   - Sprints 2 and 3 are one PR, because bot-logic's text changes need discord-worker's fonts re-cut in the same merge (the 2026-09-19 i18n plan did the same);
   - Sprint 7 edits the policy documents of both apps and changes no code;
   - the four structural sprints are each a publish followed by their consumers' deploys.
   - Dead-code cleanups ride in their unit's sprint, after that unit's fixes.
4. Package publishes follow the dependency graph: logger, core, svg, bot-logic, then worker-kit.
   - `workspace:*` becomes an exact version at publish, so a dependent must publish after its dependencies.
   - bot-logic also publishes once early, in Sprint 2. It needs nothing from the core or svg sprints.
   - Consumers redeploy through their path filters on merge.
5. **Fonts:** a sprint that changes drawn text re-cuts the CJK subsets in its own PR; otherwise `font-coverage.test.ts` fails. The terminal fonts sprint is only the item-name decision (FONT-001).
6. Structural refactors last, then the fonts sprint.

**Conflicts (merged mode):**
- Two deep-dive candidates sat in code a dead-code entry removes, so the removal wins (*Superseded* below).
- One set of fixes shares files with removals: the preset services in Sprint 4. There the fixes land first, then the removals.
- Sprint 6 (i18n) and Sprint 22 (deep-dive LOWs) both touch `glamour-block.ts`; Sprint 6 lands first.
- No i18n finding sits in code a dead-code entry removes.
"""]
parts.append(f"""## Sprint 0 — Before the batch merge (your decision)

**Merging tomorrow is safe from all three audits' point of view:**
- no finding in the batch is CRITICAL or HIGH;
- no deep-dive finding in the batch is MEDIUM;
- the i18n findings that come from the PRs are P2 or P3 policy text;
- the cross-PR test failure is already fixed in #224 (`10a1cb77`);
- the preview passes 62/62.

### From the deep-dive and dead-code audits

{table(S0_DD)}

- **deep-dive/BUG-063 (#224) and deep-dive/BUG-053 (#225):** recommended text-only fixes, to make inside the PRs before merging if you agree. Otherwise, correct them in the presets-api and moderation-worker sprints.
- **dead-code/DEAD-001:** already applied in #225 (`ea264d49`).
- **dead-code/DEAD-002 (#227):** optional; if deferred, it joins the discord-worker sprint.

**Question:** are `proxy.`, `api.` and `moderation-bot.xivdyetools.projectgalatine.com` still attached in Cloudflare?
- **If so:** merging #229, #224 and #225 changes nothing.
- **If you removed them in the dashboard:** those merges re-attach them. Delete the route lines first, per `docs/operations/DOMAIN_DEPRECATION.md`.

### From the i18n audit

{table(S0_I18N)}

- **English edits (I18N-001, I18N-004, I18N-005):** each one needs its five translations in the same commit, or the fix itself creates a parity defect. That means a translator and a verifier per PR.
  - I18N-001 has a lighter option: set *Last updated* to the merge date on all twelve variants. That is a date edit, with no translation. The sentence then holds, because a later date bump only makes it less precise, never false. A fixed-date rewording is the full fix, and its date only exists at merge time.
  - If you would rather not fix them inside the PRs, all three land in Sprint 7.
- **Translation-only edits (I18N-006, TERM-014, TERM-015):** one Korean or Chinese phrase each, inside #223, #227 and #230. Otherwise, Sprint 7.
- **TERM-001:** #223's new line 13 can switch to 조정자 now, the word the rest of that file uses. The full fix is in Sprint 7.

**Answered 2026-10-05: the character-creation sheet names.**
- The client's own labels are now in the dictionary (#239, *Character-Creation Color Sheets*), read from the game data in all six languages.
- So TERM-003, TERM-004 and TERM-021 are unblocked and stay in Sprints 6, 2 and 13. Merge #239 before those sprints.

**Prerequisite before Sprint 2: core's race and clan names (#240).** The same research found three sets of names in core that aren't the clients':
- two Korean race names (Hyur, Hrothgar);
- 13 of 16 Korean clan names;
- 4 Chinese clan names.

HC-001 (Sprint 2) prints core's clan names on the bot cards, so you chose to fix core first.
- **What #240 contains:** core 5.8.1, plus the discord-worker 5.8.1 and og-worker 2.11.2 CJK font re-cut.
- **Merge order:** #240 is stacked on #239. Merge it after the batch and after #239, before Sprint 2.
- **No ID:** it came from the research, not from a catalog.
""")
for n, (title, blurb, ids, ends) in enumerate(SPRINTS, 1):
    parts.append(f"## Sprint {n} — {title}\n\n{q(blurb)}\n\n{table(ids)}\n\n**Ends with:** {WEB if ends == 'web' else q(ends)}\n")
parts.append(f"""## Superseded findings

| Candidate | Superseded by | Why |
|---|---|---|
| copy-hex clipboard `.then` without `.catch` (swatch/gradient) | dead-code/DEAD-003 | the `copy-hex` action is never emitted; the removal deletes the handler |
| `EMPTY_STATE_PRESETS.noSearchResults` behaviour | dead-code/DEAD-008 | a test-only preset; the removal deletes it |
| glamour card look-count line drawn at 10.5 px (i18n candidate) | deep-dive/BUG-145 | same lines, same fix |

## KEEP register

These are not scheduled; the reasons and revisit triggers are in each finding. The package-major backlog is in the dead-code audit's report.

{table(KEEP)}

## Pin first (terminology without a source)

**Not findings, and not scheduled.** Each is real, but choosing the word needs a cited publisher source, not fluency. Add a row to `docs/reference/ffxiv-terminology.md` (or the glossary for app nouns), then file and fix.

| Concept | What the apps say today | Needs |
|---|---|---|
| Clan, as a noun | de Volksgruppe / Stamm (+ bot "Charakter-Stamm"); fr ethnie / tribu / Clan | the client's word in de and fr |
| Gender | fr sexe (`glamour.verdict.explain`) vs genre (Swatch Matcher, bot) | the fr client's word |
| "Same look" twins | en twin / same look / swap; fr "+N ASPECT" vs "même apparence"; ko 동형 / 유일 vs 같은 외형 | an app glossary row |
| A color slot | zh 栏位 (web) vs 部位 (bot) | an app glossary row |
| Moderator, in the UI | zh `fieldPreviewImageHint` 版主 vs the policies' 审核员; ko UI 모더레이터 | a glossary row; TERM-001 settles the ko policies |
| Dye channel (ja) | 染色枠 vs チャンネル (filed as TERM-016 for the split; the word is unpinned) | the client's dye UI text |
| Facewear color tag (ja, ko) | ja フェイスウェアカラー, ko 페이스웨어 색상 transliterate "facewear" | follows TERM-007's choice |

## Standing guidance

- **Verify first:** check each finding's evidence against the code before fixing; findings are leads. Re-grep before any removal, and grep `apps/stoat-worker` by hand for package exports.
- **One PR per sprint**, as with the security sprints. Sprints 2 and 3 are the exception: one PR. Make one commit per task, or per sprint when it is tiny. Stage only your own paths with `git commit --only -- <paths>`.
- **Gate every sprint boundary** (`release-mechanics.md` → *Standing verification gate*). Before merging a batch, run the whole-graph gate on a trial merge; the 2026-10-04 preview showed why.
- **Translations:**
  - add or change a key in all six files at once;
  - the web-app order is checked by `node scripts/reorder-locales.mjs --check`;
  - list every new or changed translation in the commit message (no silent auto-translation);
  - a changed `en` value can turn an allow-list entry stale, so re-run the set's gates.
- **Policy documents:** all six variants of a document in one commit, with `Last updated` on all six (`policy-documents.md`).
- **Changelogs and versions:** every touched unit gets a version bump and a `CHANGELOG.md` entry. Player-visible web-app or bot fixes also get a root `CHANGELOG-laymans.md` entry, committed on its own.
- **Tracking:** mark executed sprints in their heading **✅ COMPLETED <date> <commits>**, with **Deploy needs:**, and mirror the status in each finding and in the three reports' status tables.
""")
(OUT / 'REMEDIATION_PLAN.md').write_text('\n'.join(parts), encoding='utf-8', newline='\n')
print('plan written:', len(placed), 'placed;', len(SPRINTS), 'sprints after Sprint 0; total', total)
