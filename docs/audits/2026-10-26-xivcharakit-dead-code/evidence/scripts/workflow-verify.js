export const meta = {
  name: 'xivcharakit-dead-code-verify',
  description: 'Verify 50 dead-code candidate groups: confirming + refuting Opus verifiers for removals, one KEEP auditor per KEEP, then a calibration and removal-order pass (no Fable)',
  phases: [
    { title: 'Verify', detail: 'confirmer and refuter per removal group; one auditor per KEEP group' },
    { title: 'Calibrate', detail: 'one pass: confidence x blast, semver, cascade order, version plan' },
  ],
}

const E = 'docs/audits/2026-10-26-xivcharakit-dead-code/evidence'
const SCRATCH = '/c/Users/DrawF/AppData/Local/Temp/claude/C--dev-XIVProjects-xivdyetools--claude-worktrees-xivdyetools-chara-integration-b6c47b/de6dd161-aa43-4593-a3f4-77eb767f3c78/scratchpad'

const COMMON = `Context: dead-code audit of the code where the xivdyetools monorepo interacts with the XIVCharaKit library (xivcharakit@0.1.0-beta.4, adopted 2026-10-26 in core 5.15.0, web-app 5.16.0, bot-logic 4.11.0, discord-worker 5.9.0) and the older .chara code it displaced. cwd = monorepo root of a git worktree, HEAD 88189ee8. A slice reviewer raised the candidate(s) below; reviewer claims are leads. Eight 'dead' verdicts were wrong as filed in the 2026-09-01 audit, so YOU decide on proof you re-run yourself. NOTHING IS REMOVED by this audit.

Load the candidate rows verbatim:
node -e 'const g=require("./${E}/candidate-groups.json").find(x=>x.gid==="@GID@");const c=require("./${E}/candidates.json");console.log(JSON.stringify(g.members.map(i=>c.find(y=>y.id===i)),null,1))'
The reviewer evidence file for each row is ${E}/review-<reviewer>.md.

RULES
- Read-only: write NO files in the repo. Scratch under ${SCRATCH} only. No installs, deploys or publishes. Read-only npm queries (npm view ...) are allowed.
- Count references over TRACKED files only (git grep -n -w, git ls-files | xargs grep, bash ${E}/scripts/symrefs.sh <unit> <symbols>, python ${E}/scripts/members.py <file> <Class>). Never grep -r. Re-run the reviewer's commands and add your own; include scripts/, e2e/, functions/, public/, package.json scripts, vite/wrangler/tsup configs, GitHub workflows and docs as possible consumers.
- Traps: an index.ts export with no importers can be live via a package subpath (@xivdyetools/core/chara, /blending) -> REDUNDANT-RE-EXPORT not dead; type-position imports hide never-constructed types from knip; shadow-DOM components also mount in light-DOM modals; dynamic locale-key prefixes hide orphans from the i18n gate; Web Worker entries, @customElement modules and Pages functions are entrypoints; a /** @public */ tag is a claim that npm consumers may use the symbol; a test is a consumer only of the test-only tier (it never makes a symbol live).
- PUBLISHED PACKAGES: @xivdyetools/core (local 5.15.0 == npm latest 5.15.0) and @xivdyetools/bot-logic (local 4.11.0 == npm latest 4.11.0) are published. 'Unused in this repo' is NOT 'unused': removing or changing a public export of a published version is MAJOR (a type-only narrowing of a published type is MAJOR too); an additive change or an @deprecated tag is MINOR; apps are not published (semver NONE). Verify with npm view, git log -S and the package CHANGELOG.md when you rely on it.
- verdict: CONFIRMED (the claim holds: the code is dead / redundant / stale as described and the stated recommendation is safe), PARTIAL (true for part of it: say exactly which part and give the narrower recommendation), REJECTED (it is live or the claim is wrong: name the production consumer or guard at file:line). For a KEEP candidate, CONFIRMED means you AGREE with KEEP (removing it would be unsafe or premature) and REJECTED means it should not be kept (give rec REMOVE/REMOVE WITH CAUTION with proof).
- rec: REMOVE | REMOVE WITH CAUTION (say what to verify first) | KEEP (needs a concrete revisit trigger: a named event or condition, never 'later') | REFACTOR FIRST (name the prerequisite).
- Confidence HIGH|MEDIUM|LOW is about the proof; blast radius NONE|LOW|MEDIUM|HIGH is about what a wrong removal would break (HIGH: runtime or a published API); lines_removed counts tracked lines that go with it (source + tests + data), measured with wc -l / git diff --stat style counting you ran.
- Output only the structured result. proof <= 700 chars: the commands you ran and their results. steps <= 600 chars: the exact removal steps (git rm paths, barrel lines, tests, gate command).`

