export const meta = {
  name: 'xivcharakit-dead-code-round1',
  description: 'Dead-code audit of the XIVCharaKit-facing code: six slice reviewers (read-only, one evidence file each); verification follows in a second workflow',
  phases: [{ title: 'Review', detail: 'six slice reviewers' }],
}

const OUT = 'docs/audits/2026-10-26-xivcharakit-dead-code'
const SCRATCH = '/c/Users/DrawF/AppData/Local/Temp/claude/C--dev-XIVProjects-xivdyetools--claude-worktrees-xivdyetools-chara-integration-b6c47b/de6dd161-aa43-4593-a3f4-77eb767f3c78/scratchpad'

const PRE = `You are a dead-code reviewer on the xivdyetools monorepo (cwd = monorepo root of a git worktree; HEAD 88189ee8). The audit scope is the code where we interact with the XIVCharaKit library (npm xivcharakit@0.1.0-beta.4, adopted 2026-10-26 in core 5.15.0, web-app 5.16.0, bot-logic 4.11.0, discord-worker 5.9.0) and the older .chara code it displaced. NOTHING IS REMOVED DURING THE AUDIT.

RULES
- READ-ONLY on the repo. Write EXACTLY ONE file: ${OUT}/evidence/review-<your key>.md (module map, reference tables you built, every candidate with its proof, KEEP items with triggers, FILES COVERED). Scratch scripts go under ${SCRATCH} only. Never run deploy/publish/install commands. Read-only npm queries (npm view ...) are allowed.
- Count references over TRACKED files only: git grep -n -w <sym> -- <paths>, git ls-files | xargs grep, or the audit scripts bash ${OUT}/evidence/scripts/symrefs.sh <unit> <symbols...> and python ${OUT}/evidence/scripts/members.py <file> <Class>. Never grep -r (coverage/, dist/, e2e-coverage/, node_modules/ poison it). Git Bash on Windows: no grep --include brace expansion; long heredocs fail, use the Write tool for scripts.
- Tool evidence ALREADY gathered and clean, do not repeat it: knip reports nothing in any of the six workspaces (evidence/knip-*.txt), tsc --noUnusedLocals --noUnusedParameters is clean, i18n:unused is clean, and the repo's reachability gate (pnpm dead-code:check, evidence/dead-code-check.txt) passes. So the interesting dead code is what those tools cannot see: (a) test-only reachability (a symbol whose only non-self references are tests); (b) dead public class members and helpers exported only for tests; (c) DISPLACED LEGACY code kept alive only by its own tests, by a /** @public */ tag, by the main-barrel re-export, or by a parity harness; (d) dead paths: error/issue codes never emitted, options never passed, branches that cannot be reached, flags always true, switch cases nothing produces; (e) stale tests, fixtures, mocks, snapshots, skipped tests; (f) dead CSS (shadow-DOM rule below); (g) dead assets and data files; (h) orphan locale keys including dynamic-prefix families the gate cannot see; (i) redundant re-exports (barrel vs package subpath); (j) comments, docs and CLAUDE.md claims about behaviour that no longer exists; (k) commented-out code.
- Traps that made earlier verdicts wrong (apply them): an index.ts export with zero importers can be live through a package subpath (e.g. @xivdyetools/core/chara, /blending) -> REDUNDANT-RE-EXPORT, not dead; type-position imports hide a never-constructed type from knip; scans that stop at src/ miss scripts/, functions/, e2e/, public/ and package test dirs outside src/; web-app tools render in a shadow root but the same components also mount in light-DOM modals, so 'unreachable CSS' needs a mount-path check; dynamic locale-key prefixes (t(\`glamour.\${x}\`)) hide orphans from the gate; web-app public assets can be served by og-worker; @customElement modules and Web Worker entry files are side-effect/entrypoint modules; a symbol tagged @public is a claim that npm consumers may use it, so removing it needs the semver rule.
- PUBLISHED PACKAGES: @xivdyetools/core and @xivdyetools/bot-logic are published to npm. 'Unused in this repo' is NOT 'unused'. Removing a public export of a published version is MAJOR (apply the repo's version rule: compare package.json with npm view @xivdyetools/<pkg> version; if the local version is already unpublished the change folds into its pending CHANGELOG entry, otherwise MAJOR/MINOR). Find when each legacy symbol first shipped (git log -S '<symbol>' -- <index.ts>, the package CHANGELOG.md). Apps (web-app, discord-worker, api-worker, og-worker) are not published: their removals are semver NONE.
- A dead verdict needs proof: the exact command and its result. 'It looks unused' is not proof. Every claim you cannot prove goes to not_covered or becomes KEEP with a revisit trigger. When unsure, KEEP with a trigger beats a premature removal.
- For every candidate also state the CASCADE: what becomes dead once it is removed (files, tests, exports, data, locale keys, docs) and which candidate must go first.
- Cap: at most 22 candidates, strongest first. Candidate id: <your key>-NN. Count lines removed from tracked files (candidate source + the tests and data that go with it).
- Return the structured result. Your final text IS the return value; do not narrate.`

const SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          category: { type: 'string', enum: ['Unused Export', 'Orphaned File', 'Dead Path', 'Unused Dep', 'Legacy', 'Unused Type', 'Stale Test', 'Dead CSS', 'Dead Asset', 'Orphan i18n', 'Test-only', 'Redundant Re-export'] },
          confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          blast: { type: 'string', enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'] },
          semver: { type: 'string', enum: ['NONE', 'MINOR', 'MAJOR'] },
          deploy_unit: { type: 'string' },
          files: { type: 'string' },
          lines_removed: { type: 'integer' },
          rec: { type: 'string', enum: ['REMOVE', 'REMOVE WITH CAUTION', 'KEEP', 'REFACTOR FIRST'] },
          keep_trigger: { type: 'string' },
          cascade: { type: 'string' },
          evidence: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['id', 'title', 'category', 'confidence', 'blast', 'semver', 'deploy_unit', 'files', 'lines_removed', 'rec', 'evidence', 'fix'],
      },
    },
    positives: { type: 'array', items: { type: 'string' } },
    files_covered: { type: 'integer' },
    not_covered: { type: 'array', items: { type: 'string' } },
    evidence_file: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['candidates', 'positives', 'files_covered', 'evidence_file', 'confidence'],
}

const WH = { agentType: 'xivdye-worker', model: 'opus', effort: 'high' }

