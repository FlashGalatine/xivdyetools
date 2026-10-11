#!/usr/bin/env node
// Split the spelling sweep (default + --all extras) into one file per review cluster.
//   node split-spelling.mjs <xivdyetools-dir>  → evidence/clusters/<name>.spelling + <name>.files
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.argv[2] ?? '.';
const ev = join(repo, 'docs/audits/2026-10-11-documentation/evidence');
const { clusters } = JSON.parse(readFileSync(join(ev, 'clusters.json'), 'utf8'));
const rows = (f) => readFileSync(join(ev, f), 'utf8').split('\n').filter((l) => /^\| (docs|apps|packages)\//.test(l));
const base = rows('american-spelling.txt');
const all = rows('american-spelling-all.txt');
const extras = all.filter((r) => !base.includes(r));
const fileOf = (r) => r.slice(2).split(':')[0];

mkdirSync(join(ev, 'clusters'), { recursive: true });
clusters['policy-en'] = ['apps/web-app/PRIVACY.md', 'apps/web-app/TERMS_OF_SERVICE.md',
  'apps/discord-worker/PRIVACY_POLICY.md', 'apps/discord-worker/TERMS_OF_SERVICE.md'];
clusters['manual'] = ['packages/bot-logic/src/i18n/locales/en.json'];
let assigned = 0;
for (const [name, files] of Object.entries(clusters)) {
  const mine = (rs) => rs.filter((r) => files.includes(fileOf(r)));
  const b = mine(base), x = mine(extras);
  assigned += b.length + x.length;
  writeFileSync(join(ev, 'clusters', `${name}.files`), files.join('\n') + '\n');
  writeFileSync(join(ev, 'clusters', `${name}.spelling`),
    `# default sweep (${b.length})\n${b.join('\n')}\n\n# --all extras: code/link zones, triage by hand (${x.length})\n${x.join('\n')}\n`);
  console.log(`${name.padEnd(22)} default ${String(b.length).padStart(3)} · --all extras ${x.length}`);
}
console.log(`rows: default ${base.length} + extras ${extras.length} = ${base.length + extras.length}; assigned ${assigned}`);
