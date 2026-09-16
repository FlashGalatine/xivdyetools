"""Write the reviewed audit catalog. No application source is modified."""
import json, re, subprocess
from pathlib import Path

root = Path.cwd()
out = root / 'docs/audits/2026-09-15-dead-code'
ev = out / 'evidence'
rows = []
def add(n, title, unit, loc, evidence, fix, lines=0, tests=0, rec='REMOVE', blast='LOW', category='Test-only', semver='NONE', trigger='', supersedes=''):
    rows.append(dict(id=f'DEAD-{n:03}',title=title,unit=unit,loc=loc,evidence=evidence,fix=fix,lines=lines,tests=tests,rec=rec,blast=blast,category=category,semver=semver,trigger=trigger,supersedes=supersedes))

add(1,'IndexedDBService.getWithContext and GetResult — 36 source lines','web-app',
    'apps/web-app/src/services/indexeddb-service.ts:183–217; GetResult at :32',
    'Tracked-tree symbol search finds only the method declaration and its local return type. Independent verifier checked direct, computed, inherited and test references; none exists.',
    'Delete getWithContext and its GetResult alias/JSDoc together; retain get, transaction handling and all live storage tests.',36,category='Unused Export')
add(2,'SavedPresetsService.isSaved — 4 source lines','web-app',
    'apps/web-app/src/services/saved-presets-service.ts:121–124',
    'Only the method declaration matches in tracked source/tests; the verifier found no computed or inherited call.',
    'Delete isSaved and its method-specific JSDoc; preserve save/load/list behavior.',4,category='Unused Export')
add(3,'ShareService.getBaseUrl — 7 source lines','web-app',
    'apps/web-app/src/services/share-service.ts:578–584',
    'Only its declaration remains; current share URL construction uses other paths and exposes no external class API.',
    'Delete getBaseUrl and its JSDoc; retain the active share builders and share URL tests.',7,category='Unused Export')
add(4,'ThemeService.getRequiredColor — 15 source lines','web-app',
    'apps/web-app/src/services/theme-service.ts:329–343',
    'No executable or test caller. Two prose references describe the unused accessor and do not establish reachability.',
    'Delete getRequiredColor and update explanatory comments plus docs/projects/web-app/theming.md:39, which presents it as an accessor; preserve applyPalette and current theme accessors.',15,category='Legacy')
add(5,'BaseComponent.setStyle — 7 source lines','web-app',
    'apps/web-app/src/components/base-component.ts:703–709',
    'Only the base declaration matches. No subclass override, inherited call, computed invocation or prototype access was found.',
    'Delete setStyle and its JSDoc. Keep actual DOM styling and component lifecycle tests.',7,category='Unused Export')
add(6,'EmptyState.setOptions — 4 source + 39 test lines','web-app',
    'apps/web-app/src/components/empty-state.ts:215–218',
    'Only its dedicated setOptions tests call it. Production passes options at construction; the @testonly reason describes unused reconfiguration behavior, not test isolation.',
    'Delete setOptions/JSDoc and only the setOptions describe block at components/__tests__/empty-state.test.ts:252–290; retain constructor/render/action tests.',4,39)
add(7,'OfflineBanner subscription and refresh helpers — 18 source + 44 test lines','web-app',
    'apps/web-app/src/components/offline-banner.ts:179–190,199–204',
    'onStatusChange and updateMessage are only called by dedicated tests. Live banner updates use its separate internal online/offline listeners; no language-change caller invokes refresh.',
    'Delete both helpers/JSDoc and their describe blocks at components/__tests__/offline-banner.test.ts:303–335,341–351. Keep setupListeners, cleanup, getIsOnline and DOM visibility tests.',18,44)
add(8,'getPreference single-key reader — 11 source + 23 test lines','discord-worker',
    'apps/discord-worker/src/services/preferences.ts:156–166',
    'Executable consumers are confined to preferences.exhaustive.test.ts. Production uses getUserPreferences; the local @testonly note explicitly identifies a deletion candidate.',
    'Delete getPreference/JSDoc and its test import/describe block at preferences.exhaustive.test.ts:338–360. Retain whole-preference and default-value tests.',11,23)
add(9,'Unbatched preset-status wrappers — 8 source + 77 test lines','moderation-worker',
    'apps/moderation-worker/src/services/ban-service.ts:631–634,646–649',
    'hideUserPresets/restoreUserPresets have only test callers. Live banUser/unbanUser batch the underlying statement builders with audit-log statements; those builders remain live.',
    'Delete only the two exported wrappers/JSDoc and direct-wrapper test imports/blocks at ban-service.test.ts:662–697,699–739. Preserve batched ban/unban SQL, audit logging and security-path tests.',8,77,rec='REMOVE WITH CAUTION')
