/**
 * Playwright Coverage Fixtures
 *
 * This module provides test fixtures for collecting V8 code coverage
 * during E2E tests. Coverage is collected per-test and merged into
 * a final report.
 *
 * Usage:
 * 1. Import { test } from this file instead of @playwright/test
 * 2. Run tests with: npx playwright test --project=chromium-coverage
 * 3. Coverage report will be in e2e-coverage/
 *
 * Note: Coverage collection only works with Chromium (uses CDP)
 */

import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Coverage output directory
const COVERAGE_DIR = path.join(process.cwd(), 'e2e-coverage');
const COVERAGE_TMP_DIR = path.join(COVERAGE_DIR, '.tmp');

// Ensure coverage directories exist
if (!fs.existsSync(COVERAGE_DIR)) {
  fs.mkdirSync(COVERAGE_DIR, { recursive: true });
}
if (!fs.existsSync(COVERAGE_TMP_DIR)) {
  fs.mkdirSync(COVERAGE_TMP_DIR, { recursive: true });
}

/**
 * V8 Coverage Entry (from Chrome DevTools Protocol)
 */
interface V8CoverageEntry {
  url: string;
  scriptId?: string;
  source?: string;
  functions: Array<{
    functionName: string;
    isBlockCoverage: boolean;
    ranges: Array<{
      startOffset: number;
      endOffset: number;
      count: number;
    }>;
  }>;
}

/**
 * Extended test fixture that collects V8 coverage
 */
export const test = base.extend<{
  coverageEnabled: boolean;
}>({
  // Enable coverage collection based on project name
  coverageEnabled: [
    async ({ }, use, testInfo) => {
      const isEnabled = testInfo.project.name === 'chromium-coverage';
      await use(isEnabled);
    },
    { auto: true },
  ],

  // Override page fixture to collect coverage
  page: async ({ page, coverageEnabled }, use, testInfo) => {
    // Start coverage collection if enabled
    if (coverageEnabled) {
      await page.coverage.startJSCoverage({
        resetOnNavigation: false,
      });
    }

    // Run the test
    await use(page);

    // Collect and save coverage if enabled
    if (coverageEnabled) {
      const coverage = await page.coverage.stopJSCoverage();

      // Filter to only include source files from our app
      const filteredCoverage = coverage.filter((entry: V8CoverageEntry) => {
        const url = entry.url;
        // Include files from localhost (our app)
        // Exclude node_modules and vendor files
        return (
          url.includes('localhost:5173') &&
          !url.includes('node_modules') &&
          !url.includes('@vite') &&
          (url.includes('/src/') || url.endsWith('.ts') || url.endsWith('.js'))
        );
      });

      if (filteredCoverage.length > 0) {
        // Generate unique filename for this test
        const testId = crypto
          .createHash('md5')
          .update(`${testInfo.titlePath.join('-')}-${testInfo.retry}`)
          .digest('hex')
          .substring(0, 8);

        const coverageFile = path.join(
          COVERAGE_TMP_DIR,
          `coverage-${testId}.json`
        );

        fs.writeFileSync(
          coverageFile,
          JSON.stringify(filteredCoverage, null, 2)
        );
      }
    }
  },
});

export { expect };

/**
 * Merge all coverage files into a single report
 * Call this after all tests complete (e.g., in globalTeardown)
 */
export async function mergeCoverage(): Promise<void> {
  const coverageFiles = fs
    .readdirSync(COVERAGE_TMP_DIR)
    .filter((f) => f.endsWith('.json'));

  if (coverageFiles.length === 0) {
    console.log('No coverage files to merge');
    return;
  }

  const mergedCoverage: Map<string, V8CoverageEntry> = new Map();

  for (const file of coverageFiles) {
    const filePath = path.join(COVERAGE_TMP_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const coverage: V8CoverageEntry[] = JSON.parse(content);

    for (const entry of coverage) {
      const existing = mergedCoverage.get(entry.url);

      if (existing) {
        // Merge function coverage
        for (const func of entry.functions) {
          const existingFunc = existing.functions.find(
            (f) => f.functionName === func.functionName
          );

          if (existingFunc) {
            // Merge range counts
            for (const range of func.ranges) {
              const existingRange = existingFunc.ranges.find(
                (r) =>
                  r.startOffset === range.startOffset &&
                  r.endOffset === range.endOffset
              );

              if (existingRange) {
                existingRange.count = Math.max(existingRange.count, range.count);
              } else {
                existingFunc.ranges.push(range);
              }
            }
          } else {
            existing.functions.push(func);
          }
        }
      } else {
        mergedCoverage.set(entry.url, entry);
      }
    }
  }

  // Write merged coverage
  const mergedFile = path.join(COVERAGE_DIR, 'coverage-final.json');
  fs.writeFileSync(
    mergedFile,
    JSON.stringify(Array.from(mergedCoverage.values()), null, 2)
  );

  console.log(`\nE2E Coverage: Merged ${coverageFiles.length} files`);
  console.log(`Coverage report: ${mergedFile}`);

  // Generate summary
  const summary = generateCoverageSummary(Array.from(mergedCoverage.values()));
  console.log('\nE2E Coverage Summary:');
  console.log(`  Files covered: ${summary.files}`);
  console.log(`  Functions: ${summary.functions.covered}/${summary.functions.total} (${summary.functions.pct}%)`);
}

/**
 * Generate a simple coverage summary
 */
function generateCoverageSummary(coverage: V8CoverageEntry[]): {
  files: number;
  functions: { total: number; covered: number; pct: string };
} {
  let totalFunctions = 0;
  let coveredFunctions = 0;

  for (const entry of coverage) {
    for (const func of entry.functions) {
      totalFunctions++;
      const hasCoverage = func.ranges.some((r) => r.count > 0);
      if (hasCoverage) {
        coveredFunctions++;
      }
    }
  }

  const pct = totalFunctions > 0
    ? ((coveredFunctions / totalFunctions) * 100).toFixed(2)
    : '0.00';

  return {
    files: coverage.length,
    functions: {
      total: totalFunctions,
      covered: coveredFunctions,
      pct,
    },
  };
}
