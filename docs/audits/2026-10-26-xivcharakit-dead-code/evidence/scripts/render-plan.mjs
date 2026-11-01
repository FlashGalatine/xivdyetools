// Render CLEANUP_PLAN.md from evidence/final-catalog.json plus the sprint assignment below.
// Usage (repo root): node docs/audits/2026-10-26-xivcharakit-dead-code/evidence/scripts/render-plan.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'docs/audits/2026-10-26-xivcharakit-dead-code';
const cat = JSON.parse(readFileSync(`${OUT}/evidence/final-catalog.json`, 'utf8'));
const F = new Map(cat.findings.map((f) => [f.id, f]));
const link = (id) => `[${id}](findings/${id}.md)`;
const short = (s, n) => {
  const x = (s ?? '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
  return x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x;
};

// one action per actionable finding (the sprint is where its row sits)
const ACTION = {
  'DEAD-001': 'Comments only: `swatch-tool.ts:1103`, `glamour-block.ts:244-247,302-304`, `chara-resolve-service.ts:3`, the app `CLAUDE.md:136`.',
  'DEAD-006': 'Drop the unreachable `ISSUE_KEY` entry for `EYE_PAIRING_UNCONFIRMED` (it falls to the default).',
  'DEAD-007': 'Remove the facewear-era `dye.itemID <= 0` guard in the swatch matching loops (always false since schema v2).',
  'DEAD-008': 'Import `MONO` / `SANS` from `chara-ui` instead of redefining them in `swatch-tool.ts`.',
  'DEAD-009': 'Remove `CharaResolveUnavailableError.status` (never read, no caller checks the error type).',
  'DEAD-010': 'Remove `CharaResolveResult.version` (stored, never read). First confirm no planned client use of the XIVAPI version key.',
  'DEAD-011': 'Remove the non-null dye-object validators from the inspection protocol (~245 lines); keep the worker\'s dye-null assertions green — they become the guard.',
  'DEAD-012': 'Make `actionsHost` / `onSubmitPalette` required and delete the missing-host fallbacks in `GlamourBlock`.',
  'DEAD-013': 'Remove the `check-bundle-size.js` rows that match no emitted chunk (vendor-spectral, other vendor, dye selector); re-run `build:check`.',
  'DEAD-014': 'Drop `downloadCharaAttachment`\'s text-only shape and the adapters\' `fileText` pass-through; the adapters assert `fileBytes`.',
  'DEAD-004': 'Correct the stale docs and comments: icon caching, the resolve "consumer" claim, the `latest`-version claim, the orphaned `POST /resolve` origin comment, and the `cache.ts:20` stale-while-revalidate comment.',
  'DEAD-018': 'Delete the redundant `status === 503` test in `XivapiClient.get`.',
  'DEAD-019': 'Drop the `CharaTwinRules` re-export from `types.ts`.',
  'DEAD-002': 'Fix the stale comments, docs and READMEs (shader-table reader claims, "lands in the stacked change", `@entrypoint` docblocks on `chara.ts` and `copy-chara-notices.mjs`, core CLAUDE.md / services.md / overview.md, the npm README and NOTICE credit for xivcharakit).',
  'DEAD-003': 'Remove the seven stale `/** @public */` tags on chara-facade barrel exports that now have in-repo consumers.',
  'DEAD-020': 'Move `MAX_CHARA_FILE_BYTES` into `chara-library.ts` (or a tiny `chara-limits.ts`); keep the barrel export unchanged and rewrite the stale doc.',
  'DEAD-021': 'Relocate the live slot, result and `StainIdLookup` types out of `chara-parser.ts` / `chara-resolver.ts`; type `race` as `Race | null`; same exported names. In the same release add `@deprecated` to the legacy pair and its legacy-only types plus a `DEPRECATIONS.md` entry targeting 6.0.0 (phase 1 of [DEAD-024](findings/DEAD-024.md)).',
  'DEAD-005': 'Fix the comments and README that describe the legacy parser\'s errors and value echoes (the README ships to npm).',
  'DEAD-015': 'Remove the unreachable `?? \'card.slotSkin\'` slot-label fallback.',
  'DEAD-016': 'Un-export the module-internal `getCharacterColors` and `CharaFileSource`.',
  'DEAD-017': 'Exclude `__fixtures__/` in `tsconfig.build.json` so the test fixture stops shipping in the tarball; add an `npm pack --dry-run` file-list check.',
  'DEAD-022': 'Replace the four legacy-oracle sites and the `vi.fn` resolver wrapper in `swatch.test.ts` with facade or literal expectations, so the legacy imports can go in core 6.0.',
  'DEAD-024': 'Phase 2 (core 6.0.0, after the deprecation release has shipped and beta acceptance has closed): delete `parseCharaFile`, `resolveCharaColors`, the legacy-only types, the three legacy test files and the parity harness\'s `[host]` half; drop the barrel rows; update the three docs. Phase 1 (the `@deprecated` tags) is in Sprint 4.',
  'DEAD-023': 'Remove `SwatchResult.character` and its legacy `ResolvedCharaSlot` back-mapping; first ship `@deprecated` tags in a 4.x minor and rewrite the library tests to assert on the card and embed.',
};
const SPRINTS = [
  {
    n: 1,
    title: 'web-app (PATCH): protocol, resolve service and glamour cleanups',
    intro: 'Eight small app-level edits plus the budget rows. Merging redeploys the web app and its beta. **Interlock:** the security plan\'s Sprint 8 edits the same files (`chara-inspection-protocol.ts`, `chara-resolve-service.ts`) — land this sprint first, it shrinks them, or fold both into one web-app release.',
    ids: ['DEAD-001', 'DEAD-006', 'DEAD-007', 'DEAD-008', 'DEAD-009', 'DEAD-010', 'DEAD-011', 'DEAD-012', 'DEAD-013'],
    ends: '`pnpm turbo run build type-check lint test --filter=xivdyetools-web-app...` and `pnpm --filter xivdyetools-web-app run build:check` → merge → `deploy-web-app.yml` (beta follows `deploy-web-app-beta.yml`).',
  },
  {
    n: 2,
    title: 'discord-worker (PATCH): single attachment shape',
    intro: 'Must merge **before** bot-logic 5.0.0 (Sprint 7) so the narrowing of `fileText` finds no live call site. Independent of the security plan\'s Sprint 5; the two can share a release.',
    ids: ['DEAD-014'],
    ends: '`pnpm turbo run build type-check lint test --filter=xivdyetools-discord-worker...` → merge → `deploy-discord-worker.yml` (production). Bare `deploy` is the beta bot.',
  },
  {
    n: 3,
    title: 'api-worker (PATCH): docs and two internal edits',
    intro: 'The v1 HTTP contract is unchanged (the `version` response field and `?version=` stay — see [DEAD-042](findings/DEAD-042.md), [-043](findings/DEAD-043.md)). **Interlock:** the security plan\'s Sprint 7 edits `xivapi.ts` (FINDING-002); [DEAD-018](findings/DEAD-018.md) is in `XivapiClient.get` — make it the same PR.',
    ids: ['DEAD-004', 'DEAD-018', 'DEAD-019'],
    ends: '`pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker...` → merge → `deploy-api-worker.yml` (production).',
  },
  {
    n: 4,
    title: 'core 5.16.0 (publish): relocations, deprecations, doc and tag cleanup',
    intro: 'Everything here is additive or internal, so one MINOR. **Interlock:** the security plan\'s Sprint 12 (core + svg publish for the quadratic-sink hardening) should ride the same 5.16.0 bump. Verify the barrel is unchanged (`diff` the built `dist/index.d.ts` before and after).',
    ids: ['DEAD-020', 'DEAD-021', 'DEAD-002', 'DEAD-003'],
    ends: '`pnpm turbo run build type-check lint test --filter=@xivdyetools/core...` and `pnpm dead-code:check` → bump `packages/core/package.json` (MINOR) and the CHANGELOG → merge → Actions → "Publish Packages to npm" → `@xivdyetools/core`.',
  },
  {
    n: 5,
    title: 'bot-logic (publish): test oracle, internals, tarball hygiene',
    intro: 'Depends on core ^5.16.0. **Interlock:** the security plan\'s Sprint 2 publishes bot-logic for the sanitizer fixes (FINDING-021, -014, -043). Ship one release if the order allows; if Sprint 2 has already shipped 4.12.0 this sprint is 4.13.0 — the version numbers here are provisional. Also add the `@deprecated` tags this release owes the MAJOR pair (`SwatchResult.character`, `SwatchInput` / `GlamourInput.fileText`, `NO_INPUT`, the `familySize` fallback — see [DEAD-023](findings/DEAD-023.md), [DEAD-038](findings/DEAD-038.md), [DEAD-039](findings/DEAD-039.md)).',
    ids: ['DEAD-022', 'DEAD-005', 'DEAD-015', 'DEAD-016', 'DEAD-017'],
    ends: '`pnpm turbo run build type-check lint test --filter=@xivdyetools/bot-logic...` → bump (MINOR) and the CHANGELOG → merge → Actions → "Publish Packages to npm" → `@xivdyetools/bot-logic`; consumers (discord-worker, moderation-worker, stoat-worker) pick it up at their next deploy.',
  },
  {
    n: 6,
    title: 'core 6.0.0 (publish, MAJOR): remove the legacy parser pair — maintainer decision, isolated',
    intro: 'The maintainer chose the MAJOR path at the §8 gate on 2026-10-26. **Gated on:** (1) the Sprint 4 release carrying the `@deprecated` tags and the `DEPRECATIONS.md` entry; (2) beta acceptance of web-app 5.16.0 and discord-worker 5.9.0 on the xivcharakit path in production (the core CLAUDE.md:191 revisit trigger); (3) Sprints 2 and 5 merged. Also resolves the `@public`-tagged KEEP rows if chosen: [DEAD-027](findings/DEAD-027.md), [-028](findings/DEAD-028.md), [-029](findings/DEAD-029.md), [-030](findings/DEAD-030.md).',
    ids: ['DEAD-024'],
    ends: '`pnpm turbo run build type-check lint test --filter=@xivdyetools/core...` and `pnpm dead-code:check` → bump to 6.0.0 with a BREAKING CHANGELOG note pointing to `inspectCharaForTools` / `resolveCharaForTools` → merge → Actions → "Publish Packages to npm" → `@xivdyetools/core`.',
  },
  {
    n: 7,
    title: 'bot-logic 5.0.0 (publish, MAJOR) and the consumer redeploys',
    intro: '**Gated on** core 6.0.0 being on npm (the same maintainer decision applies). Also makes `fileBytes` required and drops `fileText` / `NO_INPUT` ([DEAD-038](findings/DEAD-038.md)) and makes `familySize` required ([DEAD-039](findings/DEAD-039.md)). Then redeploy the consumers: discord-worker MINOR (adapters on bot-logic 5.0.0), web-app PATCH (the `extended*` fields leave the protocol and mocks if [DEAD-027](findings/DEAD-027.md) is taken), og-worker and api-worker rebuild against core 6.0.0 with no source change — the merge redeploys **all production workers**. **Conflict:** [FINDING-043](../2026-10-26-security/findings/FINDING-043.md) (drop the raw `TypeName` from `SwatchResult.character`) is superseded by [DEAD-023](findings/DEAD-023.md) now that this MAJOR is approved; if the maintainer reverses that, FINDING-043 ships in Sprint 5.',
    ids: ['DEAD-023'],
    ends: '`pnpm turbo run build type-check lint test --filter=@xivdyetools/bot-logic...` → bump to 5.0.0 → merge → Actions publish `@xivdyetools/bot-logic`; then one merge per consumer deploy workflow (`deploy-discord-worker.yml`, `deploy-web-app.yml`, `deploy-api-worker.yml`, `deploy-og-worker.yml`; `oauth` untouched).',
  },
];

const sprintBlocks = SPRINTS.map((s) => {
  const rows = s.ids
    .map((id) => {
      const f = F.get(id);
      return `| ${link(id)} | dead-code | ${f.confidence} / ${f.blast} · ${f.semver} · ${f.rec} | ${ACTION[id]} |`;
    })
    .join('\n');
  return `## Sprint ${s.n} — ${s.title}
${s.intro}

| ID | Source | Conf / Blast · Semver · Rec | Item |
|---|---|---|---|
${rows}

**Ends with:** ${s.ends}
`;
}).join('\n');

const scheduled = new Set(SPRINTS.flatMap((s) => s.ids));
const unscheduled = cat.findings.filter((f) => f.rec !== 'KEEP' && !scheduled.has(f.id));
if (unscheduled.length) throw new Error('unscheduled actionable findings: ' + unscheduled.map((f) => f.id).join(','));

const keepRows = cat.findings
  .filter((f) => f.rec === 'KEEP')
  .map((f) => `| ${link(f.id)} | ${short(f.title, 100)} | ${short(f.trigger || f.decision, 240)} |`)
  .join('\n');

const plan = `# Cleanup Plan — XIVCharaKit-facing code (2026-10-26)
**Sources:** [2026-10-26-xivcharakit-dead-code](DEAD_CODE_REPORT.md) — ${cat.findings.length} findings · **Status basis:** ${cat.findings.length} total — 0 fixed, ${scheduled.size} scheduled, 0 superseded (one conditional, see *Conflicts*), ${cat.findings.length - scheduled.size} KEEP, 0 need rotation
**Ordering:** 1. one deploy unit per sprint (a package change is one publish sprint, then the consumer deploys) 2. Confidence × Blast first — comments and internal app edits before anything published 3. cascades after their trigger (relocate live code, deprecate, then remove) 4. the MAJOR pair isolated and last

No P0: nothing here is an emergency. **Merging to \`main\` is the deploy**; bare \`wrangler deploy\` is production on \`oauth\` and the live beta on \`og-worker\` / \`discord-worker\`. Each sprint ends with the unit gate and, before a merge, \`pnpm turbo run build type-check lint test\` and \`pnpm dead-code:check\`. Re-grep every symbol immediately before \`git rm\`, stage only your own paths, and report the coverage ratchet effect of removing fully-covered code.

## Interlocks with the security remediation plan

This plan accompanies [the security plan](../2026-10-26-security/REMEDIATION_PLAN.md) and keeps its sprint numbers. The shared files and releases:

| This plan | Security plan | Overlap | Rule |
|---|---|---|---|
| Sprint 1 web-app | Sprint 8 web-app | \`chara-inspection-protocol.ts\` (FINDING-045 vs DEAD-011), \`chara-resolve-service.ts\` (FINDING-048 vs DEAD-010 / DEAD-009) | Sprint 1 first, or one release |
| Sprint 2 discord-worker | Sprint 5 discord-worker | the swatch / glamour adapters | independent; may share a release; must precede Sprint 7 |
| Sprint 3 api-worker | Sprint 7 api-worker | \`xivapi.ts\` (FINDING-002 vs DEAD-018) | same PR |
| Sprint 4 core 5.16.0 | Sprint 12 core + svg | the quadratic-sink hardening (FINDING-002) | one core 5.16.0 bump |
| Sprint 5 bot-logic | Sprint 2 bot-logic | sanitizers (FINDING-021, -014) and \`SwatchResult.character\` (FINDING-043) | one bot-logic MINOR; needs core ^5.16.0, so Security Sprint 2 either waits for core 5.16.0 or ships first and this becomes the next MINOR |
| Sprints 6 and 7 (MAJOR pair) | all | redeploys every production worker | after the security sprints 1–8 have merged |

## Conflicts

| Conflict | Resolution |
|---|---|
| [FINDING-043](../2026-10-26-security/findings/FINDING-043.md) (fix) vs [DEAD-023](findings/DEAD-023.md) (remove the same field) | Removal wins **only if** the bot-logic 5.0.0 MAJOR is approved: FINDING-043 is then superseded by DEAD-023. If not, FINDING-043 stands and ships in Sprint 5. |
| FINDING-045 / -048 (fix) vs DEAD-011 / DEAD-010 (remove) in the same web-app files | Fix stands; sequence per the interlock table. |

## Decisions needed at the §8 gate

| # | Item | Decision |
|---|---|---|
| 1 | Legacy removal path ([DEAD-024](findings/DEAD-024.md), [DEAD-023](findings/DEAD-023.md)) | **DECIDED 2026-10-26:** deprecate now, then cut the core 6.0.0 + bot-logic 5.0.0 pair once beta acceptance closes (Sprints 4–7). This supersedes security FINDING-043. |
| 2 | Parity harness | **DECIDED 2026-10-26:** drop the legacy \`[host]\` half with the legacy pair; keep the \`[library]\` half as the regression pin for each xivcharakit beta bump. |
| 3 | \`@public\` KEEP rows resolved by the MAJOR ([DEAD-027](findings/DEAD-027.md)–[030](findings/DEAD-030.md)) | **Open:** take them in 6.0.0 or keep the published surface. Decide when Sprint 6 is planned. DEAD-038 and DEAD-039 (bot-logic \`@public\`) are already scheduled in Sprint 7 with bot-logic 5.0.0 and need no separate decision. |
| 4 | Starting work | Nothing starts until the maintainer names a sprint; no removal, version bump, publish or deploy happens before that explicit yes. |

${sprintBlocks}
## Superseded findings
| ID | Superseded by | Why |
|---|---|---|
| 2026-10-26-security/FINDING-043 | [DEAD-023](findings/DEAD-023.md) | **Conditional** on the MAJOR pair being approved (see *Conflicts*) |

## KEEP register

Unscheduled; each has a concrete revisit trigger. Six of them (DEAD-027–030, DEAD-038, DEAD-039) resolve in the Sprint 6–7 MAJOR pair if the maintainer takes it.

| ID | Item | Revisit trigger |
|---|---|---|
${keepRows}

## Standing guidance
- Verify each finding's evidence against the code before removing — findings are leads, and the verifiers read the tree at \`88189ee8\`.
- One commit per task (or per sprint when tiny); gate at every sprint boundary (\`release-mechanics.md\` → Standing verification gate); stage only your own paths with \`git commit --only -- <paths>\`.
- Route each sprint's agents by role (\`.agents/skills/audit-shared/model-routing.md\` § *Remediation sprints*): collectors run the gates, workers implement and review, a verifier settles what ships — and **no Fable agent** unless the maintainer says otherwise. Sprints 4–7 (published packages) get a verifier review lens, not only a final verdict.
- "Unused in this repo" is not "unused" for a published export: the version rule applies (\`npm view @xivdyetools/<pkg> version\` against \`package.json\`). Deprecate in a MINOR before any MAJOR removal.
- Re-run \`evidence/scripts/\` (symrefs, the reachability gate, knip) after each sprint; removals unlock new findings.
- Annotate executed sprints in the heading: **✅ COMPLETED <date> <commits>** + **Deploy needs:** — the plan doubles as the tracker.
`;
writeFileSync(`${OUT}/CLEANUP_PLAN.md`, plan, 'utf8');
console.log('wrote CLEANUP_PLAN.md;', scheduled.size, 'scheduled,', cat.findings.length - scheduled.size, 'KEEP');
