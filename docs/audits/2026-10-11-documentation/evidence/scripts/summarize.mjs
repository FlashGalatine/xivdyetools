#!/usr/bin/env node
// Collate the workflow result: every candidate with its verifier verdict, refuter vote and tie-break.
//   node summarize.mjs <workflow-output.json> <evidence-dir>
//   → <evidence-dir>/workflow-result.json (raw), verdicts.md (one table), priors.md, coverage.md
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [src, ev] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(src, 'utf8'));
writeFileSync(join(ev, 'workflow-result.json'), JSON.stringify(raw, null, 2));
const items = raw.result ?? raw.results ?? raw.output ?? raw;
const arr = Array.isArray(items) ? items : Object.values(items).find(Array.isArray);
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

const out = ['| cand | cat | rev sev | V1 | V1 sev | kind | refute | Fable | doc | claim → truth | V1 reason | refute reason |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
const priors = ['| cluster | prior | status | note |', '|---|---|---|---|'];
const cov = ['| cluster | file | result | note |', '|---|---|---|---|'];
const tally = {};
for (const it of arr) {
  const key = it.key;
  if (key === 'baseline-live') continue;
  const r = it.review ?? {};
  const vs = new Map((it.verdicts ?? []).map((v) => [v.id, v]));
  const votes = new Map((it.votes ?? []).map((v) => [v.id, v]));
  const fab = new Map((it.escalations ?? []).map((v) => [v.id, v]));
  for (const c of r.candidates ?? []) {
    const v = vs.get(c.id) ?? {}, vo = votes.get(c.id), f = fab.get(c.id);
    let final = v.verdict ?? 'UNVERIFIED';
    if (vo && !vo.upheld) final = f ? f.verdict : 'SPLIT';
    tally[final] = (tally[final] ?? 0) + 1;
    out.push(`| ${c.id} | ${c.category} | ${c.severity} | ${v.verdict ?? '—'} | ${v.severity ?? '—'} | ${v.kind ?? '—'} | ${vo ? (vo.upheld ? 'upheld ' + vo.severity : 'REFUTED') : '—'} | ${f ? f.verdict + ' ' + f.severity : '—'} | ${esc(c.doc_locations)} | ${esc(c.claim)} → ${esc(c.truth)} | ${esc(v.reason)} | ${esc(vo?.reason)}${f ? ' // FABLE: ' + esc(f.reason) : ''} |`);
  }
  for (const p of r.priors ?? []) priors.push(`| ${key} | ${p.id} | ${p.status} | ${esc(p.note)} |`);
  for (const c of r.coverage ?? []) cov.push(`| ${key} | ${esc(c.file)} | ${c.result} | ${esc(c.note)} |`);
}
writeFileSync(join(ev, 'verdicts.md'), out.join('\n') + '\n');
writeFileSync(join(ev, 'priors.md'), priors.join('\n') + '\n');
writeFileSync(join(ev, 'coverage.md'), cov.join('\n') + '\n');
console.log('final tally', tally, 'rows', out.length - 2);
