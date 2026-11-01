// Render findings/DEAD-XXX.md and evidence/final-catalog.json from the verification result.
// Usage (repo root): node docs/audits/2026-10-26-xivcharakit-dead-code/evidence/scripts/render-findings.mjs
// Inputs: evidence/workflow-verify-result.json, evidence/candidate-groups.json, evidence/candidates.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/audits/2026-10-26-xivcharakit-dead-code';
const E = `${OUT}/evidence`;
const ver = JSON.parse(readFileSync(`${E}/workflow-verify-result.json`, 'utf8'));
const groups = new Map(JSON.parse(readFileSync(`${E}/candidate-groups.json`, 'utf8')).map((g) => [g.gid, g]));
const cands = new Map(JSON.parse(readFileSync(`${E}/candidates.json`, 'utf8')).map((c) => [c.id, c]));
const res = new Map(ver.results.map((r) => [r.gid, r]));
const cal = new Map(ver.calibration.items.map((i) => [i.gid, i]));

// calibration merges (same root cause) — the survivor carries the members' locations
const MERGED_INTO = { D02: 'D01', D05: 'D01', D29: 'D12' };
const TITLES = {
  D01: 'Legacy parseCharaFile / resolveCharaColors pair, its legacy-only public types and the parity harness [host] half are reachable only from tests: deprecate in core 5.16, remove in core 6.0',
  D12: 'Stale comments and docs around the xivcharakit facade still describe the legacy parser as the live path, and two @entrypoint tags are inert',
};
// the calibrator's removal order for actionable groups; KEEP groups follow in gid order
const ORDER = ver.calibration.removal_order;
const actionable = [];
const keeps = [];
for (const g of [...groups.keys()]) {
  if (MERGED_INTO[g]) continue;
  const c = cal.get(g);
  if (!c) continue;
  (c.rec === 'KEEP' ? keeps : actionable).push(g);
}
actionable.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
keeps.sort();

const t = (s, n) => {
  const x = (s ?? '').replace(/\s+/g, ' ').trim();
  return x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x;
};
const pad = (n) => String(n).padStart(3, '0');
mkdirSync(`${OUT}/findings`, { recursive: true });

const catalog = [];
const all = [...actionable, ...keeps];
all.forEach((gid, i) => {
  const id = `DEAD-${pad(i + 1)}`;
  const r = res.get(gid);
  const c = cal.get(gid);
  const lead = r.v3 ?? r.a ?? r.b;
  const mergedGroups = [gid, ...Object.entries(MERGED_INTO).filter(([, to]) => to === gid).map(([from]) => from)];
  const memberIds = mergedGroups.flatMap((g) => groups.get(g).members);
  const lines = mergedGroups.reduce((n, g) => n + ((res.get(g).v3 ?? res.get(g).a ?? res.get(g).b).lines_removed || 0), 0);
  const title = (TITLES[gid] ?? lead.title) + (lines > 0 && c.rec !== 'KEEP' ? ` — ~${lines.toLocaleString('en-US')} lines` : '');
  const locs = [];
  const seen = new Set();
  for (const g of mergedGroups) {
    const l = res.get(g).v3 ?? res.get(g).a ?? res.get(g).b;
    for (const f of (l.files || '').split(/;\s*/).filter(Boolean)) {
      const k = f.trim();
      if (!seen.has(k)) {
        seen.add(k);
        locs.push(k);
      }
    }
  }
  const locBullets = locs.slice(0, 3).map((x) => `- \`${t(x, 330)}\``);
  const refuter = r.b && r.b.verdict === 'PARTIAL' ? ` Refuter's narrowing: ${t(r.b.why, 330)}` : '';
  const ev = [
    `- ${t(lead.proof, 720)}`,
    `- ${t(lead.why, 620)}${refuter}`,
  ];
  if (lead.live_consumer) ev.push(`- Still live: ${t(lead.live_consumer, 360)}`);
  const fix = [];
  const recLine =
    c.rec === 'KEEP'
      ? `**KEEP** — revisit trigger: ${t(c.maintainer_decision || lead.keep_trigger || '', 380) || t(lead.keep_trigger, 380)}`
      : `**${c.rec}** — ${t(lead.steps, 560)}`;
  fix.push(`- ${recLine}`);
  if (c.rec === 'KEEP' && lead.keep_trigger && c.maintainer_decision) fix.push(`- Trigger as verified: ${t(lead.keep_trigger, 360)}`);
  if (lead.prerequisite && c.rec !== 'KEEP') fix.push(`- Prerequisite: ${t(lead.prerequisite, 300)}`);
  if (lead.cascade) fix.push(`- Cascade: ${t(lead.cascade, 420)}`);
  if (lead.published_note) fix.push(`- Published: ${t(lead.published_note, 320)}`);
  if (c.rec !== 'KEEP' && c.maintainer_decision) fix.push(`- **Maintainer decision:** ${t(c.maintainer_decision, 380)}`);
  const extra = [];
  if (mergedGroups.length > 1) extra.push(`**Merged:** ${mergedGroups.slice(1).join(', ')} (same root cause, per the calibration pass)`);
  if (c.changed) extra.push(`**Calibration:** ${t(c.reason, 300)}`);
  const md = `# ${id}: ${title}
**Confidence:** ${c.confidence} · **Blast radius:** ${c.blast} · **Deploy unit:** ${t(lead.deploy_unit, 110)} · **Semver:** ${c.semver} · **Category:** ${lead.category || 'Legacy'}
${extra.length ? extra.join(' · ') + '\n' : ''}
## Location
${locBullets.join('\n')}

## Evidence
${ev.join('\n')}

## Fix
${fix.slice(0, 5).join('\n')}

## Status
OPEN
`;
  writeFileSync(`${OUT}/findings/${id}.md`, md, 'utf8');
  catalog.push({ id, gid, merged: mergedGroups.slice(1), candidates: memberIds, rec: c.rec, confidence: c.confidence, blast: c.blast, semver: c.semver, unit: lead.deploy_unit, category: lead.category, title, lines, decision: c.maintainer_decision ?? '', trigger: lead.keep_trigger ?? '', prerequisite: lead.prerequisite ?? '' });
});
writeFileSync(`${E}/final-catalog.json`, JSON.stringify({ findings: catalog, order: ORDER, versionPlan: ver.calibration.version_plan, inconsistencies: ver.calibration.inconsistencies, mergedInto: MERGED_INTO }, null, 1));
const tally = {};
for (const f of catalog) tally[f.rec] = (tally[f.rec] || 0) + 1;
console.log(`rendered ${catalog.length} findings`, tally, 'actionable', actionable.length, 'keep', keeps.length, 'lines', catalog.reduce((n, f) => n + (f.rec === 'KEEP' ? 0 : f.lines), 0));
