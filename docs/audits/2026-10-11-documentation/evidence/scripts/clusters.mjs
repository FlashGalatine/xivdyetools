#!/usr/bin/env node
// Split the living docs tier into review clusters and prove the union covers it.
//   node clusters.mjs <xivdyetools-dir>  → writes evidence/clusters.json, exits 1 on a gap/overlap
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.argv[2] ?? '.';
const out = join(repo, 'docs/audits/2026-10-11-documentation/evidence');
const tracked = execFileSync('git', ['ls-files', '--', 'docs'], { cwd: repo, encoding: 'utf8' })
  .split('\n').filter(Boolean);
const ARCHIVE = /^docs\/(audits|historical)\//;
const FROZEN = /^docs\/(research|superpowers)\//;
const living = tracked.filter((f) => !ARCHIVE.test(f) && !FROZEN.test(f) && f.endsWith('.md'));
const frozen = tracked.filter((f) => FROZEN.test(f));
const nonMdLiving = tracked.filter((f) => !ARCHIVE.test(f) && !FROZEN.test(f) && !f.endsWith('.md'));

const has = (re) => living.filter((f) => re.test(f));
const WEB_A = /^docs\/user-guides\/web-app\/(getting-started|faq|accessibility|favorites-collections|community-presets)\.md$/;
const clusters = {
  'web-app-core': [...has(/^docs\/projects\/web-app\//), ...has(WEB_A)],
  'web-app-tools': has(/^docs\/user-guides\/web-app\//).filter((f) => !WEB_A.test(f)),
  'discord-worker': [...has(/^docs\/projects\/discord-worker\//), ...has(/^docs\/user-guides\/discord-bot\//)],
  'api-worker': [...has(/^docs\/projects\/(api-worker|universalis-proxy)\//), 'docs/user-guides/public-api.md'],
  'presets-moderation': has(/^docs\/projects\/(presets-api|moderation-worker)\//),
  'oauth-og': has(/^docs\/projects\/(oauth|og-worker)\//),
  'packages': [...has(/^docs\/projects\/(core|types|logger|test-utils)\//), 'docs/projects/index.md'],
  'architecture': has(/^docs\/architecture\//),
  'devguides-maintainer': has(/^docs\/(developer-guides|maintainer)\//),
  'operations': has(/^docs\/operations\//),
  'entry-reference': [...has(/^docs\/[^/]+\.md$/), ...has(/^docs\/reference\//), 'docs/user-guides/index.md'],
  'specs-presets': ['docs/specifications/community-presets.md', 'docs/specifications/index.md'],
  'specs-other': has(/^docs\/specifications\//).filter((f) => !/(community-presets|index)\.md$/.test(f)),
};

const seen = new Map();
for (const [name, files] of Object.entries(clusters)) {
  for (const f of files) {
    if (!living.includes(f)) { console.error(`not living: ${f} (${name})`); process.exitCode = 1; }
    if (seen.has(f)) { console.error(`overlap: ${f} in ${seen.get(f)} and ${name}`); process.exitCode = 1; }
    seen.set(f, name);
  }
}
const missing = living.filter((f) => !seen.has(f));
for (const f of missing) { console.error(`uncovered: ${f}`); process.exitCode = 1; }

writeFileSync(join(out, 'clusters.json'), JSON.stringify({ clusters, frozenCount: frozen.length, nonMdLiving }, null, 2));
writeFileSync(join(out, 'living-files.txt'), living.join('\n') + '\n');
writeFileSync(join(out, 'frozen-files.txt'), frozen.join('\n') + '\n');
for (const [n, fs] of Object.entries(clusters)) console.log(`${n.padEnd(22)} ${fs.length}`);
console.log(`living ${living.length} · covered ${seen.size} · uncovered ${missing.length} · frozen ${frozen.length} · non-md living ${nonMdLiving.length}`);
