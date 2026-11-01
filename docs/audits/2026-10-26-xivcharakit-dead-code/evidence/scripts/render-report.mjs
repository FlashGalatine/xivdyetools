// Render DEAD_CODE_REPORT.md and README.md from evidence/final-catalog.json.
// Usage (repo root): node docs/audits/2026-10-26-xivcharakit-dead-code/evidence/scripts/render-report.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'docs/audits/2026-10-26-xivcharakit-dead-code';
const cat = JSON.parse(readFileSync(`${OUT}/evidence/final-catalog.json`, 'utf8'));
const F = cat.findings;
const act = F.filter((f) => f.rec !== 'KEEP');
const keep = F.filter((f) => f.rec === 'KEEP');
const lines = act.reduce((n, f) => n + f.lines, 0);
const byRec = (r) => act.filter((f) => f.rec === r).length;
const short = (s, n) => {
  const x = (s ?? '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
  return x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x;
};
const link = (id) => `[${id}](findings/${id}.md)`;
const row = (f) => `| ${link(f.id)} | ${short(f.title, 150)} | ${f.confidence} | ${f.blast} | ${f.semver} | ${short(f.unit, 40)} | ${f.rec} |`;
const catalog = F.map(row).join('\n');
const quick = act
  .filter((f) => f.rec === 'REMOVE' && f.confidence === 'HIGH' && ['NONE', 'LOW'].includes(f.blast))
  .map((f) => `- ${link(f.id)} — ${short(f.title, 140)}${f.lines ? ` (~${f.lines} lines)` : ''}`)
  .join('\n');
const keepRows = keep
  .map((f) => `| ${link(f.id)} | ${short(f.title, 110)} | ${short(f.trigger || f.decision, 260)} |`)
  .join('\n');
const statusRows = F.map((f) => `| ${f.id} | ${f.rec === 'KEEP' ? 'KEEP (no action)' : 'OPEN'} | — |`).join('\n');

const report = `# Dead-code audit — the XIVCharaKit-facing code (2026-10-26)

- **Branch/commit:** \`claude/xivcharakit-dead-code-audit\` @ \`88189ee8\` (stacked on the security-audit branch of PR #333; no source file differs from \`main\` beyond what that PR already carries). **Scope:** the code where the monorepo interacts with \`xivcharakit@0.1.0-beta.4\` and the older \`.chara\` code it displaced — core 5.15.0, bot-logic 4.11.0, web-app 5.16.0, discord-worker 5.9.0, api-worker 0.21.0, og-worker 2.12.0. **Depth:** exhaustive for the slice (tool evidence, symbol / member / asset / i18n sweeps, npm consumer check).
- **Method:** Step 2 evidence ([knip](evidence/knip-packages-core.txt) clean in all six workspaces, \`tsc --noUnusedLocals\` clean, \`i18n:unused\` clean, \`pnpm dead-code:check\` passes ([output](evidence/dead-code-check.txt)), baseline gates green: 26 turbo tasks and every test file in the six units); six slice reviewers (Opus-high workers) → 66 candidates → 50 groups ([candidate-groups.json](evidence/candidate-groups.json)); every removal group judged by an independent confirming **and** an independent refuting Opus verifier (none split), every KEEP by one auditor; one calibration pass (merged 3 groups, normalized grades, fixed the removal order); npm consumer check ([npm-state.txt](evidence/npm-state.txt)). **No Fable agent and no advisor call was used.**
- **Totals:** **${F.length} findings — ${act.length} actionable (${byRec('REMOVE')} REMOVE, ${byRec('REMOVE WITH CAUTION')} REMOVE WITH CAUTION, ${byRec('REFACTOR FIRST')} REFACTOR FIRST) and ${keep.length} KEEP.** About **${lines.toLocaleString('en-US')} lines** are removable, ${(act.find((f) => f.id === 'DEAD-024')?.lines ?? 0).toLocaleString('en-US')} of them in one MAJOR-gated change. No group was rejected on verification; two reviewer "removals" were narrowed to KEEP.
- **Source changes:** none. Only \`docs/audits/2026-10-26-xivcharakit-dead-code/\` was written.

## What this audit found

The migration to xivcharakit is **complete at runtime**: no production code in any app or package still calls the legacy \`parseCharaFile\` / \`resolveCharaColors\`. Web-app parses inside the inspection worker through \`@xivdyetools/core/chara\`; the bots read through \`inspectCharaForTools\` → \`resolveCharaForTools\`. What keeps the legacy pair alive is **three things only**: the published barrel (\`@public\` tags), its own tests (about 1,050 lines), and the 8,186-line parity harness's \`[host]\` half. That is why knip, \`tsc\` and the reachability gate are all clean.

It cannot simply be deleted:

- \`@xivdyetools/core\` 5.15.0 and \`@xivdyetools/bot-logic\` 4.11.0 are **already on npm**, so removing or narrowing any public export is **MAJOR**, and the legacy exports have never been \`@deprecated\`. The first step is a deprecation (MINOR), then a coordinated core 6.0.0 + bot-logic 5.0.0.
- The legacy files still hold **live code**: \`MAX_CHARA_FILE_BYTES\` (imported by the live facade) and the slot and result types that web-app, bot-logic and the facade use. Those must move first ([DEAD-020](findings/DEAD-020.md), [DEAD-021](findings/DEAD-021.md)).
- The core CLAUDE.md revisit trigger ("legacy parser/resolver stay for now") is still open: beta acceptance of the xivcharakit path is owed.

Everything else is small: 15 internal cleanups (a 245-line protocol validator for dye objects the worker can never send, dead guards, redundant exports, a test fixture that ships in the published bot-logic tarball, bundle-budget rows that match no chunk) and 5 findings about stale comments, docs and \`@public\`/\`@entrypoint\` tags that still describe the legacy parser as the live path.

## Catalog

| ID | Title | Conf | Blast | Semver | Deploy unit | Rec |
|---|---|---|---|---|---|---|
${catalog}

## Quick wins

HIGH confidence, blast NONE or LOW, REMOVE — safe to do first:

${quick}

## KEEP register

Every row has a concrete revisit trigger; nothing here is scheduled.

| ID | Item | Revisit trigger |
|---|---|---|
${keepRows}

## Dependency cleanup

None. The xivcharakit adoption made no dependency unused: the \`package.json\` diff since the adoption adds only \`xivcharakit\` and the \`./chara\` exports row, knip's unused-dependency section is empty in all six workspaces, and \`pnpm-workspace.yaml\` carries no xivcharakit override or build-script entry. \`@xivdyetools/core\` builds with \`tsc\`, so it has no tsup entries to prune.

## Totals

- Removable: **~${lines.toLocaleString('en-US')} lines** across ${act.length} actionable findings; **3 test files** go outright (\`chara-parser.test.ts\`, \`chara-parser-proto.test.ts\`, \`chara-resolver.test.ts\`) and the \`[host]\` half of the parity harness (about 1,650 lines) with them.
- Bundle-before: not measured. Nothing is removed by the audit, the web inspection worker does not carry the legacy parser (it is tree-shaken out), and the web-app bundle budget is re-run in the cleanup sprint that touches it ([DEAD-013](findings/DEAD-013.md)).
- Coverage ratchet: removing fully-covered legacy code can move the aggregate coverage numbers; report the effect when the removal lands and never lower web-app's thresholds.

## Positive controls

- **No main-thread parse path remains** in web-app: \`git grep\` for \`parseCharaFile\`, \`resolveCharaColors\` and \`resolveCharaForTools\` over web-app \`src\`, \`e2e\` and \`scripts\` finds nothing, and the worker imports only \`@xivdyetools/core/chara\`.
- **The facade is cleanly layered:** \`chara-library.ts\` has no runtime path to the palette bridge, shader tables or \`CharacterColorService\`; import-graph tests (\`chara-library.test.ts\`, \`chara-entry.test.ts\`) hold that line, and the host palette bridge is pinned equal to xivcharakit's bundled corpus on every request, so the deliberate data duplication is verified.
- **No orphan locale keys** in the dynamic families the gate cannot see: 147 \`swatch.*\` and 67 \`glamour.*\` web keys were traced one by one; no key survives from the removed \`/swatch color|grid\` subcommands in the bot locales.
- **No dead CSS, no skipped / \`.only\` / todo tests, no snapshots, no commented-out code** in the slice; every e2e selector and every mock is used.
- **No migration code for superseded cache shapes** in api-worker (shape 5 is only a key component), and every class member of \`XivapiClient\`, \`CharaRowCache\`, \`CharaLookupLoader\` and \`CharaIconCache\` has a production reference.
- **The legacy slot shape is isolated** to one documented adapter (\`toLegacySlot\` in bot-logic), and the 261-case parity register with written notes makes the removal decision auditable.

## Rejected suspicions

No group was rejected on verification. Two were narrowed: [DEAD-025](findings/DEAD-025.md) (the chara row cache's stale-while-revalidate window) and [DEAD-026](findings/DEAD-026.md) (eight api-worker exports used only in their own file) turned out to be live and are kept; their comment corrections ride [DEAD-004](findings/DEAD-004.md).

## Recommendations

1. **Make deprecation a step of every replacement.** The legacy pair was never marked \`@deprecated\` and has no \`DEPRECATIONS.md\` entry; add both in the same change that ships a replacement, so the MAJOR is a scheduled event and not a surprise.
2. **Make \`@public\` carry a reason.** Seven \`@public\` tags on facade exports were stale the day their in-repo consumers landed ([DEAD-003](findings/DEAD-003.md)); require a reason after the tag (as \`@testonly\` and \`@entrypoint\` already do) and list each \`@public\` symbol with its first-published version in the gate's output.
3. **Pin the facade's runtime import graph** to exclude \`chara-parser\` and \`chara-resolver\` in \`chara-entry.test.ts\` once [DEAD-020](findings/DEAD-020.md) lands, so the legacy files cannot creep back into the web worker bundle.
4. **Gate the published tarball's file list** (\`npm pack --dry-run\`) so a test fixture cannot ship again ([DEAD-017](findings/DEAD-017.md)); exclude \`__fixtures__/\` in \`tsconfig.build.json\`.
5. **Check that every bundle-budget row matches an emitted chunk** ([DEAD-013](findings/DEAD-013.md)).
6. **Keep the parity harness's library half** as the case-level regression pin for each \`xivcharakit\` beta bump; drop only the legacy half.
7. **Re-run \`symrefs.sh\` on the KEEP register** when the 6.0.0 / 5.0.0 pair is planned: six KEEP rows (the \`extended*\` fields, the provider arm, the barrel duplicate, \`CHARA_WEAPON_SLOTS\`, \`fileText\`, the \`familySize\` fallback) resolve in that release.
8. **Re-audit this slice after xivcharakit leaves beta** — its palette provider guards and \`inactive\` arm are KEEP only because the beta's behavior is not yet frozen ([DEAD-034](findings/DEAD-034.md), [DEAD-035](findings/DEAD-035.md)).

## Limits

Source / configuration audit; read-only. No build, bundle measurement or workerd run was made, and npm consumers of the published \`@public\` exports are unknowable from the repo (that is exactly why their removal is MAJOR). Reviewers read the largest files (\`glamour-block.ts\`, the 8,186-line parity harness) by structure and targeted sections, not line by line; the verifiers re-ran the reference counts for every removal candidate. \`knip --production\` (the test-only tier) was not run for web-app. The other five locale files rely on the existing key-parity gate.

## Remediation status

| ID | Status | Commit |
|---|---|---|
${statusRows}

## Next steps

Follow [CLEANUP_PLAN.md](CLEANUP_PLAN.md), which also lists where its sprints meet the security audit's ([REMEDIATION_PLAN.md](../2026-10-26-security/REMEDIATION_PLAN.md)). Nothing is deleted before the maintainer's explicit yes at the §8 gate.

**§8 decisions (2026-10-26):** the legacy pair leaves by deprecation (core 5.16.0) and then the core 6.0.0 + bot-logic 5.0.0 MAJOR pair once beta acceptance closes; the parity harness drops its legacy \`[host]\` half and keeps the \`[library]\` half; this folder goes out as a stacked docs-only PR. **Remediation has not started.**
`;
writeFileSync(`${OUT}/DEAD_CODE_REPORT.md`, report, 'utf8');

const readme = `# Dead-code audit — the XIVCharaKit-facing code (2026-10-26)

${F.length} findings (${act.length} actionable, ${keep.length} KEEP; ~${lines.toLocaleString('en-US')} lines removable) in the code where the monorepo interacts with xivcharakit. The migration is complete at runtime — no production code calls the legacy \`parseCharaFile\` / \`resolveCharaColors\` — but both are published API with no deprecation, so their removal is a MAJOR release pair (core 6.0.0, bot-logic 5.0.0) after a deprecation MINOR. **No source files were modified by the audit**, and no Fable agent was used. It accompanies the [2026-10-26 security audit](../2026-10-26-security/README.md).

| File | Purpose |
|---|---|
| [DEAD_CODE_REPORT.md](DEAD_CODE_REPORT.md) | The catalog: findings, quick wins, KEEP register, positive controls, recommendations, remediation status |
| [CLEANUP_PLAN.md](CLEANUP_PLAN.md) | Sprint plan by deploy unit, with the interlocks to the security remediation plan |
| [findings/](findings/) | One file per finding (\`DEAD-001\`…\`DEAD-${String(F.length).padStart(3, '0')}\`) |
| [evidence/](evidence/) | Tool output (knip, tsc, i18n, the reachability gate, baseline gates), six slice reviews, candidates → groups → verification → \`final-catalog.json\`, and \`scripts/\` |

## Top items

1. **[DEAD-024](findings/DEAD-024.md) (REFACTOR FIRST, MAJOR)** — core: the legacy parser/resolver pair, its legacy-only public types and the parity harness's \`[host]\` half (~3,560 lines) are reachable only from tests; deprecate in core 5.16, remove in core 6.0 once beta acceptance closes.
2. **[DEAD-020](findings/DEAD-020.md) / [DEAD-021](findings/DEAD-021.md) (REFACTOR FIRST)** — core: \`MAX_CHARA_FILE_BYTES\` and the live slot and result types still live in the legacy files; move them first.
3. **[DEAD-023](findings/DEAD-023.md) (REFACTOR FIRST, MAJOR)** — bot-logic: \`SwatchResult.character\` and its legacy back-mapping (~324 lines) are read by no adapter.
4. **[DEAD-011](findings/DEAD-011.md) (REMOVE WITH CAUTION)** — web-app: the protocol validates dye objects the worker can never send (~245 lines).
5. **[DEAD-017](findings/DEAD-017.md) (REMOVE)** — bot-logic: a test fixture module ships in the published tarball.
6. **[DEAD-003](findings/DEAD-003.md) / [DEAD-002](findings/DEAD-002.md) (REMOVE)** — core: seven stale \`@public\` tags and docs that still describe the legacy parser as the live path.
`;
writeFileSync(`${OUT}/README.md`, readme, 'utf8');
console.log('wrote DEAD_CODE_REPORT.md and README.md;', F.length, 'findings');
