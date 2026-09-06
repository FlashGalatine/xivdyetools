#!/usr/bin/env tsx
/**
 * Version-table drift gate for the documentation.
 *
 * Two files carry a hand-maintained table of every workspace's version: the root
 * `README.md` (the GitHub landing page) and `docs/versions.md` (the version matrix
 * the rest of `docs/` links to instead of repeating). Nothing used to check them
 * against `package.json`, and by 2026-09-05 they — and four more copies since
 * removed — were between one and seven releases behind on every row, each file a
 * different snapshot. A version bump is part of every release here, so a table
 * that lags is not an oversight anyone notices; it is the default.
 *
 * The rule is table-shaped so the history tables in `docs/versions.md` (one row
 * per release, whose highlight prose routinely names *other* packages) and the
 * Deprecated table (retired packages with a "Last Version" column) never register:
 *
 *   - Only rows of a table whose header has a column named exactly `Version`
 *     (case-insensitive) are read, and only that column supplies the version.
 *   - The workspace comes from the first cell, or from a `Package Name` /
 *     `Package` / `App` / `Project` column, and must be exactly a package name
 *     (bare or backticked) or a markdown link whose target is the workspace
 *     directory (`packages/<p>/`, `apps/<a>/`). Prose never resolves.
 *   - Fenced code and HTML comments are masked first, so an example table is
 *     not a claim (inline spans are kept — a backticked name is formatting).
 *
 * Three failure modes, all exit 1: a claim that disagrees with `package.json`; a
 * claim naming a version that is not semver; and either checked file lacking a
 * row for any workspace — the last is what stops a reshaped table from turning
 * this into a gate that cannot fail.
 *
 * Usage: `pnpm docs:check-versions` (CI runs it beside the dead-code gate).
 *
 * @entrypoint run by the `docs:check-versions` package.json script and its CI step; only
 * its self-test imports it, by design.
 *
 * @module scripts/check-doc-versions
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { maskBlockCode } from './markdown-mask.js';

/** One workspace as `package.json` describes it. */
export interface WorkspaceVersion {
  /** `package.json#name`, e.g. `@xivdyetools/core` or `xivdyetools-oauth-worker`. */
  name: string;
  /** Repo-relative directory, e.g. `packages/core` or `apps/oauth`. */
  dir: string;
  version: string;
}

/** A version a documentation table asserts for a workspace. */
export interface VersionClaim {
  file: string;
  /** 1-based line of the table row. */
  line: number;
  /** Resolved `package.json#name`. */
  workspace: string;
  version: string;
}

/** Files whose tables are checked; each must cover every workspace. */
export const CHECKED_FILES = ['README.md', 'docs/versions.md'] as const;

const WORKSPACE_ROOTS = ['packages', 'apps'] as const;

/** Every `packages/*` and `apps/*` directory with a `package.json`. */
export function readWorkspaceVersions(root = process.cwd()): WorkspaceVersion[] {
  const out: WorkspaceVersion[] = [];
  for (const parent of WORKSPACE_ROOTS) {
    const parentPath = join(root, parent);
    if (!existsSync(parentPath)) continue;
    for (const entry of readdirSync(parentPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(parentPath, entry.name, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string; version?: string };
      if (typeof pkg.name !== 'string' || typeof pkg.version !== 'string') continue;
      out.push({ name: pkg.name, dir: `${parent}/${entry.name}`, version: pkg.version });
    }
  }
  return out.sort((a, b) => a.dir.localeCompare(b.dir));
}

const VERSION_CELL = /^v?(\d+\.\d+\.\d+)$/;
const LINK_CELL = /^\[([^\]]*)\]\(([^)]*)\)$/;
const NAME_COLUMNS = new Set(['package name', 'package', 'app', 'project']);

/** Strip surrounding bold markers, backticks and whitespace from a table cell. */
function bare(cell: string): string {
  let s = cell.trim();
  for (;;) {
    const before = s;
    if (s.startsWith('**') && s.endsWith('**') && s.length >= 4) s = s.slice(2, -2).trim();
    if (s.startsWith('`') && s.endsWith('`') && s.length >= 2) s = s.slice(1, -1).trim();
    if (s === before) return s;
  }
}

/** Split a `| a | b |` row into trimmed cells. */
function cellsOf(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
}

/**
 * Resolve a cell to a workspace, or null. A bare/backticked cell must equal the
 * package name or the repo-relative directory; a link resolves through its
 * target only (the README links `apps/oauth/` under the text `oauth`).
 */
