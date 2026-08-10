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
check(referenced.length === 7, `expected 7 beta icon references, found ${referenced.length}`);
for (const href of referenced) {
  check(fs.existsSync(path.join(DIST, href.slice(1))), `referenced icon missing from dist: ${href}`);
}

// 4. Search engines are told to stay away.
check(/X-Robots-Tag:\s*noindex/.test(headers), 'dist/_headers is missing X-Robots-Tag: noindex');

// 5. The production security headers survived the append.
check(/Content-Security-Policy:/.test(headers), 'dist/_headers lost its Content-Security-Policy');

if (failures.length > 0) {
  console.error('Beta build verification FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`Beta build verified: [BETA] title, ${referenced.length} beta icons, X-Robots-Tag present.`);