const SLICES = [
  { key: 'core-legacy', unit: 'core', focus: 'THE DISPLACED LEGACY CLUSTER in @xivdyetools/core. Files: packages/core/src/services/chara/chara-parser.ts (parseCharaFile, MAX_CHARA_FILE_BYTES, the Parsed*/Chara* types), chara-resolver.ts (resolveCharaColors and the Resolved*/Chara* verdict types), chara-shader-colors.ts, chara-models.ts, packages/core/src/services/CharacterColorService.ts, the data under packages/core/src/data/character_colors/ and packages/core/scripts/build-character-colors.ts (+ package.json script rows), plus their tests (chara-parser.test.ts, chara-resolver.test.ts, ...). The xivcharakit-backed facade (chara-library.ts, chara-library-resolve.ts, chara-palette-provider.ts) replaced the old parse-and-resolve path. Establish, with git grep over tracked files in ALL workspaces (apps/*, packages/*, scripts/, e2e/), who still calls each legacy symbol in PRODUCTION code (bot-logic swatch/glamour, web-app, discord-worker, api-worker, og-worker) versus only in tests; which legacy types are still needed by consumers; whether the palette/character_colors data is still the data source of the facade (chara-palette-provider reads which tables?) or is now duplicated by xivcharakit\'s own bundled palettes; what the 8,000-line parity test packages/core/src/services/chara/__tests__/chara-library-parity.test.ts and its .chara fixtures need from the legacy parser (the deliberate difference register: decide REMOVE/KEEP/REFACTOR FIRST with a revisit trigger); npm publication state of each legacy export (npm view @xivdyetools/core versions --json, git log -S, core CHANGELOG.md) so the semver is right. Produce the CASCADE graph (parser -> resolver -> models -> shader colors -> tests -> parity harness -> data -> script) and name the order of removal.' },
  { key: 'core-facade', unit: 'core', focus: 'THE XIVCHARAKIT FACADE AND ITS NEIGHBOURS in @xivdyetools/core: packages/core/src/chara.ts (the ./chara subpath), services/chara/chara-library.ts, chara-library-resolve.ts, chara-library-types.ts, chara-palette-provider.ts, chara-game-rules.ts, chara-twins.ts, chara-gposers.ts, and the chara block of packages/core/src/index.ts (lines ~183-284). Check: every /** @public */ specifier in that block - is the claim credible (a documented purpose, a downstream consumer in this repo or a plausible npm one, published already?) or is it a convenience tag on something only tests reach; the duplicate export of inspectCharaForTools / resolveCharaWithProvider from both the main barrel and the ./chara subpath (documented design vs redundant re-export; who imports which); exported helpers, constants and types only tests touch (symrefs.sh packages/core ... with the export list in evidence/exports-core-chara.txt and evidence/symrefs-core-chara.txt); issue codes, error codes and verdict codes the code defines but never emits (read the switch/union members against producers); options never passed; indexGap and any field the application projection fills that no consumer reads (check web-app, bot-logic, discord-worker and api-worker consumers); dead branches in the palette provider; tests that assert only removed behaviour; unreachable code after the xivcharakit reader\'s own bounds (e.g. a length or depth check the library already enforces). Also run members.py on any class in the slice.' },
  { key: 'web-app', unit: 'web-app', focus: 'THE WEB APP CHARA SLICE (apps/web-app, 5.16.0): services chara-file-loader.ts, chara-inspection-protocol.ts, chara-inspection-service.ts, chara-resolve-service.ts, chara-session-service.ts; src/workers/chara-inspection.worker.ts; components chara-file-card.ts, chara-sheet.ts, chara-ui.ts, glamour-block.ts (~1,860 lines), glamour-tool.ts, glamour-twin-picker.ts, glamour-list-actions.ts, item-links-menu.ts, shared/item-links.ts, and the chara/swatch/glamour parts of swatch-tool.ts and v4/config-sidebar.ts; scripts/copy-chara-notices.mjs and its test, public/licenses/xivcharakit.txt, e2e specs (swatch-chara-session, reader-license, glamour specs), src/__tests__/mocks/imported-chara.ts. Look for: exports and helpers only tests reach; protocol message types and fields the worker or page never sends or reads; evidence states and issue codes the UI defines but no producer emits; session/cache API only tests use (clearCharaResolveCache is @testonly - check its siblings); dead CSS for chara/glamour/swatch classes (apply the shadow-DOM mount-path rule); orphan locale keys in apps/web-app/src/locales/*.json for the chara reader, including the dynamic-prefix families the i18n gate cannot see (swatch.*, glamour.*, chara.*); stale or skipped tests and unused mocks/fixtures; code paths made unreachable by the move to the inspection worker (anything that still parses on the main thread, fallback paths, feature flags); commented-out code; assets. Remember apps/web-app/e2e, scripts/ and functions/ are entries.' },
  { key: 'bot-discord', unit: 'bot-logic + discord-worker', focus: 'THE BOT SLICE: packages/bot-logic/src/commands/{glamour,swatch,chara-identity}.ts, src/commands/__fixtures__/chara-fixtures.ts (does it ship in dist? it is a test fixture), glamour-library.test.ts / swatch-library.test.ts and the older glamour/swatch tests; the bot i18n locale keys for /glamour and /swatch in packages/bot-logic/src/i18n (six locales; the bot-logic orphan test covers only static keys - check dynamic families by hand); apps/discord-worker/src/utils/chara-attachment.ts, src/handlers/commands/{glamour,swatch}.ts and their tests, the command registry and schemas for /swatch and /glamour. bot-logic is a PUBLISHED package (semver rule applies); discord-worker is not. Look for: exports only tests reach; the SwatchResult/GlamourResult fields no adapter reads; branches and error kinds that nothing produces; leftovers of the removed 5.0 /swatch color|grid subcommands, /match_image and the older file-less shapes (DEPRECATIONS.md, apps/discord-worker/src/commands/registry.ts, schemas.ts): handlers, option keys, locale strings, tests, KV keys still present for commands that no longer exist; the legacy-parser-based code path in swatch.ts/glamour.ts if one survives next to the library path (which of parseCharaFile / resolveCharaColors / inspectCharaForTools / resolveCharaForTools does each bot function call?); duplicated helpers; stale tests.' },
  { key: 'api-og', unit: 'api-worker + og-worker', focus: 'THE RESOLVE BACKEND AND OG CONSUMERS: apps/api-worker/src/chara/** (resolver.ts, router.ts, cache.ts, lookup-loader.ts, xivapi.ts, icons.ts, icon-cache.ts, regional-names.ts, acquisition.ts, types.ts), their tests, the data files under src/chara/data/ (acquisition.en.json, acquisition.meta.json, facewear-unlocks.json, item-names.{ja,ko,zh}.json, item-names.meta.json) and the generator scripts apps/api-worker/scripts/** (build-item-names.mjs, build-acquisition.ts, acquisition/*), plus apps/og-worker/src/services/character-cells.ts and the chara-related parts of og-worker src/og-data-generator.ts and index.ts. Look for: exports only tests reach; cache key versions and row shapes superseded by newer ones (old key builders, migration code for shape 4 -> 5, previous-version readers); resolver fields nothing consumes (check web-app chara-resolve-service.ts, bot-logic glamour.ts, discord-worker glamour handler); data files or JSON fields nothing reads (grep each top-level key of each data file); generator scripts nothing runs (package.json scripts, workflows); routes defined but never called by any client (web-app, bot, docs); og-worker character-cells and og tool routes that no share URL emits; stale tests; docs in apps/api-worker/docs/ describing removed routes or fields.' },
  { key: 'supply-harness', unit: 'core + web-app + CI', focus: 'SUPPLY, CONFIG, ASSETS AND THE TEST HARNESS around the XIVCharaKit adoption: packages/core/NOTICE, apps/web-app/public/licenses/xivcharakit.txt and scripts/copy-chara-notices.mjs (+ test), the package.json exports row ./chara and the tsup config entries of @xivdyetools/core, apps/web-app/scripts/check-bundle-size.js budget rows for chara chunks (any budget key for a chunk that no longer exists?), packages/core/src/__tests__/chara-entry.test.ts, the xivcharakit parity comparison and difference register (packages/core/src/services/chara/__tests__/chara-library-parity.test.ts, fixtures/*.chara, any register markdown under docs/ or packages/core/), the .chara corpus tooling (scripts or docs referencing the CharaSamples folder), dependencies that became unused or redundant because xivcharakit was adopted (package.json of core, web-app, bot-logic, discord-worker: anything that only the removed parser/palette code needed; also pnpm-workspace.yaml overrides or allowBuilds rows for xivcharakit), vite/wrangler config rows for the inspection worker (worker format, chunk names), DEPRECATIONS.md cross-reference (things listed as retired that are still present, and chara things that should have been listed), and CLAUDE.md / docs/projects claims about the legacy parser or removed behaviour in core, web-app, bot-logic, discord-worker (documentation-only drift: report as Legacy with REMOVE/REFACTOR text edits). Also check xivcharakit exports we import versus those we could drop from our facade surface.' },
]

function prompt(s) {
  return PRE + '\n\nYOUR KEY: ' + s.key + '  (deploy unit tag: ' + s.unit + ')\n\nSCOPE / FOCUS:\n' + s.focus
}

async function run(s) {
  const o = { ...WH, label: s.key, phase: 'Review', schema: SCHEMA }
  let r = await agent(prompt(s), o)
  if (!r || r.confidence === 'low' || (r.files_covered || 0) < 3) {
    log('rerun ' + s.key)
    r = await agent(prompt(s), o)
  }
  return r ? { key: s.key, unit: s.unit, ...r } : { key: s.key, unit: s.unit, failed: true, candidates: [], positives: [], files_covered: 0, not_covered: ['agent failed twice'], evidence_file: '', confidence: 'low' }
}

phase('Review')
const results = (await parallel(SLICES.map(s => () => run(s)))).filter(Boolean)
log('round1: ' + results.length + ' returns, ' + results.reduce((n, r) => n + r.candidates.length, 0) + ' candidates')
return { results }
