#!/usr/bin/env tsx
/**
 * Workers Logs gate: every worker keeps persistent logging off.
 *
 * Both privacy policies (`apps/web-app/PRIVACY.md`, `apps/discord-worker/PRIVACY_POLICY.md`)
 * promise that no request logs are retained. Cloudflare Workers Logs, Logpush and tail
 * consumers are all configurable from `wrangler.toml`, and `observability` is an
 * inheritable key whose absence leaves the state to whatever the dashboard says — so the
 * 2026-10-03 security audit (FINDING-022) pins it off in every worker's config and this
 * gate keeps it there.
 *
 * Per `apps/<worker>/wrangler.toml` (TOML comments stripped first, so prose can neither
 * trip nor satisfy a rule; a file with `pages_build_output_dir` is a Pages project and is
 * skipped):
 *
 *   - REQUIRED: a top-level `[observability]` table whose first key is `enabled = false`;
 *   - REQUIRED when the file has an `[env.production]` table: `[env.production.observability]`
 *     with `enabled = false` as its first key. Other named environments are not required to
 *     repeat it (`observability` is inheritable);
 *   - FORBIDDEN anywhere: `enabled = true` in any spelling (plain key, inline table, `logs` /
 *     `traces` subtable, dotted key), `logpush = true`, a `[[tail_consumers]]` /
 *     `[[env.<name>.tail_consumers]]` header, and a non-empty `tail_consumers = [ ... ]`.
 *
 * Limits: no TOML parser is used, so a multi-line string containing `#` could confuse the
 * comment stripper. wrangler.toml files here contain none.
 *
 * Escape hatch (fail-closed): `ALLOWED_TO_LOG` is empty. Adding a worker's directory name
 * there is how persistent logging is deliberately enabled, and it must land in the same
 * reviewed change that updates both privacy policies (all six languages). This script
 * cannot verify that; review does.
 *
 * Usage: `pnpm workers:check-logs` (CI runs it in the required lint/test/build job).
 *
 * @entrypoint run by the `workers:check-logs` package.json script and its CI step; only
 * its self-test imports it, by design.
 *
 * @module scripts/check-worker-logs
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Worker directory names (under `apps/`) deliberately allowed to enable persistent
 * logging. Keep EMPTY unless the same reviewed change updates both privacy policies in
 * all six languages; the script cannot check that.
 */
export const ALLOWED_TO_LOG: readonly string[] = [];

/** Result for one `wrangler.toml`. */
export interface WorkerLogResult {
  /** Worker directory name, e.g. `oauth`. */
  worker: string;
  status: 'ok' | 'skipped' | 'allowed' | 'problems';
  problems: string[];
}

/** Remove TOML comments: a `#` outside a quoted string through end of line. */
export function stripTomlComments(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      let quote: string | null = null;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
          if (quote === '"' && ch === '\\') i++;
          else if (ch === quote) quote = null;
        } else if (ch === '"' || ch === "'") {
          quote = ch;
        } else if (ch === '#') {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');
}

/** True when `header` is present and the next non-blank line is `enabled = false`. */
function isPinnedOff(lines: string[], header: string): boolean {
  const at = lines.findIndex((l) => l.trim() === header);
  if (at < 0) return false;
  for (let i = at + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === '') continue;
    return /^enabled\s*=\s*false$/.test(t);
  }
  return false;
}

/** Problems with one worker's `wrangler.toml` text; empty means it passes. */
export function checkWorkerConfig(rawText: string): string[] {
  const text = stripTomlComments(rawText.replace(/\r\n/g, '\n'));
  const lines = text.split('\n');
  const problems: string[] = [];

  if (!isPinnedOff(lines, '[observability]')) {
    problems.push('missing top-level [observability] with enabled = false as its first key');
  }
  if (
    // Any [env.production] or [env.production.*] / [[env.production.*]] header
    // means a production env exists, even one defined only through subtables.
    lines.some((l) => /^\[\[?\s*env\.production\s*[.\]]/.test(l.trim())) &&
    !isPinnedOff(lines, '[env.production.observability]')
  ) {
    problems.push(
      'has [env.production] but no [env.production.observability] with enabled = false as its first key',
    );
  }
  if (/\benabled["']?\s*=\s*true\b/.test(text)) problems.push('contains enabled = true (deliberately unanchored: any spelling anywhere fails)');
  if (/\blogpush["']?\s*=\s*true\b/.test(text)) problems.push('contains logpush = true');
  if (/^\s*\[\[\s*(?:[\w-]+\.)*(?:streaming_)?tail_consumers\s*\]\]/m.test(text)) {
    problems.push('declares a [[tail_consumers]] / [[streaming_tail_consumers]] table');
  }
  if (/\b(?:streaming_)?tail_consumers["']?\s*=\s*\[\s*[^\s\]]/.test(text)) {
    problems.push('declares a non-empty tail_consumers / streaming_tail_consumers array');
  }
  return problems;
}

/** Every `apps/<worker>/wrangler.toml`, as worker directory names (sorted). */
export function findWorkerConfigs(root = process.cwd()): string[] {
  const appsDir = join(root, 'apps');
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() &&
        ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'].some((f) =>
          existsSync(join(appsDir, e.name, f)),
        ),
    )
    .map((e) => e.name)
    .sort();
}

/** Check every worker under `root`; `allowed` defaults to {@link ALLOWED_TO_LOG}. */
export function runCheck(
  root = process.cwd(),
  allowed: readonly string[] = ALLOWED_TO_LOG,
): WorkerLogResult[] {
  return findWorkerConfigs(root).map((worker) => {
    const dir = join(root, 'apps', worker);
    if (['wrangler.json', 'wrangler.jsonc'].some((f) => existsSync(join(dir, f)))) {
      return {
        worker,
        status: 'problems',
        problems: ['has a wrangler.json/jsonc, which this gate cannot read; extend it first'],
      };
    }
    const text = readFileSync(join(dir, 'wrangler.toml'), 'utf8');
    if (/^\s*pages_build_output_dir\s*=/m.test(stripTomlComments(text))) {
      return { worker, status: 'skipped', problems: [] };
    }
    if (allowed.includes(worker)) return { worker, status: 'allowed', problems: [] };
    const problems = checkWorkerConfig(text);
    return { worker, status: problems.length === 0 ? 'ok' : 'problems', problems };
  });
}

function main(): void {
  const results = runCheck();
  if (results.length === 0) {
    console.error('✗ no apps/*/wrangler.toml found — run from the repository root');
    process.exit(1);
  }
  for (const r of results) {
    if (r.status === 'problems') console.error(`✗ ${r.worker}: ${r.problems.join('; ')}`);
    else console.log(`✓ ${r.worker}: ${r.status}`);
  }
  const bad = results.filter((r) => r.status === 'problems').length;
  console.log(
    `  checked ${results.length} worker configs — ` +
      (bad === 0 ? 'Workers Logs pinned off everywhere' : `${bad} with problems`),
  );
  if (bad > 0) process.exit(1);
}

/**
 * Same guard as `check-doc-versions.ts`: resolve both sides so a junction or
 * symlinked worktree still runs `main()`. Kept as a local copy on purpose.
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
