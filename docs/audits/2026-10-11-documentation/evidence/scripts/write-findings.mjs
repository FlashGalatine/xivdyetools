#!/usr/bin/env node
// Generate findings/DOC-NNN.md from the coordinator's merged draft + the merged-verification
// workflow's results (+ the hand-written spelling findings), and print a catalog table.
//   node write-findings.mjs <verify-result.json>
// The coordinator owns titles, units and severity overrides (OVERRIDES below); the verifier
// supplies exact locations, evidence and corrected fix text.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const AUD = 'docs/audits/2026-10-11-documentation';
const draft = JSON.parse(readFileSync(join(AUD, 'evidence/findings-draft.json'), 'utf8'));
const spelling = JSON.parse(readFileSync(join(AUD, 'evidence/findings-spelling.json'), 'utf8'));
const verify = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const vres = new Map((verify.result?.results ?? verify.results ?? []).map((r) => [r.id, r]));
const OVERRIDES = JSON.parse(readFileSync(join(AUD, 'evidence/coordinator-overrides.json'), 'utf8'));

const BASELINE = 'production `16a6123f` = HEAD `42c35e87` for code (checked 2026-10-11)';
const POLICY_BASELINE = '`main` `42c35e87` (policy files are read from the repository)';
// Wrap a leading bare `path:line` in backticks (conventions §3); already-ticked bullets pass through.
const tick = (x) => x.replace(/^((?:docs|apps|packages|scripts|\.github)\/[^\s`:—]+(?::[\d,\-]+)?)/, '`$1`');
const bullets = (xs) => xs.filter(Boolean).slice(0, 3).map((x) => `- ${tick(x.replace(/^[-•]\s*/, ''))}`).join('\n');

mkdirSync(join(AUD, 'findings'), { recursive: true });
const catalog = [];
const skipped = [];
for (const d of draft) {
  const v = vres.get(d.id);
  const o = OVERRIDES[d.id] ?? {};
  if (!v) { skipped.push(`${d.id}: no verifier result`); continue; }
  if (v.verdict === 'REJECTED' && !o.keep) { skipped.push(`${d.id}: REJECTED — ${v.reason}`); continue; }
  const sev = o.sev ?? v.severity ?? d.sev;
  const title = o.title ?? d.title;
  const base = /policy/.test(title) ? POLICY_BASELINE : BASELINE;
  const lines = [
    `# ${d.id}: ${title}`,
    `**Severity:** ${sev} · **Deploy unit:** ${o.unit ?? d.unit} · **Baseline:** ${base}`,
  ];
  if (d.supersedes) lines.push(`Supersedes \`${d.supersedes}\`.`);
  lines.push('', '## Location', bullets(v.location));
  if (v.also && v.also.trim()) lines.push('', `Also: ${v.also.trim()}`);
  lines.push('', '## Evidence', bullets(o.evidence ?? v.evidence));
  if (v.dropped && v.dropped.trim()) lines.push('', `*Narrowed at verification:* ${v.dropped.trim()}`);
  lines.push('', '## Fix', `- ${(o.fix ?? v.fix ?? d.fix).replace(/\n+/g, ' ')}`, '', '## Status', 'OPEN', '');
  writeFileSync(join(AUD, 'findings', `${d.id}.md`), lines.join('\n'));
  catalog.push({ id: d.id, title, sev, unit: o.unit ?? d.unit, supersedes: d.supersedes ?? '', verdict: v.verdict });
}
for (const s of spelling) {
  const lines = [
    `# ${s.id}: ${s.title}`,
    `**Severity:** ${s.sev} · **Deploy unit:** ${s.unit} · **Baseline:** ${s.id === 'DOC-079' ? POLICY_BASELINE : BASELINE}`,
    `Supersedes \`${s.supersedes}\`.`,
    '', '## Location', bullets(s.location),
    '', '## Evidence', bullets(s.evidence),
    '', '## Fix', bullets(s.fix),
    '', '## Status', 'OPEN', '',
  ];
  writeFileSync(join(AUD, 'findings', `${s.id}.md`), lines.join('\n'));
  catalog.push({ id: s.id, title: s.title, sev: s.sev, unit: s.unit, supersedes: s.supersedes, verdict: 'CONFIRMED' });
}
writeFileSync(join(AUD, 'evidence/catalog.json'), JSON.stringify(catalog, null, 2));
const over = [];
for (const f of catalog) {
  const n = readFileSync(join(AUD, 'findings', `${f.id}.md`), 'utf8').trimEnd().split('\n').length;
  if (n > 25) over.push(`${f.id} (${n} lines)`);
}
console.log(`wrote ${catalog.length} findings; skipped ${skipped.length}`);
for (const s of skipped) console.log('  skipped ' + s);
if (over.length) console.log('over 25 lines: ' + over.join(', '));
const by = (s) => catalog.filter((f) => f.sev === s).length;
console.log(`HIGH ${by('HIGH')} · MEDIUM ${by('MEDIUM')} · LOW ${by('LOW')}`);
