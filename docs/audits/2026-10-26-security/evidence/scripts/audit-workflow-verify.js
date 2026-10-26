export const meta = {
  name: 'security-audit-verify-2026-10-26',
  description: 'Adversarial verification of 73 candidate groups (confirmer + refuter + tie-break, Opus verifiers, no Fable) and a severity x exposure calibration pass',
  phases: [
    { title: 'Verify', detail: 'confirmer and refuter per group; INFO groups get one verifier' },
    { title: 'Calibrate', detail: 'one consistency pass over every confirmed group' },
  ],
}

const E = 'docs/audits/2026-10-26-security/evidence'
const SCRATCH = '/c/Users/DrawF/AppData/Local/Temp/claude/C--dev-XIVProjects-xivdyetools--claude-worktrees-xivdyetools-chara-integration-b6c47b/de6dd161-aa43-4593-a3f4-77eb767f3c78/scratchpad'

const COMMON = `Context: security audit of the xivdyetools monorepo, 2026-10-26, HEAD 13c386e5 (cwd = monorepo root of a git worktree). A reviewer raised the candidate(s) below; findings are leads, not gospel. You are a VERIFIER: your verdict decides whether this is filed, at what severity, and whether it ships in a fix sprint.

Load the candidate rows verbatim with this command (cwd = repo root):
node -e 'const g=require("./${E}/candidate-groups.json").find(x=>x.gid==="@GID@");const c=require("./${E}/candidates.json");console.log(JSON.stringify(g.members.map(i=>c.find(y=>y.id===i)),null,1))'
The reviewer evidence file named in each row's reviewer key is ${E}/review-<reviewer>.md (read it for the route table and positive controls if useful).

RULES
- Read-only: write NO files in the repo. Scratch probes only under ${SCRATCH} (node scripts, single vitest files with --coverage.enabled=false). Never run deploy/publish/wrangler-remote/network-mutating commands. GET-only gh api for GitHub settings is allowed. Do not use Cloudflare MCP tools.
- Search tracked files only (git grep / git ls-files); never grep -r.
- Open every file:line yourself and read the surrounding function AND its callers/middleware chain. Line numbers may be a few lines off: find the real one and report it. Confirm on what the file says, not how the claim is worded.
- Do not accept: accepted trade-offs in docs/architecture/security-trade-offs.md; items in the Positive controls / Rejected suspicions of docs/audits/2026-10-03-security/SECURITY_AUDIT_REPORT.md and docs/audits/2026-10-15-web-app-security/SECURITY_AUDIT_REPORT.md. Say so in already_covered_by when you reject for that reason.
- Exposure: INTERNET-UNAUTH (any internet client), INTERNET-AUTH (valid user JWT / signed Discord interaction / moderator), INTERNAL (service binding only), LOCAL (build, dev, CI, repo settings).
- Severity: CRITICAL (unauth RCE, secret exposure, auth bypass); HIGH (privilege escalation, other users' data exposed, or a field a policy explicitly promises is never stored/logged); MEDIUM (exploitable weakness with real bounded impact, or an undisclosed personal-data field); LOW (hardening with a reachable but minor effect; policy text that is false but harmless); INFO (no direct effect). Severity x Exposure orders the sprints.
- This project's stance is "collect nothing personal". A personal field that creeps into a log, datapoint, KV/D1/R2 record or outbound body is a finding even if harmless-looking.
- Policy findings: classify per Step 3a. Code collecting something undisclosed with no documented purpose => policy NONE (fix the code). Necessary => minimize first, then "AMEND <file> section". Policy describing something the code does not do => "CORRECT <file> section". For CORRECT/AMEND list EVERY locale variant to edit in variants (<STEM>.<ja|de|fr|ko|zh>.md siblings and the matching locales/*.json keys).
- If the verdict depends on live state you cannot read (Cloudflare dashboard, deployed secrets, DNS), give your verdict on what the repo shows and name the dependency in live_state_dependency.
- verdict: CONFIRMED (real, reachable as described), PARTIAL (real but narrower or lower-severity than claimed - say how), REJECTED (not real, not reachable, already guarded, or by design - name the guard with file:line).
- Output only the structured result. reachable_path = who sends what to reach it, in two sentences at most. why <= 3 sentences. fix_direction <= 3 lines.`

