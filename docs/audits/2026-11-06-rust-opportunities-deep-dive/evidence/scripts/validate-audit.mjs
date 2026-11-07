import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(process.argv[2]);
const folder = resolve(root, 'docs/audits/2026-11-06-rust-opportunities-deep-dive');
const errors = [];
let linksChecked = 0;
let citationsChecked = 0;
writeFileSync(resolve(folder, 'evidence/validation.json'), JSON.stringify({ status: 'running' }) + '\n');

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const packages = ['packages', 'apps'].flatMap(parent =>
  readdirSync(resolve(root, parent), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => `${parent}/${entry.name}`)
    .filter(path => existsSync(resolve(root, path, 'package.json')))
    .map(path => {
      const manifest = JSON.parse(readFileSync(resolve(root, path, 'package.json'), 'utf8'));
      return { path, name: manifest.name, version: manifest.version, private: manifest.private ?? false,
        engines: manifest.engines, exports: manifest.exports, dependencies: manifest.dependencies };
    }));
writeFileSync(resolve(folder, 'evidence/snapshot.json'), JSON.stringify({
  recordedAt: new Date().toISOString(),
  commit: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  branch: execFileSync('git', ['-C', root, 'branch', '--show-current'], { encoding: 'utf8' }).trim(),
  source: 'Local checkout only. Registry and deployed versions unverified.', packages,
}, null, 2) + '\n');

for (const file of walk(folder).filter(path => path.endsWith('.md'))) {
  const content = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    linksChecked++;
    if (!existsSync(resolve(dirname(file), target))) {
      errors.push(`${relative(folder, file)} missing link ${target}`);
    }
  }
  for (const match of content.matchAll(/((?:apps|packages|scripts|docs|\.github)\/[\w./-]+\.(?:ts|js|mjs|json|md|toml|yml)):(\d+)/g)) {
    citationsChecked++;
    const path = resolve(root, match[1]);
    if (!existsSync(path)) {
      errors.push(`${relative(folder, file)} missing source ${match[1]}`);
    } else if (Number(match[2]) > readFileSync(path, 'utf8').split('\n').length) {
      errors.push(`${relative(folder, file)} source line outside file ${match[0]}`);
    }
  }
}

const findings = readdirSync(resolve(folder, 'findings')).filter(file => file.endsWith('.md'));
for (const file of findings) {
  const content = readFileSync(resolve(folder, 'findings', file), 'utf8').replace(/\r\n/g, '\n');
  if (!content.includes('## Status\n\nOPEN')) errors.push(`${file} missing OPEN status`);
  if (content.trimEnd().split('\n').length > 25) errors.push(`${file} exceeds 25-line convention`);
}
if (findings.length !== 5) errors.push(`Expected five findings, received ${findings.length}`);

const trackedChanges = execFileSync('git', ['-C', root, 'diff', '--name-only'], { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
for (const path of trackedChanges) {
  if (path !== 'docs/audits/index.md' && !path.startsWith('docs/audits/2026-11-06-rust-opportunities-deep-dive/')) {
    errors.push(`Unexpected tracked change ${path}`);
  }
}
const result = { checkedAt: new Date().toISOString(), linksChecked, citationsChecked,
  findingCount: findings.length, unitCount: packages.length, trackedChanges, errors };
writeFileSync(resolve(folder, 'evidence/validation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exitCode = errors.length ? 1 : 0;
