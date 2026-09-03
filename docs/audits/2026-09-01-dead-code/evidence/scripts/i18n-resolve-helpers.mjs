// i18n-resolve-helpers.mjs — resolve the web-app's namespace `t()` helpers by hand.
// The orphan gate marks every key under a dynamic prefix live. Most of those prefixes come from a
// local helper `const t = (key) => LanguageService.t(`ns.${key}`)` that is then called with LITERAL
// sub-keys, so the family IS reachable — just not by the gate's regex. This resolves those literals
// (per file) and reports the keys in each dynamic family that nothing reaches either way.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { flattenKeys } from 'file:///C:/dev/XIVProjects/xivdyetools/apps/web-app/scripts/analyze-unused-keys.js';

const SRC = 'C:/dev/XIVProjects/xivdyetools/apps/web-app/src';
function list(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git', '__tests__', 'locales'].includes(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...list(p));
    else if (['.ts', '.html'].includes(extname(e)) && !/\.(test|spec)\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}
const files = list(SRC);
const corpus = files.map((f) => readFileSync(f, 'utf-8')).join('\n');
const locale = JSON.parse(readFileSync(join(SRC, 'locales/en.json'), 'utf-8'));
const keys = flattenKeys(locale).filter((k) => !k.startsWith('meta.'));

// every literal string anywhere in the corpus
const literals = new Set();
for (const m of corpus.matchAll(/['"`]([A-Za-z0-9_.]+)['"`]/g)) literals.add(m[1]);

// namespace helpers, per file: `t(\`ns.${...}\`)` or LanguageService.t(`ns.${...}`)
const nsByFile = new Map();
for (const f of files) {
  const text = readFileSync(f, 'utf-8');
  const ns = new Set();
  for (const m of text.matchAll(/`([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*\.?)\$\{/g)) ns.add(m[1]);
  if (ns.size) nsByFile.set(f, ns);
}
// literals used inside each file (arguments to anything)
const litByFile = new Map();
for (const f of files) {
  const text = readFileSync(f, 'utf-8');
  const s = new Set();
  for (const m of text.matchAll(/['"`]([A-Za-z0-9_.]+)['"`]/g)) s.add(m[1]);
  litByFile.set(f, s);
}

const reached = new Set();
for (const k of keys) {
  if (new RegExp(`['"\`]${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`).test(corpus)) {
    reached.add(k);
    continue;
  }
  // a namespace helper in some file + the remainder as a literal in that same file
  for (const [f, nss] of nsByFile) {
    for (const ns of nss) {
      if (!k.startsWith(ns)) continue;
      const rest = k.slice(ns.length);
      if (!rest) continue;
      if (litByFile.get(f).has(rest)) { reached.add(k); }
      // capitalised-suffix helpers: `accessibility.visionDesc${Cap}` / `${stem}Short`
      const stem = rest.replace(/(Short|Long)$/, '');
      if (litByFile.get(f).has(stem)) reached.add(k);
      const lower = rest.charAt(0).toLowerCase() + rest.slice(1);
      if (litByFile.get(f).has(lower)) reached.add(k);
    }
  }
}
const orphans = keys.filter((k) => !reached.has(k));
console.log(`keys=${keys.length}  reached=${reached.size}  UNRESOLVED=${orphans.length}\n`);
for (const k of orphans) console.log('  ' + k);