const SCHEMA = {
  type: 'object',
  properties: {
    gid: { type: 'string' },
    verdict: { type: 'string', enum: ['CONFIRMED', 'PARTIAL', 'REJECTED'] },
    title: { type: 'string' },
    file: { type: 'string' },
    line: { type: 'integer' },
    severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] },
    exposure: { type: 'string', enum: ['INTERNET-UNAUTH', 'INTERNET-AUTH', 'INTERNAL', 'LOCAL'] },
    deploy_unit: { type: 'string' },
    reachable_path: { type: 'string' },
    preconditions: { type: 'string' },
    why: { type: 'string' },
    already_covered_by: { type: 'string' },
    fix_direction: { type: 'string' },
    policy: { type: 'string' },
    variants: { type: 'string' },
    rotation: { type: 'string' },
    cwe: { type: 'string' },
    live_state_dependency: { type: 'string' },
    evidence_excerpt: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['gid', 'verdict', 'title', 'file', 'line', 'severity', 'exposure', 'deploy_unit', 'reachable_path', 'why', 'fix_direction', 'policy', 'rotation', 'confidence'],
}

const V = { agentType: 'xivdye-verifier' }

const pConfirm = gid => COMMON.replace('@GID@', gid) + `\n\nYOUR ROLE: CONFIRMING VERIFIER for group ${gid}. Establish the facts at file:line, trace the real call path from an attacker/user entry point (or, for policy/config items, from the document/config to the code), and grade severity and exposure honestly. If the claim is a bundle of several sub-claims, say which are real in why/preconditions and grade the group by its strongest real part.`
const pRefute = gid => COMMON.replace('@GID@', gid) + `\n\nYOUR ROLE: ADVERSARIAL REFUTER for group ${gid}, working independently of any other verifier. Treat the claim as wrong until proven. Look hard for: a guard the reviewer missed (earlier middleware, upstream validation, a size or rate cap, platform behaviour such as Cloudflare/Discord enforcing it for us), a prior accepted trade-off or rejected suspicion, unreachability (who can actually send that input?), a misreading of the code, or a test that already pins the behaviour. Only after a serious attempt, if you cannot refute it, return CONFIRMED or PARTIAL. Grade severity as low as is honestly defensible.`
const pTie = (gid, a, b) => COMMON.replace('@GID@', gid) + `\n\nYOUR ROLE: TIE-BREAKER for group ${gid}. Two independent verifiers disagreed on whether this is real. Re-open the code yourself first, then read both opinions and decide. You are not bound to either.\n\nOPINION A (confirmer): ${JSON.stringify(a)}\n\nOPINION B (refuter): ${JSON.stringify(b)}\n\nIf you genuinely cannot settle it from the repo, return your best verdict with confidence "low" and say in why exactly what evidence is missing.`

const cls = v => (v.verdict === 'REJECTED' ? 'R' : 'C')

async function ask(prompt, label, retry) {
  let r = await agent(prompt, { ...V, label, phase: 'Verify', schema: SCHEMA })
  if (!r && retry) {
    log('retry ' + label)
    r = await agent(prompt, { ...V, label: label + '-retry', phase: 'Verify', schema: SCHEMA })
  }
  return r
}

async function verifyGroup(g) {
  const gid = g[0]
  const sev = g[1]
  const two = sev !== 'INFO'
  const [a, b] = await Promise.all([ask(pConfirm(gid), gid + ':confirm', true), two ? ask(pRefute(gid), gid + ':refute', true) : Promise.resolve(null)])
  const flags = []
  let v3 = null
  let finalVerdict = 'NO_RESULT'
  let disputed = false
  if (!two) {
    if (a) finalVerdict = a.verdict
    flags.push('single-verifier(INFO)')
  } else if (a && b) {
    if (cls(a) === cls(b)) {
      finalVerdict = cls(a) === 'R' ? 'REJECTED' : a.verdict === 'PARTIAL' || b.verdict === 'PARTIAL' ? 'PARTIAL' : 'CONFIRMED'
    } else {
      v3 = await ask(pTie(gid, a, b), gid + ':tiebreak', true)
      flags.push('split-vote')
      if (!v3 || v3.confidence === 'low') {
        disputed = true
        finalVerdict = 'DISPUTED'
      } else {
        finalVerdict = v3.verdict
      }
    }
  } else if (a || b) {
    finalVerdict = (a || b).verdict
    flags.push('one-verifier-null')
  }
  if (a && a.confidence === 'low') flags.push('confirmer-low')
  if (b && b.confidence === 'low') flags.push('refuter-low')
  return { gid, sev_in: sev, a, b, v3, final_verdict: finalVerdict, disputed, flags }
}

