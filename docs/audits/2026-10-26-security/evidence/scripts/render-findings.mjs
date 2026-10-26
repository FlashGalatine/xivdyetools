// Render findings/FINDING-XXX.md from the verification result + coordinator decisions.
// Usage (repo root): node docs/audits/2026-10-26-security/evidence/scripts/render-findings.mjs
// Inputs: evidence/workflow-verify-result.json, evidence/candidate-groups.json, evidence/candidates.json.
// Writes: findings/*.md, evidence/final-catalog.json. Re-running overwrites hand edits, so render once.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/audits/2026-10-26-security';
const E = `${OUT}/evidence`;
const ver = JSON.parse(readFileSync(`${E}/workflow-verify-result.json`, 'utf8'));
const groups = new Map(JSON.parse(readFileSync(`${E}/candidate-groups.json`, 'utf8')).map((g) => [g.gid, g]));
const cands = new Map(JSON.parse(readFileSync(`${E}/candidates.json`, 'utf8')).map((c) => [c.id, c]));
const res = new Map(ver.results.map((r) => [r.gid, r]));
const cal = new Map(ver.calibration.items.map((i) => [i.gid, i]));

// ---- coordinator decisions ------------------------------------------------------------
// merged into another finding (kept in the survivor's Location list)
const MERGED_INTO = { G19: 'G20', G25: 'G04', G49: 'G01', G65: 'G01' };
// verified real but not security findings: routed to other skills (listed in the report, no file)
const NOT_PROMOTED = {
  G37: 'BUG handoff (deep-dive-analysis): /glamour embed truncation math + unrecorded failed edit; not attacker-reachable',
  G44: 'DEAD/DOC handoff: stoat-worker (parked) loads unused Upstash credentials and admin roster; environment-variables.md describes a fallback that does not exist',
  G48: 'DOC handoff: worker-kit getClientIp JSDoc says X-Forwarded-For is trusted by default; the code defaults to false',
  G51: 'BUILD handoff: bot-logic dist ships the chara test-fixture module (tsconfig.build.json exclude list)',
  G52: 'DOC handoff (documentation-audit): docs/architecture/service-bindings.md shows an unsigned presets-api call and overstates binding scope',
  G66: 'DOC handoff: stale Perspective-sunset comment in presets-api moderation-service.ts:212 (code queues every local pass as unscored)',
  G67: 'BUG handoff: .chara label truncation can leave ill-formed UTF-16 (cosmetic U+FFFD in the web card only)',
};
// dropped after verification
const REJECTED_COORD = {
  G24: 'Coordinator rejected, agreeing with the calibration pass over two CONFIRMED votes: the Collection Manager delete control is not reachable in the live v4 UI (production Harmony tool probed 2026-10-26: the Favorites panel has no Manage button, the dye-selector component that carried it is not rendered), so PRIVACY.md:59-62 is accurate. The false sentence is :36-40, filed under the Swatch character-save finding.',
};
const OVERRIDES = {
  G01: { title: 'api-worker reads XIVAPI search/Glasses bodies unbounded and caches item names with no length cap, control or bidi filtering (7-day cache; quadratic downstream sinks)', cwe: 'CWE-400' },
  G02: { severity: 'MEDIUM', grade: 'MEDIUM by the skill rule (an undisclosed personal field, "not argue they are low-risk"). Both verifiers and the calibration pass argued LOW: the data subject is a staff moderator acting in a private channel and the policy already lists moderator IDs. Same shape as 2026-10-03/FINDING-002 — confirm at the §8 gate.', cwe: 'CWE-359' },
  G04: { title: "Swatch 'Save character colors' names its local record after the .chara nickname or file name, and PRIVACY.md tells users to rename or delete that record with controls the v4 UI does not expose" },
  G06: { supersedes: '2026-10-03-security/FINDING-023 (still open: regression sweep verdict PARTIAL)', rotation: 'NONE (optionally reset the bot tokens if the repository-scope copies are not trusted)' },
  G20: { title: 'bot-logic sanitizeEmbedText leaves Discord <...> syntax live (channel, slash-command, emoji, timestamp) and omits bidi isolates, Arabic letter mark and tag characters', cwe: 'CWE-74' },
  G22: { related: '2026-10-03-security/FINDING-025 (dev-tree advisories; the override floor was the fix)' },
  G32: { related: '2026-10-03-security/FINDING-014 (residual of the identity re-key fix)' },
  G36: { related: '2026-10-03-security/FINDING-014' },
  G09: { related: '2026-08-29-security PAPI-6 ("moderate tags" never landed)' },
  G40: { related: '2026-10-03-security/FINDING-019; DEPRECATIONS.md Perspective sunset 2026-12-31' },
  G55: { related: '2026-10-03-security/FINDING-030' },
  G63: { supersedes: '2026-10-03-security/FINDING-024 (residual: enforce_admins and strict still off)' },
  G64: { supersedes: '2026-10-03-security/FINDING-027 (optional hardening not done)' },
  G01x: {},
};

const SEV = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const EXP = ['INTERNET-UNAUTH', 'INTERNET-AUTH', 'INTERNAL', 'LOCAL'];
const t = (s, n) => {
  const x = (s ?? '').replace(/\s+/g, ' ').trim();
  return x.length > n ? x.slice(0, n - 1).trimEnd() + '…' : x;
};
const clean = (s) => (s ?? '').replace(/\r/g, '').trim();

