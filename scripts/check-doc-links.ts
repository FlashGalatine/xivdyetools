#!/usr/bin/env tsx
/**
 * Relative-link gate for the living documentation tier.
 *
 * The 2026-09-05 documentation audit found 207 broken relative links under
 * `docs/`. Every one was in the frozen archive (`docs/audits/**`,
 * `docs/historical/**`), where a link is a record of the tree as it was and is
 * deliberately left alone; the living tier had zero. This gate keeps it that way:
 * a page in the living tier that links to a file which does not exist fails CI,
 * so a rename or a deletion cannot leave a dangling pointer behind.
 *
 * Scope — the living tier, as `docs/README.md` defines it: every tracked `.md`
 * under `docs/` except `docs/audits/**` and `docs/historical/**`, plus the root
 * `README.md` / `CLAUDE.md` / `DEPRECATIONS.md` / `SECURITY.md` and every
 * `README.md` / `CLAUDE.md` directly under `apps/*` and `packages/*`.
 *
 * What counts as a link: an inline markdown link `[text](target)` whose target is
 * relative (not `http(s):`, `mailto:`, a bare `#anchor`, or `<…>`-wrapped). The
 * `#fragment` and `?query` are stripped; a leading `/` means the repo root. Fenced
 * code blocks and inline code spans are masked first, so a link quoted as text to
 * be inserted somewhere else is not a link. Directories are valid targets.
 * Anchors are not validated.
 *
 * Usage: `pnpm docs:check-links` (CI runs it beside the dead-code gate).
 *
 * @entrypoint run by the `docs:check-links` package.json script and its CI step; only its
 * self-test imports it, by design.
 *
 * @module scripts/check-doc-links
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, posix as posixPath, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** Repo-relative `.md` files that make up the living tier. */
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

/** `git ls-files`, forward-slashed. */
export function listTracked(root = process.cwd()): string[] {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .map((l) => l.trim().replace(/\\/g, '/'))
    .filter(Boolean);
}

/** Blank out fenced code blocks and inline code spans, preserving line count. */
export function maskCode(text: string): string {
  const lines = text.split('\n');
  let inFence = false;
  const out = lines.map((line) => {
    const fence = /^\s*(```|~~~)/.test(line);
    if (fence) {
      inFence = !inFence;
      return '';
    }
    if (inFence) return '';
    // Inline code spans: one or more backticks, shortest match.
    return line.replace(/(`+)[^`]*?\1/g, (m) => ' '.repeat(m.length));
  });
  return out.join('\n');
}

const LINK = /\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g;

/** Every relative link target in a masked markdown document, with its line. */
export function extractRelativeLinks(masked: string): { target: string; line: number }[] {
  const found: { target: string; line: number }[] = [];
  const lines = masked.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    LINK.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK.exec(line)) !== null) {
      let target = m[1] ?? '';
      if (target.startsWith('<')) continue; // <autolinks> are URLs by convention
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
  const joined = posixPath.normalize(posixPath.join(base, decoded.replace(/^\//, ''))).replace(/\/+$/, '');
  return joined === '.' ? '' : joined;
}

/** Check one document's links against the filesystem. */
export function checkFile(file: string, text: string, root = process.cwd()): BrokenLink[] {
  const broken: BrokenLink[] = [];
  for (const { target, line } of extractRelativeLinks(maskCode(text))) {
    const resolved = resolveTarget(file, target);
    if (resolved.startsWith('..')) {
      broken.push({ file, line, target, resolved });
      continue;
    }
    if (!existsSync(resolvePath(root, resolved))) broken.push({ file, line, target, resolved });
  }
  return broken;
}

export interface LinkCheckResult {
  ok: boolean;
  files: number;
  links: number;
  broken: BrokenLink[];
}

/** Run the gate over the living tier. `overrides` substitutes file contents (self-test). */
export function runCheck(
  overrides: Readonly<Record<string, string>> = {},
  root = process.cwd(),
): LinkCheckResult {
  const files = livingTierFiles(listTracked(root));
  const broken: BrokenLink[] = [];
  let links = 0;
  for (const file of files) {
    const text = overrides[file] ?? readFileSync(resolvePath(root, file), 'utf8');
    links += extractRelativeLinks(maskCode(text)).length;
    broken.push(...checkFile(file, text, root));
  }
  return { ok: broken.length === 0, files: files.length, links, broken };
}

function main(): void {
  const result = runCheck();
  for (const b of result.broken) {
    console.error(`✗ ${b.file}:${b.line} → ${b.target} (resolved to ${b.resolved || '.'}, missing)`);
  }
  console.log(
    `  checked ${result.links} relative links across ${result.files} living-tier documents` +
      (result.ok ? ' — all resolve' : ''),
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
