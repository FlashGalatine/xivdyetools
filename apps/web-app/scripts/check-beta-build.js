/**
 * Assert that dist/ really is a beta build.
 *
 * Runs in the beta workflow between `build` and `pages deploy`. Every check
 * here corresponds to something that fails silently in production: a missing
 * VITE_APP_ENV produces a build indistinguishable from production on the beta
 * domain, and a missing icon is a 404 nobody sees in CI.
 *
 * Usage: node scripts/check-beta-build.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '../dist');

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8');
const headers = fs.readFileSync(path.join(DIST, '_headers'), 'utf-8');

// 1. The title marker survived into the emitted HTML.
check(/<title>\[BETA\] /.test(html), 'dist/index.html <title> is missing the [BETA] prefix');

// 2. No icon link still points at the production set.
check(
  !/rel="(?:icon|apple-touch-icon)"[^>]*href="\/assets\/icons\/(?!beta\/)/.test(html) &&
    !/href="\/assets\/icons\/(?!beta\/)[^"]*"[^>]*rel="(?:icon|apple-touch-icon)"/.test(html),
  'dist/index.html still has an icon link pointing outside /assets/icons/beta/'
);

// 3. Every beta icon the HTML references actually exists in dist.
const referenced = [...html.matchAll(/href="(\/assets\/icons\/beta\/[^"]+)"/g)].map((m) => m[1]);
check(referenced.length >= 7, `expected at least 7 beta icon references, found ${referenced.length}`);
for (const href of referenced) {
  check(fs.existsSync(path.join(DIST, href.slice(1))), `referenced icon missing from dist: ${href}`);
}

// 4-6 read dist/_headers the way Cloudflare Pages does: trimmed lines, `#`
// comments skipped, a line starting with `/` or `scheme://` opens a rule, and
// rules are keyed by path, so a pattern declared twice keeps only its LAST
// rule. A grep of the file cannot see that. Until 2026-10-03 this script
// checked that the CSP string occurred anywhere in the file, and it passed
// every beta build while a second `/*` rule hid the CSP from Pages
// (2026-10-03 security audit, FINDING-001).
const rules = [];
for (const raw of headers.split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  if (/^([^\s]+:\/\/|\/)/.test(line)) {
    rules.push({ path: line, headers: new Map() });
    continue;
  }
  const at = line.indexOf(':');
  if (at !== -1 && rules.length > 0) {
    rules[rules.length - 1].headers.set(line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim());
  }
}

// 4. No path pattern is declared twice.
const paths = rules.map((rule) => rule.path);
const repeated = [...new Set(paths.filter((p, i) => paths.indexOf(p) !== i))];
check(
  repeated.length === 0,
  `dist/_headers declares ${repeated.join(', ')} more than once; Pages serves only the last rule for a repeated pattern`
);

// 5. The /* rule Pages will serve still carries the production security headers.
const global = rules.filter((rule) => rule.path === '/*').at(-1);
for (const name of ['content-security-policy', 'x-frame-options', 'strict-transport-security', 'permissions-policy']) {
  check(Boolean(global?.headers.get(name)), `the /* rule in dist/_headers has no ${name}`);
}

// 6. Search engines are told to stay away, on that same rule.
check(/\bnoindex\b/i.test(global?.headers.get('x-robots-tag') ?? ''), 'the /* rule in dist/_headers is missing X-Robots-Tag: noindex');

if (failures.length > 0) {
  console.error('Beta build verification FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `Beta build verified: [BETA] title, ${referenced.length} beta icons, one /* rule carrying the security headers and X-Robots-Tag.`
);
