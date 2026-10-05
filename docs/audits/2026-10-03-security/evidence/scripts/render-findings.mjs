// Render findings/FINDING-XXX.md drafts from the workflow result + coordinator overrides.
// Usage (repo root): node docs/audits/2026-10-03-security/evidence/scripts/render-findings.mjs
// Inputs: evidence/workflow-result.json (calibrated + verified rows), evidence/scripts/final-catalog.json
// (coordinator decisions: ordering, re-grades, merges/splits, policy class). Hand edits after
// rendering are expected for split/merged findings; re-running overwrites them, so render once.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'docs/audits/2026-10-03-security';
const wf = JSON.parse(readFileSync(`${OUT}/evidence/workflow-result.json`, 'utf8'));
const cat = JSON.parse(readFileSync(`${OUT}/evidence/scripts/final-catalog.json`, 'utf8'));
mkdirSync(`${OUT}/findings`, { recursive: true });

const pad = (n) => String(n).padStart(3, '0');
const uniq = (xs) => [...new Set(xs.filter(Boolean).map((s) => s.trim()))];

for (const f of cat.findings) {
  const c = wf.calib.findings[f.calib - 1];
  const merged = (f.idx ?? c.merges).map((i) => wf.confirmed[i].final);
  const g = { ...c, ...f };
  const loc = uniq(f.location ?? merged.flatMap((m) => m.location_bullets)).slice(0, f.maxLoc ?? 3);
  const ev = uniq(f.evidence ?? merged.flatMap((m) => m.evidence_bullets)).slice(0, f.maxEv ?? 3);
  const fix = uniq(f.fix ?? merged[0].fix_bullets).slice(0, 3);
  const policy =
    g.policy === 'NONE'
      ? 'NONE'
      : `${g.policy} ${g.policy_doc}${g.policy_variants?.length ? ` — variants: ${g.policy_variants.map((p) => '`' + p + '`').join(', ')}` : ''}`;
  const extra = [
    g.regression_of ? `**Regression of / supersedes:** ${g.regression_of}` : null,
    g.sprint0 ? '**Sprint 0:** yes — exploitable now; ship individually, out-of-band' : null,
    g.reconcile_case ? `**Reconcile case:** ${g.reconcile_case} (Step 3a)` : null,
    f.note ? `**Coordinator note:** ${f.note}` : null,
  ].filter(Boolean);
  const md = `# FINDING-${pad(f.id)}: ${g.title}
**Severity:** ${g.severity} · **Exposure:** ${g.exposure} · **Deploy unit:** ${g.unit} · **Rotation:** ${g.rotation} · **Policy:** ${policy} · **CWE:** ${g.cwe || 'n/a'}
${extra.length ? extra.join(' · ') + '\n' : ''}
## Location
${loc.map((l) => `- ${l}`).join('\n')}

## Evidence
${ev.map((l) => `- ${l}`).join('\n')}

## Fix
${fix.map((l) => `- ${l}`).join('\n')}

## Status
OPEN
`;
  writeFileSync(`${OUT}/findings/FINDING-${pad(f.id)}.md`, md, 'utf8');
}
console.log(`rendered ${cat.findings.length} findings`);