add(10,'Unused fetch logging wrappers — 29 source + 124 test lines','moderation-worker',
    'apps/moderation-worker/src/utils/url-sanitizer.ts:233–248,273–285',
    'sanitizeFetchRequest/sanitizeFetchResponse have no production callers; declaration, example and dedicated test matches account for all references.',
    'Delete both fetch wrappers/JSDoc and their test blocks at url-sanitizer.test.ts:337–390,392–461. Keep sanitizeUrl/sanitizeErrorMessage and initially keep sanitizeHeaders for DEAD-011.',29,124)
add(11,'Header helper cascade — 36 source + 139 test lines','moderation-worker',
    'apps/moderation-worker/src/utils/url-sanitizer.ts:68–75,135–162',
    'The only production-code references to sanitizeHeaders are inside DEAD-010; SENSITIVE_HEADERS is local to that helper. This is a conditional removal, not an independently unreachable helper today.',
    'After DEAD-010 has landed and passed its gate, re-grep; delete sanitizeHeaders, SENSITIVE_HEADERS and their JSDoc, plus only url-sanitizer.test.ts:154–292 and its import. Keep the sanitizeErrorMessage block beginning at :294.',36,139,rec='REMOVE WITH CAUTION',category='Dead Path')
add(12,'Translator.getMeta — 3 source + 25 test lines','moderation-worker',
    'apps/moderation-worker/src/services/bot-i18n.ts:203–205',
    'Only the getMeta describe block calls it. No moderation handler displays the metadata; the tests exercise this otherwise unused accessor.',
    'Delete getMeta/JSDoc and only bot-i18n.test.ts:209–233. Preserve LocaleData.meta for this pass, t() tests and locale-resolution tests.',3,25)
add(13,'truncateUnicodeSafe — 9 source + 38 test lines','presets-api',
    'apps/presets-api/src/services/moderation-service.ts:53–61',
    'Only dedicated unit tests call the helper; no moderation, storage, logging, script or configuration path invokes it.',
    'Delete the helper/JSDoc and its import/describe block at tests/services/moderation-service.test.ts:104–141; retain local/profanity/Perspective behavior tests.',9,38)
add(14,'duplicateResponse — 3 source + 9 test lines','presets-api',
    'apps/presets-api/src/utils/api-response.ts:174–176',
    'Its only executable caller is the dedicated response test; live duplicate-conflict handlers construct their responses inline.',
    'Delete duplicateResponse/JSDoc and only its import/test at tests/utils/api-response.test.ts:131–139. Preserve errorResponse and handler-level conflict tests.',3,9)
add(15,'VoteRow orphan type — 5 source + 9 test lines','presets-api',
    'apps/presets-api/src/types.ts:188–192',
    'Only tests/types.test.ts constructs the type; no D1 query or runtime source imports it. The test asserts a property it just placed in its own literal.',
    'Delete VoteRow, its test import and tests/types.test.ts:318–326. Preserve actual votes schema, queries, adjacent row types and route tests.',5,9,blast='NONE',category='Unused Type')
add(16,'CacheConfigKey belongs to its test — 1 source line','api-worker',
    'apps/api-worker/src/universalis/config/cache.ts:49',
    'Only cache.test.ts:6,120 imports/uses it. Runtime configuration already satisfies Record<string, CacheConfig>; separate Object.entries tests inspect actual entries.',
    'Move the alias into cache.test.ts or inline keyof typeof CACHE_CONFIGS there, then delete its source export/import. Preserve the existing key and runtime-entry assertions.',1,rec='REFACTOR FIRST',blast='NONE',category='Unused Type')
add(17,'Inert image-worker environment member — 1 source line','image-worker',
    'apps/image-worker/src/types.ts:12; src/index.ts:59',
    'Wrangler sets no ENVIRONMENT variable and loggerMiddleware has readEnvironmentFromEnv:false. Only index.test.ts:5 and index-limits.test.ts:24 populate it.',
    'Replace the one-field Env contract with an explicit empty binding type (for example Record<string, never>) and change the two fixture values to {}. Run lint/type-check; do not introduce an empty-interface lint violation.',1,rec='REFACTOR FIRST',blast='NONE',category='Unused Type')