const SCHEMA = {
  type: 'object',
  properties: {
    gid: { type: 'string' },
    verdict: { type: 'string', enum: ['CONFIRMED', 'PARTIAL', 'REJECTED'] },
    title: { type: 'string' },
    category: { type: 'string' },
    rec: { type: 'string', enum: ['REMOVE', 'REMOVE WITH CAUTION', 'KEEP', 'REFACTOR FIRST'] },
    confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    blast: { type: 'string', enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'] },
    semver: { type: 'string', enum: ['NONE', 'MINOR', 'MAJOR'] },
    deploy_unit: { type: 'string' },
    files: { type: 'string' },
    lines_removed: { type: 'integer' },
    proof: { type: 'string' },
    live_consumer: { type: 'string' },
    cascade: { type: 'string' },
    prerequisite: { type: 'string' },
    keep_trigger: { type: 'string' },
    steps: { type: 'string' },
    published_note: { type: 'string' },
    why: { type: 'string' },
    verifier_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['gid', 'verdict', 'title', 'rec', 'confidence', 'blast', 'semver', 'deploy_unit', 'files', 'lines_removed', 'proof', 'steps', 'why', 'verifier_confidence'],
}

const V = { agentType: 'xivdye-verifier' }
const pConfirm = gid => COMMON.replace('@GID@', gid) + `\n\nYOUR ROLE: CONFIRMING VERIFIER for group ${gid}. Reproduce the reference counts yourself, read the code around each claim, trace every possible consumer (production, tests, scripts, configs, docs, npm), establish the cascade and the exact removal steps, and grade confidence, blast radius and semver.`
const pRefute = gid => COMMON.replace('@GID@', gid) + `\n\nYOUR ROLE: ADVERSARIAL REFUTER for group ${gid}, independent of any other verifier. Try to prove the code is LIVE or that removing it is unsafe: a consumer the reviewer missed (another workspace, scripts/, e2e/, functions/, dynamic import, string-keyed lookup, locale key built at runtime, wrangler/vite/tsup entry, workflow, doc that is a contract), a subpath export, a published-API promise, a behavior the removal would silently change, a test that pins a contract. Only after a serious attempt, if you cannot refute it, return CONFIRMED or PARTIAL.` // gitleaks:allow (prose in a verifier prompt: "key built at runtime")
const pKeep = gid => COMMON.replace('@GID@', gid) + `\n\nYOUR ROLE: KEEP AUDITOR for group ${gid}. The reviewer recommends KEEP. Decide whether KEEP is right: is the code truly reached or deliberately retained (name the consumer, contract or reason), or is it dead and safely removable? If KEEP stands, the revisit trigger must be concrete and checkable (a named release, event, or condition); rewrite it if the reviewer's is vague.`
const pTie = (gid, a, b) => COMMON.replace('@GID@', gid) + `\n\nYOUR ROLE: TIE-BREAKER for group ${gid}. Two independent verifiers disagreed on whether this is removable. Re-open the code yourself first, then read both opinions and decide; you are not bound to either. A genuinely unsettled case gets verifier_confidence "low" and a why that names the missing evidence.\n\nOPINION A (confirmer): ${JSON.stringify(a)}\n\nOPINION B (refuter): ${JSON.stringify(b)}`

const cls = v => (v.verdict === 'REJECTED' ? 'R' : 'C')
async function ask(prompt, label) {
  let r = await agent(prompt, { ...V, label, phase: 'Verify', schema: SCHEMA })
  if (!r) {
    log('retry ' + label)
    r = await agent(prompt, { ...V, label: label + '-retry', phase: 'Verify', schema: SCHEMA })
  }
  return r
}

async function verifyGroup(g) {
  const gid = g[0]
  const kind = g[1]
  if (kind === 'KEEP') {
    const a = await ask(pKeep(gid), gid + ':keep')
    return { gid, kind, a, b: null, v3: null, final_verdict: a ? a.verdict : 'NO_RESULT', disputed: false, flags: a && a.verifier_confidence === 'low' ? ['keep-auditor-low'] : [] }
  }
  const [a, b] = await Promise.all([ask(pConfirm(gid), gid + ':confirm'), ask(pRefute(gid), gid + ':refute')])
  const flags = []
  let v3 = null
  let final = 'NO_RESULT'
  let disputed = false
  if (a && b) {
    if (cls(a) === cls(b)) {
      final = cls(a) === 'R' ? 'REJECTED' : a.verdict === 'PARTIAL' || b.verdict === 'PARTIAL' ? 'PARTIAL' : 'CONFIRMED'
    } else {
      v3 = await ask(pTie(gid, a, b), gid + ':tiebreak')
      flags.push('split-vote')
      if (!v3 || v3.verifier_confidence === 'low') {
        disputed = true
        final = 'DISPUTED'
      } else final = v3.verdict
    }
  } else if (a || b) {
    final = (a || b).verdict
    flags.push('one-verifier-null')
  }
  if (a && a.verifier_confidence === 'low') flags.push('confirmer-low')
  if (b && b.verifier_confidence === 'low') flags.push('refuter-low')
  return { gid, kind, a, b, v3, final_verdict: final, disputed, flags }
}

phase('Verify')
const groups = args.groups
log('groups to verify: ' + groups.length)
const results = (await parallel(groups.map(g => () => verifyGroup(g)))).filter(Boolean)
const tally = {}
for (const r of results) tally[r.kind + ':' + r.final_verdict] = (tally[r.kind + ':' + r.final_verdict] || 0) + 1
log('tally ' + JSON.stringify(tally))

phase('Calibrate')
const rows = results
  .filter(r => r.final_verdict !== 'REJECTED' || r.kind === 'KEEP')
  .map(r => {
    const lead = r.v3 || r.a || r.b
    const op = x => (x ? { v: x.verdict, rec: x.rec, conf: x.confidence, blast: x.blast, semver: x.semver, lines: x.lines_removed } : null)
    return { gid: r.gid, kind: r.kind, final: r.final_verdict, ops: { a: op(r.a), b: op(r.b), v3: op(r.v3) }, title: lead.title, unit: lead.deploy_unit, rec: lead.rec, conf: lead.confidence, blast: lead.blast, semver: lead.semver, lines: lead.lines_removed, cascade: lead.cascade || '', prerequisite: lead.prerequisite || '', trigger: lead.keep_trigger || '', files: lead.files }
  })
const CAL_SCHEMA = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { type: 'object', properties: { gid: { type: 'string' }, rec: { type: 'string', enum: ['REMOVE', 'REMOVE WITH CAUTION', 'KEEP', 'REFACTOR FIRST'] }, confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] }, blast: { type: 'string', enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'] }, semver: { type: 'string', enum: ['NONE', 'MINOR', 'MAJOR'] }, changed: { type: 'boolean' }, reason: { type: 'string' }, merge_into: { type: 'string' }, maintainer_decision: { type: 'string' } }, required: ['gid', 'rec', 'confidence', 'blast', 'semver', 'changed', 'reason'] } },
    removal_order: { type: 'array', items: { type: 'string' } },
    version_plan: { type: 'array', items: { type: 'string' } },
    inconsistencies: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['items', 'removal_order', 'version_plan', 'inconsistencies', 'confidence'],
}
const calPrompt = 'You are the calibration verifier for a dead-code audit of the XIVCharaKit-facing code in the xivdyetools monorepo. Read-only; write no files. Below are the verified groups (removals that survived and every KEEP) with each verifier\'s recommendation. Apply ONE consistent rubric: Confidence HIGH only when the proof is reproducible and every consumer class was checked; Blast NONE (comments, docs, test-only), LOW (internal, tests), MEDIUM (shared runtime or a type in a published signature), HIGH (published runtime API); Semver: published packages @xivdyetools/core 5.15.0 and @xivdyetools/bot-logic 4.11.0 are on npm, so removing or narrowing a public export is MAJOR, adding @deprecated is MINOR, apps and tests are NONE. Tasks: (1) final rec/confidence/blast/semver per group; set changed=true with a reason when you move any; (2) merge_into when two groups are one root cause; (3) maintainer_decision when the choice is the maintainer\'s (a MAJOR release, dropping the parity harness, a public-API trade-off); (4) removal_order: the order of group ids so every cascade and prerequisite is respected (REFACTOR FIRST prerequisites before the removals that need them; docs edits ride with their code change); (5) version_plan: the concrete releases implied, one line each, e.g. which package gets a MINOR (deprecations, relocated types) and which a MAJOR and what lands in it, and which apps ride which release; (6) inconsistencies: contradictions between verifier outputs. Do not re-verify the code; open it only to settle a grade.\n\nGROUPS:\n' + JSON.stringify(rows)
const calibration = await agent(calPrompt, { ...V, label: 'calibration', phase: 'Calibrate', schema: CAL_SCHEMA })
return { results, calibration, tally }
