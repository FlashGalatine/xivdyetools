#!/usr/bin/env tsx
/**
 * Relative-link gate for the documentation.
 *
 * The 2026-09-05 documentation audit found 207 broken relative links under
 * `docs/`. Every one was in the archive (`docs/audits/**`, `docs/historical/**`),
 * where a link is a record of the tree as it was and is deliberately left alone;
 * the rest had zero. This gate keeps it that way: a page outside the archive that
 * links to a file which does not exist fails CI, so a rename or a deletion cannot
 * leave a dangling pointer behind.
 *
 * Scope — every tracked `.md` under `docs/` except the archive tier
 * (`docs/audits/**`, `docs/historical/**`), plus the root `README.md` /
 * `CLAUDE.md` / `DEPRECATIONS.md` / `SECURITY.md` and every `README.md` /
 * `CLAUDE.md` directly under `apps/*` and `packages/*`. `docs/research/` and
 * `docs/superpowers/` are frozen-body but link-maintained, so they are in.
 *
 * What counts as a link: an inline markdown link `[text](target)` whose target is
 * relative — not `http(s):`, `mailto:` or another scheme, and not a bare
 * `#anchor`. The destination may be `<angle-bracketed>` (spaces allowed) or bare
 * (one level of balanced parentheses allowed, per CommonMark). The `#fragment`
 * and `?query` are stripped; a leading `/` means the repo root. Fenced code
 * blocks, inline code spans and HTML comments are masked first, so a link quoted
 * as text, or parked in a comment, is not a link. Anchors are not validated.
 *
 * Targets are resolved against the git-tracked file list (exact case, tracked
 * files and the directories they imply), not the filesystem — `existsSync` is
 * case-insensitive on Windows and macOS and is satisfied by untracked or built
 * files, so a link could pass locally and 404 on github.com or fail in CI.
 *
 * Usage: `pnpm docs:check-links` (CI runs it beside the dead-code gate).
 *
 * @entrypoint run by the `docs:check-links` package.json script and its CI step; only its
 * self-test imports it, by design.
 *
 * @module scripts/check-doc-links
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, posix as posixPath, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { maskCode } from './markdown-mask.js';

/** A relative link that does not resolve. */
export interface BrokenLink {
  file: string;
  /** 1-based line of the link. */
  line: number;
  /** The target exactly as written in the document. */
  target: string;
  /** Repo-relative path the target resolved to. */
  resolved: string;
}

/** Repo-relative `.md` files the gate covers. */
export function livingTierFiles(tracked: readonly string[]): string[] {
  return tracked.filter((f) => {
    if (!f.endsWith('.md')) return false;
    if (f.startsWith('docs/')) {
      return !f.startsWith('docs/audits/') && !f.startsWith('docs/historical/');
    }
    if (/^(README|CLAUDE|DEPRECATIONS|SECURITY)\.md$/.test(f)) return true;
    return /^(apps|packages)\/[^/]+\/(README|CLAUDE)\.md$/.test(f);
  });
}

/** `git ls-files`, forward-slashed. (`check-dead-code`'s own `listTracked` keeps only source files.) */
export function listTracked(root = process.cwd()): string[] {
  return execFileSync('git', ['ls-files'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\n')
    .map((l) => l.trim().replace(/\\/g, '/'))
    .filter(Boolean);
}

/** Every tracked path plus every directory a tracked path implies, exact case. */
export function trackedPathSet(tracked: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const f of tracked) {
    set.add(f);
    let dir = posixPath.dirname(f);
    while (dir && dir !== '.' && !set.has(dir)) {
      set.add(dir);
      dir = posixPath.dirname(dir);
    }
  }
  return set;
}

// `](` then either `<destination>` or a bare destination with one level of
// balanced parentheses, then an optional "title", then `)`.
const LINK = /\]\(\s*(?:<([^>\n]*)>|((?:[^()\s]|\([^()\s]*\))+))(?:\s+"[^"]*")?\s*\)/g;

/** Every relative link target in a masked markdown document, with its line. */
export function extractRelativeLinks(masked: string): { target: string; line: number }[] {
  const found: { target: string; line: number }[] = [];
  const lines = masked.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    LINK.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK.exec(line)) !== null) {
      let target = (m[1] ?? m[2] ?? '').trim();
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // http:, https:, mailto:, etc.
      if (target.startsWith('#')) continue; // same-file anchor
      target = target.replace(/#.*$/, '').replace(/\?.*$/, '');
      if (!target) continue;
      found.push({ target, line: i + 1 });
    }
  }
  return found;
}

/** Resolve a link target written in `file` to a repo-relative path. */
export function resolveTarget(file: string, target: string): string {
  let decoded = target;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    /* keep raw */
  }
  const base = decoded.startsWith('/') ? '.' : dirname(file);
  const joined = posixPath
    .normalize(posixPath.join(base, decoded.replace(/^\//, '')))
    .replace(/\/+$/, '');
  return joined === '.' ? '' : joined;
}

/** Check one document's links against the tracked-path set. Returns the links seen and the broken ones. */
export function checkFile(
  file: string,
  text: string,
  known: ReadonlySet<string>,
): { links: number; broken: BrokenLink[] } {
  const broken: BrokenLink[] = [];
  const links = extractRelativeLinks(maskCode(text));
  for (const { target, line } of links) {
    const resolved = resolveTarget(file, target);
    if (resolved.startsWith('..') || (resolved !== '' && !known.has(resolved))) {
      broken.push({ file, line, target, resolved });
    }
  }
  return { links: links.length, broken };
}

export interface LinkCheckResult {
  ok: boolean;
  files: number;
  links: number;
  broken: BrokenLink[];
}

/** Run the gate. `overrides` substitutes file contents (self-test). */
export function runCheck(
  overrides: Readonly<Record<string, string>> = {},
  root = process.cwd(),
): LinkCheckResult {
  const tracked = listTracked(root);
  const known = trackedPathSet(tracked);
  const files = livingTierFiles(tracked);
  const broken: BrokenLink[] = [];
  let links = 0;
  for (const file of files) {
    const text = overrides[file] ?? readFileSync(resolvePath(root, file), 'utf8');
    const result = checkFile(file, text, known);
    links += result.links;
    broken.push(...result.broken);
  }
  return { ok: broken.length === 0, files: files.length, links, broken };
}

function main(): void {
  const result = runCheck();
  for (const b of result.broken) {
    console.error(
      `✗ ${b.file}:${b.line} → ${b.target} (resolved to ${b.resolved || '.'}, not a tracked path)`,
    );
  }
  console.log(
    `  checked ${result.links} relative links across ${result.files} documents` +
      (result.ok ? ' — all resolve' : ''),
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
