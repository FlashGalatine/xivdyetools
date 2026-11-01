import fs from 'node:fs'

const E = 'docs/audits/2026-10-26-security/evidence'
const r1 = JSON.parse(fs.readFileSync(`${E}/workflow-round1-result.json`, 'utf8'))
const r2 = JSON.parse(fs.readFileSync(`${E}/workflow-round1b-result.json`, 'utf8'))
const all = [...r1.results, ...r1.gapResults, ...r2.results]
const cands = []
for (const x of all) for (const c of x.candidates) cands.push({ ...c, reviewer: x.key })
fs.writeFileSync(`${E}/candidates.json`, JSON.stringify(cands, null, 1))

// same root cause or same line found by more than one reviewer -> one group, all ids kept
const MERGES = [
  ['api-worker-chara-02', 'injection-sweep-02', 'gap-upstream-game-data-trust-01'],
  ['gap-upstream-game-data-trust-02', 'r2-bot-chara-second-look-02'],
  ['web-app-chara-01', 'policy-web-en-01'],
  ['web-app-chara-02', 'r2-web-chara-second-look-02'],
  ['presets-api-routes-02', 'wrangler-secrets-config-02'],
  ['ci-supply-chain-01', 'regression-b-01'],
  ['policy-de-02', 'policy-fr-02'],
  ['moderation-worker-01', 'r2-presets-api-moderation-auth-01'],
  ['presets-api-routes-01', 'r2-presets-api-moderation-auth-02'],
  ['policy-web-en-09', 'r2-policy-claims-second-pass-04'],
  ['gap-upstream-game-data-trust-03', 'r2-build-time-and-docs-sinks-01'],
]
const byId = new Map(cands.map(c => [c.id, c]))
const used = new Set()
const groups = []
for (const m of MERGES) {
  for (const id of m) if (!byId.has(id)) throw new Error('unknown id in MERGES: ' + id)
  m.forEach(id => used.add(id))
  groups.push(m)
}
for (const c of cands) if (!used.has(c.id)) groups.push([c.id])

const RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }
const out = groups
  .map(ids => {
    const rows = ids.map(i => byId.get(i))
    rows.sort((a, b) => RANK[a.severity] - RANK[b.severity])
    return { members: ids, title: rows[0].title, sev: rows[0].severity, exposure: rows[0].exposure, unit: rows[0].deploy_unit, file: rows[0].file, line: rows[0].line }
  })
  .sort((a, b) => RANK[a.sev] - RANK[b.sev])
out.forEach((g, i) => { g.gid = 'G' + String(i + 1).padStart(2, '0') })
fs.writeFileSync(`${E}/candidate-groups.json`, JSON.stringify(out, null, 1))
console.log('candidates', cands.length, 'groups', out.length)
const counts = {}
for (const g of out) counts[g.sev] = (counts[g.sev] || 0) + 1
console.log(counts)
for (const g of out) console.log(g.gid, g.sev, g.members.length > 1 ? `[${g.members.length}]` : '', g.title.slice(0, 100))
