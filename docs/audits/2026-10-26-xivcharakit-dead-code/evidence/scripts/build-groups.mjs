import fs from 'node:fs'

const E = 'docs/audits/2026-10-26-xivcharakit-dead-code/evidence'
const r1 = JSON.parse(fs.readFileSync(`${E}/workflow-round1-result.json`, 'utf8'))
const cands = []
for (const x of r1.results) for (const c of x.candidates) cands.push({ ...c, reviewer: x.key })
fs.writeFileSync(`${E}/candidates.json`, JSON.stringify(cands, null, 1))

// same root cause found by more than one slice reviewer (or one root cause per deploy unit for stale comments/docs)
const MERGES = [
  ['core-legacy-03', 'core-facade-01', 'supply-harness-01'], // parseCharaFile + resolveCharaColors: test-only legacy pair
  ['core-legacy-05', 'supply-harness-02'], // parity harness host half
  ['core-legacy-06', 'core-legacy-07', 'bot-discord-04', 'bot-discord-05', 'supply-harness-03'], // bot-logic swatch.test legacy oracle and mock
  ['core-facade-03', 'supply-harness-05'], // barrel vs ./chara subpath duplicate
  ['core-legacy-08', 'core-legacy-09', 'core-facade-05', 'supply-harness-08', 'supply-harness-09', 'supply-harness-10'], // core stale comments + docs
  ['api-og-01', 'api-og-02', 'api-og-03', 'api-og-06'], // api-worker stale comments
]
const byId = new Map(cands.map(c => [c.id, c]))
const used = new Set()
const groups = []
for (const m of MERGES) {
  for (const id of m) if (!byId.has(id)) throw new Error('unknown id ' + id)
  m.forEach(id => used.add(id))
  groups.push(m)
}
for (const c of cands) if (!used.has(c.id)) groups.push([c.id])

const out = groups.map(ids => {
  const rows = ids.map(i => byId.get(i))
  const lead = rows.find(r => r.rec !== 'KEEP') ?? rows[0]
  const anyAction = rows.some(r => r.rec !== 'KEEP')
  return { members: ids, title: lead.title, rec: anyAction ? lead.rec : 'KEEP', unit: lead.deploy_unit, lines: Math.max(...rows.map(r => r.lines_removed || 0)) }
})
// order: actionable first (by lines desc), then KEEP
out.sort((a, b) => (a.rec === 'KEEP') - (b.rec === 'KEEP') || b.lines - a.lines)
out.forEach((g, i) => { g.gid = 'D' + String(i + 1).padStart(2, '0') })
fs.writeFileSync(`${E}/candidate-groups.json`, JSON.stringify(out, null, 1))
console.log('candidates', cands.length, 'groups', out.length, 'actionable', out.filter(g => g.rec !== 'KEEP').length, 'keep', out.filter(g => g.rec === 'KEEP').length)
console.log(JSON.stringify(out.map(g => [g.gid, g.rec === 'KEEP' ? 'KEEP' : 'ACT'])))
for (const g of out) console.log(g.gid, g.rec.padEnd(20), g.members.length > 1 ? `[${g.members.length}]` : '   ', g.title.slice(0, 95))