phase('Verify')
const groups = args.groups
log('groups to verify: ' + groups.length)
const results = (await parallel(groups.map(g => () => verifyGroup(g)))).filter(Boolean)
const tally = {}
for (const r of results) tally[r.final_verdict] = (tally[r.final_verdict] || 0) + 1
log('verdict tally ' + JSON.stringify(tally))

phase('Calibrate')
const kept = results.filter(r => r.final_verdict === 'CONFIRMED' || r.final_verdict === 'PARTIAL')
const rows = kept.map(r => {
  const lead = r.v3 || r.a || r.b
  const op = x => (x ? { v: x.verdict, sev: x.severity, exp: x.exposure } : null)
  return { gid: r.gid, in: r.sev_in, ops: { a: op(r.a), b: op(r.b), v3: op(r.v3) }, title: lead.title, unit: lead.deploy_unit, exposure: lead.exposure, severity: lead.severity, path: lead.reachable_path, pre: lead.preconditions, why: lead.why, policy: lead.policy, live: lead.live_state_dependency || '' }
})
const CAL_SCHEMA = {
  type: 'object',
  properties: {
    items: { type: 'array', items: { type: 'object', properties: { gid: { type: 'string' }, severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] }, exposure: { type: 'string', enum: ['INTERNET-UNAUTH', 'INTERNET-AUTH', 'INTERNAL', 'LOCAL'] }, changed: { type: 'boolean' }, reason: { type: 'string' }, merge_into: { type: 'string' }, maintainer_decision: { type: 'string' } }, required: ['gid', 'severity', 'exposure', 'changed', 'reason'] } },
    sprint0: { type: 'array', items: { type: 'string' } },
    inconsistencies: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['items', 'sprint0', 'inconsistencies', 'confidence'],
}
const calPrompt = 'You are the calibration verifier for a security audit of xivdyetools (2026-10-26). Read-only; write no files. Below are the confirmed/partial candidate groups with the severity and exposure each verifier proposed. Apply ONE rubric consistently:\nCRITICAL unauth RCE / secret exposure / auth bypass; HIGH privilege escalation, other users\' data exposed, or a field a policy explicitly promises is never stored/logged; MEDIUM exploitable weakness with real bounded impact, or an undisclosed personal-data field; LOW hardening with a reachable but minor effect, or policy text that is false but harmless; INFO no direct effect (documentation drift, optional hardening with no reachable path). Exposure: INTERNET-UNAUTH / INTERNET-AUTH / INTERNAL (service binding only) / LOCAL (build, dev, CI, repo settings). Severity x Exposure orders sprints: an INTERNET-UNAUTH MEDIUM outranks a LOCAL HIGH.\nTasks: (1) For each group return the final severity and exposure; set changed=true and give a reason when you move either. Be consistent: same kind of issue, same grade. Do not inflate; do not hide a real exposure. (2) Name groups that are really the same root cause and should be ONE finding (merge_into = the surviving gid). (3) sprint0 = gids that are exploitable now by an unauthenticated or low-privilege party and should ship out-of-band; most audits have none, and an empty list is a correct answer. (4) maintainer_decision = non-empty when the fix needs the maintainer to choose (a new public policy commitment, a live-state check only they can do, a product trade-off). (5) inconsistencies = anything in the inputs that contradicts itself. Open code only if you must settle a grade; the verifiers already did.\n\nGROUPS:\n' + JSON.stringify(rows)
const calibration = await agent(calPrompt, { ...V, label: 'calibration', phase: 'Calibrate', schema: CAL_SCHEMA })

return { results, calibration, tally }