add(18,'Core APIs without local callers — 28 source lines retained','core',
    'packages/core/src/services/CharacterColorService.ts:157,253; LocalizationService.ts:585,592; ColorService.ts:676,686',
    'getSharedColors, getRaceSpecificColors, both getAvailableLocales methods and hexToRyb/rybToHex remain documented/exported API. Repository-only absence cannot establish absence of npm consumers.',
    'Retain the API. At the next independently justified core major, check registry publication and external consumers, document deprecation/migration, then reassess.',rec='KEEP',blast='HIGH',category='Unused Export',semver='MAJOR',trigger='Next independently justified core major, after publication and external-consumer review.',supersedes='2026-09-01-dead-code/DEAD-006')
add(19,'Parked Stoat feature scaffolding retained','stoat-worker',
    'apps/stoat-worker/src/commands/parser.ts:148; services/loading-indicator.ts:25; services/response-formatter.ts:43',
    'parseMultiDyeArgs, withLoadingIndicator and DYE_INFO_REACTIONS have only test callers; the app documents deferred command/reaction features and remains parked. Its live imports into bot-logic still count.',
    'Keep while parked (P3). On resumption choose implementation or removal for each planned feature; on retirement remove the app as a separately approved action.',rec='KEEP',blast='LOW',trigger='Stoat is explicitly resumed or retired.',supersedes='2026-09-01-dead-code/DEAD-030')
add(20,'Reachable rate-limit fallback paths retained','api-worker / discord-worker / moderation-worker / oauth',
    'apps/api-worker/src/middleware/rate-limit.ts:48,139; apps/discord-worker/src/services/rate-limiter.ts:154; apps/moderation-worker/src/middleware/rate-limit.ts:169; apps/oauth/src/services/rate-limit.ts:113',
    'Native binding selectors still route to KV/memory when bindings are absent. Development/test and degradation contracts are concrete consumers; elapsed calendar time does not satisfy the old production-evidence gate.',
    'Keep. Before any removal, establish an explicit replacement for local/test fallback behavior and review the prior operational gate with recorded evidence; no live logs or Cloudflare configuration were inspected here.',rec='KEEP',blast='HIGH',category='Legacy',trigger='Fallback retirement is designed, local/test replacements exist, and the prior operational evidence gate is satisfied.',supersedes='2026-09-01-dead-code/DEAD-034')
add(21,'InteractionResponseBody assertion contract retained','discord-worker',
    'apps/discord-worker/src/types/env.ts:244–278',
    'The interface is imported by 12 tracked test files to type real handler responses. It has a concrete test-support role and erases from the runtime bundle.',
    'Keep the shape. A future test-support reorganization may move it to a testing module and update all imports together; deleting it is not a runtime optimization.',rec='KEEP',blast='LOW',category='Unused Type',trigger='A scoped Discord test-support module reorganization is approved.',supersedes='2026-09-01-dead-code/DEAD-029')

units=json.loads((ev/'workspaces.json').read_text(encoding='utf-8-sig'))
filters={u['unit'].split('/')[-1]:u['name'] for u in units}
survey=json.loads((ev/'syntax-survey.json').read_text())
spans=json.loads((ev/'test-removal-spans.json').read_text())
source_lines=sum(r['lines'] for r in rows)
test_lines=sum(r['tests'] for r in rows)
assert source_lines == 197 and test_lines == 527, (source_lines,test_lines)
assert sum(s['lines'] for s in spans)==test_lines

# Reproducible tracked-tree raw symbol evidence; full-text references are candidates, not verdicts.
tracked=subprocess.check_output(['git','ls-files'],text=True,encoding='utf-8').splitlines()
textfiles=[f for f in tracked if re.search(r'\.(ts|tsx|js|mjs|cjs|vue|html|css|json|toml|yml|yaml)$',f) and not f.startswith('docs/') and 'coverage/' not in f]
texts={f:(root/f).read_text(encoding='utf-8',errors='replace') for f in textfiles if (root/f).exists()}
symbols=['getWithContext','GetResult','isSaved','getBaseUrl','getRequiredColor','setStyle','setOptions','onStatusChange','updateMessage','getPreference','hideUserPresets','restoreUserPresets','sanitizeFetchRequest','sanitizeFetchResponse','sanitizeHeaders','SENSITIVE_HEADERS','getMeta','truncateUnicodeSafe','duplicateResponse','VoteRow','CacheConfigKey','InteractionResponseBody']
proof=['Command: python docs/audits/2026-09-15-dead-code/evidence/scripts/write-report.py','Input inventory: git ls-files; code/config only, no build/coverage/audit documents.','Raw matches include comments/examples and unrelated same-named declarations; see verified findings for interpretation.','']
for sym in symbols:
    proof.append('## '+sym)
    rx=re.compile(r'\b'+re.escape(sym)+r'\b')
    for f,t in texts.items():
        for n,line in enumerate(t.splitlines(),1):
            if rx.search(line):proof.append(f'{f}:{n}: {line.strip()}')