const keep = [];
for (const r of ver.results) {
  if (!['CONFIRMED', 'PARTIAL'].includes(r.final_verdict)) continue;
  if (MERGED_INTO[r.gid] || NOT_PROMOTED[r.gid] || REJECTED_COORD[r.gid]) continue;
  const c = cal.get(r.gid) ?? {};
  const lead = r.v3 ?? r.a ?? r.b;
  const o = OVERRIDES[r.gid] ?? {};
  keep.push({
    gid: r.gid,
    lead,
    r,
    severity: o.severity ?? c.severity ?? lead.severity,
    exposure: o.exposure ?? c.exposure ?? lead.exposure,
    title: o.title ?? lead.title,
    o,
    c,
  });
}
keep.sort((x, y) => SEV.indexOf(x.severity) - SEV.indexOf(y.severity) || EXP.indexOf(x.exposure) - EXP.indexOf(y.exposure) || x.gid.localeCompare(y.gid));

mkdirSync(`${OUT}/findings`, { recursive: true });
const pad = (n) => String(n).padStart(3, '0');
const catalog = [];

keep.forEach((k, i) => {
  const id = `FINDING-${pad(i + 1)}`;
  const { lead, r, o, c } = k;
  const memberGroups = [k.gid, ...Object.entries(MERGED_INTO).filter(([, to]) => to === k.gid).map(([from]) => from)];
  const memberIds = memberGroups.flatMap((g) => groups.get(g).members);
  const locs = [];
  const seen = new Set();
  const addLoc = (file, line, text) => {
    const key = `${file}:${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    locs.push(`- \`${file}:${line}\` — ${t(text, 230)}`);
  };
  addLoc(lead.file, lead.line, lead.title);
  for (const mid of memberIds) {
    const m = cands.get(mid);
    addLoc(m.file, m.line, m.title);
  }
  const ev = [];
  if (lead.evidence_excerpt) ev.push(`- ${t(lead.evidence_excerpt, 760)}`);
  ev.push(`- Reach: ${t(lead.reachable_path, 520)}`);
  const why = [t(lead.why, 640), lead.preconditions ? `Preconditions: ${t(lead.preconditions, 300)}` : ''].filter(Boolean).join(' ');
  ev.push(`- ${why}`);
  if (lead.live_state_dependency) ev.push(`- Live state the repo cannot show: ${t(lead.live_state_dependency, 320)}`);
  const fixLines = clean(lead.fix_direction).split(/\n+/).filter(Boolean).slice(0, 3).map((l) => `- ${t(l, 420)}`);
  if (c.maintainer_decision) fixLines.push(`- **Maintainer decision:** ${t(c.maintainer_decision, 380)}`);
  const policyRaw = clean(lead.policy) || 'NONE';
  const policy = t(policyRaw, 175);
  if (!/^NONE/i.test(policyRaw)) {
    if (policyRaw.length > 175) fixLines.push(`- Policy detail: ${t(policyRaw, 420)}`);
    if (lead.variants) fixLines.push(`- Policy variants to edit (all in one commit, all \`Last updated\` lines bumped): ${t(lead.variants, 420)}`);
  }
  const headExtra = [
    o.supersedes ? `**Supersedes:** ${o.supersedes}` : null,
    o.related ? `**Related:** ${o.related}` : null,
    o.grade ? `**Grade note:** ${o.grade}` : null,
    r.flags.includes('split-vote') ? `**Verification:** split vote (${[r.a, r.b].map((x) => x?.verdict?.[0] ?? '-').join('/')}), settled by a third verifier` : null,
    memberGroups.length > 1 ? `**Merged:** ${memberGroups.slice(1).join(', ')} (same root cause)` : null,
  ].filter(Boolean);
  const md = `# ${id}: ${k.title}
**Severity:** ${k.severity} · **Exposure:** ${k.exposure} · **Deploy unit:** ${t(lead.deploy_unit, 120)} · **Rotation:** ${o.rotation ?? (lead.rotation && !/^none/i.test(lead.rotation) ? lead.rotation : 'NONE')} · **Policy:** ${policy} · **CWE:** ${o.cwe ?? (lead.cwe || memberIds.map((m) => cands.get(m).cwe).find(Boolean) || 'n/a')}
${headExtra.length ? headExtra.join(' · ') + '\n' : ''}
## Location
${locs.slice(0, 4).join('\n')}

## Evidence
${ev.join('\n')}

## Fix
${fixLines.join('\n')}

## Status
OPEN
`;
  writeFileSync(`${OUT}/findings/${id}.md`, md, 'utf8');
  catalog.push({
    id,
    gid: k.gid,
    merged: memberGroups.slice(1),
    candidates: memberIds,
    severity: k.severity,
    exposure: k.exposure,
    unit: lead.deploy_unit,
    title: k.title,
    policy: policyRaw,
    rotation: o.rotation ?? 'NONE',
    decision: c.maintainer_decision ?? '',
    live: lead.live_state_dependency ?? '',
  });
});

const rejected = ver.results
  .filter((r) => r.final_verdict === 'REJECTED' || REJECTED_COORD[r.gid])
  .map((r) => {
    const v = r.v3 ?? r.a ?? r.b;
    return { gid: r.gid, candidates: groups.get(r.gid).members, title: groups.get(r.gid).title, reason: REJECTED_COORD[r.gid] ?? `${t(v.why, 420)} Covered by: ${t(v.already_covered_by, 220)}` };
  });
writeFileSync(
  `${E}/final-catalog.json`,
  JSON.stringify({ findings: catalog, notPromoted: NOT_PROMOTED, rejected, mergedInto: MERGED_INTO }, null, 1),
);
console.log(`rendered ${catalog.length} findings; rejected ${rejected.length}; not promoted ${Object.keys(NOT_PROMOTED).length}`);
const tally = {};
for (const f of catalog) tally[f.severity] = (tally[f.severity] || 0) + 1;
console.log(tally);
