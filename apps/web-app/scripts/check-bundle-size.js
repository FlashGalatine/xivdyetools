/**
 * XIV Dye Tools - Bundle Size Monitor
 *
 * Checks build output sizes against defined limits. Runs after `npm run build`,
 * and gates the Cloudflare Pages deploy in both `deploy-web-app.yml` and
 * `deploy-web-app-beta.yml` -- a non-zero exit here means no deploy.
 *
 * Usage:
 *   npm run check-bundle-size
 *   node scripts/check-bundle-size.js
 *
 * Exit codes:
 *   0 - All bundles within limits
 *   1 - One or more bundles exceed limits
 *
 * No shebang: both call sites invoke this through `node`, and a leading `#!`
 * makes the file unparseable to Vite's SSR transform, which the unit tests in
 * `src/__tests__/bundle-budget.test.ts` rely on to import the budget helpers.
 */

import { readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const KB = 1024;

/**
 * Locale chunks, emitted one per language by Vite because `language-service.ts`
 * reaches them through a dynamic `import('../locales/${locale}.json')`.
 *
 * These matter to the totals below, because a visitor downloads exactly ONE of
 * them. Six are emitted today; five are dead weight to any given user.
 *
 * The codes are read from `src/locales/` rather than hardcoded. A hardcoded
 * list works until someone adds a seventh language, at which point that one
 * locale quietly reverts to being charged in full -- the precise bug this whole
 * gate was rewritten to remove, reintroduced for the newest language only.
 */
export function discoverLocaleCodes(localesDir = join(__dirname, '..', 'src', 'locales')) {
  try {
    return readdirSync(localesDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

/** Build the chunk matcher for a set of locale codes. */
export function localeChunkPattern(codes) {
  if (codes.length === 0) return /(?!)/; // matches nothing
  return new RegExp(`^(${codes.join('|')})-[A-Za-z0-9_-]+\\.js$`);
}

const LOCALE_CHUNK = localeChunkPattern(discoverLocaleCodes());

/**
 * Per-chunk limits, in bytes, uncompressed. Gzipped is ~30-40% smaller.
 *
 * These are an ORDERED LIST OF REGEXES, not a map of substrings, and that is
 * deliberate. The previous version matched with `file.includes(name)` against
 * keys like `tool-harmony` -- but Vite emits `harmony-tool-<hash>.js`, so that
 * test was never true. Nine of the sixteen limits silently matched nothing and
 * every tool chunk shipped completely ungated; `swatch-tool` had grown to 77 KB
 * against a nominal 40 KB limit that had never once been evaluated. A limit
 * that cannot fail is worse than no limit, because it reads as coverage.
 *
 * The tool limits below are therefore calibrated from the first build that
 * actually enforced them (the 5.0 branch), with ~30% headroom. They are a new
 * baseline, not a relaxed one -- there was no previous enforcement to relax.
 */
const BUNDLE_LIMITS = [
  // Styles first: the entry stylesheet is `index-<hash>.css`, so a JS rule like
  // /^index-/ would otherwise claim it and quietly gate CSS at the JS limit.
  { label: 'css', pattern: /\.css$/, limit: 105 * KB },

  // Eagerly loaded on first paint
  { label: 'main entry', pattern: /^index-/, limit: 150 * KB },
  { label: 'layout shell', pattern: /^v4-layout-/, limit: 200 * KB },
  { label: 'modals (welcome/changelog)', pattern: /^modals-/, limit: 280 * KB },

  // Vendor chunks, code-split for caching
  { label: 'swatch reference data', pattern: /^vendor-core-/, limit: 950 * KB },
  { label: 'lit framework', pattern: /^vendor-lit-/, limit: 20 * KB },
  { label: 'spectral.js', pattern: /^vendor-spectral-/, limit: 15 * KB },
  { label: 'other vendor', pattern: /^vendor-(?!core|lit|spectral)/, limit: 30 * KB },

  // Tool chunks, lazy-loaded per route
  { label: 'tool: harmony', pattern: /^harmony-tool-/, limit: 55 * KB },
  { label: 'tool: mixer', pattern: /^mixer-tool-/, limit: 50 * KB },
  { label: 'tool: swatch', pattern: /^swatch-tool-/, limit: 95 * KB },
  { label: 'tool: comparison', pattern: /^comparison-tool-/, limit: 60 * KB },
  { label: 'tool: accessibility', pattern: /^accessibility-tool-/, limit: 45 * KB },
  { label: 'tool: budget', pattern: /^budget-tool-/, limit: 45 * KB },
  { label: 'tool: gradient', pattern: /^gradient-tool-/, limit: 65 * KB },
  { label: 'tool: extractor', pattern: /^extractor-tool-/, limit: 100 * KB },
  { label: 'tool: preset', pattern: /^preset-tool-/, limit: 65 * KB },

  // Shared components
  { label: 'dye selector', pattern: /^dye-selector-/, limit: 50 * KB },
  { label: 'result card', pattern: /^result-card-/, limit: 50 * KB },
];

/**
 * Anything not named above still gets a budget. Previously an unmatched file
 * was simply skipped, which is how nine dead limits went unnoticed for months.
 * Nothing ships ungated now; new small chunks just inherit this.
 */
const DEFAULT_CHUNK_LIMIT = 60 * KB;

/** Per-language budget. Largest today is ja at ~76 KB. */
const LOCALE_CHUNK_LIMIT = 95 * KB;

/**
 * Payload budget: the JS a single visitor can actually download.
 *
 * This is every emitted chunk, counting ONE locale rather than all six -- the
 * worst case being a visitor on the largest locale who opens every tool in one
 * session. It is still conservative (nobody opens all nine), but it measures
 * user cost, which is what a performance budget is for.
 *
 * The number is unchanged at 2200 KB. It did not need raising: the gate started
 * failing because the OLD total summed all six locale chunks, so 5.0's i18n
 * work charged ~133 KB to the budget while adding ~22 KB to any real visitor.
 * Measured honestly, 205 commits of 5.0 work grew the payload by 88 KB and it
 * sits at ~91% of this limit.
 */
const PAYLOAD_JS_LIMIT = 2200 * KB;

/**
 * Artifact budget: everything we emit, all locales included.
 *
 * Not a user-facing cost -- this one guards deploy size and cache churn, so it
 * is deliberately looser. Keeping it means runaway emission still trips
 * something even though it no longer blocks on locale count.
 */
const TOTAL_JS_LIMIT = 2800 * KB;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Get percentage of limit used
 */
function getPercentage(size, limit) {
  return ((size / limit) * 100).toFixed(1);
}

/**
 * Status marker for a row.
 *
 * `❌` means FAILED, and nothing else. It previously showed for anything at or
 * above 90% of its limit, so a passing run printed several ❌ rows and read as
 * a failure at a glance -- the summary line was the only way to tell. Tightness
 * gets its own marker now.
 */
function getStatusEmoji(percentage, exceeds = false) {
  if (exceeds) return '❌';
  if (percentage >= 90) return '🟠';
  if (percentage >= 70) return '⚠️';
  return '✅';
}

// ============================================================================
// Main
// ============================================================================

/**
 * Resolve the budget for one emitted file. First matching pattern wins, so
 * BUNDLE_LIMITS is ordered most-specific first.
 */
export function limitFor(file, { localePattern = LOCALE_CHUNK } = {}) {
  // Locales are matched from a filesystem-derived pattern rather than a literal
  // in BUNDLE_LIMITS, so a newly added language is gated the day it appears.
  if (localePattern.test(file)) {
    return { limit: LOCALE_CHUNK_LIMIT, label: 'locale', named: true };
  }
  const rule = BUNDLE_LIMITS.find((r) => r.pattern.test(file));
  return rule
    ? { limit: rule.limit, label: rule.label, named: true }
    : { limit: DEFAULT_CHUNK_LIMIT, label: 'unlisted', named: false };
}

/**
 * Reduce `[{ file, size }]` to the two budgeted figures plus per-file rows.
 *
 * Pure and exported so the payload arithmetic is unit-testable. The invariant
 * worth protecting: adding a seventh language must not move `payload`.
 */
export function computeTotals(entries, { localePattern = LOCALE_CHUNK } = {}) {
  let totalJsSize = 0;
  let localeJsSize = 0;
  let largestLocale = 0;
  let defaultedCount = 0;
  const results = [];

  for (const { file, size } of entries) {
    const { limit, label, named } = limitFor(file, { localePattern });
    if (!named) defaultedCount++;

    if (file.endsWith('.js')) {
      totalJsSize += size;
      if (localePattern.test(file)) {
        localeJsSize += size;
        largestLocale = Math.max(largestLocale, size);
      }
    }

    const exceeds = size > limit;
    results.push({
      file: basename(file),
      label,
      size,
      limit,
      percentage: parseFloat(getPercentage(size, limit)),
      status: getStatusEmoji(parseFloat(getPercentage(size, limit)), exceeds),
      exceeds,
    });
  }

  return {
    results,
    defaultedCount,
    totalJsSize,
    // All JS, but one locale rather than six.
    payloadSize: totalJsSize - localeJsSize + largestLocale,
  };
}

function checkBundleSizes() {
  const distDir = join(__dirname, '..', 'dist');
  const assetsDir = join(distDir, 'assets');

  console.log('\n📦 Bundle Size Check\n');
  console.log('='.repeat(60));

  let hasErrors = false;

  try {
    const entries = [];
    for (const file of readdirSync(assetsDir)) {
      // Sourcemaps are not shipped to users and carry no budget.
      if (file.endsWith('.map')) continue;
      const stats = statSync(join(assetsDir, file));
      // dist/assets/icons is a directory; only leaf assets carry a budget.
      if (stats.isDirectory()) continue;
      entries.push({ file, size: stats.size });
    }

    const { results, defaultedCount, totalJsSize, payloadSize } = computeTotals(entries);
    if (results.some((r) => r.exceeds)) hasErrors = true;

    // Sort results by percentage (highest first)
    results.sort((a, b) => b.percentage - a.percentage);

    // Print results
    for (const r of results) {
      const sizeStr = formatBytes(r.size).padEnd(12);
      const limitStr = formatBytes(r.limit).padEnd(12);
      const pctStr = `${r.percentage}%`.padEnd(8);

      console.log(
        `${r.status} ${r.file.padEnd(35)} ${sizeStr} / ${limitStr} (${pctStr}) ${r.label}`
      );
    }

    console.log('='.repeat(60));

    // Payload: all JS, but only one locale -- see PAYLOAD_JS_LIMIT.
    const payloadPct = parseFloat(getPercentage(payloadSize, PAYLOAD_JS_LIMIT));
    if (payloadSize > PAYLOAD_JS_LIMIT) hasErrors = true;

    console.log(
      `${getStatusEmoji(payloadPct, payloadSize > PAYLOAD_JS_LIMIT)} ${'JS payload (one locale)'.padEnd(35)} ${formatBytes(payloadSize).padEnd(12)} / ${formatBytes(PAYLOAD_JS_LIMIT).padEnd(12)} (${`${payloadPct}%`.padEnd(8)}) what one visitor can download`
    );

    // Artifact total: everything emitted, all locales.
    const totalPct = parseFloat(getPercentage(totalJsSize, TOTAL_JS_LIMIT));
    if (totalJsSize > TOTAL_JS_LIMIT) hasErrors = true;

    console.log(
      `${getStatusEmoji(totalPct, totalJsSize > TOTAL_JS_LIMIT)} ${'JS emitted (all locales)'.padEnd(35)} ${formatBytes(totalJsSize).padEnd(12)} / ${formatBytes(TOTAL_JS_LIMIT).padEnd(12)} (${`${totalPct}%`.padEnd(8)}) deploy size`
    );

    console.log('='.repeat(60));

    if (defaultedCount > 0) {
      console.log(
        `\nℹ️  ${defaultedCount} chunk(s) had no named limit and used the ${formatBytes(DEFAULT_CHUNK_LIMIT)} default.`
      );
      console.log('   Name them in BUNDLE_LIMITS if they deserve their own budget.');
    }

    // Summary
    if (hasErrors) {
      console.log('\n❌ Bundle size check FAILED\n');
      for (const r of results.filter((x) => x.exceeds)) {
        console.log(
          `   ${r.file} is ${formatBytes(r.size - r.limit)} over its ${formatBytes(r.limit)} limit (${r.label})`
        );
        if (r.label === 'unlisted') {
          console.log(
            `     -> no named budget; it inherited the ${formatBytes(DEFAULT_CHUNK_LIMIT)} default.`
          );
          console.log(
            '        Give it an entry in BUNDLE_LIMITS with a deliberate size, or split it.'
          );
        }
      }
      if (payloadSize > PAYLOAD_JS_LIMIT) {
        console.log(
          `   JS payload is ${formatBytes(payloadSize - PAYLOAD_JS_LIMIT)} over budget.`
        );
        console.log(
          '     -> This counts ONE locale. Adding locales does not move it; adding code does.'
        );
      }
      if (totalJsSize > TOTAL_JS_LIMIT) {
        console.log(
          `   Emitted JS is ${formatBytes(totalJsSize - TOTAL_JS_LIMIT)} over the artifact budget.`
        );
      }
      console.log('');
      process.exit(1);
    } else {
      console.log('\n✅ Bundle size check PASSED - all bundles within limits\n');
      process.exit(0);
    }
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('❌ Error: dist/assets directory not found.');
      console.error('   Run `npm run build` first.\n');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

// Only run (and call process.exit) when invoked as a CLI. The budget arithmetic
// above is exported for unit tests, which must be able to import this module
// without a dist/ directory present and without the process exiting underneath
// them.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkBundleSizes();
}

