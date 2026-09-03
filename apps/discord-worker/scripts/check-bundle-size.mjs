#!/usr/bin/env node
/**
 * Gate the Worker's gzipped upload against Cloudflare's 3 MiB limit.
 *
 * OPT-002: this cap is load-bearing for THIS worker specifically — ten bundled
 * TTFs (~2.14 MiB raw) plus the resvg WASM plus the CJK subsets — and it was
 * checked only by a human remembering to run `wrangler deploy --dry-run`.
 * Merging to `main` deploys automatically, so "someone will notice" was the
 * whole safety net, and the failure mode is a deploy that Cloudflare refuses
 * after the merge has already landed.
 *
 * `--dry-run` bundles locally and needs no credentials, so this runs anywhere.
 *
 * Usage: node scripts/check-bundle-size.mjs [--limit <KiB>]
 */

import { execFileSync } from 'node:child_process';

/** Cloudflare's paid-plan compressed Worker limit, in KiB. */
const DEFAULT_LIMIT_KIB = 3072;

/**
 * Warn below the hard cap so growth is visible before it is fatal.
 * 92 % of 3,072 KiB is 2,826 KiB — the 2026-08 image-worker split left this
 * worker at ~2,632 KiB, so the warning band starts a little above where it
 * sits today rather than firing on day one.
 */
const WARN_FRACTION = 0.92;

function parseLimit(argv) {
  const i = argv.indexOf('--limit');
  if (i === -1) return DEFAULT_LIMIT_KIB;
  const value = Number(argv[i + 1]);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`Invalid --limit value: ${argv[i + 1]}`);
    process.exit(2);
  }
  return value;
}

/**
 * Pull the gzip figure out of wrangler's "Total Upload" line.
 *
 * Wrangler prints e.g. `Total Upload: 8123.45 KiB / gzip: 2632.10 KiB`. The
 * unit is matched rather than assumed: a future wrangler reporting MiB would
 * otherwise read as a number ~1000× too small and the gate would pass an
 * over-budget bundle silently.
 */
function parseGzipKiB(output) {
  const match = /gzip:\s*([\d.]+)\s*(KiB|MiB|B)\b/i.exec(output);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'mib') return value * 1024;
  if (unit === 'b') return value / 1024;
  return value;
}

const limitKiB = parseLimit(process.argv.slice(2));

let output;
try {
  output = execFileSync('npx', ['wrangler', 'deploy', '--dry-run', '--outdir', '.wrangler/size-check'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
} catch (error) {
  // wrangler writes the size report to stderr on some versions, and a non-zero
  // exit with usable output is still worth parsing before giving up.
  output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
  if (!parseGzipKiB(output)) {
    console.error('wrangler deploy --dry-run failed:\n');
    console.error(output.trim() || error.message);
    process.exit(1);
  }
}

const gzipKiB = parseGzipKiB(output);

if (gzipKiB === null) {
  // Never pass silently: an unparsed report is indistinguishable from an
  // over-budget one, and this gate exists precisely because nobody was looking.
  console.error('Could not find a gzip size in wrangler output:\n');
  console.error(output.trim());
  process.exit(1);
}

const pct = ((gzipKiB / limitKiB) * 100).toFixed(1);
const headroom = (limitKiB - gzipKiB).toFixed(1);

if (gzipKiB > limitKiB) {
  console.error(
    `✗ Worker bundle is ${gzipKiB.toFixed(1)} KiB gzipped, over the ${limitKiB} KiB limit by ${(gzipKiB - limitKiB).toFixed(1)} KiB (${pct}%).`,
  );
  console.error('  Cloudflare will refuse this deploy. Shrink the bundle before merging.');
  process.exit(1);
}

if (gzipKiB > limitKiB * WARN_FRACTION) {
  console.warn(
    `⚠ Worker bundle is ${gzipKiB.toFixed(1)} KiB gzipped (${pct}% of ${limitKiB} KiB) — ${headroom} KiB left.`,
  );
} else {
  console.log(
    `✓ Worker bundle is ${gzipKiB.toFixed(1)} KiB gzipped (${pct}% of ${limitKiB} KiB) — ${headroom} KiB left.`,
  );
}