function resolveWorkspaceCell(
  cell: string,
  workspaces: readonly WorkspaceVersion[],
): WorkspaceVersion | null {
  const raw = bare(cell);
  const link = LINK_CELL.exec(raw);
  const candidates = link ? [(link[2] ?? '').trim()] : [raw];
  for (const candidate of candidates) {
    const norm = candidate.replace(/^\.\//, '').replace(/\/+$/, '');
    for (const ws of workspaces) {
      if (norm === ws.name || norm === ws.dir) return ws;
    }
  }
  return null;
}

/** Every version claim a markdown file makes, by the rule in the module docblock. */
export function extractDocVersions(
  markdown: string,
  file: string,
  workspaces: readonly WorkspaceVersion[],
): VersionClaim[] {
  const claims: VersionClaim[] = [];
  const lines = maskBlockCode(markdown).split('\n');
  let versionCol = -1;
  let nameCols: number[] = [];
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const isRow = line.trim().startsWith('|');
    if (!isRow) {
      inTable = false;
      continue;
    }
    const next = lines[i + 1] ?? '';
    if (!inTable && /^\s*\|?\s*:?-{3,}/.test(next)) {
      // Header row: learn the columns for this table.
      const header = cellsOf(line).map((c) => bare(c).toLowerCase());
      versionCol = header.indexOf('version');
      nameCols = header
        .map((h, idx) => (idx === 0 || NAME_COLUMNS.has(h) ? idx : -1))
        .filter((idx) => idx >= 0);
      inTable = true;
      i++; // skip the separator row
      continue;
    }
    if (!inTable || versionCol < 0) continue;
    const cells = cellsOf(line);
    const m = VERSION_CELL.exec(bare(cells[versionCol] ?? ''));
    if (!m) continue;
    let workspace: WorkspaceVersion | null = null;
    for (const idx of nameCols) {
      workspace = resolveWorkspaceCell(cells[idx] ?? '', workspaces);
      if (workspace) break;
    }
    if (workspace)
      claims.push({ file, line: i + 1, workspace: workspace.name, version: m[1] ?? '' });
  }
  return claims;
}

/** Human-readable mismatch lines, one per claim that disagrees with `package.json`. */
export function compareClaims(
  claims: readonly VersionClaim[],
  workspaces: readonly WorkspaceVersion[],
): string[] {
  const byName = new Map(workspaces.map((w) => [w.name, w]));
  const out: string[] = [];
  for (const c of claims) {
    const ws = byName.get(c.workspace);
    if (!ws) continue;
    if (ws.version !== c.version) {
      out.push(
        `${c.file}:${c.line} — ${c.workspace} says ${c.version}, ${ws.dir}/package.json says ${ws.version}`,
      );
    }
  }
  return out;
}

export interface CheckResult {
  ok: boolean;
  claims: VersionClaim[];
  mismatches: string[];
  /** `<file>: <workspace>` for every workspace a checked file has no row for. */
  uncovered: string[];
}

/**
 * Run the whole check. `overrides` substitutes file contents by repo-relative
 * path — the self-test uses it to prove an emptied table fails rather than
 * passing on zero claims.
 */
export function runCheck(
  overrides: Readonly<Record<string, string>> = {},
  root = process.cwd(),
): CheckResult {
  const workspaces = readWorkspaceVersions(root);
  const claims: VersionClaim[] = [];
  const uncovered: string[] = [];
  for (const file of CHECKED_FILES) {
    const text = overrides[file] ?? readFileSync(join(root, file), 'utf8');
    const fileClaims = extractDocVersions(text, file, workspaces);
    claims.push(...fileClaims);
    const covered = new Set(fileClaims.map((c) => c.workspace));
    for (const w of workspaces) if (!covered.has(w.name)) uncovered.push(`${file}: ${w.name}`);
  }
  const mismatches = compareClaims(claims, workspaces);
  return { ok: mismatches.length === 0 && uncovered.length === 0, claims, mismatches, uncovered };
}

function main(): void {
  const result = runCheck();
  for (const m of result.mismatches) console.error(`✗ ${m}`);
  for (const u of result.uncovered) console.error(`✗ no version row for ${u}`);
  console.log(
    `  checked ${result.claims.length} version claims across ${CHECKED_FILES.join(', ')}` +
      (result.ok ? ' — all match package.json' : ''),
  );
  if (!result.ok) process.exit(1);
}

/**
 * Same guard as `check-dead-code.ts`: resolve both sides so a junction or
 * symlinked worktree still runs `main()`. Kept as a local copy on purpose —
 * importing it from the dead-code checker gives that module a production
 * importer and changes what its own gate reports about its exports.
 */
function isMainModule(argv1: string | undefined, moduleUrl: string): boolean {
  if (!argv1) return false;
  const real = (p: string): string => {
    try {
      return realpathSync.native(p);
    } catch {
      return resolvePath(p);
    }
  };
  return real(argv1) === real(fileURLToPath(moduleUrl));
}

if (isMainModule(process.argv[1], import.meta.url)) {
  main();
}