(ev/'reference-evidence.txt').write_text('\n'.join(proof)+'\n',encoding='utf-8')

for r in rows:
    carry=f"\nSupersedes `{r['supersedes']}`; references rechecked at this snapshot.\n" if r['supersedes'] else ''
    gate=f"`pnpm turbo run build type-check lint test --filter={filters[r['unit']]}`" if r['unit'] in filters and r['rec']!='KEEP' else 'Reassess at the stated trigger; no removal gate is scheduled'
    if r['unit']=='web-app':gate+=' plus `pnpm --filter xivdyetools-web-app run build:check`'
    doc=f"""# {r['id']}: {r['title']}
**Confidence:** HIGH · **Blast radius:** {r['blast']} · **Deploy unit:** {r['unit']} · **Semver:** {r['semver']} · **Category:** {r['category']}
{carry}
## Location
- `{r['loc']}`.

## Evidence
- {r['evidence']}
- See [tracked references](../evidence/reference-evidence.txt), [syntax survey](../evidence/syntax-survey.json) and [verification](../evidence/verification.md). Test boundaries: [measured spans](../evidence/test-removal-spans.json).

## Fix
- **{r['rec']}** — {r['fix']}
- Gate: {gate}.
{('- Revisit trigger: '+r['trigger']) if r['trigger'] else ''}
## Status
{'KEEP — unscheduled until its trigger.' if r['rec']=='KEEP' else 'OPEN — recommendation only; no source change made.'}
"""
    (out/'findings'/f"{r['id']}.md").write_text(doc,encoding='utf-8')

bundles=[]
for p in sorted(ev.glob('bundle-*.log')):
    text=p.read_text(encoding='utf-8',errors='replace')
    m=re.search(r'Total Upload:\s*([\d.]+) KiB\s*/\s*gzip:\s*([\d.]+) KiB',text)
    if m:bundles.append((p.stem.removeprefix('bundle-'),*m.groups()))
