/**
 * Coverage Aggregation Report
 *
 * Collects coverage-summary.json from all packages and apps,
 * compares against baselines (90% for packages, 80% for apps),
 * and outputs a structured terminal report.
 *
 * Usage: pnpm tsx scripts/coverage-report.ts
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Types ---

interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

interface FileCoverage {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

interface CoverageSummary {
  total: FileCoverage;
  [filePath: string]: FileCoverage;
}

interface FileBelow {
  file: string;
  metric: string;
  actual: number;
  target: number;
}

interface ProjectResult {
  name: string;
  type: 'package' | 'app';
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  status: 'PASS' | 'WARN' | 'FAIL';
  filesBelow: FileBelow[];
}

// --- Config ---

const PACKAGE_BASELINE = { statements: 90, branches: 90, functions: 90, lines: 90 };
const APP_BASELINE = { statements: 80, branches: 80, functions: 80, lines: 80 };
const WARN_THRESHOLD = 5;

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const MONOREPO_ROOT = join(__dirname, '..');

// --- Helpers ---

type Status = 'PASS' | 'WARN' | 'FAIL';

function getStatus(pct: number, baseline: number): Status {
  if (pct >= baseline) return 'PASS';
  if (pct >= baseline - WARN_THRESHOLD) return 'WARN';
  return 'FAIL';
}

function worstStatus(...statuses: Status[]): Status {
  if (statuses.includes('FAIL')) return 'FAIL';
  if (statuses.includes('WARN')) return 'WARN';
  return 'PASS';
}

function colorize(text: string, status: Status): string {
  const colors: Record<Status, string> = {
    PASS: '\x1b[32m',
    WARN: '\x1b[33m',
    FAIL: '\x1b[31m',
  };
  return `${colors[status]}${text}\x1b[0m`;
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str : ' '.repeat(len - str.length) + str;
}

function formatPct(pct: number, baseline: number): string {
  const status = getStatus(pct, baseline);
  return colorize(`${pct.toFixed(1)}%`, status);
}

// --- Main ---

const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;

function collectResults(dir: 'packages' | 'apps'): ProjectResult[] {
  const results: ProjectResult[] = [];
  const baseline = dir === 'packages' ? PACKAGE_BASELINE : APP_BASELINE;
  const dirPath = join(MONOREPO_ROOT, dir);

  const subdirs = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of subdirs) {
    if (!entry.isDirectory()) continue;

    const summaryPath = join(dirPath, entry.name, 'coverage', 'coverage-summary.json');
    if (!existsSync(summaryPath)) continue;

    let summary: CoverageSummary;
    try {
      summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
    } catch {
      console.error(`  Failed to parse: ${summaryPath}`);
      continue;
    }

    const total = summary.total;
    if (!total) {
      console.error(`  No "total" key in: ${summaryPath}`);
      continue;
    }

    const filesBelow: FileBelow[] = [];

    for (const [filePath, fileCov] of Object.entries(summary)) {
      if (filePath === 'total') continue;

      for (const metric of METRICS) {
        const pct = fileCov[metric]?.pct ?? 0;
        if (pct < baseline[metric]) {
          const relPath = filePath.replace(/^.*?[/\\](src[/\\].*)/, '$1');
          filesBelow.push({ file: relPath, metric, actual: pct, target: baseline[metric] });
        }
      }
    }

    const metricStatuses = METRICS.map((m) => getStatus(total[m].pct, baseline[m]));

    results.push({
      name: entry.name,
      type: dir === 'packages' ? 'package' : 'app',
      statements: total.statements.pct,
      branches: total.branches.pct,
      functions: total.functions.pct,
      lines: total.lines.pct,
      status: worstStatus(...metricStatuses),
      filesBelow,
    });
  }

  return results;
}

function printTable(
  title: string,
  results: ProjectResult[],
  baseline: typeof PACKAGE_BASELINE
): void {
  console.log(
    `\n\x1b[1m${title}\x1b[0m (target: ${baseline.statements}/${baseline.branches}/${baseline.functions}/${baseline.lines})`
  );
  console.log('\u2500'.repeat(85));

  console.log(
    `  ${padRight('Project', 24)} ${padLeft('Stmts', 8)} ${padLeft('Branch', 8)} ${padLeft('Funcs', 8)} ${padLeft('Lines', 8)}  Status`
  );
  console.log('  ' + '\u2500'.repeat(80));

  for (const r of results.sort((a, b) => a.name.localeCompare(b.name))) {
    const statusStr = colorize(padRight(r.status, 4), r.status);
    console.log(
      `  ${padRight(r.name, 24)} ${padLeft(formatPct(r.statements, baseline.statements), 17)} ${padLeft(formatPct(r.branches, baseline.branches), 17)} ${padLeft(formatPct(r.functions, baseline.functions), 17)} ${padLeft(formatPct(r.lines, baseline.lines), 17)}  ${statusStr}`
    );
  }

  const allFilesBelow = results.flatMap((r) =>
    r.filesBelow.map((f) => ({ project: r.name, ...f }))
  );

  if (allFilesBelow.length > 0) {
    console.log(`\n  \x1b[1mFiles below baseline:\x1b[0m`);
    const byProject = new Map<string, typeof allFilesBelow>();
    for (const f of allFilesBelow) {
      const existing = byProject.get(f.project) ?? [];
      existing.push(f);
      byProject.set(f.project, existing);
    }

    for (const [project, files] of byProject) {
      const worst = files.sort((a, b) => a.actual - b.actual).slice(0, 5);
      console.log(`    \x1b[33m${project}\x1b[0m:`);
      for (const f of worst) {
        console.log(
          `      ${padRight(f.file, 50)} ${f.metric}: ${colorize(`${f.actual.toFixed(1)}%`, 'FAIL')} (target ${f.target}%)`
        );
      }
      if (files.length > 5) {
        console.log(`      ... and ${files.length - 5} more files`);
      }
    }
  }
}

// --- Execute ---

console.log('\n' + '='.repeat(85));
console.log('  \x1b[1mXIV DYE TOOLS \u2014 COVERAGE TESTING REPORT\x1b[0m');
console.log('='.repeat(85));

const packageResults = collectResults('packages');
const appResults = collectResults('apps');

if (packageResults.length === 0 && appResults.length === 0) {
  console.log(
    '\n  \x1b[33mNo coverage-summary.json files found. Run `pnpm turbo run test:coverage` first.\x1b[0m\n'
  );
  process.exit(1);
}

printTable('PACKAGES', packageResults, PACKAGE_BASELINE);
printTable('APPS', appResults, APP_BASELINE);

const allResults = [...packageResults, ...appResults];
const passing = allResults.filter((r) => r.status === 'PASS').length;
const warning = allResults.filter((r) => r.status === 'WARN').length;
const failing = allResults.filter((r) => r.status === 'FAIL').length;
const skippedApps = ['maintainer'];

console.log('\n' + '\u2500'.repeat(85));
console.log('  \x1b[1mSUMMARY\x1b[0m');
console.log(
  `  ${colorize(`${passing} PASS`, 'PASS')}  ${warning > 0 ? colorize(`${warning} WARN`, 'WARN') : '0 WARN'}  ${failing > 0 ? colorize(`${failing} FAIL`, 'FAIL') : '0 FAIL'}  (${allResults.length} projects total)`
);
if (skippedApps.length > 0) {
  console.log(`  Skipped: ${skippedApps.join(', ')} (no tests)`);
}
console.log('\u2500'.repeat(85) + '\n');

if (failing > 0) {
  process.exit(1);
}
