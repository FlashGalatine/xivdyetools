#!/usr/bin/env node
// Generates findings/<ID>.md (conventions.md §3 skeleton) and the three catalog tables from
// findings-manifest.json. Usage: node gen-findings.mjs <audit-folder>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
const manifest = JSON.parse(readFileSync(join(root, 'evidence', 'findings-manifest.json'), 'utf8'));
mkdirSync(join(root, 'findings'), { recursive: true });

const bullets = (arr) => arr.map((s) => `- ${s}`).join('\n');
const rows = { BUG: [], REFACTOR: [], OPT: [] };

for (const f of manifest) {
  const kind = f.id.split('-')[0];
  let header;
  if (kind === 'BUG') {
    header = `**Severity:** ${f.severity} · **Type:** ${f.type} · **Deploy unit:** ${f.unit} · **Covered by test?** ${f.tested}`;
    rows.BUG.push(`| ${f.id} | ${f.title} | ${f.severity} | ${f.type} | ${f.unit} | ${f.tested} |`);
  } else if (kind === 'REFACTOR') {
    header = `**Priority:** ${f.priority} · **Effort:** ${f.effort} · **Risk:** ${f.risk} · **Deploy unit:** ${f.unit}`;
    rows.REFACTOR.push(`| ${f.id} | ${f.title} | ${f.priority} | ${f.effort} | ${f.unit} |`);
  } else {
    header = `**Impact:** ${f.impact} · **Category:** ${f.category} · **Deploy unit:** ${f.unit} · **Expected gain:** ${f.gain} · **Benchmark:** ${f.benchmark}`;
    rows.OPT.push(`| ${f.id} | ${f.title} | ${f.impact} | ${f.category} | ${f.unit} |`);
  }
  const supersedes = f.supersedes ? `\nSupersedes ${f.supersedes}\n` : '';
  const md = `# ${f.id}: ${f.title}
${header}
${supersedes}
## Location
${bullets(f.location)}

## Evidence
${bullets(f.evidence)}

## Fix
${bullets(f.fix)}

## Status
${f.status ?? 'OPEN'}
`;
  writeFileSync(join(root, 'findings', `${f.id}.md`), md);
}

const out = [
  '## BUG catalog', '| ID | Title | Sev | Type | Deploy unit | Tested? |', '|---|---|---|---|---|---|', ...rows.BUG, '',
  '## REFACTOR catalog', '| ID | Title | Pri | Effort | Deploy unit |', '|---|---|---|---|---|', ...rows.REFACTOR, '',
  '## OPT catalog', '| ID | Title | Impact | Category | Deploy unit |', '|---|---|---|---|---|', ...rows.OPT, '',
].join('\n');
writeFileSync(join(root, 'evidence', 'catalog-tables.md'), out);
const sev = {};
for (const f of manifest) if (f.id.startsWith('BUG')) sev[f.severity] = (sev[f.severity] ?? 0) + 1;
console.log(`findings written: ${manifest.length}`, JSON.stringify({ BUG: rows.BUG.length, REFACTOR: rows.REFACTOR.length, OPT: rows.OPT.length, bySeverity: sev }));