assert len(bundles)==7, bundles
versionrows='\n'.join(f"| {u['unit']} | {u['version']} |" for u in units)
catalog='\n'.join(f"| [{r['id']}](findings/{r['id']}.md) | {r['title']} | HIGH | {r['blast']} | {r['semver']} | {r['unit']} | {r['rec']} |" for r in rows)
keep='\n'.join(f"| [{r['id']}](findings/{r['id']}.md) | {r['title']} | {r['evidence']} | {r['trigger']} |" for r in rows if r['rec']=='KEEP')
status='\n'.join(f"| {r['id']} | {'KEEP' if r['rec']=='KEEP' else 'OPEN'} | — |" for r in rows)
bundle_table='\n'.join(f'| {u} | {raw} | {gz} |' for u,raw,gz in bundles)
report=f"""# Dead-code audit — xivdyetools (2026-09-15)

- **Snapshot:** `main@0332fcc5768a4477301ed5b15590eee16a772f87`; all 17 workspaces plus root scripts/configuration.
- **Depth:** standard — direct Knip, unused-local/parameter checks, custom reachability gate, syntax/member survey, targeted manual path/type/asset/CSS/i18n review and independent verification.
- **Totals:** **21 catalog entries: 17 cleanup candidates and 4 KEEP decisions.** All are HIGH-confidence classifications; a KEEP classification does not assert safe removal.
- **Removal scope:** **197 source declaration/body lines and 527 dedicated test-block lines**, across 16 source and 9 test files. These include a conditional cascade and two type refactors. No whole-file deletion is proposed. Comments, whitespace, import cleanup, and adjusted fixture lines are excluded from these measured totals.
- **Audit changes:** documentation/evidence only. No tracked application source, dependencies or configuration changed. Local build/test outputs were refreshed. No deployment, database operation, commit or push.
- **Sprint 0:** no urgent dead-code change. Existing security priorities remain first; see the [coordinated cleanup plan](CLEANUP_PLAN.md).

## Catalog

| ID | Title | Conf | Blast | Semver | Deploy unit | Rec |
|---|---|---|---|---|---|---|
{catalog}

## Quick wins

1. **DEAD-001–007:** seven web-app findings, eight methods, 91 source lines and 83 test lines. Five methods have no test caller either; three additional methods are only exercised by their own tests.
2. **DEAD-008:** unused single-preference reader, 11 source + 23 test lines.
3. **DEAD-010, DEAD-012–015:** small unused wrappers/accessors/types with bounded tests. Preserve surrounding live behavior.

**DEAD-009** requires care around retained batched moderation tests. **DEAD-011** follows DEAD-010 in a later gated step. **DEAD-016–017** are low-benefit type hygiene; they have no runtime bundle saving.

## KEEP register

| ID | Item | Reason | Revisit trigger |
|---|---|---|---|
{keep}

Other retained controls: published package subpaths and deliberate `@public` surfaces; test reset/observation hooks; live OAuth/presets deprecated re-exports. Their existence is not a removal finding. Public package Semver=MAJOR is the conservative constraint for already-published API; the current registry version/external consumer set was not queried at standard depth.

## Evidence and baseline

| Check | Result |
|---|---|
| Root Knip, run directly | Exit 1: exactly the 3 documented root/local differences — two web-app declaration files and its kept wrangler devDependency |
| Web-app Knip; OG normal and production Knip | All exit 0, no findings |
| Custom dead-code gate | Exit 0; 550 production / 482 test files, 34 test-only, 4 entrypoint and 7 public exemptions |
| `tsc --noEmit --noUnusedLocals --noUnusedParameters` | All 17 units pass after refreshing stale dependency outputs; initial 4 failing units and final reruns preserved |
| Web locale orphan analyzer | 1,128 / 1,128 keys used; zero reported orphans |
| Bot locale tests | 72 tests, 4 files passed, including orphan/parity checks |
| `pnpm turbo run type-check lint test --continue --concurrency=2` | Exit 0; **59/59 tasks**, 16 cache hits; dependency builds included. This is not a claim that all tests reran uncached |
| Root script type-check and tests | Exit 0; 107 script tests passed |
| Documentation link/version checks | Both exit 0 |
| Worker bundle baselines | All 7 `wrangler deploy --dry-run` commands exit 0; no deployment performed |
| Supplementary syntax survey | {sum(survey['inventory'].values())} tracked TS/JS files; {len(survey['exports'])} export declarations and {len(survey['members'])} public members inventoried; candidates individually triaged |

Exact commands, statuses and tool logs: [initial collection](evidence/collection-results.json), [final collection](evidence/collection-final-results.json), [verification](evidence/verification.md). The initial bootstrap failure directory records sandbox failures and the discarded helper invocation with dropped arguments; neither is interpreted as code evidence. The corrected runner records full argument lists.

### Bundle before (KiB)

Default configured environment, locally bundled; API-worker excludes production-only Static Assets. Sizes are per-worker baselines, not production-state verification.

| Worker | Raw | Gzip |
|---|---:|---:|
{bundle_table}

No bundle reduction is claimed: type erasure and tree shaking can make the runtime saving much smaller than source-line removal. Measure the same environment after cleanup.

## Dependency cleanup

No removable dependency was confirmed. `wrangler` in web-app pins the deployment tool; `.d.ts` files serve JavaScript imports. VitePress/Vue, ambient types, build CLIs, font tooling and test tooling have configuration or operational consumers. No ts-prune/depcheck or new installation was used.

## Positive controls

- Knip is gated in 16/17 units; parked Stoat is the documented exception. The root cross-check remains at its documented three findings.
- Public library APIs are evaluated with package export maps and all monorepo consumers, including Stoat and test-utils integration.
- API docs helpers are used by `.vue` components; Pages middleware and Lit registrations are convention/side-effect entrypoints.
- Tool CSS is loaded both in the shell shadow root and page scope; modal mount paths remain live. No CSS or asset deletion is proposed.
- Static root OG cards, beta icon generation inputs, and source font files remain operationally used. OG extractor/presets/budget generators have live route dispatch.
- Test isolation/readback hooks observe real state or clean up timers/singletons; they are distinct from tests that exercise otherwise unused public behavior.
- Retired package/app directories are absent from the tracked tree. Remaining old package names in source are commentary, not active imports. Active deprecation integrations require their own retirement gates.

## Rejected suspicions and corrections

- Package exports used only outside their own package, published subpaths, and methods called within their own file are live; zero external-file references alone are insufficient.
- `ModalService.dismissAll` and `ToastService.dismissAll` clear real singleton state/timers between tests and stay. Conversely, `EmptyState.setOptions` and the two OfflineBanner methods are not reset/observation hooks; follow-up verification reclassified them as cleanup candidates.
- Coalescer observation methods, locale/registry assertions, mock factories and cache reset hooks are purposeful test support.
- `sanitizeHeaders` has real source callers until the fetch wrappers are removed; it is a separately sequenced cascade.
- Reviewer-estimated test ranges were corrected with TypeScript AST measurement. In particular, header tests end at line 292: the live error-message tests starting at 294 must survive. The measured spans, not preliminary reviewer ranges, govern cleanup.
- No newly confirmed dead CSS, assets, skipped executable tests or runtime-unreachable routes were found in the bounded sweeps. This is not a proof of whole-repository absence.

## Recommendations

1. Extend the reachability gate's member survey to zero-test-reference methods and test-only types; use TypeScript syntax for declarations and comment-free evidence.
2. Periodically review `@testonly` reasons: retain genuine reset/observation support and retire unshipped APIs tested only for their own sake.
3. Keep direct root Knip in audit/CI cross-checks; cross-workspace consumer changes can evade a cached unit lint result.
4. Preserve explicit handling for published API, computed calls, custom-element registration, Vue templates and package subpaths.
5. Recount coverage after deleting covered dead code; percentage denominators change. Preserve the web-app coverage ratchet and meaningful surrounding behavior tests.
6. Re-grep before every edit; another session shares this checkout. Measure dependency/bundle effects only after each triggering removal passes.

## Coverage and limits

The tracked syntax inventory spans all 17 units and root scripts. Manual review was candidate-driven, with explicit per-unit limits in [web-app](evidence/review-web-app.md), [packages](evidence/review-packages.md), [worker candidates](evidence/review-worker-candidates.md) and [other workers](evidence/review-other-workers.md). Numeric-name matching can still collide; arbitrary reflective/computed access and external consumers cannot be proven absent by a static survey. Dynamic locale prefixes were checked at a bounded family level, not exhaustively enumerated beyond the existing analyzers. No browser/E2E run, live traffic/log inspection, external consumer audit, full git archaeology or production deployment parity check was performed. The syntax helper excludes Vue templates, which were checked separately for the relevant docs candidates.

## Remediation status

| ID | Status | Commit |
|---|---|---|
{status}

## Next steps

Use [CLEANUP_PLAN.md](CLEANUP_PLAN.md) after authorizing implementation. It coordinates this catalog with the current security priorities and records historical backlog status limitations. No removal has begun.
"""
(out/'DEAD_CODE_REPORT.md').write_text(report,encoding='utf-8')
readme=f"""# Dead-code audit — xivdyetools (2026-09-15)

**17 cleanup candidates and 4 KEEP decisions** across all 17 workspaces. Proposed cleanup covers **197 source lines and 527 dedicated test lines**; no source files were modified by the audit. Baseline checks pass after stale dependency outputs were refreshed; root Knip retains its three documented exceptions.

Snapshot: `main@0332fcc5768a4477301ed5b15590eee16a772f87`. Standard depth; the existing untracked security audit was preserved.

| File | Purpose |
|---|---|
| [DEAD_CODE_REPORT.md](DEAD_CODE_REPORT.md) | Verified catalog, quick wins, KEEP register, validation and limits |
| [CLEANUP_PLAN.md](CLEANUP_PLAN.md) | Ordered unit-level cleanup with prior-catalog coordination |
| [findings/](findings/) | 21 evidence-backed finding records |
| [evidence/](evidence/) | Exact commands/logs, reviewer reports, syntax references, measured spans and local bundle baselines |

## Top items

1. **DEAD-001–007 (HIGH)** — web-app: eight unused methods; five have no test caller either.
2. **DEAD-009 (HIGH)** — moderation-worker: remove test-only wrappers while retaining live batched moderation behavior.
3. **DEAD-010–011 (HIGH)** — moderation-worker: retire unused logging wrappers, then their header-helper cascade.
4. **DEAD-018–021 (KEEP)** — preserve public API, parked features, reachable fallbacks and useful assertion types.

## Versions at snapshot

| Unit | Version |
|---|---|
{versionrows}
"""
(out/'README.md').write_text(readme,encoding='utf-8')
print(json.dumps({'entries':len(rows),'cleanup':sum(r['rec']!='KEEP' for r in rows),'keep':sum(r['rec']=='KEEP' for r in rows),'source_lines':source_lines,'test_lines':test_lines,'bundles':len(bundles)}))

