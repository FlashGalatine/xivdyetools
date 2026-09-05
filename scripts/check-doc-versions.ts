#!/usr/bin/env tsx
/**
 * Version-table drift gate for the documentation.
 *
 * Two files carry a hand-maintained table of every workspace's version: the root
 * `README.md` (the GitHub landing page) and `docs/versions.md` (the version matrix
 * the rest of `docs/` links to instead of repeating). Nothing used to check them
 * against `package.json`, and by 2026-09-05 they — and three more copies since
 * removed — were between one and seven releases behind on every row, each file a
 * different snapshot. A version bump is part of every release here, so a table
 * that lags is not an oversight anyone notices; it is the default.
 *
 * The rule is deliberately narrow so the history tables in `docs/versions.md`
 * (one row per release, whose highlight prose routinely names *other* packages)
 * never register: a table row claims a version only when one cell is exactly a
 * semver (`1.2.3` / `v1.2.3`, bold allowed) and another cell is exactly a
 * workspace reference — a backticked or bare package name, or a markdown link
 * whose target is the workspace directory (`packages/<p>/`, `apps/<a>/`).
 * Names that are not workspaces (retired packages, archived projects) are ignored.
 *
 * Two failure modes, both exit 1: a claim that disagrees with `package.json`, and
 * `docs/versions.md` missing a row for any workspace — the second is what stops a
 * reshaped table from turning this into a gate that cannot fail.
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

/** Files whose tables are checked. `docs/versions.md` must also cover every workspace. */
export const CHECKED_FILES = ['README.md', 'docs/versions.md'] as const;
export const COVERAGE_FILE = 'docs/versions.md';

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

/**
 * Resolve a cell to a workspace, or null. Accepts the package name (bare or
 * backticked), the directory name (`core`, `web-app`), the repo-relative
 * directory (`packages/core`), or a markdown link whose target is one of those
 * with an optional trailing slash — the shapes the two checked files use.
 */
function resolveWorkspaceCell(cell: string, workspaces: readonly WorkspaceVersion[]): WorkspaceVersion | null {
  const raw = cell.trim();
  const link = LINK_CELL.exec(raw.replace(/^\*\*|\*\*$/g, '').trim());
  const candidates = link ? [bare(link[1] ?? ''), (link[2] ?? '').trim()] : [bare(raw)];
  for (const candidate of candidates) {
    const norm = candidate.replace(/^\.\//, '').replace(/\/+$/, '');
    for (const ws of workspaces) {
      if (norm === ws.name || norm === ws.dir || norm === ws.dir.split('/')[1]) return ws;
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
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!line.trim().startsWith('|')) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
    let version: string | null = null;
    let workspace: WorkspaceVersion | null = null;
    for (const cell of cells) {
      const m = VERSION_CELL.exec(bare(cell));
      if (m && version === null) {
        version = m[1] ?? null;
        continue;
      }
      if (workspace === null) workspace = resolveWorkspaceCell(cell, workspaces);
    }
    if (version !== null && workspace !== null) {
      claims.push({ file, line: i + 1, workspace: workspace.name, version });
    }
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
      out.push(`${c.file}:${c.line} — ${c.workspace} says ${c.version}, ${ws.dir}/package.json says ${ws.version}`);
    }
  }
  return out;
}

export interface CheckResult {
  ok: boolean;
  claims: VersionClaim[];
  mismatches: string[];
  /** Workspaces `docs/versions.md` has no row for. */
  uncovered: string[];
}

/**
 * Run the whole check. `overrides` substitutes file contents by repo-relative
 * path — the self-test uses it to prove an emptied table fails rather than
 * passing on zero claims.
 */
export function runCheck(overrides: Readonly<Record<string, string>> = {}, root = process.cwd()): CheckResult {
  const workspaces = readWorkspaceVersions(root);
  const claims: VersionClaim[] = [];
  for (const file of CHECKED_FILES) {
    const text = overrides[file] ?? readFileSync(join(root, file), 'utf8');
    claims.push(...extractDocVersions(text, file, workspaces));
  }
  const mismatches = compareClaims(claims, workspaces);
  const covered = new Set(claims.filter((c) => c.file === COVERAGE_FILE).map((c) => c.workspace));
  const uncovered = workspaces.filter((w) => !covered.has(w.name)).map((w) => w.name);
  return { ok: mismatches.length === 0 && uncovered.length === 0, claims, mismatches, uncovered };
}

function main(): void {
  const result = runCheck();
  for (const m of result.mismatches) console.error(`✗ ${m}`);
  if (result.uncovered.length) {
    console.error(`✗ ${COVERAGE_FILE} has no version row for: ${result.uncovered.join(', ')}`);
  }
  console.log(
    `  checked ${result.claims.length} version claims across ${CHECKED_FILES.join(', ')}` +
      (result.ok ? ' — all match package.json' : ''),
  );
  if (!result.ok) process.exit(1);
}

/** Same guard as `check-dead-code.ts`: resolve both sides so a junction or symlinked worktree still runs `main()`. */
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
