// What the web app's What's New chunk (virtual:changelog) is made of, and what bounding it in
// bytes instead of releases would keep. Read-only. Run from the monorepo root:
//   pnpm exec tsx docs/audits/2026-09-19-i18n/evidence/scripts/whats-new-chunk-composition.mts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { parseChangelog } from '../../../../../apps/web-app/vite-plugin-changelog-parser.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const md = readFileSync(join(REPO, 'apps', 'web-app', 'CHANGELOG-laymans.md'), 'utf-8');
const entries = parseChangelog(md);

const size = (v: unknown): number => Buffer.byteLength(JSON.stringify(v), 'utf-8');
const kb = (n: number): string => `${(n / 1024).toFixed(2)} KB`;

const full = size(entries);
const lean = size(
  entries.map(({ highlights: _h, ...e }) => ({
    ...e,
    sections: e.sections.map(({ title: _t, ...s }) => s),
  }))
);
const per = full / entries.length;

console.log(`releases parsed        : ${entries.length}`);
console.log(`module JSON today      : ${kb(full)}  (gzip ${kb(gzipSync(JSON.stringify(entries)).length)})`);
console.log(`  derived fields       : ${kb(full - lean)}  (highlights[] repeats the section headers; title is always "")`);
console.log(`average per release    : ${kb(per)}`);
console.log(`at the plugin's own cap: ${kb(per * 50)}  (MAX_VERSIONS_TO_INCLUDE = 50)`);
const largest = entries
  .map((e) => ({ v: e.version, b: size(e) }))
  .sort((a, b) => b.b - a.b)
  .slice(0, 5);
console.log(`largest releases       : ${largest.map((s) => `${s.v} = ${kb(s.b)}`).join(', ')}`);
for (const budget of [32, 36, 40]) {
  let acc = 2;
  let n = 0;
  for (const e of entries) {
    const b = size(e) + 1;
    if (acc + b > budget * 1024) break;
    acc += b;
    n++;
  }
  const last = entries[n - 1];
  console.log(`newest that fit ${budget} KB  : ${n} releases, back to ${last?.version} (${last?.date})`);
}
