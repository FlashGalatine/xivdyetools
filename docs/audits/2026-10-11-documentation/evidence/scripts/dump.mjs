#!/usr/bin/env node
// Print one or more clusters' candidates with verdicts, compactly (coordinator triage aid).
import { readFileSync } from 'node:fs';
const r = JSON.parse(readFileSync('docs/audits/2026-10-11-documentation/evidence/workflow-result.json', 'utf8'));
const only = process.argv[2].split(',');
const cut = (s, n) => String(s ?? '').slice(0, n);
for (const it of r.result) {
  if (!only.includes(it.key)) continue;
  if (it.key === 'baseline-live') { console.log(it.text); continue; }
  const vs = new Map((it.verdicts || []).map((v) => [v.id, v]));
  const vo = new Map((it.votes || []).map((v) => [v.id, v]));
  console.log('\n=== ' + it.key);
  for (const c of it.review.candidates) {
    const v = vs.get(c.id) || {}, o = vo.get(c.id);
    console.log(`- ${c.id.replace('cand-', '')} [${c.category}/${c.severity} -> ${v.verdict} ${v.severity} ${v.kind}${o ? ' refute:' + (o.upheld ? 'up ' + o.severity : 'REF') : ''}]${c.supersedes ? ' SUP ' + c.supersedes : ''}`);
    console.log(`   DOC: ${c.doc_locations}\n   CLAIM: ${cut(c.claim, 260)}\n   TRUTH: ${cut(c.truth, 380)}\n   SRC: ${cut(c.source_evidence, 260)}\n   FIX: ${cut(c.suggested_fix, 260)}\n   V: ${cut(v.reason, 260)}`);
  }
  console.log('PRIORS: ' + (it.review.priors || []).map((p) => `${p.id}=${p.status} (${cut(p.note, 160)})`).join(' || '));
}
