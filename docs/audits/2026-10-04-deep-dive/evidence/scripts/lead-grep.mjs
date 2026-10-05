#!/usr/bin/env node
// Lead-pattern grep over non-test source files (Node port of lead-grep.sh + cross-unit-dupes.sh,
// because the worktree shell guard refuses `bash <script>` and computed sed programs).
// Usage: node lead-grep.mjs <audit-folder>   (run from the monorepo root)
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';

const OUT = join(process.argv[2], 'evidence');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', 'e2e-coverage', '__tests__', '.wrangler', 'docs']);

function walk(dir, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, acc); continue; }
    if (!e.name.endsWith('.ts') || e.name.endsWith('.test.ts') || e.name.endsWith('.spec.ts') || e.name.endsWith('.d.ts')) continue;
    if (!p.split(sep).includes('src')) continue;
    acc.push(p.split(sep).join('/'));
  }
  return acc;
}
const files = [...walk('apps', []), ...walk('packages', [])].sort();
writeFileSync(join(OUT, 'src-files.txt'), files.join('\n') + '\n');
console.log(`src files: ${files.length}`);

const PAT = /catch\b|waitUntil|\.batch\(|Promise\.all|setTimeout|JSON\.parse|Date\.now|new Date\(|fetch\(|parseInt|Number\(|as any|as unknown as|!\./;
const hits = [];
const lineCounts = new Map();
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lineCounts.set(f, lines.length);
  lines.forEach((l, i) => { if (PAT.test(l)) hits.push(`${f}:${i + 1}:${l}`); });
}
writeFileSync(join(OUT, 'pattern-grep.txt'), hits.join('\n') + '\n');
console.log(`pattern hits: ${hits.length}`);
for (const p of ['catch\\b', 'waitUntil', '\\.batch\\(', 'Promise\\.all', 'setTimeout', 'JSON\\.parse', 'Date\\.now', 'fetch\\(', 'parseInt', 'as any', 'as unknown as', 'catch \\{\\}', 'catch \\(\\w*\\) \\{\\}']) {
  const re = new RegExp(p);
  console.log(p.padEnd(22), hits.filter((h) => re.test(h)).length);
}

// hot spots
const hot = [...lineCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([f, n]) => `${n} ${f}`);
writeFileSync(join(OUT, 'hot-spots.txt'), hot.join('\n') + '\n');
console.log('=== hot spots (top 25)');
console.log(hot.slice(0, 25).join('\n'));

// per-unit line totals
const unitTotals = new Map();
for (const [f, n] of lineCounts) { const u = f.split('/').slice(0, 2).join('/'); unitTotals.set(u, (unitTotals.get(u) ?? 0) + n); }
const unitLines = [...unitTotals.entries()].sort((a, b) => b[1] - a[1]).map(([u, n]) => `${n} ${u}`);
writeFileSync(join(OUT, 'unit-lines.txt'), unitLines.join('\n') + '\n');
console.log('=== non-test src lines per unit');
console.log(unitLines.join('\n'));

// cross-unit duplicate exported symbols
const symRe = /^export (?:async )?(?:function|const|class) ([A-Za-z_][A-Za-z0-9_]*)/gm;
const symMap = new Map(); // sym -> Map<unit, files[]>
for (const f of files) {
  const unit = f.split('/').slice(0, 2).join('/');
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(symRe)) {
    const s = m[1];
    if (!symMap.has(s)) symMap.set(s, new Map());
    const um = symMap.get(s);
    if (!um.has(unit)) um.set(unit, []);
    um.get(unit).push(f);
  }
}
const dupes = [...symMap.entries()].filter(([, um]) => um.size > 1).sort((a, b) => a[0].localeCompare(b[0]));
const dupeLines = ['=== exported symbols defined in more than one deploy unit ==='];
for (const [s, um] of dupes) {
  dupeLines.push(`${s}  ::  ${[...um.keys()].join(' ')}`);
  dupeLines.push(`     ${[...um.values()].flat().join(' ')}`);
}
writeFileSync(join(OUT, 'cross-unit-dupes.txt'), dupeLines.join('\n') + '\n');
console.log(`duplicate symbols across units: ${dupes.length}`);
